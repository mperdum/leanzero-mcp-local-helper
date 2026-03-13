/**
 * Execute Task Tool Handler
 *
 * Provides automatic task execution with optimal model selection based on DNA ratings.
 */

import { taskDispatcher } from "../services/task-dispatcher.js";
import { loadModelDNA } from "../utils/model-dna-manager.js";

/**
 * Tool definition
 */
export const executeTaskTool = {
  name: "execute-task",
  description:
    `[ROLE] You are a task execution expert that automatically selects the optimal model for any task.\n\n` +
    `[CONTEXT] User wants to execute a task with the best-suited model based on intent classification.\n\n` +
    `[TASK] Execute a task with automatic model selection and fallback:\n` +
    "  - Classify task intent (code fixes, architecture, execution, research, vision)\n" +
    "  - Select optimal model based on ratings and availability\n" +
    "  - Execute task with the selected model\n" +
    "  - Fallback to next best model if primary fails\n\n" +
    `[CONSTRAINTS]\n` +
    "  - Model selection is automatic based on DNA ratings\n" +
    "  - Fallback to next best model if primary is unavailable\n" +
    "  - Max 3 fallback attempts before giving up\n" +
    "  - Context is automatically preserved between switches (max 8000 tokens)\n\n" +
    `[FORMAT] Returns JSON with success status, model used, and task result.`,
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The task to execute"
      },
      modelType: {
        type: "string",
        enum: ["conversationalist", "ninjaResearcher", "architect", "executor", "researcher", "vision"],
        description: "Optional override for specific model type"
      },
    },
    required: ["query"],
  },
};

/**
 * Handle execute-task tool execution
 * @param {Object} params - Tool parameters with query and optional modelType
 * @returns {Promise<Object>} Task execution result
 */
export async function handleExecuteTask(params) {
  const { query, modelType } = params;

  // Validate inputs
  if (!query || typeof query !== "string") {
    return {
      content: [{ type: "text", text: JSON.stringify({ error: "query is required" }, null, 2) }],
      isError: true,
    };
  }

  try {
    // ⚠️ CRITICAL: DNA must be initialized before task execution
    // The task dispatcher depends on DNA for model selection and ratings
    const dna = loadModelDNA();

    if (!dna) {
      return {
        content: [{ type: "text", text: JSON.stringify({
          error: "Model DNA not initialized. Use model-dna action:'init' first.",
          instructions: "Initialize Model DNA by calling the model-dna tool with action:'init' before executing tasks. This one-time setup configures model selection and ratings tracking."
        }, null, 2) }],
        isError: true,
      };
    }

    // Execute task with optimal model selection
    // TaskDispatcher will:
    // 1. Classify the task intent
    // 2. Select highest-rated model for that task type
    // 3. Attempt to execute with that model
    // 4. Fallback up to 3 times if models fail (unavailable or errors)
    const result = await taskDispatcher.executeTask(query, dna);

    // If modelType override was specified, log it
    if (modelType) {
      console.log(`[ExecuteTask] Model override used: ${modelType}`);
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: result.success,
          query,
          modelUsed: result.modelUsed || null,
          classification: result.classification || null,
          fallbackAttempted: result.fallbackAttempted || false,
          rating: result.rating || null,
          usage: result.result?.usage || result.result?.usage || null,
          error: result.error || null,
        }, null, 2),
      }],
    };
  } catch (error) {
    console.error(`[ExecuteTask] Error: ${error.message}`);

    return {
      content: [{ type: "text", text: JSON.stringify({ error: error.message }, null, 2) }],
      isError: true,
    };
  }
}

/**
 * Handle streaming task execution
 * @param {Object} params - Tool parameters with query, modelType, and streaming options
 * @returns {Promise<Object>} Streaming task execution result
 */
