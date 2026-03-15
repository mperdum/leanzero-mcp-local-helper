# Phase 2: Model Switching Service

## Overview

The Model Switching Service provides intelligent model management for LM Studio, including automatic model loading/unloading based on hardware capabilities, effectiveness-based recommendations, and streaming chat completion support.

**Key Features:**
- **LM Studio v1 API Integration** - Uses `/api/v1/models` and `/api/v1/chat` endpoints
- **Hardware-Aware Loading** - Respects RAM limits for parallel model loading
- **Effectiveness-Based Recommendations** - Chooses models based on historical ratings
- **Streaming Support** - SSE-based streaming chat completion with event callbacks
- **Instance Tracking** - Manages loaded model instances with automatic cleanup

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  LMStudioSwitcher Class                     │
├─────────────────────────────────────────────────────────────┤
│  Model Lifecycle Management                                  │
│  ├── loadModel() - Load model with hardware checks          │
│  ├── unloadModel() - Unload by instance ID or model key     │
│  └── getLoadedModels() - Track loaded instances             │
├─────────────────────────────────────────────────────────────┤
│  Chat Completion                                             │
│  ├── executeChatCompletion() - Standard completion          │
│  └── streamChatCompletion() - SSE streaming with callbacks  │
├─────────────────────────────────────────────────────────────┤
│  Model Recommendations                                       │
│  ├── recommendModel() - DNA-based model selection           │
│  └── calculateModelScore() - Multi-factor scoring           │
├─────────────────────────────────────────────────────────────┤
│  Health Monitoring                                           │
│  ├── checkConnection() - LM Studio connectivity             │
│  └── startHealthChecks() - Periodic health polling          │
└─────────────────────────────────────────────────────────────┘
                        ↓
              ┌──────────────────────┐
│ HardwareDetector (Hardware-aware limits) │
├──────────────────────┤
│  ├── detectTotalRAM()                    │
│  ├── getParallelLoadLimit()              │
│  └── getHardwareTier()                   │
└──────────────────────┘
```

---

## File Structure

```
src/
├── services/
│   └── lm-studio-switcher.js    # Main model switching service (~700 lines)
└── utils/
    └── hardware-detector.js     # Hardware detection utility (~350 lines)
```

---

## LM Studio v1 API Reference

### Base URL Configuration

```javascript
const lmStudioBaseUrl = process.env.LM_STUDIO_URL || 'http://localhost:1234';
```

**Environment Variables:**
| Variable | Default | Description |
|----------|---------|-------------|
| `LM_STUDIO_URL` | `http://localhost:1234` | LM Studio server URL |
| `MAX_RETRIES` | `3` | Retry attempts for failed requests |
| `RETRY_DELAY` | `1000` | Delay between retries (ms) |
| `REQUEST_TIMEOUT` | `30000` | Request timeout (ms) |
| `HEALTH_CHECK_INTERVAL` | `30000` | Health check interval (ms) |

### API Endpoints

#### 1. List Models (`GET /api/v1/models`)

Returns all available models with their loaded instances:

```json
{
  "models": [
    {
      "key": "lmstudio-community/Llama-3.2-3B-Instruct-GGUF",
      "display_name": "Llama 3.2 3B Instruct",
      "capabilities": {
        "vision": false,
        "trained_for_tool_use": true
      },
      "loaded_instances": [
        {
          "id": "instance-abc123",
          "config": {
            "context_length": 8192,
            "flash_attention": true
          }
        }
      ]
    }
  ]
}
```

#### 2. Load Model (`POST /api/v1/models/load`)

Load a model into memory:

**Request:**
```json
{
  "model": "lmstudio-community/Llama-3.2-3B-Instruct-GGUF",
  "context_length": 8192,
  "flash_attention": true
}
```

**Response:**
```json
{
  "instance_id": "instance-abc123",
  "load_time_seconds": 4.5,
  "load_config": {
    "context_length": 8192,
    "flash_attention": true
  }
}
```

#### 3. Unload Model (`POST /api/v1/models/unload`)

Unload a model instance:

**Request:**
```json
{
  "instance_id": "instance-abc123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Model unloaded successfully"
}
```

#### 4. Chat Completion (`POST /api/v1/chat`)

Execute chat completion (non-streaming):

**Request:**
```json
{
  "model": "lmstudio-community/Llama-3.2-3B-Instruct-GGUF",
  "input": [
    {
      "role": "user",
      "content": "What is the capital of France?"
    }
  ],
  "stream": false,
  "temperature": 0.7,
  "max_output_tokens": 4096,
  "system_prompt": "You are a helpful assistant."
}
```

**Response:**
```json
{
  "response_id": "resp-xyz789",
  "output": [
    {
      "type": "message",
      "content": "The capital of France is Paris."
    }
  ],
  "stats": {
    "input_tokens": 15,
    "total_output_tokens": 12,
    "reasoning_output_tokens": 0,
    "tokens_per_second": 45.3,
    "model_load_time_seconds": 0.0,
    "stop_reason": "stop_sequence"
  }
}
```

#### 5. Streaming Chat Completion (`POST /api/v1/chat` with `stream: true`)

Execute streaming chat completion via Server-Sent Events (SSE):

**Request:**
```json
{
  "model": "lmstudio-community/Llama-3.2-3B-Instruct-GGUF",
  "input": [
    {
      "role": "user",
      "content": "Explain quantum computing."
    }
  ],
  "stream": true,
  "temperature": 0.7
}
```

