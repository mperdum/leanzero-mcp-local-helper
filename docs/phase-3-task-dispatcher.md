# Phase 3: Task Dispatcher

## Overview

The Task Dispatcher is the main orchestrator for intelligent task routing in the MCP Model Switcher server. It coordinates task classification, model selection, context management, and fallback handling to ensure optimal execution of user queries.

**Key Features:**
- **Automatic Task Classification** - Routes tasks to appropriate models based on intent
- **Intelligent Model Selection** - Uses DNA-based recommendations with effectiveness ratings
- **Context Management** - Maintains conversation history within token limits (8000 tokens)
- **Fallback Handling** - Automatically tries alternative models if primary fails
- **Streaming Support** - Real-time response streaming for better UX

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    TaskDispatcher Class                     │
├─────────────────────────────────────────────────────────────┤
│  Task Execution Flow                                         │
│  ├── classifyTask() → Determine task type                   │
│  ├── recommendModel() → Select optimal model                │
│  ├── loadModel() → Load if not already loaded               │
│  ├── prepareContext() → Build context (max 8000 tokens)     │
│  ├── executeChatCompletion() → Run with selected model      │
│  └── recordTaskSuccess() → Track completion                 │
├─────────────────────────────────────────────────────────────┤
│  Fallback Strategy                                           │
│  ├── handleLoadFailure() → Try alternative models           │
│  └── getNextBestModel() → Select next candidate             │
├─────────────────────────────────────────────────────────────┤
│  Context Management                                          │
│  ├── contextHistory[] → Track recent tasks (max 10)         │
│  ├── prepareContextForModel() → Build handoff context       │
│  └── clearHistory() → Reset conversation state              │
└─────────────────────────────────────────────────────────────┘
                        ↓
        ┌─────────────────────────────────┐
        │   External Dependencies         │
        ├─────────────────────────────────┤
        │ • TaskClassifier (task type)    │
        │ • LMStudioSwitcher (execution)  │
        │ • ContextManager (context)      │
        │ • ModelDNA Manager (config)     │
        └─────────────────────────────────┘
```

---

## File Structure

```
src/
├── services/
│   ├── task-dispatcher.js       # Main orchestrator (~350 lines)
│   ├── context-manager.js       # Context building and validation
│   └── lm-studio-switcher.js    # Model execution (Phase 2)
└── utils/
    └── task-classifier.js       # Task intent classification
```

---

## TaskDispatcher Class Implementation

### Constructor and State Management

```javascript
export class TaskDispatcher {
  constructor() {
    this.contextHistory = []; // Track recent context for handoff
    this.maxHistory = 10;     // Keep last 10 tasks
  }
}

// Export singleton instance
export const taskDispatcher = new TaskDispatcher();

// Convenience functions
export async function executeTask(query) {
  return taskDispatcher.executeTask(query);
}

export async function executeStreamingTask(query, options) {
  return taskDispatcher.executeStreamingTask(query, options);
}
```

### Main Task Execution Flow

```javascript
/**
 * Execute a task with optimal model selection and fallback
 * @param {string} query - The task to execute
 * @param {Object} [dna] - Model DNA configuration (optional)
 * @returns {Promise<Object>} Execution result
 */
