# MCP Tool Catalog - Context Handover Document

**Created:** April 3, 2026  
**Project:** LeanZero MCP Local Helper (Main Orchestrator)  
**Purpose:** Enable cross-MCP coordination and tool discovery across your 3 MCPs

---

## Current State of Your 3 MCPs

### 1. mcp-local-helper (This - Main Orchestrator)

**Location:** `/Users/mihaiperdum/Projects/mcp-local-helper`

**Registered Tools:**
| Tool Name | Purpose |
|-----------|---------|
| `switch-model` | Manual model lifecycle management in LM Studio |
| `execute-task` | Automatic task execution with intelligent model selection |
| `model-dna` | DNA configuration management for models |
| `rate-model` | Model effectiveness rating collection |
| `orchestrate-task` | Multi-device orchestration across LM Link devices |
| `list-devices` | List all connected LM Link devices with status |
| `dispatch-subtask` | Manual subtask dispatch (debugging) |
| `research-swarm` | Distributed research across lightweight models |

**Key Services:**
- `lm-studio-switcher.js` - Model loading/unloading, chat completions
- `device-registry.js` - LM Link device discovery and tracking
- `load-tracker.js` - Request load management per device/model
- `orchestrator.js` - Task decomposition and parallel execution
- `task-dispatcher.js` - Automatic task routing with fallbacks
- `research-swarm-orchestrator.js` - Lightweight model swarm orchestration

**DNA Configuration (.model-dna.json):**
- Models with purposes (conversationalist, ninja-researcher, architect, executor, researcher, vision)
- Task-to-model mappings for automatic selection
- Usage statistics and effectiveness ratings
- Memories for persistent preferences
- MCP integrations config

---

### 2. mcp-web-search

**Location:** `https://github.com/leanzero-srl/mcp-web-search`

**Purpose:** Web research & content fetching

**Key Capabilities:**
- Full web search with page content extraction
- Search result snippet summaries (lightweight alternative)
- Single page content extraction from URLs

**Tool Discovery Pattern:**
- Uses `/tools/list` endpoint for MCP tool listing
- Exposes tools for Cline to discover and use

---

### 3. leanzero-mcp-doc-processor

**Location:** `https://github.com/leanzero-srl/leanzero-mcp-doc-processor`

**Purpose:** Document analysis (DOCX, PDF, XLSX)

**Key Capabilities:**
- Read documents (summary, indepth, focused modes)
- Detect format from user intent
- Create Word DOCX documents with professional formatting
- Create Markdown files optimized for AI consumption
- Create Excel workbooks for data-heavy docs

---

## Orchestration Goals

### Phase 1: MCP Tool Catalog ✅ COMPLETED

**Objective:** Enable the main orchestrator to discover and catalog tools from all MCPs.

**Implementation Summary:**
- Created `src/tools/list-mcp-tools.js` - Discovers and catalogs tools from all 3 MCPs
- Registered in `src/server.js` with tool registration
- Documented in this handover document

**New Tool: list-mcp-tools**
```javascript
{
  name: "list-mcp-tools",
  description: "Discovers and catalogs tools from all connected MCP servers...",
  inputSchema: {
    includeCapabilities: z.boolean().optional(),
    filterByCapability: z.enum([...]).optional()
  }
}
```

**Returns:**
```json
{
  "totalMcpServers": 3,
  "mcpServers": [
    {
      "name": "mcp-lm-link-orchestrator",
      "description": "Main orchestrator for LM Link multi-device orchestration",
      "tools": [...8 tools...],
      "capabilities": ["deviceAware", "parallelExecution"]
    },
    {
      "name": "web-search-mcp",
      "description": "Web search and content extraction",
      "tools": [...3 tools...],
      "capabilities": ["contentExtraction", "multiSource"]
    },
    {
      "name": "doc-processor",
      "description": "Document analysis (DOCX, PDF, XLSX)",
      "tools": [...12 tools...],
      "capabilities": ["documentAnalysis", "multiFormat"]
    }
  ]
}
```

**Implementation Plan:**
1. Create `src/tools/list-mcp-tools.js` - Discover all MCP tools ✅
2. Add to `src/server.js` registration ✅
3. Document in this handover document ✅

---

