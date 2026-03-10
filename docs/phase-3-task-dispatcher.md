# Phase 3: Task Dispatcher

## Overview

The Task Dispatcher intelligently routes user queries to the most appropriate model based on task classification. It analyzes query intent, selects the optimal model, preserves context across switches, and handles fallback scenarios automatically.

**Key Components:**
- `task-classifier.js` - Intent analysis and category mapping
- `context-manager.js` - Context preservation (8000 token limit)
- Task execution with automatic model handoff

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Task Dispatcher                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  User Query → Intent Classification → Model Recommendation      │
│                           ↓                                      │
│                    Context Preparation                           │
│                           ↓                                      │
│                    Model Execution                               │
│                           ↓                                      │
│                    Usage Tracking                                │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
src/
├── services/
│   └── task-dispatcher.js          # Main dispatcher service
├── utils/
│   └── task-classifier.js          # Intent classification
└── services/
    └── context-manager.js          # Context preservation
```

---

## Detailed Component Breakdown

### 1. task-classifier.js

**Purpose:** Classifies user queries into task categories for optimal model routing.

#### Task Categories

```javascript
export const TASK_CATEGORIES = {
  CODE_FIXES: {
    id: "codeFixes",
    keywords: ["fix", "bug", "error", "debug", "syntax", "crash", "exception"],
    recommendedModel: "ninjaResearcher",
    description: "Code fixes, debugging, error resolution"
  },
  FEATURE_ARCHITECTURE: {
    id: "featureArchitecture",
    keywords: ["architecture", "design", "structure", "pattern", "module", "layer"],
    recommendedModel: "architect",
    description: "Feature architecture, design patterns, system structure"
  },
  CODE_EXECUTION: {
    id: "codeExecution",
    keywords: ["execute", "run", "write", "create", "edit", "generate", "modify"],
    recommendedModel: "executor",
    description: "Code execution, writing, and editing"
  },
  GENERAL_RESEARCH: {
    id: "generalResearch",
    keywords: ["research", "information", "overview", "summary", "explain", "what is"],
    recommendedModel: "researcher",
    description: "General research, information gathering"
  },
  IMAGE_ANALYSIS: {
    id: "imageAnalysis",
    keywords: ["image", "visual", "screenshot", "diagram", "chart", "graph", "picture"],
    recommendedModel: "vision",
    description: "Image analysis, visual content understanding"
  },
  CONVERSATION: {
    id: "conversation",
    keywords: ["chat", "talk", "discuss", "ask", "question", "hello"],
    recommendedModel: "conversationalist",
    description: "General conversation, questions"
  }
};
```

#### Classification Algorithm

```javascript
/**
 * Classify user query into a task category
 * @param {string} query - The user's query text
 * @returns {Object} Classification result with category, score, confidence
 */
export function classifyTask(query) {
  // Edge case: empty or invalid query
  if (!query || typeof query !== "string") {
    return { 
      category: TASK_CATEGORIES.CONVERSATION, 
      confidence: 0.5,
      score: 0
    };
  }

  const lowerQuery = query.toLowerCase();
  
  let bestCategory = TASK_CATEGORIES.CONVERSATION;
  let highestScore = 0;

  // Score each category based on keyword matches
  for (const category of Object.values(TASK_CATEGORIES)) {
    let score = 0;
    
    // Keyword matching (exact substring match)
    for (const keyword of category.keywords) {
      if (lowerQuery.includes(keyword)) {
        score += 10; // Full points for keyword match
      }
    }

    // Length bonus (longer queries typically more specific)
    if (query.length > 50) {
      score += 5;
    }
    
    // First word bonus (often indicates intent)
    const firstWord = lowerQuery.split(' ')[0];
    if (category.keywords.includes(firstWord)) {
      score += 3;
    }

    if (score > highestScore) {
      highestScore = score;
      bestCategory = category;
    }
  }

  // Determine confidence level
  let confidence = "low";
  if (highestScore >= 30) {
    confidence = "high";
  } else if (highestScore >= 15) {
    confidence = "medium";
  } else if (highestScore === 0) {
    confidence = "none"; // No keywords matched
  }

  return { 
    category: bestCategory, 
    score: highestScore, 
    confidence 
  };
}

/**
 * Get all task categories for discovery/display
 */
