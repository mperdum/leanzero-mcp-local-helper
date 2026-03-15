/**
 * Load Tracker - LM Link Multi-Device Orchestrator
 * Tracks request timing and enforces concurrency limits per device
 */

import { deviceRegistry } from './device-registry.js';

/**
 * Type Definitions (for documentation)
 * @typedef {Object} LoadState
 * @property {string} deviceId - Device identifier
 * @property {string} modelKey - Model key being used
 * @property {number} activeRequests - Currently processing requests
 * @property {string|null} lastRequestStart - ISO timestamp of last request start
 * @property {string|null} lastRequestEnd - ISO timestamp of last request end
 * @property {string|null} cooldownUntil - ISO timestamp when device is available again
 * @property {number} totalRequestsToday - Total requests processed today
 */

/**
 * LoadTracker Class
 * Tracks request timing and enforces concurrency limits per device
 */
export class LoadTracker {
  constructor() {
    // Configuration from environment variables
    this.globalMaxParallelRequests = parseInt(process.env.MAX_PARALLEL_REQUESTS_GLOBAL || '4');
    this.defaultDeviceConcurrentLimit = parseInt(process.env.DEFAULT_DEVICE_CONCURRENT_LIMIT || '2');
    this.deviceCooldownMs = parseInt(process.env.DEVICE_COOLDOWN_MS || '1000');

    // Load state storage
    this.loadStates = new Map();

    // Request tracking per device/model combination
    this.requestTracking = new Map();
  }

  /**
   * Initialize the load tracker
   */
  async initialize() {
    console.log('[LoadTracker] Initializing...');
    
    // Subscribe to device status changes for cleanup
    const unsubscribe = deviceRegistry.onDeviceStatusChange((device, event) => {
      if (event === 'offline') {
        this._cleanupDevice(device.id);
      }
    });

    console.log('[LoadTracker] Initialized');
  }

  /**
   * Cleanup resources when a device goes offline
   * @param {string} deviceId - Device identifier
   */
  _cleanupDevice(deviceId) {
    // Remove load state for this device
    const statesToRemove = Array.from(this.loadStates.keys())
      .filter(key => key.startsWith(deviceId));
    
    for (const key of statesToRemove) {
      this.loadStates.delete(key);
    }

    console.log(`[LoadTracker] Cleaned up load tracking for device: ${deviceId}`);
  }

  /**
   * Record request start for load tracking
   * @param {string} deviceId - Device identifier
   * @param {string} modelKey - Model key being used
   */
  recordRequestStart(deviceId, modelKey) {
    const timestamp = new Date().toISOString();
    const stateKey = this._getStateKey(deviceId, modelKey);

    // Initialize or update load state
    if (!this.loadStates.has(stateKey)) {
      this.loadStates.set(stateKey, {
        deviceId,
        modelKey,
        activeRequests: 0,
        lastRequestStart: null,
        lastRequestEnd: null,
        cooldownUntil: null,
        totalRequestsToday: 0,
      });
    }

    const state = this.loadStates.get(stateKey);
    
    // Increment active requests
    state.activeRequests += 1;
    state.lastRequestStart = timestamp;

    console.log(`[LoadTracker] Request started: ${deviceId}/${modelKey} (active: ${state.activeRequests})`);

    return state;
  }

  /**
   * Record request completion
   * @param {string} deviceId - Device identifier
   * @param {string} modelKey - Model key being used
   * @param {boolean} success - Whether the request succeeded
   */
  recordRequestEnd(deviceId, modelKey, success) {
    const timestamp = new Date().toISOString();
    const stateKey = this._getStateKey(deviceId, modelKey);

    if (!this.loadStates.has(stateKey)) {
      return;
    }

    const state = this.loadStates.get(stateKey);
    
    // Decrement active requests
    state.activeRequests = Math.max(0, state.activeRequests - 1);
    state.lastRequestEnd = timestamp;

    // Set cooldown period
    if (this.deviceCooldownMs > 0) {
      const endTimestamp = new Date(timestamp).getTime();
      state.cooldownUntil = new Date(endTimestamp + this.deviceCooldownMs).toISOString();
    }

    // Increment daily counter
    state.totalRequestsToday += 1;

    console.log(`[LoadTracker] Request completed: ${deviceId}/${modelKey} (active: ${state.activeRequests}, success: ${success})`);

    return state;
  }

