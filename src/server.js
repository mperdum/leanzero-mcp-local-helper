#!/usr/bin/env node

/**
 * MCP Model Switcher Server - The Orchestrator Helper
 *
 * Main entry point for the Model Context Protocol (MCP) server that exposes
 * intelligent orchestration and research capabilities to MCP clients.
 *
 * Core Philosophy: This MCP is THE Orchestrator Helper that:
 * - Spawns research subagents across devices (one agent per device)
 * - Manages their execution and aggregation
 * - Feeds consolidated output (~15k tokens) to the main AI model
 *
 * Primary Tool: "research" - The unified entry point for all orchestration tasks.
 * Secondary Tools: Remaining tools for manual control, debugging, or specific use cases.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import z from "zod";

// Import core research tool (main orchestrator)
import { researchTool, handleResearch, getResearchConfig, shutdownResearch } from "./tools/research.js";

// Import model lifecycle tools
import { switchModelTool, handleSwitchModel } from "./tools/switch-model.js";
import { modelDnaTool, handleModelDNA } from "./tools/model-dna-tool.js";
import { rateModelTool, handleRateModel } from "./tools/rate-model.js";

// Import orchestration/enhancement tools
import { listDevicesTool, handleListDevices } from "./tools/list-devices.js";
import { researchSwarmTool, handleResearchSwarm } from "./tools/research-swarm.js";

// Import core services for initialization
import { lmStudioSwitcher } from "./services/lm-studio-switcher.js";

/**
 * MCP Server Configuration
 */
const SERVER_CONFIG = {
  name: "mcp-lm-link-orchestrator",
  version: "1.0.0",
  description: "Multi-device orchestration across LM Link connected devices via Tailscale mesh VPN. The Orchestrator Helper that spawns research subagents (one per device) and aggregates results for the main AI model.",
  vendor: "LeanZero MCP",
  license: "MIT",
};

/**
 * Initialize the MCP server
 * @returns {McpServer} Configured MCP server instance
 */
function createServer() {
  console.error(`[MCP-Server] Starting ${SERVER_CONFIG.name} v${SERVER_CONFIG.version}`);

  // Create MCP server with capabilities
  const server = new McpServer(
    {
      name: SERVER_CONFIG.name,
      version: SERVER_CONFIG.version,
      description: SERVER_CONFIG.description,
    },
    {
      capabilities: {
        tools: {},
        // Future capabilities:
        // prompts: {},
        // resources: {},
        // logging: {},
      },
    }
  );

  // Register all tools
  registerTools(server);

  // Set up error handling
  server.onerror = (error) => {
    console.error(`[MCP-Server] Error:`, error);
  };

  // Connection/Disconnection logging
  server.onmessage = (message) => {
    // Optional: Log incoming messages for debugging
    // console.debug(`[MCP-Server] Received message:`, message);
  };

  return server;
}

/**
 * Register all tools with the MCP server
 * Tools are organized by priority:
 * - Primary: research (main orchestrator entry point)
 * - Secondary: model lifecycle, device info, swarm orchestration
 * @param {McpServer} server - MCP server instance
 */
