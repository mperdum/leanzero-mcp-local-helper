# Implementation Plan: SWARM Research Orchestrator

## Overview

Implement a SWARM-like orchestration system for MCP Local Helper that detects planning/research intent, distributes lightweight models (5.6GB like qwen3.5-9b) across multiple devices, performs parallel research with guardrails, and aggregates results into a compacted 8000-token final response.

## Scope

This implementation adds a new `research-swarm` tool that enables:
1. Explicit user-triggered orchestration for research tasks
2. Automatic distribution of lightweight models across LM Link network devices
3. Parallel processing with result compaction (4000 tokens per subtask)
4. Final aggregation synthesis (8000 tokens max)

## Types

### DNA Configuration Schema (Extended)
```json
{
  "orchestratorConfig": {
    "enabled": true,
    "swarm": {
      "maxLightweightModelsPerDevice": 2,
      "subtaskMaxTokens": 4000,
      "finalAggregationMaxTokens": 8000,
      "minMemoryGB": 8
    },
    "lightweightModelIds": [
      "qwen3.5-9b-omnicoder-claude-polaris-text-dwq4-mlx",
      "meta-llama-3.2-9b-instruct"
    ],
    "orchestratorModelId": null
  }
}
```

### Guardrail Configuration
```typescript
interface SwarmGuardrails {
  maxConcurrentLightweightModels: number; // Default: 2 per device
  minFreeMemoryGB: number; // Minimum free memory to start swarm (default: 8)
  maxSubtasks: number; // Maximum parallel research bots (default: 8)
  subtaskTimeoutMs: number; // Timeout per subtask (default: 120000)
  fallbackEnabled: boolean; // Fall back to main models if needed
}
```

### Research Subtask Result
```typescript
interface ResearchSubtaskResult {
  id: string;
  content: string;
  tokenCount: number;
  deviceId: string;
  modelKey: string;
  durationMs: number;
  success: boolean;
  error?: string;
}
```

## Files

| File | Action | Purpose |
|------|--------|---------|
| `src/utils/swarm-guardrails.js` | **Create** | Memory/load monitoring and guardrail enforcement |
| `src/services/research-swarm-orchestrator.js` | **Create** | Main orchestration service for parallel research |
| `src/tools/research-swarm.js` | **Create** | MCP tool handler for user-triggered swarm tasks |
| `src/server.js` | **Modify** | Register `research-swarm` tool with MCP server |
| `src/services/load-tracker.js` | **Modify** | Add SWARM-specific load tracking methods |
| `src/utils/model-dna-schema.js` | **Modify** | Add swarm configuration schema and defaults |

## Functions

### New Functions

#### `src/utils/swarm-guardrails.js`
```javascript
export function checkMemoryAvailable(minGB) - Check system has sufficient free memory
export function canDispatchLightweightModel(deviceId, modelKey) - Verify device can accept lightweight model
export function getConcurrentLightweightCount() - Get current number of loaded lightweight models
export function getAvailableLightweightDevices() - Find devices that can host swarm models
export function recordSwarmRequestStart(deviceId) - Track active swarm requests per device
export function recordSwarmRequestEnd(deviceId, success) - Record request completion
```

#### `src/services/research-swarm-orchestrator.js`
```javascript
class ResearchSwarmOrchestrator {
  async decomposeResearchQuery(query, maxSubtasks)
  async dispatchToLightweightModels(subtasks)
  async compactResult(result, targetTokens)
  async orchestrate(query, options)
}
```

### Modified Functions

#### `src/services/load-tracker.js`
```javascript
// Add methods:
- getAvailableDevicesForSwarm(capabilities)
- canAcceptSwarmRequest(deviceId)
- recordSwarmRequestStart(deviceId, modelKey)
- recordSwarmRequestEnd(deviceId, modelKey, success)
```

## Classes

### New Classes