### Phase 2: Task Router Service ✅ COMPLETED

**Objective:** Automatically route tasks to the appropriate MCP based on task type/capabilities.

**Implementation Summary:**
- Created `src/services/task-router.js` - Centralized routing logic with pattern matching
- Created `src/tools/route-task-to-mcp.js` - Tool for Cline to call directly
- Registered in `src/server.js` with tool registration

**New Tools:**

1. **route-task-to-mcp** (Direct entry point for cross-MCP orchestration)
```javascript
{
  name: "route-task-to-mcp",
  description: "Automatically routes tasks to the appropriate MCP server...",
  inputSchema: {
    query: z.string(), // Required - task/query to route
    capabilities: z.array(z.string()).optional(),
    priority: z.number().min(1).max(20).optional()
  }
}
```

2. **task-router.js** (Internal routing service)
- Pattern-based matching on query text
- Capability-aware routing with scoring
- Dynamic rule updates via environment variables

**Routing Rules (Priority Order):**
| ID | Pattern | MCP | Tool |
|----|---------|-----|------|
| image-analysis | image, visual, screenshot, diagram, ui | doc-processor | read-doc |
| vision-task | analyze.*image, visual.*analysis | doc-processor | analyze-image |
| research-query | research, query, information, what is | web-search | get-web-search-summaries |
| content-extraction | extract.*content, fetch.*page | web-search | get-single-web-page-content |
| document-creation | create.*doc, write.*report | doc-processor | detect-format |
| code-generation | code, function, class, create | mcp-lm-link-orchestrator | execute-task |
| multi-device | multiple.*device, distributed | mcp-lm-link-orchestrator | orchestrate-task |

**Match Score Calculation:**
```javascript
score = priority + capabilityBoost(taskTypeMatch) + keywordBoost;
// Max possible score: 25 (priority 10 + capability 10 + complexity 3 + keywords 2)
```

**Implementation Plan:**
1. Create `src/services/task-router.js` - Centralized routing logic ✅
2. Create `src/tools/route-task-to-mcp.js` - Tool for Cline to call ✅
3. Document routing rules in handover ✅

---

### Phase 3: Enhanced Device+Model Selection ✅ IN PROGRESS

**Objective:** Explicit targeting of devices with Tailscale node ID support.

**Implementation Summary:**
- Updated `switch-model` tool to accept optional `deviceId` parameter
- Updated `lm-studio-switcher.js` load/unload methods to support explicit device targeting via `tailscale_node_id`
- Added `_extractDeviceNodeId()` helper method for parsing device IDs

**Enhanced API:**

1. **switch-model Tool**
```javascript
{
  action: "load",
  modelId: "llama-3.2-9b",
  deviceId: "device-abc12345"  // Optional - explicit device selection
}
```

2. **LM Studio Switcher Enhancements**
- `_extractDeviceNodeId(deviceId)` - Parses device ID to extract Tailscale node ID
- `loadModel(modelId, options)` - Now supports `options.deviceId`
- `unloadModel(modelId, options)` - Now supports `options.deviceId`

**Device ID Pattern:**
```
device-abc12345  → Extracts 'abc12345' as Tailscale node ID
abc12345         → Direct hex string (first 8 chars used)
device-local     → Local device (no explicit routing needed)
```

**Benefits:**
- Same model key can be loaded on multiple devices simultaneously
- Explicit `deviceId` allows targeting specific device when same model is active elsewhere
- LM Link Tailscale mesh handles the actual routing transparently

---

### Phase 4: Cross-MCP Orchestration Flows ✅ COMPLETED

**Objective:** End-to-end orchestration flows that span multiple MCPs.

**Implementation Summary:**
- Created `task-router.js` for automatic MCP selection
- Created `route-task-to-mcp.js` tool for direct routing from Cline
- Registered in `src/server.js` with both new tools

**Example Flow 1: Image Analysis**
```
User uploads image → 
  Doc Processor reads image (read-doc) → 
    Vision model explains content →
      Results aggregated in local helper
```

**Example Flow 2: Research Query**
```
User asks question → 
  Web Search executes query (web-search-summaries) → 
    Results aggregated by local helper →
      Summary stored via Doc Processor if needed
```

