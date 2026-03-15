/**
 * Swarm Guardrails - Memory and load monitoring for SWARM orchestration
 * Prevents system instability when running multiple lightweight models concurrently
 */

import { hardwareDetector } from "./hardware-detector.js";
import { loadModelDNA, getMaxModelsPerDevice } from "./model-dna-manager.js";

// Internal tracking state
let _lightweightModelCount = 0;
let _deviceModelMap = new Map(); // deviceId -> modelKey mapping

/**
 * Get free system memory in GB
 * Uses Node.js os module for cross-platform detection
 * @returns {Promise<number>} Free memory in GB (rounded to 2 decimal places)
 */
export async function getFreeMemoryGB() {
  try {
    const os = await import("node:os");
    const totalMemBytes = os.totalmem();
    const freeMemBytes = os.freemem();
    
    const totalGB = totalMemBytes / (1024 * 1024 * 1024);
    const freeGB = freeMemBytes / (1024 * 1024 * 1024);
    
    return Math.round(freeGB * 100) / 100;
  } catch (error) {
    console.error(`[SwarmGuardrails] Failed to get free memory: ${error.message}`);
    return 0; // Safe default - assume minimal available
  }
}

/**
 * Check if system has sufficient free memory for SWARM operations
 * @param {number} minGB - Minimum required free memory in GB
 * @param {string|null} deviceId - Optional device ID (for logging)
 * @returns {{ allowed: boolean, freeMemoryGB: number, reason?: string }}
 */
export async function checkMemoryAvailable(minGB = 8, deviceId = null) {
  const freeMemoryGB = await getFreeMemoryGB();
  
  if (freeMemoryGB === 0) {
    console.warn(`[SwarmGuardrails] Could not detect free memory`);
    return { 
      allowed: false, 
      freeMemoryGB, 
      reason: "Could not determine available memory" 
    };
  }
  
  const headroom = freeMemoryGB - minGB;
  
  if (freeMemoryGB < minGB) {
    console.warn(`[SwarmGuardrails] Insufficient memory for ${deviceId || 'device'}: ${freeMemoryGB}GB < ${minGB}GB (need ${Math.round(headroom)}GB more)`);
    
    return { 
      allowed: false, 
      freeMemoryGB,
      reason: `Insufficient memory: ${freeMemoryGB.toFixed(1)}GB available, ${minGB}GB required`
    };
  }
  
  console.log(`[SwarmGuardrails] Memory check passed for ${deviceId || 'device'}: ${freeMemoryGB}GB available (need ${minGB}GB)`);
  
  return { 
    allowed: true, 
    freeMemoryGB,
    headroomGB: Math.round(headroom * 100) / 100
  };
}

/**
 * Get maximum concurrent lightweight models allowed based on DNA config and hardware
 * @param {string|null} deviceId - Optional specific device ID (null for default)
 * @returns {Promise<number>} Maximum number of concurrent lightweight models
 */
export async function getMaxConcurrentLightweightModels(deviceId = null) {
  const dna = loadModelDNA();
  
  // Check DNA configuration first
  if (dna?.orchestratorConfig?.swarm?.maxLightweightModelsPerDevice) {
    console.log(`[SwarmGuardrails] Using DNA-configured limit: ${dna.orchestratorConfig.swarm.maxLightweightModelsPerDevice}`);
    return dna.orchestratorConfig.swarm.maxLightweightModelsPerDevice;
  }
  
  // Fall back to hardware-based detection
  const ramGB = await hardwareDetector.detectTotalRAM();
  
  if (ramGB < 16) {
    console.log(`[SwarmGuardrails] Low RAM (<16GB): limiting to 2 concurrent lightweight models`);
    return 2;
  } else if (ramGB < 32) {
    console.log(`[SwarmGuardrails] Mid-range RAM (16-31GB): allowing 4 concurrent lightweight models`);
    return 4;
  } else {
    console.log(`[SwarmGuardrails] High-end RAM (>=32GB): allowing 8 concurrent lightweight models`);
    return 8;
  }
}