#### `ResearchSwarmOrchestrator` (`src/services/research-swarm-orchestrator.js`)
**Purpose**: Main orchestration service for SWARM research tasks

**Key Methods**:
- `decomposeResearchQuery(query, maxSubtasks)` - Break query into research subtasks
- `dispatchToLightweightModels(subtasks)` - Distribute to devices with lightweight models
- `compactResult(result, targetTokens)` - Reduce result size via LLM summarization
- `orchestrate(query, options)` - Main orchestration flow

**Dependencies**: 
- deviceRegistry
- loadTracker
- lmStudioSwitcher
- swarmGuardrails

### Modified Classes

#### `TaskOrchestrator` (`src/services/orchestrator.js`)
**Changes**: Add reference to ResearchSwarmOrchestrator for research-specific tasks

## Dependencies

No new external dependencies required. Uses existing:
- `@modelcontextprotocol/sdk`
- Zod (for validation)

## Testing

### Test Files to Create
| File | Tests |
|------|-------|
| `tests/swarm-guardrails.test.js` | Guardrail enforcement, memory checks |
| `tests/research-swarm.test.js` | Full orchestration flow, result compaction |

### Test Coverage Goals
- Guardrail system: 100% logic coverage
- Research orchestrator: Integration tests for common patterns
- Result compaction: Edge cases (already small results)

## Implementation Order

1. **Phase 1: Guardrails** (`src/utils/swarm-guardrails.js`) - COMPLETE
   - Memory monitoring functions
   - Load tracking for lightweight models
   - Device availability checks

2. **Phase 2: DNA Schema Update** (`src/utils/model-dna-schema.js`) - COMPLETE
   - Add swarm configuration schema
   - Defaults and validation
   - Migration support

3. **Phase 3: Load Tracker Extension** (`src/services/load-tracker.js`) - COMPLETE
   - Add SWARM-specific methods
   - Device availability for lightweight models
   - Concurrency tracking

4. **Phase 4: Research Swarm Orchestrator** (`src/services/research-swarm-orchestrator.js`) - COMPLETE
   - Task decomposition for research queries
   - Lightweight model dispatching
   - Result compaction logic
   - Aggregation synthesis

5. **Phase 5: MCP Tool Handler** (`src/tools/research-swarm.js`) - COMPLETE
   - User-triggered orchestration
   - Input validation
   - Response formatting

6. **Phase 6: Server Registration** (`src/server.js`) - COMPLETE
   - Register new `research-swarm` tool
   - Test end-to-end flow

## Plan Mode Detection Strategy

Since MCP doesn't provide native plan/act signaling, we use:

### User-Initiated Trigger (Primary)
Users explicitly call `research-swarm` tool for planning/research tasks:
```json
{
  "tool": "research-swarm",
  "query": "Analyze different state management approaches for React applications"
}
```

### Query Pattern Detection (Fallback)
Auto-detect research intent from query content:
- Keywords: "research", "investigate", "analyze", "compare"
- Multi-question patterns
- Planning-related terms

## Guardrail Configuration Defaults

```javascript
{
  maxLightweightModelsPerDevice: 2,
  subtaskMaxTokens: 4000,
  finalAggregationMaxTokens: 8000,
  minMemoryGB: 8,
  maxSubtasks: 8,
  subtaskTimeoutMs: 120000,
  fallbackEnabled: true
}
```

## Plan Mode Detection Findings

### Research Summary

The MCP protocol does NOT expose a direct `plan_mode` flag or event when Cline enters Plan Mode. However, there are several approaches to detect and leverage this mode:

#### Current State of Plan Mode Detection

1. **MCP Protocol Limitation**: There's no standard `clinedraft` flag or plan_mode indicator in MCP tool invocations
2. **Cline-Specific Implementation**: Cline may include hints in the request structure that can be detected
3. **Workaround**: Use task characteristics to determine if swarm orchestration is appropriate

#### Detection Strategies

