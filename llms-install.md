# MCP Local Helper Installation Guide for AI Agents

This guide is specifically designed for AI assistants like Cline to install and configure the MCP Local Helper server for use with LM Studio through the Model Context Protocol (MCP).

## What is MCP Local Helper?

MCP Local Helper is an intelligent model management system that provides automatic model selection and task routing for LM Studio. It uses a DNA-based configuration architecture to track model effectiveness across different task types, enabling continuous optimization of model assignments based on actual performance data.

## Prerequisites

Before installation, verify these requirements are met:

### 1. Node.js (Required)
```bash
node --version
```
**Required**: Node.js >= 18.0.0

If not installed or version is too old:
- **macOS**: `brew install node` or download from https://nodejs.org
- **Linux**: Use your package manager or download from https://nodejs.org
- **Windows**: Download installer from https://nodejs.org

### 2. LM Studio (Required)
LM Studio must be installed and running locally with at least one model available.

**Verify LM Studio is running:**
```bash
curl http://localhost:1234/v1/models
```

Expected output: A JSON response listing available models, or an error if LM Studio is not running.

If LM Studio is not running:
1. Download from https://lmstudio.ai
2. Install and launch the application
3. Ensure at least one model is downloaded in LM Studio
4. Start the local server (default port: 1234)

### 3. Git (Optional, for cloning)
```bash
git --version
```

If not installed:
- **macOS**: `brew install git` or run Xcode Command Line Tools installer
- **Linux/Windows**: Download from https://git-scm.com

## Installation Steps

### Step 1: Clone the Repository

```bash
git clone https://github.com/mperdum/leanzero-mcp-local-helper.git
cd mcp-local-helper
```

**Expected output:**
```
Cloning into 'mcp-local-helper'...
remote: Enumerating objects...
Receiving objects: 100% (...), ...
Resolving deltas: 100% (...), ...
```

### Step 2: Install Dependencies

```bash
npm install
```

**What this does:**
- Installs `@modelcontextprotocol/sdk` (MCP server framework)
- Installs `zod` (schema validation library)
- Creates `node_modules/` directory

**Expected output:**
```
added X packages in Xs
```

### Step 3: Verify Installation

Run the test suite to verify all components are functioning correctly:

```bash
npm test
```

**Expected output:** All tests should pass without errors. You should see output like:
```
✔ ... (various test descriptions)
... passing (Xms)
```

If tests fail, review the error messages and ensure your environment meets the prerequisites.

## MCP Client Configuration

After installation, you need to configure your MCP client to use the server. The configuration location depends on which client you're using.

### Cline (VS Code Extension)

**Configuration file location:**
- **macOS**: `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`
- **Linux**: `~/.config/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`
- **Windows**: `%APPDATA%\Code\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json`

