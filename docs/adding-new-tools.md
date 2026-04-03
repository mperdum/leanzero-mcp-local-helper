# Adding New MCP Tools - Developer Guide

**Last Updated:** April 3, 2026  
**Purpose:** Step-by-step guide for adding new tools to the MCP server

---

## Overview

This guide explains how to add new tools to the MCP Local Helper. Tools are the primary interface through which AI models (like Cline) interact with this server.

### Tool Categories
1. **Manual Control Tools** - Direct user-initiated actions (e.g., switch-model)
2. **Automatic Execution Tools** - Intelligent task handling (e.g., execute-task)
3. **Orchestration Tools** - Multi-device coordination (e.g., orchestrate-task)

---

## File Structure

```
src/tools/
├── tool-name.js          # Tool definition and handler
└── [existing tools...]   # See existing patterns for reference
```

### Required Files per Tool
- `tool-name.js` - Main module with:
  - `toolNameTool` object (tool metadata)
  - `handleToolName()` function (main logic)

---

## Step-by-Step Implementation

### Step 1: Create the Tool File

**File:** `src/tools/my-new-tool.js`

```javascript
/**
 * My New Tool Handler
 *
 * [ROLE] Brief description of tool's purpose.
 * [CONTEXT] User scenario and workflow.
 * [TASK] Main functionality and capabilities.
 */

import { someService } from '../services/some-service.js';
import z from 'zod';

// Tool definition - exposed to MCP clients
export const myNewTool = {
  name: "my-new-tool",
  description:
    `[ROLE] You are a tool expert that specializes in...\n\n` +
    `[CONTEXT] User wants to perform operations with optimal configuration.\n\n` +
    `[TASK] Main capabilities include:\n` +
    "  - Feature A: Description of first feature\n" +
    "  - Feature B: Description of second feature\n\n" +
    `[CONSTRAINTS]\n` +
    "  - Important constraints to consider\n" +
    "  - Any limitations or trade-offs\n\n` +
    `[FORMAT] Returns JSON with success status and result.`,
  inputSchema: z.object({
    // Define required parameters
    requiredParam: z.string().describe("Description of required parameter"),
    
    // Optional parameters with defaults
    optionalParam: z.number().min(1).max(100).optional()
      .describe("Optional parameter with range 1-100"),
  }),
};

// Tool handler - main execution logic
export async function handleMyNewTool(params) {
  const { requiredParam, optionalParam = 50 } = params;

  // Validate inputs
  if (!requiredParam || typeof requiredParam !== 'string') {
    return {
      content: [{ type: "text", text: JSON.stringify({ error: "requiredParam is required" }, null, 2) }],
      isError: true,
    };
  }

  try {
    // Execute tool logic using services
    const result = await someService.performOperation(requiredParam, optionalParam);

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          requiredParam,
          optionalParam,
          result,
          timestamp: new Date().toISOString(),
        }, null, 2),
      }],
    };
  } catch (error) {
    console.error(`[MyNewTool] Error: ${error.message}`);
    
    return {
      content: [{ type: "text", text: JSON.stringify({ error: error.message }, null, 2) }],
      isError: true,
    };
  }
}
```

---

### Step 2: Register the Tool in Server

**File:** `src/server.js` (import and registration)

```javascript
// Import your new tool at the top with other imports
import { myNewTool, handleMyNewTool } from './tools/my-new-tool.js';

// In registerTools() function, add registration:
server.registerTool(
  "my-new-tool",
  {
    title: "My New Tool",
    description: myNewTool.description,
    inputSchema: z.object({
      requiredParam: z.string().describe("Required parameter"),
      optionalParam: z.number().min(1).max(100).optional()
        .describe("Optional parameter (default: 50)"),
    }),
  },
  async ({ requiredParam, optionalParam }) =>
    handleMyNewTool({ requiredParam, optionalParam })
);
```

---

### Step 3: Add Tests

**File:** `tests/my-new-tool.test.js`

```javascript
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { myNewTool, handleMyNewTool } from '../src/tools/my-new-tool.js';