async executeTask(query, dna) {
  console.log(`[TaskDispatcher] Starting task: "${query.substring(0, 50)}..."`);
  
  // Step 1: Use default DNA if not provided
  const modelDna = dna || loadModelDNA();
  
  // Step 2: Classify task intent
  const classification = classifyTask(query);
  console.log(`[TaskDispatcher] Classified as: ${classification.category.id} (${classification.confidence})`);

  // Step 3: Get optimal model recommendation
  const taskType = classification.category.id;
  const recommendation = await lmStudioSwitcher.recommendModel(taskType, modelDna);

  if (recommendation.error) {
    return { 
      success: false, 
      error: recommendation.error,
      suggestion: recommendation.suggestion,
      classification
    };
  }

  console.log(`[TaskDispatcher] Recommended: ${recommendation.model?.key} (rating: ${recommendation.rating})`);

  // Step 4: Load model if needed
  const loadResult = await lmStudioSwitcher.loadModel(recommendation.model?.key || recommendation.model?.id);
  
  if (!loadResult.loaded) {
    console.warn(`[TaskDispatcher] Primary model load failed: ${loadResult.error}`);
    
    // Fallback to next best model
    const fallback = await this.handleLoadFailure(recommendation, query, modelDna);
    if (fallback) return fallback;
    
    return { 
      success: false, 
      error: `Failed to load primary and all fallback models`,
      modelUsed: recommendation.model?.key || recommendation.model?.id,
      fallbackAttempted: true,
      classification
    };
  }

  // Step 5: Prepare context (max 8000 tokens)
  const context = this.prepareContextForModel(query, modelDna);
  
  const contextValidation = contextManager.validateContextSize(context);
  if (!contextValidation.valid) {
    console.warn(`[TaskDispatcher] Context overflow, truncating...`);
    contextValidation.truncated = contextManager.truncateContext(context);
  }

  // Step 6: Build messages array
  const systemPrompt = contextManager.buildSystemPrompt(context, taskType);
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: query }
  ];

  // Step 7: Execute with selected model
  const modelId = recommendation.model?.key || recommendation.model?.id;
  console.log(`[TaskDispatcher] Executing with model: ${modelId}`);
  
  const result = await lmStudioSwitcher.executeChatCompletion(
    modelId,
    messages,
    {
      temperature: modelDna?.settings?.temperature || 0.7,
      max_tokens: modelDna?.settings?.maxTokens || 4096,
      taskType: taskType
    }
  );

  // Step 8: Record usage and ratings
  if (result.success) {
    this.recordTaskSuccess(taskType, modelId, query, result);
    console.log(`[TaskDispatcher] Task completed successfully`);
  } else {
    console.error(`[TaskDispatcher] Task failed: ${result.error}`);
  }

  return {
    success: result.success,
    modelUsed: modelId,
    taskType,
    classification,
    result,
    context: {
      tokenCount: contextValidation.tokenCount || contextManager.estimateTokenCount(context),
      truncated: !!contextValidation.truncated
    },
    fallbackAttempted: !!recommendation.fallbackReason,
    fallbackReason: recommendation.fallbackReason
  };
}
```

### Streaming Task Execution

```javascript
/**
 * Execute a task with streaming response
 * @param {string} query - The task to execute
 * @param {Object} options - Execution options
 * @param {Function} [options.onEvent] - Event callback (eventType, eventData)
 * @param {Function} [options.onMessage] - Message callback for incremental content
 * @param {Object} [dna] - Model DNA configuration
 * @returns {Promise<Object>} Execution result
 */
async executeStreamingTask(query, options = {}, dna) {
  console.log(`[TaskDispatcher] Starting streaming task: "${query.substring(0, 50)}..."`);
  
  const modelDna = dna || loadModelDNA();
  const classification = classifyTask(query);
  const taskType = classification.category.id;
  
  const recommendation = await lmStudioSwitcher.recommendModel(taskType, modelDna);
  
  if (recommendation.error) {
    return { 
      success: false, 
      error: recommendation.error,
      suggestion: recommendation.suggestion
    };
  }

  const modelId = recommendation.model?.key || recommendation.model?.id;
  const context = this.prepareContextForModel(query, modelDna);
  const systemPrompt = contextManager.buildSystemPrompt(context, taskType);
  
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: query }
  ];

  // Add external event/message handlers
  const streamingOptions = {
    temperature: modelDna?.settings?.temperature || 0.7,
    max_tokens: modelDna?.settings?.maxTokens || 4096,
    taskType: taskType,
    ...options
  };

  const result = await lmStudioSwitcher.streamChatCompletion(
    modelId,
    messages,
    streamingOptions
  );

  if (result.success) {
    this.recordTaskSuccess(taskType, modelId, query, result);
  }

  return {
    success: result.success,
    modelUsed: modelId,
    taskType,
    classification,
    result,
    fallbackAttempted: false
  };
}
```

### Fallback Handling

```javascript
/**
 * Handle model load failure with fallback strategy
 * @param {Object} recommendation - Original recommendation
 * @param {string} query - The task query
 * @param {Object} dna - Model DNA configuration
 * @returns {Promise<Object|null>} Fallback result or null
 */
