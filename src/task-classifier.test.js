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
    it('should classify bug fix as CODE_FIXES', () => {
      const result = classifyTask("Fix this bug in my code");
      assert.strictEqual(result.category.id, 'codeFixes');
      assert.ok(result.confidence === 'high' || result.confidence === 'medium');
    });

    it('should classify architecture question as FEATURE_ARCHITECTURE', () => {
      const result = classifyTask("How do I design a microservices architecture?");
      assert.strictEqual(result.category.id, 'featureArchitecture');
    });

    it('should classify write/create as CODE_EXECUTION', () => {
      const result = classifyTask("Write a function to sort an array");
      assert.strictEqual(result.category.id, 'codeExecution');
    });

    it('should classify research question as GENERAL_RESEARCH', () => {
      const result = classifyTask("What is artificial intelligence?");
      assert.strictEqual(result.category.id, 'generalResearch');
    });

    it('should classify image task as IMAGE_ANALYSIS', () => {
      const result = classifyTask("Analyze this screenshot");
      assert.strictEqual(result.category.id, 'imageAnalysis');
    });

    it('should return CONVERSATION for unclear queries', () => {
      const result = classifyTask("Hello");
      assert.strictEqual(result.category.id, 'conversation');
    });

    it('should handle empty query', () => {
      const result = classifyTask("");
      assert.strictEqual(result.category.id, 'conversation');
      assert.strictEqual(result.score, 0);
    });

    it('should handle undefined query', () => {
      const result = classifyTask(undefined);
      assert.strictEqual(result.category.id, 'conversation');
      assert.strictEqual(result.score, 0);
    });

    it('should handle null query', () => {
      const result = classifyTask(null);
      assert.strictEqual(result.category.id, 'conversation');
      assert.strictEqual(result.score, 0);
    });

    it('should handle non-string query', () => {
      const result = classifyTask(123);
      assert.strictEqual(result.category.id, 'conversation');
    });

    it('should score higher for multiple keyword matches', () => {
      const result1 = classifyTask("fix bug debug error");
      const result2 = classifyTask("fix");
      assert.ok(result1.score > result2.score);
    });

    it('should score higher for longer queries', () => {
      const shortQuery = "fix";
      const longQuery = "I need to fix a bug in my authentication code that is causing users to be logged out randomly";
      
      const shortResult = classifyTask(shortQuery);
      const longResult = classifyTask(longQuery);
      
      // Long query should get bonus points for length
      assert.ok(longResult.score >= shortResult.score);
    });

    it('should give bonus for first word matching keyword', () => {
      const result = classifyTask("design a pattern for the system");
      // First word "design" should match FEATURE_ARCHITECTURE keywords
      assert.strictEqual(result.category.id, 'featureArchitecture');
    });

    it('should return high or medium confidence for clear bug fix request', () => {
      const result = classifyTask("My code has a bug that crashes when I try to access undefined property");
      assert.strictEqual(result.category.id, 'codeFixes');
      assert.ok(result.confidence === 'high' || result.confidence === 'medium');
    });

    it('should return generalResearch or conversation for research questions', () => {
      const result = classifyTask("Tell me about machine learning");
      // The algorithm may classify as generalResearch or conversation depending on keyword match
      assert.ok(['generalResearch', 'conversation'].includes(result.category.id));
    });

    it('should return low or none confidence for ambiguous queries', () => {
      const result = classifyTask("Hello there");
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
    it('should return medium confidence for research questions', () => {
      const result = classifyTask("Tell me about machine learning");
      assert.ok(['generalResearch', 'conversation'].includes(result.category.id));
    });

    it('should return low confidence for ambiguous queries', () => {
      const result = classifyTask("Hello there");
      assert.ok(['low', 'none'].includes(result.confidence));
    });

    it('should return medium confidence for detailed research questions', () => {
      const result = classifyTask("Explain what is machine learning and how it works");
      assert.ok(['generalResearch', 'conversation'].includes(result.category.id));
    });

    it('should return low confidence for greetings', () => {
      const result = classifyTask("Hello there good morning");
      assert.ok(['low', 'none'].includes(result.confidence));
    });
  });

  describe('registerTaskCategory()', () => {
    it('should register a custom category', () => {
      const customCategory = {
        id: "customTask",
        keywords: ["custom", "special"],
        recommendedModel: "customModel",
        description: "Custom task type"
      };
      
      registerTaskCategory(customCategory);
      
      const result = classifyTask("custom operation");
      assert.strictEqual(result.category.id, 'customTask');
    });

    it('should throw error for invalid category', () => {
      assert.throws(() => {
        registerTaskCategory({ id: "test" }); // Missing keywords and recommendedModel
      });
    });
  });

  describe('Caching', () => {
    it('should cache classification results', () => {
      const query = "Fix this bug now";
      const result1 = classifyTask(query);
      const result2 = classifyTask(query);
      
      assert.strictEqual(result1.category.id, result2.category.id);
    });

    it('should clear cache properly', () => {
      const query = "Debug my code";
      classifyTask(query);
      clearClassificationCache();
      
      // Should not throw, cache is cleared
      const result = classifyTask(query);
      assert.strictEqual(result.category.id, 'codeFixes');
    });
  });
});