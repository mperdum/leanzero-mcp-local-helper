/**
 * Orchestrate Task Tool Handler
 *
 * Provides multi-device task orchestration across LM Link connected devices.
 * Decomposes complex tasks and dispatches subtasks in parallel to multiple devices.
 */

import { taskOrchestrator } from "../services/orchestrator.js";
import { loadModelDNA } from "../utils/model-dna-manager.js";

/**
 * Tool definition with Cline-optimized description
 */
export const orchestrateTaskTool = {
  name: "orchestrate-task",
  description:
    `[ROLE] You are a multi-device AI orchestrator that coordinates tasks across multiple LM Studio devices connected via LM Link.\n\n` +
    `[STRATEGY]\n` +
    `1. Analyze the task and identify independent components that can run in parallel\n` +
    `2. Check available devices and their loaded models using list-devices tool first\n` +
    `3. Decompose complex tasks into subtasks with clear inputs/outputs\n` +
    `4. Dispatch subtasks to optimal devices simultaneously (not sequentially!)\n` +
    `5. Wait for all subtasks to complete, then synthesize results\n\n` +
    `[PARALLELISM] Always maximize parallelism - if you have 3 independent research queries and 3 devices, dispatch all 3 at once rather than one at a time.\n\n` +
    `[DEVICE SELECTION] Match subtask requirements to device capabilities:\n` +
    `- Vision tasks → devices with VLM models loaded (check via list-devices)\n` +
    `- Code generation → devices with tool-use capable models\n` +
    `- Simple chat → any available device\n\n` +
    `[FORMAT] Returns JSON with orchestration plan, subtasks dispatched, and final synthesized results.`,
  inputSchema: {
    type: "object",
    properties: {
      task: {
        type: "string",
        description: "The complex task to orchestrate across devices"
      },
      maxSubtasks: {
        type: "number",
        minimum: 1,
        maximum: 20,
        default: 5,
        description: "Maximum number of subtasks to generate"
      },
      requiredCapabilities: {
        type: "array",
        items: { type: "string" },
        description: "Required model capabilities (e.g., ['vision'], ['toolUse'])"
      },
    },
    required: ["task"],
  },
};

/**
 * Handle orchestrate-task tool execution
 * @param {Object} params - Tool parameters with task and options
 * @returns {Promise<Object>} Orchestration result
 */
export async function handleOrchestrateTask(params) {
  const { task, maxSubtasks = 5, requiredCapabilities = [] } = params;

  // Validate inputs
  if (!task || typeof task !== "string") {
    return {
      content: [{ type: "text", text: JSON.stringify({ error: "task is required" }, null, 2) }],
      isError: true,
    };
  }

  try {
    // ⚠️ CRITICAL: DNA must be initialized before orchestration
    const dna = loadModelDNA();

    if (!dna) {
      return {
        content: [{ type: "text", text: JSON.stringify({
          error: "Model DNA not initialized. Use model-dna action:'init' first.",
          instructions: "Initialize Model DNA by calling the model-dna tool with action:'init' before orchestrating tasks."
        }, null, 2) }],
        isError: true,
      };
    }

    // Check if orchestrator is enabled in DNA
    const orchestratorEnabled = dna.orchestratorConfig?.enabled !== false;
    
    if (!orchestratorEnabled) {
      return {
        content: [{ type: "text", text: JSON.stringify({
          error: "Orchestrator is disabled",
          instructions: "Enable orchestration in your .model-dna.json by setting orchestratorConfig.enabled to true"
        }, null, 2) }],
        isError: true,
      };
    }

    // Check available devices first
    const onlineDevices = taskOrchestrator.deviceRegistry.getOnlineDevices();
    
    if (onlineDevices.length === 0) {
      return {
        content: [{ type: "text", text: JSON.stringify({
          error: "No devices available",
          instructions: "Ensure LM Studio is running with at least one model loaded, and any remote LM Link devices are connected"
        }, null, 2) }],
        isError: true,
      };
    }

    console.log(`[OrchestrateTask] Decomposing task on ${onlineDevices.length} device(s)`);

    // Decompose the task
    const plan = await taskOrchestrator.decomposeTask(task, {
      maxSubtasks,
      requiredCapabilities,
    });

    // Execute the orchestration plan
    const result = await taskOrchestrator.executePlan(plan);

    // Aggregate results
    const finalResult = taskOrchestrator.aggregateResults(result.results);

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: result.success,
          originalTask: plan.originalTask,
          subtasksCount: plan.subtasks.length,
          executionOrderLength: plan.executionOrder?.length || 1,
          devicesUsed: Array.from(plan.requiredDevices),
          estimatedTimeMs: plan.estimatedTotalTimeMs,
          completedSubtasks: result.results.filter(r => r.result?.success).length,
          failedSubtasks: result.results.filter(r => !r.result?.success).length,
          finalResult: finalResult,
          detailedResults: result.results.map(r => ({
            id: r.id,
            type: r.type,
            success: r.result?.success,
            deviceId: r.result?.deviceId,
            durationMs: r.result?.durationMs,
            error: r.result?.error || undefined,
          })),
        }, null, 2),
      }],
    };
  } catch (error) {
    console.error(`[OrchestrateTask] Error: ${error.message}`);

    return {
      content: [{ type: "text", text: JSON.stringify({ error: error.message }, null, 2) }],
      isError: true,
    };
  }
}