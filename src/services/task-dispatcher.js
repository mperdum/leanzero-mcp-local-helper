/**
 * Task Dispatcher - Main orchestrator for intelligent task routing
 * Coordinates task classification, model selection, context management, and fallback handling
 */

import { classifyTask } from '../utils/task-classifier.js';
import { contextManager } from './context-manager.js';
import { lmStudioSwitcher } from './lm-studio-switcher.js';
import { loadModelDNA, getDefaultDNA } from '../utils/model-dna-manager.js';

/**
 * TaskDispatcher class - Main entry point for task execution
 */
export class TaskDispatcher {
  /**
   * Create a new TaskDispatcher
   */
  constructor() {
    this.contextHistory = []; // Track recent context for handoff
    this.maxHistory = 10;     // Keep last 10 tasks
  }

  /**
   * Execute a task with optimal model selection and fallback
   * @param {string} query - The task to execute
   * @param {Object} [dna] - Model DNA configuration (optional, uses default if not provided)
   * @returns {Promise<Object>} Execution result
   */
  async executeTask(query, dna) {
    console.log(`[TaskDispatcher] Starting task: "${query.substring(0, 50)}..."`);
    
    // Validate and use DNA - fallback to defaults if not available
    let modelDna = dna;
    if (!modelDna) {
      modelDna = loadModelDNA();
    }
    if (!modelDna) {
      console.warn(`[TaskDispatcher] No DNA found, using defaults`);
      modelDna = getDefaultDNA();
    }
    
    // Step 1: Classify task intent
    const classification = classifyTask(query);
    console.log(`[TaskDispatcher] Classified as: ${classification.category.id} (${classification.confidence} confidence)`);

    // Step 2: Get optimal model recommendation
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

    console.log(`[TaskDispatcher] Recommended model: ${recommendation.model?.key || recommendation.model?.id} (rating: ${recommendation.rating || 'N/A'})`);

    // Step 3: Load model if needed
    const loadResult = await lmStudioSwitcher.loadModel(recommendation.model?.key || recommendation.model?.id);
    
    if (!loadResult.loaded) {
      console.warn(`[TaskDispatcher] Primary model load failed: ${loadResult.error}`);
      
      // Fallback to next best model
      const fallback = await this.handleLoadFailure(recommendation, query, modelDna);
      if (fallback) {
        return fallback;
      }
      
      return { 
        success: false, 
        error: `Failed to load primary and all fallback models`,
        modelUsed: recommendation.model?.key || recommendation.model?.id,
        fallbackAttempted: true,
        classification
      };
    }

    // Step 4: Prepare context (max 8000 tokens)
    const context = this.prepareContextForModel(query, modelDna);
    
    // Validate context size
    const contextValidation = contextManager.validateContextSize(context);
    if (!contextValidation.valid) {
      console.warn(`[TaskDispatcher] Context overflow, truncating...`);
      const truncated = contextManager.truncateContext(context);
      contextValidation.truncated = truncated;
    }

    // Step 5: Build messages array
    const systemPrompt = contextManager.buildSystemPrompt(context, taskType);
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: query }
    ];

    // Step 6: Execute with selected model
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

    // Step 7: Record usage and ratings
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

  /**
   * Execute a task with streaming response
   * @param {string} query - The task to execute
   * @param {Object} options - Execution options
   * @param {Function} [options.onEvent] - Event callback
   * @param {Function} [options.onMessage] - Message callback for incremental content
   * @param {Object} [dna] - Model DNA configuration
   * @returns {Promise<Object>} Execution result
   */
  async executeStreamingTask(query, options = {}, dna) {
    console.log(`[TaskDispatcher] Starting streaming task: "${query.substring(0, 50)}..."`);
    
    // Validate and use DNA - fallback to defaults if not available
    let modelDna = dna;
    if (!modelDna) {
      modelDna = loadModelDNA();
    }
    if (!modelDna) {
      console.warn(`[TaskDispatcher] No DNA found for streaming task, using defaults`);
      modelDna = getDefaultDNA();
    }
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

    // Add any external event/message handlers
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
    
    // Try fallback models
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
   * @param {string} excludeModelId - Model to exclude
   * @param {number} attempt - Attempt number (0-based)
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
        query: query.substring(0, 500), // Limit current query in context
        timestamp: new Date().toISOString()
      },
      contextSizeLimit: contextManager.getTokenLimit()
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
      query: query.substring(0, 200), // Truncate long queries for history
      completed: true,
      timestamp: new Date().toISOString(),
      tokensUsed: result.usage?.total_tokens || 
                  (result.result?.usage?.total_tokens) || 0,
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
   * @returns {Object} State information
   */
  getState() {
    return {
      historyCount: this.contextHistory.length,
      maxHistory: this.maxHistory,
      contextLimit: contextManager.getTokenLimit()
    };
  }
}

// Export singleton instance
export const taskDispatcher = new TaskDispatcher();

// Export class for extension/customization
export { TaskDispatcher as default };

// Convenience function for simple task execution
/**
 * Quick execute a task with default configuration
 * @param {string} query - Task query
 * @returns {Promise<Object>} Execution result
 */
export async function executeTask(query) {
  return taskDispatcher.executeTask(query);
}

// Export streaming version
export async function executeStreamingTask(query, options) {
  return taskDispatcher.executeStreamingTask(query, options);
}