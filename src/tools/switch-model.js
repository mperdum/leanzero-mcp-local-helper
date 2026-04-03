/**
 * Switch Model Tool Handler
 *
 * Provides manual model switching for direct control over LM Studio model lifecycle.
 */

import { lmStudioSwitcher } from "../services/lm-studio-switcher.js";
import { loadModelDNA } from "../utils/model-dna-manager.js";

/**
 * Tool definition with role, context, task, constraints, and format
 */
export const switchModelTool = {
  name: "switch-model",
  description:
    `[ROLE] You are a model switching expert that can load/unload models in LM Studio.\n\n` +
    `[CONTEXT] User needs to manually switch between models for different tasks. With LM Link, you can target specific devices via Tailscale node IDs.\n\n` +
    `[TASK] Switch models based on the provided action and model type:\n` +
    "  - 'load': Load a specific model by ID or role (optionally on specific device)\n" +
    "  - 'unload': Unload a specific model by ID\n" +
    "  - 'list': List all available models with their states per device\n" +
    "  - 'current': Get the currently loaded model(s) across devices\n\n`" +
    `[CONSTRAINTS]\n` +
    "  - Use model IDs from the list command for precise switching\n" +
    "  - LM Link routes requests to target device via Tailscale node ID in request body\n" +
    "  - Vision models require separate handling due to higher memory requirements (5GB+)\n" +
    "  - Explicit deviceId selection allows targeting specific devices when same model key is used on multiple devices\n\n`" +
    `[FORMAT] Returns JSON with switchResult, modelId (if applicable), and currentModel state.`,
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["load", "unload", "list", "current"],
        description: "Action to perform"
      },
      modelId: {
        type: "string",
        description: "Model ID (key/name) to load/unload (required for load/unload actions)"
      },
      deviceId: {
        type: "string",
        description: "Target device ID (Tailscale node ID prefix) for explicit device targeting. Example: 'device-abc12345'. When omitted, LM Link routes based on model key."
      },
    },
    required: ["action"],
  },
};

/**
 * Handle switch-model tool execution
 * @param {Object} params - Tool parameters
 * @returns {Promise<Object>} Tool result
 */
export async function handleSwitchModel(params) {
  const { action } = params;

  try {
    switch (action) {
      case "list":
        return await handleListModels(params);

      case "current":
        return await handleGetCurrentModel(params);

      case "load":
        return await handleLoadModel(params);

      case "unload":
        return await handleUnloadModel(params);

      default:
        return {
          content: [{ type: "text", text: JSON.stringify({ error: `Unknown action: ${action}` }, null, 2) }],
          isError: true,
        };
    }
  } catch (error) {
    console.error(`[SwitchModel] Error: ${error.message}`);
    return {
      content: [{ type: "text", text: JSON.stringify({ error: error.message }, null, 2) }],
      isError: true,
    };
  }
}

/**
 * List all available models with usage statistics
 * @param {Object} params - Tool parameters (unused)
 * @returns {Promise<Object>} List result with model details
 */
async function handleListModels(params) {
  const dna = loadModelDNA();

  // Get models from LM Studio
  const models = await lmStudioSwitcher.getAvailableModels();

  // Add DNA info to each model for context
  const enhancedModels = models.map(model => {
    const modelId = model.key || model.id;

    // Get usage count from DNA
    const usageCount = dna?.usageStats?.tasksCompleted?.[modelId] || 0;

    // Get average rating from DNA
    const avgRating = getAverageRating(modelId, dna) || null;

    return {
      id: modelId,
      displayName: model.display_name || modelId,
      loaded: model.loaded_instances && model.loaded_instances.length > 0,
      loadCount: model.loaded_instances?.length || 0,
      purpose: dna?.models?.[modelId]?.purpose || null,
      usageCount,
      avgRating,
      capabilities: model.capabilities || {},
    };
  });

  // Sort: loaded first, then by usage count
  enhancedModels.sort((a, b) => {
    if (a.loaded && !b.loaded) return -1;
    if (!a.loaded && b.loaded) return 1;
    return (b.usageCount || 0) - (a.usageCount || 0);
  });

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        models: enhancedModels,
        total: enhancedModels.length,
        loadedCount: enhancedModels.filter(m => m.loaded).length,
      }, null, 2),
    }],
  };
}

/**
 * Helper Function: Get average rating for a model from DNA
 *
 * IMPORTANT: This function calculates the overall average rating across all task types
 * for a given model. It's used by the list command to show model effectiveness.
 *
 * @param {string} modelId - Model identifier
 * @param {Object} dna - Model DNA configuration
 * @returns {number|null} Average rating (1-5 scale) or null if no ratings
 */
export function getAverageRating(modelId, dna) {
  if (!dna?.usageStats?.modelEffectiveness?.[modelId]) return null;

  const ratings = Object.values(dna.usageStats.modelEffectiveness[modelId]).flat();

  if (ratings.length === 0) return null;

  const sum = ratings.reduce((acc, r) => acc + (r.rating || 0), 0);

  return Number((sum / ratings.length).toFixed(2));
}

/**
 * Get the currently loaded model
 * @param {Object} params - Tool parameters (unused)
 * @returns {Promise<Object>} Current model info
 */
async function handleGetCurrentModel(params) {
  const currentModel = await lmStudioSwitcher.getCurrentModel();

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        currentModel,
      }, null, 2),
    }],
  };
}

/**
 * Load a model by ID
 * @param {Object} params - Tool parameters with modelId
 * @returns {Promise<Object>} Load result
 */
async function handleLoadModel(params) {
  const { modelId } = params;

  if (!modelId) {
    return {
      content: [{ type: "text", text: JSON.stringify({ error: "modelId is required for load action" }, null, 2) }],
      isError: true,
    };
  }

  const result = await lmStudioSwitcher.loadModel(modelId);

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: result.loaded,
        loaded: result.loaded,
        modelId,
        alreadyLoaded: result.alreadyLoaded,
        error: result.error || null,
      }, null, 2),
    }],
  };
}

/**
 * Unload a model by ID
 * @param {Object} params - Tool parameters with modelId
 * @returns {Promise<Object>} Unload result
 */
async function handleUnloadModel(params) {
  const { modelId } = params;

  if (!modelId) {
    return {
      content: [{ type: "text", text: JSON.stringify({ error: "modelId is required for unload action" }, null, 2) }],
      isError: true,
    };
  }

  const result = await lmStudioSwitcher.unloadModel(modelId);

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: result.unloaded,
        unloaded: result.unloaded,
        modelId,
        error: result.error || null,
      }, null, 2),
    }],
  };
}
