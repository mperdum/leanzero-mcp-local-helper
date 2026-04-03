/**
 * MCP Tool Catalog Tool Handler
 *
 * Discovers and catalogs tools from all connected MCP servers.
 * Enables the main orchestrator to know what other MCPs can do.
 */

// Default MCP server configurations for auto-discovery
const DEFAULT_MCP_SERVERS = [
  {
    name: "mcp-lm-link-orchestrator",
    description: "Main orchestrator for LM Link multi-device orchestration",
    url: process.cwd(),
    toolsEndpoint: null, // Uses local tool definitions
    resourcesEndpoint: null,
  },
  {
    name: "web-search-mcp",
    description: "Web search and content extraction",
    url: "https://github.com/leanzero-srl/mcp-web-search",
    capabilities: ["contentExtraction", "multiSource"],
  },
  {
    name: "doc-processor",
    description: "Document analysis (DOCX, PDF, XLSX)",
    url: "https://github.com/leanzero-srl/leanzero-mcp-doc-processor",
    capabilities: ["documentAnalysis", "multiFormat"],
  },
];

/**
 * Tool definition with Cline-optimized description
 */
export const listMcpToolsTool = {
  name: "list-mcp-tools",
  description:
    `[ROLE] You are an MCP tool cataloger that discovers and catalogs tools from all connected MCP servers.\n\n` +
    `[CONTEXT] User wants to understand what tools are available across their 3 MCPs for orchestration purposes.\n\n` +
    `[TASK] Discover and catalog tools:\n` +
    "- List mcp-lm-link-orchestrator (this server) with all registered tools\n" +
    "- Include mcp-web-search capabilities for research queries\n" +
    "- Include doc-processor capabilities for document analysis\n" +
    "- Show tool purposes, parameters, and use cases\n\n" +
    `[CONSTRAINTS]\n` +
    "  - Auto-discovers MCP servers from DEFAULT_MCP_SERVERS config\n" +
    "  - Can be extended via environment variable MCP_SERVERS_JSON\n" +
    "  - Tool information is cached for performance\n\n" +
    `[FORMAT] Returns JSON with mcpServers array, each containing tools and capabilities.`,
  inputSchema: {
    type: "object",
    properties: {
      includeCapabilities: {
        type: "boolean",
        default: true,
        description: "Include tool capabilities and use cases"
      },
      filterByCapability: {
        type: "string",
        enum: ["contentExtraction", "multiSource", "documentAnalysis", "multiFormat", "parallelExecution", "deviceAware"],
        description: "Filter MCPs by specific capability"
      },
    },
  },
};

/**
 * Load MCP server configurations from environment
 */
function loadMcpServerConfigs() {
  const envServers = process.env.MCP_SERVERS_JSON;
  
  if (envServers) {
    try {
      return [...DEFAULT_MCP_SERVERS, ...JSON.parse(envServers)];
    } catch (error) {
      console.warn(`[ListMcpTools] Failed to parse MCP_SERVERS_JSON: ${error.message}`);
    }
  }
  
  return DEFAULT_MCP_SERVERS;
}

/**
 * Get mcp-lm-link-orchestrator tool definitions
 */
