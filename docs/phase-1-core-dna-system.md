# Phase 1: Core DNA System

## Overview

The Model DNA (`.model-dna.json`) system is the heart of the Model Switcher MCP server. It provides a hierarchical configuration management system that allows for user-level and project-level model configurations with automatic inheritance and merging.

**Key Concepts:**
- **DNA** = Model configuration blueprint for intelligent model selection
- **Hierarchical Inheritance** = User > Project > Defaults
- **Effectiveness Ratings** = Automatic model optimization based on user feedback
- **Memory System** = Persistent preferences across model switches

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Model DNA Layer                          │
├─────────────────────────────────────────────────────────────┤
│  .model-user.json (User-level overrides)                    │
│        ↓                                                    │
│  .model-dna.json (Project-level config)                     │
│        ↓                                                    │
│  defaults.js (Baseline configuration)                       │
└─────────────────────────────────────────────────────────────┘
                        ↓
              ┌──────────────────────┐
              │  mergeDNALevels()    │
              └──────────────────────┘
                        ↓
           ┌────────────────────────┐
           │  Merged Configuration  │
           │  (Final Runtime Config)│
           └────────────────────────┘
```

---

## File Structure

```
src/utils/
├── model-dna-schema.js          # Schema definition, validation, migrations
├── model-dna-manager.js         # CRUD operations, caching, mergeDNALevels()
└── model-dna-inheritance.js     # (Optional) Additional inheritance logic
```

**Note:** The `mergeDNALevels()` function is implemented in `model-dna-manager.js`, not as a separate file. This consolidates DNA management functionality into one module.

---

## GitHub Repository Setup for Cline Marketplace

> **Marketplace Distribution Breadcrumb** - This document is part of the `mcp-model-switcher` project, designed for submission to [Cline's MCP Marketplace](https://github.com/cline/mcp-marketplace). The complete distribution guide is available in Phase 6 documentation.

### Repository Information

| Requirement | Value |
|------------|-------|
| **Repository Name** | `mcp-model-switcher` |
| **Repository URL** | `https://github.com/YOUR_USERNAME/mcp-model-switcher` |
| **Marketplace Repo** | `https://github.com/cline/mcp-marketplace` |
| **Visibility** | Public (required for marketplace) |
| **License** | MIT License |

### Pre-Submission Checklist

Before submitting to Cline's MCP Marketplace, ensure:

#### Code Quality Requirements
- [ ] Repository is public (required for marketplace submission)
- [ ] README.md contains clear installation instructions
- [ ] LICENSE file exists (MIT recommended)
- [ ] package.json has name, version, description, and keywords
- [ ] Project uses semver for versioning (e.g., 1.0.0)
- [ ] Code follows JavaScript/Node.js best practices
- [ ] Error handling is comprehensive and documented

#### Documentation Requirements
- [ ] README.md includes: Installation, Usage, Configuration sections
- [ ] API endpoints are documented
- [ ] Example usage scenarios provided
- [ ] Troubleshooting section included

#### Distribution Files to Create (Phase 1)
```
mcp-model-switcher/
├── .gitignore                   # Node.js specific ignores
├── LICENSE                      # MIT license text
├── README.md                    # Project overview + installation
└── package.json                 # Project metadata
```

### Initial Repository Setup Steps

#### 1. Create GitHub Repository
```bash
# In your terminal, create a new repository on GitHub with:
# - Name: mcp-model-switcher
# - Description: "Model Context Protocol server that intelligently switches between LLMs in LM Studio"
# - Visibility: Public
# - License: MIT
```

#### 2. Clone and Initialize
```bash
git clone https://github.com/YOUR_USERNAME/mcp-model-switcher.git
cd mcp-model-switcher

# Create initial files
touch README.md LICENSE .gitignore package.json
mkdir -p src/utils
```

#### 3. Create Required Files

**`.gitignore` (Node.js specific):**
```gitignore
# Dependencies
node_modules/

# Environment variables
.env
.env.local
.env.*.local

# IDE and editor files
.vscode/
.idea/
*.swp
*.swo
*~

# OS files
.DS_Store
Thumbs.db

# Build outputs
dist/
build/

# Log files
*.log
npm-debug.log*
```

**`LICENSE` (MIT License):**
```text
MIT License

Copyright (c) 2026 YOUR_NAME

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

**`package.json` (Minimum Requirements):**
```json
{
  "name": "mcp-model-switcher",
  "version": "1.0.0",
  "description": "Model Context Protocol server that intelligently switches between LLMs in LM Studio based on task type",
  "main": "src/index.js",
  "type": "module",
  "scripts": {
    "start": "node src/index.js"
  },
  "keywords": [
    "mcp",
    "model-context-protocol",
    "lm-studio",
    "llm",
    "ai-agent"
  ],
  "author": "YOUR_NAME",
  "license": "MIT",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  }
}
```

---

## Distribution: Cline Marketplace Integration

### Installation Process Flow

When users install your server from Cline's MCP Marketplace:

```
User clicks "Install" in Cline
         ↓
Cline clones repository to local storage
         ↓
npm/pnpm install dependencies
         ↓
MCP server configuration added to cline_mcp_settings.json
         ↓
Server becomes available in Cline's tools list
```

### Cline Marketplace Requirements

| Requirement | Details |
|------------|---------|
| **Repository URL** | `https://github.com/YOUR_USERNAME/mcp-model-switcher` |
| **Logo** | 400×400 PNG (to be created) |
| **README Quality** | Must include installation instructions |
| **License** | MIT or compatible open source |