/**
 * Check if a device can accept a new lightweight model
 * Considers: memory availability, current load, DNA limits
 * @param {string} deviceId - Device ID to check
 * @param {string} modelKey - Model about to be loaded
 * @returns {{ allowed: boolean, reason?: string, currentCount?: number }}
 */
export async function canDispatchLightweightModel(deviceId, modelKey) {
  // Get DNA configuration
  const dna = loadModelDNA();
  
  // Check memory availability (5.6GB per lightweight model)
  const minMemoryForSwarm = 8; // At least 8GB free to start swarm operations
  const memoryCheck = await checkMemoryAvailable(minMemoryForSwarm, deviceId);
  
  if (!memoryCheck.allowed) {
    return { 
      allowed: false, 
      reason: `Memory not available: ${memoryCheck.reason}` 
    };
  }
  
  // Check concurrent lightweight model limit
  const maxModels = await getMaxConcurrentLightweightModels(deviceId);
  const currentCount = getConcurrentLightweightCount();
  
  if (currentCount >= maxModels) {
    console.warn(`[SwarmGuardrails] Concurrent lightweight models limit reached: ${currentCount}/${maxModels}`);
    
    return { 
      allowed: false, 
      reason: `Max concurrent lightweight models (${maxModels}) already active`,
      currentCount,
      maxModels
    };
  }
  
  // Check model-specific DNA limits
  const swarmConfig = dna?.orchestratorConfig?.swarm;
  if (swarmConfig?.lightweightModelIds && Array.isArray(swarmConfig.lightweightModelIds)) {
    const allowedModelIds = swarmConfig.lightweightModelIds.map(id => id.toLowerCase());
    
    if (!allowedModelIds.includes(modelKey.toLowerCase())) {
      console.warn(`[SwarmGuardrails] Model ${modelKey} not in allowed lightweight models list`);
      
      return { 
        allowed: false, 
        reason: `Model ${modelKey} is not configured as a lightweight model for SWARM` 
      };
    }
  }
  
  // Check per-device limits if configured
  const deviceLimits = dna?.orchestratorConfig?.perDeviceLimits?.[deviceId];
  if (deviceLimits) {
    const maxLightweightPerDevice = deviceLimits.maxConcurrent || maxModels;
    
    if (currentCount >= maxLightweightPerDevice) {
      console.warn(`[SwarmGuardrails] Device ${deviceId} has reached its limit: ${currentCount}/${maxLightweightPerDevice}`);
      
      return { 
        allowed: false, 
        reason: `Device limit reached (${currentCount}/${maxLightweightPerDevice})`,
        currentCount,
        maxModels: maxLightweightPerDevice
      };
    }
  }
  
  console.log(`[SwarmGuardrails] Device ${deviceId} can accept lightweight model ${modelKey}: ${currentCount}/${maxModels} active`);
  
  return { 
    allowed: true, 
    currentCount,
    maxModels
  };
}

/**
 * Get current count of loaded lightweight models in memory
 * @returns {number} Number of currently loaded lightweight models
 */
export function getConcurrentLightweightCount() {
  // Uses the internal tracking state instead of load-tracker for reliability
  return _lightweightModelCount;
}

/**
 * Set current count of loaded lightweight models (for initialization)
 * @param {number} count - The new count value
 */
export function setConcurrentLightweightCount(count) {
  _lightweightModelCount = Math.max(0, count);
}

/**
 * Increment lightweight model counter
 */
export function incrementLightweightModelCount() {
  _lightweightModelCount++;
  console.log(`[SwarmGuardrails] Lightweight model count incremented to ${_lightweightModelCount}`);
}

/**
 * Decrement lightweight model counter
 */
export function decrementLightweightModelCount() {
  _lightweightModelCount = Math.max(0, _lightweightModelCount - 1);
  console.log(`[SwarmGuardrails] Lightweight model count decremented to ${_lightweightModelCount}`);
}

