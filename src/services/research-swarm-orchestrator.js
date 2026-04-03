/**
 * Research Swarm Orchestrator - Multi-device lightweight model orchestration
 * Distributes research subtasks across devices with 5.6GB models
 */

import { lmStudioSwitcher } from "./lm-studio-switcher.js";
import { deviceRegistry } from "./device-registry.js";
import { loadTracker } from "./load-tracker.js";
import { loadModelDNA, saveDNAToFile } from "../utils/model-dna-manager.js";
import {
  checkMemoryAvailable,
  getConcurrentLightweightCount,
  canDispatchLightweightModel,
  recordSwarmRequestStart,
  recordSwarmRequestEnd,
  decrementLightweightModelCount,
} from "../utils/swarm-guardrails.js";

// Track subtask errors for proper cleanup
const _subtaskErrors = new Map();

/**
 * Type Definitions (for documentation)
 * @typedef {Object} ResearchSubtask
 * @property {string} id - Unique subtask identifier
 * @property {string} query - Research question for this subtask
 * @property {string} requiredCapabilities - Required model capabilities
 * @property {string|null} assignedModelKey - Model key assigned to this subtask
 */

/**
 * Type Definitions (for documentation)
 * @typedef {Object} SubtaskResult
 * @property {string} id - Subtask ID
 * @property {string} content - Research result content
 * @property {number} tokenCount - Approximate token count
 * @property {boolean} success - Whether subtask completed successfully
 * @property {string|null} error - Error message if failed
 */

/**
 * Type Definitions (for documentation)
 * @typedef {Object} SwarmOrchestrationResult
 * @property {string} query - Original research query
 * @property {number} totalSubtasks - Total subtasks dispatched
 * @property {number} successfulSubtasks - Successfully completed subtasks
 * @property {Array<SubtaskResult>} results - Individual subtask results
 * @property {Object} aggregatedResult - Final compacted result
 * @property {string} aggregationTokenCount - Token count in final result
 */

/**
 * ResearchSwarmOrchestrator Class
 * Orchestrates research queries across multiple lightweight models on distributed devices
 */
export class ResearchSwarmOrchestrator {
  constructor() {
    this.orchestratorModelId = null;
    this.swarmConfig = {
      enabled: true,
      maxLightweightModelsPerDevice: 2,
      subtaskMaxTokens: 4000,
      finalAggregationMaxTokens: 8000,
      minMemoryGB: 8,
      maxSubtasks: 8,
      fallbackEnabled: true,
    };

    // Lightweight models for SWARM research - dynamically populated from LM Studio
    // These are models under ~10GB that work well for distributed research
    this.lightweightModelIds = [
      "qwen3.5-9b-omnicoder-claude-polaris-text-dwq4-mlx",
      "meta-llama-3.2-9b-instruct",
    ];
    
    // Additional lightweight model patterns to auto-discover
    this.lightweightModelPatterns = [
      /qwen.*9b/i,
      /llama.*3\.2.*9b/i,
      /gemma.*4.*it/i,
    ];

    this._loadedLightweightModels = new Map(); // device -> modelKey mapping
  }

  /**
   * Initialize the orchestrator with configuration from DNA
   */
  async initialize() {
    console.log("[ResearchSwarm] Initializing...");

    const dna = loadModelDNA();

    if (dna?.orchestratorConfig?.swarm) {
      this.swarmConfig = { ...this.swarmConfig, ...dna.orchestratorConfig.swarm };
    }

    // Set orchestrator model ID from task mapping
    this.orchestratorModelId = dna?.taskModelMapping?.orchestrateResearch || "architect";

    console.log(`[ResearchSwarm] Initialized with config:`, {
      maxSubtasks: this.swarmConfig.maxSubtasks,
      subtaskMaxTokens: this.swarmConfig.subtaskMaxTokens,
      finalAggregationMaxTokens: this.swarmConfig.finalAggregationMaxTokens,
    });
  }

