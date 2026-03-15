# Implementation Plan: LM Link Multi-Device Orchestrator

## Overview

This implementation extends MCP Local Helper to orchestrate multiple AI models across devices connected via LM Studio's LM Link feature, with Cline as the primary client interface. The orchestrator automatically discovers linked devices, manages model loading/unloading across them, and executes parallel tool calls while respecting hardware constraints.

The system enables a primary "orchestrator" model to decompose complex tasks into subtasks that are dispatched in parallel to multiple remote devices, each running their own models via LM Link's Tailscale-based encrypted mesh network. Results are aggregated and returned to the orchestrator for final synthesis.

---

## Types

### New Type Definitions

#### DeviceInfo
```typescript
interface DeviceInfo {
  id: string;                    // Unique device identifier (Tailscale node ID)
  name: string;                  // Human-readable device name
  address: string;               // Tailscale IP address or localhost for primary
  status: 'online' | 'offline' | 'degraded';
  hardwareProfile: {
    ramGB: number;
    cpuCores: number;
    gpuAvailable: boolean;
    tier: 'low' | 'medium' | 'high' | 'ultra';
  };
  capabilities: {
    maxConcurrentRequests: number;
    supportedModelTypes: string[]; // ['llm', 'vlm', 'embeddings']
    maxContextLength: number;
  };
  lastSeen: string;              // ISO timestamp
}
```

#### ModelInstance
```typescript
interface ModelInstance {
  modelKey: string;              // LM Studio model key (e.g., "llama-3.2-3b")
  displayName: string;           // Human-readable name
  deviceId: string;              // Device hosting this model
  instanceId?: string;           // Loaded instance ID (if currently loaded)
  state: 'loaded' | 'unloaded';
  loadTimeSeconds?: number;      // Estimated time to load
  sizeGB?: number;               // Model file size
  capabilities: {
    vision: boolean;
    toolUse: boolean;
    maxContextLength: number;
  };
}
```

#### LoadState
```typescript
interface LoadState {
  deviceId: string;
  modelKey: string;
  activeRequests: number;        // Currently processing requests
  lastRequestStart?: string;     // ISO timestamp
  lastRequestEnd?: string;       // ISO timestamp
  cooldownUntil?: string;        // ISO timestamp when device is available again
  totalRequestsToday: number;    // For rate limiting
}
```

#### Subtask
```typescript
interface Subtask {
  id: string;                    // Unique subtask identifier
  type: 'research' | 'code-generation' | 'analysis' | 'synthesis';
  prompt: string;                // The actual task prompt
  requiredCapabilities?: string[]; // e.g., ['vision', 'toolUse']
  assignedDeviceId?: string;     // Target device (if specified)
  assignedModelKey?: string;     // Target model (if specified)
  priority: number;              // 1-5, higher = more important
  dependencies?: string[];       // IDs of subtasks this depends on
  result?: {                     // Populated after execution
    content: string;
    success: boolean;
    deviceId: string;
    modelKey: string;
    durationMs: number;
    error?: string;
  };
}
```

#### OrchestrationPlan
```typescript
interface OrchestrationPlan {
  originalTask: string;          // The user's original request
  subtasks: Subtask[];           // Decomposed tasks
  executionOrder: string[][];    // Arrays of subtask IDs that can run in parallel
  estimatedTotalTimeMs: number;
  requiredDevices: Set<string>;  // Device IDs needed for this plan
}
```

#### OrchestratorConfig (DNA extension)
```typescript
interface OrchestratorConfig {
  enabled: boolean;
  maxParallelRequests: number;   // Global limit across all devices
  perDeviceLimits: {
    [deviceId: string]: {
      maxConcurrent: number;
      cooldownMs: number;
      dailyRequestLimit?: number;
    };
  };
  preferredDevices: string[];    // Priority order for device selection
  autoLoadModels: boolean;       // Auto-load models on remote devices
  unloadAfterIdleMs: number;     // Auto-unload idle models
}
```

---

## Files

### New Files to Create

