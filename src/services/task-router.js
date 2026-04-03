/**
 * Task Router Service
 *
 * Automatically routes tasks to the appropriate MCP based on task type/capabilities.
 * Serves as a centralized routing hub for cross-MCP orchestration.
 */

import { classifyTask } from "../utils/task-classifier.js";

// Default routing configuration
const DEFAULT_ROUTING_CONFIG = {
  // Priority order for MCPs (lower = higher priority)
  mcpPriorities: [
    "mcp-lm-link-orchestrator",
    "web-search-mcp",
    "doc-processor",
  ],

  // Routing rules - matched in order, first match wins
  routingRules: [
    {
      id: "image-analysis",
      pattern: /image|visual|screenshot|diagram|ui|mockup|wireframe/i,
      mcp: "doc-processor",
      tool: "read-doc",
      reason: "Image analysis capability (UI-to-artifact, extract-text-from-screenshot)",
      priority: 10,
    },
    {
      id: "vision-task",
      pattern: /analyze.*image|visual.*analysis|describe.*ui/i,
      mcp: "doc-processor",
      tool: "analyze-image",
      reason: "General image analysis capability",
      priority: 9,
    },
    {
      id: "research-query",
      pattern: /research|query|information|what is|compare|vs\.?|versus/i,
      mcp: "web-search",
      tool: "get-web-search-summaries",
      reason: "Web research capability (search summaries, full web search)",
      priority: 8,
    },
    {
      id: "content-extraction",
      pattern: /extract.*content|fetch.*page|scrape/i,
      mcp: "web-search",
      tool: "get-single-web-page-content",
      reason: "Single page content extraction capability",
      priority: 7,
    },
    {
      id: "document-creation",
      pattern: /create.*doc|write.*report|generate.*markdown/i,
      mcp: "doc-processor",
      tool: "detect-format",
      reason: "Document creation and format detection",
      priority: 6,
    },
    {
      id: "code-generation",
      pattern: /code|function|class|create|write.*js|typescript/i,
      mcp: "mcp-lm-link-orchestrator",
      tool: "execute-task",
      reason: "Code generation with optimal model selection",
      priority: 5,
    },
    {
      id: "multi-device",
      pattern: /multiple.*device|distributed|parallel.*execution/i,
      mcp: "mcp-lm-link-orchestrator",
      tool: "orchestrate-task",
      reason: "Multi-device orchestration with parallel execution",
      priority: 4,
    },
    {
      id: "model-management",
      pattern: /switch.*model|load.*model|unload.*model/i,
      mcp: "mcp-lm-link-orchestrator",
      tool: "switch-model",
      reason: "Model lifecycle management with DNA-based selection",
      priority: 3,
    },
    {
      id: "document-analysis",
      pattern: /analyze.*doc|read.*file|extract.*text/i,
      mcp: "doc-processor",
      tool: "read-doc",
      reason: "Document analysis from DOCX, PDF, XLSX files",
      priority: 2,
    },
  ],

  // Fallback behavior
  fallback: {
    defaultMcp: "mcp-lm-link-orchestrator",
    defaultTool: "execute-task",
    useCapabilitiesMatch: true,
  },
};

/**
 * Load routing configuration from environment or DNA
 */
function loadRoutingConfig() {
  const envConfig = process.env.MCP_ROUTING_CONFIG;
  
  if (envConfig) {
    try {
      return { ...DEFAULT_ROUTING_CONFIG, ...JSON.parse(envConfig) };
    } catch (error) {
      console.warn(`[TaskRouter] Failed to parse MCP_ROUTING_CONFIG: ${error.message}`);
    }
  }

  // Try loading from DNA
  const dna = loadModelDNA();
  if (dna?.orchestratorConfig?.routing) {
    return { ...DEFAULT_ROUTING_CONFIG, ...dna.orchestratorConfig.routing };
  }

  return DEFAULT_ROUTING_CONFIG;
}

/**
 * Classify intent from user query and find best matching MCP
 * @param {string} query - User's task/query
 * @param {Object} options - Additional options (capabilities, priority)
 * @returns {{ mcp: string, tool: string, reason: string, matchScore: number }}
 */
