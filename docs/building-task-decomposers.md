# Building Task Decomposers - Developer Guide

**Last Updated:** April 3, 2026  
**Purpose:** Guide for implementing task decomposition strategies in the MCP Local Helper

---

## Overview

Task decomposition is the process of breaking complex tasks into smaller, parallelizable subtasks. This enables efficient multi-device orchestration and distributed execution.

### Decomposition Strategies
1. **Code Pattern Matching** - Split by code-related patterns (functions, classes)
2. **Numbered List Parsing** - Split by numbered steps in task description
3. **Question Extraction** - Split by questions for research tasks
4. **Conjunction Analysis** - Split by "and" connectors for parallel execution
5. **Synthesis Fallback** - Single synthesis task when no pattern matches

---

## File Structure

```
src/utils/
├── task-decomposer.js    # Main decomposition logic
└── [related utilities...] # Task classifier, etc.
```

### Key Components
- `analyzeTask()` - Determine if parallelism is needed
- `decompose()` - Core decomposition function with multiple strategies
- `buildExecutionOrder()` - Build DAG for dependency ordering
- `Subtask` class - Track individual subtasks

---

## Subtask Class Reference

```javascript
export class Subtask {
  constructor(id, type, prompt, options = {}) {
    this.id = id;
    this.type = type; // 'research', 'code-generation', 'analysis', 'synthesis'
    this.prompt = prompt;
    this.requiredCapabilities = options.requiredCapabilities || [];
    this.assignedDeviceId = options.assignedDeviceId || null;
    this.assignedModelKey = options.assignedModelKey || null;
    this.priority = options.priority || 3; // 1-5, higher = more important
    this.dependencies = options.dependencies || []; // Array of subtask IDs
    this.result = null;
  }
  
  isReady(completedIds) { ... }
  complete(result) { ... }
  getPriorityScore() { ... }
}
```

---

## Task Types

```javascript
export const TASK_TYPES = {
  RESEARCH: 'research',
  CODE_GENERATION: 'code-generation',
  ANALYSIS: 'analysis',
  SYNTHESIS: 'synthesis',
};
```

### Task Type Characteristics

| Type | When to Use | Example Keywords |
|------|-------------|------------------|
| `research` | Information gathering, comparisons | "research", "compare", "analyze" |
| `code-generation` | Writing or modifying code | "function", "class", ".js", ".ts" |
| `analysis` | Breaking down structured tasks | Numbered lists, step-by-step |
| `synthesis` | Single comprehensive response | Fallback for simple tasks |

---

## Decomposition Strategy Priority

The task decomposer uses these strategies in priority order:

### 1. Code Patterns (Highest Priority)
**Triggered when:** Task contains code-related keywords or patterns.

```javascript
const hasCodePattern = /(\bfunction\b|\bclass\b|\bcreate\b|\bwrite\b.*\bfunction|\.js|\.(ts|py|java|cpp)|^\s*(export\s+)?(const|let|var)\s+\w+\s*=)/i.test(task);
```

**Example Tasks:**
- "Write a function to calculate Fibonacci numbers"
- "Create a React component with state management"
- "Implement a class for user authentication"

### 2. Numbered List Parsing
**Triggered when:** Task contains numbered steps.

```javascript
const hasNumberedList = /\d+\.\s/.test(task);
```

**Example Tasks:**
- "1. Install dependencies, 2. Configure project, 3. Run tests"
- "1. Research React, 2. Compare Vue, 3. Write summary"

### 3. Question Extraction
**Triggered when:** Multiple questions in task.

```javascript
const hasMultipleQuestions = (task.split('?').length > 2);
```

**Example Tasks:**
- "What is React? How does it compare to Vue? Why use it for enterprise?"

### 4. Conjunction Analysis ("and" connector)
**Triggered when:** Task contains "and" connectors.

```javascript
const hasParallelRequests = task.toLowerCase().includes('and') && 
  !/and\s+(only|just)\b/.test(task.toLowerCase());
```

