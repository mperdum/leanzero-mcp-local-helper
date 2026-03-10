# Phase 4: Tools Implementation

## Overview

Phase 4 implements the MCP server tools that expose the Model Switcher functionality to clients. This phase creates four core tools: `switch-model`, `execute-task`, `model-dna`, and `rate-model`.

**Key Components:**
- `switch-model.js` - Manual model loading/unloading
- `execute-task.js` - Automatic task execution with optimal model selection
- `model-dna-tool.js` - DNA configuration management
- `rate-model.js` - Effectiveness rating collection

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     MCP Tools Layer                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────┐        ┌──────────────────┐                   │
│  │ switch-model     │        │ execute-task     │                   │
│  └──────────────────┘        └──────────────────┘                   │
│         │                            │                              │
│  ┌──────────────────┐        ┌──────────────────┐                   │
│  │ model-dna        │        │ rate-model       │                   │
│  └──────────────────┘        └──────────────────┘                   │
│         │                            │                              │
│         ▼                            ▼                              │
│  ┌──────────────────────────────────────────┐                      │
│  │        Tool Registry & Router            │                      │
│  │  - Request Handling                      │                      │
│  │  - Parameter Validation                  │                      │
│  │  - Error Handling                        │                      │
│  └──────────────────────────────────────────┘                      │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
src/
├── tools/
│   ├── switch-model.js          # Manual model switching
│   ├── execute-task.js          # Automatic task execution
│   ├── model-dna-tool.js        # DNA management
│   └── rate-model.js            # Effectiveness ratings
├── index.js                     # MCP server entry point
└── config/
    └── defaults.js              # Tool defaults
```

---

## Detailed Component Breakdown

### 1. switch-model.js

**Purpose:** Manual model switching for direct control.

#### Tool Definition

```javascript
/**
 * Switch Model Tool Handler
 */

import { lmStudioSwitcher } from "../services/lm-studio-switcher.js";
import { loadModelDNA, createDNAFile } from "../utils/model-dna-manager.js";

/**
 * Tool definition with role, context, task, constraints, and format
 */
export const switchModelTool = {
  name: "switch-model",
  description:
    `[ROLE] You are a model switching expert that can load/unload models in LM Studio.\n\n` +
    `[CONTEXT] User needs to manually switch between models for different tasks.\n\n` +
    `[TASK] Switch models based on the provided action and model type:\n` +
    "  - 'load': Load a specific model by ID or role\n" +
    "  - 'unload': Unload a specific model by ID\n" +
    "  - 'list': List all available models with their states\n" +
    "  - 'current': Get the currently loaded model\n\n" +
    `[CONSTRAINTS]\n` +
    "  - Use model IDs from the list command for precise switching\n" +
    "  - Models are automatically managed by LM Studio when context is exceeded\n" +
    "  - Vision models require separate handling due to higher memory requirements\n\n" +
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
        description: "Model ID to load/unload (required for load/unload actions)"
      },
    },
    required: ["action"],
  },
};
```

#### Tool Handler

```javascript
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
    return {
      content: [{ type: "text", text: JSON.stringify({ error: error.message }, null, 2) }],
      isError: true,
    };
  }
}
```

#### Listing Models

```javascript
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
    // Get usage count from DNA
    const usageCount = dna?.usageStats?.tasksCompleted?.[model.id] || 0;
    
    // Get average rating from DNA
    const avgRating = getAverageRating(model.id, dna) || "N/A";
    
    return {
      ...model,
      usageCount,
      avgRating,
    };
  });

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        models: enhancedModels,
        total: enhancedModels.length,
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
function getAverageRating(modelId, dna) {
  if (!dna?.usageStats?.modelEffectiveness?.[modelId]) return null;
  
  const ratings = Object.values(dna.usageStats.modelEffectiveness[modelId]).flat();
  
  if (ratings.length === 0) return null;
  
  const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
  
  return (sum / ratings.length).toFixed(2);
}
```

#### Getting Current Model

```javascript
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
```

#### Loading a Model

```javascript
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
      }, null, 2),
    }],
  };
}
```

#### Unloading a Model

```javascript
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
      }, null, 2),
    }],
  };
}
```

---

### 2. execute-task.js

**Purpose:** Automatic task execution with optimal model selection.

#### Tool Definition

```javascript
/**
 * Execute Task Tool Handler
 */

