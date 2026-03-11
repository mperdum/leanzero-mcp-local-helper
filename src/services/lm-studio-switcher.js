/**
 * LM Studio Switcher - Model switching service with intelligent recommendations
 * Integrates with LM Studio's v1 API for model lifecycle management and chat completions
 */

import { hardwareDetector } from '../utils/hardware-detector.js';
import { loadModelDNA, recordEffectivenessRating } from '../utils/model-dna-manager.js';

export class LMStudioSwitcher {
  constructor() {
    this.lmStudioBaseUrl = process.env.LM_STUDIO_URL || 'http://localhost:1234';
    this.maxRetries = parseInt(process.env.MAX_RETRIES || '3');
    this.retryDelay = parseInt(process.env.RETRY_DELAY || '1000');
    this.requestTimeout = parseInt(process.env.REQUEST_TIMEOUT || '30000');
    this.healthCheckInterval = parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000');
    
    this._isConnected = false;
    this._connectionError = null;
    this._loadedModels = new Map(); // Track loaded models with instance_id
    this._healthCheckTimer = null;
    this._recommendationCache = new Map();
    this.CACHE_TTL = 30000; // 30 seconds
    this._modelsCache = null;
    this._cacheTime = 0;
    
    // Bind methods
    this.checkConnection = this.checkConnection.bind(this);
    this.executeChatCompletion = this.executeChatCompletion.bind(this);
    this.streamChatCompletion = this.streamChatCompletion.bind(this);
  }

  /**
   * Initialize the switcher and start health monitoring
   */
  async initialize() {
    console.log(`[LMStudio] Initializing switcher...`);
    
    // Check LM Studio connection
    const connected = await this.checkConnection();
    
    if (!connected) {
      console.error(`[LMStudio] Failed to connect to LM Studio at ${this.lmStudioBaseUrl}`);
      console.error(`[LMStudio] Ensure LM Studio is running with: lms server start`);
      this._connectionError = new Error('Cannot connect to LM Studio');
    } else {
      console.log(`[LMStudio] Connected successfully`);
      
      // Start health check polling
      this.startHealthChecks();
      
      // Load initial model state
      await this.refreshLoadedModels();
    }
    
    return connected;
  }

  /**
   * Check connection to LM Studio
   * @returns {Promise<boolean>} Connection status
   */
  async checkConnection() {
    try {
      // Skip health check if already in an error state
      if (this._connectionError && !this._isConnected) {
        return false;
      }
      
      const response = await fetch(`${this.lmStudioBaseUrl}/api/v1/models`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      
      if (response.ok) {
        this._isConnected = true;
        this._connectionError = null;
        return true;
      } else {
        this._isConnected = false;
        const errorText = await response.text();
        this._connectionError = new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
        return false;
      }
    } catch (error) {
      this._isConnected = false;
      this._connectionError = error;
      return false;
    }
  }

  /**
   * Start periodic health checks
   */
  startHealthChecks() {
    if (this._healthCheckTimer) {
      clearInterval(this._healthCheckTimer);
    }
    
    this._healthCheckTimer = setInterval(async () => {
      const connected = await this.checkConnection();
      
      if (!connected) {
        console.warn(`[LMStudio] Health check failed: ${this._connectionError?.message}`);
        
        // Clear loaded models cache on disconnection
        this._loadedModels.clear();
        this._modelsCache = null;
      } else {
        // Refresh model state periodically
        await this.refreshLoadedModels();
      }
    }, this.healthCheckInterval);
  }

  /**
   * Stop health checks
   */
  stopHealthChecks() {
    if (this._healthCheckTimer) {
      clearInterval(this._healthCheckTimer);
      this._healthCheckTimer = null;
    }
  }

  /**
   * Get all available models from LM Studio with caching
   * @returns {Promise<Array>} List of available models
   */
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
      
      // Parse LM Studio v1 models response
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

  /**
   * Get currently loaded model instances
   * @returns {Promise<Array>} Currently loaded model instances
   */
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

  /**
   * Get the currently loaded model (first one if multiple)
   * @returns {Promise<Object|null>} Currently loaded model info
   */
  async getCurrentModel() {
    // First check our in-memory cache before making API call
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
      const first = loaded[0];
      return {
        modelId: first.modelKey,
        displayName: first.displayName,
        instanceId: first.instanceId,
        config: first.config,
      };
    }
    
    return null;
  }