function getLocalHelperTools() {
  // Import local helper tools dynamically
  const { switchModelTool } = require("./switch-model.js");
  const { executeTaskTool } = require("./execute-task.js");
  const { modelDnaTool } = require("./model-dna-tool.js");
  const { rateModelTool } = require("./rate-model.js");
  const { orchestrateTaskTool } = require("./orchestrate-task.js");
  const { listDevicesTool } = require("./list-devices.js");
  const { dispatchSubtaskTool } = require("./dispatch-subtask.js");
  const { researchSwarmTool } = require("./research-swarm.js");

  return [
    {
      name: "switch-model",
      ...switchModelTool,
      description:
        `[ROLE] You are a model switching expert that can load/unload models in LM Studio.\n\n` +
        `[CONTEXT] User needs to manually switch between models for different tasks.\n\n` +
        `[TASK] Switch models based on the provided action and model type:\n` +
        "  - 'load': Load a specific model by ID or role\n" +
        "  - 'unload': Unload a specific model by ID\n" +
        "  - 'list': List all available models with their states\n" +
        "  - 'current': Get the currently loaded model\n\n" +
        `[CONSTRAINTS]\n` +
        "  - Use model IDs from the list command for precise switching\n" +
        "  - Models are automatically managed by LM Studio when context is exceeded\n" +
        "  - Vision models require separate handling due to higher memory requirements\n\n" +
        `[FORMAT] Returns JSON with switchResult, modelId (if applicable), and currentModel state.`,
      capabilities: ["deviceAware", "modelLifecycle"],
    },
    {
      name: "execute-task",
      ...executeTaskTool,
      description:
        `[ROLE] You are a task execution expert that automatically selects the optimal model for any task.\n\n` +
        `[CONTEXT] User wants to execute a task with the best-suited model based on intent classification.\n\n` +
        `[TASK] Execute a task with automatic model selection and fallback:\n` +
        "  - Classify task intent (code fixes, architecture, execution, research, vision)\n" +
        "  - Select optimal model based on ratings and availability\n" +
        "  - Execute task with the selected model\n" +
        "  - Fallback to next best model if primary fails\n\n" +
        `[CONSTRAINTS]\n` +
        "  - Model selection is automatic based on DNA ratings\n" +
        "  - Fallback to next best model if primary is unavailable\n" +
        "  - Max 3 fallback attempts before giving up\n" +
        "  - Context is automatically preserved between switches (max 8000 tokens)\n\n" +
        `[FORMAT] Returns JSON with success status, model used, and task result.`,
      capabilities: ["deviceAware", "parallelExecution"],
    },
    {
      name: "model-dna",
      ...modelDnaTool,
      description:
        `[ROLE] You are a DNA management expert that handles model configuration.\n\n` +
        `[CONTEXT] User needs to manage Model DNA for automatic model selection and configuration.\n\n` +
        `[TASK] Manage Model DNA with the following actions:\n` +
        "  - 'init': Initialize Model DNA with defaults or custom settings\n" +
        "  - 'get': Get current Model DNA configuration\n" +
        "  - 'save-memory': Save a memory (preference) for model selection\n" +
        "  - 'delete-memory': Delete a memory by key\n" +
        "  - 'evolve': Analyze usage and suggest improvements (auto-apply with apply:true)\n" +
        "  - 'set-max-models': Set max models per device limit\n" +
        "  - 'get-hardware-info': Get hardware detection info for model limits\n\n" +
        `[CONSTRAINTS]\n` +
        "  - DNA is stored in .model-dna.json\n" +
        "  - User-level overrides are stored in .model-user.json\n" +
        "  - Memories persist across model switches for context\n" +
        "  - Max models per device defaults to: 1 (RAM<8GB), 2 (RAM<16GB), 3 (RAM<32GB), 4+ (RAM>=32GB)\n\n" +
        `[FORMAT] Returns JSON with success status and relevant data.`,
      capabilities: ["deviceAware", "modelLifecycle"],
    },
    {
      name: "rate-model",
      ...rateModelTool,
      description:
        `[ROLE] You are a model rating expert that collects effectiveness ratings for models.\n\n` +
        `[CONTEXT] User wants to rate how well each model performed on specific tasks for future optimization.\n\n` +
        `[TASK] Rate model performance:\n` +
        "  - Select the model role (conversationalist, ninja-researcher, architect, executor, researcher, vision)\n" +
        "  - Specify task type (codeFixes, featureArchitecture, codeExecution, generalResearch, imageAnalysis)\n" +
        "  - Provide rating 1-5 and optional feedback\n\n" +
        `[CONSTRAINTS]\n` +
        "  - Ratings are stored in Model DNA for automatic evolution\n" +
        "  - Historical ratings drive future model recommendations\n" +
        "  - Use 3+ ratings before expecting accurate recommendations\n\n" +
        `[FORMAT] Returns JSON with success status and rating confirmation.`,
      capabilities: ["deviceAware"],
    },
    {
      name: "orchestrate-task",
      ...orchestrateTaskTool,
      description:
        `[ROLE] You are a multi-device AI orchestrator that coordinates tasks across multiple LM Studio devices connected via LM Link.\n\n` +
        `[STRATEGY]\n` +
        `1. Analyze the task and identify independent components that can run in parallel\n` +
        `2. Check available devices and their loaded models using list-devices tool first\n` +
        `3. Decompose complex tasks into subtasks with clear inputs/outputs\n` +
        `4. Dispatch subtasks to optimal devices simultaneously (not sequential!)\n` +
        `5. Wait for all subtasks to complete, then synthesize results\n\n` +
        `[PARALLELISM] Always maximize parallelism - if you have 3 independent research queries and 3 devices, dispatch all 3 at once rather than one at a time.\n\n` +
        `[DEVICE SELECTION] Match subtask requirements to device capabilities:\n` +
        `- Vision tasks → devices with VLM models loaded (check via list-devices)\n` +
        `- Code generation → devices with tool-use capable models\n` +
        `- Simple chat → any available device\n\n` +
        `[FORMAT] Returns JSON with orchestration plan, subtasks dispatched, and final synthesized results.`,
      capabilities: ["deviceAware", "parallelExecution"],
    },
    {
      name: "list-devices",
      ...listDevicesTool,
      description:
        `[ROLE] You are a device status monitor for LM Link multi-device orchestration.\n\n` +
        `[CONTEXT] User needs to see which devices are available, their load status, and capabilities before orchestrating tasks.\n\n` +
        `[TASK] Retrieve comprehensive device information:\n` +
        "- List all discovered devices with their IDs and names\n" +
        "- Show device status (online/offline)\n" +
        "- Display current load state and concurrent request counts\n" +
        "- Show model capabilities per device (vision, tool use support)\n" +
        "- Indicate device tier (ultra/high/medium/low) for quality-of-service awareness\n\n" +
        `[CONSTRAINTS]\n` +
        "  - Device discovery happens automatically via LM Link/Tailscale\n" +
        "  - Check this before orchestrating tasks to select optimal devices\n" +
        "  - Devices in cooldown period are temporarily unavailable\n\n" +
        `[FORMAT] Returns JSON array of device objects with status, load state, and capabilities.`,
      capabilities: ["deviceAware"],
    },
    {
      name: "dispatch-subtask",
      ...dispatchSubtaskTool,
      description:
        `[ROLE] You are a subtask dispatcher for testing and debugging LM Link orchestration.\n\n` +
        `[CONTEXT] Use this tool to manually dispatch individual subtasks to specific devices during testing or when you need fine-grained control over task placement.\n\n` +
        `[TASK] Dispatch a single subtask to a device:\n` +
        "- Specify the device ID (use list-devices to find available devices)\n" +
        "- Provide the task prompt for execution\n" +
        "- Optionally specify model key and required capabilities\n" +
        "- Track load statistics before and after dispatch\n\n" +
        `[CONSTRAINTS]\n` +
        "  - This is primarily for testing and debugging\n" +
        "  - For production use, use orchestrate-task instead\n" +
        "  - Manual dispatch still respects concurrency limits and cooldowns\n\n" +
        `[FORMAT] Returns JSON with dispatch result including subtask ID, device used, and execution outcome.`,
      capabilities: ["deviceAware", "parallelExecution"],
    },
    {
      name: "research-swarm",
      ...researchSwarmTool,
      description:
        'Distributes research queries across lightweight models (5.6GB) on distributed devices via LM Link. Automatically decomposes complex research tasks into parallel subtasks, executes them across available lightweight models on multiple devices, and aggregates results into a compacted final response (~2048 tokens). Use this tool when Cline is in Plan Mode for research-intensive queries that benefit from parallel exploration.',
      capabilities: ["parallelExecution", "deviceAware"],
    },
  ];
}