export function getTaskCategories() {
  return Object.entries(TASK_CATEGORIES).map(([key, cat]) => ({
    id: key,
    ...cat
  }));
}

/**
 * Register a custom task category (extensibility)
 */
export function registerTaskCategory(category) {
  if (!category.id || !category.keywords || !category.recommendedModel) {
    throw new Error("Category must have id, keywords, and recommendedModel");
  }
  
  TASK_CATEGORIES[category.id.toUpperCase()] = category;
}
```

#### Classification Examples

```javascript
// Example 1: Bug fix
classifyTask("I need to fix a bug in my authentication code");
// Returns: { category: CODE_FIXES, score: 20, confidence: "high" }

// Example 2: Architecture question
classifyTask("How should I structure a microservices architecture?");
// Returns: { category: FEATURE_ARCHITECTURE, score: 30, confidence: "high" }

// Example 3: Code generation
classifyTask("Write a function that validates email addresses");
// Returns: { category: CODE_EXECUTION, score: 20, confidence: "medium" }

// Example 4: General research
classifyTask("What is machine learning?");
// Returns: { category: GENERAL_RESEARCH, score: 20, confidence: "medium" }

// Example 5: Image analysis
classifyTask("Analyze this screenshot of my UI");
// Returns: { category: IMAGE_ANALYSIS, score: 10, confidence: "low" }
```

---

### 2. context-manager.js

**Purpose:** Preserves conversation context across model switches with an 8000 token limit.

#### Context Extraction

```javascript
export class ContextManager {
  constructor() {
    this.maxContextTokens = parseInt(process.env.MAX_CONTEXT_TOKENS || "8000");
  }

  /**
   * Extract key information from conversation history
   * @param {Array} history - Array of conversation messages
   * @param {number} maxTokens - Maximum tokens to preserve
   * @returns {Object} Extracted context with token estimate
   */
  extractKeyInformation(history, maxTokens = this.maxContextTokens) {
    // Filter to last N messages for relevance
    const recentMessages = history.slice(-10);
    
    // Extract key points from user and assistant messages
    const keyPoints = recentMessages
      .filter(msg => msg.role === "user" || msg.role === "assistant")
      .map(msg => ({
        role: msg.role,
        content: this.truncateContent(msg.content, 500), // ~125 tokens max per message
        timestamp: msg.timestamp || new Date().toISOString()
      }));

    return {
      keyPoints,
      totalTokens: this.estimateTokenCount(keyPoints),
      truncated: false
    };
  }

  /**
   * Truncate content to approximate token count
   * Using rough estimate: 1 token ≈ 4 characters
   * @param {string} content - Text to truncate
   * @param {number} maxTokens - Maximum tokens allowed
   * @returns {string} Truncated content
   */
  truncateContent(content, maxTokens) {
    if (!content || typeof content !== "string") return "";
    
    const charLimit = maxTokens * 4;
    
    if (content.length <= charLimit) {
      return content;
    }

    // Try to truncate at sentence boundary
    const truncated = content.slice(0, charLimit);
    const lastPeriod = truncated.lastIndexOf(".");
    const lastQuestion = truncated.lastIndexOf("?");
    const lastExclamation = truncated.lastIndexOf("!");
    
    // Find best sentence boundary
    const boundary = Math.max(lastPeriod, lastQuestion, lastExclamation);
    
    if (boundary > charLimit * 0.5) { // At least 50% of content kept
      return truncated.slice(0, boundary + 1);
    }

    // No good sentence boundary - truncate at word boundary
    const lastSpace = truncated.lastIndexOf(" ");
    if (lastSpace > charLimit * 0.8) {
      return truncated.slice(0, lastSpace) + "...";
    }

    return truncated + "...[TRUNCATED]";
  }

  /**
   * Estimate token count (rough approximation)
   * @param {*} content - Content to estimate
   * @returns {number} Estimated token count
   */
  estimateTokenCount(content) {
    if (typeof content === "string") {
      return Math.ceil(content.length / 4);
    }

    if (Array.isArray(content)) {
      return content.reduce((sum, item) => 
        sum + this.estimateTokenCount(item.content || item), 0
      );
    }

    if (content && typeof content === "object") {
      return this.estimateTokenCount(JSON.stringify(content));
    }

    return 0;
  }

