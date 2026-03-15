/**
 * Task Orchestrator - LM Link Multi-Device Orchestrator
 * Main orchestration logic for task decomposition, parallel dispatch, and result aggregation
 */

import { deviceRegistry } from './device-registry.js';
import { loadTracker } from './load-tracker.js';
import { lmStudioSwitcher, deviceAwareMethods } from './lm-studio-switcher.js';
import {
  analyzeTask,
  decompose,
  buildExecutionOrder,
  validateDecomposition,
  estimateExecutionTime,
  Subtask,
} from '../utils/task-decomposer.js';

/**
 * Type Definitions (for documentation)
 * @typedef {Object} OrchestrationPlan
 * @property {string} originalTask - The user's original request
 * @property {Subtask[]} subtasks - Decomposed tasks
 * @property {string[][]} executionOrder - Arrays of subtask IDs that can run in parallel
 * @property {number} estimatedTotalTimeMs - Estimated total execution time
 * @property {Set<string>} requiredDevices - Device IDs needed for this plan
 */

/**
 * TaskOrchestrator Class
 * Manages multi-device task orchestration with parallel execution
 */
export class TaskOrchestrator {
  constructor() {
    // Services (dependency injection)
    this.deviceRegistry = deviceRegistry;
    this.loadTracker = loadTracker;
    this.lmStudioSwitcher = lmStudioSwitcher;

    // Active orchestrations
    this.activePlans = new Map();
    
    // Configuration
    this.defaultTimeoutMs = parseInt(process.env.REMOTE_DEVICE_TIMEOUT_MS || '60000');
  }

  /**
   * Initialize the orchestrator
   */
  async initialize() {
    console.log('[Orchestrator] Initializing...');
    
    await deviceRegistry.initialize();
    await loadTracker.initialize();

    console.log('[Orchestrator] Initialized with', this.deviceRegistry.getAllDevices().length, 'devices');
  }

  /**
   * Shutdown the orchestrator
   */
  shutdown() {
    // Cancel all active orchestrations
    for (const [planId, plan] of this.activePlans.entries()) {
      this._cancelPlan(planId);
    }
    this.activePlans.clear();

    loadTracker.shutdown();
    deviceRegistry.shutdown();

    console.log('[Orchestrator] Shut down');
  }

  /**
   * Decompose a complex task into parallelizable subtasks
   * @param {string} task - Original task description
   * @param {Object} [context={}] - Additional context for decomposition
   * @returns {Promise<OrchestrationPlan>} Orchestration plan
   */
  async decomposeTask(task, context = {}) {
    console.log(`[Orchestrator] Decomposing task: ${task.substring(0, 50)}...`);

    // Analyze task complexity
    const analysis = analyzeTask(task);
    
    if (!analysis.requiresParallelism) {
      console.log('[Orchestrator] Task does not require parallelism');
      
      return {
        originalTask: task,
        subtasks: [new Subtask('subtask-1', 'synthesis', task)],
        executionOrder: [['subtask-1']],
        estimatedTotalTimeMs: estimateExecutionTime({ subtasks: [] }),
        requiredDevices: new Set(),
      };
    }

    // Decompose into subtasks
    const subtasks = decompose(task, context.maxSubtasks || 5);
    
    if (subtasks.length === 0) {
      throw new Error('Failed to decompose task - no subtasks generated');
    }

    // Build execution order with dependencies
    const executionOrder = buildExecutionOrder(subtasks);

    // Validate decomposition
    const validation = validateDecomposition({ subtasks, executionOrder });
    
    if (!validation.valid) {
      console.warn('[Orchestrator] Validation issues:', validation.issues);
      // Continue with plan despite warnings
    }

    // Calculate required devices based on subtask requirements
    const requiredDevices = new Set();
    
    for (const task of subtasks) {
      if (task.assignedDeviceId) {
        requiredDevices.add(task.assignedDeviceId);
      } else {
        // Use optimal device based on capabilities
        const optimal = this.loadTracker.findOptimalDevice(task);
        if (optimal) {
          requiredDevices.add(optimal.deviceId);
        }
      }
    }

    // Build plan
    const plan = {
      originalTask: task,
      subtasks,
      executionOrder,
      estimatedTotalTimeMs: estimateExecutionTime({ subtasks, executionOrder }),
      requiredDevices,
    };

    console.log(`[Orchestrator] Decomposed into ${subtasks.length} subtasks across ${requiredDevices.size} devices`);

    return plan;
  }