**SSE Events:**
```sse
event: chat.start
data: {"model_instance_id":"instance-abc123","response_id":"resp-xyz789"}

event: message.start
data: {}

event: message.delta
data: {"content":"Quantum"}

event: message.delta
data: {"content":" computing"}

event: message.delta
data: {"content":" is a type of computing..."}

event: message.end
data: {}

event: chat.end
data: {
  "result": {
    "response_id": "resp-xyz789",
    "stats": {
      "input_tokens": 10,
      "total_output_tokens": 256,
      "tokens_per_second": 32.1,
      "stop_reason": "stop_sequence"
    }
  }
}

data: [DONE]
```

**Supported SSE Event Types:**
| Event Type | Description |
|------------|-------------|
| `chat.start` | Chat session started |
| `model_load.start` | Model loading initiated |
| `model_load.progress` | Loading progress update |
| `model_load.end` | Model loaded successfully |
| `reasoning.start` | Reasoning phase started (for reasoning models) |
| `reasoning.delta` | Reasoning content chunk |
| `reasoning.end` | Reasoning complete |
| `message.start` | Message generation started |
| `message.delta` | Message content chunk |
| `message.end` | Message complete |
| `tool_call.start` | Tool invocation started |
| `tool_call.arguments` | Tool arguments being built |
| `tool_call.success` | Tool call succeeded |
| `tool_call.failure` | Tool call failed |
| `chat.end` | Chat session ended with final stats |

---

## LMStudioSwitcher Class Implementation

### Constructor and Initialization

```javascript
export class LMStudioSwitcher {
  constructor() {
    this.lmStudioBaseUrl = process.env.LM_STUDIO_URL || 'http://localhost:1234';
    this.maxRetries = parseInt(process.env.MAX_RETRIES || '3');
    this.retryDelay = parseInt(process.env.RETRY_DELAY || '1000');
    this.requestTimeout = parseInt(process.env.REQUEST_TIMEOUT || '30000');
    this.healthCheckInterval = parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000');
    
    // Connection state
    this._isConnected = false;
    this._connectionError = null;
    
    // Model tracking (in-memory cache of loaded instances)
    this._loadedModels = new Map(); // instanceId -> { modelId, instanceId, loadedAt, config }
    
    // Caching
    this._recommendationCache = new Map();
    this.CACHE_TTL = 30000; // 30 seconds
    this._modelsCache = null;
    this._cacheTime = 0;
    
    // Health check timer
    this._healthCheckTimer = null;
    
    // Bind methods for use in callbacks
    this.checkConnection = this.checkConnection.bind(this);
    this.executeChatCompletion = this.executeChatCompletion.bind(this);
    this.streamChatCompletion = this.streamChatCompletion.bind(this);
  }

  async initialize() {
    console.log(`[LMStudio] Initializing switcher...`);
    
    const connected = await this.checkConnection();
    
    if (!connected) {
      console.error(`[LMStudio] Failed to connect to LM Studio at ${this.lmStudioBaseUrl}`);
      this._connectionError = new Error('Cannot connect to LM Studio');
    } else {
      console.log(`[LMStudio] Connected successfully`);
      this.startHealthChecks();
      await this.refreshLoadedModels();
    }
    
    return connected;
  }
}
```

### Connection Management

```javascript
async checkConnection() {
  try {
    if (this._connectionError && !this._isConnected) {
      return false;
    }
    
    const response = await fetch(`${this.lmStudioBaseUrl}/api/v1/models`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    
    if (response.ok) {
      this._isConnected = true;
      this._connectionError = null;
      return true;
    } else {
      this._isConnected = false;
      const errorText = await response.text();
      this._connectionError = new Error(`HTTP ${response.status}: ${errorText}`);
      return false;
    }
  } catch (error) {
    this._isConnected = false;
    this._connectionError = error;
    return false;
  }
}

startHealthChecks() {
  if (this._healthCheckTimer) {
    clearInterval(this._healthCheckTimer);
  }
  
  this._healthCheckTimer = setInterval(async () => {
    const connected = await this.checkConnection();
    
    if (!connected) {
      console.warn(`[LMStudio] Health check failed: ${this._connectionError?.message}`);
      this._loadedModels.clear();
      this._modelsCache = null;
    } else {
      await this.refreshLoadedModels();
    }
  }, this.healthCheckInterval);
}

stopHealthChecks() {
  if (this._healthCheckTimer) {
    clearInterval(this._healthCheckTimer);
    this._healthCheckTimer = null;
  }
}
```

### Model Lifecycle Management

#### Get Available Models