  /**
   * Check if a device can accept new requests
   * @param {string} deviceId - Device identifier
   * @param {string|null} modelKey - Model key (optional, for device-specific check)
   * @returns {{ allowed: boolean; reason?: string }} Check result
   */
  canAcceptRequest(deviceId, modelKey = null) {
    // If device doesn't exist in registry, we still allow the request
    // (device will be added when first request comes in)
    if (!deviceRegistry.isDeviceAvailable(deviceId)) {
      return { allowed: false, reason: 'Device offline' };
    }

    // Get concurrent limit for this device
    const deviceLimit = this._getDeviceConcurrentLimit(deviceId);
    const globalState = this.loadStates.get(this._getStateKey(deviceId, '*'));

    // Check global parallel limit if available
    if (globalState && globalState.activeRequests >= deviceLimit) {
      return { 
        allowed: false, 
        reason: `Max concurrent requests (${deviceLimit}) reached for device ${deviceId}` 
      };
    }

    // Check specific model state if provided
    if (modelKey) {
      const modelState = this.loadStates.get(this._getStateKey(deviceId, modelKey));
      
      if (modelState && modelState.activeRequests >= 1) {
        return { allowed: false, reason: 'Model currently processing another request' };
      }

      // Check cooldown
      if (modelState?.cooldownUntil) {
        const now = new Date().toISOString();
        const cooldownTime = new Date(modelState.cooldownUntil);
        const currentTime = new Date(now);
        
        // Block if still in cooldown period (coerce to timestamp for accurate comparison)
        if (cooldownTime.getTime() > currentTime.getTime()) {
          return { 
            allowed: false, 
            reason: `Device in cooldown until ${modelState.cooldownUntil}` 
          };
        }
      }
    }

    // Check global limits
    const totalActive = this._getTotalActiveRequests(deviceId);
    if (totalActive >= deviceLimit) {
      return { 
        allowed: false, 
        reason: `Global concurrent limit (${deviceLimit}) reached for device ${deviceId}` 
      };
    }

    return { allowed: true };
  }

  /**
   * Get current load state for a device
   * @param {string} deviceId - Device identifier
   * @returns {LoadState|null} Load state or null if not found
   */
  getDeviceLoadState(deviceId) {
    const states = [];
    
    // Collect all states for this device
    for (const [key, state] of this.loadStates.entries()) {
      if (state.deviceId === deviceId) {
        states.push(state);
      }
    }

    if (states.length === 0) {
      return null;
    }

    // Merge states for a summary
    const mergedState = {
      deviceId,
      modelKey: 'multiple',
      activeRequests: states.reduce((sum, s) => sum + s.activeRequests, 0),
      lastRequestStart: states.map(s => s.lastRequestStart).find(s => s !== null),
      lastRequestEnd: states.map(s => s.lastRequestEnd).find(s => s !== null),
      cooldownUntil: states.map(s => s.cooldownUntil).find(s => s !== null),
      totalRequestsToday: states.reduce((sum, s) => sum + s.totalRequestsToday, 0),
    };

    return mergedState;
  }

  /**
   * Get all devices with available capacity
   * @param {string[]|null} requiredCapabilities - Required model capabilities (optional)
   * @returns {Array<{ device: DeviceInfo; loadState: LoadState }>} Available devices
   */
  getAvailableDevices(requiredCapabilities = null) {
    const onlineDevices = deviceRegistry.getOnlineDevices();
    
    const available = [];

    for (const device of onlineDevices) {
      // Check capabilities if specified
      if (requiredCapabilities && device.capabilities.supportedModelTypes) {
        const hasRequiredCaps = requiredCapabilities.every(cap => 
          device.capabilities.supportedModelTypes.includes(cap)
        );
        
        if (!hasRequiredCaps) {
          continue;
        }
      }

      // Check load state
      const canAccept = this.canAcceptRequest(device.id);
      
      if (canAccept.allowed) {
        const loadState = this.getDeviceLoadState(device.id);
        available.push({ device, loadState });
      }
    }

    return available;
  }