| File Path | Purpose |
|-----------|---------|
| `src/services/device-registry.js` | Discovers and tracks LM Link connected devices |
| `src/services/load-tracker.js` | Tracks request timing and enforces concurrency limits |
| `src/services/orchestrator.js` | Main orchestration logic for task decomposition and dispatch |
| `src/tools/orchestrate-task.js` | MCP tool for orchestrating multi-device tasks |
| `src/tools/list-devices.js` | MCP tool to list available devices and their status |
| `src/tools/dispatch-subtask.js` | MCP tool for manual subtask dispatch (debugging) |
| `src/utils/task-decomposer.js` | Decomposes complex tasks into parallelizable subtasks |
| `tests/device-registry.test.js` | Unit tests for device discovery |
| `tests/load-tracker.test.js` | Unit tests for load tracking logic |
| `tests/orchestrator.test.js` | Integration tests for orchestration flow |

### Existing Files to Modify

| File Path | Changes |
|-----------|---------|
| `src/server.js` | Register new tools: `orchestrate-task`, `list-devices`, `dispatch-subtask` |
| `src/services/lm-studio-switcher.js` | Add device-aware model loading, remote device support |
| `src/utils/model-dna-schema.js` | Extend schema with `orchestratorConfig` field |
| `src/utils/model-dna-manager.js` | Add orchestrator config CRUD operations |
| `src/services/task-dispatcher.js` | Integrate with orchestrator for multi-device tasks |

---

## Functions

### New Functions by Service

#### DeviceRegistry (`src/services/device-registry.js`)

```javascript
// Initialize device discovery via LM Link
async initialize(): Promise<void>

// Discover all connected devices through LM Studio API
async discoverDevices(): Promise<DeviceInfo[]>

// Get specific device info
getDevice(deviceId: string): DeviceInfo | null

// Check if a device is available for new requests
isDeviceAvailable(deviceId: string): boolean

// Get all online devices
getOnlineDevices(): DeviceInfo[]

// Subscribe to device status changes
onDeviceStatusChange(callback: (device: DeviceInfo, event: 'online' | 'offline') => void): () => void

// Health check for a specific device
async healthCheck(deviceId: string): Promise<{ healthy: boolean; latencyMs: number }>
```

#### LoadTracker (`src/services/load-tracker.js`)

```javascript
// Record request start for load tracking
recordRequestStart(deviceId: string, modelKey: string): void

// Record request completion
recordRequestEnd(deviceId: string, modelKey: string, success: boolean): void

// Check if a device can accept new requests
canAcceptRequest(deviceId: string, modelKey?: string): { allowed: boolean; reason?: string }

// Get current load state for a device
getDeviceLoadState(deviceId: string): LoadState | null

// Get all devices with available capacity
getAvailableDevices(requiredCapabilities?: string[]): DeviceInfo[]

// Calculate optimal device for a subtask
findOptimalDevice(subtask: Subtask): { deviceId: string; modelKey: string } | null

// Reset tracking (for testing)
reset(): void
```

#### Orchestrator (`src/services/orchestrator.js`)

```javascript
// Decompose a complex task into parallelizable subtasks
async decomposeTask(task: string, context?: object): Promise<OrchestrationPlan>

// Execute an orchestration plan across devices
async executePlan(plan: OrchestrationPlan): Promise<{ success: boolean; results: Subtask[] }>

// Dispatch a single subtask to optimal device
async dispatchSubtask(subtask: Subtask): Promise<Subtask['result']>

// Aggregate results from completed subtasks
aggregateResults(completedSubtasks: Subtask[]): string

// Cancel an in-progress orchestration
cancelOrchestration(planId: string): void

// Get status of ongoing orchestrations
getActiveOrchestrations(): { planId: string; progress: number; subtasks: Subtask[] }[]
```

#### TaskDecomposer (`src/utils/task-decomposer.js`)

```javascript
// Analyze task and return decomposition strategy
analyzeTask(task: string): { complexity: 'simple' | 'moderate' | 'complex'; requiresParallelism: boolean }

// Decompose into subtasks using LLM or heuristic rules
decompose(task: string, maxSubtasks?: number): Subtask[]

// Build execution order (DAG of dependencies)
buildExecutionOrder(subtasks: Subtask[]): string[][]

// Validate decomposition is sound
validateDecomposition(plan: OrchestrationPlan): { valid: boolean; issues: string[] }
```