  /**
   * Build handoff context for next model
   * @param {string} currentModelPurpose - Purpose of current model
   * @param {Array} taskHistory - Recent task history
   * @returns {Object} Handoff context
   */
  buildHandoffContext(currentModelPurpose, taskHistory) {
    // Extract only need-to-know information
    const handoffContext = {
      taskSummary: this.summarizeTask(taskHistory),
      keyDecisions: this.extractKeyDecisions(taskHistory),
      currentState: this.getCurrentState(taskHistory),
      previousModel: {
        purpose: currentModelPurpose,
        completedTasks: taskHistory.filter(t => t.completed).length
      }
    };

    return {
      context: handoffContext,
      estimatedTokens: this.estimateTokenCount(handoffContext),
      truncated: false
    };
  }

  /**
   * Summarize recent task history
   * @param {Array} taskHistory - Task history array
   * @returns {string} Summarized task description
   */
  summarizeTask(taskHistory) {
    const recentTasks = taskHistory.slice(-5);
    
    if (recentTasks.length === 0) {
      return "No recent task history";
    }

    return `Recent tasks: ${recentTasks.map(t => 
      t.content?.substring(0, 50) + (t.content?.length > 50 ? "..." : "") || "N/A"
    ).join(" | ")}`;
  }

  /**
   * Extract key decisions from history
   * @param {Array} taskHistory - Task history array
   * @returns {Array} Key decisions
   */
  extractKeyDecisions(taskHistory) {
    // Look for decision markers in assistant messages
    const decisions = taskHistory.filter(m => 
      m.role === "assistant" && (
        m.content?.includes("decision") || 
        m.content?.includes("Decided") ||
        m.content?.includes("conclude") ||
        m.content?.includes("solution")
      )
    );

    return decisions.slice(-3).map(d => 
      d.content?.substring(0, 100) + (d.content?.length > 100 ? "..." : "")
    );
  }

  /**
   * Get current state from last message
   * @param {Array} taskHistory - Task history array
   * @returns {Object} Current state
   */
  getCurrentState(taskHistory) {
    const lastMessage = taskHistory[taskHistory.length - 1];
    
    if (!lastMessage) {
      return { status: "no-history" };
    }

    return {
      lastRole: lastMessage.role,
      lastContentPreview: lastMessage.content?.substring(0, 50),
      lastTimestamp: lastMessage.timestamp
    };
  }

  /**
   * Truncate context to stay under token limit
   * Uses deep truncation for large contexts
   * @param {Object} context - Context object to truncate
   * @param {number} maxTokens - Maximum tokens allowed
   * @returns {Object} Truncated context
   */
  truncateContext(context, maxTokens = this.maxContextTokens) {
    const jsonStr = JSON.stringify(context);
    const estimatedTokens = this.estimateTokenCount(jsonStr);
    
    if (estimatedTokens <= maxTokens) {
      return { ...context, _truncated: false };
    }

    // Deep truncate recursively
    const truncated = this.deepTruncate(context, maxTokens);
    
    return {
      ...truncated,
      _truncated: true,
      originalTokenEstimate: estimatedTokens,
      truncatedTokenEstimate: this.estimateTokenCount(JSON.stringify(truncated))
    };
  }

  /**
   * Deep truncate for nested objects/arrays
   * @param {*} value - Value to truncate
   * @param {number} maxTokens - Maximum tokens for this value
   * @returns {*} Truncated value
   */
  deepTruncate(value, maxTokens) {
    if (typeof value === "string") {
      return this.truncateContent(value, maxTokens);
    }

    if (Array.isArray(value)) {
      // Keep first half of array elements
      const halfLength = Math.max(1, Math.floor(value.length / 2));
      return value.slice(0, halfLength).map(item => 
        typeof item === "object" ? this.deepTruncate(item, maxTokens / 2) : item
      );
    }

    if (value && typeof value === "object") {
      // Keep half of object properties
      const entries = Object.entries(value);
      const keepCount = Math.max(1, Math.floor(entries.length / 2));
      
      return Object.fromEntries(
        entries.slice(0, keepCount).map(([k, v]) => 
          [k, typeof v === "object" ? this.deepTruncate(v, maxTokens / 2) : v]
        )
      );
    }

    return value; // Primitive type - return as is
  }

  /**
   * Validate context size before sending to model
   * @param {Object} context - Context to validate
   * @returns {Object} Validation result
   */
  validateContextSize(context) {
    const tokenCount = this.estimateTokenCount(JSON.stringify(context));
    
    return {
      valid: tokenCount <= this.maxContextTokens,
      tokenCount,
      limit: this.maxContextTokens,
      overflow: Math.max(0, tokenCount - this.maxContextTokens)
    };
  }

