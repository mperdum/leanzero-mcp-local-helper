/**
 * Device Registry - LM Link Multi-Device Orchestrator
 * Discovers and tracks all LM Studio devices connected via LM Link
 */

// Import dependencies
import { lmStudioSwitcher } from "./lm-studio-switcher.js";
import os from "node:os";

/**
 * Type Definitions (for documentation)
 * @typedef {Object} DeviceInfo
 * @property {string} id - Unique device identifier (Tailscale node ID or hostname)
 * @property {string} name - Human-readable device name
 * @property {string} address - Tailscale IP address or localhost for primary
 * @property {'online' | 'offline' | 'degraded'} status - Device availability status
 * @property {Object} hardwareProfile - Device hardware specifications
 * @property {number} hardwareProfile.ramGB - RAM in GB
 * @property {number} hardwareProfile.cpuCores - Number of CPU cores
 * @property {boolean} hardwareProfile.gpuAvailable - Whether GPU is available
 * @property {'low' | 'medium' | 'high' | 'ultra'} hardwareProfile.tier - Performance tier
 * @property {Object} capabilities - Device model capabilities
 * @property {number} capabilities.maxConcurrentRequests - Max concurrent requests allowed
 * @property {string[]} capabilities.supportedModelTypes - Supported model types (e.g., ['llm', 'vlm'])
 * @property {number} capabilities.maxContextLength - Maximum context length supported
 * @property {string} lastSeen - ISO timestamp of last health check
 */

/**
 * DeviceRegistry Class
 * Manages discovery and tracking of all LM Link connected devices
 */
export class DeviceRegistry {
  constructor() {
    // Configuration from environment variables
    this.lmStudioBaseUrl = process.env.LM_STUDIO_URL || 'http://localhost:1234';
    this.discoveryIntervalMs = parseInt(process.env.DEVICE_DISCOVERY_INTERVAL_MS || '30000');
    this.globalMaxParallelRequests = parseInt(process.env.MAX_PARALLEL_REQUESTS_GLOBAL || '4');
    this.defaultDeviceConcurrentLimit = parseInt(process.env.DEFAULT_DEVICE_CONCURRENT_LIMIT || '2');
    this.deviceCooldownMs = parseInt(process.env.DEVICE_COOLDOWN_MS || '1000');
    this.remoteTimeoutMs = parseInt(process.env.REMOTE_DEVICE_TIMEOUT_MS || '60000');

    // Device storage - Map of deviceId -> DeviceInfo
    this.devices = new Map();

    // Discovery state
    this.discoveryInterval = null;
    this.isInitialized = false;

    // Status change listeners
    this.statusListeners = new Set();
    
    // Mockable models provider (for testing)
    this._getModelsFn = lmStudioSwitcher.getAvailableModels.bind(lmStudioSwitcher);
  }

  /**
   * Initialize device discovery
   */
  async initialize() {
    console.log('[DeviceRegistry] Initializing...');

    // Perform initial device discovery
    await this.discoverDevices();

    // Start periodic discovery loop
    this._startDiscoveryLoop();

    this.isInitialized = true;
    console.log('[DeviceRegistry] Initialized with', this.devices.size, 'devices');
  }
  
  /**
   * Set custom models provider (for testing)
   * @param {Function} fn - Async function that returns array of models
   */
  setModelsProvider(fn) {
    this._getModelsFn = fn;
  }