### Modified Functions in Existing Files

#### LMStudioSwitcher (`src/services/lm-studio-switcher.js`)

```javascript
// New: Get models with device information
async getModelsByDevice(): Promise<{ [deviceId: string]: ModelInstance[] }>

// Modified: Load model on specific device
async loadModel(modelKey: string, options?: { deviceId?: string }): Promise<LoadResult>

// Modified: Execute completion on specific device
async executeChatCompletion(modelKey: string, input: any, options?: { deviceId?: string }): Promise<CompletionResult>

// New: Check remote device connectivity
async checkRemoteDevice(deviceId: string): Promise<{ connected: boolean; latencyMs: number }>
```

---

## Classes

### DeviceRegistry Class

**File:** `src/services/device-registry.js`

**Purpose:** Manages discovery and tracking of all LM Link connected devices.

**Key Methods:**
- `constructor()`: Initializes with LM Studio base URL, starts periodic discovery
- `initialize()`: Performs initial device scan via `/api/v1/models` endpoint
- `_parseDeviceFromModel(model: ModelInstance): DeviceInfo`: Extracts device info from model metadata
- `_startDiscoveryLoop(intervalMs?: number)`: Periodic rediscovery of devices
- `_handleModelListUpdate(models: ModelInstance[])`: Updates registry when models change

**State:**
- `devices: Map<string, DeviceInfo>` - Current known devices
- `discoveryInterval: NodeJS.Timeout` - Rediscovery timer (default 30s)
- `statusListeners: Set<Function>` - Callbacks for status changes

### LoadTracker Class

**File:** `src/services/load-tracker.js`

**Purpose:** Tracks request timing and enforces concurrency limits per device.

**Key Methods:**
- `constructor(config: OrchestratorConfig)`: Initializes with orchestrator config
- `_checkConcurrencyLimit(deviceId: string): boolean`: Validates concurrent request count
- `_checkCooldown(deviceId: string): boolean`: Validates cooldown period has passed
- `_calculateLoadScore(deviceId: string): number`: Returns 0-1 load score for device
- `getLeastLoadedDevice(): DeviceInfo | null`: Returns device with lowest current load

**State:**
- `loadStates: Map<string, LoadState>` - Per-device load tracking
- `config: OrchestratorConfig` - Configuration reference

### TaskOrchestrator Class

**File:** `src/services/orchestrator.js`

**Purpose:** Main orchestrator coordinating multi-device task execution.

**Key Methods:**
- `constructor(deviceRegistry, loadTracker, lmStudioSwitcher)`: Dependency injection
- `_planExecution(plan: OrchestrationPlan): Promise<void>`: Plans which subtasks go where
- `_executeParallelGroup(subtaskIds: string[]): Promise<void>`: Runs parallel subtasks
- `_handleSubtaskFailure(subtask: Subtask): void`: Retry or skip failed subtasks
- `_synthesizeResults(completed: Subtask[]): string`: Combines results into final answer

**State:**
- `activePlans: Map<string, OrchestrationPlan>` - Currently executing plans
- `deviceRegistry: DeviceRegistry` - Device discovery reference
- `loadTracker: LoadTracker` - Load tracking reference
- `lmStudioSwitcher: LMStudioSwitcher` - Model execution reference

---

## Dependencies

### No New NPM Packages Required

All functionality uses existing Node.js APIs and the current dependency set:
- `@modelcontextprotocol/sdk` - Already installed for MCP server
- `zod` - Already installed for schema validation

### Environment Variables (New)

| Variable | Default | Description |
|----------|---------|-------------|
| `LM_LINK_ENABLED` | `true` | Enable LM Link device discovery |
| `DEVICE_DISCOVERY_INTERVAL_MS` | `30000` | How often to rediscover devices |
| `MAX_PARALLEL_REQUESTS_GLOBAL` | `4` | Global limit on concurrent requests |
| `DEFAULT_DEVICE_CONCURRENT_LIMIT` | `2` | Per-device concurrent request limit |
| `DEVICE_COOLDOWN_MS` | `1000` | Cooldown between requests to same device |
| `REMOTE_DEVICE_TIMEOUT_MS` | `60000` | Timeout for remote device requests |

