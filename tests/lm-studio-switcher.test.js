/**
 * LM Studio Switcher Tests - Updated for v1 API
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { 
  lmStudioSwitcher, 
  initializeLMStudioSwitcher,
  resetLMStudioSwitcher
} from '../src/services/lm-studio-switcher.js';
import { loadModelDNA, createDNAFile } from '../src/utils/model-dna-manager.js';

// Helper to create valid models response
function createMockModelsResponse(models = []) {
  return {
    ok: true,
    json: async () => ({ models }),
  };
}

// Helper to create error response
function createMockErrorResponse(message = 'Error', status = 500) {
  return {
    ok: false,
    status,
    text: async () => message,
  };
}

describe('LM Studio Switcher', () => {
  let originalFetch;
  
  beforeEach(async () => {
    // Reset singleton state before each test
    resetLMStudioSwitcher();
    
    // Initialize DNA for tests
    const dna = loadModelDNA();
    if (!dna) {
      createDNAFile({});
    }
    
    // Save original fetch
    originalFetch = global.fetch;
  });

  afterEach(() => {
    // Stop health checks and reset state after each test
    resetLMStudioSwitcher();
    
    // Restore original fetch
    global.fetch = originalFetch;
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      global.fetch = async (url) => {
        if (url.includes('/api/v1/models')) {
          return createMockModelsResponse([]);
        }
        return createMockErrorResponse('Not an API endpoint', 404);
      };

      const result = await initializeLMStudioSwitcher();
      
      assert.ok(result, 'Should return switcher instance');
      assert.ok(lmStudioSwitcher._isConnected, 'Should be connected');
    });

    it('should track connection status', async () => {
      global.fetch = async (url) => {
        if (url.includes('/api/v1/models')) {
          return createMockModelsResponse([]);
        }
        return createMockErrorResponse('Not an API endpoint', 404);
      };

      await initializeLMStudioSwitcher();
      
      const stats = lmStudioSwitcher.getUsageStats();
      assert.ok('isConnected' in stats, 'Should have isConnected property');
    });
  });

  describe('API Endpoint URLs', () => {
    it('should use correct v1 API endpoints', async () => {
      let endpointCalled = '';
      
      global.fetch = async (url) => {
        endpointCalled = url;
        if (url.includes('/api/v1/')) {
          return createMockModelsResponse([]);
        }
        return createMockErrorResponse('Not an API endpoint', 404);
      };

      await initializeLMStudioSwitcher();
      await lmStudioSwitcher.getAvailableModels();
      
      assert.ok(endpointCalled.includes('/api/v1/'), 'Should use /api/v1/ endpoint');
    });
  });

  describe('Model Discovery', () => {
    it('should parse LM Studio v1 models response correctly', async () => {
      global.fetch = async (url) => {
        if (url.includes('/api/v1/models')) {
          return {
            ok: true,
            json: async () => ({
              models: [
                {
                  type: 'llm',
                  key: 'test-model',
                  display_name: 'Test Model',
                  architecture: 'llama',
                  quantization: { name: 'Q4_K_M', bits_per_weight: 4 },
                  size_bytes: 241410208,
                  params_string: '7B',
                  loaded_instances: [],
                  max_context_length: 4096,
                  format: 'gguf',
                  capabilities: { vision: false, trained_for_tool_use: true },
                  description: 'A test model',
                },
                {
                  type: 'llm',
                  key: 'vision-model',
                  display_name: 'Vision Model',
                  architecture: 'llava',
                  quantization: { name: 'Q4_K_M', bits_per_weight: 4 },
                  size_bytes: 241410208,
                  params_string: '7B',
                  loaded_instances: [],
                  max_context_length: 4096,
                  format: 'gguf',
                  capabilities: { vision: true, trained_for_tool_use: false },
                  description: 'A vision model',
                }
              ]
            }),
          };
        }
        return createMockErrorResponse('Not an API endpoint', 404);
      };

      const models = await lmStudioSwitcher.getAvailableModels();
      
      assert.strictEqual(models.length, 2, 'Should return 2 models');
      assert.strictEqual(models[0].key, 'test-model', 'Should have correct model key');
      assert.strictEqual(models[0].display_name, 'Test Model', 'Should have display name');
      assert.ok('capabilities' in models[0], 'Should have capabilities field');
      assert.ok('loaded_instances' in models[0], 'Should have loaded_instances field');
    });

    it('should track loaded model instances from response', async () => {
      global.fetch = async (url) => {
        if (url.includes('/api/v1/models')) {
          return {
            ok: true,
            json: async () => ({
              models: [
                {
                  key: 'loaded-model',
                  display_name: 'Loaded Model',
                  loaded_instances: [
                    {
                      id: 'inst_abc123',
                      config: { context_length: 4096 }
                    }
                  ]
                }
              ]
            }),
          };
        }
        return createMockErrorResponse('Not an API endpoint', 404);
      };

      await lmStudioSwitcher.getAvailableModels();
      
      const stats = lmStudioSwitcher.getUsageStats();
      assert.strictEqual(stats.loadedModels, 1, 'Should track 1 loaded instance');
      assert.ok(stats.loadedModelIds.includes('inst_abc123'), 'Should have instance ID');
    });
  });

  describe('Model Loading', () => {
    it('should load a model successfully', async () => {
      let loadCalled = false;
      let loadModelId = '';
      
      global.fetch = async (url, options) => {
        if (url.includes('/api/v1/models/load')) {
          loadCalled = true;
          const body = JSON.parse(options.body);
          loadModelId = body.model;
          return {
            ok: true,
            json: async () => ({
              type: 'llm',
              instance_id: 'inst_test_1',
              load_time_seconds: 2.5,
              load_config: { context_length: 4096 }
            }),
          };
        }
        if (url.includes('/api/v1/models')) {
          return createMockModelsResponse([{ key: 'test-model', loaded_instances: [] }]);
        }
        return createMockErrorResponse('Not an API endpoint', 404);
      };

      const result = await lmStudioSwitcher.loadModel('test-model');
      
      assert.strictEqual(result.loaded, true, 'Should load successfully');
      assert.strictEqual(result.instanceId, 'inst_test_1', 'Should return instance ID');
      assert.strictEqual(result.alreadyLoaded, false, 'Should not be already loaded');
      assert.ok(loadCalled, 'Should call load endpoint');
      assert.strictEqual(loadModelId, 'test-model', 'Should pass model ID');
    });

    it('should detect already loaded model', async () => {
      let loadCallCount = 0;
      
      global.fetch = async (url, options) => {
        if (url.includes('/api/v1/models/load')) {
          loadCallCount++;
          return {
            ok: true,
            json: async () => ({
              type: 'llm',
              instance_id: 'inst_test_1',
              load_time_seconds: 2.5,
            }),
          };
        }
        if (url.includes('/api/v1/models')) {
          return {
            ok: true,
            json: async () => ({
              models: [{
                key: 'test-model',
                loaded_instances: loadCallCount > 0 ? [{ id: 'inst_test_1', config: {} }] : []
              }]
            }),
          };
        }
        return createMockErrorResponse('Not an API endpoint', 404);
      };

      // First load
      const result1 = await lmStudioSwitcher.loadModel('test-model');
      assert.strictEqual(result1.loaded, true, 'First load should succeed');
      assert.strictEqual(result1.instanceId, 'inst_test_1', 'Should have instance ID');
      
      // Verify first load made the API call
      assert.strictEqual(loadCallCount, 1, 'First load should call API');
      
      // Second load - should detect already loaded from in-memory cache
      const result2 = await lmStudioSwitcher.loadModel('test-model');
      assert.strictEqual(result2.loaded, true, 'Should succeed');
      assert.strictEqual(result2.alreadyLoaded, true, 'Should detect already loaded');
      assert.strictEqual(loadCallCount, 1, 'Second load should NOT make another API call');
    });

    it('should handle load failure gracefully', async () => {
      let loadEndpointCalled = false;
      
      global.fetch = async (url, options) => {
        if (url.includes('/api/v1/models/load')) {
          loadEndpointCalled = true;
          return {
            ok: false,
            status: 404,
            text: async () => 'Model not found in catalog',
          };
        }
        if (url.includes('/api/v1/models')) {
          return createMockModelsResponse([]);
        }
        return createMockErrorResponse('Not an API endpoint', 404);
      };

      const result = await lmStudioSwitcher.loadModel('nonexistent-model');
      
      assert.strictEqual(result.loaded, false, 'Should fail to load');
      assert.ok(result.error, 'Should have error message');
      assert.ok(result.error.includes('404'), 'Error should mention 404 status');
      assert.ok(loadEndpointCalled, 'Should have called the load endpoint');
    });
  });

  describe('Model Unloading', () => {
    it('should unload a model successfully', async () => {
      let unloadCalled = false;
      let unloadInstanceId = '';
      
      // Setup: Pre-populate loaded models cache
      lmStudioSwitcher._loadedModels.set('inst_test_1', {
        modelId: 'test-model',
        instanceId: 'inst_test_1',
        loadedAt: new Date().toISOString(),
        config: {},
        purpose: null,
      });
      
      global.fetch = async (url, options) => {
        if (url.includes('/api/v1/models/unload')) {
          unloadCalled = true;
          const body = JSON.parse(options.body);
          unloadInstanceId = body.instance_id;
          return {
            ok: true,
            json: async () => ({})
          };
        }
        if (url.includes('/api/v1/models')) {
          return createMockModelsResponse([]);
        }
        return createMockErrorResponse('Not an API endpoint', 404);
      };

      const unloadResult = await lmStudioSwitcher.unloadModel('inst_test_1');
      
      assert.strictEqual(unloadResult.unloaded, true, 'Should unload successfully');
      assert.strictEqual(unloadResult.instanceId, 'inst_test_1', 'Should return correct instance ID');
      assert.ok(unloadCalled, 'Should call unload endpoint');
      assert.strictEqual(unloadInstanceId, 'inst_test_1', 'Should pass correct instance ID');
    });

    it('should handle unloading non-existent model gracefully', async () => {
      global.fetch = async (url) => {
        if (url.includes('/api/v1/models')) {
          return createMockModelsResponse([]);
        }
        return createMockErrorResponse('Not an API endpoint', 404);
      };

      const result = await lmStudioSwitcher.unloadModel('nonexistent-instance', { failIfNotFound: false });
      
      assert.strictEqual(result.unloaded, true, 'Should not fail');
      assert.ok(result.note, 'Should have note about model not loaded');
    });
  });

  describe('Chat Completion', () => {
    it('should execute chat completion with correct format', async () => {
      let chatModel = '';
      let chatInput = '';
      let chatStream = null;
      let chatIntegrations = null;
      
      global.fetch = async (url, options) => {
        if (url.includes('/api/v1/chat')) {
          const body = JSON.parse(options.body);
          chatModel = body.model;
          chatInput = body.input;
          chatStream = body.stream;
          chatIntegrations = body.integrations;
          
          // Verify request format
          assert.strictEqual(body.stream, false, 'Should have stream=false');
          assert.strictEqual(body.temperature, 0.7, 'Should have temperature');
          
          return {
            ok: true,
            json: async () => ({
              output: [{ type: 'message', content: 'I am fine, thank you!' }],
              stats: {
                input_tokens: 10,
                total_output_tokens: 20,
                reasoning_output_tokens: 0,
                tokens_per_second: 50,
              },
              response_id: 'resp_abc123',
            }),
          };
        }
        if (url.includes('/api/v1/models')) {
          return createMockModelsResponse([{ key: 'test-model', loaded_instances: [] }]);
        }
        if (url.includes('/api/v1/models/load')) {
          return {
            ok: true,
            json: async () => ({
              type: 'llm',
              instance_id: 'inst_test_1',
              load_time_seconds: 2.5,
              load_config: { context_length: 4096 }
            }),
          };
        }
        return createMockErrorResponse('Not an API endpoint', 404);
      };

      const result = await lmStudioSwitcher.executeChatCompletion('test-model', 'Hello, how are you?');
      
      assert.strictEqual(result.success, true, 'Should succeed');
      assert.strictEqual(chatModel, 'test-model', 'Should pass model ID');
      assert.strictEqual(chatInput, 'Hello, how are you?', 'Should pass input');
      assert.strictEqual(result.result.content, 'I am fine, thank you!', 'Should have content');
      assert.ok(result.responseId, 'Should have response_id');
      assert.ok(result.result.usage, 'Should have usage stats');
    });

    it('should handle message array input format', async () => {
      let chatInput = null;
      
      global.fetch = async (url, options) => {
        if (url.includes('/api/v1/chat')) {
          const body = JSON.parse(options.body);
          chatInput = body.input;
          
          assert.ok(Array.isArray(chatInput), 'Should accept array input');
          assert.strictEqual(chatInput.length, 2, 'Should have 2 messages');
          assert.strictEqual(chatInput[0].type, 'message', 'Should have message type');
          
          return {
            ok: true,
            json: async () => ({
              output: [{ type: 'message', content: 'Answer' }],
              stats: { input_tokens: 15, total_output_tokens: 25, reasoning_output_tokens: 0 },
            }),
          };
        }
        if (url.includes('/api/v1/models')) {
          return createMockModelsResponse([{ key: 'test-model', loaded_instances: [] }]);
        }
        if (url.includes('/api/v1/models/load')) {
          return {
            ok: true,
            json: async () => ({ instance_id: 'inst_test_1', load_time_seconds: 1 })
          };
        }
        return createMockErrorResponse('Not an API endpoint', 404);
      };

      const messages = [
        { type: 'message', content: 'Previous message' },
        { type: 'message', content: 'Current question' }
      ];
      
      const result = await lmStudioSwitcher.executeChatCompletion('test-model', messages);
      
      assert.strictEqual(result.success, true, 'Should succeed');
    });

    it('should parse LM Studio v1 response format correctly', async () => {
      global.fetch = async (url, options) => {
        if (url.includes('/api/v1/chat')) {
          return {
            ok: true,
            json: async () => ({
              output: [
                { type: 'message', content: 'Final answer' },
                { type: 'reasoning', content: 'Thinking...' }
              ],
              stats: {
                input_tokens: 20,
                total_output_tokens: 30,
                reasoning_output_tokens: 5,
                tokens_per_second: 60.5,
              },
            }),
          };
        }
        if (url.includes('/api/v1/models')) {
          return createMockModelsResponse([{ key: 'test-model', loaded_instances: [] }]);
        }
        if (url.includes('/api/v1/models/load')) {
          return {
            ok: true,
            json: async () => ({ instance_id: 'inst_test_1', load_time_seconds: 1 })
          };
        }
        return createMockErrorResponse('Not an API endpoint', 404);
      };

      const result = await lmStudioSwitcher.executeChatCompletion('test-model', 'Question?');
      
      assert.strictEqual(result.result.content, 'Final answer', 'Should extract message content');
      assert.strictEqual(result.result.usage.prompt_tokens, 20, 'Should have prompt tokens');
      assert.strictEqual(result.result.usage.completion_tokens, 30, 'Should have completion tokens');
      assert.strictEqual(result.result.tokensPerSecond, 60.5, 'Should have tokens/sec');
    });

    it('should include MCP integrations in request when provided', async () => {
      let chatIntegrations = null;
      
      global.fetch = async (url, options) => {
        if (url.includes('/api/v1/chat')) {
          const body = JSON.parse(options.body);
          chatIntegrations = body.integrations;
          
          assert.ok(Array.isArray(chatIntegrations), 'Should have integrations array');
          assert.strictEqual(chatIntegrations.length, 1, 'Should have 1 integration');
          assert.strictEqual(chatIntegrations[0].type, 'plugin', 'Should be plugin type');
          
          return {
            ok: true,
            json: async () => ({
              output: [{ type: 'message', content: 'Done' }],
              stats: { input_tokens: 10, total_output_tokens: 5, reasoning_output_tokens: 0 },
            }),
          };
        }
        if (url.includes('/api/v1/models')) {
          return createMockModelsResponse([{ key: 'test-model', loaded_instances: [] }]);
        }
        if (url.includes('/api/v1/models/load')) {
          return {
            ok: true,
            json: async () => ({ instance_id: 'inst_test_1', load_time_seconds: 1 })
          };
        }
        return createMockErrorResponse('Not an API endpoint', 404);
      };

      const integrations = [
        {
          type: 'plugin',
          id: 'mcp/playwright',
          allowed_tools: ['browser_navigate']
        }
      ];
      
      const result = await lmStudioSwitcher.executeChatCompletion('test-model', 'Go to google.com', { integrations });
      
      assert.strictEqual(result.success, true, 'Should succeed');
      assert.ok(chatIntegrations, 'Should pass integrations');
    });

    it('should include reasoning parameter when provided', async () => {
      let chatReasoning = null;
      
      global.fetch = async (url, options) => {
        if (url.includes('/api/v1/chat')) {
          const body = JSON.parse(options.body);
          chatReasoning = body.reasoning;
          
          assert.ok(chatReasoning, 'Should have reasoning parameter');
          assert.strictEqual(chatReasoning, 'medium', 'Should be medium level');
          
          return {
            ok: true,
            json: async () => ({
              output: [{ type: 'message', content: 'Answer' }],
              stats: { input_tokens: 10, total_output_tokens: 5, reasoning_output_tokens: 3 },
            }),
          };
        }
        if (url.includes('/api/v1/models')) {
          return createMockModelsResponse([{ key: 'test-model', loaded_instances: [] }]);
        }
        if (url.includes('/api/v1/models/load')) {
          return {
            ok: true,
            json: async () => ({ instance_id: 'inst_test_1', load_time_seconds: 1 })
          };
        }
        return createMockErrorResponse('Not an API endpoint', 404);
      };

      const result = await lmStudioSwitcher.executeChatCompletion('test-model', 'Complex question?', { reasoning: 'medium' });
      
      assert.strictEqual(result.success, true, 'Should succeed');
    });
  });

  describe('Model Recommendation', () => {
    it('should recommend model based on task mapping', async () => {
      global.fetch = async (url) => {
        if (url.includes('/api/v1/models')) {
          return {
            ok: true,
            json: async () => ({
              models: [
                { key: 'model-a', capabilities: { vision: false } },
                { key: 'model-b', capabilities: { vision: true } },
                { key: 'model-c', capabilities: { trained_for_tool_use: true } },
              ]
            }),
          };
        }
        return createMockErrorResponse('Not an API endpoint', 404);
      };

      const dna = {
        taskModelMapping: {
          codeFixes: 'model-a',
          visionAnalysis: 'model-b',
        },
        usageStats: { modelEffectiveness: {} },
      };

      const recommendation = await lmStudioSwitcher.recommendModel('codeFixes', dna);
      
      assert.ok(recommendation.model, 'Should have a recommendation');
      assert.strictEqual(recommendation.taskType, 'codeFixes', 'Should have task type');
      assert.ok(recommendation.rating >= 0, 'Should have a score');
    });

    it('should use historical ratings in scoring', async () => {
      global.fetch = async (url) => {
        if (url.includes('/api/v1/models')) {
          return {
            ok: true,
            json: async () => ({
              models: [{ key: 'model-a', capabilities: {} }]
            }),
          };
        }
        return createMockErrorResponse('Not an API endpoint', 404);
      };

      const dna = {
        taskModelMapping: {},
        usageStats: {
          modelEffectiveness: {
            'model-a': {
              codeFixes: [
                { rating: 5, timestamp: Date.now() },
                { rating: 4, timestamp: Date.now() },
              ]
            }
          }
        },
      };

      const scored = await lmStudioSwitcher.calculateModelScore(
        { key: 'model-a' }, 
        'codeFixes', 
        dna
      );
      
      assert.ok(scored > 30, 'Should have high score from ratings');
    });
  });

  describe('Hardware Detection Integration', () => {
    it('should respect parallel loading limits', async () => {
      global.fetch = async (url) => {
        if (url.includes('/api/v1/models')) {
          return createMockModelsResponse([]);
        }
        return createMockErrorResponse('Not an API endpoint', 404);
      };

      await initializeLMStudioSwitcher();
      
      const stats = lmStudioSwitcher.getUsageStats();
      assert.ok('loadedModels' in stats, 'Should track loaded models');
    });
  });

  describe('Caching', () => {
    it('should clear recommendation cache', async () => {
      global.fetch = async (url) => {
        if (url.includes('/api/v1/models')) {
          return createMockModelsResponse([]);
        }
        return createMockErrorResponse('Not an API endpoint', 404);
      };

      await initializeLMStudioSwitcher();
      
      const stats1 = lmStudioSwitcher.getUsageStats();
      assert.ok(stats1.isConnected, 'Should be connected');
      
      lmStudioSwitcher.clearCache();
      const stats2 = lmStudioSwitcher.getUsageStats();
      
      assert.strictEqual(stats2.cacheSize, 0, 'Recommendation cache should be cleared');
      assert.strictEqual(stats2.modelsCacheAge, null, 'Models cache should be cleared');
    });
  });

  describe('Error Handling', () => {
    it('should handle connection failures gracefully', async () => {
      global.fetch = async () => { throw new Error('Connection refused'); };
      
      const connected = await lmStudioSwitcher.checkConnection();
      assert.ok(!connected, 'Should fail connection on error');
    });

    it('should handle non-ok HTTP responses', async () => {
      global.fetch = async () => ({ 
        ok: false, 
        status: 404,
        text: async () => 'Not Found'
      });
      
      const connected = await lmStudioSwitcher.checkConnection();
      assert.ok(!connected, 'Should fail connection on 404');
    });

    it('should retry on transient failures', async () => {
      let attemptCount = 0;
      
      global.fetch = async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Temporary failure');
        }
        return {
          ok: true,
          json: async () => ({ models: [] }),
        };
      };

      await lmStudioSwitcher.getAvailableModels();
      
      assert.ok(attemptCount >= 3, 'Should retry on failure');
    });
  });
});