### Submission Process (Overview)

1. **Create Issue** in [mcp-marketplace](https://github.com/cline/mcp-marketplace/issues/new?template=mcp-server-submission.yml)
2. **Include:** Repo URL, Logo, Reason for addition
3. **Confirm** installation was tested using README.md or llms-install.md
4. **Wait for Approval** (typically 2-3 days)
5. **Server Live** in Marketplace

---

## Distribution Files: llms-install.md

### What is llms-install.md?

The `llms-install.md` file is an optional but recommended document that provides enhanced installation guidance specifically for AI agents like Cline. While a standard README.md is usually sufficient, `llms-install.md` can be helpful for:

- Complex setups requiring API keys
- Environment variable configuration
- Client-specific installation instructions (VS Code, Cursor, etc.)

### When to Create llms-install.md

**Create `llms-install.md` if your server requires:**
- API keys or authentication tokens
- Environment variable configuration
- Client-specific MCP settings
- Multiple installation methods

**For this project (Phase 1):**
Since `mcp-model-switcher` is a standalone MCP server that connects to LM Studio (which handles model loading), the standard README.md should be sufficient for now. We'll add `llms-install.md` in Phase 2 if needed.

---

## Detailed Component Breakdown

### 1. model-dna-schema.js

**Purpose:** Defines the DNA schema structure, validation rules, and migration system using Zod-based type safety.

#### Valid Model Types

```javascript
export const VALID_MODEL_TYPES = [
  "conversationalist",    // General conversation, chat
  "ninja-researcher",     // Code fixes, debugging, solutions (hyphenated)
  "architect",            // Feature architecture, design patterns
  "executor",             // Code execution, writing, editing
  "researcher",           // General research, information gathering
  "vision",               // Image analysis, visual content understanding
];
```

**Note:** Model types use hyphenated naming (e.g., `ninja-researcher` not `ninjaResearcher`) for consistency across the codebase.

#### Schema Definition

The schema is defined as a reference object for documentation purposes:

```javascript
export const MODEL_DNA_SCHEMA = {
  version: {
    type: "number",
    required: true,
    min: 1,
    description: "Schema version for migration support",
  },
  primaryRole: {
    type: "string",
    required: false,
    default: "conversationalist",
    description: "Default model role for the system",
  },
  models: {
    type: "object",
    required: true,
    description: "Model configurations with ratings and usage stats",
  },
  taskModelMapping: {
    type: "object",
    required: true,
    description: "Task type → model role mapping",
  },
  memories: {
    type: "object",
    required: false,
    default: {},
    description: "Key-value store for model preferences",
  },
  usageStats: {
    type: "object",
    required: false,
    default: {},
    description: "Auto-tracked usage statistics",
  },
  mcpIntegrations: {
    type: "object",
    required: false,
    default: {},
    description: "Enabled MCP integrations (web-search, context7, doc-processor)",
  },
  hardwareProfile: {
    type: "object",
    required: false,
    default: {},
    description: "Hardware-aware parallel loading configuration",
  },
  fallbackStrategy: {
    type: "object",
    required: false,
    default: {},
    description: "Model fallback strategy settings",
  },
};
```

#### Default DNA Configuration (Version 3)

```javascript
export function getDefaultDNA() {
  return {
    version: 3,  // Current schema version
    primaryRole: "conversationalist",
    models: {
      conversationalist: {
        purpose: "general conversation and chat",
        usageCount: 0,
        rating: null,
        createdAt: null,
      },
      "ninja-researcher": {
        purpose: "code fixes and debugging solutions",
        usageCount: 0,
        rating: null,
        createdAt: null,
      },
      architect: {
        purpose: "feature architecture and design patterns",
        usageCount: 0,
        rating: null,
        createdAt: null,
      },
      executor: {
        purpose: "code execution, writing, and editing",
        usageCount: 0,
        rating: null,
        createdAt: null,
      },
      researcher: {
        purpose: "general research and information gathering",
        usageCount: 0,
        rating: null,
        createdAt: null,
      },
      vision: {
        purpose: "image analysis and visual content understanding",
        usageCount: 0,
        rating: null,
        createdAt: null,
      },
    },
    taskModelMapping: {
      researchBugFixes: "ninja-researcher",
      architectFeatures: "architect",
      executeCode: "executor",
      generalResearch: "researcher",
      visionAnalysis: "vision",
    },
    memories: {},
    usageStats: {
      tasksCompleted: {},
      modelEffectiveness: {},
    },
    mcpIntegrations: {
      webSearch: true,
      context7: true,
      docProcessor: true,
    },
    hardwareProfile: {
      minRamForParallel: 64,     // GB - Minimum for parallel loading
      recommendedRam: 256,       // GB - Optimal for full parallelism
      maxParallelModels: 3,      // Max simultaneous models
    },
    fallbackStrategy: {
      autoFallback: true,
      ratingThreshold: 3.0,      // Minimum acceptable rating
      maxAttempts: 3,            // Maximum fallback attempts
    },
  };
}
```

#### Validation Function

The validation function performs comprehensive checks on DNA configuration:

```javascript
export function validateModelDNA(dna) {
  const errors = [];

  // Basic object check
  if (!dna || typeof dna !== "object" || Array.isArray(dna)) {
    errors.push("DNA configuration must be an object");
    return { valid: false, errors };
  }

  // Validate version
  if (dna.version === undefined || typeof dna.version !== "number") {
    errors.push("version is required and must be a number");
  } else if (dna.version < 1) {
    errors.push("version must be >= 1");
  }

  // Validate models object
  if (!dna.models || typeof dna.models !== "object" || Array.isArray(dna.models)) {
    errors.push("models is required and must be an object");
  } else {
    // Validate each model role
    for (const [role, modelConfig] of Object.entries(dna.models)) {
      if (!VALID_MODEL_TYPES.includes(role)) {
        errors.push(`Invalid model role: ${role}. Must be one of: ${VALID_MODEL_TYPES.join(", ")}`);
      }

      if (!modelConfig || typeof modelConfig !== "object" || Array.isArray(modelConfig)) {
        errors.push(`Model "${role}" must be an object`);
        continue;
      }

      if (!modelConfig.purpose || typeof modelConfig.purpose !== "string") {
        errors.push(`Model "${role}" must have a purpose string`);
      }
    }
  }

  // Validate taskModelMapping
  if (!dna.taskModelMapping || typeof dna.taskModelMapping !== "object" || Array.isArray(dna.taskModelMapping)) {
    errors.push("taskModelMapping is required and must be an object");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
```

#### Migration System

The migration system supports upgrading DNA schema versions automatically:

```javascript
const MIGRATIONS = {
  // Version 1 -> 2: Restructure from modelConfig to settings/hardwareProfile/fallbackStrategy
  1: (dna) => {
    const migrated = { ...dna, version: 2 };

    // Remove old modelConfig field if present
    if (migrated.modelConfig) {
      delete migrated.modelConfig;
    }

    // Ensure settings exist
    migrated.settings = migrated.settings || {
      temperature: 0.7,
      maxTokens: 1000,
    };

    // Add hardware profile if not present
    migrated.hardwareProfile = migrated.hardwareProfile || {
      minRamForParallel: 64,
      recommendedRam: 256,
      maxParallelModels: 3,
    };

    // Add fallback strategy if not present
    migrated.fallbackStrategy = migrated.fallbackStrategy || {
      autoFallback: true,
      ratingThreshold: 3.0,
      maxAttempts: 3,
    };

    return migrated;
  },

  // Version 2 -> 3: Normalize model role names (hyphenated)
  2: (dna) => {
    const migrated = { ...dna, version: 3 };
    
    // Normalize model role names if they use camelCase
    if (migrated.models) {
      const normalizedModels = {};
      for (const [role, config] of Object.entries(migrated.models)) {
        const normalizedRole = role
          .replace(/([A-Z])/g, "-$1")
          .toLowerCase()
          .replace(/^-/, "");
        normalizedModels[normalizedRole] = config;
      }
      migrated.models = normalizedModels;
    }

    // Normalize task mapping keys
    if (migrated.taskModelMapping) {
      const normalizedMapping = {};
      for (const [task, model] of Object.entries(migrated.taskModelMapping)) {
        const normalizedTask = task
          .replace(/([A-Z])/g, "-$1")
          .toLowerCase()
          .replace(/^-/, "");
        normalizedMapping[normalizedTask] = model;
      }
      migrated.taskModelMapping = normalizedMapping;
    }

    return migrated;
  },
};

export function applyMigration(dna) {
  if (!dna || typeof dna !== "object") {
    return dna;
  }

  const currentVersion = 3; // Latest schema version
  const sourceVersion = dna.version || 1;
  let migrated = { ...dna };

  // Apply migrations sequentially from source version to current
  for (let version = sourceVersion; version < currentVersion; version++) {
    const migrateFn = MIGRATIONS[version];
    if (!migrateFn) {
      console.warn(`[DNA] No migration path from version ${version} to ${version + 1}`);
      break;
    }

    console.log(`[DNA] Migrating from version ${version} to ${version + 1}`);
    migrated = migrateFn(migrated);
  }

  // Ensure final version is current
  if (migrated.version !== currentVersion) {
    migrated.version = currentVersion;
  }

  return migrated;
}
```

#### File I/O Helpers

```javascript
export function loadDNAFromFile(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = readFileSync(filePath, "utf-8");
    const dna = JSON.parse(content);
    return applyMigration(dna);
  } catch (error) {
    console.error(`[DNA] Failed to load ${filePath}:`, error.message);
    return null;
  }
}

export function saveDNAToFile(filePath, dna) {
  // Validate before saving
  const validation = validateModelDNA(dna);
  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors,
      path: filePath,
    };
  }

  try {
    writeFileSync(filePath, JSON.stringify(dna, null, 2), "utf-8");
    return {
      success: true,
      path: filePath,
    };
  } catch (error) {
    return {
      success: false,
      errors: [error.message],
      path: filePath,
    };
  }
}
```

---

### 2. model-dna-manager.js

**Purpose:** Manages DNA file operations with caching and inheritance support. This module contains the `mergeDNALevels()` function (not in a separate file).

#### File Locations

```javascript
export const DNA_FILENAME = ".model-dna.json";      // Project-level config
export const USER_DNA_FILENAME = ".model-user.json"; // User-level overrides
```

#### Cache Management

```javascript
let _cache = { path: null, mtime: 0, data: null };
let _userCache = { path: null, mtime: 0, data: null };
let _watchers = { dna: null, user: null };
```

#### Loading DNA with Caching

```javascript
export function loadModelDNA(projectRoot, forceReload = false) {
  const filePath = getDNAPath(projectRoot);

  try {
    // Check if file exists
    if (!existsSync(filePath)) {
      return null;
    }

    // Check cache first (fast path)
    if (!forceReload && _cache.path === filePath) {
      try {
        const stat = statSync(filePath);
        if (stat.mtimeMs === _cache.mtime) {
          return _cache.data;
        }
      } catch (error) {
        // Stat failed, will reload
      }
    }

    // Load from disk with automatic migration
    const dna = loadDNAFromFile(filePath);

    if (!dna) {
      return null;
    }

    // Update cache
    try {
      const stat = statSync(filePath);
      _cache = { path: filePath, mtime: stat.mtimeMs, data: dna };
    } catch (error) {
      _cache = { path: filePath, mtime: Date.now(), data: dna };
    }

    return dna;
  } catch (error) {
    console.error(`[DNA Manager] Failed to load ${DNA_FILENAME}:`, error.message);
    return null;
  }
}

export function loadUserDNA(projectRoot, forceReload = false) {
  const filePath = getUserDNAPath(projectRoot);

  try {
    // Check if file exists
    if (!existsSync(filePath)) {
      return null;
    }

    // Check cache first
    if (!forceReload && _userCache.path === filePath) {
      try {
        const stat = statSync(filePath);
        if (stat.mtimeMs === _userCache.mtime) {
          return _userCache.data;
        }
      } catch (error) {
        // Stat failed, will reload
      }
    }

    // Load from disk
    const content = readFileSync(filePath, "utf-8");
    const userDNA = JSON.parse(content);
    
    // Update cache
    try {
      const stat = statSync(filePath);
      _userCache = { path: filePath, mtime: stat.mtimeMs, data: userDNA };
    } catch (error) {
      _userCache = { path: filePath, mtime: Date.now(), data: userDNA };
    }

    return userDNA;
  } catch (error) {
    console.error(`[DNA Manager] Failed to load ${USER_DNA_FILENAME}:`, error.message);
    return null;
  }
}
```

#### DNA Level Merging (in model-dna-manager.js)

**Note:** This function is implemented in `model-dna-manager.js` for consolidation, not in a separate inheritance file.

```javascript
export function mergeDNALevels(projectRoot) {
  const defaults = getDefaultDNA();
  const projectDNA = loadModelDNA(projectRoot) || {};
  const userDNA = loadUserDNA(projectRoot) || {};

  // Deep merge with progressive override (Priority: User > Project > Defaults)
  return {
    version: userDNA.version || projectDNA.version || defaults.version,
    primaryRole: userDNA.primaryRole || projectDNA.primaryRole || defaults.primaryRole,

    models: { 
      ...defaults.models, 
      ...projectDNA.models, 
      ...userDNA.models 
    },

    taskModelMapping: { 
      ...defaults.taskModelMapping, 
      ...projectDNA.taskModelMapping, 
      ...userDNA.taskModelMapping 
    },

    memories: { 
      ...defaults.memories, 
      ...projectDNA.memories, 
      ...userDNA.memories 
    },

    usageStats: { 
      ...defaults.usageStats, 
      ...projectDNA.usageStats, 
      ...userDNA.usageStats 
    },

    mcpIntegrations: { 
      ...defaults.mcpIntegrations, 
      ...projectDNA.mcpIntegrations, 
      ...userDNA.mcpIntegrations 
    },

    hardwareProfile: { 
      ...defaults.hardwareProfile, 
      ...projectDNA.hardwareProfile, 
      ...userDNA.hardwareProfile 
    },

    fallbackStrategy: { 
      ...defaults.fallbackStrategy, 
      ...projectDNA.fallbackStrategy, 
      ...userDNA.fallbackStrategy 
    },
  };
}
```

#### Creating DNA File

```javascript
export function createDNAFile(config = {}, projectRoot) {
  const filePath = getDNAPath(projectRoot);
  const defaults = getDefaultDNA();

  // Deep merge with defaults, preserving any custom fields
  const merged = {
    ...defaults,
    ...config,
    models: { 
      ...defaults.models, 
      ...(config.models || {}) 
    },
    taskModelMapping: { 
      ...defaults.taskModelMapping, 
      ...(config.taskModelMapping || {}) 
    },
    memories: { 
      ...defaults.memories, 
      ...(config.memories || {}) 
    },
    usageStats: { 
      ...defaults.usageStats, 
      ...(config.usageStats || {}) 
    },
    mcpIntegrations: { 
      ...defaults.mcpIntegrations, 
      ...(config.mcpIntegrations || {}) 
    },
    hardwareProfile: { 
      ...defaults.hardwareProfile, 
      ...(config.hardwareProfile || {}) 
    },
    fallbackStrategy: { 
      ...defaults.fallbackStrategy, 
      ...(config.fallbackStrategy || {}) 
    },
  };

  // Validate before saving
  const validation = validateModelDNA(merged);
  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors,
      path: filePath,
    };
  }

  try {
    writeFileSync(filePath, JSON.stringify(merged, null, 2), "utf-8");

    // Update cache
    try {
      const stat = statSync(filePath);
      _cache = { path: filePath, mtime: stat.mtimeMs, data: merged };
    } catch (error) {
      _cache = { path: filePath, mtime: Date.now(), data: merged };
    }

    return {
      success: true,
      path: filePath,
      config: merged,
    };
  } catch (error) {
    return {
      success: false,
      errors: [error.message],
      path: filePath,
    };
  }
}
```

#### Recording Effectiveness Ratings

```javascript
export function recordEffectivenessRating(modelRole, taskType, rating, feedback = "", projectRoot) {
  const dna = loadModelDNA(projectRoot);
  if (!dna) {
    return null;
  }

  // Validate and clamp rating to 1-5 range
  const clampedRating = Math.max(1, Math.min(5, rating));

  // Initialize tracking structures
  if (!dna.usageStats) {
    dna.usageStats = {};
  }
  if (!dna.usageStats.modelEffectiveness) {
    dna.usageStats.modelEffectiveness = {};
  }
  if (!dna.usageStats.tasksCompleted) {
    dna.usageStats.tasksCompleted = {};
  }

  // Update task completion count
  dna.usageStats.tasksCompleted[taskType] = 
    (dna.usageStats.tasksCompleted[taskType] || 0) + 1;

  // Initialize model ratings structure
  if (!dna.usageStats.modelEffectiveness[modelRole]) {
    dna.usageStats.modelEffectiveness[modelRole] = {};
  }
  if (!dna.usageStats.modelEffectiveness[modelRole][taskType]) {
    dna.usageStats.modelEffectiveness[modelRole][taskType] = [];
  }

  // Add new rating with timestamp
  dna.usageStats.modelEffectiveness[modelRole][taskType].push({
    rating: clampedRating,
    feedback: feedback.trim() || null,
    timestamp: new Date().toISOString(),
  });

  // Keep only last 10 ratings per model/task combo (sliding window)
  const ratings = dna.usageStats.modelEffectiveness[modelRole][taskType];
  if (ratings.length > 10) {
    dna.usageStats.modelEffectiveness[modelRole][taskType] = ratings.slice(-10);
  }

  // Write back to disk
  const filePath = getDNAPath(projectRoot);
  const result = saveDNAToFile(filePath, dna);

  if (!result.success) {
    console.error("[DNA Manager] Failed to save rating:", result.errors);
    return null;
  }

  // Update cache
  try {
    const stat = statSync(filePath);
    _cache = { path: filePath, mtime: stat.mtimeMs, data: dna };
  } catch (error) {
    _cache = { path: filePath, mtime: Date.now(), data: dna };
  }

  return dna.usageStats.modelEffectiveness[modelRole][taskType];
}
```

#### Getting Average Rating

```javascript
export function getAverageRating(modelRole, taskType, projectRoot) {
  const dna = loadModelDNA(projectRoot);

  if (!dna || !dna.usageStats?.modelEffectiveness?.[modelRole]?.[taskType]) {
    return null;
  }

  const ratings = dna.usageStats.modelEffectiveness[modelRole][taskType];

  if (ratings.length === 0) {
    return null;
  }

  const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
  const avg = sum / ratings.length;

  // Return formatted to 2 decimal places
  return avg.toFixed(2);
}
```

#### Memory Management

```javascript
export function saveMemory(key, value, projectRoot) {
  const dna = loadModelDNA(projectRoot) || getDefaultDNA();

  // Initialize memories if needed
  if (!dna.memories) {
    dna.memories = {};
  }

  // Save memory with timestamp
  dna.memories[key] = {
    value,
    createdAt: new Date().toISOString(),
  };

  // Write to disk
  const filePath = getDNAPath(projectRoot);
  const result = saveDNAToFile(filePath, dna);

  if (!result.success) {
    console.error("[DNA Manager] Failed to save memory:", result.errors);
    return null;
  }

  // Update cache
  try {
    const stat = statSync(filePath);
    _cache = { path: filePath, mtime: stat.mtimeMs, data: dna };
  } catch (error) {
    _cache = { path: filePath, mtime: Date.now(), data: dna };
  }

  return dna.memories[key];
}

export function deleteMemory(key, projectRoot) {
  const dna = loadModelDNA(projectRoot);

  if (!dna || !dna.memories?.[key]) {
    return false;
  }

  delete dna.memories[key];

  // Write back
  const filePath = getDNAPath(projectRoot);
  const result = saveDNAToFile(filePath, dna);

  if (!result.success) {
    console.error("[DNA Manager] Failed to delete memory:", result.errors);
    return false;
  }

  // Invalidate cache
  clearCache();

  return true;
}
```

#### Additional Utility Functions

```javascript
// Update DNA with partial updates
export function updateDNA(updates, projectRoot) {
  const currentDNA = loadModelDNA(projectRoot) || getDefaultDNA();

  // Merge updates (deep merge for nested objects)
  const updatedDNA = {
    ...currentDNA,
    ...updates,
    models: { ...currentDNA.models, ...(updates.models || {}) },
    taskModelMapping: { ...currentDNA.taskModelMapping, ...(updates.taskModelMapping || {}) },
    memories: { ...currentDNA.memories, ...(updates.memories || {}) },
    usageStats: { ...currentDNA.usageStats, ...(updates.usageStats || {}) },
    mcpIntegrations: { ...currentDNA.mcpIntegrations, ...(updates.mcpIntegrations || {}) },
    hardwareProfile: { ...currentDNA.hardwareProfile, ...(updates.hardwareProfile || {}) },
    fallbackStrategy: { ...currentDNA.fallbackStrategy, ...(updates.fallbackStrategy || {}) },
  };

  // Save updated DNA
  const filePath = getDNAPath(projectRoot);
  const result = saveDNAToFile(filePath, updatedDNA);

  if (!result.success) {
    throw new Error(`Failed to update DNA: ${result.errors.join(", ")}`);
  }

  return updatedDNA;
}

// Reset DNA to default configuration
export function resetDNA(projectRoot) {
  const defaultDNA = getDefaultDNA();
  const filePath = getDNAPath(projectRoot);

  const result = saveDNAToFile(filePath, defaultDNA);

  if (!result.success) {
    throw new Error(`Failed to reset DNA: ${result.errors.join(", ")}`);
  }

  return defaultDNA;
}

// Clear all DNA caches
export function clearCache() {
  _cache = { path: null, mtime: 0, data: null };
  _userCache = { path: null, mtime: 0, data: null };

  // Stop file watchers if active
  if (_watchers.dna) {
    _watchers.dna.close();
    _watchers.dna = null;
  }
  if (_watchers.user) {
    _watchers.user.close();
    _watchers.user = null;
  }
}

// Watch DNA files for changes and auto-reload cache
export function watchDNAFiles(projectRoot, callback) {
  const dnaPath = getDNAPath(projectRoot);
  const userPath = getUserDNAPath(projectRoot);

  // Ensure files exist before watching
  if (!existsSync(dnaPath)) {
    createDNAFile({}, projectRoot);
  }
  if (!existsSync(userPath)) {
    writeFileSync(userPath, JSON.stringify({}, null, 2), "utf-8");
  }

  // Start watchers
  const dnaWatcher = watch(dnaPath, (eventType, filename) => {
    if (eventType === "change") {
      clearCache();
      callback("dna", loadModelDNA(projectRoot, true), filename);
    }
  });

  const userWatcher = watch(userPath, (eventType, filename) => {
    if (eventType === "change") {
      clearCache();
      callback("user", loadUserDNA(projectRoot, true), filename);
    }
  });

  _watchers = { dna: dnaWatcher, user: userWatcher };

  return { stop: () => clearCache() };
}
```

---

## Usage Examples

### Initializing DNA for a Project

```javascript
import { createDNAFile } from './model-dna-manager.js';

// Create DNA with custom settings
const result = createDNAFile({
  primaryRole: "executor",
  models: {
    executor: { 
      purpose: "code generation and editing",
      usageCount: 0
    }
  },
  taskModelMapping: {
    codeGeneration: "executor"
  }
});

console.log(`DNA created at: ${result.path}`);
```

### Loading and Using DNA

```javascript
import { loadModelDNA, getAverageRating, mergeDNALevels } from './model-dna-manager.js';

// Load project DNA
const dna = loadModelDNA();

// Get merged configuration (User > Project > Defaults)
const merged = mergeDNALevels();

// Get average rating for a model on a specific task
const avgRating = getAverageRating("ninja-researcher", "researchBugFixes");
console.log(`Ninja Researcher average rating: ${avgRating}`);

// Access model configurations
for (const [role, config] of Object.entries(dna.models)) {
  console.log(`${role}: ${config.purpose}`);
}
```

### Recording a Rating

```javascript
import { recordEffectivenessRating } from './model-dna-manager.js';

// User rates a model's performance
recordEffectivenessRating(
  "ninja-researcher",  // Model role (hyphenated)
  "researchBugFixes",  // Task type
  5,                   // Rating (1-5)
  "Excellent - found the bug quickly!"  // Feedback
);

console.log("Rating recorded!");
```

---

## Testing Strategy

### Unit Tests for model-dna-schema.js

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getDefaultDNA, validateModelDNA, applyMigration } from '../src/utils/model-dna-schema.js';