async handleLoadFailure(recommendation, query, dna) {
  const maxAttempts = dna?.fallbackStrategy?.maxAttempts || 3;
  
  // Get all available models
  const availableModels = await lmStudioSwitcher.getAvailableModels();
  const primaryModelId = recommendation.model?.key || recommendation.model?.id;
  
  // Try fallback models sequentially
  for (let attempt = 1; attempt < maxAttempts; attempt++) {
    const nextModel = this.getNextBestModel(availableModels, primaryModelId, attempt);
    
    if (!nextModel) {
      console.log(`[TaskDispatcher] No more fallback models available`);
      break;
    }

    const nextModelId = nextModel.key || nextModel.id;
    console.log(`[TaskDispatcher] Fallback attempt ${attempt}: ${nextModelId}`);

    // Try to load fallback model
    const loadResult = await lmStudioSwitcher.loadModel(nextModelId);
    
    if (!loadResult.loaded) {
      console.warn(`[TaskDispatcher] Fallback model ${nextModelId} failed to load`);
      continue;
    }

    // Execute with fallback model
    const context = this.prepareContextForModel(query, dna);
    const systemPrompt = contextManager.buildSystemPrompt(context, classifyTask(query).category.id);
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: query }
    ];
    
    const result = await lmStudioSwitcher.executeChatCompletion(
      nextModelId,
      messages,
      { temperature: 0.7, max_tokens: 4096 }
    );
    
    if (result.success) {
      console.log(`[TaskDispatcher] Fallback succeeded with ${nextModelId}`);
      return {
        success: true,
        modelUsed: nextModelId,
        result,
        fallbackAttempted: true,
        fallbackFrom: primaryModelId,
        fallbackAttempt: attempt,
        classification: classifyTask(query)
      };
    }
  }

  console.error(`[TaskDispatcher] All fallback attempts failed`);
  return null;
}

/**
 * Get next best model for fallback
 * @param {Array} availableModels - All available models
 * @param {string} excludeModelId - Model to exclude (primary)
 * @param {number} attempt - Attempt number (0-based index into filtered list)
 * @returns {Object|null} Next model or null
 */
getNextBestModel(availableModels, excludeModelId, attempt) {
  // Filter out excluded model
  const candidates = availableModels.filter(m => {
    const modelId = m.key || m.id;
    return modelId !== excludeModelId;
  });
  
  if (candidates.length > attempt) {
    return candidates[attempt];
  }

  // If exhausted, return first available or null
  return candidates[0] || null;
}
```

### Context Management

```javascript
/**
 * Prepare context for model handoff (max 8000 tokens)
 * @param {string} query - Current query
 * @param {Object} dna - Model DNA configuration
 * @returns {Object} Context object with recent history and current task info
 */
prepareContextForModel(query, dna) {
  // Extract last N interactions from history
  const recentHistory = this.contextHistory.slice(-5);
  
  // Build context snippet for model handoff
  const contextSnippet = {
    recentTasks: recentHistory.map(h => ({
      taskType: h.taskType,
      modelUsed: h.modelId,
      query: h.query,
      completed: h.completed
    })),
    currentTask: {
      query: query.substring(0, 500), // Limit current query in context
      timestamp: new Date().toISOString()
    },
    contextSizeLimit: contextManager.getTokenLimit()
  };

  return contextSnippet;
}

/**
 * Record successful task completion for history tracking
 * @param {string} taskType - Type of task completed
 * @param {string} modelId - Model that executed the task
 * @param {string} query - Original query
 * @param {Object} result - Execution result with usage stats
 */
recordTaskSuccess(taskType, modelId, query, result) {
  const taskRecord = {
    taskType,
    modelId,
    query: query.substring(0, 200), // Truncate long queries for history
    completed: true,
    timestamp: new Date().toISOString(),
    tokensUsed: result.usage?.total_tokens || 
                (result.result?.usage?.total_tokens) || 0,
    success: true
  };

  // Update context history (FIFO queue with max size)
  this.contextHistory.push(taskRecord);

  // Limit history size to prevent memory bloat
  if (this.contextHistory.length > this.maxHistory) {
    this.contextHistory = this.contextHistory.slice(-this.maxHistory);
  }

  console.log(`[TaskDispatcher] Recorded task: ${taskType} → ${modelId}`);
}

/**
 * Clear context history (useful for starting fresh conversations)
 */
clearHistory() {
  this.contextHistory = [];
  console.log(`[TaskDispatcher] Context history cleared`);
}

/**
 * Get current context state for debugging/monitoring
 * @returns {Object} Context state with history length and token estimate
 */
getCurrentContext() {
  const tokenEstimate = contextManager.estimateTokenCount(this.contextHistory);
  
  return {
    historyLength: this.contextHistory.length,
    recentTasks: this.contextHistory.slice(-5),
    tokenEstimate,
    maxTokens: contextManager.getTokenLimit()
  };
}