import { taskDispatcher } from "../services/task-dispatcher.js";
import { lmStudioSwitcher } from "../services/lm-studio-switcher.js";
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
```

#### Tool Handler

```javascript
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
          fallbackUsed: result.fallbackUsed || false,
          rating: result.rating || null,
          usage: result.usage || null,
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

---

### 3. model-dna-tool.js

**Purpose:** DNA configuration management with CRUD operations.

#### Tool Definition

```javascript
/**
 * Model DNA Tool Handler
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
```

#### Tool Handler

```javascript
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
    return {
      content: [{ type: "text", text: JSON.stringify({ error: error.message }, null, 2) }],
      isError: true,
    };
  }
}
```

#### Initialize DNA

```javascript
/**
 * Initialize Model DNA with defaults or custom settings
 * @param {Object} params - Tool parameters
 * @returns {Promise<Object>} Init result
 */
async function handleInitDNA(params) {
  const config = {};

  if (params.companyName) {
    // Company name could be used for identification
    config.companyName = params.companyName;
  }

  if (params.modelId) {
    // Set a default model
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
```

#### Get DNA

```javascript
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
        },
        message: "Model DNA loaded successfully.",
      }, null, 2),
    }],
  };
}
```

#### Save Memory

```javascript
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
        key: Object.keys(result)[0],
        message: `Memory saved: ${memory}`,
      }, null, 2),
    }],
  };
}
```

#### Delete Memory

```javascript
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
```

#### Evolve DNA

```javascript
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
  
  // Calculate average ratings for each model
  const effectiveness = usageStats.modelEffectiveness || {};
  
  const analysis = {
    totalTasks: Object.values(usageStats.tasksCompleted || {}).reduce((a, b) => a + b, 0),
    modelUsage: {},
    suggestions: [],
  };

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
        
        // Generate suggestions for low-rating models
        if (avg < 3.0 && ratings.length >= 5) {
          analysis.suggestions.push({
            type: "low-rating",
            modelRole,
            averageRating: avg,
            ratingCount: ratings.length,
            recommendation: `Model "${modelRole}" has low average rating (${avg}). Consider reviewing model selection or task configuration.`,
          });
        }
      }
    }
  }

  return analysis;
}
```

---

### 4. rate-model.js

**Purpose:** Effectiveness rating collection for model optimization.

#### Tool Definition

```javascript
/**
 * Rate Model Tool Handler
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
```

#### Tool Handler

```javascript
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
    const ratings = recordEffectivenessRating(modelRole, taskType, rating, feedback);

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
          totalRatings: ratings?.length || 1,
          message: `Rating recorded for ${modelRole} on ${taskType}`,
        }, null, 2),
      }],
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: JSON.stringify({ error: error.message }, null, 2) }],
      isError: true,
    };
  }
}
```

---

### 5. index.js - MCP Server Entry Point

**Purpose:** Server initialization and tool registration.

#### Complete Server Setup

