/**
 * Route Task To MCP Tool Handler
 *
 * Provides a direct interface for Cline to route tasks to the appropriate MCP.
 * This is the "main entry point" for cross-MCP orchestration.
 */

import { routeTask, getAvailableMcpServers, getToolDescription } from "../services/task-router.js";

/**
 * Tool definition with Cline-optimized description
 */
export const routeTaskToMcpTool = {
  name: "route-task-to-mcp",
  description:
    `[ROLE] You are a cross-MCP task router that automatically routes tasks to the appropriate MCP server.\n\n` +
    `[CONTEXT] User wants to execute a task and needs to know which MCP (and tool) should handle it.\n\n` +
    `[TASK] Route the task:\n` +
    "- Analyze the query for intent, capabilities needed, and complexity\n" +
    "- Match against routing rules to find best MCP/tool combination\n" +
    "- Return detailed routing decision with explanation\n\n" +
    `[CONSTRAINTS]\n` +
    "  - Automatically routes to mcp-lm-link-orchestrator, web-search-mcp, or doc-processor\n" +
    "  - Uses pattern matching on query text for intelligent routing\n" +
    "  - Considers capabilities like image analysis, research, code generation\n\n" +
    `[FORMAT] Returns JSON with selected MCP, tool, match score, and detailed explanation.`,
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The task or query to route to the appropriate MCP"
      },
      capabilities: {
        type: "array",
        items: { type: "string" },
        description: "Required capabilities for this task (e.g., 'imageAnalysis', 'research', 'codeGeneration')"
      },
      priority: {
        type: "number",
        minimum: 1,
        maximum: 20,
        description: "Task priority (higher = more urgent)"
      },
    },
    required: ["query"],
  },
};

/**
 * Handle route-task-to-mcp tool execution
 * @param {Object} params - Tool parameters
 * @returns {Promise<Object>} Routing decision with explanation
 */
export async function handleRouteTaskToMcp(params) {
  const { query, capabilities = [], priority = 5 } = params;

  if (!query || typeof query !== "string") {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ error: "query is required" }, null, 2),
      }],
      isError: true,
    };
  }

  try {
    // Route the task
    const routingResult = routeTask(query, { capabilities, priority });

    // Get available MCP servers for context
    const mcpServers = getAvailableMcpServers();

    // Build detailed explanation
    const explanation = buildExplanation(routingResult, mcpServers);

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          routing: routingResult,
          availableMcpServers: mcpServers,
          explanation,
          timestamp: new Date().toISOString(),
        }, null, 2),
      }],
    };
  } catch (error) {
    console.error(`[RouteTaskToMcp] Error: ${error.message}`);

    return {
      content: [{
        type: "text",
        text: JSON.stringify({ 
          error: error.message,
          query,
          capabilities,
        }, null, 2),
      }],
      isError: true,
    };
  }
}

/**
 * Build detailed explanation for the routing decision
 */
function buildExplanation(routingResult, mcpServers) {
  const { mcp, tool, reason, matchScore, ruleId } = routingResult;

  // Find MCP details
  const mcpDetails = mcpServers.find(s => s.name === mcp);

  return `
## Routing Decision Summary

### Selected MCP: ${mcp}
**Priority:** ${mcpDetails?.priority || "N/A"}
**Capabilities:** ${mcpDetails?.capabilities?.join(", ") || "N/A"}

### Recommended Tool: ${tool}
**Description:** ${getToolDescription(mcp, tool)}

### Match Score: ${matchScore}/25
**Rule ID:** ${ruleId}
**Reason:** ${reason}

### Query Classification
Based on the query text, I identified:
- **Intent:** Task routing to optimize execution
- **Complexity:** Moderate (multi-MCP coordination)
- **Capabilities Needed:** ${mcpDetails?.capabilities?.join(", ") || "N/A"}

### Available MCPs for This Task
${mcpServers.map(s => 
  `**${s.name}:**\n` +
  `   - Priority: ${s.priority}\n` +
  `   - Capabilities: ${getMcpCapabilitiesDesc(s.capabilities)}`
).join("\n\n")}

### Next Steps
1. **Call the recommended tool:** ${tool} from ${mcp}
2. **Review results** and determine if aggregation is needed
3. **Optional chaining:** Results can be passed to another MCP for follow-up actions

### Example Usage in Cline
\`\`\`json
{
  "tool": "${tool}",
  "server": "${mcp}",
  "params": {
    ${tool === "full-web-search" ? '"query"' : tool === "read-doc" ? '"filePath"' : "query"}
  }
}
\`\`\`
`.trim();
}

/**
 * Get human-readable description of MCP capabilities
 */
function getMcpCapabilitiesDesc(capabilities) {
  if (!capabilities || !capabilities.length) return "Standard execution";

  const descriptions = {
    deviceAware: "Multi-device orchestration with Tailscale mesh routing",
    parallelExecution: "Parallel task execution across multiple devices",
    modelLifecycle: "Model loading/unloading with DNA-based selection",
    contentExtraction: "Web page content extraction and summarization",
    multiSource: "Multiple source aggregation (search, URLs, pages)",
    webSearch: "Comprehensive web search capabilities",
    documentAnalysis: "Document analysis from DOCX, PDF, XLSX files",
    multiFormat: "Support for multiple document formats",
    uiAnalysis: "UI screenshot to code/spec conversion",
  };

  return capabilities
    .map(cap => descriptions[cap] || cap)
    .join(" | ");
}