/**
 * Get dispatcher's current state for debugging
 * @returns {Object} State information including limits and counts
 */
getState() {
  return {
    historyCount: this.contextHistory.length,
    maxHistory: this.maxHistory,
    contextLimit: contextManager.getTokenLimit()
  };
}
```

---

## Task Classification Integration

The Task Dispatcher uses the `TaskClassifier` utility to determine task intent. This classification drives model selection and system prompt generation.

### Task Categories

| Category ID | Description | Default Model Type |
|------------|-------------|-------------------|
| `codeFixes` | Bug fixes, debugging, error resolution | `ninja-researcher` |
| `featureArchitecture` | Design patterns, architecture planning | `architect` |
| `codeExecution` | Code writing, editing, implementation | `executor` |
| `generalResearch` | Information gathering, documentation | `researcher` |
| `visionAnalysis` | Image analysis, visual content understanding | `vision` |

### Classification Example

```javascript
import { classifyTask } from '../utils/task-classifier.js';

const query = "Fix the null pointer exception in UserService.java";
const classification = classifyTask(query);

console.log(classification);
// Output: {
//   category: { id: 'codeFixes', name: 'Code Fixes' },
//   confidence: 0.92,
//   keywords: ['fix', 'exception', 'error']
// }
```

---

## Context Manager Integration

The `ContextManager` handles context building and validation to ensure responses stay within token limits.

### Key Functions

```javascript
import { contextManager } from './context-manager.js';

// Validate context size (max 8000 tokens)
const validation = contextManager.validateContextSize(context);
if (!validation.valid) {
  console.warn('Context too large, truncating...');
}

// Build system prompt based on task type and context
const systemPrompt = contextManager.buildSystemPrompt(context, 'codeFixes');

// Estimate token count for a given text/object
const tokens = contextManager.estimateTokenCount(text);

// Get configured token limit
const limit = contextManager.getTokenLimit(); // Returns 8000 by default
```

---

## Usage Examples

### Basic Task Execution

```javascript
import { taskDispatcher } from './task-dispatcher.js';

// Execute a simple query
const result = await taskDispatcher.executeTask(
  "Fix the memory leak in the data processing pipeline"
);

console.log(`Model used: ${result.modelUsed}`);
console.log(`Task type: ${result.taskType}`);
console.log(`Success: ${result.success}`);
if (result.success) {
  console.log(result.result.content);
}
```

### Streaming Task Execution

```javascript
import { taskDispatcher } from './task-dispatcher.js';

const result = await taskDispatcher.executeStreamingTask(
  "Explain how to implement a REST API in Node.js",
  {
    onMessage: (content, type) => {
      process.stdout.write(content); // Print tokens as they arrive
    },
    onEvent: (eventType, eventData) => {
      console.log(`Event: ${eventType}`);
    }
  }
);

console.log(`\n\nComplete response:\n${result.result.content}`);
```

### With Custom DNA Configuration

```javascript
import { taskDispatcher } from './task-dispatcher.js';
import { loadModelDNA } from '../utils/model-dna-manager.js';

// Load custom DNA configuration
const dna = loadModelDNA('/path/to/project');

// Execute with custom configuration
const result = await taskDispatcher.executeTask(
  "Design a microservices architecture for an e-commerce platform",
  dna
);

console.log(result);
```

### Context Management

```javascript
import { taskDispatcher } from './task-dispatcher.js';

// Get current context state
const context = taskDispatcher.getCurrentContext();
console.log(`History length: ${context.historyLength}`);
console.log(`Token estimate: ${context.tokenEstimate}`);

// Clear history to start fresh
taskDispatcher.clearHistory();