```javascript
#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio.js";
import z from "zod";

// Import tool handlers
import { switchModelTool, handleSwitchModel } from "./tools/switch-model.js";
import { executeTaskTool, handleExecuteTask } from "./tools/execute-task.js";
import { modelDnaTool, handleModelDNA } from "./tools/model-dna-tool.js";
import { rateModelTool, handleRateModel } from "./tools/rate-model.js";

// Tool description section markers (for documentation)
const TOOL_DESCRIPTION_SECTIONS = {
  ROLE: "[ROLE]",
  CONTEXT: "[CONTEXT]",
  TASK: "[TASK]",
  CONSTRAINTS: "[CONSTRAINTS]",
  FORMAT: "[FORMAT]",
};

// Initialize MCP server
const server = new McpServer(
  {
    name: "mcp-model-switcher",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Register all tools with Zod schemas
server.registerTool(
  "switch-model",
  {
    title: "Switch Model",
    description: switchModelTool.description,
    inputSchema: z.object({
      action: z.enum(["load", "unload", "list", "current"]),
      modelId: z.string().optional(),
    }),
  },
  async ({ action, modelId }) => handleSwitchModel({ action, modelId })
);

server.registerTool(
  "execute-task",
  {
    title: "Execute Task",
    description: executeTaskTool.description,
    inputSchema: z.object({
      query: z.string().describe("The task to execute"),
      modelType: z.enum(["conversationalist", "ninjaResearcher", "architect", "executor", "researcher", "vision"]).optional(),
    }),
  },
  async ({ query, modelType }) => handleExecuteTask({ query, modelType })
);

server.registerTool(
  "model-dna",
  {
    title: "Model DNA Management",
    description: modelDnaTool.description,
    inputSchema: z.object({
      action: z.enum(["init", "get", "save-memory", "delete-memory", "evolve"]),
      companyName: z.string().optional(),
      modelId: z.string().optional(),
      memory: z.string().optional(),
      key: z.string().optional(),
      apply: z.boolean().optional(),
    }),
  },
  async ({ action, companyName, modelId, memory, key, apply }) => 
    handleModelDNA({ action, companyName, modelId, memory, key, apply })
);

server.registerTool(
  "rate-model",
  {
    title: "Rate Model",
    description: rateModelTool.description,
    inputSchema: z.object({
      modelRole: z.enum(["conversationalist", "ninjaResearcher", "architect", "executor", "researcher", "vision"]),
      taskType: z.enum(["codeFixes", "featureArchitecture", "codeExecution", "generalResearch", "imageAnalysis"]),
      rating: z.number().min(1).max(5),
      feedback: z.string().optional(),
    }),
  },
  async ({ modelRole, taskType, rating, feedback }) => 
    handleRateModel({ modelRole, taskType, rating, feedback })
);

// Start server
async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

run().catch(console.error);

// Export for testing
export { server };
```

---

## Phase 1/4 Integration Notes

The Phase 4 Tools Implementation depends entirely on Phase 1's DNA System. This section documents the critical integration points and dependency chain.

### Dependencies on Phase 1

All Phase 4 tools call functions from `src/utils/model-dna-manager.js` and `src/utils/model-dna-schema.js`. The dependency mapping is:

| Phase 4 Tool | Phase 1 Function | Purpose |
|-------------|------------------|---------|
| `switch-model.js` | `loadModelDNA()` | Load DNA for model usage statistics |
| `switch-model.js` | `getAverageRating()` | Calculate model effectiveness for list output |
| `execute-task.js` | `loadModelDNA()` | Load DNA for model selection (CRITICAL - must be initialized) |
| `model-dna-tool.js` | `loadModelDNA()` | Get current DNA configuration |
| `model-dna-tool.js` | `createDNAFile()` | Initialize DNA or save changes |
| `model-dna-tool.js` | `saveMemory()` | Store model preferences |
| `model-dna-tool.js` | `deleteMemory()` | Remove stored preferences |
| `rate-model.js` | `loadModelDNA()` | Load DNA before recording rating |
| `rate-model.js` | `recordEffectivenessRating()` | Record user feedback |

### Critical Integration: execute-task.js

The `handleExecuteTask()` function has a mandatory DNA initialization check:

```javascript
const dna = loadModelDNA();

if (!dna) {
  return {
    content: [{ type: "text", text: JSON.stringify({ 
      error: "Model DNA not initialized. Use model-dna action:'init' first.",
      instructions: "Initialize Model DNA by calling the model-dna tool with action:'init' before executing tasks."
    }, null, 2) }],
    isError: true,
  };
}
```