describe('Model DNA Schema', () => {
  describe('validateModelDNA()', () => {
    it('should validate a complete DNA configuration', () => {
      const dna = getDefaultDNA();
      const result = validateModelDNA(dna);
      assert.strictEqual(result.valid, true);
    });

    it('should reject invalid model type', () => {
      const dna = {
        version: 3,
        models: { invalidRole: { purpose: "test" } },
        taskModelMapping: {}
      };
      
      const result = validateModelDNA(dna);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('invalidRole')));
    });

    it('should reject missing version', () => {
      const dna = {
        models: {},
        taskModelMapping: {}
      };
      
      const result = validateModelDNA(dna);
      assert.strictEqual(result.valid, false);
    });
  });

  describe('getDefaultDNA()', () => {
    it('should return complete default DNA with version 3', () => {
      const dna = getDefaultDNA();
      
      assert.strictEqual(dna.version, 3);
      assert.ok(dna.models.conversationalist);
      assert.ok(dna.models["ninja-researcher"]); // Hyphenated name
      assert.ok(dna.models.architect);
      assert.ok(dna.models.executor);
      assert.ok(dna.models.researcher);
      assert.ok(dna.models.vision);
    });
  });

  describe('applyMigration()', () => {
    it('should migrate version 1 to current version', () => {
      const oldDNA = {
        version: 1,
        modelConfig: { temperature: 0.7 },
        models: { executor: { purpose: "test" } },
        taskModelMapping: {}
      };
      
      const migrated = applyMigration(oldDNA);
      assert.strictEqual(migrated.version, 3);
      assert.ok(!migrated.modelConfig); // Should be removed
    });

    it('should normalize camelCase to hyphenated names', () => {
      const dna = {
        version: 2,
        models: { ninjaResearcher: { purpose: "test" } },
        taskModelMapping: {}
      };
      
      const migrated = applyMigration(dna);
      assert.ok(migrated.models["ninja-researcher"]);
      assert.ok(!migrated.models.ninjaResearcher);
    });
  });
});
```

### Unit Tests for model-dna-manager.js

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { 
  createDNAFile, 
  loadModelDNA, 
  recordEffectivenessRating, 
  getAverageRating,
  mergeDNALevels,
  clearCache 
} from '../src/utils/model-dna-manager.js';

describe('Model DNA Manager', () => {
  let testDir;

  beforeEach(() => {
    testDir = './tests/tmp/test-dna-manager';
    // Setup: create test directory
  });

  afterEach(() => {
    clearCache();
    // Cleanup: remove test artifacts
  });

  describe('recordEffectivenessRating()', () => {
    it('should record ratings and maintain sliding window of 10', async () => {
      // Record 15 ratings (should keep last 10)
      for (let i = 1; i <= 15; i++) {
        recordEffectivenessRating("executor", "executeCode", i, `Feedback ${i}`, testDir);
      }
      
      const dna = loadModelDNA(testDir);
      const ratings = dna.usageStats.modelEffectiveness.executor.executeCode;
      assert.strictEqual(ratings.length, 10); // Sliding window
      assert.strictEqual(ratings[0].rating, 6); // First kept rating
    });
  });

  describe('getAverageRating()', () => {
    it('should calculate average correctly', async () => {
      recordEffectivenessRating("executor", "executeCode", 4, "", testDir);
      recordEffectivenessRating("executor", "executeCode", 6, "", testDir); // Will be clamped to 5
      recordEffectivenessRating("executor", "executeCode", 5, "", testDir);
      
      const avg = getAverageRating("executor", "executeCode", testDir);
      assert.strictEqual(avg, "4.67"); // (4+5+5)/3 ≈ 4.67
    });
  });

  describe('mergeDNALevels()', () => {
    it('should merge user and project DNA with correct priority', async () => {
      const defaults = getDefaultDNA();
      
      // Create project DNA
      createDNAFile({
        models: { executor: { purpose: "project-purpose" } }
      }, testDir);

      // User DNA would override project DNA
      const merged = mergeDNALevels(testDir);
      assert.ok(merged.models.executor);
    });
  });
});
```