/**
 * Get mcp-web-search tool definitions
 */
function getWebSearchTools() {
  return [
    {
      name: "full-web-search",
      description:
        `[ROLE] You are a comprehensive web search expert that searches the web and fetches complete page content from top results.\n\n` +
        `[CONTEXT] User needs detailed information from multiple sources for in-depth research or fact-checking.\n\n` +
        `[TASK] Perform comprehensive web search:\n` +
        "- Search the web using the provided query\n" +
        "- Follow top result links to extract full page content\n" +
        "- Provide most detailed and complete information available\n\n" +
        `[CONSTRAINTS]\n` +
        "  - Most comprehensive search option (follows links for full content)\n" +
        "  - Use when you need deep information from multiple sources\n" +
        "  - Results include full page content, not just snippets\n\n" +
        `[FORMAT] Returns JSON with search results including full page content.`,
      capabilities: ["contentExtraction", "multiSource"],
    },
    {
      name: "get-web-search-summaries",
      description:
        `[ROLE] You are a lightweight web search expert that returns only search result snippets/descriptions.\n\n` +
        `[CONTEXT] User needs quick search results without the overhead of fetching full page content.\n\n` +
        `[TASK] Perform lightweight web search:\n` +
        "- Search the web using the provided query\n" +
        "- Return search result snippets/descriptions only\n" +
        "- Provide concise summaries from top results\n\n" +
        `[CONSTRAINTS]\n` +
        "  - Lightweight alternative to full-web-search (no link following)\n" +
        "  - Use when you need quick search results\n" +
        "  - Faster than full-web-search but less comprehensive\n\n" +
        `[FORMAT] Returns JSON with search result snippets/descriptions.`,
      capabilities: ["contentExtraction", "multiSource"],
    },
    {
      name: "get-single-web-page-content",
      description:
        `[ROLE] You are a single page content extractor that fetches complete content from one web URL.\n\n` +
        `[CONTEXT] User wants to analyze or extract information from a specific webpage.\n\n` +
        `[TASK] Extract page content:\n` +
        "- Fetch the full content from the provided URL\n" +
        "- Extract main page content (excluding navigation, footers, etc.)\n" +
        "- Return comprehensive page content\n\n" +
        `[CONSTRAINTS]\n` +
        "  - Follows a single URL for extraction\n" +
        "  - Use when you have a specific webpage in mind\n" +
        "  - More focused than full-web-search (single source)\n\n" +
        `[FORMAT] Returns JSON with extracted page content.`,
      capabilities: ["contentExtraction"],
    },
  ];
}