export function routeTask(query, options = {}) {
  const config = loadRoutingConfig();
  
  // Classify the query first
  const classification = classifyTask(query);
  
  let bestMatch = null;
  let bestScore = -Infinity;

  for (const rule of config.routingRules) {
    if (rule.pattern.test(query.toLowerCase())) {
      const score = calculateMatchScore(rule, classification, options);
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = {
          mcp: rule.mcp,
          tool: rule.tool,
          reason: rule.reason,
          matchScore: score,
          ruleId: rule.id,
        };
      }
    }
  }

  // If no specific match, use fallback
  if (!bestMatch) {
    const fallback = config.fallback;
    bestMatch = {
      mcp: fallback.defaultMcp,
      tool: fallback.defaultTool,
      reason: "No specific rule matched, using default",
      matchScore: 0,
      ruleId: "fallback",
    };
  }

  return bestMatch;
}

/**
 * Calculate how well a routing rule matches the query
 */
function calculateMatchScore(rule, classification, options) {
  let score = rule.priority || 5;

  // Boost for capability match
  if (options.capabilities && rule.mcpCapabilities) {
    const hasCapability = options.capabilities.some(c => 
      rule.mcpCapabilities.includes(c)
    );
    if (hasCapability) score += 10;
  }

  // Boost for task type match
  if (classification.type && rule.taskType) {
    if (Array.isArray(rule.taskType)) {
      if (rule.taskType.includes(classification.type)) score += 5;
    } else if (rule.taskType === classification.type) {
      score += 5;
    }
  }

  // Boost for complexity match
  if (classification.complexity && rule.complexity) {
    if (Array.isArray(rule.complexity)) {
      if (rule.complexity.includes(classification.complexity)) score += 3;
    } else if (rule.complexity === classification.complexity) {
      score += 3;
    }
  }

  // Boost for specific keywords in query
  const keywordBoost = calculateKeywordScore(query, rule);
  score += keywordBoost;

  return score;
}

/**
 * Calculate bonus points from keyword matches in the query
 */
function calculateKeywordScore(query, rule) {
  let boost = 0;
  
  // Exact phrase matches get higher boost
  if (rule.phrases) {
    for (const phrase of rule.phrases) {
      if (query.toLowerCase().includes(phrase.toLowerCase())) {
        boost += 2;
      }
    }
  }

  // Pattern density - more matching patterns = better match
  const patternCount = query.length / 10; // roughly words
  boost += Math.min(patternCount / 5, 3);

  return boost;
}

/**
 * Get all available MCPs with their tools
 */
export function getAvailableMcpServers() {
  const config = loadRoutingConfig();
  
  return config.mcpPriorities.map(mcpName => ({
    name: mcpName,
    priority: config.mcpPriorities.indexOf(mcpName),
    capabilities: getMcpCapabilities(mcpName),
  }));
}

/**
 * Get capabilities for a specific MCP server
 */
function getMcpCapabilities(mcpName) {
  const caps = {
    "mcp-lm-link-orchestrator": ["deviceAware", "parallelExecution", "modelLifecycle"],
    "web-search-mcp": ["contentExtraction", "multiSource", "webSearch"],
    "doc-processor": ["documentAnalysis", "multiFormat", "uiAnalysis"],
  };
  
  return caps[mcpName] || [];
}

/**
 * Load model DNA (imported dynamically to avoid circular deps)
 */
function loadModelDNA() {
  try {
    const { loadModelDNA: loadDna } = require("../utils/model-dna-manager.js");
    return loadDna();
  } catch (error) {
    console.warn(`[TaskRouter] Could not load DNA: ${error.message}`);
    return null;
  }
}

/**
 * Get tool description for a specific MCP and tool combination
 */
export function getToolDescription(mcp, tool) {
  const descriptions = {
    "mcp-lm-link-orchestrator": {
      "switch-model": "Manual model lifecycle management in LM Studio",
      "execute-task": "Automatic task execution with intelligent model selection",
      "model-dna": "DNA configuration management for models",
      "rate-model": "Model effectiveness rating collection",
      "orchestrate-task": "Multi-device orchestration across LM Link devices",
      "list-devices": "List all connected LM Link devices with status",
      "dispatch-subtask": "Manual subtask dispatch (debugging)",
      "research-swarm": "Distributed research across lightweight models",
    },
    "web-search-mcp": {
      "full-web-search": "Comprehensive web search with full page content",
      "get-web-search-summaries": "Lightweight web search with result snippets",
      "get-single-web-page-content": "Single page content extraction from URL",
    },
    "doc-processor": {
      "read-doc": "Read and analyze documents (DOCX, PDF, XLSX)",
      "detect-format": "Detect document format and recommend tool",
      "create-doc": "Create Word DOCX with professional formatting",
      "edit-doc": "Edit existing Word DOCX documents",
      "create-markdown": "Create lean markdown files for AI consumption",
      "create-excel": "Create Excel workbooks for data-heavy docs",
      "ui-to-artifact": "Convert UI screenshots to code, prompts, specs",
      "extract-text-from-screenshot": "OCR extraction from screenshots",
      "diagnose-error-screenshot": "Analyze error messages and stack traces",
      "understand-technical-diagram": "Interpret architecture diagrams and flowcharts",
      "analyze-data-visualization": "Extract insights from charts and graphs",
      "analyze-image": "General-purpose image analysis",
    },
  };

  return descriptions[mcp]?.[tool] || "Tool execution";
}