function registerTools(server) {
  console.log("[MCP-Server] Registering tools...");

  // ============================================================================
  // PRIMARY TOOL: RESEARCH (Main Orchestrator Entry Point)
  // ============================================================================

  // Register research tool - the unified orchestrator
  server.registerTool(
    "research",
    {
      title: "Orchestrator Research Helper",
      description:
        `[ROLE] You are the Orchestrator Helper - the central coordinator for research tasks.\n\n` +
        `[CONTEXT] This MCP serves as your local orchestrator that intelligently routes research queries to appropriate subagents. Each subagent operates on a dedicated device (one agent per device), analyzing codebases or answering questions and returning focused results.\n\n` +
        `[TASK] Research a topic by describing what you want to explore:\n` +
        "- Simple queries: Direct execution on optimal device\n" +
        "- Complex queries (with 'and', numbered lists, multiple questions): Spawn subagents across multiple devices in parallel\n\n" +
        `[CONSTRAINTS]\n` +
        "  - One subagent per device (1:1 mapping)\n" +
        "  - Results aggregated to ~15k tokens max for main model consumption\n" +
        "  - All agents share the main project DNA configuration\n" +
        '  - Uses Cline-inspired prompt construction for subagents\n' +
        '[FORMAT] Returns JSON with agent results per device, aggregated synthesis, and token usage.\n\n' +
        `[EXAMPLE USAGE]\n` +
        "- Simple: 'What does the auth flow look like?'\n" +
        "- Complex: 'Research authentication and authorization patterns, compare implementations in src/auth/ and src/lib/, then analyze test coverage'",
      inputSchema: z.object({
        query: z.string().describe("The research query to execute across devices. Use multiple questions, numbered lists, or 'and' for complex tasks that benefit from parallel subagents."),
        maxSubtasks: z.number().min(1).max(20).optional()
          .describe("Maximum number of subtasks to spawn per device (default: 5)"),
      }),
    },
    async ({ query, maxSubtasks }) => handleResearch({ query, maxSubtasks })
  );

  // ============================================================================
  // SECONDARY TOOLS: Model Lifecycle & Device Management
  // ============================================================================

  // Register switch-model tool
  server.registerTool(
    "switch-model",
    {
      title: "Switch Model (Manual)",
      description:
        `[ROLE] Use this tool when you need to manually control model lifecycle on devices.\n\n` +
        `[CONTEXT] While the research orchestrator handles most automatic routing, this tool lets you explicitly load/unload models or check current state. This is useful for:\n` +
        "- Pre-loading specific models before research tasks\n" +
        "- Manual testing of different model capabilities\n" +
        "- Troubleshooting model-specific issues\n\n" +
        `[FORMAT] Actions return information about the operation result.`,
      inputSchema: z.object({
        action: z.enum(["load", "unload", "list", "current"]),
        modelId: z.string().optional(),
        deviceId: z.string().optional().describe("Target device ID for explicit device targeting. When omitted, LM Link routes based on model key."),
      }),
    },
    async ({ action, modelId, deviceId }) => handleSwitchModel({ action, modelId, deviceId })
  );

  // Register model-dna tool
  server.registerTool(
    "model-dna",
    {
      title: "Model DNA Management (Configuration)",
      description:
        `[ROLE] Use this to view and configure the project's Model DNA.\n\n` +
        `[CONTEXT] The DNA tracks model effectiveness, performance metrics, and configuration preferences across all research tasks. This helps the orchestrator make informed routing decisions.\n\n` +
        `[FORMAT] Supports init, get, evolve actions for full DNA lifecycle management.`,
      inputSchema: z.object({
        action: z.enum(["init", "get", "save-memory", "delete-memory", "evolve"]),
        companyName: z.string().optional(),
        modelId: z.string().optional(),
        memory: z.string().optional(),
        key: z.string().optional(),
        apply: z.boolean().optional(),
      }),
    },
    async ({ action, companyName, modelId, memory, key, apply }) =>
      handleModelDNA({ action, companyName, modelId, memory, key, apply })
  );

  // Register rate-model tool
  server.registerTool(
    "rate-model",
    {
      title: "Rate Model Effectiveness",
      description:
        `[ROLE] Rate the effectiveness of models used in research tasks.\n\n` +
        `[CONTEXT] After research tasks complete, use this to provide feedback on model performance. The orchestrator uses these ratings to optimize future task routing.\n\n` +
        `[FORMAT] 1-5 rating scale with optional feedback.`,
      inputSchema: z.object({
        modelRole: z.enum(["conversationalist", "ninjaResearcher", "architect", "executor", "researcher", "vision"]),
        taskType: z.enum(["codeFixes", "featureArchitecture", "codeExecution", "generalResearch", "imageAnalysis"]),
        rating: z.number().min(1).max(5),
        feedback: z.string().optional(),
      }),
    },
    async ({ modelRole, taskType, rating, feedback }) =>
      handleRateModel({ modelRole, taskType, rating, feedback })
  );

  // ============================================================================
  // SUPPORTING TOOLS: Device & Swarm Orchestration
  // ============================================================================

  // Register list-devices tool
  server.registerTool(
    "list-devices",
    {
      title: "List Connected Devices",
      description:
        `[ROLE] Get an overview of all connected devices.\n\n` +
        `[CONTEXT] The research orchestrator uses this to determine available subagents. Use this for:\n` +
        "- Checking device availability before complex research tasks\n" +
        "- Monitoring load across devices\n` +
        "- Verifying Tailscale mesh connectivity",
      inputSchema: z.object({
        includeLoadStats: z.boolean().optional(),
        filterByCapability: z.enum(["vision", "toolUse"]).optional(),
      }),
    },
    async ({ includeLoadStats, filterByCapability }) =>
      handleListDevices({ includeLoadStats, filterByCapability })
  );

  // Register research-swarm tool (enhanced swarm with device targeting)
  server.registerTool(
    "research-swarm",
    {
      title: "Research Swarm Orchestrator",
      description:
        `[ROLE] Execute distributed research using lightweight models across devices.\n\n` +
        `[CONTEXT] This is a specialized orchestration method for research tasks that benefit from parallel lightweight model execution. The main 'research' tool automatically uses swarm when appropriate, but you can explicitly invoke this for fine-grained control.`,
      inputSchema: z.object({
        query: z.string().describe("The research query to execute across lightweight models"),
        maxSubtasks: z.number().min(1).max(32).optional(),
        compact: z.boolean().optional(),
      }),
    },
    async ({ query, maxSubtasks, compact }) =>
      handleResearchSwarm({ query, maxSubtasks, compact })
  );

  console.log("[MCP-Server] Tools registered successfully");
}

