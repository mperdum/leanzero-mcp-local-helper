/**
 * Task Decomposer - LM Link Multi-Device Orchestrator
 * Decomposes complex tasks into parallelizable subtasks
 */

import { loadModelDNA } from './model-dna-manager.js';

// Task type definitions
export const TASK_TYPES = {
  RESEARCH: 'research',
  CODE_GENERATION: 'code-generation',
  ANALYSIS: 'analysis',
  SYNTHESIS: 'synthesis',
};

/**
 * Analyze task complexity and determine if it requires parallelism
 * @param {string} task - Task description to analyze
 * @returns {{ complexity: 'simple' | 'moderate' | 'complex', requiresParallelism: boolean }}
 */
export function analyzeTask(task) {
  const dna = loadModelDNA();
  const thresholds = dna?.orchestratorConfig?.complexityThresholds || {
    complexWordCount: 50,
    moderateWordCount: 20
  };

  // Count key indicators of complexity
  const wordCount = task.trim().split(/\s+/).length;
  
  // Look for patterns indicating multiple subtasks
  const hasMultipleQuestions = (task.match(/[?]/g) || []).length > 1;
  const hasNumberedList = /\d+\.\s/.test(task);
  const hasParallelRequests = task.toLowerCase().includes('and') && 
    !/and\s+(only|just)\b/.test(task.toLowerCase());
  
  // Determine complexity
  let complexity = 'simple';
  if (wordCount > thresholds.complexWordCount || hasMultipleQuestions) {
    complexity = 'complex';
  } else if (wordCount > thresholds.moderateWordCount || hasParallelRequests || hasNumberedList) {
    complexity = 'moderate';
  }

  return {
    complexity,
    requiresParallelism: complexity !== 'simple',
  };
}

/**
 * Subtask class for tracking decomposition results
 */
export class Subtask {
  constructor(id, type, prompt, options = {}) {
    this.id = id;
    this.type = type;
    this.prompt = prompt;
    this.requiredCapabilities = options.requiredCapabilities || [];
    this.assignedDeviceId = options.assignedDeviceId || null;
    this.assignedModelKey = options.assignedModelKey || null;
    this.priority = options.priority || 3; // 1-5, higher = more important
    this.dependencies = options.dependencies || [];
    this.result = null;
  }

  /**
   * Check if subtask is ready to execute (all dependencies completed)
   * @param {Set<string>} completedIds - IDs of completed subtasks
   * @returns {boolean}
   */
  isReady(completedIds) {
    return this.dependencies.every(depId => completedIds.has(depId));
  }

  /**
   * Mark subtask as completed with result
   * @param {Object} result - Completion result
   */
  complete(result) {
    this.result = {
      content: result.content,
      success: result.success,
      deviceId: result.deviceId || null,
      modelKey: result.modelKey || null,
      durationMs: result.durationMs || 0,
      error: result.error || undefined,
    };
  }

  /**
   * Get execution priority score (higher = execute first)
   * @returns {number}
   */
  getPriorityScore() {
    // Base priority (1-5, higher number = higher priority = lower score for execution order)
    const baseScore = this.priority * 10;
    
    // Bonus for tasks with dependencies
    const depBonus = this.dependencies.length > 0 ? 2 : 0;
    
    return baseScore + depBonus;
  }
}

/**
 * Decompose a complex task into subtasks
 * @param {string} task - Original task description
 * @param {Object} [options={}] - Decomposition options
 * @param {'heuristic' | 'llm'} [options.mode='heuristic'] - The method to use
 * @param {number} [options.maxSubtasks=5] - Maximum number of subtasks to generate
 * @returns {Promise<Subtask[]>}
 */
