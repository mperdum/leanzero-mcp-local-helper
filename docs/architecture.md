# Architecture Documentation - MCP Local Helper

**Last Updated:** April 3, 2026  
**Purpose:** Comprehensive architecture documentation for understanding the system design

---

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Client (Cline)                       │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              Server Layer (src/server.js)                   │
│  - switch-model, execute-task, model-dna, rate-model       │
│  - orchestrate-task, list-devices, dispatch-subtask        │
│  - research-swarm, list-mcp-tools, route-task-to-mcp       │
└────────────────┬────────────────────────────────────────────┘
                 │
        ┌────────┴─────────┐
        ▼                  ▼
┌──────────────────┐ ┌──────────────────┐
│   Services Layer │ │  Utils Layer     │
│ - orchestrator   │ │ - DNA manager    │
│ - task-dispatcher│ │ - task-decomposer│
│ - device-registry│ │ - task-classifier│
│ - load-tracker   │ │ - rating-analyzer│
└────────┬─────────┘ └──────────────────┘
         │
         ▼
┌──────────────────┐
│  Storage Layer   │
│ - .model-dna.json│
│ - .model-user.json│
└──────────────────┘
```

---

## Core Components

### 1. Server Layer (`src/server.js`)

**Responsibility:** MCP protocol integration and tool registration.

**Key Functions:**
- `createServer()` - Initialize MCP server with capabilities
- `registerTools(server)` - Register all tools with their schemas
- `setupSignalHandlers(server)` - Graceful shutdown on SIGINT/SIGTERM

**Registered Tools (9 total):**
| Tool | Purpose |
|------|---------|
| `switch-model` | Manual model lifecycle management |
| `execute-task` | Automatic task execution with intelligent model selection |
| `model-dna` | DNA configuration management |
| `rate-model` | Model effectiveness rating collection |
| `orchestrate-task` | Multi-device orchestration across LM Link devices |
| `list-devices` | List all connected LM Link devices |
| `dispatch-subtask` | Manual subtask dispatch (debugging) |
| `research-swarm` | Distributed research across lightweight models |
| `route-task-to-mcp` | Cross-MCP task routing |

---

### 2. Services Layer

#### Orchestrator (`src/services/orchestrator.js`)

**Responsibility:** Multi-device orchestration and parallel execution.

**Key Methods:**
- `decomposeTask(task, context)` - Break complex tasks into subtasks
- `executePlan(plan)` - Execute orchestration plan across devices
- `dispatchSubtask(subtask)` - Dispatch single subtask to optimal device
- `aggregateResults(completedSubtasks)` - Aggregate results from all subtasks

**Features:**
- DAG-based execution order
- Load-aware device selection
- Failure recovery with retry logic
- Device health monitoring

#### Task Dispatcher (`src/services/task-dispatcher.js`)

**Responsibility:** Automatic task routing and model selection.

**Key Methods:**
- `executeTask(query, dna)` - Execute task with optimal model
- `getClassificationModel(taskClassification)` - Get best model for task type

**Features:**
- Task classification using pattern matching
- Rating-based model selection
- Fallback support (up to 3 attempts)

#### Device Registry (`src/services/device-registry.js`)

**Responsibility:** LM Link device discovery and tracking.

**Key Methods:**
- `initialize()` - Start device discovery via `/api/v1/models`
- `getAllDevices()` - Get all discovered devices
- `getOnlineDevices()` - Get only online devices
- `isDeviceAvailable(deviceId)` - Check if device can accept requests

**Features:**
- Automatic discovery through LM Studio API
- Device health monitoring via periodic polling
- Tailscale node ID extraction from model metadata

#### Load Tracker (`src/services/load-tracker.js`)

**Responsibility:** Concurrency limits and request tracking per device.

**Key Methods:**
- `recordRequestStart(deviceId, modelKey)` - Track request start
- `recordRequestEnd(deviceId, modelKey, success)` - Track request end
- `canAcceptRequest(deviceId, modelKey)` - Check if device can accept request
- `findOptimalDevice(subtask)` - Find best device for subtask

**Features:**
- Per-device, per-model concurrent request tracking
- Configurable limits via environment variables
- Cooldown periods between requests

#### Rating Analyzer (`src/services/rating-analyzer.js`)

**Responsibility:** Calculate statistics from collected ratings.

**Key Methods:**
- `calculateAverageRating(ratings)` - Average rating calculation
- `calculateStandardDeviation(ratings, avg)` - Variance analysis
- `getLowRatingRate(ratings, threshold)` - Detect underperforming models

#### Evolution Engine (`src/services/evolution-engine.js`)

**Responsibility:** Generate configuration improvements based on data patterns.

**Key Methods:**
- `analyzeRatings(dna)` - Analyze rating patterns
- `generateMutations(dna)` - Suggest configuration changes
- `applyMutation(dna, mutation)` - Apply a mutation to DNA

#### Research Swarm Orchestrator (`src/services/research-swarm-orchestrator.js`)

**Responsibility:** Distributed research across lightweight models.

**Key Methods:**
- `executeResearchSwarm(query, maxSubtasks, compact)` - Execute swarm orchestration
- `decomposeQuery(query)` - Decompose query into subtasks
- `aggregateResults(results)` - Aggregate and compact results

---

### 3. Utils Layer

#### DNA Manager (`src/utils/model-dna-manager.js`)

**Responsibility:** Persistent configuration storage and management.

**Key Functions:**
- `loadModelDNA(projectRoot, forceReload)` - Load project DNA with caching
- `loadUserDNA(projectRoot, forceReload)` - Load user-level overrides
- `mergeDNALevels(projectRoot)` - Merge defaults, project, and user configs
- `createDNAFile(config, projectRoot)` - Create new DNA file

#### DNA Schema (`src/utils/model-dna-schema.js`)

**Responsibility:** Schema definition and validation.

**Key Functions:**
- `VALID_MODEL_TYPES` - Valid model role types (conversationalist, ninja-researcher, etc.)
- `MODEL_DNA_SCHEMA` - Schema definition object
- `getDefaultDNA()` - Default configuration generator
- `validateModelDNA(dna)` - Validate DNA against schema
- `applyMigration(dna)` - Apply schema migrations

#### Task Classifier (`src/utils/task-classifier.js`)

**Responsibility:** Intent analysis and task category mapping.

**Key Functions:**
- `classifyTask(query)` - Classify query into task category
- `TASK_CATEGORIES` - Category definitions with keywords

**Categories:**
- `codeFixes` - Bug fixes, debugging
- `featureArchitecture` - Architecture, design patterns
- `codeExecution` - Code execution and writing
- `generalResearch` - Information gathering
- `imageAnalysis` - Image-based tasks

#### Task Decomposer (`src/utils/task-decomposer.js`)

**Responsibility:** Break complex tasks into parallelizable subtasks.

**Key Functions:**
- `analyzeTask(task)` - Determine complexity and parallelism needs
- `decompose(task, maxSubtasks)` - Core decomposition with multiple strategies
- `buildExecutionOrder(subtasks)` - Build DAG for dependency ordering

#### Hardware Detector (`src/utils/hardware-detector.js`)

**Responsibility:** Hardware detection for load management.

**Key Functions:**
- `getTotalRAM()` - Detect total system RAM
- `getCoresCount()` - Detect CPU cores
- `isGPUAvailable()` - Detect GPU availability
- `getMaxModelsPerDevice()` - Recommend max models based on hardware

---

### 4. Storage Layer

#### DNA Files

**`.model-dna.json`** - Primary project-level configuration:
```json
{
  "version": 3,
  "primaryRole": "conversationalist",
  "models": { ... },
  "taskModelMapping": { ... },
  "memories": { ... },
  "usageStats": { ... }
}
```

**`.model-user.json`** - User-level overrides:
```json
{
  "version": 3,
  "primaryRole": "conversationalist",
  "models": { ... },
  "memories": { ... }
}
```

---

## Data Flow

### Request Flow (Cline → MCP Server)

```
User Request
    ↓