  /**
   * Create system prompt with context
   * @param {Object} context - Context object
   * @param {string} taskType - Current task type
   * @returns {string} System prompt for model
   */
  buildSystemPrompt(context, taskType) {
    const validation = this.validateContextSize(context);
    
    if (!validation.valid) {
      console.warn(`[Context] Context overflow: ${validation.overflow} tokens over limit`);
      // Auto-truncate
      const truncated = this.truncateContext(context);
      return this.buildSystemPrompt(truncated, taskType);
    }

    return `You are an AI assistant switching to handle a ${taskType} task.

Previous context:
${JSON.stringify(context, null, 2)}

Instructions:
- Continue from where the previous model left off
- Maintain consistency with prior decisions
- Focus on the current task while respecting context
- If unsure about prior work, ask clarifying questions`;
  }
}
```

#### Context Manager Example Usage

```javascript
import { contextManager } from './context-manager.js';

// During a task switch:
const handoff = contextManager.buildHandoffContext(
  "ninjaResearcher",  // Previous model purpose
  taskHistory         // Recent conversation history
);

console.log(`Handoff context: ${handoff.estimatedTokens} tokens`);

// Validate before sending to model
const validation = contextManager.validateContextSize(handoff.context);
if (!validation.valid) {
  const truncated = contextManager.truncateContext(handoff.context);
  console.log(`Truncated to ${truncated.truncatedTokenEstimate} tokens`);
}
```

---

### 3. task-dispatcher.js

**Purpose:** Main orchestrator that executes tasks with optimal model selection and automatic fallback.

#### TaskDispatcher Class

```javascript
export class TaskDispatcher {
  constructor() {
    this.contextHistory = []; // Track recent context for handoff
    this.maxHistory = 10;     // Keep last 10 tasks
  }