export async function decompose(task, options = {}) {
  const { mode = 'heuristic', maxSubtasks = 5 } = options;

  if (mode === 'llm') {
    return await llmDecompose(task, maxSubtasks);
  }

  const subtasks = [];
  
  // Strategy 1: Code-related task decomposition (highest priority for code tasks)
  // Use more specific patterns to avoid false positives from words like "code" in general tasks
  if (/(\bfunction\b|\bclass\b|\bcreate\b|\bwrite\b.*\bfunction|\.js|\.(ts|py|java|cpp)|^\s*(export\s+)?(const|let|var)\s+\w+\s*=)/i.test(task)) {
    const codeParts = analyzeCodeTask(task);
    
    for (let i = 0; i < Math.min(codeParts.length, maxSubtasks); i++) {
      subtasks.push(createSubtask(i + 1, TASK_TYPES.CODE_GENERATION, codeParts[i]));
    }
  }
  
  // Strategy 2: Split by numbered list
  else if (/(\d+\.\s+)/.test(task)) {
    const parts = splitByNumbered(task);
    
    for (let i = 0; i < Math.min(parts.length, maxSubtasks); i++) {
      subtasks.push(createSubtask(i + 1, TASK_TYPES.ANALYSIS, parts[i]));
    }
  }
  
  // Strategy 3: Split by question marks (research-oriented)
  else if (task.split('?').length > 2) {
    const questions = extractQuestions(task);
    
    for (let i = 0; i < Math.min(questions.length, maxSubtasks); i++) {
      subtasks.push(createSubtask(i + 1, TASK_TYPES.RESEARCH, questions[i]));
    }
  }
  
  // Strategy 4: Split by "and" connector (parallelizable)
  else if (/and\b/i.test(task)) {
    const parts = splitByAnd(task);
    
    for (let i = 0; i < Math.min(parts.length, maxSubtasks); i++) {
      subtasks.push(createSubtask(i + 1, TASK_TYPES.RESEARCH, parts[i]));
    }
  }
  
  // Strategy 5: If no pattern matches, treat as single synthesis task
  if (subtasks.length === 0) {
    subtasks.push(createSubtask(1, TASK_TYPES.SYNTHESIS, task));
  }

  console.log(`[TaskDecomposer] Decomposed into ${subtasks.length} subtasks`);

  return subtasks;
}

/**
 * LLM-driven decomposition strategy
 * @param {string} task - Original task description
 * @param {number} maxSubtasks - Maximum number of subtasks
 * @returns {Promise<Subtask[]>}
 */