```javascript
async getAvailableModels() {
  const now = Date.now();
  
  // Return cached models if still fresh (30s cache)
  if (this._modelsCache && (now - this._cacheTime) < 30000) {
    return this._modelsCache;
  }
  
  try {
    const response = await this.retry(async () => {
      return await fetch(`${this.lmStudioBaseUrl}/api/v1/models`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch models: HTTP ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    const models = data.models || [];
    
    console.log(`[LMStudio] Found ${models.length} available models`);
    
    // Update cache
    this._modelsCache = models;
    this._cacheTime = now;
    
    // Update loaded models cache based on loaded_instances
    this._loadedModels.clear();
    models.forEach(model => {
      if (model.loaded_instances && Array.isArray(model.loaded_instances)) {
        model.loaded_instances.forEach(instance => {
          this._loadedModels.set(instance.id, {
            modelId: model.key,
            instanceId: instance.id,
            loadedAt: new Date().toISOString(),
            config: instance.config,
            purpose: null,
          });
        });
      }
    });
    
    return models;
  } catch (error) {
    console.error(`[LMStudio] getAvailableModels failed: ${error.message}`);
    return [];
  }
}

async getLoadedModels() {
  const models = await this.getAvailableModels();
  const loaded = [];
  
  models.forEach(model => {
    if (model.loaded_instances && Array.isArray(model.loaded_instances)) {
      model.loaded_instances.forEach(instance => {
        loaded.push({
          modelKey: model.key,
          displayName: model.display_name,
          instanceId: instance.id,
          config: instance.config,
        });
      });
    }
  });
  
  return loaded;
}

async getCurrentModel() {
  // First check in-memory cache (fast path)
  if (this._loadedModels.size > 0) {
    const firstLoaded = this._loadedModels.values().next().value;
    return {
      modelId: firstLoaded.modelId,
      instanceId: firstLoaded.instanceId,
      config: firstLoaded.config,
    };
  }
  
  // Fall back to API check
  const loaded = await this.getLoadedModels();
  
  if (loaded.length > 0) {
    return {
      modelId: loaded[0].modelKey,
      displayName: loaded[0].displayName,
      instanceId: loaded[0].instanceId,
      config: loaded[0].config,
    };
  }
  
  return null;
}
```

#### Load Model (with Hardware-Aware Limits)

```javascript
async loadModel(modelId, options = {}) {
  console.log(`[LMStudio] Loading model: ${modelId}`);
  
  try {
    // Check in-memory cache first (fast path - no API call!)
    for (const cached of this._loadedModels.values()) {
      if (cached.modelId === modelId || cached.instanceId === modelId) {
        console.log(`[LMStudio] Model ${modelId} already loaded (cached: ${cached.instanceId})`);
        return {
          loaded: true,
          alreadyLoaded: true,
          modelId,
          instanceId: cached.instanceId,
        };
      }
    }
    
    // Check hardware limits before loading
    const parallelLimit = await hardwareDetector.getParallelLoadLimit();
    const currentLoadedCount = this._loadedModels.size;
    
    if (currentLoadedCount >= parallelLimit) {
      console.warn(`[LMStudio] Parallel limit (${parallelLimit}) reached. Unloading oldest model.`);
      
      // Get oldest loaded model from cache and unload it
      if (this._loadedModels.size > 0) {
        const oldestEntry = this._loadedModels.values().next().value;
        const unloadResult = await this.unloadModel(oldestEntry.instanceId, false);
        if (!unloadResult.unloaded) {
          console.warn(`[LMStudio] Failed to unload oldest model: ${unloadResult.error}`);
        }
      }
    }
    
    // Prepare load request payload
    const loadPayload = {
      model: modelId,
      ...options,
    };
    
    // Load model via LM Studio v1 API
    const response = await this.retry(async () => {
      return await fetch(`${this.lmStudioBaseUrl}/api/v1/models/load`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.LM_STUDIO_API_KEY || ''}`,
        },
        body: JSON.stringify(loadPayload),
      });
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to load model: ${response.status} - ${errorText}`);
    }
    
    const loadData = await response.json();
    
    // Track loaded model instance in cache
    if (loadData.instance_id) {
      this._loadedModels.set(loadData.instance_id, {
        modelId,
        instanceId: loadData.instance_id,
        loadedAt: new Date().toISOString(),
        config: loadData.load_config || options,
        purpose: null,
      });
    }
    
    console.log(`[LMStudio] Model ${modelId} loaded successfully (instance: ${loadData.instance_id}, time: ${loadData.load_time_seconds}s)`);
    
    return {
      loaded: true,
      modelId,
      instanceId: loadData.instance_id,
      alreadyLoaded: false,
      loadTime: loadData.load_time_seconds,
    };
  } catch (error) {
    console.error(`[LMStudio] Failed to load model ${modelId}: ${error.message}`);
    
    return {
      loaded: false,
      modelId,
      error: error.message,
    };
  }
}
```

#### Unload Model