  /**
   * Calculate load score for a device (0-1)
   * @param {string} deviceId - Device identifier
   * @returns {number} Load score (0 = idle, 1 = max capacity)
   */
  calculateLoadScore(deviceId) {
    const limit = this._getDeviceConcurrentLimit(deviceId);
    if (limit <= 0) return 1;

    const loadState = this.getDeviceLoadState(deviceId);
    const activeRequests = loadState ? loadState.activeRequests : 0;

    // Normalize to 0-1 range
    return Math.min(1, activeRequests / limit);
  }

  /**
   * Find the optimal device for a subtask based on load and capabilities
   * @param {Object} subtask - Subtask with requirements
   * @returns {{ deviceId: string; modelKey: string }|null} Optimal device or null
   */
  findOptimalDevice(subtask) {
    const availableDevices = this.getAvailableDevices(subtask.requiredCapabilities);
    
    if (availableDevices.length === 0) {
      return null;
    }

    // Score each device and pick the least loaded
    let bestDevice = null;
    let lowestLoadScore = Infinity;

    for (const { device, loadState } of availableDevices) {
      const loadScore = this.calculateLoadScore(device.id);
      
      // Also consider device tier for quality-of-service
      let tierBonus = 0;
      switch (device.hardwareProfile.tier) {
        case 'ultra': tierBonus = -0.3; break;
        case 'high': tierBonus = -0.2; break;
        case 'medium': tierBonus = -0.1; break;
        case 'low': tierBonus = 0; break;
      }

      const combinedScore = loadScore + tierBonus;

      if (combinedScore < lowestLoadScore) {
        lowestLoadScore = combinedScore;
        bestDevice = { deviceId: device.id, modelKey: subtask.assignedModelKey || null };
      }
    }

    return bestDevice;
  }

  /**
   * Get total active requests across all models for a device
   * @param {string} deviceId - Device identifier
   * @returns {number} Total active request count
   */
  _getTotalActiveRequests(deviceId) {
    let total = 0;
    const prefix = `${deviceId}:`;
    
    for (const [key, state] of this.loadStates.entries()) {
      if (key.startsWith(prefix)) {
        total += state.activeRequests;
      }
    }
    
    return total;
  }

  /**
   * Get concurrent limit for a device
   * @param {string} deviceId - Device identifier
   * @returns {number} Maximum concurrent requests allowed
   */
  _getDeviceConcurrentLimit(deviceId) {
    // For local device, use global limit
    if (deviceId === 'device-local') {
      return this.globalMaxParallelRequests;
    }
    
    return this.defaultDeviceConcurrentLimit;
  }

  /**
   * Add a device to the registry for testing
   * @param {string} deviceId - Device identifier
   */
  _addTestDevice(deviceId) {
    const device = {
      id: deviceId,
      status: 'online',
    };
    
    // This is a simple mock - in real usage, devices are discovered via LM Studio
    deviceRegistry.devices.set(deviceId, device);
  }

  /**
   * Generate state key for load tracking
   * @param {string} deviceId - Device identifier
   * @param {string} modelKey - Model key (use '*' for device-wide)
   * @returns {string} State key
   */
  _getStateKey(deviceId, modelKey) {
    return `${deviceId}:${modelKey}`;
  }

  /**
   * Get all load states
   * @returns {LoadState[]} Array of all load states
   */
  getAllLoadStates() {
    return Array.from(this.loadStates.values());
  }

  /**
   * Reset tracking (for testing)
   */
  reset() {
    this.loadStates.clear();
    this.requestTracking.clear();
    console.log('[LoadTracker] Tracking reset');
  }

  /**
   * Get statistics about load tracking
   * @returns {Object} Statistics object
   */
  getStats() {
    const totalActive = Array.from(this.loadStates.values())
      .reduce((sum, s) => sum + s.activeRequests, 0);

    return {
      totalLoadStates: this.loadStates.size,
      totalActiveRequests: totalActive,
      devicesTracked: new Set(
        Array.from(this.loadStates.values()).map(s => s.deviceId)
      ).size,
    };
  }

  /**
   * Shutdown the load tracker
   */
  shutdown() {
    this.loadStates.clear();
    console.log('[LoadTracker] Shut down');
  }
}

// Export singleton instance
export const loadTracker = new LoadTracker();

/**
 * Initialize load tracker on module load
 * @returns {Promise<LoadTracker>} Initialized tracker
 */