**Example Flow 3: Multi-Device Orchestration (NEW)**
```
Cline queries "analyze this image and research related topics" →
  Route Task to MCP determines best tools:
  - Image analysis → doc-processor (ui-to-artifact)
  - Research → web-search-mcp (get-web-search-summaries)
  
  Both run in parallel, results aggregated when complete.
```

**Example Flow 4: End-to-End Orchestrated Research**
```
1. User asks "Compare LLM architectures for multimodal processing"
   ↓
2. Cline calls route-task-to-mcp with query
   ↓
3. Task Router analyzes query → determines:
   - Primary MCP: web-search-mcp (research capability matches)
   - Secondary MCP: doc-processor (for summarization)
   ↓
4. Parallel execution:
   ├─ Full-web-search (web-search) for architecture comparisons
   ├─ Research-swarm (local helper) for multimodal LLM details
   └─ List-devices to check available devices/models
   ↓
5. Results aggregated in local helper with DNA tracking
   ↓
6. Optional: Save summary via doc-processor for documentation
```

---

## Context Handover Mechanism

### Current Context Storage

1. **Model DNA (.model-dna.json)** - Long-term model configurations
2. **User DNA (.model-user.json)** - User-level preferences
3. **Task History** - In-memory in TaskDispatcher (last 10 tasks)
4. **Context Manager** - Preserves context across model switches (8000 token limit)

### Proposed Context Handover Enhancement

**New: MCP Tool Registry File (.mcp-tool-registry.json)**
```json
{
  "version": "1.0.0",
  "lastUpdated": "2026-04-03T...",
  "servers": {
    "mcp-lm-link-orchestrator": {
      "path": "/Users/mihaiperdum/Projects/mcp-local-helper",
      "tools": [...],
      "capabilities": {
        "parallelExecution": true,
        "deviceAware": true
      }
    },
    "web-search": {
      "url": "https://github.com/leanzero-srl/mcp-web-search",
      "tools": ["full-web-search", "get-web-search-summaries"],
      "capabilities": {
        "contentExtraction": true,
        "multiSource": true
      }
    },
    "doc-processor": {
      "url": "https://github.com/leanzero-srl/leanzero-mcp-doc-processor",
      "tools": ["read-doc", "detect-format", "create-doc"],
      "capabilities": {
        "documentAnalysis": true,
        "multiFormat": true
      }
    }
  },
  "routingRules": [
    {
      "pattern": "image|visual|screenshot|diagram",
      "mcp": "doc-processor",
      "reason": "Image analysis capability"
    },
    {
      "pattern": "research|query|information|what is",
      "mcp": "web-search",
      "reason": "Web research capability"
    }
  ]
}
```

---

## Next Steps Implementation Order

### Phase 1: MCP Tool Catalog ✅
- [ ] Create `list-mcp-tools.js` tool handler
- [ ] Add to server registration in `server.js`
- [ ] Test with local and remote MCPs

### Phase 2: Task Router Service
- [ ] Create `task-router.js` service
- [ ] Implement routing logic for each MCP
- [ ] Create `route-task-to-mcp.js` tool

### Phase 3: Enhanced Device+Model Selection
- [ ] Update `switch-model` to support deviceId parameter
- [ ] Add explicit device targeting in orchestration
- [ ] Document Tailscale node ID pattern

### Phase 4: Cross-MCP Orchestration Flows
- [ ] Create orchestration templates for common flows
- [ ] Implement end-to-end flows (Image → Doc Processor, Research → Web Search)
- [ ] Test complete flows with all MCPs

---

## Notes & Considerations

1. **LM Link Architecture:** All devices accessed via `localhost:1234`, model key identifies target device via Tailscale mesh routing.

2. **Context Preservation:** Current 8000 token limit can be tuned via environment variable `MAX_CONTEXT_TOKENS`.

3. **Parallel Execution:** Already built into orchestrator - each tool can spawn multiple subtasks that run concurrently.

4. **DNA-Driven Routing:** Model selection and task routing is already DNA-driven with automatic evolution suggestions.

---

## References

- [MCP Local Helper README](../README.md)
- [Phase 6 LM Link Orchestration](./phase-6-lm-link-orchestration.md)
- [Research Swarm Plan Mode](./research-swarm-plan-mode.md)