async function llmDecompose(task, maxSubtasks) {
  console.log('[TaskDecomposer] Performing LLM-driven decomposition...');
  
  let lmStudioSwitcher;
  try {
    const module = await import('./lm-studio-switcher.js');
    lmStudioSwitcher = module.lmStudioSwitcher;
  } catch (error) {
    console.error('[TaskDecomposer] Failed to import lmStudioSwitcher for LLM decomposition:', error.message);
    // Fallback to heuristic
    return decompose(task, { mode: 'heuristic', maxSubtasks });
  }

  // Get model for decomposition from DNA (if possible)
  let decompositionModel = 'architect';
  try {
    const { loadModelDNA } = await import('./model-dna-manager.js');
    const dna = loadModelDNA();
    decompositionModel = dna?.taskModelMapping?.decompose || 'architect';
  } catch (e) {
    console.warn('[TaskDecomposer] Could not load DNA for decomposition model, using default');
  }

  const systemPrompt = `You are an expert task orchestrator. Your goal is to decompose a user's complex request into a sequence of logical, parallelizable subtasks.

RULES:
1. Output ONLY a valid JSON array of objects.
2. Each object represents a subtask and MUST have:
   - "id": a unique string like "subtask-1"
   - "type": one of [${Object.values(TASK_TYPES).join(', ')}]
   - "prompt": a clear, concise instruction for an AI to execute this specific part
   - "dependencies": an array of "id"s of subtasks that must be completed BEFORE this one can start (empty array if first)
3. Aim for a maximum of ${maxSubtasks} subtasks.
4. Identify opportunities for parallel execution by minimizing dependencies where possible.
5. Ensure the final subtask(s) perform "synthesis" to combine all previous findings.

EXAMPLE OUTPUT FORMAT:
[
  {
    "id": "subtask-1",
    "type": "${TASK_TYPES.RESEARCH}",
    "prompt": "Analyze the impact of X on Y",
    "dependencies": []
  },
  {
    "id": "subtask-2",
    "type": "${TASK_TYPES.ANALYSIS}",
    "prompt": "Compare the findings from subtask-1 with Z",
    "dependencies": ["subtask-1"]
  },
  {
    "id": "subtask-3",
    "type": "${TASK_TYPES.SYNTHESIS}",
    "prompt": "Summarize all findings into a final report",
    "dependencies": ["subtask-1", "subtask-2"]
  }
]`;

  try {
    const result = await lmStudioSwitcher.executeChatCompletion(
      decompositionModel,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Decompose this task: "${task}"` }
      ],
      {
        temperature: 0.2,
        taskType: 'task-decomposition'
      }
    );

    if (!result.success) {
      throw new Error(result.error);
    }

    // Extract JSON from potential markdown blocks
    let jsonString = result.result.content.trim();
    if (jsonString.startsWith('```json')) {
      jsonString = jsonString.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (jsonString.startsWith('```')) {
      jsonString = jsonString.replace(/^```/, '').replace(/```$/, '').trim();
    }

    const parsed = JSON.parse(jsonString);

    if (!Array.isArray(parsed)) {
      throw new Error('LLM did not return a JSON array');
    }

    // Convert to Subtask instances
    return parsed.map((item, index) => {
      const subtask = new Subtask(
        item.id || `subtask-${index + 1}`,
        item.type || TASK_TYPES.RESEARCH,
        item.prompt || task,
        {
          dependencies: item.dependencies || [],
          requiredCapabilities: item.requiredCapabilities || ['llm']
        }
      );
      return subtask;
    }).slice(0, maxSubtasks);

  } catch (error) {
    console.error('[TaskDecomposer] LLM decomposition failed:', error.message);
    // Fallback to heuristic on failure
    console.log('[TaskDecomposer] Falling back to heuristic decomposition');
    return decompose(task, { mode: 'heuristic', maxSubtasks });
  }
}

/**
 * Split task by "and" connector
 * @param {string} task - Task description
 * @returns {string[]} Parts of the task
 */
function splitByAnd(task) {
  // Match "X and Y" patterns but not "only" or "just"
  const match = task.match(/(.+?)\s+and\s+(.+)$/i);
  
  if (match) {
    return [match[1].trim(), match[2].trim()];
  }
  
  return [task];
}

/**
 * Split task by numbered list
 * @param {string} task - Task description
 * @returns {string[]} Parts of the task
 */
function splitByNumbered(task) {
  const parts = [];
  
  // Match each numbered item: "1. content" or "2. other"
  // Use a pattern that captures: number, optional dot, space, then non-number content until next number or end
  const regex = /(\d+\.?\s+)([^0-9]+?)(?=\d+\.|\d+\s|$)/g;
  let match;
  
  while ((match = regex.exec(task)) !== null) {
    parts.push(match[2].trim());
  }
  
  if (parts.length === 0) {
    // Fallback: just split by numbers
    const numRegex = /(\d+\.?\s+)/g;
    let partsWithoutNum = task.split(numRegex).filter(s => s && !/^\d/.test(s));
    
    if (partsWithoutNum.length > 0) {
      return partsWithoutNum.map(p => p.trim());
    }
    
    parts.push(task);
  }
  
  return parts;
}

/**
 * Extract questions from task
 * @param {string} task - Task description
 * @returns {string[]} Questions to answer
 */
function extractQuestions(task) {
  // Split by question mark and filter empty strings
  const parts = task.split('?').filter(p => p.trim().length > 0);
  
  // Reconstruct questions with question marks
  return parts.map(p => (p.includes(' ') ? p + '?' : p));
}

/**
 * Analyze code-related task for decomposition
 * @param {string} task - Code task description
 * @returns {string[]} Task components
 */
function analyzeCodeTask(task) {
  const components = [];
  
  // Look for common code patterns
  if (/create|write/i.test(task)) {
    components.push(`Write the main implementation`);
    if (task.match(/test/i)) {
      components.push(`Add tests for the implementation`);
    }
  } else if (/fix|debug/i.test(task)) {
    components.push(`Identify the root cause of the issue`);
    components.push(`Implement a fix for the problem`);
  } else if (/function|calculate/i.test(task)) {
    components.push(`Implement the main function logic`);
    components.push(`Add unit tests for the function`);
  }
  
  // Fallback: split by logical steps
  if (components.length === 0) {
    const match = task.match(/(.+?)\s+(and|then|next)\s+(.+)/i);
    
    if (match) {
      components.push(match[1].trim());
      components.push(match[3].trim());
    } else {
      components.push(task);
    }
  }
  
  return components;
}

/**
 * Create a subtask from text
 * @param {number} id - Subtask ID
 * @param {string} type - Task type (research, code-generation, analysis, synthesis)
 * @param {string} prompt - The task description
 * @returns {Subtask}
 */
function createSubtask(id, type, prompt) {
  return new Subtask(`subtask-${id}`, type, prompt);
}

/**
 * Build execution order from subtasks (DAG layering)
 * @param {Subtask[]} subtasks - Array of subtasks
 * @returns {string[][]} Arrays of subtask IDs that can run in parallel
 */
export function buildExecutionOrder(subtasks) {
  if (!Array.isArray(subtasks) || subtasks.length === 0) {
    return [];
  }

  // Build dependency graph
  const remaining = new Map();
  for (const task of subtasks) {
    remaining.set(task.id, { ...task, pendingDeps: [...task.dependencies] });
  }

  const layers = [];

  while (remaining.size > 0) {
    // Find tasks with no pending dependencies
    const readyLayer = [];
    
    for (const [id, taskData] of remaining.entries()) {
      if (taskData.pendingDeps.length === 0) {
        readyLayer.push(id);
      }
    }

    // If no tasks are ready but we have remaining, there's a cycle
    if (readyLayer.length === 0 && remaining.size > 0) {
      console.warn('[TaskDecomposer] Cycle detected in task dependencies');
      // Break the cycle by adding remaining to final layer
      for (const [id] of remaining.entries()) {
        readyLayer.push(id);
      }
    }

    if (readyLayer.length === 0) break;

    layers.push(readyLayer);

    // Remove completed tasks and update dependencies
    for (const id of readyLayer) {
      remaining.delete(id);
      
      for (const [otherId, otherTask] of remaining.entries()) {
        otherTask.pendingDeps = otherTask.pendingDeps.filter(
          dep => dep !== id
        );
      }
    }
  }

  return layers;
}

/**
 * Validate decomposition and check for issues
 * @param {Object} plan - Orchestration plan with subtasks
 * @returns {{ valid: boolean, issues: string[] }}
 */
export function validateDecomposition(plan) {
  const issues = [];

  if (!plan || !Array.isArray(plan.subtasks)) {
    issues.push('Invalid or missing subtasks');
    return { valid: false, issues };
  }

  // First pass: check for duplicate IDs and collect all task IDs
  const allTaskIds = new Set();
  let hasDuplicate = false;
  
  for (const task of plan.subtasks) {
    if (allTaskIds.has(task.id)) {
      hasDuplicate = true;
    }
    allTaskIds.add(task.id);
  }
  
  if (hasDuplicate) {
    issues.push('Duplicate subtask IDs found');
  }

  // Second pass: validate each task
  for (const task of plan.subtasks) {
    // Validate dependencies reference existing tasks
    for (const depId of task.dependencies) {
      // Check if dependency is self-reference first
      if (depId === task.id) {
        issues.push(`Subtask ${task.id} depends on itself`);
      }
      // Check if dependency references a non-existent task
      else if (!allTaskIds.has(depId)) {
        issues.push(`Subtask ${task.id} depends on non-existent subtask: ${depId}`);
      }
    }
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Estimate execution time for a plan
 * @param {Object} plan - Orchestration plan
 * @returns {number} Estimated total time in milliseconds
 */
export function estimateExecutionTime(plan) {
  if (!plan || !Array.isArray(plan.subtasks)) {
    return 0;
  }

  const dna = loadModelDNA();
  const averageSubtaskMs = dna?.orchestratorConfig?.averageSubtaskMs || 30000;
  const parallelLayers = plan.executionOrder ? plan.executionOrder.length : 1;

  return Math.ceil(averageSubtaskMs * (plan.subtasks.length / parallelLayers));
}

/**
 * Select appropriate task type based on content analysis
 * @param {string} prompt - Task description
 * @returns {string} Task type constant
 */
export function selectTaskType(prompt) {
  const lower = prompt.toLowerCase();

  if (/code|function|class|create|write|fix|debug/i.test(lower)) {
    return TASK_TYPES.CODE_GENERATION;
  } else if (/\?/.test(lower) && !/code|fix|debug/i.test(lower)) {
    return TASK_TYPES.RESEARCH;
  } else if (/(analysis|evaluate|compare|assessment)/i.test(lower)) {
    return TASK_TYPES.ANALYSIS;
  }
  
  // Special handling for "Analyze" verb
  if (/^analyze\b/.test(lower) || /analyze\s+(the|this|these|those)/.test(lower)) {
    return TASK_TYPES.ANALYSIS;
  }
  
  return TASK_TYPES.SYNTHESIS;
}