export async function initializeLoadTracker() {
  if (!loadTracker.loadStates || loadTracker.loadStates.size === 0) {
    await loadTracker.initialize();
  }
  return loadTracker;
}

// For testing: reset singleton state
export function resetLoadTracker() {
  loadTracker.shutdown();
}

// ============================================================================
// SWARM-Specific Methods
// ============================================================================

/**
 * Get devices available for lightweight model dispatch (SWARM research)
 * @param {Object} options - Options
 * @param {string[]} [options.lightweightModelIds] - IDs of lightweight models
 * @returns {Promise<Array<{ device: DeviceInfo, maxLightweightModels: number }>>} Available devices
 */
LoadTracker.prototype.getAvailableDevicesForSwarm = async function(options = {}) {
  const availableDevices = [];
  
  const onlineDevices = deviceRegistry.getOnlineDevices();
  
  // Import guardrails to check memory requirements
  let swarmGuardrails;
  try {
    const { getFreeMemoryGB, getMaxConcurrentLightweightModels } = await import('../utils/swarm-guardrails.js');
    const freeMemoryGB = await getFreeMemoryGB();
    
    if (freeMemoryGB < 8) {
      console.warn(`[LoadTracker] Insufficient memory for SWARM: ${freeMemoryGB}GB available`);
      return [];
    }
    
    const maxModelsPerDevice = await getMaxConcurrentLightweightModels();
    
    for (const device of onlineDevices) {
      // Check if device can accept lightweight models
      if (!deviceRegistry.canLoadModel(device.id, options.lightweightModelIds?.[0] || null)) {
        continue;
      }
      
      availableDevices.push({
        device,
        maxLightweightModels: Math.min(
          maxModelsPerDevice,
          Math.floor(freeMemoryGB / 5.6) // Estimate based on 5.6GB model size
        ),
      });
    }
  } catch (error) {
    console.warn(`[LoadTracker] SWARM device discovery failed: ${error.message}`);
    
    // Fallback to basic device discovery without guardrails
    for (const device of onlineDevices) {
      availableDevices.push({
        device,
        maxLightweightModels: 2, // Conservative default
      });
    }
  }
  
  return availableDevices;
};

/**
 * Check if a device can accept a SWARM lightweight model request
 * @param {string} deviceId - Device identifier
 * @returns {{ allowed: boolean, reason?: string }} Check result
 */
LoadTracker.prototype.canAcceptSwarmRequest = function(deviceId) {
  // Get device limit for swarm requests
  const deviceLimit = this._getDeviceConcurrentLimit(deviceId);
  
  // For now, allow 1 lightweight model per device for SWARM (conservative)
  const maxLightweightPerDevice = Math.min(2, deviceLimit);
  
  // Count current lightweight models on this device
  let activeLightweight = 0;
  for (const [key, state] of this.loadStates.entries()) {
    if (state.deviceId === deviceId && state.activeRequests > 0) {
      activeLightweight++;
    }
  }
  
  if (activeLightweight >= maxLightweightPerDevice) {
    return { 
      allowed: false, 
      reason: `Max lightweight models (${maxLightweightPerDevice}) already loaded on device ${deviceId}` 
    };
  }
  
  return { allowed: true, activeLightweight, maxLightweightPerDevice };
};

/**
 * Record start of a SWARM lightweight model request
 * @param {string} deviceId - Device identifier
 * @param {string} modelKey - Model key being loaded
 * @returns {Object} Updated load state
 */
LoadTracker.prototype.recordSwarmRequestStart = function(deviceId, modelKey) {
  return this.recordRequestStart(deviceId, modelKey);
};

/**
 * Record end of a SWARM lightweight model request
 * @param {string} deviceId - Device identifier
 * @param {string} modelKey - Model key that completed
 * @param {boolean} success - Whether the request succeeded
 * @returns {Object} Updated load state
 */
LoadTracker.prototype.recordSwarmRequestEnd = function(deviceId, modelKey, success) {
  return this.recordRequestEnd(deviceId, modelKey, success);
};

// Export helper functions for direct use
export const swarmLoadTracking = {
  getAvailableDevicesForSwarm,
  canAcceptSwarmRequest,
  recordSwarmRequestStart,
  recordSwarmRequestEnd,
};
