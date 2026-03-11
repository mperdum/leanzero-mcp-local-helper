/**
 * Hardware Detector Tests
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { hardwareDetector } from '../src/utils/hardware-detector.js';

describe('Hardware Detector', () => {
  beforeEach(() => {
    // Clear cache before each test
    hardwareDetector.clearCache();
  });

  describe('RAM Detection', () => {
    it('should detect RAM using available methods', async () => {
      const ram = await hardwareDetector.detectTotalRAM();
      
      // Should return a reasonable value (0-512 GB)
      assert.ok(ram >= 0, 'RAM should be non-negative');
      assert.ok(ram <= 512, 'RAM should be less than 512GB (sanity check)');
    });

    it('should cache RAM detection result', async () => {
      const ram1 = await hardwareDetector.detectTotalRAM();
      const ram2 = await hardwareDetector.detectTotalRAM();
      
      // Should return same cached value
      assert.strictEqual(ram1, ram2);
    });

    it('should clear cache on clearCache()', async () => {
      await hardwareDetector.detectTotalRAM();
      hardwareDetector.clearCache();
      
      // After clear, should re-detect (we can't test exact value but method should work)
      const ram = await hardwareDetector.detectTotalRAM();
      assert.ok(typeof ram === 'number');
    });
  });

  describe('Hardware Tier Classification', () => {
    it('should return valid tier', async () => {
      const tier = await hardwareDetector.getHardwareTier();
      
      const validTiers = ['low', 'medium', 'high', 'ultra'];
      assert.ok(validTiers.includes(tier), `Tier should be one of ${validTiers.join(', ')}`);
    });

    it('should be consistent within cache TTL', async () => {
      const tier1 = await hardwareDetector.getHardwareTier();
      const tier2 = await hardwareDetector.getHardwareTier();
      
      assert.strictEqual(tier1, tier2);
    });
  });

  describe('Parallel Load Limit', () => {
    it('should return reasonable limit (1-6)', async () => {
      const limit = await hardwareDetector.getParallelLoadLimit();
      
      assert.ok(limit >= 1, 'Limit should be at least 1');
      assert.ok(limit <= 6, 'Limit should be at most 6');
    });

    it('should be integer', async () => {
      const limit = await hardwareDetector.getParallelLoadLimit();
      
      assert.ok(Number.isInteger(limit), 'Limit should be integer');
    });
  });

  describe('Model Size Compatibility', () => {
    it('should return valid max model size', async () => {
      const maxSize = await hardwareDetector.getMaxModelSize();
      
      const validSizes = ['small', 'medium', 'large', 'xlarge'];
      assert.ok(validSizes.includes(maxSize), `Max size should be one of ${validSizes.join(', ')}`);
    });
  });

  describe('Hardware Profile', () => {
    it('should return complete hardware profile', async () => {
      const profile = await hardwareDetector.getHardwareProfile();
      
      assert.ok(profile.ramGB >= 0, 'Profile should have ramGB');
      assert.ok(profile.cpuCores >= 1, 'Profile should have cpuCores');
      assert.ok(profile.tier, 'Profile should have tier');
      assert.ok(profile.parallelLoadLimit >= 1, 'Profile should have parallelLoadLimit');
      assert.ok(profile.maxModelSize, 'Profile should have maxModelSize');
      assert.ok(profile.platform, 'Profile should have platform');
      assert.ok(profile.architecture, 'Profile should have architecture');
      assert.ok(profile.timestamp, 'Profile should have timestamp');
    });
  });
});