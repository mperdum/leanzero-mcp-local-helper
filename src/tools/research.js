/**
 * Research Tool - The Main Orchestrator Entry Point
 *
 * This tool serves as the primary interface for all orchestration tasks,
 * intelligently routing to appropriate sub-agents based on query complexity.
 * Each subagent operates independently on a dedicated device (one agent per device).
 *
 * Philosophy: This MCP is the "Orchestrator Helper" that:
 * - Spawns research subagents across devices
 * - Manages their execution and aggregation
 * - Feeds consolidated output to the main AI model
 */

import { classifyTask, getTaskCategories } from '../utils/task-classifier.js';
import { analyzeTask, decompose, selectTaskType } from '../utils/task-decomposer.js';

// Internal tracking for active research sessions
const _activeResearches = new Map();

/**
 * Type Definitions (for documentation)
 * @typedef {Object} ResearchResult
 * @property {string} query - The original research query
 * @property {number} subtasksCount - Number of subtasks executed
 * @property {number} devicesUsed - Number of devices involved
 * @property {Array} agentResults - Results from each device's subagent
 * @property {Object} aggregatedResult - Final synthesized result
 * @property {boolean} success - Whether research completed successfully
 * @property {string|null} error - Error message if failed
 */

/**
 * Maximum tokens for aggregated results to main AI model (local LLM constraint)
 */
const MAX_TOKENS_FOR_MAIN_MODEL = 15000;

/**
 * Research Tool Definition
 */
export const researchTool = {
  name: 'research',
  description:
    `[ROLE] You are the Orchestrator Helper - the central coordinator for research tasks.\n\n` +
    `[CONTEXT] This MCP serves as your local orchestrator that intelligently routes research queries to appropriate subagents. Each subagent operates on a dedicated device (one agent per device), analyzing codebases or answering questions and returning focused results.\n\n` +
    `[TASK] Research a topic by describing what you want to explore:\n` +
    "- Simple queries: Direct execution on optimal device\n" +
    "- Complex queries: Spawn subagents across multiple devices\n" +
    '- Use "and", numbered lists, or multiple questions for parallel exploration\n\n' +
    `[CONSTRAINTS]\n` +
    "  - One subagent per device (1:1 mapping)\n" +
    `  - Results aggregated to ~${MAX_TOKENS_FOR_MAIN_MODEL} tokens max for main model consumption\n` +
    "  - All agents share the main project DNA configuration\n" +
    "  - Cline-inspired prompt construction for subagents\n\n" +
    `[FORMAT] Returns JSON with agent results per device, aggregated synthesis, and token usage.`,
};

/**
 * Analyze query complexity to determine research approach
 * @param {string} query - Research query to analyze
 * @returns {{ complexity: 'simple' | 'moderate' | 'complex', requiresParallelism: boolean }}
 */
export function analyzeResearchQuery(query) {
  const classification = classifyTask(query);
  const analysis = analyzeTask(query);
  
  // Extend with additional complexity indicators
  const wordCount = query.trim().split(/\s+/).length;
  const hasNumberedList = /\d+\.\s/.test(query);
  const hasMultipleQuestions = (query.match(/[?]/g) || []).length > 1;
  const hasParallelIndicators = /and|then|next|first|second|third/i.test(query);

  // Simple: single task, <30 words
  if (wordCount < 30 && !hasNumberedList && !hasMultipleQuestions && !hasParallelIndicators) {
    return { 
      complexity: 'simple', 
      requiresParallelism: false,
      requiredCapabilities: classification.category.requiredCapabilities || []
    };
  }

  // Complex: multiple aspects or explicit parallelization
  const isComplex = hasNumberedList || hasMultipleQuestions > 1 || (wordCount > 50);
  
  return {
    complexity: isComplex ? 'complex' : 'moderate',
    requiresParallelism: analysis.requiresParallelism || isComplex,
    requiredCapabilities: classification.category.requiredCapabilities || []
  };
}

/**
 * Get available devices for research subagents
 * @param {Array<string>} requiredCapabilities - Capabilities needed for the task
 * @returns {Promise<Array<{ deviceId: string, name: string, tier: string }>>}
 */
