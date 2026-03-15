# Phase 4: Tools Implementation

## Overview

Phase 4 implements the MCP (Model Context Protocol) server exposing four core tools for intelligent model management and task execution.

**Key Features:**
- **switch-model** - Manual model lifecycle management (load/unload/list/current)
- **execute-task** - Automatic task execution with intelligent model selection
- **model-dna** - DNA configuration management (init/get/save-memory/delete-memory/evolve)
- **rate-model** - Effectiveness rating collection for auto-optimization

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Server (server.js)                   │
├─────────────────────────────────────────────────────────────┤
│  Tool Registration                                           │
│  ├── switch-model → handleSwitchModel()                     │
│  ├── execute-task → handleExecuteTask()                     │
│  ├── model-dna → handleModelDNA()                           │
│  └── rate-model → handleRateModel()                         │
├─────────────────────────────────────────────────────────────┤
│  Server Lifecycle                                            │
│  ├── createServer() → Initialize MCP server                 │
│  ├── registerTools() → Register all tools                   │
│  ├── setupSignalHandlers() → Graceful shutdown              │
│  └── main() → Entry point                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
src/
├── server.js                    # MCP server entry point (~200 lines)
└── tools/
    ├── switch-model.js          # Model lifecycle tool (~180 lines)
    ├── execute-task.js          # Task execution tool (~100 lines)
    ├── model-dna-tool.js        # DNA management tool (~350 lines)
    └── rate-model.js            # Rating collection tool (~100 lines)
```

---

## MCP Server Implementation (server.js)

### Server Configuration

```javascript
const SERVER_CONFIG = {
  name: "mcp-model-switcher",
  version: "1.0.0",
  description: "Intelligent model switching and task execution for LM Studio",
};

function createServer() {
  const server = new McpServer(
    { name: SERVER_CONFIG.name, version: SERVER_CONFIG.version },
    { capabilities: { tools: {} } }
  );
  registerTools(server);
  return server;
}
```

### Tool Registration with Zod Schemas

```javascript
function registerTools(server) {
  // switch-model tool
  server.registerTool("switch-model", {
    title: "Switch Model",
    description: switchModelTool.description,
    inputSchema: z.object({
      action: z.enum(["load", "unload", "list", "current"]),
      modelId: z.string().optional(),
    }),
  }, async ({ action, modelId }) => handleSwitchModel({ action, modelId }));

  // execute-task tool
  server.registerTool("execute-task", {
    title: "Execute Task",
    description: executeTaskTool.description,
    inputSchema: z.object({
      query: z.string().describe("The task to execute"),
      modelType: z.enum(["conversationalist", "ninjaResearcher", "architect", "executor", "researcher", "vision"]).optional(),
    }),
  }, async ({ query, modelType }) => handleExecuteTask({ query, modelType }));

  // model-dna tool
  server.registerTool("model-dna", {
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
  }, async ({ action, companyName, modelId, memory, key, apply }) =>
    handleModelDNA({ action, companyName, modelId, memory, key, apply }));

  // rate-model tool
  server.registerTool("rate-model", {
    title: "Rate Model",
    description: rateModelTool.description,
    inputSchema: z.object({
      modelRole: z.enum(["conversationalist", "ninjaResearcher", "architect", "executor", "researcher", "vision"]),
      taskType: z.enum(["codeFixes", "featureArchitecture", "codeExecution", "generalResearch", "imageAnalysis"]),
      rating: z.number().min(1).max(5),
      feedback: z.string().optional(),
    }),
  }, async ({ modelRole, taskType, rating, feedback }) =>
    handleRateModel({ modelRole, taskType, rating, feedback }));
}
```

### Graceful Shutdown

```javascript
function setupSignalHandlers(server) {
  ["SIGINT", "SIGTERM", "SIGHUP"].forEach(signal => {
    process.on(signal, async () => {
      await server.close();
      lmStudioSwitcher.shutdown();
      process.exit(0);
    });
  });
}