/**
 * Get devices that can host lightweight models for SWARM
 * Filters based on memory availability and current load
 * @returns {Promise<Array<{ deviceId: string, freeMemoryGB: number }>>} Available devices
 */
export async function getAvailableLightweightDevices() {
  const dna = loadModelDNA();
  
  if (!dna?.orchestratorConfig?.enabled) {
    console.warn(`[SwarmGuardrails] Orchestrator is disabled`);
    return [];
  }
  
  // Import device registry to discover devices
  let devices = [];
  
  try {
    const { deviceRegistry } = await import("./../services/device-registry.js");
    
    if (deviceRegistry && typeof deviceRegistry.getAllDevices === "function") {
      devices = deviceRegistry.getAllDevices();
    }
  } catch (error) {
    console.warn(`[SwarmGuardrails] Could not load device registry: ${error.message}`);
    // Fall back to local device only
    devices = [{ id: "device-local", name: "Local Device" }];
  }
  
  const availableDevices = [];
  const maxModelsPerDevice = await getMaxConcurrentLightweightModels();
  
  for (const device of devices) {
    const deviceId = device.id || device.deviceId || "device-unknown";
    
    // Check memory availability
    const minMemoryGB = 8; // Conservative minimum for SWARM
    const memoryCheck = await checkMemoryAvailable(minMemoryGB, deviceId);
    
    if (!memoryCheck.allowed) {
      console.warn(`[SwarmGuardrails] Device ${deviceId} not suitable for SWARM: ${memoryCheck.reason}`);
      continue;
    }
    
    availableDevices.push({
      deviceId,
      deviceName: device.name || "Unknown Device",
      freeMemoryGB: memoryCheck.freeMemoryGB,
      headroomGB: memoryCheck.headroomGB || 0,
      canHostLightweightModel: true,
      maxLightweightModels: Math.min(
        await getMaxConcurrentLightweightModels(deviceId),
        Math.floor(memoryCheck.freeMemoryGB / 5.6) // Estimate based on model size
      ),
    });
  }
  
  console.log(`[SwarmGuardrails] Found ${availableDevices.length} devices suitable for lightweight model hosting`);
  
  return availableDevices;
}

/**
 * Record start of a SWARM request per device
 * Updates internal tracking state and loadTracker if available
 * @param {string} deviceId - Device ID where model is being loaded
 * @param {string} modelKey - Model being loaded
 * @returns {Promise<void>}
 */
export async function recordSwarmRequestStart(deviceId, modelKey) {
  console.log(`[SwarmGuardrails] Recording SWARM request start: ${modelKey} on ${deviceId}`);
  
  // Update internal tracking first (immediate)
  incrementLightweightModelCount();
  
  // Store device-model mapping
  _deviceModelMap.set(deviceId, modelKey);
  
  try {
    const { loadTracker } = await import("./../services/load-tracker.js");
    
    if (loadTracker && typeof loadTracker.recordRequestStart === "function") {
      // Record as a lightweight model request
      loadTracker.recordRequestStart(deviceId, modelKey, { isLightweightSwarm: true });
    }
  } catch (error) {
    console.warn(`[SwarmGuardrails] Could not update load tracker: ${error.message}`);
  }
}

/**
 * Record end of a SWARM request per device
 * Updates internal tracking state and loadTracker if available
 * @param {string} deviceId - Device ID where model finished
 * @param {string} modelKey - Model that completed
 * @param {boolean} success - Whether the request succeeded
 * @returns {Promise<void>}
 */
export async function recordSwarmRequestEnd(deviceId, modelKey, success) {
  console.log(`[SwarmGuardrails] Recording SWARM request end: ${modelKey} on ${deviceId}, success=${success}`);
  
  // Update internal tracking (decrement regardless of success)
  decrementLightweightModelCount();
  
  // Remove device-model mapping
  _deviceModelMap.delete(deviceId);
  
  try {
    const { loadTracker } = await import("./../services/load-tracker.js");
    
    if (loadTracker && typeof loadTracker.recordRequestEnd === "function") {
      loadTracker.recordRequestEnd(deviceId, modelKey, success);
    }
  } catch (error) {
    console.warn(`[SwarmGuardrails] Could not update load tracker: ${error.message}`);
  }
}