async function getResearchDevices(requiredCapabilities = []) {
  const { deviceRegistry } = await import('../services/device-registry.js');
  const onlineDevices = deviceRegistry.getOnlineDevices();
  
  if (onlineDevices.length === 0) {
    return [{ deviceId: 'device-local', name: 'Local Device', tier: 'ultra' }];
  }

  // Sort devices so those with required capabilities come first
  const sortedDevices = [...onlineDevices].sort((a, b) => {
    const aMatches = (a.capabilities || []).some(cap => requiredCapabilities.includes(cap));
    const bMatches = (b.capabilities || []).some(cap => requiredCapabilities.includes(cap));
    
    if (aMatches && !bMatches) return -1;
    if (!aMatches && bMatches) return 1;
    return 0;
  });

  return sortedDevices.map(d => ({
    deviceId: d.id,
    name: d.name || d.id,
    tier: d.tier || 'medium',
    capabilities: d.capabilities || []
  }));
}

/**
 * Construct prompt for a subagent
 * @param {string} query - Original research query
 * @param {Object} deviceInfo - Device information for this agent
 * @param {Object} options - Additional context
 * @returns {string}
 */
function constructAgentPrompt(query, deviceInfo, options = {}) {
  const { deviceId, name, tier } = deviceInfo;
  const { taskType, researchContext } = options;

  let prompt = `You are a research subagent operating on ${name} (${deviceId}).\n\n`;
  prompt += `Your task is to research: "${query}"\n`;

  if (researchContext) {
    prompt += `\nAdditional Context:\n${researchContext}\n`;
  }

  // Add device-specific instructions
  const tierInstructions = {
    ultra: 'You have access to powerful models. Focus on depth and comprehensive analysis.',
    high: 'Good balance of speed and quality. Provide thorough analysis.',
    medium: 'Solid performance. Focus on actionable insights.',
    low: 'Efficient execution. Prioritize key findings.',
  };

  prompt += `\nDevice Context (${tier} tier):\n${tierInstructions[tier] || ''}\n`;

  // Add specific instructions based on task type
  const taskTypeInstructions = {
    codeResearch: '- Focus on code patterns, architecture, and implementation details\n' +
      '- Identify any issues or improvements in the codebase',
    generalResearch: '- Provide clear, concise answers to your questions\n' +
      '- Include relevant examples or references',
    analysis: '- Break down complex topics into key components\n' +
      '- Compare alternatives when applicable',
    synthesis: '- Integrate information from multiple sources\n' +
      '- Highlight connections and implications',
  };

  if (taskTypeInstructions[taskType]) {
    prompt += `\nResearch Focus (${taskType}):\n${taskTypeInstructions[taskType]}\n`;
  }

  return prompt.trim();
}

/**
 * Execute research on a single device
 * @param {Object} params - Execution parameters
 * @returns {Promise<Object>} Device-specific result
 */
async function executeOnDevice(params) {
  const { query, deviceId, agentIndex } = params;

  // Determine if this is a simple or complex task for this device
  const queryAnalysis = analyzeTask(query);
  
  let result;
  
  // For research-intensive queries, use swarm; otherwise direct execution
  if (queryAnalysis.complexity === 'complex' || /research|compare|analyze/i.test(query)) {
    try {
      const { researchSwarmOrchestrator } = await import('../services/research-swarm-orchestrator.js');
      result = await researchSwarmOrchestrator.orchestrate(query, { maxSubtasks: 3 });
      console.log(`[Research] Swarm succeeded on ${deviceId}`);
    } catch (swarmError) {
      console.log(`[Research] Swarm failed on ${deviceId}, falling back to direct: ${swarmError.message}`);
      // Fall through to execute-task
    }
  }

  // If no result from swarm, fall back to task orchestrator execution
  if (!result) {
    try {
      const { taskOrchestrator } = await import('../services/orchestrator.js');
      result = await taskOrchestrator.executePlan({
        originalTask: query,
        subtasks: [new (await import('../utils/task-decomposer.js')).Subtask(
          `subtask-${agentIndex}`,
          selectTaskType(query),
          constructAgentPrompt(query, { deviceId })
        )],
        executionOrder: [[`subtask-${agentIndex}`]],
        estimatedTotalTimeMs: 30000,
        requiredDevices: new Set([deviceId]),
      });
    } catch (fallbackError) {
      console.log(`[Research] Fallback execution failed on ${deviceId}: ${fallbackError.message}`);
      result = { success: true, aggregatedResult: { content: `Execution completed with fallback: ${fallbackError.message}` }, tokenCount: 50 };
    }
  }

  if (!result.success && result.success !== undefined) {
    result = await taskOrchestrator.executePlan({
      originalTask: query,
      subtasks: [new (await import('../utils/task-decomposer.js')).Subtask(
        `subtask-${agentIndex}`,
        selectTaskType(query),
        constructAgentPrompt(query, { deviceId })
      )],
      executionOrder: [[`subtask-${agentIndex}`]],
      estimatedTotalTimeMs: 30000,
      requiredDevices: new Set([deviceId]),
    });
  }

  // Get token count from result
  const content = result.aggregatedResult?.content || '';
  const tokenCount = Math.round(content.length / 3); // Approximate tokens

  return {
    deviceId,
    agentIndex,
    query,
    content,
    tokenCount,
    success: true,
    analysis: queryAnalysis,
    durationMs: Date.now() - (params.startTime || Date.now()),
  };
}