async function main() {
  const server = createServer();
  setupSignalHandlers(server);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log("[MCP-Server] Ready and listening on stdio");
}
```

---

## Tool Implementations

### 1. switch-model Tool (switch-model.js)

**Purpose:** Manual model lifecycle management for direct control over LM Studio models.

#### Actions

| Action | Description | Required Params |
|--------|-------------|-----------------|
| `load` | Load a specific model into memory | `modelId` |
| `unload` | Unload a model from memory | `modelId` |
| `list` | List all available models with states | none |
| `current` | Get currently loaded model info | none |

#### Handler Implementation

```javascript
export async function handleSwitchModel(params) {
  const { action } = params;

  try {
    switch (action) {
      case "list": return await handleListModels(params);
      case "current": return await handleGetCurrentModel(params);
      case "load": return await handleLoadModel(params);
      case "unload": return await handleUnloadModel(params);
      default:
        return { content: [{ type: "text", text: JSON.stringify({ error: `Unknown action: ${action}` }) }], isError: true };
    }
  } catch (error) {
    console.error(`[SwitchModel] Error: ${error.message}`);
    return { content: [{ type: "text", text: JSON.stringify({ error: error.message }) }], isError: true };
  }
}

// List models with DNA-enhanced info (usage count, ratings)
async function handleListModels(params) {
  const dna = loadModelDNA();
  const models = await lmStudioSwitcher.getAvailableModels();

  const enhancedModels = models.map(model => {
    const modelId = model.key || model.id;
    return {
      id: modelId,
      displayName: model.display_name || modelId,
      loaded: model.loaded_instances && model.loaded_instances.length > 0,
      purpose: dna?.models?.[modelId]?.purpose || null,
      usageCount: dna?.usageStats?.tasksCompleted?.[modelId] || 0,
      avgRating: getAverageRating(modelId, dna) || null,
      capabilities: model.capabilities || {},
    };
  });

  enhancedModels.sort((a, b) => {
    if (a.loaded && !b.loaded) return -1;
    if (!a.loaded && b.loaded) return 1;
    return (b.usageCount || 0) - (a.usageCount || 0);
  });

  return { content: [{ type: "text", text: JSON.stringify({ success: true, models: enhancedModels, total: enhancedModels.length }, null, 2) }] };
}

// Helper: Calculate average rating for a model
export function getAverageRating(modelId, dna) {
  if (!dna?.usageStats?.modelEffectiveness?.[modelId]) return null;
  const ratings = Object.values(dna.usageStats.modelEffectiveness[modelId]).flat();
  if (ratings.length === 0) return null;
  return Number((ratings.reduce((acc, r) => acc + (r.rating || 0), 0) / ratings.length).toFixed(2));
}

async function handleGetCurrentModel(params) {
  const currentModel = await lmStudioSwitcher.getCurrentModel();
  return { content: [{ type: "text", text: JSON.stringify({ success: true, currentModel }, null, 2) }] };
}

async function handleLoadModel(params) {
  const { modelId } = params;
  if (!modelId) return { content: [{ type: "text", text: JSON.stringify({ error: "modelId is required" }) }], isError: true };
  const result = await lmStudioSwitcher.loadModel(modelId);
  return { content: [{ type: "text", text: JSON.stringify({ success: result.loaded, modelId, alreadyLoaded: result.alreadyLoaded }, null, 2) }] };
}