---

## Integration Points

The DNA system integrates with:

1. **Model Switching Service (Phase 2)** - Uses ratings for model recommendations via `getAverageRating()`
2. **Task Dispatcher (Phase 3)** - Uses `taskModelMapping` for routing decisions
3. **Hardware Detector** - Uses `hardwareProfile` for parallel loading decisions
4. **MCP Integrations** - Uses `mcpIntegrations` to enable/disable integrations
5. **Evolution Engine (Phase 5)** - Analyzes `usageStats` for optimization suggestions

---

## Future Enhancements

- [ ] Auto-evolution suggestions based on low ratings
- [ ] Model clustering for similar task patterns
- [ ] Usage analytics dashboard
- [ ] Cross-project DNA sharing
- [ ] Template-based DNA initialization

---

## References

- Schema validation: Custom validation with comprehensive error reporting
- File format: JSON with 2-space indentation
- Cache strategy: LRU with file modification time (mtime) checks
- Migration system: Sequential version upgrades from v1 → v3

---

## Phase 1 Marketplace Distribution Checklist ✅

This section tracks your progress toward Cline MCP Marketplace readiness.

### Repository Setup
- [ ] GitHub repository created: `mcp-model-switcher`
- [ ] Repository is PUBLIC (required for marketplace)
- [ ] MIT License added
- [ ] `.gitignore` configured for Node.js
- [ ] `package.json` with required metadata

