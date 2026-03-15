/**
 * Research Swarm MCP Tool - Distributes research queries across lightweight models
 * 
 * This tool is designed to be called when Cline is in "Plan Mode" (research phase).
 * It leverages the ResearchSwarmOrchestrator to:
 * 1. Decompose complex research queries into subtasks
 * 2. Dispatch subtasks to available lightweight models on distributed devices
 * 3. Execute research in parallel using an army of small AI models
 * 4. Aggregate and compact results for efficient response
 */

import { researchSwarmOrchestrator } from '../services/research-swarm-orchestrator.js';
import {
  validateSwarmRequest,
  getAvailableLightweightDevices,
} from '../utils/swarm-guardrails.js';

/**
 * Default timeout for research swarm operations (30 minutes)
 */
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Type Definitions (for documentation)
 * @typedef {Object} ResearchSwarmRequest
 * @property {string} query - The research query to execute
 * @property {number} [maxSubtasks] - Override max subtasks to create
 * @property {boolean} [compact=false] - Whether to compact final result
 * @property {number} [timeoutMs] - Operation timeout in milliseconds (default: 30 minutes)
 */

/**
 * Type Definitions (for documentation)
 * @typedef {Object} ResearchSwarmResponse
 * @property {boolean} success - Whether orchestration succeeded
 * @property {string|null} error - Error message if failed
 * @property {number} totalSubtasks - Total subtasks dispatched
 * @property {number} successfulSubtasks - Successfully completed subtasks
 * @property {Array<SubtaskResult>} results - Individual subtask results
 * @property {Object} aggregatedResult - Final compacted result
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
 * Execute a research swarm orchestration with timeout protection
 * @param {Object} params - Tool parameters
 * @param {string} params.query - Research query to execute
 * @param {number} [params.maxSubtasks=4] - Maximum number of subtasks
 * @param {boolean} [params.compact=true] - Whether to compact final result
 * @param {number} [params.timeoutMs=1800000] - Operation timeout in milliseconds (default: 30 minutes)
 * @returns {Promise<ResearchSwarmResponse>} Orchestration results
 */
export async function executeResearchSwarm(params) {
  const { query, maxSubtasks = 4, compact = true, timeoutMs = DEFAULT_TIMEOUT_MS } = params;

  // Validate request meets guardrail constraints
  const validation = await validateSwarmRequest({
    query,
    numSubtasks: maxSubtasks,
  });

  if (!validation.allowed) {
    return {
      success: false,
      error: `SWARM orchestration blocked by guardrails: ${validation.reasons?.join(', ') || 'Unknown constraint'}`,
      totalSubtasks: 0,
      successfulSubtasks: 0,
      results: [],
      aggregatedResult: { content: '', tokenCount: 0 },
    };
  }

  // Create timeout signal
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.warn(`[ResearchSwarmTool] Operation timed out after ${timeoutMs / 1000}s`);
    controller.abort();
  }, timeoutMs);

  try {
    // Initialize orchestrator if not already done
    await researchSwarmOrchestrator.initialize();

    console.log(`[ResearchSwarmTool] Starting orchestration for: "${query.substring(0, 80)}..."`);

    // Execute the swarm orchestration with timeout protection
    const result = await Promise.race([
      researchSwarmOrchestrator.orchestrate(query, { maxSubtasks }),
      new Promise((_, reject) => {
        controller.signal.addEventListener('abort', () => {
          reject(new Error(`Operation timed out after ${timeoutMs / 1000}s`));
        });
      })
    ]);

    if (!result.aggregatedResult) {
      return {
        success: false,
        error: 'Aggregation failed',
        totalSubtasks: result.totalSubtasks || 0,
        successfulSubtasks: result.successfulSubtasks || 0,
        results: result.results || [],
        aggregatedResult: { content: '', tokenCount: 0 },
      };
    }

    // Compact final result if requested
    let finalContent = result.aggregatedResult.content;
    let finalTokenCount = result.aggregatedResult.tokenCount;

    if (compact && finalTokenCount > 4096) {
      const compacted = await researchSwarmOrchestrator.compactResult(
        finalContent,
        2048
      );
      finalContent = compacted.content;
      finalTokenCount = compacted.tokenCount;
    }

    return {
      success: true,
      error: null,
      totalSubtasks: result.totalSubtasks || 0,
      successfulSubtasks: result.successfulSubtasks || 0,
      results: result.results || [],
      aggregatedResult: {
        content: finalContent,
        tokenCount: finalTokenCount,
        durationMs: result.durationMs || 0,
      },
    };

  } catch (error) {
    console.error('[ResearchSwarmTool] Orchestration failed:', error.message);

    return {
      success: false,
      error: error.message,
      totalSubtasks: 0,
      successfulSubtasks: 0,
      results: [],
      aggregatedResult: { content: '', tokenCount: 0 },
    };
  } finally {
    // Clear timeout when operation completes or fails
    clearTimeout(timeoutId);
  }
}

/**
 * Get available devices for research swarm deployment
 * @returns {Promise<Array<{ deviceId: string, modelKey: string }>>} Available device/model pairs
 */
export async function getResearchSwarmDevices() {
  return await getAvailableLightweightDevices();
}

/**
 * Get current SWARM orchestration configuration
 * @returns {Object} Configuration object
 */
export function getResearchSwarmConfig() {
  const dna = researchSwarmOrchestrator.swarmConfig || {};

  return {
    enabled: dna.enabled !== false,
    maxSubtasks: dna.maxSubtasks || 8,
    subtaskMaxTokens: dna.subtaskMaxTokens || 4000,
    finalAggregationMaxTokens: dna.finalAggregationMaxTokens || 8000,
    minMemoryGB: dna.minMemoryGB || 8,
    fallbackEnabled: dna.fallbackEnabled !== false,
    lightweightModels: researchSwarmOrchestrator.lightweightModelIds || [],
  };
}

/**
 * Tool definition for MCP server registration
 */
export const researchSwarmTool = {
  name: 'research-swarm',
  description: 'Distributes research queries across lightweight models (5.6GB) on distributed devices via LM Link. Automatically decomposes complex research tasks into parallel subtasks, executes them across available lightweight models on multiple devices, and aggregates results into a compacted final response (~2048 tokens). Use this tool when Cline is in Plan Mode for research-intensive queries that benefit from parallel exploration.',
};

/**
 * Handle MCP tool invocation
 */
export async function handleResearchSwarm(params) {
  return await executeResearchSwarm(params);
}

/**
 * Shutdown SWARM orchestrator
 */
export async function shutdownResearchSwarm() {
  await researchSwarmOrchestrator.shutdown();
}