---

## Testing

### Test Files and Coverage

#### tests/device-registry.test.js
```javascript
// Test cases:
- discoverDevices() returns local device when no LM Link configured
- discoverDevices() returns multiple devices when LM Link active
- getDevice() returns null for unknown device ID
- isDeviceAvailable() respects online/offline status
- healthCheck() measures latency correctly
- Device status change callbacks fire on state transitions
```

#### tests/load-tracker.test.js
```javascript
// Test cases:
- recordRequestStart/End properly tracks active requests
- canAcceptRequest() enforces concurrency limits
- canAcceptRequest() respects cooldown periods
- getAvailableDevices() filters by capabilities
- findOptimalDevice() selects least loaded device
- Load state resets after cooldown expires
```

#### tests/orchestrator.test.js
```javascript
// Test cases:
- decomposeTask() creates valid subtask arrays
- executePlan() runs parallel subtasks correctly
- dispatchSubtask() handles device failures gracefully
- aggregateResults() combines outputs coherently
- cancelOrchestration() stops in-progress tasks
- getActiveOrchestrations() returns accurate status
```

### Integration Test Strategy

1. **Mock LM Link Devices**: Create mock responses simulating multiple devices with different capabilities
2. **Load Testing**: Verify concurrency limits are enforced under load
3. **Failure Recovery**: Test behavior when devices go offline mid-orchestration
4. **Cline Compatibility**: Ensure tool descriptions guide proper usage in Cline

### Validation Tests

```javascript
// Run before deployment:
npm test -- tests/device-registry.test.js
npm test -- tests/load-tracker.test.js  
npm test -- tests/orchestrator.test.js

// Full suite including existing tests:
npm test
```

---

## Implementation Order

### Phase 1: Foundation (Days 1-2)

1. **Extend DNA Schema** (`src/utils/model-dna-schema.js`)
   - Add `orchestratorConfig` field to schema definition
   - Update `getDefaultDNA()` to include default orchestrator settings
   - Add validation rules for new config fields

2. **Create DeviceRegistry Service** (`src/services/device-registry.js`)
   - Implement device discovery via LM Studio API
   - Parse device information from model metadata
   - Build device status tracking with health checks
   - Write unit tests in `tests/device-registry.test.js`

### Phase 2: Load Management (Days 3-4)

3. **Create LoadTracker Service** (`src/services/load-tracker.js`)
   - Implement request timing tracking
   - Enforce concurrency limits per device
   - Add cooldown period management
   - Write unit tests in `tests/load-tracker.test.js`

4. **Extend LMStudioSwitcher** (`src/services/lm-studio-switcher.js`)
   - Add device-aware model loading
   - Implement remote device connectivity checks
   - Update existing methods to support `deviceId` parameter

### Phase 3: Orchestration Core (Days 5-6)

5. **Create TaskDecomposer Utility** (`src/utils/task-decomposer.js`)
   - Implement task complexity analysis
   - Build subtask decomposition logic
   - Create execution order builder (DAG)
   - Add validation functions

6. **Create Orchestrator Service** (`src/services/orchestrator.js`)
   - Implement plan creation and execution
   - Handle parallel subtask dispatch
   - Add failure recovery and retry logic
   - Write integration tests in `tests/orchestrator.test.js`

### Phase 4: MCP Tools (Day 7)

7. **Create orchestrate-task Tool** (`src/tools/orchestrate-task.js`)
   - Define tool schema with Cline-optimized description
   - Implement handler for multi-device task execution
   - Add streaming support for long-running orchestrations

8. **Create list-devices Tool** (`src/tools/list-devices.js`)
   - Expose device registry status to clients
   - Include load states and capabilities

9. **Create dispatch-subtask Tool** (`src/tools/dispatch-subtask.js`)
   - Manual subtask dispatch for debugging/advanced use
   - Direct control over device/model selection

10. **Register Tools in Server** (`src/server.js`)
    - Import new tool handlers
    - Register with MCP server using zod schemas
    - Update error handling for orchestration errors

### Phase 5: Integration & Polish (Day 8)