This ensures Phase 1 is fully implemented and initialized before any task execution can occur.

### Forward Dependencies

The Phase 1 DNA system is also used by:
- **Phase 2** - Model Switching Service uses DNA for model recommendations
- **Phase 3** - Task Dispatcher uses `taskModelMapping` for routing
- **Phase 5** - Evolution Engine analyzes `usageStats` for optimization

### File Dependencies

```javascript
// In switch-model.js
import { loadModelDNA, getAverageRating } from "../utils/model-dna-manager.js";

// In execute-task.js
import { loadModelDNA } from "../utils/model-dna-manager.js";

// In model-dna-tool.js
import { loadModelDNA, createDNAFile, saveMemory, deleteMemory } from "../utils/model-dna-manager.js";
import { getDefaultDNA } from "../utils/model-dna-schema.js";

// In rate-model.js
import { loadModelDNA, recordEffectivenessRating } from "../utils/model-dna-manager.js";
```

---

## Integration Points

### Tool Registry Pattern

```javascript
// All tools are registered in index.js using the pattern:
server.registerTool(
  toolName,
  {
    title: "Tool Title",
    description: toolDefinition.description,
    inputSchema: z.object({ ... })
  },
  handlerFunction
);
```

### Error Handling

```javascript
// Consistent error handling across all tools:
try {
  // Tool logic
} catch (error) {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: error.message }, null, 2) }],
    isError: true,
  };
}
```

---

## Testing Strategy

### Unit Tests for Tools

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Tools', () => {
  describe('switch-model', () => {
    it('should list models', async () => {
      const result = await handleSwitchModel({ action: 'list' });
      
      assert.ok(result.content[0].text);
    });

    it('should validate required modelId for load', async () => {
      const result = await handleSwitchModel({ action: 'load' });
      
      assert.ok(result.isError);
    });
  });

  describe('execute-task', () => {
    it('should validate required query', async () => {
      const result = await handleExecuteTask({});
      
      assert.ok(result.isError);
    });

    it('should execute task with valid query', async () => {
      const result = await handleExecuteTask({ query: 'test' });
      
      assert.ok(result.content);
    });
  });

  describe('model-dna', () => {
    it('should validate required action', async () => {
      const result = await handleModelDNA({});
      
      assert.ok(result.isError);
    });

    it('should get DNA when initialized', async () => {
      const result = await handleModelDNA({ action: 'get' });
      
      assert.ok(result.content);
    });
  });

  describe('rate-model', () => {
    it('should validate required fields', async () => {
      const result = await handleRateModel({});
      
      assert.ok(result.isError);
    });

    it('should record valid rating', async () => {
      const result = await handleRateModel({
        modelRole: 'conversationalist',
        taskType: 'generalResearch',
        rating: 5
      });
      
      assert.ok(result.content);
    });
  });
});
```

---

## Performance Considerations

### Request Caching

```javascript
// Cache recent tool results for frequent operations
let _cache = new Map();
const CACHE_TTL = 30000; // 30 seconds

function getCached(key, fetchFn) {
  const cached = _cache.get(key);
  
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return cached.data;
  }
  
  const data = fetchFn();
  _cache.set(key, { data, time: Date.now() });
  
  return data;
}
```

### Rate Limiting

```javascript
// Implement rate limiting for heavy operations
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;
let requestCounts = new Map();

function checkRateLimit(clientId) {
  const now = Date.now();
  
  if (!requestCounts.has(clientId)) {
    requestCounts.set(clientId, []);
  }
  
  // Clean old requests
  const timestamps = requestCounts.get(clientId).filter(t => now - t < RATE_LIMIT_WINDOW);
  
  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  
  timestamps.push(now);
  requestCounts.set(clientId, timestamps);
  
  return true;
}
```

---

## Future Enhancements

- [ ] Tool usage analytics
- [ ] Rate limiting per client
- [ ] Tool timeouts and cancellation
- [ ] Streaming responses for long-running operations