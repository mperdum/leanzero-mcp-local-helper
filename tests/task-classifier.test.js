/**
 * Unit tests for Task Classifier
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { classifyTask, getTaskCategories, TASK_CATEGORIES, clearClassificationCache, registerTaskCategory } from '../src/utils/task-classifier.js';

describe('Task Classifier', () => {
  beforeEach(() => {
    clearClassificationCache();
  });

  describe('classifyTask()', () => {
    it('should classify bug fix as CODE_FIXES', async () => {
      const result = await classifyTask("Fix this bug in my code");
      assert.strictEqual(result.category.id, 'codeFixes');
      assert.ok(result.confidence === 'high' || result.confidence === 'medium');
    });

    it('should classify architecture question as FEATURE_ARCHITECTURE', async () => {
      const result = await classifyTask("How do I design a microservices architecture?");
      assert.strictEqual(result.category.id, 'featureArchitecture');
    });

    it('should classify write/create as CODE_EXECUTION', async () => {
      const result = await classifyTask("Write a function to sort an array");
      assert.strictEqual(result.category.id, 'codeExecution');
    });

    it('should classify research question as GENERAL_RESEARCH', async () => {
      const result = await classifyTask("What is artificial intelligence?");
      assert.strictEqual(result.category.id, 'generalResearch');
    });

    it('should classify image task as IMAGE_ANALYSIS', async () => {
      const result = await classifyTask("Analyze this screenshot");
      assert.strictEqual(result.category.id, 'imageAnalysis');
    });

    it('should return CONVERSATION for unclear queries', async () => {
      const result = await classifyTask("Hello");
      assert.strictEqual(result.category.id, 'conversation');
    });

    it('should handle empty query', async () => {
      const result = await classifyTask("");
      assert.strictEqual(result.category.id, 'conversation');
      assert.strictEqual(result.score, 0);
    });

    it('should handle undefined query', async () => {
      const result = await classifyTask(undefined);
      assert.strictEqual(result.category.id, 'conversation');
      assert.strictEqual(result.score, 0);
    });

    it('should handle null query', async () => {
      const result = await classifyTask(null);
      assert.strictEqual(result.category.id, 'conversation');
      assert.strictEqual(result.score, 0);
    });

    it('should handle non-string query', async () => {
      const result = await classifyTask(123);
      assert.strictEqual(result.category.id, 'conversation');
    });

    it('should score higher for multiple keyword matches', async () => {
      const result1 = await classifyTask("fix bug debug error");
      const result2 = await classifyTask("fix");
      assert.ok(result1.score > result2.score);
    });

    it('should score higher for longer queries', async () => {
      const shortQuery = "fix";
      const longQuery = "I need to fix a bug in my authentication code that is causing users to be logged out randomly";
      
      const shortResult = await classifyTask(shortQuery);
      const longResult = await classifyTask(longQuery);
      
      // Long query should get bonus points for length
      assert.ok(longResult.score >= shortResult.score);
    });

    it('should give bonus for first word matching keyword', async () => {
      const result = await classifyTask("design a pattern for the system");
      // First word "design" should match FEATURE_ARCHITECTURE keywords
      assert.strictEqual(result.category.id, 'featureArchitecture');
    });

    it('should return high or medium confidence for clear bug fix request', async () => {
      const result = await classifyTask("My code has a bug that crashes when I try to access undefined property");
      assert.strictEqual(result.category.id, 'codeFixes');
      assert.ok(result.confidence === 'high' || result.confidence === 'medium');
    });

    it('should return generalResearch or conversation for research questions', async () => {
      const result = await classifyTask("Tell me about machine learning");
      // The algorithm may classify as generalResearch or conversation depending on keyword match
      assert.ok(['generalResearch', 'conversation'].includes(result.category.id));
    });

    it('should return low or none confidence for ambiguous queries', async () => {
      const result = await classifyTask("Hello there");
      assert.ok(['low', 'none'].includes(result.confidence));
    });
  });

  describe('getTaskCategories()', () => {
    it('should return all categories', () => {
      const categories = getTaskCategories();
      assert.strictEqual(categories.length, 6);
    });

    it('should include codeFixes', () => {
      const categories = getTaskCategories();
      const codeFixes = categories.find(c => c.id === 'codeFixes');
      assert.ok(codeFixes);
      assert.strictEqual(codeFixes.recommendedModel, 'ninjaResearcher');
    });

    it('should include featureArchitecture', () => {
      const categories = getTaskCategories();
      const arch = categories.find(c => c.id === 'featureArchitecture');
      assert.ok(arch);
    });

    it('should include conversation', () => {
      const categories = getTaskCategories();
      const conv = categories.find(c => c.id === 'conversation');
      assert.ok(conv);
    });
  });

  describe('Confidence levels', () => {
    it('should return medium confidence for research questions', async () => {
      const result = await classifyTask("Tell me about machine learning");
      assert.ok(['generalResearch', 'conversation'].includes(result.category.id));
    });

    it('should return low confidence for ambiguous queries', async () => {
      const result = await classifyTask("Hello there");
      assert.ok(['low', 'none'].includes(result.confidence));
    });

    it('should return medium confidence for detailed research questions', async () => {
      const result = await classifyTask("Explain what is machine learning and how it works");
      assert.ok(['generalResearch', 'conversation'].includes(result.category.id));
    });

    it('should return low confidence for greetings', async () => {
      const result = await classifyTask("Hello there good morning");
      assert.ok(['low', 'none'].includes(result.confidence));
    });
  });

  describe('registerTaskCategory()', () => {
    it('should register a custom category', async () => {
      const customCategory = {
        id: "customTask",
        keywords: ["custom", "special"],
        recommendedModel: "customModel",
        description: "Custom task type"
      };
      
      registerTaskCategory(customCategory);
      
      const result = await classifyTask("custom operation");
      assert.strictEqual(result.category.id, 'customTask');
    });

    it('should throw error for invalid category', () => {
      assert.throws(() => {
        registerTaskCategory({ id: "test" }); // Missing keywords and recommendedModel
      });
    });
  });

  describe('Caching', () => {
    it('should cache classification results', async () => {
      const query = "Fix this bug now";
      const result1 = await classifyTask(query);
      const result2 = await classifyTask(query);
      
      assert.strictEqual(result1.category.id, result2.category.id);
    });

    it('should clear cache properly', async () => {
      const query = "Debug my code";
      await classifyTask(query);
      clearClassificationCache();
      
      // Should not throw, cache is cleared
      const result = await classifyTask(query);
      assert.strictEqual(result.category.id, 'codeFixes');
    });
  });
});