  /**
   * Load a model by ID
   * @param {string} modelId - Model identifier (model key)
   * @param {Object} options - Loading options (context_length, flash_attention, etc.)
   * @returns {Promise<Object>} Load result
   */
  async loadModel(modelId, options = {}) {
    console.log(`[LMStudio] Loading model: ${modelId}`);
    
    try {
      // First check our in-memory cache (no API call!)
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
        // Need to unload a model first
        console.warn(`[LMStudio] Parallel limit (${parallelLimit}) reached. Unloading oldest model.`);
        
        // Get oldest loaded model (FIFO) from cache
        if (this._loadedModels.size > 0) {
          const oldestEntry = this._loadedModels.values().next().value;
          const unloadResult = await this.unloadModel(oldestEntry.instanceId, false);
          if (!unloadResult.unloaded) {
            console.warn(`[LMStudio] Failed to unload oldest model: ${unloadResult.error || 'unknown error'}`);
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
      
      // Track loaded model instance
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

  /**
   * Unload a model by instance ID or model key
   * @param {string} modelId - Model identifier (instance ID or model key)
   * @param {boolean} failIfNotFound - Throw error if model not found
   * @returns {Promise<Object>} Unload result
   */
  async unloadModel(modelId, failIfNotFound = true) {
    console.log(`[LMStudio] Unloading model: ${modelId}`);
    
    try {
      // Resolve instance ID from model key if needed
      let instanceId = modelId;
      
      if (!this._loadedModels.has(modelId)) {
        // Try to find by model key in cache first
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
      } else {
        instanceId = modelId;
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

  /**
   * Refresh the cache of loaded models
   * @returns {Promise<void>}
   */
  async refreshLoadedModels() {
    try {
      await this.getAvailableModels();
    } catch (error) {
      console.warn(`[LMStudio] Failed to refresh loaded models: ${error.message}`);
    }
  }

  /**
   * Execute chat completion with a specific model using LM Studio v1 API
   * @param {string} modelId - Model to use (model key or instance ID)
   * @param {Array|string} input - Chat input: string or array of message objects
   * @param {Object} options - Generation options
   * @param {string} [options.system_prompt] - System prompt
   * @param {number} [options.temperature=0.7] - Temperature
   * @param {number} [options.max_output_tokens=4096] - Max tokens to generate
   * @param {number} [options.context_length] - Context length
   * @param {boolean} [options.stream=false] - Stream response
   * @param {string} [options.previous_response_id] - For stateful chat continuation
   * @param {number} [options.ttl] - Time-to-live in seconds for auto-unload
   * @param {string} [options.reasoning] - Reasoning level: 'off', 'low', 'medium', 'high', 'on'
   * @param {Array} [options.integrations] - MCP integrations (plugins/ephemeral servers)
   * @param {Object} [options.integrations[0]] - Integration object
   * @param {string} [options.integrations[0].type] - 'plugin' or 'ephemeral_mcp'
   * @param {string} [options.integrations[0].id] - Plugin ID (for type 'plugin')
   * @param {string} [options.integrations[0].server_label] - MCP server label (for ephemeral_mcp)
   * @param {string} [options.integrations[0].server_url] - MCP server URL (for ephemeral_mcp)
   * @param {Array} [options.integrations[0].allowed_tools] - Allowed tools from this integration
   * @param {Object} [options.integrations[0].headers] - Custom headers for MCP server
   * @param {string} [options.taskType] - Task type for effectiveness tracking
   * @param {number} [options.rating] - User rating (1-5) for this completion
   * @returns {Promise<Object>} Completion result
   */
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
      
      // If not in cache, try loading (this will check API as fallback)
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
      
      // Prepare request payload according to LM Studio v1 API
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
      if (options.top_p !== undefined) payload.top_p = options.top_p;
      if (options.top_k !== undefined) payload.top_k = options.top_k;
      if (options.min_p !== undefined) payload.min_p = options.min_p;
      if (options.repeat_penalty !== undefined) payload.repeat_penalty = options.repeat_penalty;
      
      // MCP Integrations (plugins and ephemeral MCP servers)
      if (options.integrations && Array.isArray(options.integrations)) {
        payload.integrations = options.integrations;
      }
      
      console.log(`[LMStudio] Executing completion with ${modelId} (input type: ${typeof input === 'string' ? 'text' : 'messages'})`);
      
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
        
        // Check for invalid tool calls
        const invalidToolCall = output.find(item => item.type === 'invalid_tool_call');
        if (invalidToolCall) {
          console.warn(`[LMStudio] Invalid tool call: ${invalidToolCall.reason}`);
        }
        
        // Extract stats - include reasoning_output_tokens
        const stats = data.stats || {};
        const duration = Date.now() - startTime;
        
        console.log(`[LMStudio] Completion done in ${duration}ms`);
        
        // Record effectiveness for future recommendations
        const taskType = options.taskType || 'general';
        if (options.rating) {
          recordEffectivenessRating(modelId, taskType, options.rating);
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
              total_tokens: stats.input_tokens + stats.total_output_tokens,
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

  /**
   * Execute streaming chat completion with SSE
   * @param {string} modelId - Model to use (model key or instance ID)
   * @param {Array|string} input - Chat input: string or array of message objects
   * @param {Object} options - Generation options
   * @param {string} [options.system_prompt] - System prompt
   * @param {number} [options.temperature=0.7] - Temperature
   * @param {number} [options.max_output_tokens] - Max tokens to generate
   * @param {number} [options.context_length] - Context length
   * @param {string} [options.previous_response_id] - For stateful chat continuation
   * @param {string} [options.reasoning] - Reasoning level: 'off', 'low', 'medium', 'high', 'on'
   * @param {Array} [options.integrations] - MCP integrations
   * @param {Function} [options.onEvent] - Event callback (eventType, eventData)
   * @param {Function} [options.onMessage] - Message callback for incremental content (content, type)
   * @returns {Promise<Object>} Final result with complete content
   */
  async streamChatCompletion(modelId, input, options = {}) {
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
      
      // If not in cache, try loading (this will check API as fallback)
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
      
      // Optional parameters
      if (options.system_prompt) payload.system_prompt = options.system_prompt;
      if (options.max_output_tokens) payload.max_output_tokens = options.max_output_tokens;
      if (options.context_length) payload.context_length = options.context_length;
      if (options.previous_response_id) payload.previous_response_id = options.previous_response_id;
      if (options.reasoning) payload.reasoning = options.reasoning;
      if (options.integrations) payload.integrations = options.integrations;
      
      console.log(`[LMStudio] Streaming completion with ${modelId}`);
      
      // Execute streaming request
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
      
      // Check if response is a stream
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
              
              if (data === '[DONE]') {
                continue;
              }
              
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
                    console.log(`[LMStudio] Stream started with model ${eventData.model_instance_id}`);
                    break;
                    
                  case 'model_load.start':
                    console.log(`[LMStudio] Model loading: ${eventData.model_instance_id}`);
                    break;
                    
                  case 'model_load.progress':
                    console.log(`[LMStudio] Model load progress: ${(eventData.progress * 100).toFixed(0)}%`);
                    break;
                    
                  case 'model_load.end':
                    console.log(`[LMStudio] Model loaded in ${eventData.load_time_seconds}s`);
                    break;
                    
                  case 'reasoning.start':
                    console.log('[LMStudio] Model starting reasoning');
                    break;
                    
                  case 'reasoning.delta':
                    finalContent += eventData.content;
                    if (options.onMessage) {
                      options.onMessage(eventData.content, { type: 'reasoning' });
                    }
                    break;
                    
                  case 'reasoning.end':
                    console.log('[LMStudio] Reasoning complete');
                    break;
                    
                  case 'tool_call.start':
                    console.log(`[LMStudio] Tool call: ${eventData.tool}`);
                    break;
                    
                  case 'tool_call.arguments':
                    console.log(`[LMStudio] Tool arguments: ${JSON.stringify(eventData.arguments)}`);
                    break;
                    
                  case 'tool_call.success':
                    console.log(`[LMStudio] Tool success: ${eventData.tool}`);
                    break;
                    
                  case 'tool_call.failure':
                    console.warn(`[LMStudio] Tool failed: ${eventData.reason}`);
                    break;
                    
                  case 'message.start':
                    break;
                    
                  case 'message.delta':
                    finalContent += eventData.content;
                    if (options.onMessage) {
                      options.onMessage(eventData.content, { type: 'message' });
                    }
                    break;
                    
                  case 'message.end':
                    console.log('[LMStudio] Message chunk complete');
                    break;
                    
                  case 'error':
                    console.error(`[LMStudio] Stream error: ${eventData.error.message}`);
                    break;
                    
                  case 'chat.end':
                    // Final result
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
          modelLoadTime: finalStats.model_load_time_seconds,
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

  /**
   * Recommend optimal model for a task type using DNA ratings
   * @param {string} taskType - Task category (codeFixes, codeExecution, etc.)
   * @param {Object} dna - Model DNA configuration
   * @returns {Promise<Object>} Recommendation with model and rating
   */
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
      // Get all available models
      const availableModels = await this.getAvailableModels();
      
      if (availableModels.length === 0) {
        return {
          error: 'No models available',
          suggestion: 'Ensure LM Studio has at least one model downloaded',
        };
      }
      
      // Get task-model mapping from DNA
      const taskMapping = dna?.taskModelMapping || {};
      const recommendedModelKey = taskMapping[taskType];
      
      // Build scored list of models
      const scoredModels = await Promise.all(
        availableModels.map(async (model) => {
          const score = await this.calculateModelScore(model, taskType, dna);
          return { ...model, score };
        })
      );
      
      // Sort by score descending
      scoredModels.sort((a, b) => b.score - a.score);
      
      // Get top recommendation
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
      
      console.log(`[LMStudio] Recommended: ${topModel.key || topModel.id} (score: ${topModel.score.toFixed(2)})`);
      
      return recommendation;
      
    } catch (error) {
      console.error(`[LMStudio] Recommendation failed: ${error.message}`);
      
      return {
        error: error.message,
        suggestion: 'Check LM Studio connection and model availability',
      };
    }
  }

  /**
   * Calculate score for a model for a specific task type
   * @param {Object} model - Model info from LM Studio
   * @param {string} taskType - Task category
   * @param {Object} dna - Model DNA configuration
   * @returns {Promise<number>} Score (higher is better)
   */
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
      // Scale 1-5 to 0-40 points
      score += (avgRating / 5) * 40;
    } else if (dna?.models?.[modelKey]?.purpose) {
      // If model exists in DNA with purpose but no ratings, give partial points
      score += 10;
    }
    
    // Factor 3: Capability match (20% weight)
    if (model.capabilities) {
      // Check if model has capabilities matching the task
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
    
    return Math.max(0, score); // No negative scores
  }

  /**
   * Retry wrapper for fetch operations
   * @param {Function} fn - Async function to retry
   * @param {number} retries - Number of retries
   * @returns {Promise<any>} Result
   */
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

  /**
   * Get usage statistics for loaded models
   * @returns {Object} Usage stats
   */
  getUsageStats() {
    const stats = {
      loadedModels: this._loadedModels.size,
      loadedModelIds: Array.from(this._loadedModels.keys()),
      isConnected: this._isConnected,
      connectionError: this._connectionError?.message,
      cacheSize: this._recommendationCache.size,
      modelsCacheAge: this._cacheTime ? Date.now() - this._cacheTime : null,
    };
    
    return stats;
  }

  /**
   * Clear recommendation cache
   */
  clearCache() {
    this._recommendationCache.clear();
    this._modelsCache = null;
    this._cacheTime = 0;
    console.log(`[LMStudio] Caches cleared`);
  }

  /**
   * Shutdown the switcher
   */
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
}

// Export singleton instance
export const lmStudioSwitcher = new LMStudioSwitcher();

// Initialize on module load (optional - can be called explicitly)
let _initialized = false;
export async function initializeLMStudioSwitcher() {
  if (!_initialized) {
    await lmStudioSwitcher.initialize();
    _initialized = true;
  }
  return lmStudioSwitcher;
}

// For testing: reset singleton state
export function resetLMStudioSwitcher() {
  lmStudioSwitcher.shutdown();
  lmStudioSwitcher.stopHealthChecks();
  lmStudioSwitcher._loadedModels.clear();
  lmStudioSwitcher._recommendationCache.clear();
  lmStudioSwitcher._modelsCache = null;
  lmStudioSwitcher._cacheTime = 0;
  lmStudioSwitcher._isConnected = false;
  lmStudioSwitcher._connectionError = null;
  _initialized = false;
}