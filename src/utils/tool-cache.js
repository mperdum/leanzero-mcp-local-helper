/**
 * Tool Cache Utility
 *
 * Provides caching for tool results to improve performance.
 * Implements a simple cache with 30-second TTL and automatic cleanup.
 */

/**
 * Cache entry structure
 * @typedef {Object} CacheEntry
 * @property {any} data - Cached data
 * @property {number} timestamp - Timestamp when data was cached
 */

/**
 * Cache storage
 * @type {Map<string, CacheEntry>}
 */
const _cache = new Map();

/**
 * Cache TTL in milliseconds (30 seconds)
 */
const CACHE_TTL = 30000;

/**
 * Get cached data if available and not expired
 * @param {string} key - Cache key
 * @returns {any|null} Cached data or null if not found/expired
 */
export function getCached(key) {
  const entry = _cache.get(key);
  
  if (!entry) {
    return null;
  }
  
  // Check if cache entry has expired
  const now = Date.now();
  if (now - entry.timestamp > CACHE_TTL) {
    _cache.delete(key);
    return null;
  }
  
  return entry.data;
}

/**
 * Set cache entry
 * @param {string} key - Cache key
 * @param {any} data - Data to cache
 * @returns {void}
 */
export function setCache(key, data) {
  _cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

/**
 * Invalidate cache entry
 * @param {string} key - Cache key to invalidate
 * @returns {boolean} True if entry was deleted, false if not found
 */
export function invalidateCache(key) {
  return _cache.delete(key);
}

/**
 * Clear all cache entries
 * @returns {number} Number of entries cleared
 */
export function clearCache() {
  const size = _cache.size;
  _cache.clear();
  return size;
}

/**
 * Get cache statistics
 * @returns {Object} Cache statistics
 */
export function getCacheStats() {
  const now = Date.now();
  const entries = Array.from(_cache.entries());
  
  const validEntries = entries.filter(([_, entry]) => now - entry.timestamp <= CACHE_TTL);
  const expiredEntries = entries.filter(([_, entry]) => now - entry.timestamp > CACHE_TTL);
  
  return {
    totalEntries: entries.length,
    validEntries: validEntries.length,
    expiredEntries: expiredEntries.length,
    ttl: CACHE_TTL,
  };
}

/**
 * Get cache keys
 * @returns {string[]} Array of cache keys
 */
export function getCacheKeys() {
  return Array.from(_cache.keys());
}

/**
 * Preload cache with data
 * @param {Object} data - Object containing cache entries
 * @returns {void}
 */
export function preloadCache(data) {
  for (const [key, value] of Object.entries(data)) {
    setCache(key, value);
  }
}

/**
 * Create a cached function wrapper
 * @param {Function} fn - Function to cache
 * @param {string} cacheKeyPrefix - Prefix for cache keys
 * @param {number} [customTTL] - Custom TTL in milliseconds (overrides default)
 * @returns {Function} Cached function
 */
export function createCachedFunction(fn, cacheKeyPrefix, customTTL) {
  const ttl = customTTL || CACHE_TTL;
  
  return async (...args) => {
    // Generate cache key from arguments
    const cacheKey = `${cacheKeyPrefix}:${JSON.stringify(args)}`;
    
    // Try to get from cache first
    const cached = getCached(cacheKey);
    if (cached !== null) {
      return cached;
    }
    
    // Execute function and cache result
    const result = await fn(...args);
    setCache(cacheKey, result);
    
    return result;
  };
}

/**
 * Cache invalidation on file change
 * Used to invalidate cache when DNA files are modified
 * @param {string} filePath - Path to file that changed
 * @returns {void}
 */
export function invalidateOnFileChange(filePath) {
  // Invalidate all cache entries related to DNA
  const keys = getCacheKeys();
  const dnaRelatedKeys = keys.filter(key => 
    key.includes("dna") || 
    key.includes("model") ||
    key.includes("task")
  );
  
  dnaRelatedKeys.forEach(key => invalidateCache(key));
}