# Phase 2: Model Switching Service

## Overview

Phase 2 implements the Model Switching Service - the core engine that manages LLM models in LM Studio. This service handles model loading/unloading, hardware-aware parallel loading, ratings-based recommendations, and automatic fallback strategies.

**Key Components:**
- `lm-studio-switcher.js` - LM Studio API integration and model management
- `hardware-detector.js` - System RAM detection for parallel loading optimization
- Ratings-based recommendation system
- Fallback strategy implementation

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Model Switching Service                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────┐        ┌──────────────────┐                   │
│  │ LM Studio API    │        │ Hardware         │                   │
│  │ Switcher         │◄──────►│ Detector         │                   │
│  └──────────────────┘        └──────────────────┘                   │
│         │                            │                              │
│         ▼                            ▼                              │
│  ┌──────────────────┐        ┌──────────────────┐                   │
│  │ Model Registry   │        │ Parallel         │                   │
│  │ & Cache          │        │ Loading Logic    │                   │
│  └──────────────────┘        └──────────────────┘                   │
│         │                            │                              │
│         ▼                            ▼                              │
│  ┌──────────────────────────────────────────┐                      │
│  │        Recommendations Engine            │                      │
│  │  - Ratings Analysis                      │                      │
│  │  - Task Type Matching                    │                      │
│  │  - Fallback Strategy                     │                      │
│  └──────────────────────────────────────────┘                      │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
src/
├── services/
│   └── lm-studio-switcher.js    # Main switcher service
├── utils/
│   └── hardware-detector.js     # RAM detection & parallel loading
└── integrations/
    ├── web-search-adapter.js
    ├── context7-adapter.js
    └── doc-processor-adapter.js
```

---

## Detailed Component Breakdown

### 1. lm-studio-switcher.js

**Purpose:** Manages LM Studio model lifecycle with ratings-based recommendations.

#### Class Structure

```javascript
export class LmStudioSwitcher {
  constructor() {
    this.baseUrl = process.env.LM_STUDIO_BASE_URL || "http://localhost:1234/v1";
    this.apiKey = process.env.LM_STUDIO_API_KEY || "lm-studio";
    this.timeout = parseInt(process.env.LM_STUDIO_TIMEOUT || "30000");
  }
  
  // Connection management
  async checkConnection() { ... }
  
  // Model lifecycle
  async getAvailableModels() { ... }
  async loadModel(modelId) { ... }
  async unloadModel(modelId) { ... }
  async getCurrentModel() { ... }
  
  // Model filtering
  async getModelsByType(modelType) { ... }
  
  // Recommendations
  async recommendModel(taskType, dna) { ... }
  
  // Execution
  async executeChatCompletion(modelId, messages, params = {}) { ... }
  
  // Parallel loading
  async loadModelsParallel(modelIds, dna) { ... }
  
  // Hardware info
  getHardwareInfo() { ... }
}
```

#### Constructor Configuration

```javascript
constructor() {
  // Base URL for LM Studio API
  this.baseUrl = process.env.LM_STUDIO_BASE_URL || "http://localhost:1234/v1";
  
  // API key for authentication (optional)
  this.apiKey = process.env.LM_STUDIO_API_KEY || "lm-studio";
  
  // Request timeout in milliseconds
  this.timeout = parseInt(process.env.LM_STUDIO_TIMEOUT || "30000");
  
  // Cache for model list
  this._modelsCache = null;
  this._cacheTime = 0;
}
```

#### Connection Check

```javascript
/**
 * Check if LM Studio is accessible
 * @returns {Promise<boolean>} True if connection successful
 */
async checkConnection() {
  try {
    const response = await fetch(`${this.baseUrl}/models`, {
      method: "GET",
      signal: AbortSignal.timeout(this.timeout),
    });

    return response.ok;
  } catch (error) {
    console.error(`[LM Studio] Connection check failed: ${error.message}`);
    
    // Try alternative endpoint
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        signal: AbortSignal.timeout(this.timeout),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "dummy",
          messages: [{ role: "user", content: "test" }],
          max_tokens: 1
        })
      });
      
      // May fail with model not found, but connection is OK
      return response.ok || response.status === 404;
    } catch (e) {
      return false;
    }
  }
}
```

#### Getting Available Models

```javascript
/**
 * Get all available models from LM Studio
 * @returns {Promise<Array>} Array of model objects
 */
