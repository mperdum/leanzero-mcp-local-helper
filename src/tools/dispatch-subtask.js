/**
 * Dispatch Subtask Tool Handler
 *
 * Manual subtask dispatch for testing and debugging orchestration.
 */

import { taskOrchestrator } from "../services/orchestrator.js";
import { loadTracker } from "../services/load-tracker.js";

/**
 * Tool definition with Cline-optimized description
 */
export const dispatchSubtaskTool = {
  name: "dispatch-subtask",
  description:
    `[ROLE] You are a subtask dispatcher for testing and debugging LM Link orchestration.\n\n` +
    `[CONTEXT] Use this tool to manually dispatch individual subtasks to specific devices during testing or when you need fine-grained control over task placement.\n\n` +
    `[TASK] Dispatch a single subtask to a device:\n` +
    "- Specify the device ID (use list-devices to find available devices)\n" +
    "- Provide the task prompt for execution\n" +
    "- Optionally specify model key and required capabilities\n" +
    "- Track load statistics before and after dispatch\n\n" +
    `[CONSTRAINTS]\n` +
    "  - This is primarily for testing and debugging\n" +
    "  - For production use, use orchestrate-task instead\n" +
    "  - Manual dispatch still respects concurrency limits and cooldowns\n\n" +
    `[FORMAT] Returns JSON with dispatch result including subtask ID, device used, and execution outcome.`,
  inputSchema: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description: "The task/prompt to execute"
      },
      deviceId: {
        type: "string",
        default: null,
        description: "Target device ID (null = use optimal automatic selection)"
      },
      modelKey: {
        type: "string",
        default: null,
        description: "Specific model key to use on target device"
      },
      taskType: {
        type: "string",
        enum: ["research", "code-generation", "analysis", "synthesis"],
        default: "synthesis",
        description: "Type of task for categorization"
      },
      priority: {
        type: "number",
        minimum: 1,
        maximum: 5,
        default: 3,
        description: "Task priority (1-5, higher = more important)"
      },
    },
    required: ["prompt"],
  },
};

/**
 * Handle dispatch-subtask tool execution
 * @param {Object} params - Tool parameters with subtask details
 * @returns {Promise<Object>} Dispatch result
 */
export async function handleDispatchSubtask(params) {
  const { 
    prompt, 
    deviceId = null, 
    modelKey = null, 
    taskType = "synthesis", 
    priority = 3 
  } = params;

  // Validate inputs
  if (!prompt || typeof prompt !== "string") {
    return {
      content: [{ type: "text", text: JSON.stringify({ error: "prompt is required" }, null, 2) }],
      isError: true,
    };
  }

  try {
    console.log(`[DispatchSubtask] Dispatching task to device: ${deviceId || 'automatic'}`);

    // Create subtask
    const subtask = new (await import('../utils/task-decomposer.js')).Subtask(
      `manual-${Date.now()}`,
      taskType,
      prompt,
      { 
        assignedDeviceId: deviceId,
        assignedModelKey: modelKey,
        priority,
      }
    );

    // Check if dispatch is allowed before executing
    const canDispatch = loadTracker.canAcceptRequest(deviceId || '*', modelKey);

    if (!canDispatch.allowed) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: false,
            error: 'Cannot dispatch task',
            reason: canDispatch.reason,
            instructions: 'Check device availability and load limits with list-devices tool'
          }, null, 2),
        }],
        isError: true,
      };
    }

    // Dispatch the subtask
    const result = await taskOrchestrator.dispatchSubtask(subtask);

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: result.result?.success || false,
          subtaskId: result.id,
          prompt: result.prompt.substring(0, 100) + (result.prompt.length > 100 ? '...' : ''),
          taskType: result.type,
          deviceId: result.result?.deviceId || null,
          modelKey: result.result?.modelKey || null,
          durationMs: result.result?.durationMs || 0,
          error: result.result?.error || undefined,
        }, null, 2),
      }],
    };
  } catch (error) {
    console.error(`[DispatchSubtask] Error: ${error.message}`);

    return {
      content: [{ type: "text", text: JSON.stringify({ error: error.message }, null, 2) }],
      isError: true,
    };
  }
}