async function handleUnloadModel(params) {
  const { modelId } = params;
  if (!modelId) return { content: [{ type: "text", text: JSON.stringify({ error: "modelId is required" }) }], isError: true };
  const result = await lmStudioSwitcher.unloadModel(modelId);
  return { content: [{ type: "text", text: JSON.stringify({ success: result.unloaded, modelId }, null, 2) }] };
}
```

---

### 2. execute-task Tool (execute-task.js)

**Purpose:** Automatic task execution with intelligent model selection based on DNA ratings.

#### Handler Implementation

```javascript
export async function handleExecuteTask(params) {
  const { query, modelType } = params;

  if (!query || typeof query !== "string") {
    return { content: [{ type: "text", text: JSON.stringify({ error: "query is required" }) }], isError: true };
  }

  try {
    // CRITICAL: DNA must be initialized before task execution
    const dna = loadModelDNA();
    if (!dna) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Model DNA not initialized. Use model-dna action:'init' first." }) }], isError: true };
    }

    // Execute task with optimal model selection (TaskDispatcher handles classification, fallback, etc.)
    const result = await taskDispatcher.executeTask(query, dna);

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: result.success,
          query,
          modelUsed: result.modelUsed || null,
          classification: result.classification || null,
          fallbackUsed: result.fallbackAttempted || false,
          usage: result.result?.usage || null,
          error: result.error || null,
        }, null, 2),
      }],
    };
  } catch (error) {
    console.error(`[ExecuteTask] Error: ${error.message}`);
    return { content: [{ type: "text", text: JSON.stringify({ error: error.message }) }], isError: true };
  }
}
```

---

### 3. model-dna Tool (model-dna-tool.js)

**Purpose:** DNA configuration management with CRUD operations for model selection and optimization.

#### Actions

| Action | Description | Required Params |
|--------|-------------|-----------------|
| `init` | Initialize Model DNA with defaults or custom settings | none |
| `get` | Get current Model DNA configuration | none |
| `save-memory` | Save a memory (preference) for model selection | `memory` |
| `delete-memory` | Delete a memory by key | `key` |
| `evolve` | Analyze usage and suggest improvements | none |

#### Handler Implementation

```javascript
export async function handleModelDNA(params) {
  const { action } = params;

  try {
    switch (action) {
      case "init": return await handleInitDNA(params);
      case "get": return await handleGetDNA(params);
      case "save-memory": return await handleSaveMemory(params);
      case "delete-memory": return await handleDeleteMemory(params);
      case "evolve": return await handleEvolveDNA(params);
      default:
        return { content: [{ type: "text", text: JSON.stringify({ error: `Unknown action: ${action}` }) }], isError: true };
    }
  } catch (error) {
    console.error(`[ModelDNA] Error: ${error.message}`);
    return { content: [{ type: "text", text: JSON.stringify({ error: error.message }) }], isError: true };
  }
}

async function handleInitDNA(params) {
  const config = {};
  if (params.companyName) config.companyName = params.companyName;
  if (params.modelId) config.defaultModel = params.modelId;
  const result = createDNAFile(config);
  return { content: [{ type: "text", text: JSON.stringify({ success: true, path: result.path }, null, 2) }] };
}

async function handleGetDNA(params) {
  const dna = loadModelDNA();
  if (!dna) {
    return { content: [{ type: "text", text: JSON.stringify({ success: false, message: "Model DNA not initialized" }) }], isError: true };
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
          settings: dna.settings,
          usageStats: {
            totalTasks: Object.values(dna.usageStats?.tasksCompleted || {}).reduce((a, b) => a + b, 0),
            modelEffectivenessCount: Object.keys(dna.usageStats?.modelEffectiveness || {}).length,
          },
        },
      }, null, 2),
    }],
  };
}

async function handleSaveMemory(params) {
  const { memory, key } = params;
  if (!memory) return { content: [{ type: "text", text: JSON.stringify({ error: "memory is required" }) }], isError: true };
  const memoryKey = key || `memory_${Date.now()}`;
  saveMemory(memoryKey, memory);
  return { content: [{ type: "text", text: JSON.stringify({ success: true, key: memoryKey }, null, 2) }] };
}

async function handleDeleteMemory(params) {
  const { key } = params;
  if (!key) return { content: [{ type: "text", text: JSON.stringify({ error: "key is required" }) }], isError: true };
  const deleted = deleteMemory(key);
  return { content: [{ type: "text", text: JSON.stringify({ success: deleted, key }, null, 2) }] };
}