```javascript
async unloadModel(modelId, failIfNotFound = true) {
  console.log(`[LMStudio] Unloading model: ${modelId}`);
  
  try {
    let instanceId = modelId;
    
    // Resolve instance ID from model key if needed
    if (!this._loadedModels.has(modelId)) {
      let found = null;
      for (const cached of this._loadedModels.values()) {
        if (cached.modelId === modelId || cached.instanceId === modelId) {
          found = cached;
          break;
        }
      }
      
      if (found) {
        instanceId = found.instanceId;
      } else {
        console.log(`[LMStudio] Model ${modelId} is not currently loaded`);
        
        if (failIfNotFound) {
          return {
            unloaded: false,
            modelId,
            error: 'Model not found in loaded models',
          };
        } else {
          return {
            unloaded: true,
            modelId,
            note: 'Model was not loaded',
          };
        }
      }
    }
    
    // Unload via LM Studio v1 API
    const response = await fetch(`${this.lmStudioBaseUrl}/api/v1/models/unload`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LM_STUDIO_API_KEY || ''}`,
      },
      body: JSON.stringify({ instance_id: instanceId }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to unload model: ${response.status} - ${errorText}`);
    }
    
    // Remove from cache
    this._loadedModels.delete(instanceId);
    
    console.log(`[LMStudio] Model ${modelId} (instance: ${instanceId}) unloaded successfully`);
    
    return {
      unloaded: true,
      modelId,
      instanceId,
    };
  } catch (error) {
    console.error(`[LMStudio] Failed to unload model ${modelId}: ${error.message}`);
    
    return {
      unloaded: false,
      modelId,
      error: error.message,
    };
  }
}

async refreshLoadedModels() {
  try {
    await this.getAvailableModels();
  } catch (error) {
    console.warn(`[LMStudio] Failed to refresh loaded models: ${error.message}`);
  }
}
```

### Chat Completion Methods

#### Standard Chat Completion

```javascript
async executeChatCompletion(modelId, input, options = {}) {
  const startTime = Date.now();
  
  try {
    // Check in-memory cache first (fast path)
    let isModelLoaded = false;
    for (const cached of this._loadedModels.values()) {
      if (cached.modelId === modelId || cached.instanceId === modelId) {
        isModelLoaded = true;
        break;
      }
    }
    
    // If not in cache, try loading
    if (!isModelLoaded) {
      const loadResult = await this.loadModel(modelId);
      
      if (!loadResult.loaded) {
        return {
          success: false,
          error: `Failed to load model ${modelId}: ${loadResult.error}`,
          modelId,
        };
      }
    }
    
    // Prepare request payload (LM Studio v1 API format)
    const payload = {
      model: modelId,
      input: input,
      stream: false,
      temperature: options.temperature ?? 0.7,
    };
    
    // Optional parameters
    if (options.system_prompt) payload.system_prompt = options.system_prompt;
    if (options.max_output_tokens) payload.max_output_tokens = options.max_output_tokens;
    if (options.context_length) payload.context_length = options.context_length;
    if (options.previous_response_id) payload.previous_response_id = options.previous_response_id;
    if (options.ttl) payload.ttl = options.ttl;
    if (options.reasoning) payload.reasoning = options.reasoning;
    
    // MCP Integrations (plugins and ephemeral MCP servers)
    if (options.integrations && Array.isArray(options.integrations)) {
      payload.integrations = options.integrations;
    }
    
    console.log(`[LMStudio] Executing completion with ${modelId}`);
    
    // Execute request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);
    
    try {
      const response = await fetch(`${this.lmStudioBaseUrl}/api/v1/chat`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.LM_STUDIO_API_KEY || ''}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Completion failed: HTTP ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      
      // Parse LM Studio v1 response format
      const output = data.output || [];
      const messageOutput = output.find(item => item.type === 'message');
      const content = messageOutput?.content || '';
      
      const stats = data.stats || {};
      const duration = Date.now() - startTime;
      
      console.log(`[LMStudio] Completion done in ${duration}ms`);
      
      // Record effectiveness for future recommendations
      if (options.taskType && options.rating) {
        recordEffectivenessRating(modelId, options.taskType, options.rating);
      }
      
      return {
        success: true,
        modelId,
        result: {
          content,
          finishReason: stats.stop_reason || null,
          usage: {
            prompt_tokens: stats.input_tokens,
            completion_tokens: stats.total_output_tokens,
            reasoning_tokens: stats.reasoning_output_tokens,
            total_tokens: (stats.input_tokens || 0) + (stats.total_output_tokens || 0),
          },
          tokensPerSecond: stats.tokens_per_second,
          modelLoadTime: stats.model_load_time_seconds,
        },
        responseId: data.response_id,
        duration,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error(`[LMStudio] Completion failed for ${modelId}: ${error.message}`);
    
    return {
      success: false,
      modelId,
      error: error.message,
      duration: Date.now() - startTime,
    };
  }
}
```

#### Streaming Chat Completion (SSE)

```javascript
async streamChatCompletion(modelId, input, options = {}) {
  const startTime = Date.now();
  
  try {
    // Check in-memory cache first
    let isModelLoaded = false;
    for (const cached of this._loadedModels.values()) {
      if (cached.modelId === modelId || cached.instanceId === modelId) {
        isModelLoaded = true;
        break;
      }
    }
    
    // If not in cache, try loading
    if (!isModelLoaded) {
      const loadResult = await this.loadModel(modelId);
      
      if (!loadResult.loaded) {
        return {
          success: false,
          error: `Failed to load model ${modelId}: ${loadResult.error}`,
          modelId,
        };
      }
    }
    
    // Prepare request payload with stream=true
    const payload = {
      model: modelId,
      input: input,
      stream: true,
      temperature: options.temperature ?? 0.7,
    };
    
    if (options.system_prompt) payload.system_prompt = options.system_prompt;
    if (options.max_output_tokens) payload.max_output_tokens = options.max_output_tokens;
    if (options.context_length) payload.context_length = options.context_length;
    if (options.previous_response_id) payload.previous_response_id = options.previous_response_id;
    if (options.reasoning) payload.reasoning = options.reasoning;
    if (options.integrations) payload.integrations = options.integrations;
    
    console.log(`[LMStudio] Streaming completion with ${modelId}`);
    
    const response = await fetch(`${this.lmStudioBaseUrl}/api/v1/chat`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LM_STUDIO_API_KEY || ''}`,
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Streaming failed: HTTP ${response.status} - ${errorText}`);
    }
    
    // Check for SSE content type
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/event-stream')) {
      throw new Error('Expected SSE stream response');
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalContent = '';
    let finalResponseId = null;
    let finalStats = {};
    let eventCount = 0;
    
    // Process SSE stream
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.startsWith('event:')) {
            const eventType = line.substring(6).trim();
          } else if (line.startsWith('data:')) {
            const data = line.substring(5).trim();
            
            if (data === '[DONE]') continue;
            
            try {
              const eventData = JSON.parse(data);
              const eventType = eventData.type;
              eventCount++;
              
              // Emit event to callback
              if (options.onEvent) {
                options.onEvent(eventType, eventData);
              }
              
              // Handle specific event types
              switch (eventType) {
                case 'chat.start':
                  console.log(`[LMStudio] Stream started`);
                  break;
                  
                case 'model_load.progress':
                  console.log(`[LMStudio] Model load progress: ${(eventData.progress * 100).toFixed(0)}%`);
                  break;
                  
                case 'reasoning.delta':
                  finalContent += eventData.content;
                  if (options.onMessage) {
                    options.onMessage(eventData.content, { type: 'reasoning' });
                  }
                  break;
                  
                case 'message.delta':
                  finalContent += eventData.content;
                  if (options.onMessage) {
                    options.onMessage(eventData.content, { type: 'message' });
                  }
                  break;
                  
                case 'chat.end':
                  finalResponseId = eventData.result.response_id;
                  finalStats = eventData.result.stats || {};
                  console.log(`[LMStudio] Stream complete (${finalStats.total_output_tokens || 0} tokens)`);
                  break;
              }
            } catch (parseError) {
              console.warn(`[LMStudio] Failed to parse SSE data:`, data);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
    
    const duration = Date.now() - startTime;
    
    return {
      success: true,
      modelId,
      result: {
        content: finalContent,
        finishReason: finalStats.stop_reason || null,
        usage: {
          prompt_tokens: finalStats.input_tokens,
          completion_tokens: finalStats.total_output_tokens,
          reasoning_tokens: finalStats.reasoning_output_tokens,
          total_tokens: (finalStats.input_tokens || 0) + (finalStats.total_output_tokens || 0),
        },
        tokensPerSecond: finalStats.tokens_per_second,
      },
      responseId: finalResponseId,
      duration,
      eventCount,
    };
  } catch (error) {
    console.error(`[LMStudio] Streaming completion failed for ${modelId}: ${error.message}`);
    
    return {
      success: false,
      modelId,
      error: error.message,
      duration: Date.now() - startTime,
    };
  }
}
```

### Model Recommendations (DNA-Based)

```javascript
async recommendModel(taskType, dna) {
  // Check cache first
  const cacheKey = `${taskType}:${JSON.stringify(dna?.taskModelMapping || {})}`;
  const cached = this._recommendationCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.time) < this.CACHE_TTL) {
    console.log(`[LMStudio] Using cached recommendation for ${taskType}`);
    return cached.data;
  }
  
  console.log(`[LMStudio] Recommending model for task type: ${taskType}`);
  
  try {
    const availableModels = await this.getAvailableModels();
    
    if (availableModels.length === 0) {
      return {
        error: 'No models available',
        suggestion: 'Ensure LM Studio has at least one model downloaded',
      };
    }
    
    // Build scored list of models
    const scoredModels = await Promise.all(
      availableModels.map(async (model) => {
        const score = await this.calculateModelScore(model, taskType, dna);
        return { ...model, score };
      })
    );
    
    // Sort by score descending
    scoredModels.sort((a, b) => b.score - a.score);
    
    const topModel = scoredModels[0];
    
    const recommendation = {
      model: topModel,
      rating: topModel.score,
      alternatives: scoredModels.slice(1, 4), // Next 3 alternatives
      taskType,
    };
    
    // Cache the recommendation
    this._recommendationCache.set(cacheKey, {
      data: recommendation,
      time: Date.now(),
    });
    
    console.log(`[LMStudio] Recommended: ${topModel.key} (score: ${topModel.score.toFixed(2)})`);
    
    return recommendation;
  } catch (error) {
    console.error(`[LMStudio] Recommendation failed: ${error.message}`);
    
    return {
      error: error.message,
      suggestion: 'Check LM Studio connection and model availability',
    };
  }
}

async calculateModelScore(model, taskType, dna) {
  let score = 0;
  const modelKey = model.key || model.id;
  
  // Factor 1: Task-model mapping from DNA (40% weight)
  const taskMapping = dna?.taskModelMapping || {};
  if (taskMapping[taskType] === modelKey) {
    score += 40;
  } else if (taskMapping[taskType] && modelKey?.toLowerCase().includes(taskMapping[taskType].toLowerCase())) {
    score += 20; // Partial match
  }
  
  // Factor 2: Historical effectiveness rating (40% weight)
  const effectiveness = dna?.usageStats?.modelEffectiveness || {};
  const modelRatings = effectiveness[modelKey];
  
  if (modelRatings && modelRatings[taskType] && modelRatings[taskType].length > 0) {
    const ratings = modelRatings[taskType];
    const avgRating = ratings.reduce((sum, r) => sum + (r.rating || 0), 0) / ratings.length;
    score += (avgRating / 5) * 40; // Scale 1-5 to 0-40 points
  } else if (dna?.models?.[modelKey]?.purpose) {
    score += 10; // Model exists in DNA but no ratings yet
  }
  
  // Factor 3: Capability match (20% weight)
  if (model.capabilities) {
    if (taskType === 'visionAnalysis' && model.capabilities.vision) {
      score += 20;
    } else if (taskType.includes('code') && model.capabilities.trained_for_tool_use) {
      score += 15; // Bonus for tool use capability
    } else {
      score += 5; // Basic match
    }
  } else {
    score += 5; // Unknown capabilities, assume baseline
  }
  
  return Math.max(0, score);
}
```

### Utility Methods

```javascript
async retry(fn, retries = this.maxRetries) {
  let lastError;
  
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (i < retries - 1) {
        console.warn(`[LMStudio] Retry ${i + 1}/${retries}: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * (i + 1)));
      }
    }
  }
  
  throw lastError;
}

