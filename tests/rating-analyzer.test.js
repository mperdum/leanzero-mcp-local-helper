/**
 * Rating Analyzer Tests - Phase 5 Evolution & Auto-Optimization
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { RatingAnalyzer } from "../src/services/rating-analyzer.js";
import { createDNAFile, loadModelDNA } from "../src/utils/model-dna-manager.js";

const testDir = "./tests/tmp/test-phase5-rating-analyzer";

describe("RatingAnalyzer", () => {
  let analyzer;

  beforeEach(() => {
    // Create a clean DNA file for testing
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
    
    createDNAFile({}, testDir);
    analyzer = new RatingAnalyzer();
  });

  describe("constructor", () => {
    it("should use default thresholds when no options provided", () => {
      assert.strictEqual(analyzer.thresholds.lowRating, 3.0);
      assert.strictEqual(analyzer.thresholds.excellentRating, 4.5);
      assert.strictEqual(analyzer.thresholds.minRatingsForAnalysis, 5);
    });

    it("should accept custom threshold options", () => {
      const customAnalyzer = new RatingAnalyzer({
        lowRating: 3.5,
        excellentRating: 4.0,
        minRatingsForAnalysis: 10,
      });

      assert.strictEqual(customAnalyzer.thresholds.lowRating, 3.5);
      assert.strictEqual(customAnalyzer.thresholds.excellentRating, 4.0);
      assert.strictEqual(customAnalyzer.thresholds.minRatingsForAnalysis, 10);
    });

    it("should load thresholds from environment variables", () => {
      const oldEnv = process.env.EVOLUTION_LOW_RATING_THRESHOLD;
      process.env.EVOLUTION_LOW_RATING_THRESHOLD = "2.5";
      
      try {
        const envAnalyzer = new RatingAnalyzer();
        assert.strictEqual(envAnalyzer.thresholds.lowRating, 2.5);
      } finally {
        if (oldEnv) {
          process.env.EVOLUTION_LOW_RATING_THRESHOLD = oldEnv;
        } else {
          delete process.env.EVOLUTION_LOW_RATING_THRESHOLD;
        }
      }
    });

    it("should set high variance threshold to 1.0", () => {
      assert.strictEqual(analyzer.highVarianceThreshold, 1.0);
    });
  });

  describe("analyzeModelRatings()", () => {
    it("should return null when no usageStats exist", () => {
      const result = analyzer.analyzeModelRatings({});
      assert.strictEqual(result, null);
    });

    it("should analyze ratings for a single model with one task", () => {
      const dna = {
        usageStats: {
          modelEffectiveness: {
            "test-model": {
              "task-a": [
                { rating: 5 },
                { rating: 4 },
                { rating: 5 },
                { rating: 4 },
                { rating: 5 },
              ],
            },
          },
        },
      };

      const result = analyzer.analyzeModelRatings(dna);

      assert.ok(result);
      assert.strictEqual(result.totalModels, 1);
      assert.strictEqual(result.modelsWithRatings, 1);
      assert.strictEqual(result.totalRatings, 5);
      assert.ok(result.overallAverageRating);
    });

    it("should calculate correct average rating", () => {
      const dna = {
        usageStats: {
          modelEffectiveness: {
            "test-model": {
              "task-a": [
                { rating: 5 },
                { rating: 3 },
                { rating: 4 },
              ],
            },
          },
        },
      };

      const result = analyzer.analyzeModelRatings(dna);

      assert.strictEqual(result.modelAnalysis["test-model"].averageRating, "4.00");
    });

    it("should calculate variance for each task", () => {
      const dna = {
        usageStats: {
          modelEffectiveness: {
            "test-model": {
              "task-a": [
                { rating: 5 },
                { rating: 4 },
                { rating: 3 },
                { rating: 2 },
                { rating: 1 },
              ],
            },
          },
        },
      };

      const result = analyzer.analyzeModelRatings(dna);
      const taskStats = result.modelAnalysis["test-model"].taskBreakdown["task-a"];

      assert.strictEqual(taskStats.ratingCount, 5);
      assert.strictEqual(taskStats.minRating, 1);
      assert.strictEqual(taskStats.maxRating, 5);
      assert.ok(taskStats.variance); // Should have variance value
    });

    it("should handle multiple models with different tasks", () => {
      const dna = {
        usageStats: {
          modelEffectiveness: {
            "model-a": {
              "task-1": [{ rating: 5 }, { rating: 4 }],
              "task-2": [{ rating: 3 }, { rating: 4 }, { rating: 5 }],
            },
            "model-b": {
              "task-1": [{ rating: 4 }, { rating: 4 }, { rating: 4 }],
            },
          },
        },
      };

      const result = analyzer.analyzeModelRatings(dna);

      assert.strictEqual(result.totalModels, 2);
      assert.ok(result.modelAnalysis["model-a"]);
      assert.ok(result.modelAnalysis["model-b"]);
    });

    it("should handle empty ratings arrays", () => {
      const dna = {
        usageStats: {
          modelEffectiveness: {
            "test-model": {
              "empty-task": [],
              "task-with-ratings": [{ rating: 5 }],
            },
          },
        },
      };

      const result = analyzer.analyzeModelRatings(dna);

      assert.ok(result);
      // Should only count tasks with actual ratings
    });

    it("should load DNA from file path when string provided", async () => {
      createDNAFile(
        {},
        testDir
      );
      
      // Manually add usage stats to the DNA file using ES modules import
      const fs = await import('node:fs');
      const dnaManager = await import('../src/utils/model-dna-manager.js');
      const dnaPath = dnaManager.getDNAPath(testDir);
      const dnaContent = {
        taskModelMapping: {},
        models: { "file-model": {} },
        primaryRole: "ninja-researcher",
        version: 3,
        usageStats: {
          modelEffectiveness: {
            "file-model": {
              "file-task": [
                { rating: 5 },
                { rating: 4 },
                { rating: 5 },
                { rating: 4 },
                { rating: 5 },
              ],
            },
          },
        },
      };
      
      fs.writeFileSync(dnaPath, JSON.stringify(dnaContent), 'utf-8');

      const result = analyzer.analyzeModelRatings(testDir);

      assert.ok(result);
      assert.strictEqual(result.totalModels, 1);
    });
  });

  describe("generateSuggestions()", () => {
    it("should return empty array when no analysis provided", () => {
      const suggestions = analyzer.generateSuggestions(null);
      assert.deepStrictEqual(suggestions, []);
    });

    it("should generate low-rating suggestion for poor performers", () => {
      const analysis = {
        modelAnalysis: {
          "poor-model": {
            averageRating: "2.5",
            ratingCount: 10, // Above minimum threshold of 5
            taskBreakdown: {},
          },
        },
      };

      const suggestions = analyzer.generateSuggestions(analysis);

      assert.ok(suggestions.length > 0);
      const lowRatingSuggestion = suggestions.find((s) => s.type === "low-rating");
      assert.ok(lowRatingSuggestion);
      assert.strictEqual(lowRatingSuggestion.modelRole, "poor-model");
    });

    it("should not generate suggestion when rating count is below threshold", () => {
      const analysis = {
        modelAnalysis: {
          "underused-model": {
            averageRating: "2.0", // Below threshold but...
            ratingCount: 3, // ...below minimum of 5 ratings
            taskBreakdown: {},
          },
        },
      };

      const suggestions = analyzer.generateSuggestions(analysis);
      
      // Should not generate low-rating suggestion (underused warning only)
      const lowRatingSuggestion = suggestions.find((s) => s.type === "low-rating");
      assert.ok(!lowRatingSuggestion);
    });

    it("should generate high-variance suggestion for inconsistent models", () => {
      const analysis = {
        modelAnalysis: {
          "inconsistent-model": {
            averageRating: "3.5",
            ratingCount: 10,
            taskBreakdown: {
              "task-a": { variance: "2.5" }, // High variance (>1.0)
              "task-b": { variance: "0.2" },
            },
          },
        },
      };

      const suggestions = analyzer.generateSuggestions(analysis);

      const highVarianceSuggestion = suggestions.find((s) => s.type === "high-variance");
      assert.ok(highVarianceSuggestion);
    });

    it("should generate underused suggestion for models with few ratings", () => {
      const analysis = {
        modelAnalysis: {
          "new-model": {
            averageRating: "4.0",
            ratingCount: 2, // Below minimum of 5
            taskBreakdown: {},
          },
        },
      };

      const suggestions = analyzer.generateSuggestions(analysis);

      const underusedSuggestion = suggestions.find((s) => s.type === "underused");
      assert.ok(underusedSuggestion);
    });

    it("should handle analysis with no actionable issues", () => {
      const analysis = {
        modelAnalysis: {
          "good-model": {
            averageRating: "4.5",
            ratingCount: 10,
            taskBreakdown: {},
          },
        },
      };

      const suggestions = analyzer.generateSuggestions(analysis);
      
      // Should only have underused if rating count < threshold
      assert.ok(suggestions.every((s) => s.type !== "low-rating"));
    });
  });

  describe("createLowRatingSuggestion()", () => {
    it("should create correct suggestion object", () => {
      const suggestion = analyzer.createLowRatingSuggestion(
        "bad-model",
        2.5,
        8
      );

      assert.strictEqual(suggestion.type, "low-rating");
      assert.strictEqual(suggestion.modelRole, "bad-model");
      assert.strictEqual(suggestion.averageRating, 2.5);
      assert.strictEqual(suggestion.ratingCount, 8);
      assert.ok(suggestion.recommendation.includes("bad-model"));
    });

    it("should format average rating to 2 decimal places", () => {
      const suggestion = analyzer.createLowRatingSuggestion(
        "test-model",
        3.14159,
        10
      );

      assert.strictEqual(suggestion.averageRating, 3.14);
    });
  });

  describe("createHighVarianceSuggestion()", () => {
    it("should create correct suggestion object", () => {
      const suggestion = analyzer.createHighVarianceSuggestion(
        "inconsistent-model",
        2.5
      );

      assert.strictEqual(suggestion.type, "high-variance");
      assert.strictEqual(suggestion.modelRole, "inconsistent-model");
      assert.ok(suggestion.recommendation.includes("inconsistent-model"));
    });

    it("should round variance to 3 decimal places", () => {
      const suggestion = analyzer.createHighVarianceSuggestion(
        "test-model",
        1.234567
      );

      assert.strictEqual(suggestion.variance, 1.235);
    });
  });

  describe("createUnderusedSuggestion()", () => {
    it("should create correct suggestion object", () => {
      const suggestion = analyzer.createUnderusedSuggestion(
        "new-model",
        3
      );

      assert.strictEqual(suggestion.type, "underused");
      assert.strictEqual(suggestion.modelRole, "new-model");
      assert.strictEqual(suggestion.ratingCount, 3);
    });

    it("should reference minimum threshold in recommendation", () => {
      const suggestion = analyzer.createUnderusedSuggestion(
        "test-model",
        2
      );

      assert.ok(suggestion.recommendation.includes(analyzer.thresholds.minRatingsForAnalysis));
    });
  });

  describe("filterByType()", () => {
    it("should filter suggestions by type", () => {
      const allSuggestions = [
        { type: "low-rating" },
        { type: "high-variance" },
        { type: "underused" },
        { type: "low-rating" },
      ];

      const filtered = analyzer.filterByType(allSuggestions, "low-rating");
      
      assert.strictEqual(filtered.length, 2);
      assert.ok(filtered.every((s) => s.type === "low-rating"));
    });
  });

  describe("getActionableSuggestions()", () => {
    it("should exclude underused suggestions", () => {
      const allSuggestions = [
        { type: "low-rating" },
        { type: "high-variance" },
        { type: "underused" },
      ];

      const actionable = analyzer.getActionableSuggestions(allSuggestions);
      
      assert.strictEqual(actionable.length, 2);
      assert.ok(!actionable.some((s) => s.type === "underused"));
    });
  });

  describe("formatSuggestions()", () => {
    it("should return message when no suggestions", () => {
      const formatted = analyzer.formatSuggestions([]);
      
      assert.strictEqual(
        formatted,
        "No improvement suggestions at this time."
      );
    });

    it("should format suggestions for display", () => {
      const suggestions = [
        {
          type: "low-rating",
          modelRole: "bad-model",
          recommendation: "Test recommendation",
        },
      ];

      const formatted = analyzer.formatSuggestions(suggestions);
      
      assert.ok(formatted.includes("LOW-RATING"));
      assert.ok(formatted.includes("bad-model"));
      assert.ok(formatted.includes("Test recommendation"));
    });
  });
});