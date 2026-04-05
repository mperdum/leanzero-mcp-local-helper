/**
 * Research Tool Tests
 * Integration tests for src/tools/research.js - The Main Orchestrator Entry Point
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

// Import research tool and related modules
import {
  executeResearch,
  handleResearch,
  getResearchConfig,
  shutdownResearch,
} from '../src/tools/research.js'; 

/**
 * Helper to create mock device registry
 */ 
function createMockDeviceRegistry(devices = []) {
  return {
    getOnlineDevices() {
      return devices.length > 0 ? devices : [
        { id: 'device-1', name: 'Local Device', tier: 'ultra' },
        { id: 'device-2', name: 'Remote Device', tier: 'high' },
      ];
    },
    getAllDevices: () => [],
  };
}

/**
 * Helper to create mock load tracker
 */
function createMockLoadTracker() {
  return {
    findOptimalDevice({ prompt } = {}) {
      // Simple heuristic: first device is optimal
      const devices = [
        { deviceId: 'device-1', modelKey: '*' },
        { deviceId: 'device-2', modelKey: '*' },
      ];
      return devices[0];
    },
  };
}

/**
 * Helper to create mock task orchestrator
 */
function createMockOrchestrator() {
  let initialized = false;

  return {
    async initialize() {
      initialized = true;
      this.activePlans = new Map();
    },
    
    async executePlan(plan) {
      // Simulate plan execution
      return {
        success: true,
        results: plan.subtasks.map((subtask, i) => ({
          id: subtask.id,
          content: `Execution result for ${subtask.type}`,
          deviceId: 'device-1',
          durationMs: 2000 + (i * 500),
        })),
        aggregatedResult: {
          content: 'All tasks completed successfully',
          tokenCount: 3500,
        },
      };
    },

    async shutdown() {
      this.activePlans.clear();
    },
  };
}

/**
 * Helper to create mock research swarm orchestrator
 */
function createMockSwarmOrchestrator() {
  return {
    async initialize() {},
    
    async orchestrate(query, options = {}) {
      // Simulate swarm execution
      const numSubtasks = options.maxSubtasks || 3;
      
      return {
        success: true,
        subtasksCount: numSubtasks,
        aggregatedResult: {
          content: `Swarm orchestration for: ${query.substring(0, 50)}...`,
          tokenCount: 4200,
        },
        agentResults: Array.from({ length: numSubtasks }, (_, i) => ({
          deviceId: `device-${i + 1}`,
          content: `Agent ${i + 1} research results`,
          tokenCount: 3000,
        })),
      };
    },

    async shutdown() {},
  };
}

describe('Research Tool', () => {
  describe('getResearchConfig', () => {
    it('should return configuration object', () => {
      const config = getResearchConfig();

      assert.ok(config.maxTokensForMainModel === 15000, 'Should have max tokens setting');
      assert.ok(config.defaultMaxSubtasks === 5, 'Should have default subtasks');
      assert.ok(config.agentsPerDevice === 1, 'Should have one agent per device');
    });
  });

  describe('executeResearch', () => {
    let originalLoadTracker;
    let originalTaskOrchestrator;
    let originalSwarmOrchestrator;

    beforeEach(async () => {
      // Mock services
      const { loadTracker } = await import('../src/services/load-tracker.js');
      const { taskOrchestrator } = await import('../src/services/orchestrator.js');
      const { researchSwarmOrchestrator } = await import('../src/services/research-swarm-orchestrator.js');

      originalLoadTracker = loadTracker;
      originalTaskOrchestrator = taskOrchestrator;
      originalSwarmOrchestrator = researchSwarmOrchestrator;

      // Override with mocks
      await import('../src/services/load-tracker.js').then(m => {
        m.loadTracker = createMockLoadTracker();
      });

      await import('../src/services/orchestrator.js').then(m => {
        m.taskOrchestrator = createMockOrchestrator();
      });

      await import('../src/services/research-swarm-orchestrator.js').then(m => {
        m.researchSwarmOrchestrator = createMockSwarmOrchestrator();
      });
    });

    afterEach(() => {
      // Restore original services if needed
      if (originalLoadTracker) {
        // restore logic here if needed
      }
    });

    it('should execute simple research query', async () => {
      const query = 'What is the capital of France?';
      const result = await executeResearch({ query });

      assert.ok(result.success, 'Should complete successfully');
      assert.strictEqual(result.query, query, 'Should preserve original query');
      assert.ok(result.devicesUsed >= 1, 'Should use at least one device');
      assert.ok(result.aggregatedResult.content.length > 0, 'Should have aggregated content');
    });

    it('should execute complex research query with parallelism', async () => {
      const query = 'Research authentication and authorization patterns, compare implementations in src/auth/ and src/lib/, then analyze test coverage';
      const result = await executeResearch({ query });

      assert.ok(result.success, 'Should complete successfully');
      assert.strictEqual(result.query, query, 'Should preserve original query');
      // Complex queries may spawn multiple devices
    });

    it('should respect maxSubtasks limit', async () => {
      const query = 'Analyze the codebase';
      const result = await executeResearch({ query, maxSubtasks: 3 });

      assert.ok(result.devicesUsed <= 3, `Should use at most ${3} subagents`);
    });
  });

  describe('handleResearch (MCP integration)', () => {
    it('should return properly formatted response for MCP client', async () => {
      const params = { query: 'Test research task' };
      const result = await handleResearch(params);

      assert.ok(result.content, 'Should have content field');
      
      // Parse the JSON string in content
      const contentObj = JSON.parse(result.content[0].text);
      
      assert.strictEqual(contentObj.success, true, 'Should be successful');
      assert.strictEqual(contentObj.query, params.query, 'Should include query');
    });

    it('should handle errors gracefully', async () => {
      // Test error handling by passing invalid parameters
      const result = await handleResearch({ query: '' });
      
      assert.ok(result.content, 'Should have content even on empty query');
    });
  });

  describe('complex research scenarios', () => {
    it('should aggregate multiple device results', async () => {
      // This test would use actual device registry with multiple devices
      const query = 'Compare auth implementations across devices';
      const result = await executeResearch({ query, maxSubtasks: 4 });

      assert.ok(result.agentResults.length >= 1, 'Should have agent results');
      
      // Verify token budget is respected
      assert.ok(
        result.aggregatedResult.tokenCount <= 15000,
        `Token count ${result.aggregatedResult.tokenCount} should be within budget`
      );
    });
  });

  describe('research query complexity analysis', () => {
    it('should classify simple query correctly', async () => {
      // Simple queries have fewer words and no parallel indicators
      const simpleQuery = 'What is the capital of France?';
      
      const { analyzeResearchQuery } = await import('../src/tools/research.js');
      const result = await analyzeResearchQuery(simpleQuery);
 
      assert.strictEqual(result.complexity, 'simple', 'Simple query should be classified as simple');
      assert.strictEqual(result.requiresParallelism, false, 'Simple query may not need parallelism');
    });
 
    it('should classify complex query with multiple questions', async () => {
      const complexQuery = 'What is A? What is B? How are they related?';
      
      const { analyzeResearchQuery } = await import('../src/tools/research.js');
      const result = await analyzeResearchQuery(complexQuery);
 
      assert.ok(result.complexity === 'moderate' || result.complexity === 'complex', 
        'Complex query should be moderate or complex');
      assert.strictEqual(result.requiresParallelism, true, 'Multiple questions need parallelism');
    });
  });
});

// Export for programmatic usage
export { executeResearch, handleResearch };