async function handleEvolveDNA(params) {
  const dna = loadModelDNA();
  if (!dna) return { content: [{ type: "text", text: JSON.stringify({ error: "Model DNA not initialized" }) }], isError: true };

  const analysis = analyzeUsage(dna);

  let evolvedDna = dna;
  if (params.apply && analysis.suggestions?.length > 0) {
    const topSuggestion = analysis.suggestions[0];
    if (topSuggestion.mutation) {
      const parts = topSuggestion.mutation.path.split(".");
      let target = evolvedDna;
      for (let i = 0; i < parts.length - 1; i++) target = target[parts[i]];
      target[parts[parts.length - 1]] = topSuggestion.mutation.value;
      createDNAFile(evolvedDna);
    }
  }

  return { content: [{ type: "text", text: JSON.stringify({ success: true, analysis }, null, 2) }] };
}

// Analyze usage patterns and generate suggestions
function analyzeUsage(dna) {
  const usageStats = dna.usageStats || {};
  const models = dna.models || {};
  const taskModelMapping = dna.taskModelMapping || {};
  const effectiveness = usageStats.modelEffectiveness || {};

  const analysis = { totalTasks: Object.values(usageStats.tasksCompleted || {}).reduce((a, b) => a + b, 0), modelUsage: {}, suggestions: [] };

  // Calculate average ratings for all models
  for (const [modelRole, config] of Object.entries(models)) {
    const roleEffectiveness = effectiveness[modelRole];
    analysis.modelUsage[modelRole] = { purpose: config.purpose, usageCount: config.usageCount || 0, averageRating: null };

    if (roleEffectiveness) {
      const ratings = Object.values(roleEffectiveness).flat();
      if (ratings.length > 0) analysis.modelUsage[modelRole].averageRating = (ratings.reduce((a, b) => a + b.rating, 0) / ratings.length).toFixed(2);
    }
  }

  // Find tasks assigned to low-rated models and suggest better alternatives
  for (const [taskType, assignedModelRole] of Object.entries(taskModelMapping)) {
    const modelRating = parseFloat(analysis.modelUsage[assignedModelRole]?.averageRating);
    if (modelRating !== null && !isNaN(modelRating) && modelRating < 3.0) {
      const ratingCount = effectiveness[assignedModelRole] ? Object.values(effectiveness[assignedModelRole]).flat().length : 0;
      if (ratingCount >= 5) {
        const betterAlternative = findBetterModelForTask(taskModelMapping, analysis.modelUsage, taskType, assignedModelRole);
        analysis.suggestions.push({
          type: "low-rating", taskType, modelRole: assignedModelRole, averageRating: modelRating, ratingCount,
          recommendation: `Task "${taskType}" assigned to low-rated model "${assignedModelRole}" (${modelRating}). Consider reassigning.`,
          mutation: { path: `taskModelMapping.${taskType}`, value: betterAlternative || null },
        });
      }
    }
  }

  return analysis;
}

function findBetterModelForTask(taskModelMapping, modelUsage, currentTaskType, currentModelRole) {
  const goodModels = Object.entries(modelUsage)
    .filter(([role, usage]) => parseFloat(usage.averageRating) > 3.5 && role !== currentModelRole)
    .sort((a, b) => parseFloat(b[1].averageRating) - parseFloat(a[1].averageRating));
  return goodModels.length > 0 ? goodModels[0][0] : null;
}
```

---

### 4. rate-model Tool (rate-model.js)

**Purpose:** Effectiveness rating collection for model optimization and auto-evolution.

#### Handler Implementation

```javascript
export async function handleRateModel(params) {
  const { modelRole, taskType, rating, feedback } = params;

  if (!modelRole || !taskType) {
    return { content: [{ type: "text", text: JSON.stringify({ error: "modelRole and taskType are required" }) }], isError: true };
  }

  if (rating < 1 || rating > 5) {
    return { content: [{ type: "text", text: JSON.stringify({ error: "rating must be between 1 and 5" }) }], isError: true };
  }

  try {
    const result = recordEffectivenessRating(modelRole, taskType, rating, feedback);

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
    return { content: [{ type: "text", text: JSON.stringify({ error: error.message }) }], isError: true };
  }
}
```

---

## Usage Examples

### Using switch-model Tool

```javascript
// List all available models
{ action: "list" }

// Get currently loaded model
{ action: "current" }

