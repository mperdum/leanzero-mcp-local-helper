/**
 * Load Tracker Tests
 * Unit tests for src/services/load-tracker.js
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { resetLoadTracker, loadTracker, initializeLoadTracker } from '../src/services/load-tracker.js';

// Reset before each test
beforeEach(() => {
  resetLoadTracker();
});

afterEach(() => {
  loadTracker.shutdown();
});

describe('LoadTracker', () => {
  describe('Request Tracking', () => {
    beforeEach(async () => {
      await loadTracker.initialize();
    });

    it('should record request start and increment active requests', async () => {
      loadTracker.recordRequestStart('device-local', 'llama-3.2-3b');
      
      const state = loadTracker.getDeviceLoadState('device-local');
      assert.ok(state !== null, 'Should have state');
      assert.strictEqual(state.activeRequests, 1, 'Active requests should be 1');
    });

    it('should record request end and decrement active requests', async () => {
      loadTracker.recordRequestStart('device-local', 'llama-3.2-3b');
      loadTracker.recordRequestEnd('device-local', 'llama-3.2-3b', true);
      
      const state = loadTracker.getDeviceLoadState('device-local');
      assert.ok(state !== null, 'Should have state');
      assert.strictEqual(state.activeRequests, 0, 'Active requests should be 0');
    });

    it('should track total requests today', async () => {
      for (let i = 0; i < 5; i++) {
        loadTracker.recordRequestStart('device-local', 'llama-3.2-3b');
        loadTracker.recordRequestEnd('device-local', 'llama-3.2-3b', true);
      }

      const state = loadTracker.getDeviceLoadState('device-local');
      assert.ok(state !== null, 'Should have state');
      assert.strictEqual(state.totalRequestsToday, 5, 'Should track 5 requests');
    });
  });

  describe('Concurrency Limits', () => {
    beforeEach(async () => {
      await loadTracker.initialize();
      // Clear any existing states for clean test
      loadTracker.loadStates.clear();
    });

    it('should allow request when under concurrent limit', async () => {
      // Add device to registry first
      loadTracker._addTestDevice('device-local');
      
      const result = loadTracker.canAcceptRequest('device-local');
      
      assert.strictEqual(result.allowed, true, 'Should be allowed');
    });

    it('should block request when at concurrent limit', async () => {
      // Simulate max requests active (use '*' for global state)
      const stateKey = 'device-local:*';
      loadTracker.loadStates.set(stateKey, { 
        deviceId: 'device-local',
        modelKey: '*',
        activeRequests: 4,
        lastRequestStart: new Date().toISOString(),
        totalRequestsToday: 0
      });

      const result = loadTracker.canAcceptRequest('device-local');
      
      assert.strictEqual(result.allowed, false, 'Should be blocked');
      assert.ok(result.reason !== undefined && result.reason !== null, 'Should have a reason');
    });

    it('should block request when model is processing another request', async () => {
      const stateKey = 'device-local:llama-3.2-3b';
      loadTracker.loadStates.set(stateKey, { 
        deviceId: 'device-local',
        modelKey: 'llama-3.2-3b',
        activeRequests: 1,
        lastRequestStart: new Date().toISOString(),
        totalRequestsToday: 0
      });

      const result = loadTracker.canAcceptRequest('device-local', 'llama-3.2-3b');
      
      assert.strictEqual(result.allowed, false, 'Should be blocked when model is busy');
    });
  });

  describe('Cooldown Enforcement', () => {
    beforeEach(async () => {
      await loadTracker.initialize();
      // Clear any existing states
      loadTracker.loadStates.clear();
    });

    it('should block request during cooldown period', async () => {
      const modelKey = 'llama-3.2-3b';
      // Mark device as in cooldown (10 seconds from now)
      const stateKey = `device-local:${modelKey}`;
      const cooldownUntil = new Date(Date.now() + 10000).toISOString();
      
      loadTracker.loadStates.set(stateKey, {
        deviceId: 'device-local',
        modelKey,
        activeRequests: 0,
        cooldownUntil,
        lastRequestEnd: new Date().toISOString(),
        totalRequestsToday: 0,
      });

      const result = loadTracker.canAcceptRequest('device-local', modelKey);
      
      assert.strictEqual(result.allowed, false, 'Should be blocked during cooldown');
    });

    it('should allow request after cooldown expires', async () => {
      // Add device to registry first
      loadTracker._addTestDevice('device-local');
      
      const modelKey = 'llama-3.2-3b';
      // Mark device as in cooldown that has expired (1 second ago)
      const stateKey = `device-local:${modelKey}`;
      const expiredTime = new Date(Date.now() - 1000).toISOString();
      
      loadTracker.loadStates.set(stateKey, {
        deviceId: 'device-local',
        modelKey,
        activeRequests: 0,
        cooldownUntil: expiredTime,
        lastRequestEnd: new Date().toISOString(),
        totalRequestsToday: 0,
      });

      const result = loadTracker.canAcceptRequest('device-local', modelKey);
      
      assert.strictEqual(result.allowed, true, 'Should be allowed after cooldown');
    });
  });

  describe('Load Score Calculation', () => {
    beforeEach(async () => {
      await loadTracker.initialize();
      // Clear any existing states
      loadTracker.loadStates.clear();
    });

    it('should return 0 for idle device', async () => {
      const score = loadTracker.calculateLoadScore('device-local');
      
      assert.strictEqual(score, 0, 'Idle device should have 0 load score');
    });

    it('should return partial score for partially loaded device', async () => {
      // Set up state with half capacity
      const stateKey = 'device-local:*';
      loadTracker.loadStates.set(stateKey, { 
        deviceId: 'device-local',
        modelKey: '*',
        activeRequests: 2,
        lastRequestStart: new Date().toISOString(),
        totalRequestsToday: 0
      });

      const score = loadTracker.calculateLoadScore('device-local');
      
      assert.ok(score >= 0 && score <= 1, 'Score should be between 0 and 1');
    });

    it('should return 1 for max capacity', async () => {
      const stateKey = 'device-local:*';
      loadTracker.loadStates.set(stateKey, { 
        deviceId: 'device-local',
        modelKey: '*',
        activeRequests: 4,
        lastRequestStart: new Date().toISOString(),
        totalRequestsToday: 0
      });

      const score = loadTracker.calculateLoadScore('device-local');
      
      assert.strictEqual(score, 1, 'Max capacity should have score of 1');
    });
  });

  describe('Shutdown and Cleanup', () => {
    it('should clear all states on reset', async () => {
      // Add some load states
      loadTracker.recordRequestStart('device-local', 'llama-3.2-3b');

      assert.ok(loadTracker.loadStates.size > 0, 'Should have states before reset');

      // Reset
      resetLoadTracker();

      assert.strictEqual(loadTracker.loadStates.size, 0, 'States should be empty after reset');
    });

    it('should cleanup on device offline event', async () => {
      const modelKey = 'llama-3.2-3b';
      const stateKey = `device-offline:${modelKey}`;
      loadTracker.loadStates.set(stateKey, {
        deviceId: 'device-offline',
        modelKey,
        activeRequests: 1,
        lastRequestStart: new Date().toISOString(),
        totalRequestsToday: 0,
      });

      assert.ok(loadTracker.loadStates.size > 0, 'Should have states before cleanup');

      // The _cleanupDevice method should be called by the subscription
      // We can test it directly:
      loadTracker._cleanupDevice('device-offline');
      
      // After cleanup, the state should be removed
      const remainingState = loadTracker.loadStates.get(stateKey);
      assert.strictEqual(remainingState, undefined, 'State should be cleaned up');
    });
  });

  describe('Get Stats', () => {
    beforeEach(async () => {
      await loadTracker.initialize();
    });

    it('should return load statistics', async () => {
      const stats = loadTracker.getStats();

      assert.ok(stats, 'Should return stats object');
      assert.ok('totalLoadStates' in stats, 'Should have totalLoadStates property');
      assert.ok('totalActiveRequests' in stats, 'Should have totalActiveRequests property');
      assert.ok('devicesTracked' in stats, 'Should have devicesTracked property');
    });
  });
});