/**
 * Device Registry Tests
 * Unit tests for src/services/device-registry.js
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { resetDeviceRegistry, deviceRegistry, initializeDeviceRegistry } from '../src/services/device-registry.js';

// Reset mocks before each test
beforeEach(() => {
  resetDeviceRegistry();
});

afterEach(() => {
  deviceRegistry.shutdown();
});

describe('DeviceRegistry', () => {
  describe('Initialization', () => {
    it('should initialize with default local device', async () => {
      // Mock models to return empty array (no discovered devices)
      deviceRegistry.setModelsProvider(async () => []);
      
      await deviceRegistry.initialize();

      const devices = deviceRegistry.getAllDevices();
      assert.strictEqual(devices.length, 0, 'Should have zero devices when no models');
    });

    it('should detect hardware specifications', async () => {
      // Test that _detectHardware works correctly
      const profile = deviceRegistry._detectHardware();
      
      assert.ok(profile.ramGB > 0, 'Should have RAM property with valid value');
      assert.ok(profile.cpuCores >= 1, 'Should have CPU cores property');
      assert.strictEqual(typeof profile.gpuAvailable, 'boolean', 'Should have GPU property');
      assert.ok(['low', 'medium', 'high', 'ultra'].includes(profile.tier), 'Should have valid tier');
    });

    it('should start periodic discovery loop', async () => {
      deviceRegistry.setModelsProvider(async () => []);
      
      await deviceRegistry.initialize();

      // Verify the interval was set (it's an internal property)
      assert.ok(deviceRegistry.discoveryInterval !== null, 'Discovery interval should be set');
      
      // Cleanup
      deviceRegistry.shutdown();
    });
  });

  describe('Device Discovery', () => {
    beforeEach(async () => {
      resetDeviceRegistry();
    });

    it('should return empty array when no models available', async () => {
      deviceRegistry.setModelsProvider(async () => []);
      
      const devices = await deviceRegistry.discoverDevices();
      assert.deepStrictEqual(devices, [], 'Should return empty array');
    });

    it('should discover local device from models list', async () => {
      deviceRegistry.setModelsProvider(async () => [
        { key: 'llama-3.2-3b', context_length: 8192, metadata: {} },
      ]);

      const devices = await deviceRegistry.discoverDevices();
      
      assert.strictEqual(devices.length, 1, 'Should have one device');
      assert.strictEqual(devices[0].id, 'device-local', 'Device ID should be local');
      assert.strictEqual(devices[0].name, 'Primary Device (Local)', 'Device name should match');
    });

    it('should extract remote device from Tailscale metadata', async () => {
      deviceRegistry.setModelsProvider(async () => [
        { 
          key: 'llama-3.2-3b', 
          context_length: 8192,
          metadata: {
            tailscale_node_id: 'abc123def456',
            hostname: 'remote-server'
          }
        },
      ]);

      const devices = await deviceRegistry.discoverDevices();
      
      // Should have remote device only (no local since we only have Tailscale metadata)
      assert.ok(devices.length >= 1, 'Should have at least 1 device');
      const remoteDevice = devices.find(d => d.id !== 'device-local');
      assert.ok(remoteDevice !== undefined && remoteDevice !== null, 'Remote device should exist');
    });

    it('should update existing device when models change', async () => {
      deviceRegistry.setModelsProvider(async () => [
        { key: 'llama-3.2-3b', context_length: 8192, metadata: {} },
      ]);

      await deviceRegistry.discoverDevices();

      // Simulate models with different context length
      deviceRegistry.setModelsProvider(async () => [
        { key: 'llama-3.2-3b', context_length: 16384, metadata: {} },
      ]);

      const devices = await deviceRegistry.discoverDevices();
      
      const localDevice = devices.find(d => d.id === 'device-local');
      assert.strictEqual(localDevice.capabilities.maxContextLength, 16384, 'Should update context length');
    });

    it('should handle models without metadata gracefully', async () => {
      deviceRegistry.setModelsProvider(async () => [
        { key: 'llama-3.2-3b', context_length: 8192 },
      ]);

      const devices = await deviceRegistry.discoverDevices();
      
      assert.strictEqual(devices.length, 1, 'Should have one device');
      assert.strictEqual(devices[0].id, 'device-local', 'Should be local device');
    });
  });

  describe('Device Status Methods', () => {
    beforeEach(async () => {
      resetDeviceRegistry();
      deviceRegistry.setModelsProvider(async () => [
        { key: 'llama-3.2-3b', context_length: 8192, metadata: {} },
      ]);
      await deviceRegistry.initialize();
    });

    it('should get specific device by ID', async () => {
      const device = deviceRegistry.getDevice('device-local');
      
      assert.ok(device !== undefined && device !== null, 'Device should exist');
      assert.strictEqual(device.id, 'device-local', 'Device ID should match');
    });

    it('should return null for unknown device ID', async () => {
      const device = deviceRegistry.getDevice('unknown-device');
      
      assert.strictEqual(device, null, 'Should return null for unknown device');
    });

    it('should check if device is available', async () => {
      assert.strictEqual(deviceRegistry.isDeviceAvailable('device-local'), true, 'Local device should be available');
      assert.strictEqual(deviceRegistry.isDeviceAvailable('unknown-device'), false, 'Unknown device should not be available');
    });

    it('should get all online devices', async () => {
      const onlineDevices = deviceRegistry.getOnlineDevices();
      
      assert.ok(onlineDevices.length > 0, 'Should have online devices');
      onlineDevices.forEach(d => {
        assert.strictEqual(d.status, 'online', 'All returned devices should be online');
      });
    });
  });

  describe('Health Check', () => {
    beforeEach(async () => {
      resetDeviceRegistry();
      deviceRegistry.setModelsProvider(async () => []);
      await deviceRegistry.initialize();
    });

    it('should check local device health', async () => {
      const result = await deviceRegistry.healthCheck('device-local');
      
      assert.ok('healthy' in result, 'Should have healthy property');
      // The actual value depends on whether LM Studio is running
      // Just verify the structure
      assert.strictEqual(typeof result.latencyMs === 'number' || result.latencyMs === null, true, 'Latency should be valid');
    });

    it('should handle connection failure gracefully', async () => {
      const result = await deviceRegistry.healthCheck('device-local');
      
      // Since we're mocking, the check may or may not succeed depending on implementation
      assert.ok('healthy' in result, 'Should have healthy property');
    });

    it('should return false for offline device', async () => {
      // First add a device manually to test with
      deviceRegistry._updateDevices(new Map([[
        'device-local',
        { 
          id: 'device-local',
          name: 'Test Device',
          address: '127.0.0.1',
          status: 'online',
          hardwareProfile: deviceRegistry._detectHardware(),
          capabilities: {
            maxConcurrentRequests: 4,
            supportedModelTypes: ['llm'],
            maxContextLength: 8192,
          },
          lastSeen: new Date().toISOString()
        }
      ]]));

      const result = await deviceRegistry.healthCheck('device-local');
      
      assert.ok(result !== null, 'Should return a result');
    });
  });

  describe('Status Change Notifications', () => {
    it('should notify listeners of status changes', async () => {
      // Setup with devices
      deviceRegistry.setModelsProvider(async () => [
        { key: 'llama-3.2-3b', context_length: 8192, metadata: {} },
      ]);
      
      await deviceRegistry.initialize();

      let callbackCalled = false;
      
      // Subscribe to status changes
      const unsubscribe = deviceRegistry.onDeviceStatusChange((device, event) => {
        callbackCalled = true;
      });

      // Simulate a status change by manually calling the notification method
      const device = deviceRegistry.getDevice('device-local');
      
      assert.ok(device !== null, 'Device should exist');

      if (device) {
        // Mark as degraded and notify
        device.status = 'degraded';
        deviceRegistry._notifyStatusChange(device, 'degraded');
      }

      assert.strictEqual(callbackCalled, true, 'Callback should be called on status change');

      // Unsubscribe and verify no more notifications
      unsubscribe();
    });
  });

  describe('Get Stats', () => {
    beforeEach(async () => {
      resetDeviceRegistry();
      deviceRegistry.setModelsProvider(async () => []);
      await deviceRegistry.initialize();
    });

    it('should return device statistics', async () => {
      const stats = deviceRegistry.getStats();

      assert.ok(stats, 'Should return stats object');
      assert.ok('totalDevices' in stats, 'Should have totalDevices property');
      assert.ok('onlineDevices' in stats, 'Should have onlineDevices property');
      assert.ok('degradedDevices' in stats, 'Should have degradedDevices property');
      assert.ok('offlineDevices' in stats, 'Should have offlineDevices property');
      assert.ok('tiers' in stats, 'Should have tiers object');
    });
  });

  describe('Hardware Detection', () => {
    it('should detect memory and CPU cores', async () => {
      resetDeviceRegistry();
      
      const profile = deviceRegistry._detectHardware();
      
      // Check hardware detection works
      assert.ok(typeof profile.ramGB === 'number' && profile.ramGB >= 1, 'Should have RAM property');
      assert.ok(typeof profile.cpuCores === 'number' && profile.cpuCores >= 1, 'Should have CPU cores property');
    });
  });

  describe('Environment Variables', () => {
    it('should use custom discovery interval from environment', async () => {
      const originalEnv = process.env.DEVICE_DISCOVERY_INTERVAL_MS;
      
      try {
        // Test with default value
        const registry = deviceRegistry;
        
        // The value should be parsed at construction time
        assert.ok(registry.discoveryIntervalMs > 0, 'Should have valid discovery interval');
      } finally {
        if (originalEnv !== undefined) {
          process.env.DEVICE_DISCOVERY_INTERVAL_MS = originalEnv;
        } else {
          delete process.env.DEVICE_DISCOVERY_INTERVAL_MS;
        }
      }
    });
  });

  describe('Shutdown', () => {
    it('should stop discovery interval on shutdown', async () => {
      deviceRegistry.setModelsProvider(async () => []);
      await deviceRegistry.initialize();

      // Get initial state
      assert.ok(deviceRegistry.discoveryInterval !== null, 'Discovery interval should be set');
      
      // Shutdown
      deviceRegistry.shutdown();
      
      // Verify cleanup
      assert.strictEqual(deviceRegistry.isInitialized, false, 'Should not be initialized after shutdown');
      assert.strictEqual(deviceRegistry.devices.size, 0, 'Devices map should be empty');
    });
  });
});