/**
 * Graceful shutdown handler
 */
function setupSignalHandlers(server) {
  const signals = ["SIGINT", "SIGTERM", "SIGHUP"];

  for (const signal of signals) {
    process.on(signal, async () => {
      console.log(`[MCP-Server] Received ${signal}, shutting down gracefully...`);

      try {
        // Close MCP server connection
        await server.close();
        console.log("[MCP-Server] Server connection closed");

        // Shutdown core services
        await shutdownServices();

        console.log("[MCP-Server] Shutdown complete");
        process.exit(0);
      } catch (error) {
        console.error("[MCP-Server] Error during shutdown:", error);
        process.exit(1);
      }
    });
  }
}

/**
 * Shutdown all core services
 */
async function shutdownServices() {
  try {
    // Shutdown LM Studio switcher (stops health checks, clears caches)
    if (lmStudioSwitcher) {
      lmStudioSwitcher.shutdown();
      console.log("[MCP-Server] LM Studio switcher shut down");
    }

    // Shutdown orchestration services
    const { taskOrchestrator, loadTracker, deviceRegistry } = await import("./services/orchestrator.js");

    if (taskOrchestrator) {
      taskOrchestrator.shutdown();
      console.log("[MCP-Server] Task orchestrator shut down");
    }

    if (loadTracker && typeof loadTracker.shutdown === "function") {
      loadTracker.shutdown();
      console.log("[MCP-Server] Load tracker shut down");
    }

    // Shutdown research orchestrator
    if (typeof shutdownResearch === "function") {
      await shutdownResearch();
      console.log("[MCP-Server] Research orchestrator shut down");
    }
  } catch (error) {
    console.error("[MCP-Server] Error shutting down services:", error);
  }
}

/**
 * Main entry point
 */
async function main() {
  try {
    // Create MCP server
    const server = createServer();

    // Setup signal handlers for graceful shutdown
    setupSignalHandlers(server);

    // Initialize core services (optional - services will auto-initialize on first use)
    import("./services/lm-studio-switcher.js").then(({ initializeLMStudioSwitcher }) => {
      initializeLMStudioSwitcher();
    });

    // Import and initialize orchestration services
    Promise.all([
      import("./services/orchestrator.js"),
      import("./services/load-tracker.js"),
      import("./services/device-registry.js")
    ]).then(([orchMod, loadMod, devMod]) => {
      if (orchMod.initializeOrchestrator) {
        orchMod.initializeOrchestrator();
      }
    });

    // Create transport (stdio for MCP)
    const transport = new StdioServerTransport();

    // Connect server to transport
    await server.connect(transport);

    console.log("[MCP-Server] Ready and listening on stdio");
  } catch (error) {
    console.error("[MCP-Server] Failed to start:", error);
    process.exit(1);
  }
}

// Start server if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("[MCP-Server] Fatal error:", error);
    process.exit(1);
  });
}

// Export for testing and programmatic usage
export { createServer, main, shutdownServices };