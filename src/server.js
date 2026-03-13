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

// Import core services for initialization
import { lmStudioSwitcher } from "./services/lm-studio-switcher.js";

/**
 * MCP Server Configuration
 */
const SERVER_CONFIG = {
  name: "mcp-model-switcher",
  version: "1.0.0",
  description: "Intelligent model switching and task execution for LM Studio",
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
      }),
    },
    async ({ action, modelId }) => handleSwitchModel({ action, modelId })
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
    // Uncomment to pre-initialize LM Studio connection on startup:
    // import { initializeLMStudioSwitcher } from "./services/lm-studio-switcher.js";
    // await initializeLMStudioSwitcher();

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
export { createServer, main };
export default server;