### Documentation Requirements
- [ ] README.md includes installation instructions
- [ ] README.md documents usage scenarios
- [ ] API endpoints are documented

### Distribution Files
- [ ] `.gitignore` exists in repository root
- [ ] `LICENSE` file present (MIT)
- [ ] `README.md` with overview and setup guide

### Next Steps
When Phase 1 is complete, proceed to:
1. **Phase 2** - Model Switching Service (adds LM Studio integration)
2. **Phase 5** - Completion checklist includes marketplace submission preparation
3. **Phase 6** - Complete Cline Marketplace submission guide

---

## Implementation Checklist

Use this checklist when implementing Phase 1 to ensure all components are created in the correct order.

### Required Files (Creation Order)

1. **`src/utils/model-dna-schema.js`** - Schema definition, validation, and migrations
   - Defines `MODEL_DNA_SCHEMA` and `VALID_MODEL_TYPES`
   - Exports `getDefaultDNA()` function (returns version 3 schema)
   - Exports `validateModelDNA()` function with comprehensive checks
   - Exports `applyMigration()` function with MIGRATIONS object (v1→v2, v2→v3)
   - Exports `loadDNAFromFile()` and `saveDNAToFile()` helpers

2. **`src/utils/model-dna-manager.js`** - File operations and CRUD
   - Constants: `DNA_FILENAME`, `USER_DNA_FILENAME`
   - Cache management: `_cache`, `_userCache`, `_watchers`
   - Functions: `loadModelDNA()`, `loadUserDNA()` with mtime-based caching
   - Function: `mergeDNALevels()` (consolidated here, not separate file)
   - Functions: `createDNAFile()`, `updateDNA()`, `resetDNA()`
   - Functions: `recordEffectivenessRating()`, `getAverageRating()`
   - Functions: `saveMemory()`, `deleteMemory()`
   - Functions: `clearCache()`, `watchDNAFiles()`