getUsageStats() {
  return {
    loadedModels: this._loadedModels.size,
    loadedModelIds: Array.from(this._loadedModels.keys()),
    isConnected: this._isConnected,
    connectionError: this._connectionError?.message,
    cacheSize: this._recommendationCache.size,
    modelsCacheAge: this._cacheTime ? Date.now() - this._cacheTime : null,
  };
}

clearCache() {
  this._recommendationCache.clear();
  this._modelsCache = null;
  this._cacheTime = 0;
  console.log(`[LMStudio] Caches cleared`);
}

shutdown() {
  this.stopHealthChecks();
  this._loadedModels.clear();
  this._recommendationCache.clear();
  this._modelsCache = null;
  this._cacheTime = 0;
  this._isConnected = false;
  this._connectionError = null;
  console.log(`[LMStudio] Switcher shut down`);
}
```

---

## HardwareDetector Class Implementation

### Overview

The `HardwareDetector` class provides cross-platform system resource detection for intelligent model loading decisions. It uses multiple fallback methods to ensure compatibility across Linux, macOS, and Windows.

### Constructor and Caching

```javascript
export class HardwareDetector {
  constructor() {
    this._cachedRam = null;
    this._cachedTier = null;
    this._cacheTime = 0;
    this.CACHE_TTL = 60000; // 1 minute cache
  }
}

