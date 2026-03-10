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
           ┘────────────────────────┘
```

---

## File Structure

```
src/utils/
├── model-dna-schema.js          # Schema definition & validation
├── model-dna-manager.js         # CRUD operations & caching
└── model-dna-inheritance.js     # Inheritance logic (optional)
```

---

## GitHub Repository Setup for Cline Marketplace

> **Marketplace Distribution Breadcrumb** - This document is part of the `mcp-model-switcher` project, designed for submission to [Cline's MCP Marketplace](https://github.com/cline/mcp-marketplace). The complete distribution guide is available in [Phase 6](phase-6-marketplace-submission.md).

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

**Full submission guide:** See [Phase 6](phase-6-marketplace-submission.md)

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

**Purpose:** Defines the DNA schema structure, validation rules, and migration system.

#### Schema Definition

```javascript
export const MODEL_DNA_SCHEMA = {
  version: {
    type: "number",
    required: true,
    min: 1,
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
    description: "Key-value store for model preferences",
  },
  usageStats: {
    type: "object",
    required: false,
    description: "Auto-tracked usage statistics",
  },
  mcpIntegrations: {
    type: "object",
    required: false,
    description: "Enabled MCP integrations (web-search, context7, doc-processor)",
  },
  hardwareProfile: {
    type: "object",
    required: false,
    description: "Hardware-aware parallel loading configuration",
  },
  fallbackStrategy: {
    type: "object",
    required: false,
    description: "Model fallback strategy settings",
  },
};
```

#### Valid Model Types

```javascript
const VALID_MODEL_TYPES = [
  "conversationalist",   // General conversation, chat
  "ninja-researcher",    // Code fixes, debugging, solutions
  "architect",           // Feature architecture, design patterns
  "executor",            // Code execution, writing, editing
  "researcher",          // General research, information gathering
  "vision",              // Image analysis, visual content understanding
];
```

#### Default DNA Configuration

```javascript
export function getDefaultDNA() {
  return {
    version: 1,
    models: {
      conversationalist: { 
        purpose: "general conversation", 
        usageCount: 0,
        rating: null,
        createdAt: null
      },
      ninjaResearcher: { 
        purpose: "code fixes and solutions", 
        usageCount: 0,
        rating: null,
        createdAt: null
      },
      architect: { 
        purpose: "feature architecture", 
        usageCount: 0,
        rating: null,
        createdAt: null
      },
      executor: { 
        purpose: "code execution and writing", 
        usageCount: 0,
        rating: null,
        createdAt: null
      },
      researcher: { 
        purpose: "general research", 
        usageCount: 0,
        rating: null,
        createdAt: null
      },
      vision: { 
        purpose: "image analysis", 
        usageCount: 0,
        rating: null,
        createdAt: null
      },
    },
    taskModelMapping: {
      researchBugFixes: "ninjaResearcher",
      architectFeatures: "architect",
      executeCode: "executor",
      generalResearch: "researcher",
      visionAnalysis: "vision",
    },
    memories: {},
    usageStats: {
      tasksCompleted: {},           // Track task completions
      modelEffectiveness: {},       // Rating history per model/task
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

```javascript
export function validateModelDNA(dna) {
  const errors = [];
  
  // Basic object check
  if (!dna || typeof dna !== "object") {
    errors.push("DNA configuration must be an object");
    return { valid: false, errors };
  }
  
  // Validate version
  if (dna.version === undefined || typeof dna.version !== "number") {
    errors.push("version is required and must be a number");
  }
  
  // Validate minimum version
  if (dna.version < 1) {
    errors.push("version must be >= 1");
  }
  
  // Validate models object
  if (!dna.models || typeof dna.models !== "object") {
    errors.push("models is required and must be an object");
  } else {
    // Validate each model role
    for (const [role, modelConfig] of Object.entries(dna.models)) {
      if (!VALID_MODEL_TYPES.includes(role)) {
        errors.push(`Invalid model role: ${role}`);
      }
      
      if (!modelConfig.purpose || typeof modelConfig.purpose !== "string") {
        errors.push(`Model "${role}" must have a purpose string`);
      }
    }
  }
  
  // Validate taskModelMapping
  if (!dna.taskModelMapping || typeof dna.taskModelMapping !== "object") {
    errors.push("taskModelMapping is required and must be an object");
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
```

#### Migration System

```javascript
const MIGRATIONS = {
  // Version 1: Initial implementation - no migration needed
  1: (dna) => dna,
  
  // Future versions can add migrations here
  // 2: (dna) => { ... migration logic ... }
};

export function applyMigration(dna) {
  const version = dna.version || 1;
  
  // Check if migration exists for this version
  const migrate = MIGRATIONS[version];
  
  if (!migrate) {
    console.warn(`[DNA] No migration found for version ${version}`);
    return dna;
  }
  
  console.log(`[DNA] Applying migration for version ${version}`);
  return migrate(dna);
}
```

---

### 2. model-dna-manager.js

**Purpose:** Manages DNA file operations with caching and inheritance support.

#### File Locations

```javascript
const DNA_FILENAME = ".model-dna.json";      // Project-level config
const USER_DNA_FILENAME = ".model-user.json"; // User-level overrides
```

#### Cache Management

```javascript
let _cache = { path: null, mtime: 0, data: null };
let _userCache = { path: null, mtime: 0, data: null };

/**
 * Get absolute DNA file path
 */
function getDNAPath(projectRoot) {
  return path.join(projectRoot || process.cwd(), DNA_FILENAME);
}

/**
 * Get absolute user DNA file path
 */
function getUserDNAPath(projectRoot) {
  return path.join(projectRoot || process.cwd(), USER_DNA_FILENAME);
}
```

#### Loading DNA with Caching

```javascript
export function loadModelDNA(projectRoot) {
  const root = projectRoot || process.cwd();
  const filePath = getDNAPath(root);

  try {
    // Check cache first (fast path)
    const stat = fs.statSync(filePath);
    const mtime = stat.mtimeMs;

    if (_cache.path === filePath && _cache.mtime === mtime) {
      return _cache.data;
    }

    // Load from disk
    const content = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(content);

    // Validate and migrate
    const validation = validateModelDNA(data);
    if (!validation.valid) {
      console.warn(`[model-dna] Validation errors: ${validation.errors.join(", ")}`);
    }

    const migrated = applyMigration(data);
    
    // Update cache
    _cache = { path: filePath, mtime, data: migrated };
    return migrated;
  } catch (err) {
    if (err.code === "ENOENT") {
      return null; // File doesn't exist yet
    }
    console.warn(`[model-dna] Failed to load ${DNA_FILENAME}:`, err.message);
    return null;
  }
}

export function loadUserDNA(projectRoot) {
  const root = projectRoot || process.cwd();
  const filePath = getUserDNAPath(root);

  try {
    // Check cache first
    const stat = fs.statSync(filePath);
    const mtime = stat.mtimeMs;

    if (_userCache.path === filePath && _userCache.mtime === mtime) {
      return _userCache.data;
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(content);
    
    // Update cache
    _userCache = { path: filePath, mtime, data };
    return data;
  } catch (err) {
    if (err.code === "ENOENT") {
      return null; // User DNA doesn't exist
    }
    console.warn(`[model-dna] Failed to load ${USER_DNA_FILENAME}:`, err.message);
    return null;
  }
}
```

#### DNA Level Merging

```javascript
export function mergeDNALevels(userDNA, projectDNA) {
  const defaults = getDefaultDNA();
  const project = projectDNA || {};
  const user = userDNA || {};

  return {
    // Version: User > Project > Defaults
    version: user.version || project.version || defaults.version,
    
    // Models: Deep merge with priority
    models: { 
      ...defaults.models, 
      ...project.models, 
      ...user.models 
    },
    
    // Task mapping: Deep merge
    taskModelMapping: { 
      ...defaults.taskModelMapping, 
      ...project.taskModelMapping, 
      ...user.taskModelMapping 
    },
    
    // Memories: Deep merge
    memories: { 
      ...defaults.memories, 
      ...project.memories, 
      ...user.memories 
    },
    
    // Usage stats: Deep merge
    usageStats: { 
      ...defaults.usageStats, 
      ...project.usageStats, 
      ...user.usageStats 
    },
    
    // MCP integrations: Deep merge
    mcpIntegrations: { 
      ...defaults.mcpIntegrations, 
      ...project.mcpIntegrations, 
      ...user.mcpIntegrations 
    },
    
    // Hardware profile: Deep merge
    hardwareProfile: { 
      ...defaults.hardwareProfile, 
      ...project.hardwareProfile, 
      ...user.hardwareProfile 
    },
    
    // Fallback strategy: Deep merge
    fallbackStrategy: { 
      ...defaults.fallbackStrategy, 
      ...project.fallbackStrategy, 
      ...user.fallbackStrategy 
    },
  };
}
```

#### Creating DNA File

```javascript
export function createDNAFile(config = {}, projectRoot) {
  const root = projectRoot || process.cwd();
  const filePath = getDNAPath(root);
  const defaults = getDefaultDNA();

  // Deep merge with defaults
  const merged = {
    version: config.version || defaults.version,
    
    models: { 
      ...defaults.models, 
      ...(config.models || {}) 
    },
    
    taskModelMapping: { 
      ...defaults.taskModelMapping, 
      ...(config.taskModelMapping || {}) 
    },
    
    memories: config.memories || defaults.memories,
    
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

  // Validate
  const validation = validateModelDNA(merged);
  if (!validation.valid) {
    console.warn(`[model-dna] Validation failed: ${validation.errors.join(", ")}`);
  }

  // Write to disk
  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), "utf-8");
  
  // Update cache
  _cache = { 
    path: filePath, 
    mtime: fs.statSync(filePath).mtimeMs, 
    data: merged 
  };
  
  return { path: filePath, config: merged };
}
```

#### Recording Effectiveness Ratings

```javascript
export function recordEffectivenessRating(modelRole, taskType, rating, feedback) {
  const dna = loadModelDNA();
  if (!dna) return null;

  // Initialize tracking structures
  dna.usageStats.modelEffectiveness = 
    dna.usageStats.modelEffectiveness || {};
  dna.usageStats.tasksCompleted = 
    dna.usageStats.tasksCompleted || {};

  // Update task completion count
  dna.usageStats.tasksCompleted[taskType] = 
    (dna.usageStats.tasksCompleted[taskType] || 0) + 1;

  // Initialize model ratings structure
  dna.usageStats.modelEffectiveness[modelRole] = 
    dna.usageStats.modelEffectiveness[modelRole] || {};
  
  dna.usageStats.modelEffectiveness[modelRole][taskType] = 
    dna.usageStats.modelEffectiveness[modelRole][taskType] || [];
  
  // Add new rating
  dna.usageStats.modelEffectiveness[modelRole][taskType].push({
    rating,                    // 1-5 scale
    feedback,                  // Optional text feedback
    timestamp: new Date().toISOString(),
  });

  // Keep only last 10 ratings per model/task combo (sliding window)
  const ratings = dna.usageStats.modelEffectiveness[modelRole][taskType];
  if (ratings.length > 10) {
    dna.usageStats.modelEffectiveness[modelRole][taskType] = 
      ratings.slice(-10);
  }

  // Write back to disk
  fs.writeFileSync(getDNAPath(), JSON.stringify(dna, null, 2), "utf-8");
  
  // Invalidate cache
  _cache = { path: null, mtime: 0, data: null };

  return dna.usageStats.modelEffectiveness[modelRole][taskType];
}
```

#### Getting Average Rating

```javascript
export function getAverageRating(modelRole, taskType) {
  const dna = loadModelDNA();
  
  if (!dna || !dna.usageStats?.modelEffectiveness?.[modelRole]?.[taskType]) {
    return null;
  }

  const ratings = dna.usageStats.modelEffectiveness[modelRole][taskType];
  
  if (ratings.length === 0) return null;

  const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
  
  // Return formatted to 2 decimal places
  return (sum / ratings.length).toFixed(2);
}
```

#### Memory Management

```javascript
export function saveMemory(key, value) {
  const dna = loadModelDNA() || getDefaultDNA();
  
  // Initialize memories if needed
  dna.memories = dna.memories || {};
  
  // Save memory with timestamp
  dna.memories[key] = {
    value,
    createdAt: new Date().toISOString(),
  };
  
  // Write to disk
  createDNAFile(dna);
  
  return dna.memories[key];
}

export function deleteMemory(key) {
  const dna = loadModelDNA();
  
  if (!dna || !dna.memories?.[key]) return false;

  delete dna.memories[key];
  
  // Write back
  createDNAFile(dna);
  
  return true;
}
```

#### Cache Management

```javascript
export function clearCache() {
  _cache = { path: null, mtime: 0, data: null };
  _userCache = { path: null, mtime: 0, data: null };
}
```

---

## Usage Examples

### Initializing DNA for a Project

```javascript
import { createDNAFile } from './model-dna-manager.js';

// Create DNA with custom settings
const result = createDNAFile({
  models: {
    conversationalist: { 
      purpose: "customer support assistant",
      usageCount: 0
    },
    executor: { 
      purpose: "code generation and editing",
      usageCount: 0
    }
  },
  taskModelMapping: {
    supportInquiries: "conversationalist",
    codeGeneration: "executor"
  }
});

console.log(`DNA created at: ${result.path}`);
```

### Loading and Using DNA

```javascript
import { loadModelDNA, getAverageRating } from './model-dna-manager.js';

const dna = loadModelDNA();

// Get average rating for a model on a specific task
const avgRating = getAverageRating("ninjaResearcher", "codeFixes");
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
  "ninjaResearcher",  // Model role
  "codeFixes",        // Task type
  5,                  // Rating (1-5)
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

describe('Model DNA Schema', () => {
  describe('validateModelDNA()', () => {
    it('should validate a complete DNA configuration', () => {
      const dna = {
        version: 1,
        models: { conversationalist: { purpose: "test" } },
        taskModelMapping: {}
      };
      
      const result = validateModelDNA(dna);
      assert.strictEqual(result.valid, true);
    });

    it('should reject invalid model type', () => {
      const dna = {
        version: 1,
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
    it('should return complete default DNA', () => {
      const dna = getDefaultDNA();
      
      assert.strictEqual(dna.version, 1);
      assert.ok(dna.models.conversationalist);
      assert.ok(dna.models.ninjaResearcher);
      assert.ok(dna.models.architect);
      assert.ok(dna.models.executor);
      assert.ok(dna.models.researcher);
      assert.ok(dna.models.vision);
    });
  });
});
```

### Unit Tests for model-dna-manager.js

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Model DNA Manager', () => {
  describe('recordEffectivenessRating()', () => {
    it('should record ratings and maintain sliding window', async () => {
      // Record 15 ratings (should keep last 10)
      for (let i = 1; i <= 15; i++) {
        recordEffectivenessRating("testModel", "testTask", i, `Feedback ${i}`);
      }
      
      const ratings = loadModelDNA().usageStats.modelEffectiveness.testModel.testTask;
      assert.strictEqual(ratings.length, 10); // Sliding window
      assert.strictEqual(ratings[0].rating, 6); // First kept rating
    });
  });

  describe('getAverageRating()', () => {
    it('should calculate average correctly', async () => {
      // Clear cache first
      clearCache();
      
      recordEffectivenessRating("testModel", "testTask", 4, "");
      recordEffectivenessRating("testModel", "testTask", 6, ""); // Invalid - should clamp
      recordEffectivenessRating("testModel", "testTask", 5, "");
      
      const avg = getAverageRating("testModel", "testTask");
      assert.strictEqual(avg, "5.00"); // (4+6+5)/3 = 5
    });
  });

  describe('mergeDNALevels()', () => {
    it('should merge user and project DNA with correct priority', () => {
      const defaults = getDefaultDNA();
      const projectDNA = {
        models: { conversationalist: { purpose: "project-purpose" } }
      };
      const userDNA = {
        models: { conversationalist: { purpose: "user-purpose" } }
      };
      
      const merged = mergeDNALevels(userDNA, projectDNA);
      assert.strictEqual(merged.models.conversationalist.purpose, "user-priority");
    });
  });
});
```

---

## Integration Points

The DNA system integrates with:

1. **Model Switching Service** - Uses ratings for model recommendations
2. **Task Dispatcher** - Uses taskModelMapping for routing
3. **Hardware Detector** - Uses hardwareProfile for parallel loading decisions
4. **MCP Discoverer** - Uses mcpIntegrations to enable/disable integrations

---

## Future Enhancements

- [ ] Auto-evolution suggestions based on low ratings
- [ ] Model clustering for similar task patterns
- [ ] Usage analytics dashboard
- [ ] Cross-project DNA sharing
- [ ] Template-based DNA initialization

---

## References

- Schema validation: JSON Schema Draft 7
- File format: JSON with 2-space indentation
- Cache strategy: LRU with file modification time checks

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

### See Also
- [Cline MCP Marketplace](https://github.com/cline/mcp-marketplace)
- [Complete Submission Guide](phase-6-marketplace-submission.md) (to be created in Phase 5)

---

## Implementation Checklist

Use this checklist when implementing Phase 1 to ensure all components are created in the correct order.

### Phase 1 Ready for Implementation

These files must exist before moving to Phase 2:

#### Required Files (Creation Order)

1. **`src/utils/model-dna-schema.js`** - Schema definition, validation, and defaults
   - Defines `MODEL_DNA_SCHEMA` and `VALID_MODEL_TYPES`
   - Exports `getDefaultDNA()` function
   - Exports `validateModelDNA()` function
   - Exports `applyMigration()` function with MIGRATIONS object

2. **`src/utils/model-dna-manager.js`** - File operations and CRUD
   - Constants: `DNA_FILENAME`, `USER_DNA_FILENAME`
   - Cache management: `_cache`, `_userCache`
   - Functions: `loadModelDNA()`, `loadUserDNA()`, `createDNAFile()`
   - Functions: `recordEffectivenessRating()`, `getAverageRating()`
   - Functions: `saveMemory()`, `deleteMemory()`, `clearCache()`

3. **`src/utils/model-dna-inheritance.js`** - Optional inheritance logic
   - Exports `mergeDNALevels()` function
   - Implements deep merge with priority: User > Project > Defaults

4. **`src/utils/index.js`** - Utility exports (optional barrel file)
   ```javascript
   export * from './model-dna-schema.js';
   export * from './model-dna-manager.js';
   export * from './model-dna-inheritance.js';
   ```

#### Verification Steps

- [ ] Run `node src/utils/model-dna-schema.js` - should export functions without errors
- [ ] Create test DNA file: `createDNAFile()` creates `.model-dna.json`
- [ ] Load DNA: `loadModelDNA()` returns valid configuration
- [ ] Record rating: `recordEffectivenessRating()` updates usage stats
- [ ] Validate schema: `validateModelDNA()` accepts valid config, rejects invalid

---

## Phase 1 File Structure

```
mcp-model-switcher/
├── src/
│   └── utils/
│       ├── model-dna-schema.js          # 150 lines - Schema & validation
│       ├── model-dna-manager.js         # 200 lines - CRUD & caching
│       ├── model-dna-inheritance.js     # 50 lines - Merge logic (optional)
│       └── index.js                     # 20 lines - Barrel exports (optional)
├── .model-dna.json                      # Created at runtime (first use)
├── .model-user.json                     # Created at runtime (first user override)
└── package.json                         # Project metadata
```

**Total Phase 1 Code:** ~420 lines (without inheritance) or ~470 lines (with inheritance)

---

## Integration with Phase 4

The Phase 4 Tools Implementation directly depends on Phase 1's DNA system. This section documents the integration points.

### Functions Called by Phase 4

The following Phase 1 functions are used by Phase 4 tools:

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

### Phase 4 Dependencies on Phase 1

**File:** `docs/phase-4-tools-implementation.md`

The Phase 4 documentation references these Phase 1 components:

1. **DNA Loading** - All tools call `loadModelDNA()` from `model-dna-manager.js`
2. **Schema Validation** - `validateModelDNA()` ensures data integrity
3. **Rating System** - `getAverageRating()` and `recordEffectivenessRating()` provide feedback loops
4. **Memory Management** - `saveMemory()` and `deleteMemory()` enable persistent preferences

### Critical Integration Note

**Phase 4 `execute-task.js` requires DNA initialization:**
- The `handleExecuteTask()` function calls `loadModelDNA()` at the start
- If DNA is not initialized, it returns an error instructing the user to call `model-dna` with `action:'init'`
- This dependency chain ensures Phase 1 is fully implemented before Phase 4 can function

### Forward Dependencies

Phase 1 DNA system is also used by:
- **Phase 2** - Model Switching Service uses DNA for model recommendations
- **Phase 3** - Task Dispatcher uses `taskModelMapping` for routing
- **Phase 5** - Evolution Engine analyzes `usageStats` for optimization

---

## Phase 1 vs Phase 4: Quick Reference

| Aspect | Phase 1 (DNA System) | Phase 4 (Tools) |
|--------|---------------------|-----------------|
| **Purpose** | Configuration storage & management | User-facing tools that use DNA |
| **Output** | `.model-dna.json` file | JSON responses to MCP clients |
| **Functions** | CRUD operations on DNA | Tool handlers that call DNA functions |
| **Users** | MCP tools (internal) | Cline, other MCP clients |
| **Trigger** | Called by tools or system init | Invoked via MCP protocol |

**Key Principle:** Phase 1 provides the data layer; Phase 4 provides the API layer.

---

## Common Implementation Pitfalls

1. **Missing Zod import** - Ensure `import z from 'zod';` is in `index.js`
2. **Cache invalidation** - Call `clearCache()` or update `_cache.mtime` after writes
3. **Schema validation** - Run `validateModelDNA()` before saving config
4. **File paths** - Use `getDNAPath(projectRoot)` not hardcoded paths
5. **Async/await** - All file operations should be synchronous for simplicity in v1.0

---

## Testing Your Implementation

After creating all Phase 1 files, run this verification:

```bash
# Create test directory
mkdir -p test-phase1
cd test-phase1

# Test schema
node -e "const { getDefaultDNA, validateModelDNA } = require('../src/utils/model-dna-schema.js'); console.log('Schema OK')"

# Test manager
node -e "const { createDNAFile, loadModelDNA } = require('../src/utils/model-dna-manager.js'); createDNAFile({}); console.log('DNA created:', loadModelDNA() ? 'OK' : 'FAIL')"

# Check file created
ls -la .model-dna.json
```

Expected output:
```
Schema OK
DNA created: OK
-rw-r--r--  1 user  staff  512 Jun  1 12:00 .model-dna.json
```

---

## Moving to Phase 2

**Prerequisites for Phase 2:**
- [ ] All Phase 1 files created and tested
- [ ] `.model-dna.json` can be created and loaded
- [ ] `recordEffectivenessRating()` updates file correctly
- [ ] `getAverageRating()` returns correct values

Once Phase 1 is verified, proceed to **Phase 2: Model Switching Service**.