3. **`src/utils/model-dna-inheritance.js`** - Optional additional inheritance logic
   - Can be created if more complex inheritance is needed beyond `mergeDNALevels()`

4. **`src/utils/index.js`** - Utility exports (optional barrel file)
   ```javascript
   export * from './model-dna-schema.js';
   export * from './model-dna-manager.js';
   export { mergeDNALevels } from './model-dna-manager.js'; // Explicit re-export if needed
   ```

### Verification Steps

- [ ] Run `node src/utils/model-dna-schema.js` - should output test results without errors
- [ ] Create test DNA file: `createDNAFile()` creates `.model-dna.json`
- [ ] Load DNA: `loadModelDNA()` returns valid configuration with version 3
- [ ] Record rating: `recordEffectivenessRating()` updates usage stats (sliding window of 10)
- [ ] Validate schema: `validateModelDNA()` accepts valid config, rejects invalid

---

## Phase 1 File Structure

```
mcp-model-switcher/
├── src/
│   └── utils/
│       ├── model-dna-schema.js          # ~300 lines - Schema, validation, migrations
│       ├── model-dna-manager.js         # ~400 lines - CRUD, caching, mergeDNALevels()
│       ├── model-dna-inheritance.js     # Optional - Additional inheritance logic
│       └── index.js                     # 20 lines - Barrel exports (optional)
├── .model-dna.json                      # Created at runtime (first use)
├── .model-user.json                     # Created at runtime (user overrides)
└── package.json                         # Project metadata
```

