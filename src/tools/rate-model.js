/**
 * Rate Model Tool Handler
 *
 * Provides effectiveness rating collection for model optimization and auto-evolution.
 */

import { loadModelDNA, recordEffectivenessRating } from "../utils/model-dna-manager.js";

/**
 * Tool definition
 */
export const rateModelTool = {
  name: "rate-model",
  description:
    `[ROLE] You are a model rating expert that collects user feedback on model performance.\n\n` +
    `[CONTEXT] User wants to rate a model's effectiveness for a specific task type.\n\n` +
    `[TASK] Record model effectiveness ratings:\n` +
    "  - Rating scale: 1-5 (1=poor, 3=acceptable, 5=excellent)\n" +
    "  - Optional feedback text for context\n" +
    "  - Ratings are used to auto-optimize model selection\n\n" +
    `[CONSTRAINTS]\n` +
    "  - Ratings accumulate over time for each model/task combination\n" +
    "  - DNA automatically evolves when ratings indicate poor performance\n" +
    "  - Minimum 5 ratings before evolution suggestions are triggered\n\n" +
    `[FORMAT] Returns JSON with success status and rating confirmation.`,
  inputSchema: {
    type: "object",
    properties: {
      modelRole: {
        type: "string",
        enum: ["conversationalist", "ninjaResearcher", "architect", "executor", "researcher", "vision"],
        description: "Model role to rate"
      },
      taskType: {
        type: "string",
        enum: ["codeFixes", "featureArchitecture", "codeExecution", "generalResearch", "imageAnalysis"],
        description: "Task type the model was evaluated on"
      },
      rating: {
        type: "number",
        minimum: 1,
        maximum: 5,
        description: "Rating from 1 (poor) to 5 (excellent)"
      },
      feedback: {
        type: "string",
        description: "Optional feedback explaining the rating"
      },
    },
    required: ["modelRole", "taskType", "rating"],
  },
};

/**
 * Handle rate-model tool execution
 * @param {Object} params - Tool parameters with modelRole, taskType, rating, and optional feedback
 * @returns {Promise<Object>} Rating result
 */
export async function handleRateModel(params) {
  const { modelRole, taskType, rating, feedback } = params;

  // Validate inputs
  if (!modelRole || !taskType) {
    return {
      content: [{ type: "text", text: JSON.stringify({ error: "modelRole and taskType are required" }, null, 2) }],
      isError: true,
    };
  }

  if (rating < 1 || rating > 5) {
    return {
      content: [{ type: "text", text: JSON.stringify({ error: "rating must be between 1 and 5" }, null, 2) }],
      isError: true,
    };
  }

  try {
    // Record rating
    const result = recordEffectivenessRating(modelRole, taskType, rating, feedback);

    // Get average rating
    const dna = loadModelDNA();

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          modelRole,
          taskType,
          rating,
          feedback,
          totalRatings: result?.length || 1,
          message: `Rating recorded for ${modelRole} on ${taskType}`,
        }, null, 2),
      }],
    };
  } catch (error) {
    console.error(`[RateModel] Error: ${error.message}`);

    return {
      content: [{ type: "text", text: JSON.stringify({ error: error.message }, null, 2) }],
      isError: true,
    };
  }
}
