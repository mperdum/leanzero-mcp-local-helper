/**
 * Error Handler Utility
 *
 * Provides standardized error response formatting for all MCP tools.
 * Ensures consistent error structure across the application.
 */

import { DNAUninitializedError, InvalidParameterError, ModelLoadFailedError, ModelUnloadFailedError, TaskExecutionError } from "./errors.js";

/**
 * Standardized error response format
 * @param {string} message - Error message
 * @param {Object} details - Additional error details
 * @param {string} suggestion - Optional suggestion for fixing the error
 * @returns {Object} Standardized error response
 */
export function createErrorResponse(message, details = {}, suggestion = null) {
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        error: message,
        details,
        ...(suggestion && { suggestion }),
      }, null, 2),
    }],
    isError: true,
  };
}

/**
 * Create error response for invalid parameters
 * @param {string} paramName - Name of the invalid parameter
 * @param {string} reason - Reason why the parameter is invalid
 * @param {string} suggestion - Optional suggestion
 * @returns {Object} Standardized error response
 */
export function createInvalidParameterError(paramName, reason, suggestion = null) {
  const error = new InvalidParameterError(paramName, reason);
  return createErrorResponse(error.message, error.details, suggestion);
}

/**
 * Create error response for DNA not initialized
 * @param {string} suggestion - Optional suggestion
 * @returns {Object} Standardized error response
 */
export function createDNAUninitializedError(suggestion = null) {
  const error = new DNAUninitializedError();
  return createErrorResponse(error.message, error.details, suggestion);
}

/**
 * Create error response for model load failure
 * @param {string} modelId - Model ID that failed to load
 * @param {string} reason - Reason for failure
 * @returns {Object} Standardized error response
 */
export function createModelLoadError(modelId, reason) {
  const error = new ModelLoadFailedError(modelId, reason);
  return createErrorResponse(error.message, error.details);
}

/**
 * Create error response for model unload failure
 * @param {string} modelId - Model ID that failed to unload
 * @param {string} reason - Reason for failure
 * @returns {Object} Standardized error response
 */
export function createModelUnloadError(modelId, reason) {
  const error = new ModelUnloadFailedError(modelId, reason);
  return createErrorResponse(error.message, error.details);
}

/**
 * Create error response for task execution failure
 * @param {string} query - Task query that failed
 * @param {string} reason - Reason for failure
 * @returns {Object} Standardized error response
 */
export function createTaskExecutionError(query, reason) {
  const error = new TaskExecutionError(query, reason);
  return createErrorResponse(error.message, error.details);
}

/**
 * Create error response for generic errors
 * @param {Error} error - Error object
 * @param {string} context - Context where the error occurred
 * @returns {Object} Standardized error response
 */
export function createGenericError(error, context = "") {
  const message = context ? `${context}: ${error.message}` : error.message;
  return createErrorResponse(message, {
    errorType: error.name,
    stack: error.stack?.split("\n").slice(0, 3).join("\n"), // Limit stack trace
  });
}

/**
 * Wrap async function with error handling
 * @param {Function} fn - Async function to wrap
 * @param {string} context - Context for error messages
 * @returns {Function} Wrapped async function
 */
export function withErrorHandling(fn, context = "") {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      console.error(`[${context}] Error:`, error);
      return createGenericError(error, context);
    }
  };
}