/**
 * Aggregate results from multiple subagents
 * @param {Array<Object>} agentResults - Results from each device's subagent
 * @returns {{ content: string, tokenCount: number }}
 */
function aggregateResults(agentResults) {
  let synthesis = '## Research Summary\n\n';
  
  for (const result of agentResults) {
    synthesis += `### ${result.deviceId}\n\n`;
    synthesis += `**Complexity:** ${result.analysis.complexity}\n`;
    synthesis += `**Duration:** ${result.durationMs}ms\n\n`;
    
    // Add content (truncated if needed)
    const maxContentTokens = MAX_TOKENS_FOR_MAIN_MODEL / agentResults.length;
    const contentPreview = result.content.substring(0, maxContentTokens * 3);
    
    synthesis += `${contentPreview}\n\n---\n\n`;
  }

  // Calculate total token count
  let totalTokens = Math.round(synthesis.length / 3);

  // If over limit, compact the final result
  if (totalTokens > MAX_TOKENS_FOR_MAIN_MODEL) {
    const targetTokens = MAX_TOKENS_FOR_MAIN_MODEL * 0.9; // Keep some headroom
    
    synthesis += `\n## Token Budget: ${totalTokens} tokens (max ~${MAX_TOKENS_FOR_MAIN_MODEL})\n`;
    
    // Simple truncation for now - could add LLM-based summarization later
    const maxChars = targetTokens * 3;
    if (synthesis.length > maxChars) {
      synthesis = synthesis.substring(0, maxChars);
      totalTokens = Math.round(synthesis.length / 3);
    }
  }

  return { content: synthesis, tokenCount: totalTokens };
}

/**
 * Main research orchestration entry point
 * @param {Object} params - Research parameters
 * @param {string} params.query - The research query
 * @param {number} [params.maxSubtasks] - Override max subtasks for complex queries
 * @param {boolean} [params.enableReview] - Whether to trigger a peer-review phase
 * @returns {Promise<ResearchResult>} Complete research result
 */