  /**
   * Execute an orchestration plan across devices
   * @param {OrchestrationPlan} plan - Orchestration plan to execute
   * @returns {Promise<{ success: boolean, results: Subtask[] }>} Execution result
   */
  async executePlan(plan) {
    const planId = `plan-${Date.now()}`;
    
    console.log(`[Orchestrator] Starting orchestration ${planId}`);

    // Store active plan
    this.activePlans.set(planId, { ...plan, startedAt: new Date().toISOString(), status: 'running' });

    try {
      const completedSubtasks = [];
      const failedSubtasks = [];

      // Execute each layer of the DAG in parallel
      for (const layer of plan.executionOrder) {
        console.log(`[Orchestrator] Executing layer (${layer.length} tasks): ${layer.join(', ')}`);
        
        const promises = [];
        
        for (const subtaskId of layer) {
          const subtask = plan.subtasks.find(t => t.id === subtaskId);
          
          if (!subtask) {
            console.warn(`[Orchestrator] Subtask not found: ${subtaskId}`);
            continue;
          }

          // Wait for dependencies to complete
          const dependenciesReady = subtask.dependencies.every(
            depId => completedSubtasks.some(t => t.id === depId)
          );

          if (!dependenciesReady) {
            console.log(`[Orchestrator] Waiting for dependencies: ${subtaskId}`);
          }

          // Check device availability before dispatching
          const canDispatch = this._canDispatch(subtask);
          
          if (canDispatch.allowed) {
            promises.push(this._dispatchAndTrack(subtask, planId));
          } else {
            console.warn(`[Orchestrator] Cannot dispatch ${subtaskId}: ${canDispatch.reason}`);
            
            // Create failed subtask
            const failed = new Subtask(subtask.id, subtask.type, subtask.prompt);
            failed.complete({ success: false, error: canDispatch.reason });
            failedSubtasks.push(failed);
          }
        }

        // Execute all tasks in this layer concurrently
        if (promises.length > 0) {
          const results = await Promise.all(promises);
          
          for (const result of results) {
            if (result.result && result.result.success) {
              completedSubtasks.push(result);
            } else {
              failedSubtasks.push(result);
              
              // Attempt retry on alternative device
              if (!result.assignedDeviceId || !result.assignedModelKey) {
                await this._retryOnAlternativeDevice(plan, result);
              }
            }
          }
        }

        // Check for cancellation
        const currentPlan = this.activePlans.get(planId);
        if (currentPlan && currentPlan.status === 'cancelled') {
          console.log(`[Orchestrator] Plan ${planId} was cancelled`);
          
          // Cancel remaining tasks
          this._cancelRemainingTasks(promises);
          
          return {
            success: false,
            results: [...completedSubtasks, ...failedSubtasks],
            partialResults: completedSubtasks.map(t => t.result),
          };
        }
      }

      // Build final result
      const allResults = [...completedSubtasks, ...failedSubtasks];
      
      return {
        success: failedSubtasks.length === 0,
        results: allResults,
      };

    } catch (error) {
      console.error(`[Orchestrator] Plan ${planId} execution failed:`, error.message);
      
      // Mark plan as failed
      const activePlan = this.activePlans.get(planId);
      if (activePlan) {
        activePlan.status = 'failed';
        activePlan.error = error.message;
      }

      return {
        success: false,
        results: [],
        error: error.message,
      };
    } finally {
      // Cleanup
      this.activePlans.delete(planId);
    }
  }