  /**
   * Decompose a research query into subtasks
   * @param {string} query - Original research query
   * @param {number} maxSubtasks - Maximum number of subtasks to create
   * @returns {Array<ResearchSubtask>} Array of subtasks
   */
  async decomposeResearchQuery(query, maxSubtasks = null) {
    const subtasks = [];
    const taskLimit = maxSubtasks || this.swarmConfig.maxSubtasks;

    // Simple query decomposition strategy
    // In production, we could use the orchestrator model to do smart decomposition

    // Check for common research patterns and split accordingly
    const patterns = [
      { regex: /compare|vs\.?|versus/, action: "split-comparisons" },
      { regex: /\bfirst\b.*\band\b.*\blast\b/i, action: "split-enum" },
      { regex: /step \d+|phase \d+|stage \d+/i, action: "split-steps" },
    ];

    let decompositionMethod = "single"; // default

    for (const pattern of patterns) {
      if (pattern.regex.test(query.toLowerCase())) {
        decompositionMethod = pattern.action;
        break;
      }
    }

    switch (decompositionMethod) {
      case "single":
        // One main subtask for the entire query
        subtasks.push({
          id: `subtask-1`,
          query,
          requiredCapabilities: ["llm"],
        });
        break;

      default:
        // Create a reasonable number of subtasks based on query complexity
        const numSubtasks = Math.min(taskLimit, 4); // Conservative for now

        for (let i = 0; i < numSubtasks; i++) {
          subtasks.push({
            id: `subtask-${i + 1}`,
            query: `${query} - Focus on aspects ${i + 1} of the analysis`,
            requiredCapabilities: ["llm"],
          });
        }
    }

    console.log(`[ResearchSwarm] Decomposed query into ${subtasks.length} subtasks`);

    return subtasks;
  }

  /**
   * Get devices available for lightweight model deployment
   * @returns {Promise<Array<{ deviceId: string, modelKey: string }>>} Available device/model pairs
   */
  async getAvailableLightweightDevices() {
    const available = [];

    // Check memory availability first
    const memoryCheck = await checkMemoryAvailable(this.swarmConfig.minMemoryGB);

    if (!memoryCheck.allowed) {
      console.warn(`[ResearchSwarm] Insufficient memory for SWARM: ${memoryCheck.reason}`);
      return [];
    }

    // Get all online devices
    const onlineDevices = deviceRegistry.getOnlineDevices();

    if (onlineDevices.length === 0) {
      console.warn("[ResearchSwarm] No online devices available");
      return [];
    }

    // Check each device for lightweight model capacity
    for (const device of onlineDevices) {
      const deviceId = device.id;

      // Try each lightweight model in order of preference
      for (const modelKey of this.lightweightModelIds) {
        const dispatchCheck = await canDispatchLightweightModel(deviceId, modelKey);

        if (dispatchCheck.allowed) {
          available.push({ deviceId, modelKey });
          break; // Only one lightweight model per device
        }
      }

      // If no lightweight models fit, use fallback to main orchestrator model
      if (this.swarmConfig.fallbackEnabled && !available.some(d => d.deviceId === deviceId)) {
        console.log(`[ResearchSwarm] Fallback: using orchestrator model on ${deviceId}`);
        available.push({ deviceId, modelKey: this.orchestratorModelId });
      }
    }

    console.log(`[ResearchSwarm] Found ${available.length} devices for lightweight research deployment`);

    return available;
  }

  /**
   * Dispatch subtasks to available lightweight models
   * @param {Array<ResearchSubtask>} subtasks - Subtasks to dispatch
   * @returns {Promise<Array<{ subtask: ResearchSubtask, deviceId: string, modelKey: string }>>} Dispatched assignments
   */
  async dispatchToLightweightModels(subtasks) {
    const availableDevices = await this.getAvailableLightweightDevices();

    if (availableDevices.length === 0) {
      console.warn("[ResearchSwarm] No devices available for lightweight model deployment");
      return [];
    }

    // Assign subtasks to devices
    const assignments = [];

    for (let i = 0; i < Math.min(subtasks.length, this.swarmConfig.maxSubtasks); i++) {
      const subtask = subtasks[i];
      const deviceIndex = i % availableDevices.length;
      const { deviceId, modelKey } = availableDevices[deviceIndex];

      assignments.push({ subtask, deviceId, modelKey });

      // Mark lightweight model as in-use on this device
      recordSwarmRequestStart(deviceId, modelKey);
    }

    console.log(`[ResearchSwarm] Assigned ${assignments.length} subtasks to devices`);

    return assignments;
  }