**Example Tasks:**
- "Research React and compare Vue"
- "Write code, add tests, and deploy"

### 5. Synthesis Fallback
**Triggered when:** No specific pattern matches - treat as single task.

---

## Build Execution Order (DAG)

The execution order is built as a Directed Acyclic Graph (DAG) where:

1. **Layer 1**: Tasks with no dependencies (can run in parallel)
2. **Layer 2+**: Tasks that depend on previous layers

### Example DAG

**Task:** "Create React app, write tests, deploy to production"

```
Layer 1: [create-react-app, write-tests]  // No dependencies
         ↓
Layer 2: [deploy-to-production]           // Depends on Layer 1
```

---

## Step-by-Step Implementation

### Step 1: Analyze Task Complexity

**File:** `src/utils/task-decomposer.js`

```javascript
export function analyzeTask(task) {
  const wordCount = task.trim().split(/\s+/).length;
  const hasMultipleQuestions = (task.match(/[?]/g) || []).length > 1;
  const hasNumberedList = /\d+\.\s/.test(task);
  
  // Determine complexity
  let complexity = 'simple';
  if (wordCount > 50 || hasMultipleQuestions) {
    complexity = 'complex';
  } else if (wordCount > 20 || hasParallelRequests || hasNumberedList) {
    complexity = 'moderate';
  }

  return {
    complexity,
    requiresParallelism: complexity !== 'simple',
  };
}
```

### Step 2: Implement Decomposition

```javascript
export function decompose(task, maxSubtasks = 5) {
  const subtasks = [];
  
  // Strategy 1: Code patterns (highest priority)
  if (/(\bfunction\b|\bclass\b|\bcreate\b)/i.test(task)) {
    const codeParts = analyzeCodeTask(task);
    
    for (let i = 0; i < Math.min(codeParts.length, maxSubtasks); i++) {
      subtasks.push(createSubtask(i + 1, TASK_TYPES.CODE_GENERATION, codeParts[i]));
    }
  }
  
  // Strategy 2: Numbered list
  else if (/\d+\.\s/.test(task)) {
    const parts = splitByNumbered(task);
    
    for (let i = 0; i < Math.min(parts.length, maxSubtasks); i++) {
      subtasks.push(createSubtask(i + 1, TASK_TYPES.ANALYSIS, parts[i]));
    }
  }
  
  // Strategy 3: Questions
  else if (task.split('?').length > 2) {
    const questions = extractQuestions(task);
    
    for (let i = 0; i < Math.min(questions.length, maxSubtasks); i++) {
      subtasks.push(createSubtask(i + 1, TASK_TYPES.RESEARCH, questions[i]));
    }
  }
  
  // Strategy 4: "and" connector
  else if (/and\b/i.test(task)) {
    const parts = splitByAnd(task);
    
    for (let i = 0; i < Math.min(parts.length, maxSubtasks); i++) {
      subtasks.push(createSubtask(i + 1, TASK_TYPES.RESEARCH, parts[i]));
    }
  }
  
  // Strategy 5: Synthesis fallback
  if (subtasks.length === 0) {
    subtasks.push(createSubtask(1, TASK_TYPES.SYNTHESIS, task));
  }
  
  return subtasks;
}
```

### Step 3: Build Execution Order

```javascript
export function buildExecutionOrder(subtasks) {
  const executionOrder = [];
  const completedIds = new Set();
  
  while (completedIds.size < subtasks.length) {
    const layer = [];
    
    for (const subtask of subtasks) {
      if (!completedIds.has(subtask.id) && 
          subtask.dependencies.every(dep => completedIds.has(dep))) {
        layer.push(subtask.id);
      }
    }
    
    if (layer.length > 0) {
      executionOrder.push(layer);
      layer.forEach(id => completedIds.add(id));
    } else if (completedIds.size < subtasks.length) {
      // Fallback: add remaining tasks as independent
      const remaining = subtasks.filter(t => !completedIds.has(t.id));
      const nextLayer = remaining.map(t => t.id);
      executionOrder.push(nextLayer);
      nextLayer.forEach(id => completedIds.add(id));
    }
  }
  
  return executionOrder;
}
```

