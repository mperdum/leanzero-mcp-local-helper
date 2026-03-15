# Phase 6: LM Link Multi-Device Orchestration

## Overview

Phase 6 implements multi-device orchestration across LM Studio's LM Link feature, enabling a primary model to decompose complex tasks and dispatch subtasks in parallel to multiple remote devices connected via Tailscale mesh VPN.

## Key Features

### Device Discovery
- **Automatic Discovery**: Devices are discovered through the `/api/v1/models` endpoint where device metadata is embedded in model responses
- **Device Registry**: Tracks all LM Link connected devices with health monitoring
- **Device Health**: Monitors device availability and tracks connection status

### Load Tracking & Management
- **Request Timing**: Tracks request start/end timestamps per device/model combination
- **Concurrency Limits**: Enforces configurable limits per device (default: 2 concurrent)
- **Global Limits**: Enforces global parallel request limit (default: 4)
- **Cooldown Periods**: Prevents overloading with configurable cooldown (default: 1000ms)

### Task Orchestration
- **Task Decomposition**: Automatically breaks complex tasks into parallelizable subtasks
- **DAG Execution**: Executes subtasks in parallel based on dependency graph layers
- **Load Balancing**: Routes subtasks to least-loaded devices based on tier and current load
- **Failure Recovery**: Retries failed subtasks on alternative devices

## Architecture Components

### Device Registry (`src/services/device-registry.js`)
```javascript
class DeviceRegistry {
  async initialize();           // Start device discovery
  getAllDevices();              // Get all discovered devices
  getOnlineDevices();           // Get only online devices
  isDeviceAvailable(id);        // Check if device can accept requests
}
```

### Load Tracker (`src/services/load-tracker.js`)
```javascript
class LoadTracker {
  recordRequestStart(deviceId, modelKey);
  recordRequestEnd(deviceId, modelKey, success);
  canAcceptRequest(deviceId, modelKey);
  getAvailableDevices(requiredCapabilities);
  calculateLoadScore(deviceId);   // Returns 0-1 score
}
```

### Task Orchestrator (`src/services/orchestrator.js`)
```javascript
class TaskOrchestrator {
  async decomposeTask(task, context);
  async executePlan(plan);
  async dispatchSubtask(subtask);
  aggregateResults(completedSubtasks);
  getActiveOrchestrations();
}
```

## Configuration

### Environment Variables
```bash
# LM Link Discovery
LM_LINK_ENABLED=true
DEVICE_DISCOVERY_INTERVAL_MS=30000

# Concurrency Limits
MAX_PARALLEL_REQUESTS_GLOBAL=4
DEFAULT_DEVICE_CONCURRENT_LIMIT=2

# Timing
DEVICE_COOLDOWN_MS=1000
REMOTE_DEVICE_TIMEOUT_MS=60000
```

### Model DNA Configuration
```json
{
  "orchestratorConfig": {
    "enabled": true,
    "maxSubtasks": 5,
    "timeoutMs": 60000
  }
}
```

## MCP Tools

### orchestrate-task
Executes complex tasks across multiple devices:
```json
{
  "tool": "orchestrate-task",
  "task": "Create a React app with auth, then write tests, and deploy it",
  "maxSubtasks": 5,
  "requiredCapabilities": ["vision"]
}
```

### list-devices
Lists all available devices and their status:
```json
{
  "tool": "list-devices",
  "includeLoadStats": true,
  "filterByCapability": "vision"
}
```

### dispatch-subtask
Manual subtask dispatch for testing/debugging:
```json
{
  "tool": "dispatch-subtask",
  "prompt": "Write a function to calculate Fibonacci numbers",
  "deviceId": "device-12345678",
  "modelKey": "llama-3.2-3b"
}
```

## Parallel Execution Strategy

1. **Task Analysis**: Analyze task complexity and determine parallelism needs
2. **Decomposition**: Break into subtasks with dependency graph
3. **Layer Identification**: Identify which subtasks can run in parallel (DAG layers)
4. **Device Selection**: Choose optimal device for each subtask based on:
   - Device tier (ultra > high > medium > low)
   - Current load score (0 = idle, 1 = max capacity)
   - Required capabilities
5. **Parallel Dispatch**: Execute all subtasks in a layer simultaneously
6. **Result Aggregation**: Synthesize final result from all subtask results

## Testing

Run the test suite:
```bash
npm test
```

### Test Files
- `tests/device-registry.test.js` - Device discovery tests
- `tests/load-tracker.test.js` - Load tracking and concurrency tests  
- `tests/orchestrator.test.js` - Full orchestration flow integration tests

## Success Criteria

1. ✅ Device discovery automatically detects all LM Link connected devices within 30 seconds of startup
2. ✅ Parallel execution dispatches and executes subtasks on multiple devices simultaneously
3. ✅ Load balancing respects per-device concurrency limits and cooldowns
4. ✅ Failure recovery gracefully handles device offline scenarios with retry logic
5. ✅ Cline integration tool descriptions effectively guide primary model to use parallelism

## Future Enhancements

- [ ] Direct API access to remote LM Link devices via Tailscale gateway
- [ ] Real-time progress updates during orchestration
- [ ] Adaptive task decomposition based on historical performance data
- [ ] Device-aware retry policies with backoff strategies
- [ ] Priority-based queuing for time-sensitive tasks