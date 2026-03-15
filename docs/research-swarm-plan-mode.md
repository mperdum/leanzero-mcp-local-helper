# Research Swarm Plan Mode Integration Guide

## Overview

This document explains how to integrate the Research Swarm orchestrator with Cline's "Plan Mode" for automatic orchestration of research queries using lightweight models.

## The Challenge: Detecting Plan Mode in Cline

**Important Finding:** The MCP protocol does NOT expose a direct `plan_mode` flag or event when Cline enters Plan Mode. However, there are several approaches to detect and leverage this mode:

### Current State of Plan Mode Detection

1. **MCP Protocol Limitation**: There's no standard `clinedraft` flag or plan_mode indicator in MCP tool invocations
2. **Cline-Specific Implementation**: Cline may include hints in the request structure that can be detected
3. **Workaround**: Use task characteristics to determine if swarm orchestration is appropriate

### Detection Strategies

#### Strategy 1: Task Characteristics (Recommended)

Research queries typically have these characteristics:

| Characteristic | Plan Mode Likely | Act Mode Likely |
|----------------|------------------|-----------------|
| Query length > 50 words | ✓ | ✗ |
| Contains "research", "analyze", "compare" | ✓ | ✗ |
| No specific code file references | ✓ | ✗ |
| Open-ended questions | ✓ | ✗ |
| Multi-faceted topics | ✓ | ✗ |

#### Strategy 2: Query Pattern Matching

```javascript
// Example detection logic
function isResearchQuery(query) {
  const researchKeywords = [
    'research', 'analyze', 'compare', 'overview', 'summary',
    'investigate', 'examine', 'evaluate', 'study', 'survey'
  ];
  
  const openEndedPattern = /what.*is|how.*does|why.*does|compare.*vs| overview of/;
  
  return (
    query.length > 50 &&
    (researchKeywords.some(k => query.toLowerCase().includes(k)) ||
     openEndedPattern.test(query))
  );
}
```

#### Strategy 3: User-Initiated Trigger

Users can explicitly call the `research-swarm` tool when they want to use lightweight models:

```json
{
  "tool": "research-swarm",
  "query": "Research best practices for React state management in 2025"
}
```

## Implementation: Research Swarm Tool

The `research-swarm` tool is designed to be called from Cline when it detects a research/plan phase.

### How It Works

1. **Decomposition**: Complex queries are broken into subtasks
2. **Dispatch**: Subtasks distributed across available lightweight models
3. **Execution**: Parallel execution on multiple devices
4. **Aggregation**: Results combined and compacted

### Example Invocation from Cline

```json
{
  "tool": "research-swarm",
  "query": "Compare React, Vue, and Svelte frameworks for enterprise applications including performance benchmarks, community support, and long-term viability"
}
```

## Integration with Cline Plan Mode

### Option A: Manual Trigger (Simplest)

Instruct users to call `research-swarm` directly when entering Plan Mode:

```
User: "I'm researching React vs Vue for an enterprise app. Let me use the research swarm tool."
Cline calls: research-swarm with query
```

### Option B: Automatic Detection

Add detection logic in Cline's MCP client wrapper:

```javascript
// Before executing any task, check if it's research-related
async function determineTaskType(query) {
  const researchKeywords = ['research', 'analyze', 'compare', 'overview'];
  
  if (query.length > 100 || 
      researchKeywords.some(k => query.toLowerCase().includes(k))) {
    return 'research';
  }
  return 'act';
}

// Route to appropriate tool
async function executeWithMcp(client, query) {
  const taskType = await determineTaskType(query);
  
  if (taskType === 'research') {
    // Use research swarm for plan mode
    return await client.tools.callTool('research-swarm', { query });
  } else {
    // Use standard execution for act mode
    return await client.tools.callTool('execute-task', { query });
  }
}
```

### Option C: Dual-Mode Execution

Modify `execute-task` to automatically delegate to research-swarm when appropriate:

```javascript
// In execute-task.js
async function handleExecuteTask(params) {
  // Check if this is a research query that should use swarm
  const dna = loadModelDNA();
  
  if (dna.orchestratorConfig?.swarm?.enabled && 
      isResearchQuery(params.query)) {
    return await executeResearchSwarm({
      query: params.query,
      maxSubtasks: dna.orchestratorConfig.swarm.maxSubtasks || 4
    });
  }
  
  // Standard execution...
}
```