11. **Integrate with TaskDispatcher** (`src/services/task-dispatcher.js`)
    - Add option to use orchestrator for complex tasks
    - Detect when multi-device execution is beneficial

12. **Update Documentation** (`README.md`, new `docs/phase-6-lm-link-orchestration.md`)
    - Document new tools and their usage
    - Explain LM Link setup requirements
    - Provide Cline configuration examples

13. **Final Testing & Validation**
    - Run full test suite
    - Verify Cline compatibility
    - Test with actual LM Link devices if available

---

## Cline-Specific Considerations

### Tool Description Optimization

The `orchestrate-task` tool description should explicitly guide the primary model to:

1. **Plan Ahead**: "Before executing, analyze what subtasks can run in parallel"
2. **Device Awareness**: "Consider which devices have appropriate models for each subtask"
3. **Parallel Execution**: "Dispatch independent subtasks simultaneously for faster completion"
4. **Result Synthesis**: "After all subtasks complete, synthesize results into final answer"

### Example Tool Description Snippet

```
[ROLE] You are a multi-device AI orchestrator that coordinates tasks across multiple LM Studio devices connected via LM Link.

[STRATEGY] 
1. Analyze the task and identify independent components that can run in parallel
2. Check available devices and their loaded models using list-devices tool
3. Decompose complex tasks into subtasks with clear inputs/outputs
4. Dispatch subtasks to optimal devices simultaneously (not sequentially!)
5. Wait for all subtasks to complete, then synthesize results

[PARALLELISM] Always maximize parallelism - if you have 3 independent research queries and 3 devices, dispatch all 3 at once rather than one at a time.

[DEVICE SELECTION] Match subtask requirements to device capabilities:
- Vision tasks → devices with VLM models loaded
- Code generation → devices with tool-use capable models
- Simple chat → any available device
```

---

## Error Handling Strategy

### Device Offline During Execution

1. Detect via health check timeout or request failure
2. Mark device as `degraded` status
3. Retry subtask on alternative device if possible
4. If no alternatives, return partial results with error context

### Model Load Failures on Remote Devices

1. Attempt to load model on target device
2. If fails, try alternative device with same model
3. If model unavailable elsewhere, notify orchestrator to adjust plan

### Orchestration Timeout

1. Global timeout configurable via `REMOTE_DEVICE_TIMEOUT_MS`
2. On timeout, cancel remaining subtasks
3. Return partial results with clear indication of incomplete work

---

## Configuration Examples

### cline_mcp_settings.json

```json
{
  "mcpServers": {
    "mcp-local-helper": {
      "command": "node",
      "args": ["/path/to/mcp-local-helper/src/server.js"],
      "env": {
        "LM_LINK_ENABLED": "true",
        "DEVICE_DISCOVERY_INTERVAL_MS": "30000",
        "MAX_PARALLEL_REQUESTS_GLOBAL": "4",
        "DEFAULT_DEVICE_CONCURRENT_LIMIT": "2"
      }
    }
  }
}
```

### .model-dna.json (orchestratorConfig section)

```json
{
  "version": 3,
  // ... existing fields ...
  "orchestratorConfig": {
    "enabled": true,
    "maxParallelRequests": 4,
    "perDeviceLimits": {
      "device-desktop-main": {
        "maxConcurrent": 2,
        "cooldownMs": 1000
      },
      "device-server-gpu": {
        "maxConcurrent": 3,
        "cooldownMs": 500
      }
    },
    "preferredDevices": ["device-server-gpu", "device-desktop-main"],
    "autoLoadModels": true,
    "unloadAfterIdleMs": 120000
  }
}
```

---

## Success Criteria

1. **Device Discovery**: Automatically detects all LM Link connected devices within 30 seconds of startup
2. **Parallel Execution**: Can dispatch and execute subtasks on multiple devices simultaneously
3. **Load Balancing**: Respects per-device concurrency limits and cooldowns
4. **Failure Recovery**: Gracefully handles device offline scenarios with retry logic
5. **Cline Integration**: Tool descriptions effectively guide primary model to use parallelism
6. **Test Coverage**: All new services have >80% unit test coverage