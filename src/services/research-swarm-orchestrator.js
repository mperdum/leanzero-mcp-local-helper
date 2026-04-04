/**
 * Research Swarm Orchestrator - Multi-device lightweight model orchestration
 * Distributes research subtasks across devices with 5.6GB models
 */

import { lmStudioSwitcher } from "./lm-studio-switcher.js";
import { deviceRegistry } from "./device-registry.js";
import { loadTracker } from "./load-tracker.js";
import { swarmContextManager } from "./swarm-context-manager.js";
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

    // Lightweight models for SWARM research - default list if not in DNA
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
   * Improved token estimation heuristic
   * @param {string} text 
   * @returns {number}
   */
  _estimateTokenCount(text) {
    if (!text) return 0;
    // A more robust heuristic than just length / 3
    // Splits by whitespace and common punctuation to get a rough word/token count
    const words = text.trim().split(/\s+/).length;
    const characters = text.length;
    // Standard rule of thumb: 1 token ~= 4 chars or 0.75 words. 
    // We take the max of these to be conservative.
    return Math.ceil(Math.max(words, characters / 4));
  }

  /**
   * Initialize the orchestrator with configuration from DNA
   */
  async initialize() {
    console.log("[ResearchSwarm] Initializing...");

    const dna = loadModelDNA();

    if (dna?.orchestratorConfig?.swarm) {
      const swarmDnaConfig = dna.orchestratorConfig.swarm;
      this.swarmConfig = { ...this.swarmConfig, ...swarmDnaConfig };
      
      // Override lightweight model IDs if provided in DNA
      if (swarmDnaConfig.lightweightModelIds && Array.isArray(swarmDnaConfig.lightweightModelIds)) {
        this.lightweightModelIds = swarmDnaConfig.lightweightModelIds;
      }
    }

    // Set orchestrator model ID from task mapping
    this.orchestratorModelId = dna?.taskModelMapping?.orchestrateResearch || "architect";

    console.log(`[ResearchSwarm] Initialized with config:`, {
      maxSubtasks: this.swarmConfig.maxSubtasks,
      subtaskMaxTokens: this.swarmConfig.subtaskMaxTokens,
      finalAggregationMaxTokens: this.swarmConfig.finalAggregationMaxTokens,
      modelCount: this.lightweightModelIds.length
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
        const numSubtasks = Math.min(taskLimit, this.swarmConfig.maxSubtasks || 4);

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
    * @param {string} sessionId - The current orchestration session ID
    * @returns {Promise<Array<{ subtask: ResearchSubtask, deviceId: string, modelKey: string, sessionId: string }>>} Dispatched assignments
    */
   async dispatchToLightweightModels(subtasks, sessionId) {
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
 
       assignments.push({ subtask, deviceId, modelKey, sessionId });
 
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
    const { subtask, deviceId, modelKey, sessionId } = assignment;
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

      // Get shared context for this session
      const sharedContext = sessionId ? swarmContextManager.getSharedContext(sessionId) : "";

      // Execute the research query
      const completionResult = await lmStudioSwitcher.executeChatCompletion(
        modelKey,
        [
          { 
            role: "system", 
            content: `You are a research assistant. Provide concise, focused answers.` + 
                    (sharedContext ? `\n\n${sharedContext}` : "")
          },
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

      // Publish key finding to shared context (first two sentences as a summary)
      if (sessionId && result.content) {
        const summary = result.content.split(/[.!?]/).slice(0, 2).join('.') + '.';
        swarmContextManager.publish(sessionId, subtask.id, summary.trim());
      }

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
    if (this._estimateTokenCount(content) < targetTokens) {
      return { content, tokenCount: this._estimateTokenCount(content) };
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
        return { content, tokenCount: this._estimateTokenCount(content) };
      }

      const result = completionResult.result;

      console.log(
        `[ResearchSwarm] Result compacted from ${this._estimateTokenCount(content)} to ${result.usage.completion_tokens || 0} tokens`
      );

      return {
        content: result.content,
        tokenCount: result.usage.completion_tokens || 0,
      };
    } catch (error) {
      console.error(`[ResearchSwarm] Compaction failed: ${error.message}`);

      // Fallback: simple truncation
      const maxChars = targetTokens * 4;
      return {
        content: content.slice(0, maxChars),
        tokenCount: this._estimateTokenCount(content.slice(0, maxChars)),
      };
    }
  }

  /**
   * Aggregate all subtask results into a final compacted response using semantic synthesis
   * @param {Array<SubtaskResult>} results - Individual subtask results
   * @param {string} originalQuery - The original user query for context
   * @returns {Promise<{ content: string, tokenCount: number }>} Aggregated result
   */
  async aggregateResults(results, originalQuery) {
    const successfulResults = results.filter(r => r.success);

    if (successfulResults.length === 0) {
      return {
        content: "All research subtasks failed. Please check the model availability and try again.",
        tokenCount: 0,
        error: true,
      };
    }

    // Collect all findings into a raw context
    const rawFindings = successfulResults
      .map(r => `[Subtask ${r.id}]\n${r.content}`)
      .join("\n\n---\n\n");

    console.log(
      `[ResearchSwarm] Synthesizing ${successfulResults.length} subtask findings for query: "${originalQuery.substring(0, 50)}..."`
    );

    try {
      const synthesisModel = this.orchestratorModelId || "architect";
      
      const systemPrompt = `You are a master research synthesizer. Your goal is to take multiple fragmented research findings and combine them into a single, cohesive, and professional intelligence report.

RULES:
1. DO NOT simply concatenate. You must synthesize.
2. Eliminate all redundancies and overlapping information.
3. Organize the report logically (e.g., Introduction, Key Findings, Detailed Analysis, Conclusion).
4. Maintain a professional, objective, and authoritative tone.
5. If findings from different subtasks contradict each other, highlight the discrepancy rather than choosing one.
6. Ensure the final report directly and comprehensively answers the original user query.
7. Output ONLY the final report text. No conversational filler.`;

      const completionResult = await lmStudioSwitcher.executeChatCompletion(
        synthesisModel,
        [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Original Query: "${originalQuery}"\n\nRaw Research Findings:\n${rawFindings}`,
          },
        ],
        {
          max_output_tokens: this.swarmConfig.finalAggregationMaxTokens,
          temperature: 0.3,
          taskType: "synthesis",
        }
      );

      if (!completionResult.success) {
        throw new Error(completionResult.error);
      }

      const synthesis = completionResult.result.content;
      const tokenCount = completionResult.result.usage.completion_tokens || this._estimateTokenCount(synthesis);

      console.log(`[ResearchSwarm] Semantic synthesis complete. Estimated tokens: ${tokenCount}`);

      return {
        content: synthesis,
        tokenCount,
      };

    } catch (error) {
      console.error(`[ResearchSwarm] Semantic synthesis failed, falling back to concatenation: ${error.message}`);
      
      // Fallback: Simple concatenation if synthesis fails
      const fallbackContent = successfulResults
        .map(r => `## Findings from ${r.id}\n\n${r.content}`)
        .join("\n\n---\n\n");

      return await this.compactResult(fallbackContent, this.swarmConfig.finalAggregationMaxTokens);
    }
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
    const sessionId = `swarm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Initialize shared context session
    swarmContextManager.createSession(sessionId);

    try {
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
      const assignments = await this.dispatchToLightweightModels(subtasks, sessionId);

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
          sessionId: sessionId,
          success: false,
          error: error.message,
        }))
      );

      const results = await Promise.all(executionPromises);

      // Step 4: Aggregate results
      const aggregationResult = await this.aggregateResults(results, query);

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
    } finally {
      // Ensure session is always cleaned up
      swarmContextManager.endSession(sessionId);
    }
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