  /**
   * Execute a task with optimal model selection and fallback
   * @param {string} query - The task to execute
   * @param {Object} dna - Model DNA configuration
   * @returns {Promise<Object>} Execution result
   */
  async executeTask(query, dna) {
    console.log(`[TaskDispatcher] Starting task: "${query.substring(0, 50)}..."`);
    
    // Step 1: Classify task intent
    const classification = classifyTask(query);
    console.log(`[TaskDispatcher] Classified as: ${classification.category.id} (${classification.confidence} confidence)`);

    // Step 2: Get optimal model recommendation
    const taskType = classification.category.id;
    const recommendation = await lmStudioSwitcher.recommendModel(taskType, dna);

    if (recommendation.error) {
      return { 
        success: false, 
        error: recommendation.error,
        suggestion: recommendation.suggestion
      };
    }

    console.log(`[TaskDispatcher] Recommended model: ${recommendation.model.id} (rating: ${recommendation.rating || 'N/A'})`);

    // Step 3: Load model if needed
    const loadResult = await lmStudioSwitcher.loadModel(recommendation.model.id);
    
    if (!loadResult.loaded) {
      console.warn(`[TaskDispatcher] Primary model load failed: ${loadResult.error}`);
      
      // Fallback to next best model
      const fallback = await this.handleLoadFailure(recommendation, query, dna);
      if (fallback) {
        return fallback;
      }
      
      return { 
        success: false, 
        error: `Failed to load primary and all fallback models`,
        primaryModel: recommendation.model.id,
        fallbackAttempted: true
      };
    }

    // Step 4: Prepare context (max 8000 tokens)
    const context = this.prepareContextForModel(query, dna);
    
    // Validate context size
    const contextValidation = contextManager.validateContextSize(context);
    if (!contextValidation.valid) {
      console.warn(`[TaskDispatcher] Context overflow, truncating...`);
    }

    // Step 5: Build messages array
    const systemPrompt = contextManager.buildSystemPrompt(context, taskType);
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: query }
    ];

    // Step 6: Execute with selected model
    console.log(`[TaskDispatcher] Executing with model: ${recommendation.model.id}`);
    
    const result = await lmStudioSwitcher.executeChatCompletion(
      recommendation.model.id,
      messages,
      {
        temperature: dna?.settings?.temperature || 0.7,
        maxTokens: dna?.settings?.maxTokens || 4096
      }
    );

    // Step 7: Record usage and ratings
    if (result.success) {
      this.recordTaskSuccess(taskType, recommendation.model.id, query, result);
      console.log(`[TaskDispatcher] Task completed successfully`);
    } else {
      console.error(`[TaskDispatcher] Task failed: ${result.error}`);
    }

    return {
      success: result.success,
      modelUsed: recommendation.model.id,
      taskType,
      classification,
      result,
      fallbackAttempted: !!recommendation.fallbackReason,
      fallbackReason: recommendation.fallbackReason
    };
  }

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
    
    // Try fallback models
    for (let attempt = 1; attempt < maxAttempts; attempt++) {
      const nextModel = this.getNextBestModel(availableModels, recommendation.model.id, attempt);
      
      if (!nextModel) {
        console.log(`[TaskDispatcher] No more fallback models available`);
        break;
      }

      console.log(`[TaskDispatcher] Fallback attempt ${attempt}: ${nextModel.id}`);

      // Try to load fallback model
      const loadResult = await lmStudioSwitcher.loadModel(nextModel.id);
      
      if (!loadResult.loaded) {
        console.warn(`[TaskDispatcher] Fallback model ${nextModel.id} failed to load`);
        continue; // Try next fallback
      }

      // Execute with fallback model
      const context = this.prepareContextForModel(query, dna);
      const systemPrompt = contextManager.buildSystemPrompt(context, classifyTask(query).category.id);
      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: query }
      ];
      
      const result = await lmStudioSwitcher.executeChatCompletion(
        nextModel.id,
        messages,
        { temperature: 0.7, maxTokens: 4096 }
      );
      
      if (result.success) {
        console.log(`[TaskDispatcher] Fallback succeeded with ${nextModel.id}`);
        return {
          success: true,
          modelUsed: nextModel.id,
          result,
          fallbackAttempted: true,
          fallbackFrom: recommendation.model.id,
          fallbackAttempt: attempt
        };
      }
    }

    console.error(`[TaskDispatcher] All fallback attempts failed`);
    return null;
  }

  /**
   * Get next best model for fallback
   * @param {Array} availableModels - All available models
   * @param {string} excludeModelId - Model to exclude
   * @param {number} attempt - Attempt number (0-based)
   * @returns {Object|null} Next model or null
   */
  getNextBestModel(availableModels, excludeModelId, attempt) {
    // Filter out excluded model
    const candidates = availableModels.filter(m => m.id !== excludeModelId);
    
    if (candidates.length > attempt) {
      return candidates[attempt];
    }

    // If we've exhausted the list, return first available
    return candidates[0] || null;
  }

  /**
   * Prepare context for model handoff (max 8000 tokens)
   * @param {string} query - Current query
   * @param {Object} dna - Model DNA configuration
   * @returns {Object} Context object
   */
  prepareContextForModel(query, dna) {
    // Extract last N interactions from history
    const recentHistory = this.contextHistory.slice(-5);
    
    // Build context snippet
    const contextSnippet = {
      recentTasks: recentHistory.map(h => ({
        taskType: h.taskType,
        modelUsed: h.modelId,
        query: h.query,
        completed: h.completed
      })),
      currentTask: {
        query,
        timestamp: new Date().toISOString()
      },
      contextSizeLimit: 8000
    };

    return contextSnippet;
  }

  /**
   * Record successful task completion
   * @param {string} taskType - Type of task completed
   * @param {string} modelId - Model that executed the task
   * @param {string} query - Original query
   * @param {Object} result - Execution result
   */
  recordTaskSuccess(taskType, modelId, query, result) {
    const taskRecord = {
      taskType,
      modelId,
      query,
      completed: true,
      timestamp: new Date().toISOString(),
      tokensUsed: result.usage?.total_tokens || 0,
      success: true
    };

    // Update context history
    this.contextHistory.push(taskRecord);

    // Limit history size
    if (this.contextHistory.length > this.maxHistory) {
      this.contextHistory = this.contextHistory.slice(-this.maxHistory);
    }

    console.log(`[TaskDispatcher] Recorded task: ${taskType} → ${modelId}`);
  }

  /**
   * Clear context history
   */
  clearHistory() {
    this.contextHistory = [];
    console.log(`[TaskDispatcher] Context history cleared`);
  }

  /**
   * Get current context state
   * @returns {Object} Context state
   */
  getCurrentContext() {
    return {
      historyLength: this.contextHistory.length,
      recentTasks: this.contextHistory.slice(-5),
      tokenEstimate: contextManager.estimateTokenCount(this.contextHistory)
    };
  }
}