  /**
   * Dispatch a single subtask to optimal device
   * @param {Subtask} subtask - Subtask to execute
   * @returns {Promise<Subtask>} Updated subtask with result
   */
  async dispatchSubtask(subtask) {
    // Find optimal device for this subtask
    const optimal = this.loadTracker.findOptimalDevice(subtask);
    
    if (!optimal) {
      subtask.complete({
        success: false,
        error: 'No available devices found',
      });
      return subtask;
    }

    console.log(`[Orchestrator] Dispatching ${subtask.id} to ${optimal.deviceId}`);

    // Record load tracking
    this.loadTracker.recordRequestStart(optimal.deviceId, optimal.modelKey || '*');

    const startTime = Date.now();

    try {
      // Execute on target device
      let result;
      
      // ARCHITECTURE NOTE: In LM Link, ALL devices (local and remote) are accessed via
      // localhost:1234. The model key identifies which device's model to use.
      // Remote execution happens automatically via Tailscale mesh routing.

      result = await this.lmStudioSwitcher.executeChatCompletion(
        subtask.assignedModelKey || optimal.modelKey,
        subtask.prompt,
        { max_output_tokens: 4096 }
      );

      const durationMs = Date.now() - startTime;

      // Record load tracking completion
      this.loadTracker.recordRequestEnd(optimal.deviceId, optimal.modelKey || '*', result.success);

      if (result.success) {
        subtask.complete({
          success: true,
          content: result.result?.content || '',
          deviceId: optimal.deviceId,
          modelKey: result.modelId || subtask.assignedModelKey,
          durationMs,
        });
      } else {
        subtask.complete({
          success: false,
          error: result.error || 'Unknown error',
          deviceId: optimal.deviceId,
          durationMs,
        });
      }

    } catch (error) {
      this.loadTracker.recordRequestEnd(optimal.deviceId, optimal.modelKey || '*', false);
      
      subtask.complete({
        success: false,
        error: error.message,
        deviceId: optimal.deviceId,
        durationMs: Date.now() - startTime,
      });
    }

    console.log(`[Orchestrator] Subtask ${subtask.id} completed with result:`, subtask.result?.success);

    return subtask;
  }

  /**
   * Aggregate results from completed subtasks into final response
   * @param {Subtask[]} completedSubtasks - Completed subtasks with results
   * @returns {string} Aggregated synthesis of all results
   */
  aggregateResults(completedSubtasks) {
    if (!Array.isArray(completedSubtasks) || completedSubtasks.length === 0) {
      return 'No subtasks were successfully completed.';
    }

    // Sort by execution order (by ID)
    const sorted = [...completedSubtasks].sort((a, b) => a.id.localeCompare(b.id));

    // Build synthesized response
    let synthesis = '';
    
    for (const task of sorted) {
      if (!task.result?.content) continue;

      synthesis += `## ${task.type.toUpperCase()}: ${task.id}\n\n`;
      synthesis += `**Device:** ${task.result.deviceId || 'unknown'}\n`;
      synthesis += `**Duration:** ${task.result.durationMs || 0}ms\n\n`;
      synthesis += task.result.content;
      synthesis += '\n\n---\n\n';
    }

    // Add summary
    const successful = completedSubtasks.filter(t => t.result?.success).length;
    synthesis += `\n## Summary\n\n`;
    synthesis += `Processed ${completedSubtasks.length} subtask(s), ${successful} successful.\n`;

    return synthesis.trim();
  }

  /**
   * Check if a subtask can be dispatched
   * @param {Subtask} subtask - Subtask to check
   * @returns {{ allowed: boolean, reason?: string }}
   */
  _canDispatch(subtask) {
    const deviceId = subtask.assignedDeviceId || this._findBestDeviceForSubtask(subtask)?.deviceId;

    if (!deviceId) {
      return { allowed: false, reason: 'No available device for task' };
    }

    // Check device availability
    if (!this.deviceRegistry.isDeviceAvailable(deviceId)) {
      return { allowed: false, reason: `Device ${deviceId} is offline` };
    }

    // Check load constraints
    const canAccept = this.loadTracker.canAcceptRequest(
      deviceId,
      subtask.assignedModelKey || null
    );

    if (!canAccept.allowed) {
      return { ...canAccept };
    }

    return { allowed: true };
  }

  /**
   * Find best device for a subtask based on capabilities and load
   * @param {Subtask} subtask - Subtask to assign
   * @returns {{ deviceId: string; modelKey: string }|null}
   */
  _findBestDeviceForSubtask(subtask) {
    const requiredCapabilities = subtask.requiredCapabilities;
    
    // First try preferred device if specified
    if (subtask.assignedDeviceId) {
      return { 
        deviceId: subtask.assignedDeviceId, 
        modelKey: subtask.assignedModelKey || null 
      };
    }

    // Find optimal device based on load and capabilities
    return this.loadTracker.findOptimalDevice({ ...subtask });
  }

  /**
   * Dispatch task and track execution
   * @param {Subtask} subtask - Subtask to execute
   * @param {string} planId - Plan identifier for tracking
   * @returns {Promise<Subtask>} Updated subtask
   */
  async _dispatchAndTrack(subtask, planId) {
    try {
      const result = await this.dispatchSubtask(subtask);
      
      // Update active plan with progress
      const currentPlan = this.activePlans.get(planId);
      if (currentPlan) {
        // Mark subtask as completed in the plan
        const updatedSubtasks = currentPlan.subtasks.map(t => 
          t.id === result.id ? result : t
        );
        
        this.activePlans.set(planId, { ...currentPlan, subtasks: updatedSubtasks });
      }

      return result;

    } catch (error) {
      console.error(`[Orchestrator] Error dispatching ${subtask.id}:`, error.message);
      
      // Mark as failed
      subtask.complete({
        success: false,
        error: error.message,
      });

      return subtask;
    }
  }

