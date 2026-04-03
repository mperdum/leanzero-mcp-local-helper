# AI Developer Guide - MCP Local Helper

**Last Updated:** April 3, 2026  
**Purpose:** Quick start guide for AI models (like Cline) working on this project

---

## Quick Start for AI Developers

When you encounter this project for the first time, follow this sequence:

### Phase 1: Understand the Project Structure
```
mcp-local-helper/
├── src/
│   ├── server.js           # Main MCP server entry point
│   ├── services/           # Business logic layer
│   └── utils/              # Utility modules
├── docs/                   # This documentation folder
└── tests/                  # Test suite
```

### Phase 2: Key Files to Know
| File | Purpose |
|------|---------|
| `src/server.js` | MCP server registration (7+ tools) |
| `src/services/orchestrator.js` | Multi-device orchestration logic |
| `src/utils/model-dna-manager.js` | Configuration management |
| `docs/AI_GUIDE.md` | This guide - start here |

### Phase 3: How to Add Features
See the developer guides:
- **Adding Tools:** `docs/adding-new-tools.md`
- **Adding Services:** `docs/adding-new-services.md`
- **Task Decomposition:** `docs/building-task-decomposers.md`

---

## Architecture Overview

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

### Core Components

#### 1. Model DNA System (`src/utils/model-dna-*.js`)
The central configuration repository storing all persistent state.

**Key Files:**
- `model-dna-schema.js` - Schema definition and validation
- `model-dna-manager.js` - CRUD operations, caching, merging
- `model-dna-inheritance.js` - Inheritance logic (optional)

**Files:**
```
.project-root/
├── .model-dna.json          # Primary configuration (versioned)
└── .model-user.json         # User-specific overrides
```

#### 2. LM Studio Switcher (`src/services/lm-studio-switcher.js`)
HTTP interface to LM Studio's v1 API.

**Key Features:**
- Automatic model loading/unloading
- Parallel load management
- Retry logic with exponential backoff

#### 3. Task Dispatcher (`src/services/task-dispatcher.js`)
Analyzes tasks and routes them to appropriate models.

**Task Classification:**
- `codeFixes` - Bug fixes, error resolution
- `featureArchitecture` - Design patterns, architecture
- `codeExecution` - Running code
- `generalResearch` - Information gathering
- `imageAnalysis` - Image-based tasks

#### 4. Task Orchestrator (`src/services/orchestrator.js`)
Handles complex tasks requiring parallel execution.

**Task Decomposition:**
1. Code patterns → Split into implementation + tests
2. Numbered lists → Each number becomes a subtask
3. Multiple questions → Each question extracted separately
4. "and" connector → Split by conjunctions

---

## MCP Tools Reference

### switch-model
Manual model lifecycle management.

**Parameters:**
```json
{
  "action": "load|unload|list|current",
  "modelId": "optional-string",
  "deviceId": "optional-tailscale-node-id"
}
```

### execute-task
Automatic task execution with intelligent model selection.

**Parameters:**
```json
{
  "query": "required-string",
  "modelType": "optional-enum"
}
```

### orchestrate-task
Multi-device orchestration across LM Link devices.

**Parameters:**
```json
{
  "task": "required-string",
  "maxSubtasks": "optional-number (default: 5)",
  "requiredCapabilities": ["optional-array"]
}
```

### research-swarm
Distributed research across lightweight models on multiple devices.

**Parameters:**
```json
{
  "query": "required-string",
  "maxSubtasks": "optional-number (default: 4)",
  "compact": "optional-boolean (default: true)"
}
```

---

## DNA Configuration Guide

### Basic Structure
```json
{
  "version": 3,
  "primaryRole": "conversationalist",
  "models": {
    "conversationalist": { "purpose": "...", ... },
    "ninja-researcher": { "purpose": "...", ... }
  },
  "taskModelMapping": {
    "codeFixes": "ninja-researcher",
    "featureArchitecture": "architect"
  },
  "usageStats": {
    "modelEffectiveness": { ... }
  },
  "orchestratorConfig": { ... }
}
```

### Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `LM_STUDIO_URL` | http://localhost:1234 | LM Studio API URL |
| `MAX_PARALLEL_REQUESTS_GLOBAL` | 4 | Global concurrency limit |
| `DEFAULT_DEVICE_CONCURRENT_LIMIT` | 2 | Remote device limit |
| `DEVICE_COOLDOWN_MS` | 1000ms | Post-request pause |

---

## Development Workflow

### Adding a New Feature - Quick Checklist
1. **Determine component type:** Tool, Service, or Utility
2. **Create file in appropriate directory:**
   - Tools → `src/tools/`
   - Services → `src/services/`
   - Utils → `src/utils/`
3. **Implement according to patterns** (see developer guides)
4. **Register tool/service** in `src/server.js`
5. **Add tests** in `tests/` directory
6. **Update documentation**

### Testing Pattern
```bash
# Run all tests
npm test

# Run specific test file
npx node --test tests/orchestrator.test.js

# Watch mode (if supported)
npm test -- --watch
```

---

## Common Patterns

### Service Pattern
```javascript
export class ServiceName {
  constructor() { /* initialization */ }
  
  async initialize() { /* start services */ }
  
  shutdown() { /* cleanup */ }
}

export const serviceName = new ServiceName();
export async function initializeServiceName() { ... }
```

### Tool Pattern
```javascript
export const toolNameTool = {
  name: "tool-name",
  description: "[ROLE]...\n[CONTEXT]...\n[TASK]...",
  inputSchema: z.object({ ... })
};

export async function handleToolName(params) { ... }
```

---

## Troubleshooting

### Common Issues

**DNA not initialized**
- Solution: Call `model-dna` with `action: "init"`

**Device discovery failing**
- Check: LM Studio is running with models loaded
- Verify: Tailscale mesh connection for remote devices

**Load tracking issues**
- Review: Device registry and load tracker configuration
- Adjust: `MAX_PARALLEL_REQUESTS_GLOBAL` and related env vars

---

## Next Steps

1. Read `docs/adding-new-tools.md` for tool development guide
2. Read `docs/adding-new-services.md` for service development
3. Explore `docs/architecture/` for deeper architecture understanding
4. Check `tests/` for working examples of patterns in action