/**
 * Get doc-processor tool definitions
 */
function getDocProcessorTools() {
  return [
    {
      name: "read-doc",
      description:
        `[ROLE] You are a document analysis expert specializing in extracting and analyzing content from various file formats.\n\n` +
        `[CONTEXT] User needs to understand the content, structure, and metadata of existing documents before editing or referencing them.\n\n` +
        `[TASK] Read and analyze a document using the appropriate mode:\n` +
        "  - 'summary': High-level overview with content preview (default)\n" +
        "  - 'indepth': Full text, structure, formatting, and metadata extraction\n" +
        "  - 'focused': Query-based analysis finding relevant sections\n\n" +
        `[CONSTRAINTS]\n` +
        "  - ALWAYS read existing documents BEFORE creating or editing them\n" +
        "  - Use 'indepth' mode before editing to understand current formatting\n" +
        "  - Provide context from previous responses when using 'focused' mode\n\n" +
        `[FORMAT] Returns structured analysis with content, metadata, and formatting information.`,
      capabilities: ["documentAnalysis", "multiFormat"],
    },
    {
      name: "detect-format",
      description:
        `[ROLE] You are a document format recommendation engine.\n\n` +
        `[CONTEXT] User is asking about creating documentation but hasn't specified the format. You need to analyze their intent and recommend the appropriate tool (create-markdown, create-doc, or create-excel).\n\n` +
        `[TASK] Analyze the user's query for keywords indicating document type:\n` +
        "- Implementation/Technical keywords → recommend 'markdown' format\n" +
        "- High-level/Stakeholder keywords → recommend 'docx' format\n" +
        "- Data/Spreadsheet keywords → recommend 'excel' format\n\n" +
        `[CONSTRAINTS]\n` +
        "  - ALWAYS call this tool BEFORE creating a document if the user hasn't explicitly specified a format\n" +
        "  - Use the recommended format in your subsequent create-* tool call\n" +
        "  - If user explicitly says 'docx', 'markdown', or 'excel', you can skip this step\n\n" +
        `[FORMAT] Returns {format, confidence, reason, matchedKeywords, suggestedTool}.`,
      capabilities: ["documentAnalysis", "multiFormat"],
    },
    {
      name: "create-doc",
      description:
        `[ROLE] You are a professional document creation expert, specializing in creating well-structured DOCX files with professional formatting.\n\n` +
        `[CONTEXT] User wants to create a Word document for high-level documentation, stakeholder reports, email attachments, Confluence uploads, or formal business documents. For technical implementation docs, use create-markdown instead.\n\n` +
        `[TASK] Create a Word DOCX document with the following requirements:\n` +
        "  1. Provide a specific, descriptive title (e.g., 'Q1 2026 Budget Report', not 'Document')\n" +
        "  2. Use paragraph objects with headingLevel for document hierarchy\n" +
        "  3. Apply style preset or let auto-selection based on category\n" +
        "  4. Configure header/footer if needed (or use Document DNA defaults)\n\n" +
        `[CONSTRAINTS]\n` +
        "  - Title MUST be specific and descriptive — generic titles are rejected\n" +
        "  - Do NOT include markdown syntax in paragraph text — use headingLevel, bold, etc.\n" +
        "  - USER CONFIRMATION REQUIRED: describe what you plan to create and get approval first\n" +
        "  - Use dryRun: true for previews before actual creation\n" +
        "  - Check blueprintMatch in response for structural template suggestions\n" +
        "  - Document DNA automatically applies headers/footers/style if .document-dna.json exists\n\n" +
        `[FORMAT] Returns JSON with filePath, success status, and confirmation message.`,
      capabilities: ["documentAnalysis"],
    },
    {
      name: "edit-doc",
      description:
        `[ROLE] You are a professional document creation expert, specializing in creating well-structured DOCX files with professional formatting.\n\n` +
        `[CONTEXT] User wants to create a Word document for high-level documentation, stakeholder reports, email attachments, Confluence uploads, or formal business documents. For technical implementation docs, use create-markdown instead.\n\n` +
        `[TASK] Create a Word DOCX document with the following requirements:\n` +
        "  1. Provide a specific, descriptive title (e.g., 'Q1 2026 Budget Report', not 'Document')\n" +
        "  2. Use paragraph objects with headingLevel for document hierarchy\n" +
        "  3. Apply style preset or let auto-selection based on category\n" +
        "  4. Configure header/footer if needed (or use Document DNA defaults)\n\n" +
        `[CONSTRAINTS]\n` +
        "  - Title MUST be specific and descriptive — generic titles are rejected\n" +
        "  - Do NOT include markdown syntax in paragraph text — use headingLevel, bold, etc.\n" +
        "  - USER CONFIRMATION REQUIRED: describe what you plan to create and get approval first\n" +
        "  - Use dryRun: true for previews before actual creation\n" +
        "  - Check blueprintMatch in response for structural template suggestions\n" +
        "  - Document DNA automatically applies headers/footers/style if .document-dna.json exists\n\n" +
        `[FORMAT] Returns JSON with filePath, success status, and confirmation message.`,
      capabilities: ["documentAnalysis"],
    },
    {
      name: "create-markdown",
      description:
        `[ROLE] You are a technical documentation expert specializing in creating lean, practical markdown files optimized for AI model consumption during implementation.\n\n` +
        `[CONTEXT] User wants to create implementation-focused documentation that will be used by developers or AI models to build something. The document should be copy-paste friendly with code blocks, clear headings, and bullet lists (avoid tables).\n\n` +
        `[TASK] Create a markdown (.md) file with the following requirements:\n` +
        "  1. Provide a specific, descriptive title (becomes H1 heading)\n" +
        "  2. Use paragraph objects with headingLevel for document hierarchy\n" +
        "  3. Include code blocks with language hints for any commands, config, or code snippets\n" +
        "  4. Use bullet lists instead of tables for structured data (easier to copy)\n" +
        "  5. Apply task list format (- [ ]) for actionable items\n" +
        "  6. Configure category if known (technical, research, etc.)\n\n" +
        `[CONSTRAINTS]\n` +
        "  - Title MUST be specific and descriptive — generic titles are rejected\n" +
        "  - DO NOT use tables — prefer bullet lists for copy-paste friendliness\n" +
        "  - ALWAYS include language hints in code blocks (```javascript not just ```)\\n" +
        "  - Use inline code (`text`) for file paths, commands, and technical terms\n" +
        "  - Keep formatting lean — this is for implementation, not presentation\n" +
        "  - No user confirmation required (unlike create-doc/create-excel)\n\n" +
        `[FORMAT] Returns JSON with filePath, success status, and message. File is written directly to disk without confirmation prompt.`,
      capabilities: ["documentAnalysis"],
    },
    {
      name: "create-excel",
      description:
        `[ROLE] You are a professional Excel workbook creation expert, specializing in creating well-structured XLSX files with professional formatting.\n\n` +
        `[CONTEXT] User wants to create an Excel workbook for data-heavy documents like budgets, financial reports, spreadsheets with numbers and calculations.\n\n` +
        `[TASK] Create an Excel XLSX workbook with the following requirements:\n` +
        "  1. Provide a descriptive 'title' for the workbook (e.g., 'Q1 2026 Budget Breakdown')\n" +
        "  2. Use descriptive sheet names (e.g., 'Monthly Revenue', not 'Sheet1')\n" +
        "  3. Apply style preset or let auto-selection based on category\n" +
        "  4. Configure custom styling for fonts, columns, and rows\n\n" +
        `[CONSTRAINTS]\n` +
        "  - Title MUST be descriptive — generic titles like 'Workbook' or 'Data' are rejected\n" +
        "  - Sheet names MUST be descriptive — generic names like 'Sheet1', 'Sheet2' are rejected\n" +
        "  - Do NOT include markdown syntax in cell values — use plain text or numbers\n" +
        "  - USER CONFIRMATION REQUIRED: describe what you plan to create and get approval first\n" +
        "  - Use dryRun: true for previews before actual creation\n\n" +
        `[FORMAT] Returns JSON with filePath, success status, and confirmation message.`,
      capabilities: ["documentAnalysis", "multiFormat"],
    },
    {
      name: "ui-to-artifact",
      description:
        `[ROLE] You are a UI-to-artifact converter that transforms screenshots into various artifacts.\n\n` +
        `[CONTEXT] User wants to generate frontend code, AI prompts, design specifications, or descriptions from UI screenshots.\n\n` +
        `[TASK] Convert UI screenshot into artifact:\n` +
        "  - 'code': Generate frontend code (HTML/CSS/JS)\n" +
        "  - 'prompt': Create AI prompt for recreating this UI\n" +
        "  - 'spec': Extract design specifications\n" +
        "  - 'description': Natural language description of the UI\n\n" +
        `[CONSTRAINTS]\n` +
        "  - Use 'code' output_type for frontend development\n" +
        "  - Use 'prompt' for AI-driven UI generation workflows\n" +
        "  - Use 'spec' for design handoff to developers\n" +
        "  - Use 'description' for quick understanding of UI content\n\n" +
        `[FORMAT] Returns artifact based on output_type (code, prompt, spec, or description).`,
      capabilities: ["documentAnalysis", "multiFormat"],
    },
    {
      name: "extract-text-from-screenshot",
      description:
        `[ROLE] You are a screenshot text extraction expert using advanced OCR capabilities.\n\n` +
        `[CONTEXT] User has screenshots containing text (code, terminal output, documentation) and wants to extract it.\n\n` +
        `[TASK] Extract and recognize text from screenshots:\n` +
        "- Detect programming language if code is present\n" +
        "- Extract text with proper formatting\n" +
        "- Preserve structure (code blocks, terminal output, etc.)\n\n" +
        `[CONSTRAINTS]\n` +
        "  - Use 'python', 'javascript', 'java' for programming_language when extracting code\n" +
        "  - Leave empty for auto-detection or non-code text\n" +
        "  - Excellent for terminal output, documentation snippets, and code blocks\n\n" +
        `[FORMAT] Returns extracted text with preserved formatting.`,
      capabilities: ["documentAnalysis", "multiFormat"],
    },
    {
      name: "diagnose-error-screenshot",
      description:
        `[ROLE] You are an error diagnosis expert that analyzes error messages, stack traces, and exception screenshots.\n\n` +
        `[CONTEXT] User has encountered an error and wants help understanding or fixing it based on a screenshot.\n\n` +
        `[TASK] Diagnose and analyze error message:\n` +
        "- Identify the type of error (syntax, runtime, etc.)\n" +
        "- Extract root cause from stack trace\n" +
        "- Provide actionable solutions\n\n" +
        `[CONSTRAINTS]\n` +
        "  - Use context parameter to specify when error occurred (e.g., 'during npm install')\n" +
        "  - Focus on actionable solutions rather than just analysis\n" +
        "  - Excellent for terminal errors, exceptions, and stack traces\n\n" +
        `[FORMAT] Returns diagnosis with root cause and recommended fixes.`,
      capabilities: ["documentAnalysis", "multiFormat"],
    },
    {
      name: "understand-technical-diagram",
      description:
        `[ROLE] You are a technical diagram analysis expert that interprets architecture diagrams, flowcharts, UML, ER diagrams, and system design.\n\n` +
        `[CONTEXT] User has a technical diagram and wants to understand its structure or components.\n\n` +
        `[TASK] Analyze and explain technical diagram:\n` +
        "- Identify diagram type (architecture, flowchart, UML, ER, sequence)\n" +
        "- Explain components and their relationships\n" +
        "- Extract key insights from the diagram\n\n" +
        `[CONSTRAINTS]\n` +
        "  - Use 'diagram_type' parameter to specify if known (e.g., 'architecture', 'flowchart')\n" +
        "  - Focus on component relationships and flow patterns\n" +
        "  - Excellent for architecture diagrams, flowcharts, UML, ER diagrams\n\n" +
        `[FORMAT] Returns analysis with component descriptions and relationships.`,
      capabilities: ["documentAnalysis", "multiFormat"],
    },
    {
      name: "analyze-data-visualization",
      description:
        `[ROLE] You are a data visualization expert that extracts insights from charts, graphs, dashboards, and data visualizations.\n\n` +
        `[CONTEXT] User has a data visualization image and wants to understand patterns or metrics.\n\n` +
        `[TASK] Analyze data visualization:\n` +
        "- Extract key metrics and trends\n" +
        "- Identify anomalies or outliers\n" +
        "- Compare values across categories\n\n" +
        `[CONSTRAINTS]\n` +
        "  - Use 'analysis_focus' to emphasize specific aspects (trends, anomalies, comparisons)\n" +
        "  - Focus on actionable insights rather than just description\n" +
        "  - Excellent for charts, graphs, dashboards, and data visualizations\n\n" +
        `[FORMAT] Returns analysis with trends, metrics, and actionable insights.`,
      capabilities: ["documentAnalysis", "multiFormat"],
    },
    {
      name: "analyze-image",
      description:
        `[ROLE] You are a general-purpose image analyzer for scenarios not covered by specialized tools.\n\n` +
        `[CONTEXT] User has an image that doesn't fit neatly into code, error, diagram, or visualization analysis.\n\n` +
        `[TASK] General image analysis:\n` +
        "- Describe the visual content\n" +
        "- Identify key elements and components\n" +
        "- Extract relevant information based on prompt\n\n" +
        `[CONSTRAINTS]\n` +
        "  - Use this as a fallback when specialized tools don't fit the use case\n" +
        "  - Provide detailed descriptions based on the image content\n" +
        "  - Flexible for any visual content type\n\n" +
        `[FORMAT] Returns descriptive analysis of image content.`,
      capabilities: ["documentAnalysis", "multiFormat"],
    },
  ];
}

