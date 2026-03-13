/**
 * Model DNA Tool Handler
 *
 * Provides DNA configuration management with CRUD operations for model selection and optimization.
 */

import { loadModelDNA, createDNAFile, saveMemory, deleteMemory } from "../utils/model-dna-manager.js";
import { getDefaultDNA } from "../utils/model-dna-schema.js";

/**
 * Tool definition
 */
export const modelDnaTool = {
  name: "model-dna",
  description:
    `[ROLE] You are a DNA management expert that handles model configuration.\n\n` +
    `[CONTEXT] User needs to manage Model DNA for automatic model selection and configuration.\n\n` +
    `[TASK] Manage Model DNA with the following actions:\n` +
    "  - 'init': Initialize Model DNA with defaults or custom settings\n" +
    "  - 'get': Get current Model DNA configuration\n" +
    "  - 'save-memory': Save a memory (preference) for model selection\n" +
    "  - 'delete-memory': Delete a memory by key\n" +
    "  - 'evolve': Analyze usage and suggest improvements (auto-apply with apply:true)\n\n" +
    `[CONSTRAINTS]\n` +
    "  - DNA is stored in .model-dna.json\n" +
    "  - User-level overrides are stored in .model-user.json\n" +
    "  - Memories persist across model switches for context\n\n" +
    `[FORMAT] Returns JSON with success status and relevant data.`,
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["init", "get", "save-memory", "delete-memory", "evolve"],
        description: "Action to perform"
      },
      companyName: {
        type: "string",
        description: "Company or project name (init only)"
      },
      modelId: {
        type: "string",
        description: "Model ID to set as default (init only)"
      },
      memory: {
        type: "string",
        description: "Memory value to save (save-memory only)"
      },
      key: {
        type: "string",
        description: "Memory key (required for delete-memory, optional for save-memory)"
      },
      apply: {
        type: "boolean",
        description: "Auto-apply evolution suggestions (evolve only)"
      },
    },
    required: ["action"],
  },
};

/**
 * Handle model-dna tool execution
 * @param {Object} params - Tool parameters with action and optional additional params
 * @returns {Promise<Object>} DNA operation result
 */
export async function handleModelDNA(params) {
  const { action } = params;

  try {
    switch (action) {
      case "init":
        return await handleInitDNA(params);

      case "get":
        return await handleGetDNA(params);

      case "save-memory":
        return await handleSaveMemory(params);

      case "delete-memory":
        return await handleDeleteMemory(params);

      case "evolve":
        return await handleEvolveDNA(params);

      default:
        return {
          content: [{ type: "text", text: JSON.stringify({ error: `Unknown action: ${action}` }, null, 2) }],
          isError: true,
        };
    }
  } catch (error) {
    console.error(`[ModelDNA] Error: ${error.message}`);
    return {
      content: [{ type: "text", text: JSON.stringify({ error: error.message }, null, 2) }],
      isError: true,
    };
  }
}

/**
 * Initialize Model DNA with defaults or custom settings
 * @param {Object} params - Tool parameters
 * @returns {Promise<Object>} Init result
 */
async function handleInitDNA(params) {
  const config = {};

  if (params.companyName) {
    config.companyName = params.companyName;
  }

  if (params.modelId) {
    config.defaultModel = params.modelId;
  }

  const result = createDNAFile(config);

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        path: result.path,
        config: result.config,
        message: `Model DNA initialized at ${result.path}`,
      }, null, 2),
    }],
  };
}

/**
 * Get current Model DNA configuration
 * @param {Object} params - Tool parameters (unused)
 * @returns {Promise<Object>} DNA configuration
 */
async function handleGetDNA(params) {
  const dna = loadModelDNA();

  if (!dna) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: false,
          message: "Model DNA not initialized. Use model-dna action:'init' to create.",
        }, null, 2),
      }],
    };
  }

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        dna: {
          version: dna.version,
          models: Object.keys(dna.models),
          taskModelMapping: dna.taskModelMapping,
          memories: Object.keys(dna.memories || {}),
          mcpIntegrations: dna.mcpIntegrations,
          settings: dna.settings,
          usageStats: {
            totalTasks: Object.values(dna.usageStats?.tasksCompleted || {}).reduce((a, b) => a + b, 0),
            modelEffectiveness: Object.keys(dna.usageStats?.modelEffectiveness || {}).length,
          },
        },
        message: "Model DNA loaded successfully.",
      }, null, 2),
    }],
  };
}

/**
 * Save a memory (preference) for model selection
 * @param {Object} params - Tool parameters with memory and optional key
 * @returns {Promise<Object>} Save result
 */
async function handleSaveMemory(params) {
  const { memory, key } = params;

  if (!memory) {
    return {
      content: [{ type: "text", text: JSON.stringify({ error: "memory is required" }, null, 2) }],
      isError: true,
    };
  }

  // Generate key if not provided
  const memoryKey = key || `memory_${Date.now()}`;

  const result = saveMemory(memoryKey, memory);

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        key: memoryKey,
        message: `Memory saved: ${memory}`,
      }, null, 2),
    }],
  };
}

/**
 * Delete a memory by key
 * @param {Object} params - Tool parameters with key
 * @returns {Promise<Object>} Delete result
 */