**Total Phase 1 Code:** ~720 lines (without inheritance file) or ~800+ lines (with inheritance)

---

## Integration with Phase 4

The Phase 4 Tools Implementation directly depends on Phase 1's DNA system. This section documents the integration points.

### Functions Called by Phase 4

| Phase 4 Tool | Phase 1 Function | Purpose |
|-------------|------------------|---------|
| `switch-model.js` | `loadModelDNA()` | Load DNA for model usage statistics |
| `switch-model.js` | `getAverageRating()` | Calculate model effectiveness for list output |
| `execute-task.js` | `loadModelDNA()` | Load DNA for model selection (CRITICAL - must be initialized) |
| `model-dna-tool.js` | `loadModelDNA()` | Get current DNA configuration |
| `model-dna-tool.js` | `createDNAFile()` | Initialize DNA or save changes |
| `model-dna-tool.js` | `saveMemory()` | Store model preferences |
| `model-dna-tool.js` | `deleteMemory()` | Remove stored preferences |
| `rate-model.js` | `loadModelDNA()` | Load DNA before recording rating |
| `rate-model.js` | `recordEffectivenessRating()` | Record user feedback |

### Critical Integration Note

**Phase 4 `execute-task.js` requires DNA initialization:**
- The `handleExecuteTask()` function calls `loadModelDNA()` at the start
- If DNA is not initialized, it returns an error instructing the user to call `model-dna` with `action:'init'`
- This dependency chain ensures Phase 1 is fully implemented before Phase 4 can function