/**
 * Handle list-mcp-tools tool execution
 * @param {Object} params - Tool parameters with options
 * @returns {Promise<Object>} MCP tools catalog
 */
export async function handleListMcpTools(params) {
  const { includeCapabilities = true, filterByCapability } = params;

  try {
    // Load server configurations
    const servers = loadMcpServerConfigs();

    const result = [];

    for (const server of servers) {
      const serverInfo = {
        name: server.name,
        description: server.description || "",
        url: server.url || "",
        tools: [],
      };

      // Add capabilities if requested
      if (includeCapabilities && server.capabilities) {
        serverInfo.capabilities = server.capabilities;
      }

      // Get tool definitions based on server type
      switch (server.name) {
        case "mcp-lm-link-orchestrator":
          serverInfo.tools = getLocalHelperTools();
          break;

        case "web-search-mcp":
          serverInfo.tools = getWebSearchTools();
          break;

        case "doc-processor":
          serverInfo.tools = getDocProcessorTools();
          break;

        default:
          // Generic MCP servers - add basic structure
          serverInfo.tools = [
            {
              name: "default-tool",
              description: `Tool from ${server.name}`,
              capabilities: server.capabilities || [],
            },
          ];
      }

      // Apply capability filter if specified
      if (filterByCapability && serverInfo.capabilities) {
        const hasCapability = serverInfo.capabilities.includes(filterByCapability);
        
        if (!hasCapability) {
          continue; // Skip servers that don't have the required capability
        }
      }

      result.push(serverInfo);
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          totalMcpServers: result.length,
          mcpServers: result,
        }, null, 2),
      }],
    };
  } catch (error) {
    console.error(`[ListMcpTools] Error: ${error.message}`);

    return {
      content: [{ type: "text", text: JSON.stringify({ error: error.message }, null, 2) }],
      isError: true,
    };
  }
}