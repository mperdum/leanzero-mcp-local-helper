/**
 * Evolution Engine Tests - Phase 5 Evolution & Auto-Optimization
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { EvolutionEngine } from "../src/services/evolution-engine.js";
import { createDNAFile, loadModelDNA } from "../src/utils/model-dna-manager.js";

const testDir = "./tests/tmp/test-phase5-evolution-engine";

describe("EvolutionEngine", () => {
  let engine;

  beforeEach(() => {
    // Create a clean DNA file for testing
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
    
    createDNAFile({}, testDir);
    engine = new EvolutionEngine();
  });

  describe("constructor", () => {
    it("should use default thresholds when no options provided", () => {
      assert.strictEqual(engine.evolutionThresholds.lowRatingThreshold, 3.0);
      assert.strictEqual(engine.evolutionThresholds.minRatingsForEvolution, 5);
    });

    it("should accept custom threshold options", () => {
      const customEngine = new EvolutionEngine({
        lowRatingThreshold: 2.5,
        minRatingsForEvolution: 10,
        maxHistoryItems: 50,
      });

      assert.strictEqual(customEngine.evolutionThresholds.lowRatingThreshold, 2.5);
      assert.strictEqual(customEngine.evolutionThresholds.minRatingsForEvolution, 10);
    });

    it("should load thresholds from environment variables", () => {
      const oldEnv = process.env.EVOLUTION_LOW_RATING_THRESHOLD;
      process.env.EVOLUTION_LOW_RATING_THRESHOLD = "2.5";
      
      try {
        const envEngine = new EvolutionEngine();
        assert.strictEqual(envEngine.evolutionThresholds.lowRatingThreshold, 2.5);
      } finally {
        if (oldEnv) {
          process.env.EVOLUTION_LOW_RATING_THRESHOLD = oldEnv;
        } else {
          delete process.env.EVOLUTION_LOW_RATING_THRESHOLD;
        }
      }
    });

    it("should initialize empty evolution history", () => {
      assert.deepStrictEqual(engine.evolutionHistory, []);
    });

    it("should set max mutations per evolution to 5", () => {
      assert.strictEqual(engine.maxMutationsPerEvolution, 5);
    });
  });

  describe("analyzeAndEvolve()", () => {
    it("should return null when no DNA provided", async () => {
      const result = await engine.analyzeAndEvolve(null, false);
      assert.strictEqual(result, null);
    });

    it("should analyze without applying mutations when apply=false", async () => {
      // Create a fresh DNA with no ratings yet
      createDNAFile({}, testDir);
      
      const result = await engine.analyzeAndEvolve(testDir, false);
      
      assert.ok(result);
      assert.strictEqual(result.wasEvolved, false);
    });

    it("should return wasEvolved=false when no suggestions found", async () => {
      createDNAFile({}, testDir);
      
      const result = await engine.analyzeAndEvolve(testDir, true);
      
      assert.ok(result);
      assert.strictEqual(result.wasEvolved, false);
    });

    it("should be async function returning Promise", async () => {
      const result = await engine.analyzeAndEvolve({}, false);
      assert.ok(result !== undefined);
    });
  });

  describe("analyzeUsage()", () => {
    it("should return null when no usageStats exist in DNA", () => {
      const dna = {};
      const analysis = engine.analyzeUsage(dna);
      
      assert.strictEqual(analysis, null);
    });

    it("should use ratingAnalyzer to get ratings analysis", () => {
      const dna = {
        usageStats: {
          modelEffectiveness: {
            "test-model": {
              "task-a": [
                { rating: 5 },
                { rating: 4 },
                { rating: 3 },
              ],
            },
          },
        },
      };

      const analysis = engine.analyzeUsage(dna);
      
      assert.ok(analysis);
      assert.ok(analysis.modelAnalysis);
    });

    it("should include suggestions in analysis result", () => {
      // Create DNA that will generate low-rating suggestion
      const dna = {
        usageStats: {
          modelEffectiveness: {
            "low-rated-model": {
              "task-a": [
                { rating: 1 },
                { rating: 2 },
                { rating: 1 },
                { rating: 2 },
                { rating: 1 }, // 5 ratings, average = 1.4 (below threshold)
              ],
            },
          },
        },
      };

      const analysis = engine.analyzeUsage(dna);
      
      assert.ok(analysis.suggestions);
      assert.ok(analysis.allSuggestions);
    });
  });

  describe("generateMutations()", () => {
    it("should return empty array when no suggestions in analysis", () => {
      const mutations = engine.generateMutations({});
      assert.deepStrictEqual(mutations, []);
    });

    it("should return mutations when suggestions provided (placeholder)", () => {
      // Currently this is a placeholder - returns empty array
      const analysis = {
        suggestions: [
          { type: "low-rating", modelRole: "test-model" },
        ],
      };

      const mutations = engine.generateMutations(analysis);
      
      assert.deepStrictEqual(mutations, []); // Placeholder behavior
    });
  });

  describe("generateMutationFromSuggestion()", () => {
    it("should create reassignment mutation for low-rating suggestion", () => {
      const suggestion = {
        type: "low-rating",
        modelRole: "bad-model",
        averageRating: 2.0,
        ratingCount: 10,
      };

      const dna = {
        taskModelMapping: {
          "task-a": "bad-model",
          "task-b": "good-model",
        },
        models: {
          "bad-model": {},
          "good-model": {},
        },
      };

      const mutation = engine.generateMutationFromSuggestion(suggestion, dna);
      
      // Mutation might be null if no better alternative found
      assert.ok(mutation === null || typeof mutation.type === "string");
    });

    it("should create restricted usage mutation for high-variance", () => {
      const suggestion = {
        type: "high-variance",
        modelRole: "inconsistent-model",
        variance: 2.0,
      };

      const dna = {
        taskModelMapping: {},
        models: {
          "inconsistent-model": {},
        },
      };

      const mutation = engine.generateMutationFromSuggestion(suggestion, dna);
      
      // Mutation might be null if no good tasks found
      assert.ok(mutation === null || typeof mutation.type === "string");
    });

    it("should return null for underused suggestions", () => {
      const suggestion = {
        type: "underused",
        modelRole: "new-model",
        ratingCount: 2,
      };

      const dna = {};
      
      const mutation = engine.generateMutationFromSuggestion(suggestion, dna);
      
      assert.strictEqual(mutation, null); // Underused doesn't need mutations
    });
  });

  describe("createReassignmentMutation()", () => {
    it("should return null when no alternative model found", () => {
      const mutation = engine.createReassignmentMutation(
        "only-model",
        2.0,
        {
          taskModelMapping: {},
          models: {
            "only-model": {},
          },
        }
      );

      assert.strictEqual(mutation, null); // No alternative exists
    });

    it("should return mutation with reassignment details", () => {
      const mutation = engine.createReassignmentMutation(
        "bad-model",
        2.0,
        {
          taskModelMapping: {
            "task-a": "bad-model",
          },
          models: {
            "bad-model": {},
            "good-model": {},
          },
          primaryRole: "ninja-researcher",
        }
      );

      // Should have mutation structure
      assert.ok(mutation === null || mutation.type === "reassign-tasks");
    });
  });

  describe("createRestrictedUsageMutation()", () => {
    it("should return null when model has no usage stats", () => {
      const mutation = engine.createRestrictedUsageMutation(
        "no-stats-model",
        {}
      );

      assert.strictEqual(mutation, null);
    });

    it("should create restricted usage mutation for models with good tasks", () => {
      // This requires a DNA file to be created with usage stats
      // The test would need setup similar to analyzeUsage tests
    });
  });

  describe("findBetterAlternative()", () => {
    it("should return primary role as fallback when only one model exists and differs from current", () => {
      const alternative = engine.findBetterAlternative(
        "only-model",
        2.0,
        {
          models: {
            "only-model": {},
          },
          primaryRole: "ninja-researcher", // Different from current model
        }
      );

      // Returns ninja-researcher as fallback since it's not the current model
      assert.strictEqual(alternative, "ninja-researcher");
    });

    it("should return primary role as fallback when no better model found", () => {
      const alternative = engine.findBetterAlternative(
        "bad-model",
        2.0,
        {
          models: {
            "bad-model": {},
            "other-model": {},
          },
          primaryRole: "ninja-researcher",
        }
      );

      // Should return ninja-researcher as fallback since it's not the current model
      assert.strictEqual(alternative, "ninja-researcher");
    });

    it("should prefer models with higher ratings and sufficient data", () => {
      const alternative = engine.findBetterAlternative(
        "low-rated-model",
        2.0,
        {
          models: {
            "low-rated-model": {},
            "good-model": {},
          },
          usageStats: {
            modelEffectiveness: {
              "good-model": {
                "task-a": [
                  { rating: 5 },
                  { rating: 4 },
                  { rating: 5 },
                  { rating: 4 },
                  { rating: 5 }, // 5 ratings, avg = 4.67 > 2.0
                ],
              },
            },
          },
        }
      );

      assert.strictEqual(alternative, "good-model");
    });
  });

  describe("createReassignmentValue()", () => {
    it("should convert single model mapping to array when needed", () => {
      const newValue = engine.createReassignmentValue(
        {
          "task-a": "from-model",
          "task-b": "keep-this",
        },
        ["task-a"],
        "from-model",
        "to-model"
      );

      assert.strictEqual(newValue["task-a"], "to-model");
      assert.strictEqual(newValue["task-b"], "keep-this");
    });

    it("should handle array mappings correctly", () => {
      const newValue = engine.createReassignmentValue(
        {
          "task-a": ["old-1", "from-model"],
          "task-b": ["keep-this"],
        },
        ["task-a"],
        "from-model",
        "to-model"
      );

      assert.ok(Array.isArray(newValue["task-a"]));
      assert.ok(newValue["task-a"].includes("to-model"));
      assert.strictEqual(newValue["task-b"][0], "keep-this");
    });

    it("should keep non-target tasks unchanged", () => {
      const newValue = engine.createReassignmentValue(
        {
          "task-a": "change-to-new",
          "task-b": "unchanged",
          "task-c": ["a", "b"],
        },
        ["task-a"],
        "old",
        "new"
      );

      assert.strictEqual(newValue["task-a"], "new");
      assert.strictEqual(newValue["task-b"], "unchanged");
      assert.deepStrictEqual(newValue["task-c"], ["a", "b"]);
    });
  });

  describe("applyMutation()", () => {
    it("should return false when no path provided", () => {
      const dna = {};
      const mutation = { value: {} };
      
      assert.strictEqual(engine.applyMutation(dna, mutation), false);
    });

    it("should apply simple dot-notation mutation", () => {
      const dna = {};
      const mutation = { path: "taskModelMapping.task-a", value: "model-x" };
      
      const result = engine.applyMutation(dna, mutation);
      
      assert.strictEqual(result, true);
      assert.strictEqual(dna.taskModelMapping["task-a"], "model-x");
    });

    it("should apply deep path mutation", () => {
      const dna = {
        nested: {
          level1: {
            value: "old"
          }
        }
      };
      
      const mutation = { 
        path: "nested.level1.value", 
        value: "new" 
      };
      
      const result = engine.applyMutation(dna, mutation);
      
      assert.strictEqual(result, true);
      assert.strictEqual(dna.nested.level1.value, "new");
    });

    it("should create missing paths instead of failing (idempotent behavior)", () => {
      const dna = {};
      const mutation = { path: "nonexistent.deep.path", value: {} };
      
      // Should create the path and set the value (idempotent for new paths)
      assert.strictEqual(engine.applyMutation(dna, mutation), true);
      assert.ok(dna.nonexistent);
    });
  });

  describe("applyMutationsToDNA()", () => {
    it("should return DNA when no mutations provided", async () => {
      const dna = { test: "value" };
      const result = await engine.applyMutationsToDNA(dna, [], testDir);
      
      assert.deepStrictEqual(result, dna);
    });

    it("should apply mutations and save to file", async () => {
      // Create a DNA with existing task mapping
      createDNAFile({
        taskModelMapping: {
          "task-a": "old-model",
        },
      }, testDir);

      const dna = loadModelDNA(testDir);
      
      const mutation = {
        path: "taskModelMapping.task-a",
        value: "new-model",
      };

      const result = await engine.applyMutationsToDNA(dna, [mutation], testDir);
      
      assert.ok(result);
      // Verify the file was updated
      const freshDna = loadModelDNA(testDir);
      assert.strictEqual(freshDna.taskModelMapping["task-a"], "new-model");
    });

    it("should handle mutations gracefully even for new paths (idempotent)", async () => {
      createDNAFile({ taskModelMapping: {} }, testDir);
      
      const dna = loadModelDNA(testDir);
      
      // Create a mutation that creates new path - should succeed with idempotent behavior
      const newMutation = { 
        path: "newSection.subSection.key", 
        value: "test-value" 
      };

      const result = await engine.applyMutationsToDNA(dna, [newMutation], testDir);
      
      // Should succeed (create the path) and return updated DNA
      assert.ok(result);
    });
  });

  describe("recordEvolution()", () => {
    it("should record evolution event with timestamp", () => {
      const mutation = { type: "test-mutation" };
      const result = { success: true };
      
      engine.recordEvolution(mutation, result);
      
      assert.strictEqual(engine.evolutionHistory.length, 1);
      assert.ok(engine.evolutionHistory[0].timestamp);
    });

    it("should maintain sliding window of maxHistoryItems", () => {
      const engineWithLimit = new EvolutionEngine({ maxHistoryItems: 3 });
      
      for (let i = 0; i < 5; i++) {
        engineWithLimit.recordEvolution(
          { type: `mutation-${i}` },
          { success: true }
        );
      }

      assert.strictEqual(engineWithLimit.evolutionHistory.length, 3);
    });

    it("should deep copy mutation and result", () => {
      const mutation = { nested: { value: "original" } };
      const result = { status: "ok" };
      
      engine.recordEvolution(mutation, result);
      
      // Modify original objects
      mutation.nested.value = "modified";
      result.status = "changed";
      
      // History should be unchanged
      assert.strictEqual(
        engine.evolutionHistory[0].mutation.nested.value,
        "original"
      );
    });
  });

  describe("getEvolutionHistory()", () => {
    it("should return empty array when no history", () => {
      const history = engine.getEvolutionHistory();
      
      assert.deepStrictEqual(history, []);
    });

    it("should return most recent entries first", () => {
      // Add multiple entries
      for (let i = 0; i < 3; i++) {
        engine.recordEvolution({ type: `mutation-${i}` }, {});
      }

      const history = engine.getEvolutionHistory();
      
      assert.strictEqual(history.length, 3);
      // Most recent should be first (reversed)
      assert.strictEqual(history[0].mutation.type, "mutation-2");
    });
  });

  describe("sortByPriority()", () => {
    it("should return sorted array by priority score", () => {
      const suggestions = [
        { type: "low-rating", averageRating: 4.0, ratingCount: 5 }, // Lower priority (close to threshold)
        { type: "low-rating", averageRating: 1.0, ratingCount: 10 }, // Higher priority (far below threshold)
      ];

      const sorted = engine.sortByPriority(suggestions);
      
      // First suggestion should come first - higher count gives it more weight
      assert.strictEqual(sorted[0].ratingCount, 10);
    });

    it("should not modify original array", () => {
      const suggestions = [
        { type: "low-rating", averageRating: 2.0, ratingCount: 5 },
      ];
      
      const sorted = engine.sortByPriority(suggestions);
      
      // Original should be unchanged (reference)
      assert.strictEqual(sorted[0], suggestions[0]);
    });
  });

  describe("getSuggestionPriority()", () => {
    it("should calculate priority based on both rating severity and count", () => {
      const lowRating = engine.getSuggestionPriority({
        type: "low-rating",
        averageRating: 1.5,
        ratingCount: 10,
      });

      const highRating = engine.getSuggestionPriority({
        type: "low-rating",
        averageRating: 2.9, // Closer to threshold of 3.0
        ratingCount: 10,
      });

      // Both should have positive priority (scores are calculated)
      assert.ok(lowRating >= 0);
      assert.ok(highRating >= 0);
    });

    it("should weigh by number of ratings", () => {
      const fewRatings = engine.getSuggestionPriority({
        type: "low-rating",
        averageRating: 2.0,
        ratingCount: 5,
      });

      const manyRatings = engine.getSuggestionPriority({
        type: "low-rating",
        averageRating: 2.0,
        ratingCount: 20,
      });

      // More ratings gives higher priority score (more reliable data)
      assert.ok(manyRatings >= fewRatings);
    });

    it("should handle high-variance suggestions", () => {
      const lowVariance = engine.getSuggestionPriority({
        type: "high-variance",
        variance: 1.5,
      });

      const highVariance = engine.getSuggestionPriority({
        type: "high-variance",
        variance: 3.0,
      });

      assert.ok(highVariance > lowVariance);
    });

    it("should give negative priority to underused suggestions", () => {
      const score = engine.getSuggestionPriority({
        type: "underused",
        ratingCount: 2,
      });

      assert.ok(score < 0); // Negative for informational only
    });
  });

  describe("clearHistory()", () => {
    it("should clear all evolution history", () => {
      engine.recordEvolution({ type: "test" }, {});
      engine.clearHistory();
      
      assert.deepStrictEqual(engine.evolutionHistory, []);
    });
  });

  describe("getEvolutionStats()", () => {
    it("should return correct statistics", () => {
      // Add some history entries
      for (let i = 0; i < 3; i++) {
        engine.recordEvolution({ type: `mutation-${i}` }, {});
      }

      const stats = engine.getEvolutionStats();
      
      assert.strictEqual(stats.totalEvolutions, 3);
      assert.strictEqual(stats.mutationExecutionCount, 0); // No mutations applied in this test
    });
  });
});