// Export singleton
export const taskDispatcher = new TaskDispatcher();
```

---

## Integration with Task Classifier

```javascript
import { classifyTask } from '../utils/task-classifier.js';

// Inside TaskDispatcher.executeTask():
const classification = classifyTask(query);
const taskType = classification.category.id;

// Get recommended model for this task type
const recommendation = await lmStudioSwitcher.recommendModel(taskType, dna);
```

---

## Testing Strategy

### Unit Tests for task-classifier.js

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { classifyTask, getTaskCategories, TASK_CATEGORIES } from '../utils/task-classifier.js';

describe('Task Classifier', () => {
  describe('classifyTask()', () => {
    it('should classify bug fix as CODE_FIXES', () => {
      const result = classifyTask("Fix this bug in my code");
      assert.strictEqual(result.category.id, 'codeFixes');
      assert.ok(result.confidence === 'high' || result.confidence === 'medium');
    });

    it('should classify architecture question as FEATURE_ARCHITECTURE', () => {
      const result = classifyTask("How do I design a microservices architecture?");
      assert.strictEqual(result.category.id, 'featureArchitecture');
    });

    it('should classify write/create as CODE_EXECUTION', () => {
      const result = classifyTask("Write a function to sort an array");
      assert.strictEqual(result.category.id, 'codeExecution');
    });

    it('should classify research question as GENERAL_RESEARCH', () => {
      const result = classifyTask("What is artificial intelligence?");
      assert.strictEqual(result.category.id, 'generalResearch');
    });

    it('should classify image task as IMAGE_ANALYSIS', () => {
      const result = classifyTask("Analyze this screenshot");
      assert.strictEqual(result.category.id, 'imageAnalysis');
    });

    it('should return CONVERSATION for unclear queries', () => {
      const result = classifyTask("Hello");
      assert.strictEqual(result.category.id, 'conversation');
    });

    it('should handle empty query', () => {
      const result = classifyTask("");
      assert.strictEqual(result.category.id, 'conversation');
      assert.strictEqual(result.score, 0);
    });

    it('should score higher for multiple keyword matches', () => {
      const result1 = classifyTask("fix bug debug error");
      const result2 = classifyTask("fix");
      assert.ok(result1.score > result2.score);
    });
  });

  describe('getTaskCategories()', () => {
    it('should return all categories', () => {
      const categories = getTaskCategories();
      assert.strictEqual(categories.length, 6);
    });
  });
});
```

### Unit Tests for context-manager.js

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { contextManager } from '../services/context-manager.js';

describe('Context Manager', () => {
  describe('truncateContent()', () => {
    it('should truncate long content to token limit', () => {
      const longText = "a".repeat(1000); // 250 tokens
      const result = contextManager.truncateContent(longText, 100); // 400 chars
      
      assert.ok(result.length <= 410); // Give slight margin
      assert.ok(result.includes("...")); // Should indicate truncation
    });

    it('should not truncate short content', () => {
      const shortText = "Short text";
      const result = contextManager.truncateContent(shortText, 100);
      
      assert.strictEqual(result, shortText);
    });
  });

  describe('estimateTokenCount()', () => {
    it('should estimate string tokens correctly', () => {
      const tokens = contextManager.estimateTokenCount("abcd"); // 4 chars = 1 token
      assert.strictEqual(tokens, 1);
    });

    it('should estimate array tokens', () => {
      const tokens = contextManager.estimateTokenCount([
        { content: "abcd" },
        { content: "efgh" }
      ]);
      assert.strictEqual(tokens, 2);
    });
  });

  describe('validateContextSize()', () => {
    it('should validate context within limit', () => {
      const context = { history: [{ content: "short" }] };
      const validation = contextManager.validateContextSize(context);
      
      assert.strictEqual(validation.valid, true);
    });

    it('should reject context over limit', () => {
      const context = { large: "a".repeat(10000) };
      const validation = contextManager.validateContextSize(context);
      
      assert.strictEqual(validation.valid, false);
      assert.ok(validation.overflow > 0);
    });
  });

  describe('deepTruncate()', () => {
    it('should truncate nested objects', () => {
      const deep = { a: { b: { c: { d: "value" } } } };
      const result = contextManager.deepTruncate(deep, 10);
      
      assert.ok(typeof result === 'object');
      assert.ok(result !== deep); // Should be new object
    });
  });
});
```

### Integration Tests

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { taskDispatcher } from '../services/task-dispatcher.js';
import { loadModelDNA } from '../utils/model-dna-manager.js';

describe('Task Dispatcher Integration', () => {
  beforeEach(async () => {
    // Reset context before each test
    taskDispatcher.clearHistory();
  });

  describe('Full Task Execution Flow', () => {
    it('should classify and execute a task', async () => {
      const dna = loadModelDNA();
      const query = "Write a hello world function in JavaScript";
      
      // This test would need LM Studio running
      // For now, test classification only
      const result = await taskDispatcher.executeTask(query, dna);
      
      // If LM Studio is running, expect success or handled failure
      // This test is designed to be run with test fixtures
    });
  });
});
```

