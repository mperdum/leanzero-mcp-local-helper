/**
 * Rate Limiter Utility
 *
 * Provides rate limiting for tool requests to prevent abuse and ensure fair usage.
 * Tracks requests per client and enforces configurable limits.
 */

/**
 * Rate limit entry structure
 * @typedef {Object} RateLimitEntry
 * @property {number[]} timestamps - Array of request timestamps
 */

/**
 * Rate limit storage
 * @type {Map<string, RateLimitEntry>}
 */
const _rateLimits = new Map();

/**
 * Default rate limit configuration
 */
const DEFAULT_CONFIG = {
  windowMs: 60000, // 1 minute
  maxRequests: 10, // 10 requests per window
};

/**
 * Get rate limit entry for a client
 * @param {string} clientId - Client identifier
 * @returns {RateLimitEntry} Rate limit entry
 */
function getRateLimitEntry(clientId) {
  if (!_rateLimits.has(clientId)) {
    _rateLimits.set(clientId, {
      timestamps: [],
    });
  }
  return _rateLimits.get(clientId);
}

/**
 * Check if client is within rate limit
 * @param {string} clientId - Client identifier
 * @param {number} [windowMs] - Time window in milliseconds
 * @param {number} [maxRequests] - Maximum requests allowed
 * @returns {boolean} True if within limit, false if exceeded
 */
export function checkRateLimit(clientId, windowMs, maxRequests) {
  const config = {
    windowMs: windowMs || DEFAULT_CONFIG.windowMs,
    maxRequests: maxRequests || DEFAULT_CONFIG.maxRequests,
  };
  
  const entry = getRateLimitEntry(clientId);
  const now = Date.now();
  
  // Clean old timestamps outside the window
  entry.timestamps = entry.timestamps.filter(
    timestamp => now - timestamp < config.windowMs
  );
  
  // Check if limit exceeded
  if (entry.timestamps.length >= config.maxRequests) {
    return false;
  }
  
  // Add current timestamp
  entry.timestamps.push(now);
  
  return true;
}

/**
 * Get rate limit status for a client
 * @param {string} clientId - Client identifier
 * @returns {Object} Rate limit status
 */
export function getRateLimitStatus(clientId) {
  const entry = getRateLimitEntry(clientId);
  const now = Date.now();
  
  // Clean old timestamps
  entry.timestamps = entry.timestamps.filter(
    timestamp => now - timestamp < DEFAULT_CONFIG.windowMs
  );
  
  const remaining = Math.max(0, DEFAULT_CONFIG.maxRequests - entry.timestamps.length);
  const resetTime = entry.timestamps.length > 0 
    ? entry.timestamps[entry.timestamps.length - 1] + DEFAULT_CONFIG.windowMs
    : now + DEFAULT_CONFIG.windowMs;
  
  return {
    clientId,
    currentRequests: entry.timestamps.length,
    maxRequests: DEFAULT_CONFIG.maxRequests,
    remaining,
    resetTime,
    windowMs: DEFAULT_CONFIG.windowMs,
  };
}

/**
 * Reset rate limit for a client
 * @param {string} clientId - Client identifier
 * @returns {boolean} True if entry was deleted, false if not found
 */
export function resetRateLimit(clientId) {
  return _rateLimits.delete(clientId);
}

/**
 * Reset all rate limits
 * @returns {number} Number of rate limits reset
 */
export function resetAllRateLimits() {
  const size = _rateLimits.size;
  _rateLimits.clear();
  return size;
}

/**
 * Get rate limit statistics
 * @returns {Object} Rate limit statistics
 */
export function getRateLimitStats() {
  const now = Date.now();
  const entries = Array.from(_rateLimits.entries());
  
  const activeClients = entries.filter(([_, entry]) => {
    return entry.timestamps.some(
      timestamp => now - timestamp < DEFAULT_CONFIG.windowMs
    );
  });
  
  return {
    totalClients: entries.length,
    activeClients: activeClients.length,
    maxRequests: DEFAULT_CONFIG.maxRequests,
    windowMs: DEFAULT_CONFIG.windowMs,
  };
}

/**
 * Create a rate-limited function wrapper
 * @param {Function} fn - Function to rate limit
 * @param {string} [clientIdPrefix] - Prefix for client ID generation
 * @param {number} [windowMs] - Time window in milliseconds
 * @param {number} [maxRequests] - Maximum requests allowed
 * @returns {Function} Rate-limited function
 */
export function createRateLimitedFunction(fn, clientIdPrefix, windowMs, maxRequests) {
  return async (...args) => {
    // Generate client ID from arguments
    const clientId = clientIdPrefix 
      ? `${clientIdPrefix}:${JSON.stringify(args)}`
      : `${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
    
    // Check rate limit
    if (!checkRateLimit(clientId, windowMs, maxRequests)) {
      const status = getRateLimitStatus(clientId);
      throw new Error(`Rate limit exceeded. Maximum ${status.maxRequests} requests per ${status.windowMs}ms. Try again later.`);
    }
    
    // Execute function
    return await fn(...args);
  };
}

/**
 * Generate client ID from request headers
 * @param {Object} headers - Request headers
 * @returns {string} Client identifier
 */
export function generateClientIdFromHeaders(headers) {
  // Try to get client identifier from headers
  const xRequestId = headers["x-request-id"];
  const xForwardedFor = headers["x-forwarded-for"];
  const xRealIp = headers["x-real-ip"];
  
  if (xRequestId) {
    return `request:${xRequestId}`;
  }
  
  if (xForwardedFor) {
    return `ip:${xForwardedFor.split(",")[0].trim()}`;
  }
  
  if (xRealIp) {
    return `ip:${xRealIp}`;
  }
  
  // Fallback to timestamp + random
  return `anonymous:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
}