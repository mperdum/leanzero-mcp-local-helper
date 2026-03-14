/**
 * Custom Error Classes for MCP Model Switcher
 *
 * Provides specific error types for different failure modes in the system.
 * These errors can be caught and handled appropriately throughout the application.
 */

/**
 * Base error class for all custom errors
 */
export class MCPError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * DNA Not Initialized Error
 * Thrown when DNA is required but not initialized
 */
export class DNAUninitializedError extends MCPError {
  constructor(message = "Model DNA not initialized") {
    super(message, { errorType: "DNA_UNINITIALIZED" });
  }
}

/**
 * Model Load Failed Error
 * Thrown when a model fails to load from LM Studio
 */
export class ModelLoadFailedError extends MCPError {
  constructor(modelId, reason) {
    super(`Failed to load model "${modelId}": ${reason}`, {
      errorType: "MODEL_LOAD_FAILED",
      modelId,
      reason,
    });
  }
}

/**
 * Model Unload Failed Error
 * Thrown when a model fails to unload from LM Studio
 */
export class ModelUnloadFailedError extends MCPError {
  constructor(modelId, reason) {
    super(`Failed to unload model "${modelId}": ${reason}`, {
      errorType: "MODEL_UNLOAD_FAILED",
      modelId,
      reason,
    });
  }
}

/**
 * Invalid Parameter Error
 * Thrown when a required parameter is missing or invalid
 */
export class InvalidParameterError extends MCPError {
  constructor(paramName, reason) {
    super(`Invalid parameter "${paramName}": ${reason}`, {
      errorType: "INVALID_PARAMETER",
      paramName,
      reason,
    });
  }
}

/**
 * Rate Limit Exceeded Error
 * Thrown when a client exceeds the rate limit
 */
export class RateLimitExceededError extends MCPError {
  constructor(limit, windowMs) {
    super(`Rate limit exceeded. Maximum ${limit} requests per ${windowMs}ms`, {
      errorType: "RATE_LIMIT_EXCEEDED",
      limit,
      windowMs,
    });
  }
}

/**
 * Task Execution Error
 * Thrown when a task execution fails
 */
export class TaskExecutionError extends MCPError {
  constructor(query, reason) {
    super(`Task execution failed: ${reason}`, {
      errorType: "TASK_EXECUTION_FAILED",
      query,
      reason,
    });
  }
}

/**
 * Model Not Available Error
 * Thrown when a requested model is not available
 */
export class ModelNotAvailableError extends MCPError {
  constructor(modelId) {
    super(`Model "${modelId}" is not available`, {
      errorType: "MODEL_NOT_AVAILABLE",
      modelId,
    });
  }
}

/**
 * Evolution Failed Error
 * Thrown when DNA evolution fails
 */
export class EvolutionFailedError extends MCPError {
  constructor(reason) {
    super(`DNA evolution failed: ${reason}`, {
      errorType: "EVOLUTION_FAILED",
      reason,
    });
  }
}

/**
 * Memory Not Found Error
 * Thrown when trying to delete a non-existent memory
 */
export class MemoryNotFoundError extends MCPError {
  constructor(key) {
    super(`Memory "${key}" not found`, {
      errorType: "MEMORY_NOT_FOUND",
      key,
    });
  }
}