| Strategy | Approach | Pros | Cons |
|----------|----------|------|------|
| User-Initiated Trigger | Explicit call via `research-swarm` tool | Simple, predictable, user control | Requires user awareness |
| Query Pattern Matching | Detect research keywords and patterns | Automatic, transparent | May have false positives |
| Task Characteristics | Length, complexity, open-ended questions | No code changes needed | Less precise |

#### Recommended Approach: Manual Trigger

Users should call `research-swarm` directly when entering Plan Mode for maximum control:
```
User: "I'm researching React vs Vue for an enterprise app. Let me use the research swarm tool."
Cline calls: research-swarm with query
```

## Implementation Status

### Completed Components (Initial Release)

| Component | File | Status |
|-----------|------|--------|
| Guardrails System | `src/utils/swarm-guardrails.js` | ✅ Complete |
| DNA Schema Update | `src/utils/model-dna-schema.js` | ✅ Complete |
| Load Tracker Extension | `src/services/load-tracker.js` | ✅ Complete |
| Research Orchestrator | `src/services/research-swarm-orchestrator.js` | ✅ Complete |
| MCP Tool Handler | `src/tools/research-swarm.js` | ✅ Complete |
| Server Registration | `src/server.js` | ✅ Complete |

### Bug Fixes Applied (v1.1)

| Issue | Impact | Fix Applied | File |
|-------|--------|-------------|------|
| `getConcurrentLightweightCount()` always returned 0 | CRITICAL - bypassed memory guardrails | Implemented internal `_lightweightModelCount` state tracking with increment/decrement methods | `src/utils/swarm-guardrails.js` |
| Success flag incorrectly passed as `true` in finally block | HIGH - load tracker recorded failed requests as success | Added `_subtaskErrors` Map to track actual failure state, pass correct flag to `recordSwarmRequestEnd()` | `src/services/research-swarm-orchestrator.js` |
| Double compaction (per-result then combined) | MEDIUM - significant information loss and inefficiency | Removed per-result compaction, single compact to final limit | `src/services/research-swarm-orchestrator.js` |
| No timeout handling for long-running tasks | HIGH - tool could hang indefinitely | Added `AbortController` with default 30-minute timeout in `executeResearchSwarm()` | `src/tools/research-swarm.js` |

### Documentation

| Document | File | Status |
|----------|------|--------|
| Plan Mode Integration Guide | `docs/research-swarm-plan-mode.md` | ✅ Complete |
| Implementation Plan (This) | `implementation_plan.md` | ✅ Updated |

## Known Issues and Future Improvements

### Deferred to Future Release

| Issue | Description | Priority |
|-------|-------------|----------|
| Race condition in model loading | Multiple parallel calls could attempt to load same model simultaneously on a device | MEDIUM |
| Per-device concurrent tracking | Device-specific lightweight model limits not fully enforced | LOW |

### Recommended Next Steps for User

1. **Test the implementation** by:
   - Loading lightweight models on multiple devices via LM Studio
   - Calling `research-swarm` tool with a research query
   - Monitoring parallel execution across devices
   
2. **Configure swarm settings** in `.model-dna.json`:
```json
{
  "orchestratorConfig": {
    "swarm": {
      "enabled": true,
      "maxLightweightModelsPerDevice": 2,
      "subtaskMaxTokens": 4000,
      "finalAggregationMaxTokens": 8000,
      "minMemoryGB": 8
    }
  }
}
```

3. **Optional**: Implement automatic plan mode detection in your MCP client wrapper based on query characteristics.

## Usage Example

```bash
# Direct tool call via MCP client
mcp client tools call research-swarm \
  --query "Compare React vs Vue frameworks for enterprise applications" \
  --maxSubtasks 2 \
  --compact true
```

This will:
1. Decompose the query into 2 subtasks
2. Dispatch to available lightweight models on devices
3. Execute in parallel across devices
4. Aggregate and compact results to ~2048 tokens
5. Return final result for Cline to consume