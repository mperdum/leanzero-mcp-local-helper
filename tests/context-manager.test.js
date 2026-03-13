/**
 * Unit tests for Context Manager
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { contextManager, ContextManager } from '../src/services/context-manager.js';

describe('Context Manager', () => {
  describe('truncateContent()', () => {
    it('should truncate long content to token limit', () => {
      const longText = "a".repeat(1000); // 250 tokens
      const result = contextManager.truncateContent(longText, 100); // 400 chars max
      
      assert.ok(result.length <= 410); // Give slight margin for truncation marker
      assert.ok(result.includes("...")); // Should indicate truncation
    });

    it('should not truncate short content', () => {
      const shortText = "Short text";
      const result = contextManager.truncateContent(shortText, 100);
      
      assert.strictEqual(result, shortText);
    });

    it('should handle empty string', () => {
      const result = contextManager.truncateContent("", 100);
      assert.strictEqual(result, "");
    });

    it('should handle null/undefined content', () => {
      assert.strictEqual(contextManager.truncateContent(null, 100), "");
      assert.strictEqual(contextManager.truncateContent(undefined, 100), "");
    });

    it('should truncate at sentence boundary when possible', () => {
      const text = "This is a long sentence. This is another sentence. And another one here.";
      const result = contextManager.truncateContent(text, 2); // Very small limit
      
      // Should end at a sentence boundary
      assert.ok(result.endsWith(".") || result.endsWith("..."));
    });
  });

  describe('estimateTokenCount()', () => {
    it('should estimate string tokens correctly', () => {
      const tokens = contextManager.estimateTokenCount("abcd"); // 4 chars = 1 token
      assert.strictEqual(tokens, 1);
    });

    it('should estimate array tokens', () => {
      const tokens = contextManager.estimateTokenCount([
        { content: "abcd" },
        { content: "efgh" }
      ]);
      assert.strictEqual(tokens, 2);
    });

    it('should estimate object tokens', () => {
      const tokens = contextManager.estimateTokenCount({ key: "value" });
      assert.ok(tokens > 0);
    });

    it('should handle null/undefined', () => {
      assert.strictEqual(contextManager.estimateTokenCount(null), 0);
      assert.strictEqual(contextManager.estimateTokenCount(undefined), 0);
    });

    it('should handle number values', () => {
      const tokens = contextManager.estimateTokenCount(12345);
      assert.strictEqual(tokens, 0); // Numbers don't count as tokens
    });
  });

  describe('validateContextSize()', () => {
    it('should validate context within limit', () => {
      const context = { history: [{ content: "short" }] };
      const validation = contextManager.validateContextSize(context);
      
      assert.strictEqual(validation.valid, true);
    });

    it('should reject context over limit', () => {
      // 40000 characters ≈ 10000 tokens, exceeds 8000 token limit
      const context = { large: "a".repeat(40000) };
      const validation = contextManager.validateContextSize(context);
      
      assert.strictEqual(validation.valid, false);
      assert.ok(validation.overflow > 0);
    });

    it('should return token count in validation', () => {
      const context = { key: "value" };
      const validation = contextManager.validateContextSize(context);
      
      assert.ok(validation.tokenCount > 0);
      assert.strictEqual(validation.limit, contextManager.maxContextTokens);
    });
  });

  describe('deepTruncate()', () => {
    it('should truncate nested objects', () => {
      const deep = { a: { b: { c: { d: "value" } } } };
      const result = contextManager.deepTruncate(deep, 10);
      
      assert.ok(typeof result === 'object');
      assert.ok(result !== deep); // Should be new object
    });

    it('should truncate arrays', () => {
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = contextManager.deepTruncate(arr, 5);
      
      assert.ok(result.length < arr.length);
    });

    it('should handle strings in deep truncate', () => {
      const obj = { text: "a".repeat(1000) };
      const result = contextManager.deepTruncate(obj, 50);
      
      // With 50 token limit (~200 chars), the 1000-char string should be truncated
      assert.ok(result.text.length < obj.text.length);
    });
  });

  describe('truncateContext()', () => {
    it('should not truncate small contexts', () => {
      const context = { key: "value" };
      const result = contextManager.truncateContext(context);
      
      assert.strictEqual(result._truncated, false);
    });

    it('should truncate large contexts', () => {
      // 40000+40000 chars ≈ 20000 tokens, exceeds 8000 limit
      const context = { 
        data: "a".repeat(40000),
        more: "b".repeat(40000)
      };
      const result = contextManager.truncateContext(context);
      
      assert.strictEqual(result._truncated, true);
      assert.ok(result.originalTokenEstimate > result.truncatedTokenEstimate);
    });
  });

  describe('extractKeyInformation()', () => {
    it('should extract from conversation history', () => {
      const history = [
        { role: "user", content: "Hello", timestamp: "2024-01-01T00:00:00Z" },
        { role: "assistant", content: "Hi there!", timestamp: "2024-01-01T00:00:01Z" },
        { role: "user", content: "How are you?", timestamp: "2024-01-01T00:00:02Z" }
      ];
      
      const result = contextManager.extractKeyInformation(history);
      
      assert.ok(Array.isArray(result.keyPoints));
      assert.strictEqual(result.keyPoints.length, 3);
      assert.ok(result.totalTokens > 0);
    });

    it('should limit to recent messages', () => {
      const history = Array(20).fill(null).map((_, i) => ({
        role: "user",
        content: `Message ${i}`,
        timestamp: new Date().toISOString()
      }));
      
      const result = contextManager.extractKeyInformation(history);
      
      assert.ok(result.keyPoints.length <= 10);
    });
  });

  describe('buildHandoffContext()', () => {
    it('should build context with task summary', () => {
      const taskHistory = [
        { role: "user", content: "Fix my code" },
        { role: "assistant", content: "I'll fix it" }
      ];
      
      const result = contextManager.buildHandoffContext("ninjaResearcher", taskHistory);
      
      assert.ok(result.context.taskSummary);
      assert.strictEqual(result.context.previousModel.purpose, "ninjaResearcher");
      assert.ok(result.estimatedTokens > 0);
    });

    it('should handle empty task history', () => {
      const result = contextManager.buildHandoffContext("model", []);
      
      assert.strictEqual(result.context.taskSummary, "No recent task history");
    });
  });

  describe('summarizeTask()', () => {
    it('should summarize recent tasks', () => {
      const taskHistory = [
        { content: "Fix the authentication bug" },
        { content: "Add user profile page" },
        { content: "Implement caching" }
      ];
      
      const summary = contextManager.summarizeTask(taskHistory);
      
      assert.ok(summary.includes("Recent tasks:"));
    });

    it('should handle empty history', () => {
      const summary = contextManager.summarizeTask([]);
      assert.strictEqual(summary, "No recent task history");
    });
  });

  describe('buildSystemPrompt()', () => {
    it('should build valid system prompt', () => {
      const context = { test: "data" };
      const prompt = contextManager.buildSystemPrompt(context, "codeExecution");
      
      assert.ok(prompt.includes("codeExecution"));
      assert.ok(prompt.includes("Previous context:"));
    });

    it('should handle oversized context', () => {
      const largeContext = { 
        data: "a".repeat(20000), 
        more: "b".repeat(20000) 
      };
      
      // Should auto-truncate
      const prompt = contextManager.buildSystemPrompt(largeContext, "general");
      
      // The prompt should be generated (with potential warnings)
      assert.ok(prompt.length > 0);
    });
  });

  describe('getTokenLimit() / setTokenLimit()', () => {
    it('should return default token limit', () => {
      const limit = contextManager.getTokenLimit();
      assert.strictEqual(limit, 8000);
    });

    it('should update token limit', () => {
      contextManager.setTokenLimit(4000);
      assert.strictEqual(contextManager.getTokenLimit(), 4000);
      
      // Reset to default
      contextManager.setTokenLimit(8000);
    });
  });

  describe('getCurrentState()', () => {
    it('should return last message state', () => {
      const taskHistory = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" }
      ];
      
      const state = contextManager.getCurrentState(taskHistory);
      
      assert.strictEqual(state.lastRole, "assistant");
      assert.ok(state.lastContentPreview);
    });

    it('should handle empty history', () => {
      const state = contextManager.getCurrentState([]);
      
      assert.strictEqual(state.status, "no-history");
    });
  });
});
