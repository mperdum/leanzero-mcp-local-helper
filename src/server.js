#!/usr/bin/env node

/**
 * MCP Model Switcher Server
 *
 * Main entry point for the Model Context Protocol (MCP) server that exposes
 * intelligent model switching and task execution capabilities to MCP clients.
 *
 * This server implements the Model Context Protocol (MCP) and provides four core tools:
 * - switch-model: Manual model lifecycle management
 * - execute-task: Automatic task execution with intelligent model selection
 * - model-dna: DNA configuration management
 * - rate-model: Model effectiveness rating collection
 *
 * Requirements:
 * - Node.js 18+
 * - LM Studio running with models available
 * - @modelcontextprotocol/sdk package
 */

import { McpServer } from "@modelcontextprotocol/sdk/server.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import z from "zod";

// Import tool handlers from tools directory
import { switchModelTool, handleSwitchModel } from "./tools/switch-model.js";
import { executeTaskTool, handleExecuteTask } from "./tools/execute-task.js";
import { modelDnaTool, handleModelDNA } from "./tools/model-dna-tool.js";
import { rateModelTool, handleRateModel } from "./tools/rate-model.js";

// Import orchestration tools
import { orchestrateTaskTool, handleOrchestrateTask } from "./tools/orchestrate-task.js";
import { listDevicesTool, handleListDevices } from "./tools/list-devices.js";
import { dispatchSubtaskTool, handleDispatchSubtask } from "./tools/dispatch-subtask.js";
import { researchSwarmTool, handleResearchSwarm } from "./tools/research-swarm.js";
import { listMcpToolsTool, handleListMcpTools } from "./tools/list-mcp-tools.js";
import { routeTaskToMcpTool, handleRouteTaskToMcp } from "./tools/route-task-to-mcp.js";

// Import core services for initialization
import { lmStudioSwitcher } from "./services/lm-studio-switcher.js";

/**
 * MCP Server Configuration
 */
const SERVER_CONFIG = {
  name: "mcp-lm-link-orchestrator",
  version: "1.0.0",
  description: "Multi-device orchestration across LM Link connected devices via Tailscale mesh VPN",
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
 * @param {McpServer} server - MCP server instance
 */
function registerTools(server) {
  console.log("[MCP-Server] Registering tools...");

  // Register switch-model tool
  server.registerTool(
    "switch-model",
    {
      title: "Switch Model",
      description: switchModelTool.description,
      inputSchema: z.object({
        action: z.enum(["load", "unload", "list", "current"]),
        modelId: z.string().optional(),
        deviceId: z.string().optional().describe("Target device ID (Tailscale node ID prefix) for explicit device targeting. Example: 'device-abc12345'. When omitted, LM Link routes based on model key."),
      }),
    },
    async ({ action, modelId, deviceId }) => handleSwitchModel({ action, modelId, deviceId })
  );

  // Register execute-task tool
  server.registerTool(
    "execute-task",
    {
      title: "Execute Task",
      description: executeTaskTool.description,
      inputSchema: z.object({
        query: z.string().describe("The task to execute"),
        modelType: z.enum(["conversationalist", "ninjaResearcher", "architect", "executor", "researcher", "vision"]).optional(),
      }),
    },
    async ({ query, modelType }) => handleExecuteTask({ query, modelType })
  );

  // Register model-dna tool
  server.registerTool(
    "model-dna",
    {
      title: "Model DNA Management",
      description: modelDnaTool.description,
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
      title: "Rate Model",
      description: rateModelTool.description,
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

  // Register orchestrate-task tool (multi-device orchestration)
  server.registerTool(
    "orchestrate-task",
    {
      title: "Orchestrate Multi-Device Task",
      description: orchestrateTaskTool.description,
      inputSchema: z.object({
        task: z.string().describe("The complex task to orchestrate across devices"),
        maxSubtasks: z.number().min(1).max(20).optional(),
        requiredCapabilities: z.array(z.string()).optional(),
      }),
    },
    async ({ task, maxSubtasks, requiredCapabilities }) =>
      handleOrchestrateTask({ task, maxSubtasks, requiredCapabilities })
  );

  // Register list-devices tool
  server.registerTool(
    "list-devices",
    {
      title: "List Connected Devices",
      description: listDevicesTool.description,
      inputSchema: z.object({
        includeLoadStats: z.boolean().optional(),
        filterByCapability: z.enum(["vision", "toolUse"]).optional(),
      }),
    },
    async ({ includeLoadStats, filterByCapability }) =>
      handleListDevices({ includeLoadStats, filterByCapability })
  );

  // Register dispatch-subtask tool
  server.registerTool(
    "dispatch-subtask",
    {
      title: "Dispatch Single Subtask (Debugging)",
      description: dispatchSubtaskTool.description,
      inputSchema: z.object({
        prompt: z.string().describe("The task/prompt to execute"),
        deviceId: z.string().optional(),
        modelKey: z.string().optional(),
        taskType: z.enum(["research", "code-generation", "analysis", "synthesis"]).optional(),
        priority: z.number().min(1).max(5).optional(),
      }),
    },
    async ({ prompt, deviceId, modelKey, taskType, priority }) =>
      handleDispatchSubtask({ prompt, deviceId, modelKey, taskType, priority })
  );

  // Register research-swarm tool (for Plan Mode orchestration with lightweight models)
  server.registerTool(
    "research-swarm",
    {
      title: "Research Swarm Orchestrator",
      description: researchSwarmTool.description,
      inputSchema: z.object({
        query: z.string().describe("The research query to execute across lightweight models"),
        maxSubtasks: z.number().min(1).max(32).optional(),
        compact: z.boolean().optional(),
      }),
    },
    async ({ query, maxSubtasks, compact }) =>
      handleResearchSwarm({ query, maxSubtasks, compact })
  );

  // Register list-mcp-tools tool (for MCP Tool Catalog discovery)
  server.registerTool(
    "list-mcp-tools",
    {
      title: "List MCP Tools",
      description: listMcpToolsTool.description,
      inputSchema: z.object({
        includeCapabilities: z.boolean().optional(),
        filterByCapability: z.enum(["contentExtraction", "multiSource", "documentAnalysis", "multiFormat", "parallelExecution", "deviceAware"]).optional(),
      }),
    },
    async ({ includeCapabilities, filterByCapability }) =>
      handleListMcpTools({ includeCapabilities, filterByCapability })
  );

  // Register route-task-to-mcp tool (for cross-MCP orchestration routing)
  server.registerTool(
    "route-task-to-mcp",
    {
      title: "Route Task to MCP",
      description: routeTaskToMcpTool.description,
      inputSchema: z.object({
        query: z.string().describe("The task or query to route to the appropriate MCP"),
        capabilities: z.array(z.string()).optional(),
        priority: z.number().min(1).max(20).optional(),
      }),
    },
    async ({ query, capabilities, priority }) =>
      handleRouteTaskToMcp({ query, capabilities, priority })
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

    // Additional cleanup if needed:
    // - Close database connections
    // - Flush logs
    // - Clean temporary files
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
