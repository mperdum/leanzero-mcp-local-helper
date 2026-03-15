/**
 * List Devices Tool Handler
 *
 * Lists all LM Link connected devices and their status.
 */

import { taskOrchestrator } from "../services/orchestrator.js";
import { loadTracker } from "../services/load-tracker.js";

// Import device registry for availability checks
import { deviceRegistry } from "../services/device-registry.js";

/**
 * Tool definition with Cline-optimized description
 */
export const listDevicesTool = {
  name: "list-devices",
  description:
    `[ROLE] You are a device status monitor for LM Link multi-device orchestration.\n\n` +
    `[CONTEXT] User needs to see which devices are available, their load status, and capabilities before orchestrating tasks.\n\n` +
    `[TASK] Retrieve comprehensive device information:\n` +
    "- List all discovered devices with their IDs and names\n" +
    "- Show device status (online/offline)\n" +
    "- Display current load state and concurrent request counts\n" +
    "- Show model capabilities per device (vision, tool use support)\n" +
    "- Indicate device tier (ultra/high/medium/low) for quality-of-service awareness\n\n" +
    `[CONSTRAINTS]\n` +
    "  - Device discovery happens automatically via LM Link/Tailscale\n" +
    "  - Check this before orchestrating tasks to select optimal devices\n" +
    "  - Devices in cooldown period are temporarily unavailable\n\n" +
    `[FORMAT] Returns JSON array of device objects with status, load state, and capabilities.`,
  inputSchema: {
    type: "object",
    properties: {
      includeLoadStats: {
        type: "boolean",
        default: true,
        description: "Include current load statistics for each device"
      },
      filterByCapability: {
        type: "string",
        enum: ["vision", "toolUse"],
        description: "Filter devices by specific capability"
      },
    },
  },
};

/**
 * Handle list-devices tool execution
 * @param {Object} params - Tool parameters with options
 * @returns {Promise<Object>} Device information
 */
export async function handleListDevices(params) {
  const { includeLoadStats = true, filterByCapability } = params;

  try {
    // Get all devices from registry
    const devices = taskOrchestrator.deviceRegistry.getAllDevices();
    
    const result = [];

    for (const device of devices) {
      const deviceInfo = {
        id: device.id,
        name: device.name || `Device-${device.id}`,
        status: deviceRegistry.isDeviceAvailable(device.id) ? "online" : "offline",
        tier: device.hardwareProfile?.tier || "unknown",
        capabilities: device.capabilities || {},
        models: [],
      };

      // Get models for this device
      const models = await taskOrchestrator.lmStudioSwitcher.getAvailableModels();
      
      if (Array.isArray(models)) {
        deviceInfo.models = models.filter(model => {
          // Extract device from model metadata
          let modelDeviceId;
          
          if (model.metadata?.tailscale_node_id) {
            modelDeviceId = 'device-' + String(model.metadata.tailscale_node_id).substring(0, 8);
          } else if (model.metadata?.device_info?.id) {
            modelDeviceId = 'device-' + String(model.metadata.device_info.id).substring(0, 8);
          } else {
            modelDeviceId = 'device-local';
          }

          return modelDeviceId === device.id;
        }).map(model => ({
          key: model.key,
          display_name: model.display_name,
          loaded: Array.isArray(model.loaded_instances) && model.loaded_instances.length > 0,
          context_length: model.context_length,
          size_gb: model.size_gb,
          capabilities: {
            vision: !!model.capabilities?.vision,
            tool_use: !!model.capabilities?.trained_for_tool_use,
          },
        }));
      }

      // Include load statistics
      if (includeLoadStats) {
        const loadState = loadTracker.getDeviceLoadState(device.id);
        
        deviceInfo.load = {
          activeRequests: loadState?.activeRequests || 0,
          totalToday: loadState?.totalRequestsToday || 0,
          cooldownUntil: loadState?.cooldownUntil || null,
        };
      }

      // Apply capability filter if specified
      if (filterByCapability && device.capabilities) {
        const supportedCaps = Array.isArray(device.capabilities.supportedModelTypes)
          ? device.capabilities.supportedModelTypes
          : [];
        
        const hasCapability = supportedCaps.includes(filterByCapability);
        
        if (!hasCapability) {
          continue; // Skip devices that don't have the required capability
        }
      }

      result.push(deviceInfo);
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          totalDevices: result.length,
          onlineDevices: result.filter(d => d.status === "online").length,
          offlineDevices: result.filter(d => d.status === "offline").length,
          devices: result,
        }, null, 2),
      }],
    };
  } catch (error) {
    console.error(`[ListDevices] Error: ${error.message}`);

    return {
      content: [{ type: "text", text: JSON.stringify({ error: error.message }, null, 2) }],
      isError: true,
    };
  }
}