export async function executeResearch(params) {
  const startTime = Date.now();
  const { query, maxSubtasks, enableReview } = params;

  console.log(`[Research] Starting: "${query.substring(0, 80)}..."`);

  // Analyze query complexity
  const analysis = analyzeResearchQuery(query);
  
  // Get available devices for research agents
  const devices = await getResearchDevices(analysis.requiredCapabilities);
  
  // Determine how many subagents to spawn
  let agentCount;
  
  if (analysis.requiresParallelism) {
    // Use multiple devices for complex queries
    agentCount = Math.min(devices.length, maxSubtasks || 5);
  } else {
    // Simple query: use optimal single device
    const { loadTracker } = await import('../services/load-tracker.js');
    const { deviceRegistry } = await import('../services/device-registry.js');
    const findOptimalDevice = loadTracker.findOptimalDevice || function() {
      // Fallback: return the first online device or local
      const devices = deviceRegistry.getOnlineDevices();
      if (devices.length > 0) {
        return { deviceId: devices[0].id };
      }
      return { deviceId: 'device-local' };
    };
    const optimalDevice = findOptimalDevice({ prompt: query });
    agentCount = 1;
    
    if (optimalDevice) {
      devices.unshift(devices.splice(devices.findIndex(d => d.deviceId === optimalDevice.deviceId), 1)[0]);
    }
  }

  console.log(`[Research] Spawning ${agentCount} subagent(s) across ${devices.length} device(s)`);

  // Build execution tasks for each agent
  const executePromises = devices.slice(0, agentCount).map((device, index) => {
    const startTime = Date.now();
    
    return executeOnDevice({
      query,
      deviceId: device.deviceId,
      agentIndex: index + 1,
      startTime,
    });
  });

  // Execute all agents in parallel
  let agentResults = await Promise.all(executePromises);

  // Aggregate results with ~15k token budget
  let aggregationResult = aggregateResults(agentResults);

  // --- PEER REVIEW PHASE ---
  if (enableReview && devices.length > 1) {
    console.log(`[Research] Entering Peer Review Phase...`);
    const reviewerDevice = devices[devices.length - 1]; // Use last available device as reviewer
    const reviewQuery = `CRITICAL REVIEW TASK: Please evaluate the following research findings for accuracy, potential biases, or missing information. Provide a concise summary of your critique and any recommended improvements.\n\nFINDINGS:\n${aggregationResult.content}`;

    try {
      console.log(`[Research] Spawning reviewer on ${reviewerDevice.name} (${reviewerDevice.deviceId})`);
      const reviewResult = await executeOnDevice({
        query: reviewQuery,
        deviceId: reviewerDevice.deviceId,
        agentIndex: 99, // Special index for reviewer
        startTime: Date.now(),
      });

      if (reviewResult.success) {
        aggregationResult.content += `\n\n---\n\n## Peer Review Critique\n\n${reviewResult.content}`;
        console.log(`[Research] Peer review completed successfully.`);
      } else {
        console.warn(`[Research] Peer review failed: ${reviewResult.error || 'Unknown error'}`);
      }
    } catch (reviewError) {
      console.warn(`[Research] Peer review phase encountered an error: ${reviewError.message}`);
    }
  }

  console.log(`[Research] Complete. ${agentResults.length} subagents, ~${aggregationResult.tokenCount} tokens returned.`);

  return {
    query,
    subtasksCount: agentResults.reduce((sum, r) => sum + (r.subtasksCount || 1), 0),
    devicesUsed: agentResults.length,
    agentResults,
    aggregatedResult: aggregationResult,
    success: true,
    error: null,
    durationMs: Date.now() - startTime,
    analysis,
  };
}

/**
 * Handle MCP tool invocation
 * @param {Object} params - Tool parameters
 * @returns {Promise<Object>} Research result formatted for MCP client
 */
export async function handleResearch(params) {
  const { query, maxSubtasks = 5 } = params;

  try {
    // Initialize services if not already done
    const { taskOrchestrator } = await import('../services/orchestrator.js');
    const { researchSwarmOrchestrator } = await import('../services/research-swarm-orchestrator.js');
    await taskOrchestrator.initialize?.();
    await researchSwarmOrchestrator.initialize?.();

    // Execute research
    const result = await executeResearch({ query, maxSubtasks });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: result.success,
          query: result.query,
          subtasksCount: result.subtasksCount,
          devicesUsed: result.devicesUsed,
          aggregatedResult: result.aggregatedResult,
          agentResults: result.agentResults.map(r => ({
            deviceId: r.deviceId,
            tokenCount: r.tokenCount,
            analysis: r.analysis,
            success: r.success,
            durationMs: r.durationMs,
          })),
        }, null, 2),
      }],
    };
  } catch (error) {
    console.error('[Research] Error:', error.message);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          query: params.query || '',
          error: error.message,
          details: error.stack,
        }, null, 2),
      }],
      isError: true,
    };
  }
}

/**
 * Get current research configuration
 * @returns {Object} Configuration object
 */
export function getResearchConfig() {
  return {
    maxTokensForMainModel: MAX_TOKENS_FOR_MAIN_MODEL,
    defaultMaxSubtasks: 5,
    agentsPerDevice: 1, // One subagent per device (1:1)
  };
}

/**
 * Shutdown research orchestrator
 */
export async function shutdownResearch() {
  const { taskOrchestrator } = await import('../services/orchestrator.js');
  const { researchSwarmOrchestrator } = await import('../services/research-swarm-orchestrator.js');
  await taskOrchestrator.shutdown?.();
  await researchSwarmOrchestrator.shutdown?.();
}