// Check dispatcher state
const state = taskDispatcher.getState();
console.log(state);
```

---

## Testing Strategy

### Unit Tests for TaskDispatcher

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TaskDispatcher, taskDispatcher } from '../src/services/task-dispatcher.js';

describe('TaskDispatcher', () => {
  let dispatcher;

  beforeEach(() => {
    dispatcher = new TaskDispatcher();
  });

  afterEach(() => {
    dispatcher.clearHistory();
  });

  describe('recordTaskSuccess()', () => {
    it('should record task completion in history', () => {
      const mockResult = { usage: { total_tokens: 150 } };
      
      dispatcher.recordTaskSuccess('codeFixes', 'llama-3.2', 'Test query', mockResult);
      
      assert.strictEqual(dispatcher.contextHistory.length, 1);
      assert.strictEqual(dispatcher.contextHistory[0].taskType, 'codeFixes');
      assert.strictEqual(dispatcher.contextHistory[0].modelId, 'llama-3.2');
    });

    it('should maintain max history limit', () => {
      const mockResult = { usage: { total_tokens: 100 } };
      
      // Add more than maxHistory tasks
      for (let i = 0; i < 15; i++) {
        dispatcher.recordTaskSuccess(`task${i}`, `model-${i}`, `Query ${i}`, mockResult);
      }
      
      assert.strictEqual(dispatcher.contextHistory.length, 10); // maxHistory limit
    });
  });

  describe('clearHistory()', () => {
    it('should clear all history', () => {
      const mockResult = { usage: { total_tokens: 100 } };
      dispatcher.recordTaskSuccess('codeFixes', 'llama-3.2', 'Test', mockResult);
      
      dispatcher.clearHistory();
      
      assert.strictEqual(dispatcher.contextHistory.length, 0);
    });
  });

  describe('getCurrentContext()', () => {
    it('should return context state with correct values', () => {
      const context = dispatcher.getCurrentContext();
      
      assert.ok(typeof context.historyLength === 'number');
      assert.ok(Array.isArray(context.recentTasks));
      assert.ok(typeof context.tokenEstimate === 'number');
      assert.ok(typeof context.maxTokens === 'number');
    });
  });

  describe('getState()', () => {
    it('should return dispatcher state', () => {
      const state = dispatcher.getState();
      
      assert.strictEqual(state.maxHistory, 10);
      assert.ok(typeof state.historyCount === 'number');
      assert.ok(typeof state.contextLimit === 'number');
    });
  });

  describe('getNextBestModel()', () => {
    it('should return next model excluding primary', () => {
      const models = [
        { key: 'model-a' },
        { key: 'model-b' },
        { key: 'model-c' }
      ];
      
      const next = dispatcher.getNextBestModel(models, 'model-a', 0);
      assert.strictEqual(next.key, 'model-b');
    });

    it('should return null when no models available', () => {
      const models = [{ key: 'only-model' }];
      
      const next = dispatcher.getNextBestModel(models, 'only-model', 0);
      assert.strictEqual(next, null);
    });
  });
});
```

---

## Integration Points

The Task Dispatcher integrates with:

1. **Phase 1 DNA System** - Uses `loadModelDNA()` for configuration and task mapping
2. **Phase 2 LM Studio Switcher** - Executes chat completions via `executeChatCompletion()` and `streamChatCompletion()`
3. **Task Classifier Utility** - Determines task type from query content
4. **Context Manager** - Builds system prompts and validates context size

---

## Error Handling Strategy

| Error Type | Handling Approach | User Feedback |
|------------|------------------|---------------|
| Model load failure | Try fallback models (up to 3 attempts) | `fallbackAttempted: true` in response |
| All fallbacks fail | Return error with suggestion | `error: "Failed to load all models"` |
| Context overflow | Truncate context automatically | `context.truncated: true` flag |
| LM Studio disconnected | Connection error from switcher | `error: recommendation.error` |

---

## Performance Considerations

1. **Context History Limit** - Max 10 tasks to prevent memory bloat
2. **Token Limit Enforcement** - 8000 token limit with automatic truncation
3. **Model Caching** - Reuses loaded models via `LMStudioSwitcher._loadedModels` cache
4. **Fallback Efficiency** - Sequential fallback attempts (not parallel)

---

## Changes from Original Specification

| Aspect | Original Spec | Actual Implementation |
|--------|--------------|----------------------|
| Context limit | Not specified | 8000 tokens with automatic truncation |
| History tracking | Basic logging | Structured `contextHistory` array (max 10) |
| Streaming support | Not mentioned | **Implemented** - Full streaming via `executeStreamingTask()` |
| Fallback strategy | Simple retry | Multi-model fallback with configurable attempts |

---

## Moving to Phase 4

**Prerequisites for Phase 4:**
- [ ] `taskDispatcher.executeTask()` routes tasks correctly based on classification
- [ ] `taskDispatcher.executeStreamingTask()` streams tokens with callbacks
- [ ] Fallback handling works when primary model fails to load
- [ ] Context history is maintained within limits (max 10 tasks)

Once Phase 3 is verified, proceed to **Phase 4: Tools Implementation**.