// Load a specific model
{ action: "load", modelId: "llama-3.2-3b" }

// Unload a model
{ action: "unload", modelId: "llama-3.2-3b" }
```

### Using execute-task Tool

```javascript
// Execute a task with automatic model selection
{ query: "Fix the memory leak in the data processing pipeline" }

// With optional model type override
{ query: "Design an API architecture", modelType: "architect" }
```

### Using model-dna Tool

```javascript
// Initialize DNA
{ action: "init", companyName: "MyCompany" }

// Get current configuration
{ action: "get" }

// Save a memory/preference
{ action: "save-memory", memory: "Prefer faster models for quick tasks", key: "speed_preference" }

// Delete a memory
{ action: "delete-memory", key: "speed_preference" }

// Analyze and suggest improvements (auto-apply)
{ action: "evolve", apply: true }
```

### Using rate-model Tool

```javascript
// Rate a model's performance on a task type
{ modelRole: "ninjaResearcher", taskType: "codeFixes", rating: 5, feedback: "Excellent at finding bugs" }
```

---

## Testing Strategy

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as switchModel from '../src/tools/switch-model.js';
import * as executeTask from '../src/tools/execute-task.js';
import * as modelDna from '../src/tools/model-dna-tool.js';
import * as rateModel from '../src/tools/rate-model.js';

describe('MCP Tools', () => {
  describe('switch-model tool', () => {
    it('should have valid schema with required action field', () => {
      assert.strictEqual(switchModel.switchModelTool.inputSchema.required[0], 'action');
    });

    it('getAverageRating should return null for unknown model', () => {
      const rating = switchModel.getAverageRating('unknown-model', {});
      assert.strictEqual(rating, null);
    });

    it('getAverageRating should calculate average correctly', () => {
      const dna = {
        usageStats: {
          modelEffectiveness: {
            'test-model': { codeFixes: [{ rating: 4 }, { rating: 5 }] }
          }
        }
      };
      const rating = switchModel.getAverageRating('test-model', dna);
      assert.strictEqual(rating, 4.5);
    });
  });

  describe('execute-task tool', () => {
    it('should have valid schema with required query field', () => {
      assert.strictEqual(executeTask.executeTaskTool.inputSchema.required[0], 'query');
    });
  });

  describe('model-dna tool', () => {
    it('should have valid schema with required action field', () => {
      assert.strictEqual(modelDna.modelDnaTool.inputSchema.required[0], 'action');
    });
  });

  describe('rate-model tool', () => {
    it('should have valid schema with required fields', () => {
      const required = rateModel.rateModelTool.inputSchema.required;
      assert.ok(required.includes('modelRole'));
      assert.ok(required.includes('taskType'));
      assert.ok(required.includes('rating'));
    });
  });
});
```

---

## Integration Points

The Tools layer integrates with:

1. **Phase 1 DNA System** - `loadModelDNA()`, `createDNAFile()`, `saveMemory()`, `deleteMemory()`
2. **Phase 2 LM Studio Switcher** - `loadModel()`, `unloadModel()`, `getAvailableModels()`, `getCurrentModel()`
3. **Phase 3 Task Dispatcher** - `executeTask()` for automatic task execution

---

## Changes from Original Specification

| Aspect | Original Spec | Actual Implementation |
|--------|--------------|----------------------|
| Tool registration | Basic function calls | Zod schema validation with typed handlers |
| Error handling | Simple try/catch | Structured error responses with `isError` flag |
| DNA evolution | Manual updates | Automated analysis with mutation suggestions |
| Model listing | Raw model data | Enhanced with usage stats and ratings from DNA |

---

## Moving to Phase 5

**Prerequisites for Phase 5:**
- [ ] All four tools registered and accessible via MCP protocol
- [ ] `switch-model` correctly manages model lifecycle
- [ ] `execute-task` routes tasks based on classification
- [ ] `model-dna` CRUD operations work correctly
- [ ] `rate-model` records ratings for evolution analysis

Once Phase 4 is verified, proceed to **Phase 5: Evolution & Auto-Optimization**.