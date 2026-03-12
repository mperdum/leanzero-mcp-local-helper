/**
 * Context Manager - Conversation context preservation across model switches
 * Handles context extraction, truncation, and handoff with 8000 token limit
 */

/**
 * ContextManager class for managing conversation context
 */
export class ContextManager {
  /**
   * Create a new ContextManager
   */
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
    const truncationMarker = "...";
    
    if (content.length <= charLimit) {
      return content;
    }

    // Reserve space for truncation marker
    const reservedSpace = truncationMarker.length;
    const effectiveLimit = charLimit - reservedSpace;
    
    // Try to truncate at sentence boundary
    const truncated = content.slice(0, effectiveLimit);
    const lastPeriod = truncated.lastIndexOf(".");
    const lastQuestion = truncated.lastIndexOf("?");
    const lastExclamation = truncated.lastIndexOf("!");
    
    // Find best sentence boundary
    const boundary = Math.max(lastPeriod, lastQuestion, lastExclamation);
    
    if (boundary > effectiveLimit * 0.5) { // At least 50% of content kept
      return truncated.slice(0, boundary + 1);
    }

    // No good sentence boundary - truncate at word boundary
    const lastSpace = truncated.lastIndexOf(" ");
    if (lastSpace > effectiveLimit * 0.8) {
      return truncated.slice(0, lastSpace) + truncationMarker;
    }

    return truncated + truncationMarker;
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
      // Keep first half of array elements, truncating strings within
      const halfLength = Math.max(1, Math.floor(value.length / 2));
      return value.slice(0, halfLength).map(item => 
        typeof item === "object" && item !== null ? this.deepTruncate(item, maxTokens / 2) : 
        typeof item === "string" ? this.truncateContent(item, maxTokens / 2) : 
        item
      );
    }

    if (value && typeof value === "object") {
      // Keep half of object properties, truncating string values
      const entries = Object.entries(value);
      const keepCount = Math.max(1, Math.floor(entries.length / 2));
      
      return Object.fromEntries(
        entries.slice(0, keepCount).map(([k, v]) => 
          [k, typeof v === "string" ? this.truncateContent(v, maxTokens / 2) :
                typeof v === "object" && v !== null ? this.deepTruncate(v, maxTokens / 2) : 
                v]
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

  /**
   * Set custom token limit
   * @param {number} tokens - New token limit
   */
  setTokenLimit(tokens) {
    this.maxContextTokens = tokens;
    console.log(`[Context] Token limit set to ${tokens}`);
  }

  /**
   * Get current token limit
   * @returns {number} Current token limit
   */
  getTokenLimit() {
    return this.maxContextTokens;
  }
}

// Export singleton instance
export const contextManager = new ContextManager();

// Export class for extension/customization
export { ContextManager as default };