/**
 * Calculate estimated concurrency based on available memory
 * @param {number} freeMemoryGB - Available free memory in GB
 * @param {number} modelSizeGB - Size of each lightweight model in GB
 * @returns {number} Maximum concurrent models possible
 */
export function calculateConcurrencyByMemory(freeMemoryGB, modelSizeGB = 5.6) {
  // Conservative estimate: keep at least 2GB headroom for system operations
  const usableMemory = freeMemoryGB - 2;
  
  if (usableMemory <= 0) {
    return 0;
  }
  
  // Calculate how many models can fit with some breathing room (15% overhead)
  const maxModels = Math.floor(usableMemory / modelSizeGB * 0.85);
  
  return Math.max(0, maxModels);
}

/**
 * Validate SWARM orchestration request
 * Checks all guardrails before allowing the swarm to start
 * @param {Object} options - Request parameters
 * @param {string} options.query - The research query
 * @param {number} [options.numSubtasks=4] - Number of subtasks expected
 * @returns {Promise<{ allowed: boolean, reasons?: string[], estimatedConcurrency?: number }>}
 */
export async function validateSwarmRequest(options = {}) {
  const { query, numSubtasks = 4 } = options;
  
  const reasons = [];
  
  // Check memory availability (each subtask needs a model loaded)
  const minMemoryForSwarm = 8; // Conservative minimum
  const freeMemoryGB = await getFreeMemoryGB();
  
  if (freeMemoryGB < minMemoryForSwarm) {
    reasons.push(`Insufficient free memory: ${freeMemoryGB.toFixed(1)}GB available, ${minMemoryGB}GB required`);
  }
  
  // Estimate concurrency needed
  const maxModelsPerDevice = await getMaxConcurrentLightweightModels();
  const estimatedConcurrency = Math.min(numSubtasks, maxModelsPerDevice);
  
  // Check if request exceeds estimates
  if (numSubtasks > maxModelsPerDevice) {
    reasons.push(`Requested ${numSubtasks} subtasks exceeds maximum concurrent models (${maxModelsPerDevice})`);
  }
  
  // Check query length (prevent overly complex queries)
  const maxQueryLength = 2000;
  if (query.length > maxQueryLength) {
    console.warn(`[SwarmGuardrails] Query length ${query.length} exceeds recommended maximum ${maxQueryLength}`);
  }
  
  // Determine if request is allowed
  const allowed = reasons.length === 0 && freeMemoryGB >= minMemoryForSwarm;
  
  return {
    allowed,
    reasons,
    estimatedConcurrency: allowed ? estimatedConcurrency : 0,
    freeMemoryGB,
    maxConcurrentModels: maxModelsPerDevice,
  };
}

/**
 * Get guardrail configuration
 * @returns {Object} Current guardrail settings
 */
export function getGuardrailConfig() {
  const dna = loadModelDNA();
  
  return {
    minFreeMemoryGB: dna?.orchestratorConfig?.swarm?.minMemoryGB || 8,
    maxLightweightModelsPerDevice: dna?.orchestratorConfig?.swarm?.maxLightweightModelsPerDevice || 2,
    subtaskMaxTokens: dna?.orchestratorConfig?.swarm?.subtaskMaxTokens || 4000,
    finalAggregationMaxTokens: dna?.orchestratorConfig?.swarm?.finalAggregationMaxTokens || 8000,
    maxSubtasks: dna?.orchestratorConfig?.swarm?.maxSubtasks || 8,
    fallbackEnabled: dna?.orchestratorConfig?.swarm?.fallbackEnabled !== false, // Default to true
  };
}

/**
 * Clear any cached guardrail state
 */
export function clearGuardrailCache() {
  _lightweightModelCount = 0;
  _deviceModelMap.clear();
  console.log(`[SwarmGuardrails] Cache cleared`);
}