// Export singleton instance
export const hardwareDetector = new HardwareDetector();
```

### RAM Detection Methods

```javascript
async detectTotalRAM() {
  const now = Date.now();
  
  // Return cached value if still valid
  if (this._cachedRam && (now - this._cacheTime) < this.CACHE_TTL) {
    return this._cachedRam;
  }

  let ramGB = 0;
  
  // Try multiple detection methods in order of reliability
  try {
    ramGB = await this.detectRAMNodeOS();      // Method 1: Node.js os module
    
    if (ramGB <= 0) {
      ramGB = await this.detectRAMPlatformSpecific();  // Method 2: Platform-specific
    }
    
    if (ramGB <= 0) {
      ramGB = await this.detectRAMFromProcMeminfo();   // Method 3: /proc/meminfo (Linux)
    }
    
    if (ramGB <= 0) {
      ramGB = await this.detectRAMFromSysctl();        // Method 4: sysctl (macOS/BSD)
    }
    
    if (ramGB <= 0) {
      ramGB = await this.detectRAMFromWMIC();          // Method 5: wmic (Windows)
    }
    
    // Fallback default
    if (ramGB <= 0) {
      ramGB = 8;
      console.warn(`[Hardware] Could not detect RAM, using default: ${ramGB}GB`);
    }
    
    this._cachedRam = ramGB;
    this._cacheTime = now;
    
    console.log(`[Hardware] Detected RAM: ${ramGB}GB`);
    
    return ramGB;
  } catch (error) {
    console.error(`[Hardware] RAM detection failed: ${error.message}`);
    return 8; // Safe default
  }
}

async detectRAMNodeOS() {
  try {
    const os = await import('node:os');
    const totalMemBytes = os.totalmem();
    const ramGB = totalMemBytes / (1024 * 1024 * 1024);
    
    return Math.round(ramGB * 10) / 10; // Round to 1 decimal
  } catch (error) {
    console.warn(`[Hardware] Node.js os module unavailable: ${error.message}`);
    return 0;
  }
}

async detectRAMFromProcMeminfo() {
  try {
    const fs = await import('node:fs');
    
    // Check if /proc/meminfo exists and is readable
    try {
      await fs.promises.access('/proc/meminfo', fs.constants.R_OK);
    } catch {
      return 0;
    }
    
    const meminfo = await fs.promises.readFile('/proc/meminfo', 'utf8');
    const memTotalLine = meminfo.split('\n').find(line => line.startsWith('MemTotal:'));
    
    if (!memTotalLine) return 0;
    
    // Parse: "MemTotal:       8192000 kB"
    const match = memTotalLine.match(/MemTotal:\s+(\d+)\s+kB/);
    if (!match) return 0;
    
    const memTotalKb = parseInt(match[1], 10);
    const ramGB = memTotalKb / (1024 * 1024);
    
    return Math.round(ramGB * 10) / 10;
  } catch (error) {
    console.warn(`[Hardware] /proc/meminfo parsing failed: ${error.message}`);
    return 0;
  }
}

async detectRAMFromSysctl() {
  try {
    const { exec } = await import('node:child_process');
    
    return new Promise((resolve, reject) => {
      exec('sysctl -n hw.memsize', (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        
        try {
          const bytes = parseInt(stdout.trim(), 10);
          const ramGB = bytes / (1024 * 1024 * 1024);
          resolve(Math.round(ramGB * 10) / 10);
        } catch (parseError) {
          reject(parseError);
        }
      });
    });
  } catch (error) {
    console.warn(`[Hardware] sysctl detection failed: ${error.message}`);
    return 0;
  }
}