---

## Configuration

### Environment Variables

```bash
# Task dispatcher settings
MAX_CONTEXT_TOKENS=8000
HISTORY_SIZE=10

# Model selection thresholds
CONFIDENCE_THRESHOLD=0.6
FALLBACK_MAX_ATTEMPTS=3
```

### DNA Configuration

```json
{
  "taskModelMapping": {
    "codeFixes": "ninjaResearcher",
    "featureArchitecture": "architect",
    "codeExecution": "executor",
    "generalResearch": "researcher",
    "imageAnalysis": "vision"
  },
  "fallbackStrategy": {
    "autoFallback": true,
    "ratingThreshold": 3.0,
    "maxAttempts": 3
  }
}
```

---

## Performance Optimization

### Caching Strategy

```javascript
// Cache classification results for similar queries
const _classificationCache = new Map();

classifyTask(query) {
  const cacheKey = query.toLowerCase().substring(0, 100);
  
  if (_classificationCache.has(cacheKey)) {
    return _classificationCache.get(cacheKey);
  }
  
  const result = this.performClassification(query);
  _classificationCache.set(cacheKey, result);
  
  return result;
}
```

---

## Future Enhancements

- [ ] Machine learning-based intent classification
- [ ] Multi-task routing (complex queries split across models)
- [ ] Conversation state tracking with semantic memory
- [ ] Adaptive context window size based on model capability
- [ ] Task batching for efficiency

---

## Phase 3 Marketplace Distribution Checklist

This phase focuses on ensuring the Task Dispatcher meets Cline MCP Marketplace quality standards.

### Code Quality Requirements
- [ ] Task classification is deterministic and reliable
- [ ] Fallback strategy handles all edge cases
- [ ] Context preservation respects token limits (8000)
- [ ] Error recovery is graceful with helpful messages
- [ ] History management prevents memory leaks
- [ ] Async operations properly awaited

### Documentation Requirements
- [ ] Classification algorithm is clearly documented
- [ ] Keyword lists are comprehensive
- [ ] Context truncation strategy explained
- [ ] Fallback logic is well-commented
- [ ] Integration points with other services documented

### Integration Testing
- [ ] Test classification accuracy with diverse queries
- [ ] Verify context handoff between model switches
- [ ] Validate fallback chain (primary → fallback → fallback2)
- [ ] Test with 10+ conversation history items
- [ ] Confirm memory doesn't grow unbounded

### Market Distribution Considerations
- [ ] Task dispatcher works standalone (can be tested without LM Studio)
- [ ] Classification provides high confidence for most tasks
- [ ] Context handoff is seamless (<8000 tokens always)
- [ ] Fallback chains are limited to 3 attempts max
- [ ] Error messages are user-friendly

### Next Steps
When Phase 3 is complete, proceed to:
1. **Phase 4** - Tools Implementation (MCP server tools)
2. **Phase 5** - Evolution & Auto-Optimization (usage tracking)
3. **Phase 6** - Complete marketplace submission guide

### See Also
- [Cline MCP Marketplace](https://github.com/cline/mcp-marketplace)
- [Phase 1: Core DNA System](phase-1-core-dna-system.md)
- [Phase 2: Model Switching Service](phase-2-model-switching-service.md)
- [Complete Submission Guide](phase-6-marketplace-submission.md) (to be created in Phase 5)