  /**
   * Stop device discovery and cleanup
   */
  shutdown() {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }
    this.isInitialized = false;
    this.devices.clear();
    this.statusListeners.clear();
    console.log('[DeviceRegistry] Shut down');
  }

  /**
   * Initialize default device for local LM Studio instance
   */
  _initDefaultDevice() {
    // Default localhost device (primary orchestrator)
    const defaultDevice = {
      id: 'device-local',
      name: 'Primary Device (Local)',
      address: '127.0.0.1',
      status: 'online',
      hardwareProfile: this._detectHardware(),
      capabilities: {
        maxConcurrentRequests: this.globalMaxParallelRequests,
        supportedModelTypes: ['llm', 'vlm'],
        maxContextLength: 32768,
      },
      lastSeen: new Date().toISOString(),
    };

    this.devices.set(defaultDevice.id, defaultDevice);
  }

  /**
   * Detect local hardware specifications
   * @returns {Object} Hardware profile object
   */
  _detectHardware() {
    // Fallback values if hardware detection fails
    const fallbackProfile = {
      ramGB: 16,
      cpuCores: 4,
      gpuAvailable: false,
      tier: 'medium',
    };

    try {
      // Use Node.js os module for basic hardware info
      const cpus = os.cpus();
      const totalMemoryGB = Math.round(os.totalmem() / (1024 * 1024 * 1024));

      // Determine tier based on RAM and CPU cores
      let tier = 'low';
      if (totalMemoryGB >= 256) tier = 'ultra';
      else if (totalMemoryGB >= 128) tier = 'high';
      else if (totalMemoryGB >= 32) tier = 'medium';

      return {
        ramGB: totalMemoryGB,
        cpuCores: cpus.length,
        gpuAvailable: this._hasGPU(),
        tier,
      };
    } catch (error) {
      console.warn('[DeviceRegistry] Failed to detect hardware:', error.message);
      return fallbackProfile;
    }
  }

  /**
   * Detect if GPU is available
   * @returns {boolean} True if GPU detected
   */
  _hasGPU() {
    // In a real implementation, we might check CUDA or other GPU APIs
    // For now, we'll return false and let it be configured
    return false;
  }

  /**
   * Start periodic device discovery loop
   */
  _startDiscoveryLoop() {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
    }

    this.discoveryInterval = setInterval(async () => {
      try {
        await this.discoverDevices();
      } catch (error) {
        console.warn('[DeviceRegistry] Discovery failed:', error.message);
      }
    }, this.discoveryIntervalMs);

    console.log('[DeviceRegistry] Discovery loop started (interval: ' + this.discoveryIntervalMs + 'ms)');
  }

  /**
   * Discover all connected devices through LM Studio API
   * Parses device information from /api/v1/models response
   * @returns {Promise<DeviceInfo[]>} List of discovered devices
   */
  async discoverDevices() {
    try {
      // Get models to parse device info (use mockable function for testing)
      const models = await this._getModelsFn();

      if (!Array.isArray(models) || models.length === 0) {
        console.warn('[DeviceRegistry] No models found - device list may be incomplete');
        return [];
      }

      // Track discovered devices
      const discoveredDevices = new Map();
      const localDeviceId = 'device-local';

      for (const model of models) {
        // Extract device info from model metadata
        const deviceId = this._extractDeviceId(model);
        const isRemote = deviceId !== localDeviceId;

        if (!discoveredDevices.has(deviceId)) {
          // Create new device entry
          discoveredDevices.set(deviceId, {
            id: deviceId,
            name: this._generateDeviceName(deviceId, model),
            address: isRemote ? this._getDeviceAddress(deviceId) : '127.0.0.1',
            status: 'online',
            hardwareProfile: this._detectHardware(), // Simplified - would be better from actual device
            capabilities: {
              maxConcurrentRequests: this._getMaxConcurrentForDevice(deviceId),
              supportedModelTypes: this._extractSupportedTypes(model),
              maxContextLength: model.context_length || 32768,
            },
            lastSeen: new Date().toISOString(),
          });
        }

        // Update existing device with model information
        const device = discoveredDevices.get(deviceId);
        if (device) {
          device.lastSeen = new Date().toISOString();
        }
      }

      // Update internal registry and notify listeners
      this._updateDevices(discoveredDevices);

      return Array.from(discoveredDevices.values());

    } catch (error) {
      console.error('[DeviceRegistry] Device discovery failed:', error.message);
      throw error;
    }
  }

  /**
   * Extract device ID from model metadata
   * @param {Object} model - Model object from LM Studio API
   * @returns {string} Device identifier
   */
  _extractDeviceId(model) {
    // Check for Tailscale node ID in model metadata
    if (model.metadata?.tailscale_node_id) {
      return 'device-' + model.metadata.tailscale_node_id.substring(0, 8);
    }

    // Check for device info in model name or metadata
    if (model.metadata?.device_info?.id) {
      return 'device-' + String(model.metadata.device_info.id).substring(0, 8);
    }

    // Default to local device
    return 'device-local';
  }

  /**
   * Generate human-readable device name
   * @param {string} deviceId - Device identifier
   * @param {Object} model - Model object for context
   * @returns {string} Human-readable device name
   */
  _generateDeviceName(deviceId, model) {
    if (deviceId === 'device-local') {
      return 'Primary Device (Local)';
    }

    // Try to extract hostname from model metadata
    if (model.metadata?.hostname) {
      return 'Remote: ' + model.metadata.hostname;
    }

    return 'Remote Device (' + deviceId.slice(-8) + ')';
  }

  /**
   * Get device IP address
   * @param {string} deviceId - Device identifier
   * @returns {string} IP address or hostname
   */
  _getDeviceAddress(deviceId) {
    // For devices without explicit Tailscale IPs, we'll use the local API for now
    // In production, this would query a device registry or parse from LM Link config
    if (deviceId === 'device-local') {
      return '127.0.0.1';
    }
    // Placeholder - would be populated from actual network discovery
    return 'remote-device.example.com';
  }

  /**
   * Get max concurrent requests for a device
   * @param {string} deviceId - Device identifier
   * @returns {number} Maximum concurrent requests allowed
   */
  _getMaxConcurrentForDevice(deviceId) {
    // If this is the local device, use global limit
    if (deviceId === 'device-local') {
      return this.globalMaxParallelRequests;
    }
    return this.defaultDeviceConcurrentLimit;
  }

  /**
   * Extract supported model types from model metadata
   * @param {Object} model - Model object
   * @returns {string[]} Array of supported model types
   */
  _extractSupportedTypes(model) {
    const types = ['llm'];
    
    // Check for vision capability
    if (model.capabilities?.vision || model.metadata?.supports_vision) {
      types.push('vlm');
    }
    
    return types;
  }

  /**
   * Update internal device registry
   * @param {Map<string, DeviceInfo>} newDevices - New devices to merge
   */
  _updateDevices(newDevices) {
    // Track status changes for notifications
    const statusChanges = [];

    // Merge updates with existing devices
    for (const [deviceId, newDevice] of newDevices) {
      const existingDevice = this.devices.get(deviceId);

      if (!existingDevice) {
        // New device discovered
        this.devices.set(deviceId, { ...newDevice });
        statusChanges.push({ device: newDevice, event: 'online' });
        console.log('[DeviceRegistry] Device discovered:', newDevice.name);
      } else {
        // Update existing device
        const previousStatus = existingDevice.status;
        
        // Update fields while preserving instance properties
        this.devices.set(deviceId, {
          ...existingDevice,
          status: newDevice.status,
          lastSeen: newDevice.lastSeen,
          capabilities: { ...newDevice.capabilities },
        });

        // Check for status change
        if (previousStatus !== existingDevice.status) {
          statusChanges.push({ device: existingDevice, event: existingDevice.status });
        }
      }
    }

    // Notify listeners of status changes
    for (const { device, event } of statusChanges) {
      this._notifyStatusChange(device, event);
    }
  }

  /**
   * Notify listeners of device status change
   * @param {DeviceInfo} device - Updated device info
   * @param {'online' | 'offline'} event - Status change event type
   */
  _notifyStatusChange(device, event) {
    for (const listener of this.statusListeners) {
      try {
        listener(device, event);
      } catch (error) {
        console.error('[DeviceRegistry] Status listener error:', error.message);
      }
    }
  }

  /**
   * Get specific device info
   * @param {string} deviceId - Device identifier
   * @returns {DeviceInfo|null} Device information or null if not found
   */
  getDevice(deviceId) {
    return this.devices.get(deviceId) || null;
  }

  /**
   * Check if a device is available for new requests
   * @param {string} deviceId - Device identifier
   * @returns {boolean} True if device is online and available
   */
  isDeviceAvailable(deviceId) {
    const device = this.devices.get(deviceId);
    return device !== undefined && device.status === 'online';
  }

  /**
   * Get all online devices
   * @returns {DeviceInfo[]} Array of online devices
   */
  getOnlineDevices() {
    return Array.from(this.devices.values()).filter(d => d.status === 'online');
  }

  /**
   * Subscribe to device status changes
   * @param {Function} callback - Callback function(device, event)
   * @returns {Function} Unsubscribe function
   */
  onDeviceStatusChange(callback) {
    this.statusListeners.add(callback);
    
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  /**
   * Perform health check for a specific device
   * @param {string} deviceId - Device identifier
   * @returns {Promise<Object>} Health status with latency
   */
  async healthCheck(deviceId) {
    const device = this.devices.get(deviceId);

    if (!device || device.status !== 'online') {
      return { healthy: false, latencyMs: null };
    }

    const startTime = Date.now();

    try {
      // For local device, check API connection
      if (deviceId === 'device-local') {
        const connected = await lmStudioSwitcher.checkConnection();
        const latency = Date.now() - startTime;

        return {
          healthy: connected,
          latencyMs: connected ? latency : null,
        };
      }

      // For remote devices, attempt basic connectivity check
      // In production, this would ping the actual device endpoint
      // For now, we assume remote devices are reachable if online
      const latency = Date.now() - startTime;

      return {
        healthy: true,
        latencyMs: latency,
      };

    } catch (error) {
      console.error('[DeviceRegistry] Health check failed for', deviceId, ':', error.message);
      
      // Mark device as degraded on failure
      if (device) {
        this.devices.set(deviceId, { ...device, status: 'degraded' });
        this._notifyStatusChange(device, 'offline');
      }

      return { healthy: false, latencyMs: null };
    }
  }

  /**
   * Get all devices with their current state
   * @returns {DeviceInfo[]} Array of all devices
   */
  getAllDevices() {
    return Array.from(this.devices.values());
  }

  /**
   * Force immediate rediscovery (manual trigger)
   * @returns {Promise<DeviceInfo[]>} Updated device list
   */
  async forceDiscover() {
    console.log('[DeviceRegistry] Force discovery triggered');
    return await this.discoverDevices();
  }

  /**
   * Get statistics about registered devices
   * @returns {Object} Device statistics
   */
  getStats() {
    const devices = Array.from(this.devices.values());
    
    return {
      totalDevices: devices.length,
      onlineDevices: devices.filter(d => d.status === 'online').length,
      degradedDevices: devices.filter(d => d.status === 'degraded').length,
      offlineDevices: devices.filter(d => d.status === 'offline').length,
      tiers: {
        low: devices.filter(d => d.hardwareProfile.tier === 'low').length,
        medium: devices.filter(d => d.hardwareProfile.tier === 'medium').length,
        high: devices.filter(d => d.hardwareProfile.tier === 'high').length,
        ultra: devices.filter(d => d.hardwareProfile.tier === 'ultra').length,
      },
    };
  }
}

// Export singleton instance
export const deviceRegistry = new DeviceRegistry();

/**
 * Initialize device registry on module load
 * @returns {Promise<DeviceRegistry>} Initialized registry
 */
export async function initializeDeviceRegistry() {
  if (!deviceRegistry.isInitialized) {
    await deviceRegistry.initialize();
  }
  return deviceRegistry;
}

// For testing: reset singleton state
export function resetDeviceRegistry() {
  deviceRegistry.shutdown();
}