async detectRAMFromWMIC() {
  try {
    const { exec } = await import('node:child_process');
    
    return new Promise((resolve, reject) => {
      exec('wmic ComputerSystem get TotalPhysicalMemory /Value', (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        
        try {
          // Parse: "TotalPhysicalMemory=17179869184"
          const match = stdout.match(/TotalPhysicalMemory=(\d+)/);
          if (!match) {
            reject(new Error('No match found'));
            return;
          }
          
          const bytes = parseInt(match[1], 10);
          const ramGB = bytes / (1024 * 1024 * 1024);
          resolve(Math.round(ramGB * 10) / 10);
        } catch (parseError) {
          reject(parseError);
        }
      });
    });
  } catch (error) {
    console.warn(`[Hardware] wmic detection failed: ${error.message}`);
    return 0;
  }
}
```

### Hardware Tier Classification

```javascript
async getHardwareTier() {
  if (this._cachedTier && (Date.now() - this._cacheTime) < this.CACHE_TTL) {
    return this._cachedTier;
  }

  const ramGB = await this.detectTotalRAM();
  
  let cpuCores = 0;
  try {
    const os = await import('node:os');
    cpuCores = os.cpus().length;
  } catch (error) {
    console.warn(`[Hardware] Could not detect CPU cores: ${error.message}`);
    cpuCores = 4; // Safe default
  }
  
  let tier = 'medium'; // Default
  
  if (ramGB < 8 || cpuCores < 4) {
    tier = 'low';
  } else if (ramGB >= 16 && cpuCores >= 8) {
    tier = 'high';
  } else if (ramGB >= 32 && cpuCores >= 16) {
    tier = 'ultra';
  }
  
  this._cachedTier = tier;
  this._cacheTime = Date.now();
  
  console.log(`[Hardware] Tier: ${tier} (RAM: ${ramGB}GB, CPU cores: ${cpuCores})`);
  
  return tier;
}

async getParallelLoadLimit() {
  const ramGB = await this.detectTotalRAM();
  const tier = await this.getHardwareTier();
  
  // Base limits by RAM
  let limit;
  if (ramGB < 8) {
    limit = 1;
  } else if (ramGB < 16) {
    limit = 2;
  } else if (ramGB < 32) {
    limit = 3;
  } else {
    limit = 4;
  }
  
  // Adjust by tier
  if (tier === 'low') limit = Math.max(1, limit - 1);
  if (tier === 'high') limit = Math.min(4, limit + 1);
  if (tier === 'ultra') limit = Math.min(6, limit + 2);
  
  console.log(`[Hardware] Parallel load limit: ${limit} (${tier} tier)`);
  
  return limit;
}

async getMaxModelSize() {
  const ramGB = await this.detectTotalRAM();
  
  if (ramGB < 8) {
    return 'small'; // <3B parameters
  } else if (ramGB < 16) {
    return 'medium'; // 3-7B parameters
  } else if (ramGB < 32) {
    return 'large'; // 7-13B parameters
  } else {
    return 'xlarge'; // 13B+ parameters
  }
}

async getHardwareProfile() {
  const ramGB = await this.detectTotalRAM();
  const tier = await this.getHardwareTier();
  const parallelLimit = await this.getParallelLoadLimit();
  const maxModelSize = await this.getMaxModelSize();
  
  let cpuCores = 0;
  try {
    const os = await import('node:os');
    cpuCores = os.cpus().length;
  } catch (error) {
    console.warn(`[Hardware] Could not detect CPU cores: ${error.message}`);
    cpuCores = 4;
  }
  
  return {
    ramGB,
    tier,
    parallelLoadLimit: parallelLimit,
    maxModelSize,
    cpuCores,
    platform: process.platform,
    architecture: process.arch,
    timestamp: new Date().toISOString(),
  };
}

clearCache() {
  this._cachedRam = null;
  this._cachedTier = null;
  this._cacheTime = 0;
  console.log(`[Hardware] Cache cleared`);
}
```

---

## Usage Examples

### Basic Model Switching

```javascript
import { lmStudioSwitcher } from './lm-studio-switcher.js';

// Initialize the switcher
await lmStudioSwitcher.initialize();

// Load a model
const loadResult = await lmStudioSwitcher.loadModel('llama-3.2-3b');
console.log(`Loaded: ${loadResult.loaded}`);

// Execute chat completion
const result = await lmStudioSwitcher.executeChatCompletion(
  'llama-3.2-3b',
  [{ role: 'user', content: 'Hello!' }],
  { temperature: 0.7, system_prompt: 'You are helpful.' }
);

console.log(result.result.content);

// Unload when done
await lmStudioSwitcher.unloadModel('llama-3.2-3b');
```

### Streaming Chat Completion

```javascript
const result = await lmStudioSwitcher.streamChatCompletion(
  'llama-3.2-3b',
  [{ role: 'user', content: 'Explain quantum computing.' }],
  {
    temperature: 0.7,
    onMessage: (content, type) => {
      process.stdout.write(content); // Print as tokens arrive
    },
    onEvent: (eventType, eventData) => {
      console.log(`Event: ${eventType}`);
    }
  }
);

console.log(`\n\nComplete response:\n${result.result.content}`);
```

### Model Recommendations

```javascript
import { loadModelDNA } from './model-dna-manager.js';

const dna = loadModelDNA();

// Get recommendation for a task type
const recommendation = await lmStudioSwitcher.recommendModel('researchBugFixes', dna);

console.log(`Recommended model: ${recommendation.model.key}`);
console.log(`Score: ${recommendation.rating.toFixed(2)}`);
console.log(`Alternatives:`, recommendation.alternatives.map(m => m.key));
```

### Hardware-Aware Loading

```javascript
import { hardwareDetector } from './hardware-detector.js';

// Get hardware profile
const profile = await hardwareDetector.getHardwareProfile();
console.log(profile);
// Output: { ramGB: 32, tier: 'high', parallelLoadLimit: 4, maxModelSize: 'large', ... }