---

## Common Implementation Pitfalls

1. **Cache invalidation** - Call `clearCache()` or update `_cache.mtime` after writes
2. **Schema validation** - Run `validateModelDNA()` before saving config
3. **File paths** - Use `getDNAPath(projectRoot)` not hardcoded paths
4. **Hyphenated model names** - Use `ninja-researcher` not `ninjaResearcher` (v3 schema)
5. **Sliding window** - Ratings are capped at 10 per model/task combo using `slice(-10)`

---

## Testing Your Implementation

After creating all Phase 1 files, run this verification:

```bash
# Create test directory
mkdir -p test-phase1
cd test-phase1

# Test schema module
node src/utils/model-dna-schema.js

# Expected output includes:
# "Default DNA generated: { version: 3, roles: [...], tasks: [...] }"
# "Default DNA validation: PASS"
# "Migration v1->v2/v3: 3 settings? true"
```

Expected behavior:
- Schema module self-test runs successfully
- Default DNA has version 3 with hyphenated model names
- Migration from v1 to v3 works correctly

---

## Moving to Phase 2

**Prerequisites for Phase 2:**
- [ ] All Phase 1 files created and tested
- [ ] `.model-dna.json` can be created and loaded
- [ ] `recordEffectivenessRating()` updates file correctly with sliding window
- [ ] `getAverageRating()` returns correct values (2 decimal places)
- [ ] Migrations work from v1 → v3

Once Phase 1 is verified, proceed to **Phase 2: Model Switching Service**.

---

## Changes from Original Specification

The following changes were made during implementation compared to the original specification:

| Aspect | Original Spec | Actual Implementation |
|--------|--------------|----------------------|
| Schema version | v1 | v3 (with migrations) |
| Model naming | camelCase (`ninjaResearcher`) | hyphenated (`ninja-researcher`) |
| Validation approach | Custom validation only | Comprehensive validation with detailed error messages |
| `mergeDNALevels()` location | Separate file | Consolidated in `model-dna-manager.js` |
| File I/O helpers | Not specified | Added `loadDNAFromFile()`, `saveDNAToFile()` |
| Additional functions | Not specified | Added `updateDNA()`, `resetDNA()`, `watchDNAFiles()` |

These changes improve maintainability, consistency, and developer experience.