/**
 * Select optimal device for a task (when routing to local orchestrator)
 */
export function selectDeviceForTask(query, options = {}) {
  const config = loadRoutingConfig();

  // Get available devices
  let devices;
  try {
    const { getOnlineDevices } = require("../services/device-registry.js");
    devices = getOnlineDevices();
  } catch (error) {
    console.warn(`[TaskRouter] Could not get devices: ${error.message}`);
    return null;
  }

  if (!devices || devices.length === 0) {
    return { deviceId: "local", modelKey: "orchestrator" };
  }

  // Find device based on capabilities
  const requiredCaps = options.requiredCapabilities || [];

  for (const device of devices) {
    // Check if device has required capabilities
    const hasCaps = !requiredCaps.length || 
      requiredCaps.some(cap => device.capabilities?.includes(cap));

    if (hasCaps) {
      return {
        deviceId: device.id,
        modelKey: options.modelKey || "orchestrator",
        tier: device.tier || "medium",
      };
    }
  }

  // Fallback to first available device
  return {
    deviceId: devices[0].id,
    modelKey: options.modelKey || "orchestrator",
  };
}

/**
 * Generate a routing decision summary for the user
 */
export function getRoutingSummary(query, result) {
  const config = loadRoutingConfig();
  
  return `
## Task Routing Decision

**Query:** ${query.substring(0, 100)}${query.length > 100 ? "..." : ""}

**Selected MCP:** ${result.mcp}
**Recommended Tool:** ${result.tool}
**Match Score:** ${result.matchScore}/25
**Reason:** ${result.reason}

### Available MCPs (in priority order)
${config.mcpPriorities.map((mcp, i) => `  ${i + 1}. ${mcp} - ${getMcpCapabilities(mcp).join(", ")}`).join("\n")}

### Query Classification
- Type: ${result.type || "general"}
- Complexity: ${result.complexity || "moderate"}
- Capabilities needed: ${(options?.capabilities || []).join(", ") || "none specified"}

### Next Steps
1. Call ${result.tool} from ${result.mcp}
2. Review the results and aggregate if needed
3. Optionally route to another MCP for follow-up actions
`.trim();
}

/**
 * Route a task and return the result along with explanation
 */
export async function routeAndExecute(query, options = {}) {
  const routingResult = routeTask(query, options);
  
  // Add execution details based on MCP
  let toolOptions;
  
  switch (routingResult.mcp) {
    case "web-search-mcp":
      toolOptions = { query };
      break;
      
    case "doc-processor":
      toolOptions = { filePath: query }; // For read-doc
      if (query.length > 200) {
        // Treat as document path or text content
        toolOptions.mode = options.mode || "summary";
      }
      break;
      
    default:
      toolOptions = { query, ...options };
  }

  return {
    routing: routingResult,
    toolOptions,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get all routing rules as a list
 */
export function getRoutingRules() {
  const config = loadRoutingConfig();
  
  return config.routingRules.map(rule => ({
    id: rule.id,
    pattern: rule.pattern.toString(),
    mcp: rule.mcp,
    tool: rule.tool,
    reason: rule.reason,
    priority: rule.priority || 5,
  }));
}

/**
 * Update a routing rule dynamically
 */
export function updateRoutingRule(ruleId, updates) {
  const config = loadRoutingConfig();
  
  const ruleIndex = config.routingRules.findIndex(r => r.id === ruleId);
  
  if (ruleIndex >= 0) {
    config.routingRules[ruleIndex] = { 
      ...config.routingRules[ruleIndex], 
      ...updates,
    };
    
    // Save to environment for persistence
    process.env.MCP_ROUTING_CONFIG = JSON.stringify(config, null, 2);
    
    return true;
  }
  
  return false;
}

/**
 * Reset routing configuration to defaults
 */
export function resetRoutingConfig() {
  process.env.MCP_ROUTING_CONFIG = JSON.stringify(DEFAULT_ROUTING_CONFIG, null, 2);
  return DEFAULT_ROUTING_CONFIG;
}