  /**
   * Execute a single research subtask
   * @param {Object} assignment - Subtask assignment
   * @param {string} assignment.subtask.id - Subtask ID
   * @param {string} assignment.subtask.query - Query to execute
   * @param {string} assignment.deviceId - Device ID for execution
   * @param {string} assignment.modelKey - Model key to use
   * @returns {Promise<SubtaskResult>} Result of subtask execution
   */
  async executeSubtask(assignment) {
    const { subtask, deviceId, modelKey } = assignment;
    const startTime = Date.now();

    console.log(`[ResearchSwarm] Executing ${subtask.id} on ${deviceId} with ${modelKey}`);

    try {
      // Check if model is loaded (load if needed)
      let modelLoaded = false;

      if (!this._loadedLightweightModels.has(deviceId)) {
        const loadResult = await lmStudioSwitcher.loadModel(modelKey);

        if (loadResult.loaded || loadResult.alreadyLoaded) {
          this._loadedLightweightModels.set(deviceId, modelKey);
          modelLoaded = true;
        } else {
          throw new Error(`Failed to load model ${modelKey}: ${loadResult.error}`);
        }
      }

      // Execute the research query
      const completionResult = await lmStudioSwitcher.executeChatCompletion(
        modelKey,
        [
          { role: "system", content: "You are a research assistant. Provide concise, focused answers." },
          { role: "user", content: subtask.query },
        ],
        {
          max_output_tokens: this.swarmConfig.subtaskMaxTokens,
          temperature: 0.7,
          taskType: "generalResearch",
        }
      );

      if (!completionResult.success) {
        throw new Error(`Subtask execution failed: ${completionResult.error}`);
      }

      const result = completionResult.result;

      console.log(
        `[ResearchSwarm] ${subtask.id} completed in ${Date.now() - startTime}ms (${result.usage.total_tokens || 0} tokens)`
      );

      return {
        id: subtask.id,
        content: result.content,
        tokenCount: result.usage.completion_tokens || 0,
        deviceId,
        modelKey,
        success: true,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      console.error(`[ResearchSwarm] ${subtask.id} failed: ${error.message}`);
      
      // Track the error for cleanup (use false flag)
      _subtaskErrors.set(subtask.id, { deviceId, modelKey, success: false });

      return {
        id: subtask.id,
        content: "",
        tokenCount: 0,
        deviceId,
        modelKey,
        success: false,
        error: error.message,
        durationMs: Date.now() - startTime,
      };
    } finally {
      // Mark request as completed with correct success flag
      const hadError = _subtaskErrors.has(subtask.id);
      recordSwarmRequestEnd(deviceId, modelKey, !hadError);
      if (hadError) {
        _subtaskErrors.delete(subtask.id);
      }
    }
  }

  /**
   * Compact a result to target token count using LLM summarization
   * @param {string} content - Content to compact
   * @param {number} targetTokens - Target token count
   * @returns {Promise<{ content: string, tokenCount: number }>} Compacted result
   */
  async compactResult(content, targetTokens) {
    // If already small enough, return as-is
    if (content.length < targetTokens * 3) {
      return { content, tokenCount: Math.round(content.length / 3) };
    }

    try {
      const modelId = this.orchestratorModelId || "architect";

      console.log(`[ResearchSwarm] Compacting result to ~${targetTokens} tokens using ${modelId}`);

      const systemPrompt = `You are a text summarization expert. Condense the following content to approximately ${targetTokens} tokens while preserving all essential information, key insights, and any important data points or references.`;

      const completionResult = await lmStudioSwitcher.executeChatCompletion(
        modelId,
        [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Please condense the following research results:\n\n${content}`,
          },
        ],
        {
          max_output_tokens: targetTokens,
          temperature: 0.5,
          taskType: "summarization",
        }
      );

      if (!completionResult.success) {
        console.warn(`[ResearchSwarm] Compaction failed, returning original content`);
        return { content, tokenCount: Math.round(content.length / 3) };
      }

      const result = completionResult.result;

      console.log(
        `[ResearchSwarm] Result compacted from ${Math.round(content.length / 3)} to ${result.usage.completion_tokens || 0} tokens`
      );

      return {
        content: result.content,
        tokenCount: result.usage.completion_tokens || 0,
      };
    } catch (error) {
      console.error(`[ResearchSwarm] Compaction failed: ${error.message}`);

      // Fallback: simple truncation
      const maxChars = targetTokens * 3;
      return {
        content: content.slice(0, maxChars),
        tokenCount: Math.round(content.length / 3),
      };
    }
  }

  /**
   * Aggregate all subtask results into a final compacted response
   * @param {Array<SubtaskResult>} results - Individual subtask results
   * @returns {Promise<{ content: string, tokenCount: number }>} Aggregated result
   */
  async aggregateResults(results) {
    const successfulResults = results.filter(r => r.success);

    if (successfulResults.length === 0) {
      return {
        content: "All research subtasks failed. Please check the model availability and try again.",
        tokenCount: 0,
        error: true,
      };
    }

    // Collect all content
    const combinedContent = successfulResults
      .map(r => `## Research Findings for Subtask ${r.id}\n\n${r.content}`)
      .join("\n\n");

    console.log(
      `[ResearchSwarm] Aggregating ${successfulResults.length} subtasks (${combinedContent.length} chars)`
    );

    // FIX: Only compact once - directly to final limit, not twice
    // Previously this was double-compacting (first per-result to 4000 tokens, then combined to 8000)
    // This loses information and is inefficient
    
    return await this.compactResult(combinedContent, this.swarmConfig.finalAggregationMaxTokens);
  }

  /**
   * Main orchestration flow for research queries
   * @param {string} query - Research query to execute
   * @param {Object} options - Options
   * @param {number} [options.maxSubtasks] - Override max subtasks
   * @returns {Promise<SwarmOrchestrationResult>} Complete orchestration result
   */
  async orchestrate(query, options = {}) {
    console.log(`[ResearchSwarm] Starting orchestration for query: "${query.substring(0, 100)}..."`);

    const startTime = Date.now();
    const maxSubtasks = options.maxSubtasks || this.swarmConfig.maxSubtasks;

    // Step 1: Decompose query
    const subtasks = await this.decomposeResearchQuery(query, maxSubtasks);

    if (subtasks.length === 0) {
      return {
        query,
        totalSubtasks: 0,
        successfulSubtasks: 0,
        results: [],
        aggregatedResult: { content: "No subtasks could be generated", tokenCount: 0 },
        durationMs: Date.now() - startTime,
        error: "Query decomposition failed",
      };
    }

    // Step 2: Dispatch to devices
    const assignments = await this.dispatchToLightweightModels(subtasks);

    if (assignments.length === 0) {
      return {
        query,
        totalSubtasks: subtasks.length,
        successfulSubtasks: 0,
        results: [],
        aggregatedResult: { content: "No devices available for research", tokenCount: 0 },
        durationMs: Date.now() - startTime,
        error: "No devices available",
      };
    }

    // Step 3: Execute subtasks in parallel
    const executionPromises = assignments.map(assignment =>
      this.executeSubtask(assignment).catch(error => ({
        id: assignment.subtask.id,
        content: "",
        tokenCount: 0,
        deviceId: assignment.deviceId,
        modelKey: assignment.modelKey,
        success: false,
        error: error.message,
      }))
    );

    const results = await Promise.all(executionPromises);

    // Step 4: Aggregate results
    const aggregationResult = await this.aggregateResults(results);

    // FIX: Clear subtask errors after successful completion to prevent memory leak
    _subtaskErrors.clear();

    const orchestrationDuration = Date.now() - startTime;

    console.log(`[ResearchSwarm] Complete in ${orchestrationDuration}ms`);

    return {
      query,
      totalSubtasks: assignments.length,
      successfulSubtasks: results.filter(r => r.success).length,
      results,
      aggregatedResult: aggregationResult,
      durationMs: orchestrationDuration,
    };
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown() {
    console.log("[ResearchSwarm] Shutting down...");

    // Unload lightweight models
    for (const [deviceId, modelKey] of this._loadedLightweightModels.entries()) {
      try {
        await lmStudioSwitcher.unloadModel(modelKey);
      } catch (error) {
        console.warn(`[ResearchSwarm] Failed to unload ${modelKey} on ${deviceId}: ${error.message}`);
      }
    }

    this._loadedLightweightModels.clear();

    console.log("[ResearchSwarm] Shut down complete");
  }
}

// Export singleton instance
export const researchSwarmOrchestrator = new ResearchSwarmOrchestrator();

/**
 * Initialize orchestrator on module load
 * @returns {Promise<ResearchSwarmOrchestrator>} Initialized orchestrator
 */
export async function initializeResearchSwarm() {
  if (!researchSwarmOrchestrator._initialized) {
    await researchSwarmOrchestrator.initialize();
    researchSwarmOrchestrator._initialized = true;
  }
  return researchSwarmOrchestrator;
}

// For testing: reset singleton state
export function resetResearchSwarm() {
  researchSwarmOrchestrator.shutdown();
  researchSwarmOrchestrator._loadedLightweightModels.clear();
  researchSwarmOrchestrator._initialized = false;
}