MCP Tool Call (switch-model, execute-task, etc.)
    ↓
Tool Handler (src/tools/tool-name.js)
    ↓
Service Layer (orchestrator, dispatcher, registry)
    ↓
Utils Layer (DNA manager, classifier, decomposer)
    ↓
Storage Layer (.model-dna.json, .model-user.json)
    ↓
Response to MCP Client
```

### Rating Feedback Loop

```
Task Execution
    ↓
Rating Provided by User/Cline
    ↓
Recorded in DNA (usageStats.modelEffectiveness)
    ↓
Evolution Engine Analyzes Ratings
    ↓
Suggests/Apply Configuration Improvements
    ↓
Updated Model Selection for Future Tasks
```

---

## Configuration

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `LM_STUDIO_URL` | http://localhost:1234 | LM Studio API base URL |
| `MAX_PARALLEL_REQUESTS_GLOBAL` | 4 | Global concurrency limit on local device |
| `DEFAULT_DEVICE_CONCURRENT_LIMIT` | 2 | Concurrent limit for remote devices |
| `DEVICE_COOLDOWN_MS` | 1000ms | Cooldown period after request completion |
| `MAX_MODELS_PER_DEVICE` | 1 | Max models per device (conservative default) |

### DNA Configuration Options

```json
{
  "orchestratorConfig": {
    "enabled": true,
    "maxSubtasks": 5,
    "timeoutMs": 60000,
    "swarm": {
      "enabled": true,
      "maxLightweightModelsPerDevice": 2,
      "subtaskMaxTokens": 4000
    }
  },
  "hardwareProfile": {
    "minRamForParallel": 64,
    "recommendedRam": 256,
    "maxParallelModels": 3
  }
}
```

---

## Testing Strategy

### Test Organization

```
tests/
├── dna.test.js                    # DNA schema validation, migrations
├── lm-studio-switcher.test.js   # LM Studio API integration
├── task-classifier.test.js      # Task intent classification
├── orchestrator.test.js         # Full orchestration flow
├── load-tracker.test.js         # Concurrency limits and tracking
├── device-registry.test.js      # Device discovery and health checks
├── tools.test.js                 # MCP tool handler functionality
├── rating-analyzer.test.js      # Rating statistics calculation
├── evolution-engine.test.js     # Evolution suggestions
├── usage-tracker.test.js        # Usage pattern tracking
├── swarm-guardrails.test.js     # Swarm constraints enforcement
└── research-swarm.test.js       # Research swarm orchestration
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npx node --test tests/orchestrator.test.js

# Watch mode (if supported)
npm test -- --watch
```

---

## Error Handling Pattern

All services use consistent error handling:

```javascript
try {
  // Main logic
} catch (error) {
  console.error(`[${SERVICE_NAME}] Error: ${error.message}`);
  
  return {
    content: [{ type: "text", text: JSON.stringify({ error: error.message }, null, 2) }],
    isError: true,
  };
}
```

---

## Key Design Principles

1. **Separation of Concerns:** Clear separation between tools, services, and utilities
2. **State Management:** Centralized state in services with clear initialize/shutdown lifecycle
3. **Caching:** Aggressive caching for performance optimization
4. **Configuration-Driven:** DNA-based configuration with environment variable overrides
5. **Extensibility:** Easy to add new tools, services, or utilities following established patterns

---

## Next Steps

For deeper exploration:
1. Read `docs/adding-new-tools.md` - Tool development guide
2. Read `docs/adding-new-services.md` - Service development guide  
3. Read `docs/building-task-decomposers.md` - Task decomposition strategies