// Load multiple models within limits
const limit = await hardwareDetector.getParallelLoadLimit();
for (let i = 0; i < limit; i++) {
  await lmStudioSwitcher.loadModel(`model-${i}`);
}
```

---

## Testing Strategy

### Unit Tests for LMStudioSwitcher

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { LMStudioSwitcher, resetLMStudioSwitcher } from '../src/services/lm-studio-switcher.js';

describe('LMStudioSwitcher', () => {
  let switcher;

  beforeEach(() => {
    resetLMStudioSwitcher(); // Reset singleton state
    switcher = new LMStudioSwitcher();
  });

  afterEach(() => {
    switcher.shutdown();
  });

  describe('checkConnection()', () => {
    it('should return false when LM Studio is not running', async () => {
      const connected = await switcher.checkConnection();
      assert.strictEqual(connected, false);
    });
    
    // Note: Test with actual LM Studio requires server to be running
  });

  describe('getUsageStats()', () => {
    it('should return usage statistics', () => {
      const stats = switcher.getUsageStats();
      
      assert.ok(typeof stats.loadedModels === 'number');
      assert.ok(Array.isArray(stats.loadedModelIds));
      assert.ok(typeof stats.isConnected === 'boolean');
    });
  });

  describe('clearCache()', () => {
    it('should clear recommendation and models cache', () => {
      switcher.clearCache();
      
      const stats = switcher.getUsageStats();
      assert.strictEqual(stats.cacheSize, 0);
    });
  });
});
```

### Unit Tests for HardwareDetector

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { hardwareDetector } from '../src/utils/hardware-detector.js';

describe('HardwareDetector', () => {
  beforeEach(() => {
    hardwareDetector.clearCache();
  });

  describe('detectTotalRAM()', () => {
    it('should detect RAM and return positive number', async () => {
      const ramGB = await hardwareDetector.detectTotalRAM();
      
      assert.ok(ramGB > 0, 'RAM should be greater than 0');
      assert.ok(typeof ramGB === 'number', 'RAM should be a number');
    });

    it('should cache the result', async () => {
      const firstCall = await hardwareDetector.detectTotalRAM();
      const secondCall = await hardwareDetector.detectTotalRAM();
      
      assert.strictEqual(firstCall, secondCall);
    });
  });

  describe('getHardwareTier()', () => {
    it('should return valid tier', async () => {
      const tier = await hardwareDetector.getHardwareTier();
      
      assert.ok(['low', 'medium', 'high', 'ultra'].includes(tier));
    });
  });

  describe('getParallelLoadLimit()', () => {
    it('should return positive integer limit', async () => {
      const limit = await hardwareDetector.getParallelLoadLimit();
      
      assert.ok(limit >= 1, 'Limit should be at least 1');
      assert.ok(Number.isInteger(limit), 'Limit should be an integer');
    });
  });

  describe('getHardwareProfile()', () => {
    it('should return complete hardware profile', async () => {
      const profile = await hardwareDetector.getHardwareProfile();
      
      assert.ok(profile.ramGB > 0);
      assert.ok(['low', 'medium', 'high', 'ultra'].includes(profile.tier));
      assert.ok(profile.parallelLoadLimit >= 1);
      assert.ok(['small', 'medium', 'large', 'xlarge'].includes(profile.maxModelSize));
      assert.ok(profile.cpuCores > 0);
      assert.ok(profile.platform);
      assert.ok(profile.architecture);
    });
  });

  describe('clearCache()', () => {
    it('should clear cached values', () => {
      hardwareDetector.clearCache();
      
      // Next detection should not use cache
      const ram = hardwareDetector._cachedRam;
      assert.strictEqual(ram, null);
    });
  });
});
```

---

## Integration Points

The Model Switching Service integrates with:

1. **Phase 1 DNA System** - Uses `loadModelDNA()` and `recordEffectivenessRating()` for recommendations
2. **Phase 3 Task Dispatcher** - Provides model execution via `executeChatCompletion()` and `streamChatCompletion()`
3. **Phase 4 Tools** - Exposed as MCP tools: `switch-model`, `execute-task`, `rate-model`

---

## Changes from Original Specification

| Aspect | Original Spec | Actual Implementation |
|--------|--------------|----------------------|
| Class name | `LmStudioSwitcher` (camelCase) | `LMStudioSwitcher` (PascalCase with acronym) |
| API endpoints | `/models`, `/chat/completions` | `/api/v1/models`, `/api/v1/chat` (v1 API paths) |
| Streaming support | Not mentioned | **Implemented** - Full SSE streaming with event callbacks |
| Hardware detector | Standalone functions (`detectSystemRAM()`) | Class-based `HardwareDetector` with caching and tier classification |
| Model tracking | Basic loaded state | Instance ID tracking with `_loadedModels` Map cache |
| Recommendation system | Simple mapping | Multi-factor scoring (DNA mapping + ratings + capabilities) |

These changes improve maintainability, performance, and feature completeness.

---

## Moving to Phase 3

**Prerequisites for Phase 3:**
- [ ] `LMStudioSwitcher.initialize()` connects successfully to LM Studio
- [ ] `loadModel()` loads models within hardware limits
- [ ] `executeChatCompletion()` returns valid responses
- [ ] `streamChatCompletion()` streams tokens correctly with callbacks
- [ ] `recommendModel()` uses DNA ratings for scoring

Once Phase 2 is verified, proceed to **Phase 3: Task Dispatcher**.