## Configuration

### Enable Research Swarm

Add to `.model-dna.json`:

```json
{
  "orchestratorConfig": {
    "swarm": {
      "enabled": true,
      "maxLightweightModelsPerDevice": 2,
      "subtaskMaxTokens": 4000,
      "finalAggregationMaxTokens": 8000,
      "minMemoryGB": 8,
      "maxSubtasks": 8,
      "fallbackEnabled": true
    }
  }
}
```

### Supported Lightweight Models

```json
{
  "lightweightModelIds": [
    "qwen3.5-9b-omnicoder-claude-polaris-text-dwq4-mlx",
    "meta-llama-3.2-9b-instruct"
  ]
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Cline Plan Mode                          │
│              (User enters research phase)                   │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              MCP Client Wrapper                             │
│         Detects research query characteristics             │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                  research-swarm Tool                        │
│          Validates guardrails and constraints              │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│          ResearchSwarmOrchestrator                          │
│  - Decomposes query into subtasks                          │
│  - Dispatches to lightweight models on devices             │
│  - Aggregates and compacts results                         │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│           Distributed Execution (Multiple Devices)          │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│   │   Device 1   │  │   Device 2   │  │   Device 3   │    │
│   │  qwen3.5-9b  │  │  qwen3.5-9b  │  │  llama-3.2-9b│    │
│   │              │  │              │  │              │    │
│   │ Subtask A    │  │ Subtask B    │  │ Subtask C    │    │
│   └──────────────┘  └──────────────┘  └──────────────┘    │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              Compacted Final Result                         │
│      (~2048 tokens, ready for Cline response)               │
└─────────────────────────────────────────────────────────────┘
```

## Best Practices

### 1. Query Design

**Good research queries:**
- "Compare React vs Vue for enterprise applications including performance benchmarks"
- "Research best practices for React state management in 2025"
- "Analyze the pros and cons of different database sharding strategies"

**Not ideal for swarm:**
- "Write a function to calculate Fibonacci numbers" (too specific)
- "Fix the bug in src/main.js" (actionable, needs code execution)

### 2. Performance Optimization

- Use `maxSubtasks` to limit parallelism based on available devices
- Enable `compact=true` for longer results
- Consider caching common research queries

### 3. Monitoring

```bash
# Check research swarm status
curl http://localhost:1234/tools/research-swarm/status

# View active subtasks
curl http://localhost:1234/tools/research-swarm/active

# Get statistics
curl http://localhost:1234/tools/research-swarm/stats
```

## Testing

### Unit Test Example

```javascript
import { executeResearchSwarm } from '../tools/research-swarm.js';

describe('research-swarm', () => {
  it('should decompose and orchestrate research queries', async () => {
    const result = await executeResearchSwarm({
      query: 'Compare React and Vue frameworks',
      maxSubtasks: 2,
    });
    
    expect(result.success).toBe(true);
    expect(result.totalSubtasks).toBeGreaterThan(0);
    expect(result.aggregatedResult.tokenCount).toBeLessThan(4096);
  });
});
```

## Troubleshooting

### Issue: No devices available

**Solution**: Ensure LM Studio is running with models loaded, and devices are online via Tailscale.

### Issue: Memory constraints

**Solution**: Reduce `maxLightweightModelsPerDevice` or increase system RAM.

### Issue: Slow execution

**Solution**: Use fewer subtasks (`maxSubtasks: 2`) for faster completion.

## Future Enhancements

1. **Smart Decomposition**: Use a dedicated model to intelligently split queries
2. **Adaptive Parallelism**: Adjust subtask count based on available resources
3. **Caching**: Cache common research results for faster responses
4. **Multi-level Aggregation**: Hierarchical summarization for very large queries

## Conclusion

The Research Swarm orchestrator provides a powerful way to distribute research queries across multiple lightweight models, enabling parallel exploration and efficient result aggregation. While MCP doesn't expose plan mode directly, the research-swarm tool can be invoked manually or detected automatically based on query characteristics.

For best results:
- Use manual invocation when Cline enters Plan Mode
- Implement automatic detection in your MCP client wrapper
- Design queries specifically for research/orchestration