---

## Testing Decomposition

**File:** `tests/task-decomposer.test.js`

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { analyzeTask, decompose, Subtask, buildExecutionOrder } 
  from '../src/utils/task-decomposer.js';

describe('task-decomposer', () => {
  it('should analyze task complexity correctly', () => {
    // Simple task
    const simpleResult = analyzeTask('Write a function');
    assert.strictEqual(simpleResult.complexity, 'simple');
    assert.strictEqual(simpleResult.requiresParallelism, false);
    
    // Complex task with multiple questions
    const complexResult = analyzeTask(
      'What is React? How does it compare to Vue? Why use it for enterprise?'
    );
    assert.strictEqual(complexResult.complexity, 'complex');
    assert.strictEqual(complexResult.requiresParallelism, true);
  });

  it('should decompose code-related task', () => {
    const task = 'Write a function to calculate Fibonacci and create a class for validation';
    const subtasks = decompose(task, 3);
    
    assert.ok(subtasks.length >= 1);
    // Should use CODE_GENERATION type
    assert.ok(subtasks.some(st => st.type === 'code-generation'));
  });

  it('should build correct execution order with dependencies', () => {
    const subtasks = [
      new Subtask('subtask-1', 'synthesis', 'First task'),
      new Subtask('subtask-2', 'research', 'Second task', { dependencies: ['subtask-1'] }),
      new Subtask('subtask-3', 'analysis', 'Third task', { dependencies: ['subtask-1'] }),
    ];
    
    const executionOrder = buildExecutionOrder(subtasks);
    
    // Layer 1 should have subtask-1 (no deps)
    assert.strictEqual(executionOrder[0][0], 'subtask-1');
    // Layer 2 should have subtask-2 and subtask-3 (depend on layer 1)
    assert.ok(executionOrder[1].includes('subtask-2'));
    assert.ok(executionOrder[1].includes('subtask-3'));
  });
});
```

---

## Integration with Orchestrator

The orchestrator uses the decomposer as follows:

```javascript
import {
  analyzeTask,
  decompose,
  buildExecutionOrder,
  Subtask,
} from '../utils/task-decomposer.js';

export class TaskOrchestrator {
  async decomposeTask(task, context = {}) {
    // Analyze task complexity
    const analysis = analyzeTask(task);
    
    if (!analysis.requiresParallelism) {
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
    
    // Build execution order
    const executionOrder = buildExecutionOrder(subtasks);
    
    return {
      originalTask: task,
      subtasks,
      executionOrder,
      estimatedTotalTimeMs: estimateExecutionTime({ subtasks, executionOrder }),
      requiredDevices: new Set(),
    };
  }
}
```

---

## Common Patterns

### Pattern 1: Capability-Aware Decomposition
Add required capabilities to subtasks:
```javascript
const subtask = createSubtask(id, type, prompt, {
  requiredCapabilities: ['vision', 'toolUse'],
});
```

### Pattern 2: Priority-Based Ordering
Assign priorities for execution order:
```javascript
subtasks.sort((a, b) => b.priority - a.priority);
```

### Pattern 3: Device Assignment
Assign specific devices to subtasks:
```javascript
const subtask = createSubtask(id, type, prompt, {
  assignedDeviceId: 'device-abc123',
  assignedModelKey: 'llama-3.2-9b',
});
```

---

## Best Practices

1. **Strategy Priority**: Follow the priority order (code > numbered > questions > and > synthesis)
2. **Subtask Size**: Keep subtasks focused on single objectives
3. **Dependencies**: Explicitly declare dependencies when tasks must run in sequence
4. **Testing**: Test each decomposition strategy individually
5. **Documentation**: Document which strategies work best for different task types

---

## Next Steps

After implementing a decomposer:

1. Test with various task types to validate strategy selection
2. Profile execution times for different decomposition patterns
3. Consider adding new strategies as needed (e.g., markdown parsing, API patterns)