async function handleDeleteMemory(params) {
  const { key } = params;

  if (!key) {
    return {
      content: [{ type: "text", text: JSON.stringify({ error: "key is required" }, null, 2) }],
      isError: true,
    };
  }

  const deleted = deleteMemory(key);

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: deleted,
        key,
        message: deleted ? `Memory "${key}" deleted` : `No memory found with key "${key}"`,
      }, null, 2),
    }],
  };
}

/**
 * Analyze usage and suggest improvements
 * @param {Object} params - Tool parameters with optional apply flag
 * @returns {Promise<Object>} Evolution analysis result
 */
async function handleEvolveDNA(params) {
  const dna = loadModelDNA();

  if (!dna) {
    return {
      content: [{ type: "text", text: JSON.stringify({ error: "Model DNA not initialized" }, null, 2) }],
      isError: true,
    };
  }

  // Analyze usage patterns
  const analysis = analyzeUsage(dna);

  let evolvedDna = dna;
  if (params.apply && analysis.suggestions?.length > 0) {
    // Apply top suggestion
    const topSuggestion = analysis.suggestions[0];

    if (topSuggestion.mutation) {
      // Apply mutation
      const parts = topSuggestion.mutation.path.split(".");
      let target = evolvedDna;

      for (let i = 0; i < parts.length - 1; i++) {
        target = target[parts[i]];
      }

      target[parts[parts.length - 1]] = topSuggestion.mutation.value;

      // Save evolved DNA
      createDNAFile(evolvedDna);
    }
  }

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        analysis,
        evolved: params.apply ? evolvedDna : null,
      }, null, 2),
    }],
  };
}

/**
 * Analyze usage patterns and generate suggestions
 * @param {Object} dna - Model DNA configuration
 * @returns {Object} Analysis with suggestions
 */
function analyzeUsage(dna) {
  const usageStats = dna.usageStats || {};
  const models = dna.models || {};
  const taskModelMapping = dna.taskModelMapping || {};

  // Calculate average ratings for each model
  const effectiveness = usageStats.modelEffectiveness || {};

  const analysis = {
    totalTasks: Object.values(usageStats.tasksCompleted || {}).reduce((a, b) => a + b, 0),
    modelUsage: {},
    suggestions: [],
  };

  // First, calculate average ratings for all models
  for (const [modelRole, config] of Object.entries(models)) {
    const roleEffectiveness = effectiveness[modelRole];

    analysis.modelUsage[modelRole] = {
      purpose: config.purpose,
      usageCount: config.usageCount || 0,
      averageRating: null,
    };

    if (roleEffectiveness) {
      const ratings = Object.values(roleEffectiveness).flat();

      if (ratings.length > 0) {
        const avg = ratings.reduce((a, b) => a + b.rating, 0) / ratings.length;

        analysis.modelUsage[modelRole].averageRating = avg.toFixed(2);
      }
    }
  }

  // Second, generate suggestions by examining task-model assignments
  for (const [taskType, assignedModelRole] of Object.entries(taskModelMapping)) {
    const modelRating = parseFloat(analysis.modelUsage[assignedModelRole]?.averageRating);

    // If the assigned model has poor ratings (below 3.0) and sufficient data (5+ ratings)
    if (modelRating !== null && !isNaN(modelRating) && modelRating < 3.0) {
      const modelEffectiveness = effectiveness[assignedModelRole];
      const ratingCount = modelEffectiveness ? Object.values(modelEffectiveness).flat().length : 0;

      if (ratingCount >= 5) {
        // Find better alternative for this task type
        const betterAlternative = findBetterModelForTask(taskModelMapping, analysis.modelUsage, taskType, assignedModelRole);

        analysis.suggestions.push({
          type: "low-rating",
          taskType,
          modelRole: assignedModelRole,
          averageRating: modelRating,
          ratingCount,
          recommendation: `Task type "${taskType}" is assigned to model "${assignedModelRole}" with low rating (${modelRating}). Consider reassigning to a better-rated model.`,
          mutation: {
            path: `taskModelMapping.${taskType}`,
            value: betterAlternative || null,
          },
        });
      }
    }
  }

  return analysis;
}

/**
 * Find a better model alternative for a specific task type
 * @param {Object} taskModelMapping - Current task-to-model mapping
 * @param {Object} modelUsage - Model usage statistics with ratings
 * @param {string} currentTaskType - The task type to find an alternative for
 * @param {string} currentModelRole - The currently assigned model role
 * @returns {string|null} Better model role or null if none found
 */
function findBetterModelForTask(taskModelMapping, modelUsage, currentTaskType, currentModelRole) {
  // Get all models with good ratings (> 3.5)
  const goodModels = Object.entries(modelUsage)
    .filter(([role, usage]) => {
      const rating = parseFloat(usage.averageRating);
      return rating !== null && !isNaN(rating) && rating > 3.5 && role !== currentModelRole;
    })
    .sort((a, b) => parseFloat(b[1].averageRating) - parseFloat(a[1].averageRating));

  // Return the highest-rated good model, or null if none
  return goodModels.length > 0 ? goodModels[0][0] : null;
}