async getAvailableModels() {
  try {
    const response = await fetch(`${this.baseUrl}/models`, {
      method: "GET",
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    
    // Parse and validate model data
    return (data.data || []).map(model => ({
      id: model.id,
      object: model.object,
      created: model.created,
      owned_by: model.owned_by,
      type: model.type || "chat",
      state: model.state || "unloaded",
      max_context_length: model.max_context_length || 8192,
      loaded_context_length: model.loaded_context_length || 0
    }));
  } catch (error) {
    console.error(`[LM Studio] Failed to fetch models: ${error.message}`);
    return [];
  }
}
```

#### Model Loading

```javascript
/**
 * Load a model by ID
 * @param {string} modelId - The model identifier
 * @returns {Promise<Object>} Loading result with status
 */
async loadModel(modelId) {
  try {
    // Check if model is already loaded
    const models = await this.getAvailableModels();
    const existingModel = models.find(m => m.id === modelId);
    
    if (existingModel && existingModel.state === "loaded") {
      console.log(`[LM Studio] Model ${modelId} is already loaded`);
      
      return { 
        loaded: true, 
        modelId, 
        alreadyLoaded: true,
        contextLength: existingModel.loaded_context_length
      };
    }

    console.log(`[LM Studio] Loading model: ${modelId}`);

    // Attempt to load the model
    const response = await fetch(`${this.baseUrl}/models/load`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({ model: modelId }),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    console.log(`[LM Studio] Successfully loaded model: ${modelId}`);

    return { 
      loaded: true, 
      modelId,
      alreadyLoaded: false
    };
  } catch (error) {
    console.error(`[LM Studio] Failed to load model ${modelId}: ${error.message}`);
    
    return { 
      loaded: false, 
      error: error.message,
      modelId
    };
  }
}
```

#### Model Unloading

```javascript
/**
 * Unload a model by ID
 * Note: LM Studio v1 handles unloading automatically via context limits
 * @param {string} modelId - The model identifier
 * @returns {Promise<Object>} Unload result
 */
async unloadModel(modelId) {
  try {
    // LM Studio v1 doesn't have explicit unload endpoint
    // Models are automatically unloaded when context is exceeded
    
    console.log(`[LM Studio] Model ${modelId} would be unloaded`);
    
    return { 
      unloaded: true, 
      modelId,
      note: "Auto-unload handled by LM Studio context limits"
    };
  } catch (error) {
    console.error(`[LM Studio] Failed to unload model ${modelId}: ${error.message}`);
    
    return { 
      unloaded: false, 
      error: error.message
    };
  }
}
```

#### Getting Current Model

```javascript
/**
 * Get the currently loaded model
 * @returns {Promise<Object|null>} Current model info or null
 */
async getCurrentModel() {
  try {
    // Get all models and find the one that's loaded
    const models = await this.getAvailableModels();
    
    // Filter to only loaded models
    const loadedModel = models.find(m => m.state === "loaded");
    
    if (loadedModel) {
      return {
        id: loadedModel.id,
        type: loadedModel.type || "chat",
        contextLength: loadedModel.loaded_context_length
      };
    }
    
    return null;
  } catch (error) {
    console.error(`[LM Studio] Failed to get current model: ${error.message}`);
    
    return null;
  }
}
```

#### Getting Models by Type

```javascript
/**
 * Get models filtered by type (chat, vision)
 * @param {string} modelType - Model type filter
 * @returns {Promise<Array>} Filtered model array
 */
async getModelsByType(modelType) {
  const models = await this.getAvailableModels();
  
  if (modelType === "vision") {
    // Vision models typically have these patterns
    return models.filter(m => 
      m.type?.toLowerCase().includes("vision") || 
      m.id.toLowerCase().includes("vision") ||
      m.id.toLowerCase().includes("vl") ||        // Vision Language
      m.id.toLowerCase().includes("multimodal")
    );
  }

  // Non-vision models
  return models.filter(m => 
    !m.type?.toLowerCase().includes("vision") && 
    m.id.toLowerCase() !== "vision" &&
    !m.id.toLowerCase().includes("vl")
  );
}
```

#### Ratings-Based Model Recommendation

```javascript
/**
 * Recommend best model for a task based on ratings history
 * @param {string} taskType - The type of task to perform
 * @param {Object} dna - Model DNA configuration
 * @returns {Promise<Object>} Recommended model with rating info
 */
async recommendModel(taskType, dna) {
  const models = await this.getAvailableModels();
  
  if (models.length === 0) {
    return { 
      error: "No models available in LM Studio",
      suggestion: "Load at least one model via switch-model tool"
    };
  }

  // Get task-specific rating threshold
  const fallbackThreshold = dna?.fallbackStrategy?.ratingThreshold || 3.0;
  const maxAttempts = dna?.fallbackStrategy?.maxAttempts || 3;

  // Get models suitable for this task type
  const suitableModels = this.getSuitableModels(models, taskType);

  if (suitableModels.length === 0) {
    console.warn(`[Recommendation] No suitable models for task: ${taskType}`);
    
    // Fallback to first available model
    return { 
      model: models[0], 
      rating: null, 
      fallbackReason: "no suitable models found",
      recommended: true
    };
  }

  // Calculate average ratings for each model
  const ratedModels = suitableModels.map(model => ({
    model,
    rating: this.calculateAverageRating(model.id, taskType, dna),
  }));

  // Sort by rating (highest first)
  ratedModels.sort((a, b) => {
    const aRating = a.rating || 0;
    const bRating = b.rating || 0;
    
    // Models with more ratings get priority
    const aCount = this.getRatingCount(model.id, taskType, dna) || 0;
    const bCount = this.getRatingCount(model.id, taskType, dna) || 0;
    
    return (bRating - aRating) + (bCount - aCount) * 0.1;
  });

  // Check if best model meets threshold
  const bestModel = ratedModels[0];
  
  if (bestModel.rating === null || bestModel.rating >= fallbackThreshold) {
    console.log(`[Recommendation] Best model: ${bestModel.model.id} (rating: ${bestModel.rating})`);
    
    return { 
      model: bestModel.model, 
      rating: bestModel.rating,
      recommended: true
    };
  }

  // Fallback to next best model
  const fallbackModel = ratedModels[1] || ratedModels[0];
  
  console.log(`[Recommendation] Fallback: ${fallbackModel.model.id} (rating: ${fallbackModel.rating})`);
  
  return {
    model: fallbackModel.model,
    rating: fallbackModel.rating,
    fallbackReason: `Best model (${bestModel.model.id}) rating (${bestModel.rating}) below threshold (${fallbackThreshold})`,
    recommended: true,
    fallbackAttempted: true
  };
}
```

#### Getting Suitable Models for Task Type

```javascript
/**
 * Get models suitable for a specific task type
 * @param {Array} models - Available models
 * @param {string} taskType - Task type to match
 * @returns {Array} Filtered model array
 */
getSuitableModels(models, taskType) {
  const visionTasks = ["imageAnalysis", "visionAnalysis"];
  
  if (visionTasks.includes(taskType)) {
    return this.getModelsByType("vision");
  }

  // For code-related tasks, exclude vision models
  const codeTasks = ["codeFixes", "featureArchitecture", "codeExecution"];
  
  if (codeTasks.includes(taskType)) {
    return models.filter(m => 
      !m.type?.toLowerCase().includes("vision") ||
      m.id.toLowerCase() === "vision"
    );
  }

  // For general tasks, use all models
  return models;
}
```

#### Calculating Average Rating

```javascript
/**
 * Calculate average rating for a model on a task type
 * @param {string} modelId - Model identifier
 * @param {string} taskType - Task type
 * @param {Object} dna - Model DNA configuration
 * @returns {number|null} Average rating or null if no ratings
 */
calculateAverageRating(modelId, taskType, dna) {
  const effectiveness = dna?.usageStats?.modelEffectiveness || {};
  
  // Find ratings for this model/task combination
  for (const [role, taskRatings] of Object.entries(effectiveness)) {
    if (taskRatings[taskType]) {
      const ratings = taskRatings[taskType];
      
      if (ratings.length > 0) {
        const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
        return sum / ratings.length;
      }
    }
  }

  return null; // No ratings yet
}

/**
 * Get number of ratings for a model/task combination
 */
getRatingCount(modelId, taskType, dna) {
  const effectiveness = dna?.usageStats?.modelEffectiveness || {};
  
  for (const [role, taskRatings] of Object.entries(effectiveness)) {
    if (taskRatings[taskType]) {
      return taskRatings[taskType].length;
    }
  }

  return 0;
}
```

#### Parallel Model Loading

```javascript
/**
 * Load multiple models in parallel if hardware allows
 * @param {Array} modelIds - Array of model IDs to load
 * @param {Object} dna - Model DNA configuration
 * @returns {Promise<Array>} Array of load results
 */
async loadModelsParallel(modelIds, dna) {
  const limits = getParallelLimits(dna);
  
  console.log(`[Parallel Loading] maxModels: ${limits.maxModels}, parallelAllowed: ${limits.parallelAllowed}`);
  
  // Check if we need sequential loading
  if (!limits.parallelAllowed && modelIds.length > 1) {
    console.log(`[Parallel Loading] Sequential loading required (RAM < ${limits.minRam}GB)`);
  }

  const loadLimit = Math.min(modelIds.length, limits.maxModels);
  const modelsToLoad = modelIds.slice(0, loadLimit);

  if (limits.parallelAllowed && loadLimit > 1) {
    // Load in parallel using Promise.allSettled
    console.log(`[Parallel Loading] Loading ${modelsToLoad.length} models in parallel`);
    
    const promises = modelsToLoad.map(id => this.loadModel(id));
    return Promise.allSettled(promises);
  }

  // Sequential loading
  console.log(`[Parallel Loading] Loading ${modelsToLoad.length} models sequentially`);
  
  const results = [];
  for (const modelId of modelsToLoad) {
    const result = await this.loadModel(modelId);
    results.push(result);
  }
  
  return results;
}
```

#### Chat Completion Execution

```javascript
/**
 * Execute chat completions with a model
 * @param {string} modelId - Model identifier
 * @param {Array} messages - Array of message objects
 * @param {Object} params - Additional parameters
 * @returns {Promise<Object>} Completion result
 */
async executeChatCompletion(modelId, messages, params = {}) {
  try {
    console.log(`[LM Studio] Executing completion with model: ${modelId}`);
    
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages,
        temperature: params.temperature || 0.7,
        top_p: params.topP || 0.9,
        max_tokens: params.maxTokens || 4096,
        stream: false,
      }),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    // Validate response
    if (!data.choices || data.choices.length === 0) {
      return { 
        success: false, 
        error: "No choices in response",
        rawResponse: data
      };
    }

    const choice = data.choices[0];
    
    return {
      success: true,
      content: choice.message.content,
      usage: data.usage,
      finishReason: choice.finish_reason,
    };
  } catch (error) {
    console.error(`[LM Studio] Chat completion failed: ${error.message}`);
    
    return { 
      success: false, 
      error: error.message,
      modelId
    };
  }
}
```

#### Hardware Information

```javascript
/**
 * Get hardware information for parallel loading decisions
 * @returns {Object} Hardware info object
 */
getHardwareInfo() {
  const ram = detectSystemRAM();
  
  return {
    totalRamGB: ram,
    canLoadParallel: canLoadModelsInParallel(),
    parallelLimit: getParallelLimits().maxModels,
    minRamForParallel: 64,      // GB
    recommendedRam: 256,        // GB
  };
}
```

#### Export Singleton

```javascript
// Export singleton instance
export const lmStudioSwitcher = new LmStudioSwitcher();
```

---

### 2. hardware-detector.js

**Purpose:** Detects system RAM and determines parallel loading capabilities.

#### System RAM Detection

```javascript
import { execSync } from "child_process";

/**
 * Detect system RAM in GB
 * Tries multiple methods for cross-platform compatibility
 * @returns {number|null} RAM in GB or null if detection fails
 */
export function detectSystemRAM() {
  // Method 1: Node.js os module (most reliable)
  try {
    const totalMem = require("os").totalmem();
    const ramGB = Math.round(totalMem / (1024 * 1024 * 1024));
    
    if (ramGB > 0) {
      console.log(`[Hardware] Node.js os.totalmem(): ${ramGB} GB`);
      return ramGB;
    }
  } catch (err) {
    console.log(`[Hardware] Node.js os module not available: ${err.message}`);
  }

  // Method 2: macOS sysctl
  try {
    const output = execSync("sysctl -n hw.memsize 2>/dev/null", { 
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    
    const ramBytes = parseInt(output.trim(), 10);
    if (ramBytes > 0) {
      const ramGB = Math.round(ramBytes / (1024 * 1024 * 1024));
      console.log(`[Hardware] macOS sysctl: ${ramGB} GB`);
      return ramGB;
    }
  } catch (err) {
    // macOS sysctl not available
  }

  // Method 3: Linux /proc/meminfo
  try {
    const output = execSync("grep MemTotal /proc/meminfo | awk '{print $2}'", { 
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    
    const ramKB = parseInt(output.trim(), 10);
    if (ramKB > 0) {
      const ramGB = Math.round(ramKB / 1024); // KB to GB
      console.log(`[Hardware] Linux proc: ${ramGB} GB`);
      return ramGB;
    }
  } catch (err) {
    // Linux proc not available
  }

  // Method 4: Windows PowerShell
  try {
    const output = execSync(
      "powershell -Command \"Get-CimInstance Win32_ComputerSystem | Select-Object -ExpandProperty TotalPhysicalMemory\"",
      { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }
    );
    
    const ramBytes = parseInt(output.trim(), 10);
    if (ramBytes > 0) {
      const ramGB = Math.round(ramBytes / (1024 * 1024 * 1024));
      console.log(`[Hardware] Windows PowerShell: ${ramGB} GB`);
      return ramGB;
    }
  } catch (err) {
    // Windows not available
  }

  console.warn("[Hardware] RAM detection failed");
  return null; // Unknown
}

/**
 * Detect system RAM and cache the result
 */
let _cachedRAM = null;
let _cacheTime = 0;

export function detectSystemRAMCached() {
  const now = Date.now();
  
  // Cache for 5 minutes
  if (_cachedRAM !== null && (now - _cacheTime) < 300000) {
    return _cachedRAM;
  }
  
  _cachedRAM = detectSystemRAM();
  _cacheTime = now;
  
  return _cachedRAM;
}
```

#### Parallel Loading Decision

```javascript
/**
 * Check if parallel loading is allowed based on hardware profile
 * @param {Object} dna - Model DNA configuration
 * @returns {boolean} True if parallel loading is allowed
 */
export function canLoadModelsInParallel(dna) {
  const ram = detectSystemRAMCached();
  
  if (ram === null) return false; // Can't determine, be conservative

  const minRam = dna?.hardwareProfile?.minRamForParallel || 64;
  
  return ram >= minRam;
}

/**
 * Get parallel loading limits based on hardware
 * @param {Object} dna - Model DNA configuration
 * @returns {Object} Limits object with maxModels and parallelAllowed
 */
export function getParallelLimits(dna) {
  const ram = detectSystemRAMCached();
  
  if (ram === null) {
    return { maxModels: 1, parallelAllowed: false };
  }

  const recommendedRam = dna?.hardwareProfile?.recommendedRam || 256;
  const maxParallel = dna?.hardwareProfile?.maxParallelModels || 3;

  // Hardware tiers
  if (ram < 64) {
    console.log(`[Parallel Limits] RAM: ${ram}GB - No parallel loading allowed`);
    return { maxModels: 1, parallelAllowed: false };
  }

  if (ram >= recommendedRam) {
    console.log(`[Parallel Limits] RAM: ${ram}GB - Full parallel loading allowed`);
    return { maxModels: Math.max(3, maxParallel), parallelAllowed: true };
  }

  // Between 64GB and recommended
  const midParallel = Math.max(2, Math.floor(maxParallel / 2));
  console.log(`[Parallel Limits] RAM: ${ram}GB - Partial parallel loading (max: ${midParallel})`);
  
  return { maxModels: midParallel, parallelAllowed: true };
}

/**
 * Check if system has enough RAM for a given number of models
 * @param {number} modelCount - Number of models to load
 * @param {Object} dna - Model DNA configuration
 * @returns {boolean} True if sufficient RAM
 */
export function hasSufficientRAM(modelCount, dna) {
  const limits = getParallelLimits(dna);
  
  return modelCount <= limits.maxModels;
}
```

#### Hardware Tier Configuration

```javascript
/**
 * Get hardware tier based on RAM
 * @param {number} ramGB - System RAM in GB
 * @returns {Object} Tier configuration
 */
export function getHardwareTier(ramGB) {
  if (ramGB === null) {
    return { name: "unknown", maxModels: 1, parallel: false };
  }

  if (ramGB < 32) {
    return { 
      name: "low-memory", 
      maxModels: 1, 
      parallel: false,
      warning: "Limited RAM - sequential loading only"
    };
  }

  if (ramGB < 64) {
    return { 
      name: "entry-level", 
      maxModels: 1, 
      parallel: false,
      note: "Consider upgrading for parallel loading"
    };
  }

  if (ramGB < 128) {
    return { 
      name: "mid-tier", 
      maxModels: 2, 
      parallel: true,
      note: "Good for dual-model loading"
    };
  }

  if (ramGB < 256) {
    return { 
      name: "high-tier", 
      maxModels: 3, 
      parallel: true,
      note: "Excellent for multi-model workflows"
    };
  }

  return { 
    name: "ultra-tier", 
    maxModels: Math.max(3, 4), 
    parallel: true,
    note: "Maximum parallel loading enabled"
  };
}
```

---

## Integration Points

### With DNA System

The switcher service uses the DNA system for:

1. **Ratings-based recommendations** - `dna.usageStats.modelEffectiveness`
2. **Hardware profile** - `dna.hardwareProfile`
3. **Fallback strategy** - `dna.fallbackStrategy`

```javascript
import { loadModelDNA } from '../utils/model-dna-manager.js';

// Load DNA for recommendations
const dna = loadModelDNA();
const recommendation = await lmStudioSwitcher.recommendModel(taskType, dna);
```

### With Task Dispatcher

```javascript
import { taskDispatcher } from '../services/task-dispatcher.js';
import { lmStudioSwitcher } from './lm-studio-switcher.js';

// Task dispatcher uses switcher for model loading
async executeTask(query, dna) {
  const classification = classifyTask(query);
  const recommendation = await lmStudioSwitcher.recommendModel(taskType, dna);
  
  // Load recommended model
  const loadResult = await lmStudioSwitcher.loadModel(recommendation.model.id);
}
```

### With MCP Integration Adapters

```javascript
import { webSearchAdapter } from './integrations/web-search-adapter.js';
import { context7Adapter } from './integrations/context7-adapter.js';

// Check if integrations are enabled
if (dna.mcpIntegrations?.webSearch) {
  await webSearchAdapter.search(query);
}
```

---

## Testing Strategy

### Unit Tests for lm-studio-switcher.js

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('LM Studio Switcher', () => {
  let switcher;
  
  beforeEach(() => {
    switcher = new LmStudioSwitcher();
    
    // Mock fetch
    global.fetch = vi.fn();
  });

  describe('loadModel()', () => {
    it('should load a model successfully', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({})
      });

      const result = await switcher.loadModel('test-model');
      
      assert.strictEqual(result.loaded, true);
    });

    it('should return alreadyLoaded when model is loaded', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{
            id: 'test-model',
            state: 'loaded'
          }]
        })
      });

      const result = await switcher.loadModel('test-model');
      
      assert.strictEqual(result.alreadyLoaded, true);
    });
  });

  describe('recommendModel()', () => {
    it('should recommend best rated model', async () => {
      const dna = {
        usageStats: {
          modelEffectiveness: {
            testModel: {
              codeFixes: [{ rating: 5 }]
            }
          }
        },
        fallbackStrategy: { ratingThreshold: 3.0 }
      };

      const models = [
        { id: 'testModel', type: 'chat' },
        { id: 'otherModel', type: 'chat' }
      ];

      // Mock getAvailableModels
      switcher.getAvailableModels = async () => models;

      const result = await switcher.recommendModel('codeFixes', dna);
      
      assert.ok(result.model);
    });
  });
});
```

### Integration Tests

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Model Switcher Integration', () => {
  describe('Full Task Flow', () => {
    it('should complete full task with model switching', async () => {
      // 1. Load DNA
      const dna = loadModelDNA();
      
      // 2. Get recommendation
      const recommendation = await lmStudioSwitcher.recommendModel(
        'codeFixes',
        dna
      );
      
      assert.ok(recommendation.model);
      
      // 3. Load model
      const loadResult = await lmStudioSwitcher.loadModel(
        recommendation.model.id
      );
      
      assert.strictEqual(loadResult.loaded, true);
    });
  });
});
```

---

## Configuration

### Environment Variables

```bash
# LM Studio API configuration
LM_STUDIO_BASE_URL=http://localhost:1234/v1
LM_STUDIO_API_KEY=lm-studio
LM_STUDIO_TIMEOUT=30000

# Hardware configuration (optional)
HARDWARE_MIN_RAM=64
HARDWARE_RECOMMENDED_RAM=256
```

### DNA Configuration

```json
{
  "hardwareProfile": {
    "minRamForParallel": 64,
    "recommendedRam": 256,
    "maxParallelModels": 3
  },
  "fallbackStrategy": {
    "ratingThreshold": 3.0,
    "maxAttempts": 3
  }
}
```

---

## Performance Considerations

### Caching Strategy

```javascript
// Cache models for 30 seconds
this._modelsCache = null;
this._cacheTime = 0;

async getAvailableModels() {
  const now = Date.now();
  
  if (this._modelsCache && (now - this._cacheTime) < 30000) {
    return this._modelsCache;
  }
  
  // Refresh cache
  const models = await this.fetchModelsFromAPI();
  this._modelsCache = models;
  this._cacheTime = now;
  
  return models;
}
```

### Timeout Handling

```javascript
// Always use abort signals for fetch calls
const response = await fetch(url, {
  signal: AbortSignal.timeout(this.timeout)
});

// Handle timeout gracefully
catch (error) {
  if (error.name === 'AbortError') {
    return { error: 'Request timed out' };
  }
}
```

---

## Future Enhancements

- [ ] Model warm-up based on predicted usage
- [ ] Adaptive parallel loading based on model size
- [ ] Memory pressure monitoring and automatic unloading
- [ ] Model version tracking and compatibility checks

---

## Phase 2 Marketplace Distribution Checklist

This phase focuses on ensuring the Model Switching Service meets Cline MCP Marketplace quality standards.

### Code Quality Requirements
- [ ] Async/await used consistently for asynchronous operations
- [ ] Error handling is comprehensive with try/catch blocks
- [ ] Timeouts properly configured to prevent hanging
- [ ] Cross-platform compatibility (macOS, Linux, Windows)
- [ ] Memory management respects LM Studio's auto-unload
- [ ] Singleton pattern used for shared service instance

### Documentation Requirements
- [ ] Each function has clear JSDoc comments
- [ ] Parameter types and return values documented
- [ ] Error conditions and edge cases explained
- [ ] Hardware detection fallbacks are documented
- [ ] Environment variables are listed with defaults

### Distribution Considerations
- [ ] `lm-studio-switcher.js` works with LM Studio v1 API
- [ ] Hardware detection handles all platforms (macOS, Linux, Windows)
- [ ] Parallel loading respects system RAM (64GB+ threshold)
- [ ] Fallback strategy is robust with 3+ attempts
- [ ] Connection checking is resilient to transient failures

### Integration Testing
- [ ] Test with LM Studio running on localhost:1234
- [ ] Verify model loading/unloading sequence
- [ ] Test fallback when preferred model fails
- [ ] Validate parallel loading on 64GB+ RAM systems
- [ ] Confirm ratings-based recommendations work

### Next Steps
When Phase 2 is complete, proceed to:
1. **Phase 3** - Task Dispatcher (intent classification)
2. **Phase 4** - Tools Implementation (MCP server tools)
3. **Phase 5** - Evolution & Auto-Optimization (usage tracking)
4. **Phase 6** - Complete marketplace submission guide

### See Also
- [Cline MCP Marketplace](https://github.com/cline/mcp-marketplace)
- [Phase 1: Core DNA System](phase-1-core-dna-system.md)
- [Complete Submission Guide](phase-6-marketplace-submission.md) (to be created in Phase 5)