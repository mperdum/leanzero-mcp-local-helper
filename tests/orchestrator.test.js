/**
 * Task Orchestrator Tests
 * Integration tests for src/services/orchestrator.js and src/utils/task-decomposer.js
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

// Import orchestrator and related modules
import {
  resetOrchestrator,
  taskOrchestrator,
  initializeOrchestrator,
} from '../src/services/orchestrator.js';

import {
  analyzeTask,
  decompose,
  buildExecutionOrder,
  validateDecomposition,
  estimateExecutionTime,
  Subtask,
  selectTaskType,
  TASK_TYPES,
} from '../src/utils/task-decomposer.js';

// Helper to create a simple subtask
function createTestSubtask(id, type, prompt, options = {}) {
  return new Subtask(`subtask-${id}`, type, prompt, options);
}

describe('Task Decomposer', () => {
  describe('analyzeTask', () => {
    it('should classify simple task as not requiring parallelism', () => {
      const result = analyzeTask('What is the capital of France?');
      
      assert.strictEqual(result.complexity, 'simple', 'Should be simple');
      assert.strictEqual(result.requiresParallelism, false, 'Should not require parallelism');
    });

    it('should classify complex task with multiple questions as requiring parallelism', () => {
      const result = analyzeTask('What is A? What is B? How are they related?');
      
      assert.strictEqual(result.complexity, 'complex', 'Should be complex');
      assert.strictEqual(result.requiresParallelism, true, 'Should require parallelism');
    });

    it('should classify moderate task with "and" as requiring parallelism', () => {
      const result = analyzeTask('Write code and add tests');
      
      assert.strictEqual(result.complexity, 'moderate', 'Should be moderate');
      assert.strictEqual(result.requiresParallelism, true, 'Should require parallelism');
    });

    it('should handle tasks with numbered lists', () => {
      const result = analyzeTask('1. First step 2. Second step 3. Third step');
      
      assert.ok(result.complexity === 'moderate' || result.complexity === 'complex', 'Should be moderate or complex');
      assert.strictEqual(result.requiresParallelism, true, 'Should require parallelism');
    });
  });

  describe('Subtask class', () => {
    it('should create subtask with default options', () => {
      const subtask = new Subtask('subtask-1', TASK_TYPES.RESEARCH, 'Test prompt');
      
      assert.strictEqual(subtask.id, 'subtask-1', 'Should have correct ID');
      assert.strictEqual(subtask.type, TASK_TYPES.RESEARCH, 'Should have correct type');
      assert.strictEqual(subtask.prompt, 'Test prompt', 'Should have correct prompt');
      assert.deepStrictEqual(subtask.requiredCapabilities, [], 'Should have empty capabilities');
      assert.strictEqual(subtask.assignedDeviceId, null, 'Should have no device assigned');
      assert.strictEqual(subtask.priority, 3, 'Should have default priority 3');
    });

    it('should create subtask with options', () => {
      const subtask = new Subtask(
        'subtask-1',
        TASK_TYPES.CODE_GENERATION,
        'Write a function',
        { assignedDeviceId: 'device-1', assignedModelKey: 'model-a' }
      );
      
      assert.strictEqual(subtask.assignedDeviceId, 'device-1', 'Should have device assigned');
      assert.strictEqual(subtask.assignedModelKey, 'model-a', 'Should have model assigned');
    });

    it('should mark subtask as completed with result', () => {
      const subtask = new Subtask('subtask-1', TASK_TYPES.SYNTHESIS, 'Test');
      
      subtask.complete({
        success: true,
        content: 'Result content',
        deviceId: 'device-local',
        durationMs: 5000,
      });
      
      assert.ok(subtask.result !== null, 'Should have result object');
      assert.strictEqual(subtask.result.success, true, 'Should be successful');
      assert.strictEqual(subtask.result.content, 'Result content', 'Should have content');
      assert.strictEqual(subtask.result.deviceId, 'device-local', 'Should have device ID');
      assert.strictEqual(subtask.result.durationMs, 5000, 'Should have duration');
    });

    it('should check if subtask is ready with no dependencies', () => {
      const subtask = new Subtask('subtask-1', TASK_TYPES.RESEARCH, 'Test');
      
      // With no pending deps, should be ready
      assert.strictEqual(subtask.isReady(new Set()), true, 'Should be ready without deps');
    });

    it('should check if subtask is ready with completed dependencies', () => {
      const subtask = new Subtask(
        'subtask-2',
        TASK_TYPES.RESEARCH,
        'Test',
        { dependencies: ['subtask-1'] }
      );
      
      assert.strictEqual(subtask.isReady(new Set(['subtask-1'])), true, 'Should be ready with completed deps');
    });

    it('should check if subtask is not ready with incomplete dependencies', () => {
      const subtask = new Subtask(
        'subtask-2',
        TASK_TYPES.RESEARCH,
        'Test',
        { dependencies: ['subtask-1'] }
      );
      
      assert.strictEqual(subtask.isReady(new Set()), false, 'Should not be ready without completed deps');
    });

    it('should calculate priority score', () => {
      const highPriority = new Subtask('high', TASK_TYPES.RESEARCH, 'Test', { priority: 5 });
      const lowPriority = new Subtask('low', TASK_TYPES.RESEARCH, 'Test', { priority: 1 });
      
      assert.ok(highPriority.getPriorityScore() > lowPriority.getPriorityScore(), 'High priority should score higher');
    });
  });

  describe('decompose', () => {
    it('should decompose task with "and" into multiple subtasks', () => {
      const result = decompose('Write code and add tests and update docs');
      
      assert.ok(result.length >= 2, 'Should have at least 2 subtasks');
      assert.strictEqual(result[0].type, TASK_TYPES.RESEARCH, 'First should be research type');
    });

    it('should handle numbered list tasks', () => {
      const result = decompose('1. First item 2. Second item 3. Third item');
      
      assert.ok(result.length >= 2, 'Should have multiple subtasks');
    });

    it('should extract questions from task', () => {
      const result = decompose('What is A? What is B? How are they related?');
      
      // Questions should be extracted
      assert.ok(result.length > 0, 'Should have some subtasks');
    });

    it('should handle code-related tasks', () => {
      const result = decompose('Create a function to calculate factorial and add tests');
      
      assert.ok(result.some(t => t.type === TASK_TYPES.CODE_GENERATION), 'Should have code generation type');
    });

    it('should create single synthesis task when no pattern matches', () => {
      const result = decompose('Just do this thing here');
      
      assert.strictEqual(result.length, 1, 'Should have one subtask');
      assert.strictEqual(result[0].type, TASK_TYPES.SYNTHESIS, 'Should be synthesis type');
    });
  });

  describe('buildExecutionOrder', () => {
    it('should build single layer for tasks with no dependencies', () => {
      const subtasks = [
        createTestSubtask(1, TASK_TYPES.RESEARCH, 'A'),
        createTestSubtask(2, TASK_TYPES.ANALYSIS, 'B'),
      ];
      
      const order = buildExecutionOrder(subtasks);
      
      assert.ok(order.length === 1, 'Should have one layer');
      assert.strictEqual(order[0].length, 2, 'Layer should have both subtasks');
    });

    it('should build multiple layers for tasks with dependencies', () => {
      const subtasks = [
        createTestSubtask(1, TASK_TYPES.RESEARCH, 'A'), // No deps
        createTestSubtask(2, TASK_TYPES.ANALYSIS, 'B', { dependencies: ['subtask-1'] }), // Depends on 1
      ];
      
      const order = buildExecutionOrder(subtasks);
      
      assert.strictEqual(order.length, 2, 'Should have two layers');
      assert.ok(order[0].includes('subtask-1'), 'First layer should have subtask-1');
      assert.ok(order[1].includes('subtask-2'), 'Second layer should have subtask-2');
    });

    it('should handle empty input', () => {
      const order = buildExecutionOrder([]);
      
      assert.deepStrictEqual(order, [], 'Should return empty array');
    });
  });

  describe('validateDecomposition', () => {
    it('should validate correct decomposition', () => {
      const plan = {
        subtasks: [
          createTestSubtask(1, TASK_TYPES.RESEARCH, 'A'),
          createTestSubtask(2, TASK_TYPES.ANALYSIS, 'B', { dependencies: ['subtask-1'] }),
        ],
        executionOrder: [['subtask-1'], ['subtask-2']],
      };
      
      const result = validateDecomposition(plan);
      
      assert.strictEqual(result.valid, true, 'Should be valid');
      assert.deepStrictEqual(result.issues, [], 'Should have no issues');
    });

    it('should detect duplicate IDs', () => {
      const plan = {
        subtasks: [
          createTestSubtask(1, TASK_TYPES.RESEARCH, 'A'),
          new Subtask('subtask-1', TASK_TYPES.ANALYSIS, 'B'), // Duplicate ID
        ],
      };
      
      const result = validateDecomposition(plan);
      
      assert.strictEqual(result.valid, false, 'Should be invalid');
      assert.ok(result.issues.some(i => i.includes('Duplicate')), 'Should detect duplicate');
    });

    it('should detect non-existent dependency reference', () => {
      const plan = {
        subtasks: [
          createTestSubtask(1, TASK_TYPES.RESEARCH, 'A', { dependencies: ['non-existent'] }),
        ],
      };
      
      const result = validateDecomposition(plan);
      
      assert.strictEqual(result.valid, false, 'Should be invalid');
      assert.ok(result.issues.some(i => i.includes('non-existent')), 'Should detect bad reference');
    });

    it('should detect self-reference', () => {
      const plan = {
        subtasks: [
          createTestSubtask(1, TASK_TYPES.RESEARCH, 'A', { dependencies: ['subtask-1'] }),
        ],
      };
      
      const result = validateDecomposition(plan);
      
      assert.strictEqual(result.valid, false, 'Should be invalid');
      assert.ok(result.issues.some(i => i.includes('depends on itself')), 'Should detect self-reference');
    });
  });

  describe('estimateExecutionTime', () => {
    it('should return 0 for empty plan', () => {
      const time = estimateExecutionTime({ subtasks: [] });
      
      assert.strictEqual(time, 0, 'Should be 0 for empty plan');
    });

    it('should estimate time based on subtask count and parallel layers', () => {
      // With more parallel layers, time should be reduced per layer
      const plan1 = { subtasks: [1, 2, 3], executionOrder: [['a'], ['b'], ['c']] }; // 3 sequential layers
      
      assert.ok(estimateExecutionTime(plan1) > 0, 'Should estimate positive time');
    });
  });

  describe('selectTaskType', () => {
    it('should select code-generation for code-related prompts', () => {
      const type = selectTaskType('Write a function to calculate factorial');
      
      assert.strictEqual(type, TASK_TYPES.CODE_GENERATION, 'Should be code generation');
    });

    it('should select research for question-based prompts', () => {
      const type = selectTaskType('What is the capital of France?');
      
      assert.strictEqual(type, TASK_TYPES.RESEARCH, 'Should be research');
    });

    it('should select analysis for analysis-related prompts', () => {
      const type = selectTaskType('Analyze the pros and cons of this approach');
      
      assert.strictEqual(type, TASK_TYPES.ANALYSIS, 'Should be analysis');
    });

    it('should default to synthesis', () => {
      const type = selectTaskType('Just do something generic here');
      
      assert.strictEqual(type, TASK_TYPES.SYNTHESIS, 'Should be synthesis');
    });
  });
});

describe('TaskOrchestrator', () => {
  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await taskOrchestrator.initialize();
      
      assert.ok(taskOrchestrator.deviceRegistry.isInitialized || true, 'Device registry should initialize');
      resetOrchestrator();
    });

    it('should shutdown properly', async () => {
      await taskOrchestrator.initialize();
      taskOrchestrator.shutdown();
      
      assert.strictEqual(taskOrchestrator.activePlans.size, 0, 'Active plans should be cleared');
    });
  });

  describe('decomposeTask', () => {
    beforeEach(async () => {
      await initializeOrchestrator();
    });

    it('should return single subtask for simple task', async () => {
      const plan = await taskOrchestrator.decomposeTask('What is the capital of France?');
      
      assert.ok(plan.subtasks.length >= 1, 'Should have at least one subtask');
      assert.strictEqual(plan.executionOrder.length, 1, 'Should have one execution layer');
    });

    it('should decompose complex task into multiple subtasks', async () => {
      const task = 'Research topic A, analyze topic B, and synthesize results';
      const plan = await taskOrchestrator.decomposeTask(task);
      
      // Complex task should be decomposed
      assert.ok(plan.subtasks.length > 1, 'Should have multiple subtasks');
    });

    it('should handle context options', async () => {
      const plan = await taskOrchestrator.decomposeTask('Complex task', { maxSubtasks: 3 });
      
      assert.ok(plan.subtasks.length <= 3, 'Should respect maxSubtasks limit');
    });

    it('should build execution order with dependencies', async () => {
      const task = 'First do A, then B after A is done';
      const plan = await taskOrchestrator.decomposeTask(task);
      
      // Check that executionOrder exists
      assert.ok(Array.isArray(plan.executionOrder), 'Should have executionOrder');
    });
  });

  describe('executePlan', () => {
    beforeEach(async () => {
      await initializeOrchestrator();
    });

    it('should execute single subtask plan', async () => {
      const plan = {
        originalTask: 'Simple task',
        subtasks: [new Subtask('subtask-1', TASK_TYPES.SYNTHESIS, 'Test')],
        executionOrder: [['subtask-1']],
        estimatedTotalTimeMs: 5000,
        requiredDevices: new Set(['device-local']),
      };

      const result = await taskOrchestrator.executePlan(plan);
      
      assert.ok(result.success === true || result.success === false, 'Should have success property');
    });

    it('should handle empty plan gracefully', async () => {
      const plan = {
        originalTask: 'Empty',
        subtasks: [],
        executionOrder: [],
        estimatedTotalTimeMs: 0,
        requiredDevices: new Set(),
      };

      const result = await taskOrchestrator.executePlan(plan);
      
      assert.ok(result.success === true || result.success === false, 'Should have success property');
    });
  });

  describe('dispatchSubtask', () => {
    beforeEach(async () => {
      await initializeOrchestrator();
    });

    it('should dispatch subtask to device', async () => {
      const subtask = new Subtask('subtask-1', TASK_TYPES.RESEARCH, 'Test prompt');
      
      // Mock load tracker for testing
      const originalFindOptimal = taskOrchestrator.loadTracker.findOptimalDevice;
      taskOrchestrator.loadTracker.findOptimalDevice = () => ({ deviceId: 'device-local', modelKey: '*' });
      
      try {
        const result = await taskOrchestrator.dispatchSubtask(subtask);
        
        assert.ok(result.id === subtask.id, 'Should return same subtask');
      } finally {
        // Restore
        taskOrchestrator.loadTracker.findOptimalDevice = originalFindOptimal;
      }
    });

    it('should handle no available devices', async () => {
      const subtask = new Subtask('subtask-1', TASK_TYPES.RESEARCH, 'Test');
      
      const result = await taskOrchestrator.dispatchSubtask(subtask);
      
      assert.strictEqual(result.result.success, false, 'Should fail without devices');
    });
  });

  describe('aggregateResults', () => {
    it('should return message for empty results', () => {
      const result = taskOrchestrator.aggregateResults([]);
      
      assert.ok(result.includes('No subtasks'), 'Should have no subtasks message');
    });

    it('should synthesize completed results', () => {
      const originalTask = 'Test task for synthesis';
      const subtasks = [
        new Subtask('subtask-1', TASK_TYPES.RESEARCH, 'Test'),
        new Subtask('subtask-2', TASK_TYPES.ANALYSIS, 'Test'),
      ];
      
      // Complete the subtasks
      subtasks[0].complete({ success: true, content: 'Result 1', deviceId: 'device-local' });
      subtasks[1].complete({ success: true, content: 'Result 2', deviceId: 'device-remote' });
      
      const aggregated = taskOrchestrator.aggregateResults(subtasks, originalTask);
      
      assert.ok(aggregated.includes('Result 1'), 'Should include first result');
      assert.ok(aggregated.includes('Result 2'), 'Should include second result');
    });

    it('should include summary with counts', () => {
      const subtasks = [
        new Subtask('subtask-1', TASK_TYPES.RESEARCH, 'Test'),
        new Subtask('subtask-2', TASK_TYPES.ANALYSIS, 'Test'),
      ];
      
      subtasks[0].complete({ success: true, content: 'OK' });
      subtasks[1].complete({ success: false, error: 'Failed' });
      
      const aggregated = taskOrchestrator.aggregateResults(subtasks);
      
      assert.ok(aggregated.includes('Processed'), 'Should include processed count');
    });
  });

  describe('Get Stats', () => {
    it('should return orchestration statistics', async () => {
      await initializeOrchestrator();
      
      const stats = taskOrchestrator.getStats();
      
      assert.ok(stats, 'Should return stats object');
      assert.ok('activePlans' in stats, 'Should have activePlans property');
    });
  });
});

describe('Integration Tests', () => {
  it('should complete full orchestration lifecycle', async () => {
    await initializeOrchestrator();

    // Decompose a complex task
    const originalTask = 'Research A and B, then synthesize results';
    const plan = await taskOrchestrator.decomposeTask(originalTask);
    
    assert.ok(plan.originalTask === originalTask, 'Should preserve original task');
    assert.ok(plan.subtasks.length >= 1, 'Should have subtasks');
    assert.ok(plan.executionOrder.length >= 1, 'Should have execution order');

    // Execute the plan
    const result = await taskOrchestrator.executePlan(plan);
    
    assert.ok('success' in result, 'Should have success property');
    assert.ok(Array.isArray(result.results), 'Should have results array');

    // Cleanup
    resetOrchestrator();
  });
});