describe('my-new-tool', () => {
  let mockService;

  beforeEach(() => {
    // Mock service for testing
    mockService = {
      performOperation: async (requiredParam, optionalParam) => ({
        data: `Processed ${requiredParam} with option ${optionalParam}`,
        status: 'success',
      }),
    };
    
    // Replace the imported service with mock
    vi.mock('../services/some-service.js', () => ({
      someService: mockService,
    }));
  });

  it('should execute tool successfully with valid parameters', async () => {
    const result = await handleMyNewTool({
      requiredParam: 'test-data',
      optionalParam: 75,
    });

    assert.strictEqual(result.content.length, 1);
    const content = JSON.parse(result.content[0].text);
    
    assert.strictEqual(content.success, true);
    assert.strictEqual(content.requiredParam, 'test-data');
    assert.strictEqual(content.optionalParam, 75);
    assert.ok(content.result.data.includes('test-data'));
  });

  it('should handle missing required parameter', async () => {
    const result = await handleMyNewTool({
      optionalParam: 50,
    });

    assert.strictEqual(result.isError, true);
    assert.ok(result.content[0].text.includes('requiredParam is required'));
  });

  it('should use default value for optional parameter', async () => {
    const result = await handleMyNewTool({
      requiredParam: 'test',
    });

    const content = JSON.parse(result.content[0].text);
    assert.strictEqual(content.optionalParam, 50); // default
  });
});
```

---

## Tool Pattern Reference

### Description Format Template
```javascript
description:
  `[ROLE] You are a role that specializes in...\n\n` +
  `[CONTEXT] User scenario and workflow.\n\n` +
  `[TASK] Main capabilities include:\n` +
  "  - Feature A: Description\n" +
  "  - Feature B: Description\n\n" +
  `[CONSTRAINTS]\n` +
  "  - Important constraints\n\n" +
  `[FORMAT] Returns JSON format with...`,
```

### Input Schema Patterns

**Simple String Parameter:**
```javascript
query: z.string().describe("Description")
```

**Enum Parameter:**
```javascript
action: z.enum(['load', 'unload', 'list']).describe("Action to perform")
```

**Optional with Default:**
```javascript
maxItems: z.number().min(1).max(100).optional()
  .describe("Maximum items (default: 10)")
```

**Array of Strings:**
```javascript
items: z.array(z.string()).optional()
  .describe("List of item names")
```

---

## Tool Registration Checklist

When registering a tool in `server.js`, ensure:

- [ ] Import statement added at top of file
- [ ] `registerTool()` call with unique name
- [ ] Description from tool definition used
- [ ] Input schema defined and validated
- [ ] Async handler function connected
- [ ] Tool tested with sample inputs

---

## Common Patterns

### Pattern 1: Stateful Tool
Tools that maintain state between calls:
```javascript
let _cache = new Map();

export async function handleStatefulTool(params) {
  const { key, value } = params;
  
  if (value !== undefined) {
    // Set operation
    _cache.set(key, value);
  }
  
  return { content: [{ type: "text", text: JSON.stringify(_cache.get(key)) }] };
}
```

### Pattern 2: Stream-Enabled Tool
Tools that support streaming responses:
```javascript
export const streamTool = {
  name: "stream-tool",
  description: "...",
  inputSchema: z.object({...}),
};

export async function* handleStreamTool(params) {
  for await (const chunk of generateChunks(params)) {
    yield {
      content: [{ type: "text", text: JSON.stringify(chunk) }],
    };
  }
}
```

### Pattern 3: Multi-Step Tool
Tools with complex multi-step workflows:
```javascript
export async function handleMultiStepTool(params) {
  const { step1Result } = await step1(params);
  const { step2Result } = await step2(step1Result);
  return finalize(step2Result);
}
```

---

## Testing Best Practices

1. **Unit Tests:** Test handler logic in isolation
2. **Integration Tests:** Test with actual services
3. **Error Handling:** Verify error responses for edge cases
4. **Schema Validation:** Ensure input validation works correctly

Run tests:
```bash
npm test tests/my-new-tool.test.js
```

---

## Next Steps

After creating your tool, consider:

1. Adding to `docs/AI_GUIDE.md` under MCP Tools Reference
2. Updating this guide if new patterns emerge
3. Creating example usage scenarios in documentation