**Add this configuration:**
```json
{
  "mcpServers": {
    "mcp-local-helper": {
      "command": "node",
      "args": ["/full/path/to/mcp-local-helper/src/server.js"],
      "env": {
        "LM_STUDIO_API_URL": "http://localhost:1234/v1"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

**To get the full path:**
- **macOS/Linux**: `pwd` (while in the mcp-local-helper directory)
- **Windows PowerShell**: `(Get-Location).Path`
- **Windows Command Prompt**: `cd`

### Alternative: Using npm run command

If you prefer using npm to run the server:

```json
{
  "mcpServers": {
    "mcp-local-helper": {
      "command": "npm",
      "args": ["run", "server"],
      "cwd": "/full/path/to/mcp-local-helper",
      "env": {
        "LM_STUDIO_API_URL": "http://localhost:1234/v1"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

### Claude Desktop

**Configuration file location:**
- **macOS/Linux**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

**Add this configuration:**
```json
{
  "mcpServers": {
    "mcp-local-helper": {
      "command": "node",
      "args": ["/full/path/to/mcp-local-helper/src/server.js"],
      "env": {
        "LM_STUDIO_API_URL": "http://localhost:1234/v1"
      }
    }
  }
}
```

### Cursor Editor

**Configuration file location:** `[project root]/.cursor/mcp.json`

Use the same configuration format as shown above.

## Environment Variables

The following environment variables can be configured in your MCP settings:

| Variable | Default | Description |
|----------|---------|-------------|
| `LM_STUDIO_API_URL` | `http://localhost:1234/v1` | Base URL where LM Studio is running |
| `LM_STUDIO_TIMEOUT` | `60000` | Request timeout in milliseconds |
| `EVOLUTION_LOW_RATING_THRESHOLD` | `3.0` | Rating below which models are considered underperforming |
| `EVOLUTION_EXCELLENT_RATING` | `4.5` | Rating above which models are considered excellent |
| `EVOLUTION_MIN_RATINGS` | `5` | Minimum ratings required before generating evolution suggestions |

## Initial Setup After Configuration

After configuring your MCP client, you must initialize the Model DNA configuration before executing tasks:

**Send this request through your MCP client:**
```json
{
  "tool": "model-dna",
  "parameters": {
    "action": "init"
  }
}
```

This creates the `.model-dna.json` file with default model definitions and task mappings based on available LM Studio models.

## Verification Steps

To verify that MCP Local Helper is working correctly:

### Step 1: List Available Models

Ask your AI assistant to execute:
```json
{
  "tool": "switch-model",
  "parameters": {
    "action": "list"
  }
}
```

**Expected output:** A list of models available in LM Studio with their current state (loaded/unloaded).

### Step 2: Execute a Simple Task

Ask your AI assistant to execute:
```json
{
  "tool": "execute-task",
  "parameters": {
    "query": "Hello, this is a test message"
  }
}
```

**Expected output:** A response indicating which model was used and the result of processing the query.

### Step 3: Check DNA Configuration

Ask your AI assistant to execute:
```json
{
  "tool": "model-dna",
  "parameters": {
    "action": "get"
  }
}
```

**Expected output:** A summary of the current Model DNA configuration including models, task mappings, and usage statistics.

## Available Tools

Once installed, MCP Local Helper provides four tools:

### 1. switch-model
Manual control over LM Studio model lifecycle operations.
- `load`: Load a specific model into memory
- `unload`: Remove a model from memory
- `list`: List all available models with their state
- `current`: Get information about the currently active model

### 2. execute-task
Automatic task execution with intelligent model selection. The system automatically classifies your request, selects the optimal model based on DNA ratings, executes the task, and handles fallbacks transparently.

### 3. model-dna
Configuration management for the Model DNA system.
- `init`: Create a new DNA configuration file
- `get`: Return current DNA configuration summary
- `save-memory`: Store a preference or note
- `delete-memory`: Remove a stored memory by key
- `evolve`: Analyze usage patterns and suggest/apply improvements

### 4. rate-model
Provide feedback on model performance to improve future model selection.

## Troubleshooting

### LM Studio Connection Issues

**Error**: "Unable to connect to LM Studio" or similar connection errors

**Solutions:**
1. Verify LM Studio is running: `curl http://localhost:1234/v1/models`
2. Check that `LM_STUDIO_API_URL` matches your LM Studio configuration
3. Ensure no firewall is blocking local connections on port 1234
4. Restart LM Studio if necessary

### DNA Not Initialized Errors

**Error**: "Model DNA not initialized" when executing tasks

**Solution:** Run the model-dna tool with action `init`:
```json
{
  "tool": "model-dna",
  "parameters": {
    "action": "init"
  }
}
```

### Model Loading Failures

**Error**: A specific model fails to load

**Solutions:**
1. Verify the model file exists in your LM Studio models directory
2. Check that sufficient system memory is available for the model size
3. Ensure the model identifier matches exactly what appears in the `list` command output
4. Try unloading other models first to free up memory

### Server Not Recognized in MCP Client

**Error**: The server is not recognized or tools are unavailable

**Solutions:**
1. Restart your MCP client (VS Code, Claude Desktop, etc.) after configuration changes
2. Verify the path in your configuration file is correct and absolute
3. Check that Node.js version 18+ is installed: `node --version`
4. Ensure all dependencies are installed: `npm install`
5. Check for syntax errors in your MCP settings JSON file

### Permission Errors on macOS/Linux

**Error**: "Permission denied" when running the server

**Solutions:**
```bash
# Make the server file executable
chmod +x src/server.js

# Or fix directory permissions
chown -R $USER:$USER /path/to/mcp-local-helper
```

## Common Issues and Solutions

| Issue | Solution |
|-------|----------|
| Tests fail on first run | Run `npm install` again to ensure all dependencies are installed |
| Server crashes immediately | Check LM Studio is running and accessible at the configured URL |
| Tools not appearing in client | Restart the MCP client after adding configuration |
| JSON parsing errors in config | Validate your MCP settings file with a JSON validator |
| Windows path issues | Use forward slashes `/` instead of backslashes `\` in paths, or escape backslashes as `\\` |

## Installation Success Criteria

The installation is successful when all of the following are true:

- ✅ `npm install` completes without errors
- ✅ `npm test` shows all tests passing
- ✅ MCP client configuration file contains valid JSON with server settings
- ✅ `switch-model` with action `list` returns available models from LM Studio
- ✅ `execute-task` processes a query and returns results
- ✅ `model-dna` with action `get` returns configuration summary

Once all criteria are met, MCP Local Helper is ready for use!

## Additional Resources

- **README.md**: Comprehensive documentation on architecture and usage
- **docs/**: Detailed phase documentation describing system components
- **GitHub Repository**: https://github.com/mperdum/leanzero-mcp-local-helper
- **LM Studio Documentation**: https://lmstudio.ai/docs