  /**
   * Retry a failed subtask on an alternative device
   * @param {OrchestrationPlan} plan - Original plan
   * @param {Subtask} failedTask - Failed subtask
   * @returns {Promise<void>}
   */
  async _retryOnAlternativeDevice(plan, failedTask) {
    if (!failedTask.assignedDeviceId || !failedTask.assignedModelKey) {
      return;
    }

    // Find alternative device
    const alternatives = this.loadTracker.getAvailableDevices(failedTask.requiredCapabilities);
    
    for (const { device } of alternatives) {
      if (device.id === failedTask.assignedDeviceId) continue;

      console.log(`[Orchestrator] Retrying ${failedTask.id} on ${device.id}`);

      const retryTask = new Subtask(
        failedTask.id,
        failedTask.type,
        failedTask.prompt,
        { ...failedTask, assignedDeviceId: device.id }
      );

      await this.dispatchSubtask(retryTask);

      if (retryTask.result?.success) {
        console.log(`[Orchestrator] Retry successful on ${device.id}`);
        
        // Update plan with successful result
        const currentPlan = this.activePlans.get(plan.originalTask);
        if (currentPlan) {
          const updatedSubtasks = currentPlan.subtasks.map(t => 
            t.id === retryTask.id ? retryTask : t
          );
          
          this.activePlans.set(currentPlan.originalTask, { ...currentPlan, subtasks: updatedSubtasks });
        }

        break;
      }
    }
  }

  /**
   * Cancel remaining tasks in a plan
   * @param {Array<Promise>} activePromises - Promises to abort
   */
  _cancelRemainingTasks(activePromises) {
    for (const promise of activePromises) {
      // In production, we would use AbortController for each task
      // For now, just log that tasks are being cancelled
      console.log('[Orchestrator] Cancelling task...');
    }
  }

  /**
   * Cancel an in-progress orchestration
   * @param {string} planId - Plan identifier to cancel
   */
  cancelOrchestration(planId) {
    const plan = this.activePlans.get(planId);
    
    if (!plan) {
      console.warn(`[Orchestrator] Plan ${planId} not found`);
      return;
    }

    console.log(`[Orchestrator] Cancelling orchestration ${planId}`);
    
    // Mark as cancelled
    plan.status = 'cancelled';
  }

  /**
   * Get status of all active orchestrations
   * @returns {Array<{ planId: string, progress: number, subtasks: Subtask[] }>}
   */
  getActiveOrchestrations() {
    const result = [];

    for (const [planId, plan] of this.activePlans.entries()) {
      if (plan.status === 'cancelled') continue;

      // Calculate progress
      const totalSubtasks = plan.subtasks.length;
      const completedSubtasks = plan.subtasks.filter(t => t.result !== null).length;
      const progress = Math.round((completedSubtasks / totalSubtasks) * 100);

      result.push({
        planId,
        progress,
        subtasks: plan.subtasks,
        status: plan.status,
        estimatedTotalTimeMs: plan.estimatedTotalTimeMs,
        elapsedMs: plan.startedAt ? Date.now() - new Date(plan.startedAt).getTime() : 0,
      });
    }

    return result;
  }

  /**
   * Get statistics about orchestration activity
   * @returns {Object} Statistics object
   */
  getStats() {
    const active = this.getActiveOrchestrations();

    return {
      activePlans: active.length,
      totalSubtasks: active.reduce((sum, p) => sum + p.subtasks.length, 0),
      completedSubtasks: active.reduce((sum, p) => 
        sum + p.subtasks.filter(t => t.result !== null).length
      , 0),
    };
  }
}

// Export singleton instance
export const taskOrchestrator = new TaskOrchestrator();

/**
 * Initialize orchestrator on module load
 * @returns {Promise<TaskOrchestrator>} Initialized orchestrator
 */
export async function initializeOrchestrator() {
  if (!taskOrchestrator.activePlans || taskOrchestrator.activePlans.size === 0) {
    await taskOrchestrator.initialize();
  }
  return taskOrchestrator;
}

// For testing: reset singleton state
export function resetOrchestrator() {
  taskOrchestrator.shutdown();
}