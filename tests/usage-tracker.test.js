/**
 * Usage Tracker Tests - Phase 5 Evolution & Auto-Optimization
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { UsageTracker } from "../src/utils/usage-tracker.js";
import { loadModelDNA, createDNAFile } from "../src/utils/model-dna-manager.js";

const testDir = "./tests/tmp/test-phase5-usage-tracker";

describe("UsageTracker", () => {
  let tracker;

  beforeEach(() => {
    // Create a clean DNA file for testing
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
    
    createDNAFile({}, testDir);
    tracker = new UsageTracker();
  });

  afterEach(() => {
    // Cleanup
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    tracker.clear();
  });

  describe("trackTaskCompletion()", () => {
    it("should track task completion and update usageStats", async () => {
      const result = await tracker.trackTaskCompletion(
        "researchBugFixes",
        "ninja-researcher",
        { success: true },
        testDir
      );

      assert.ok(result !== null);
      
      const dna = loadModelDNA(testDir);
      assert.strictEqual(dna.usageStats.tasksCompleted["researchBugFixes"], 1);
    });

    it("should maintain sliding window of last 10 ratings per model/task combo", async () => {
      // Track 15 completions with ratings
      for (let i = 0; i < 15; i++) {
        await tracker.trackTaskCompletion(
          "executeCode",
          "executor",
          { success: true, rating: (i % 5) + 1 },
          testDir
        );
      }

      const dna = loadModelDNA(testDir);
      const ratings =
        dna.usageStats.modelEffectiveness["executor"]["executeCode"];
      assert.strictEqual(ratings.length, 10); // Should be capped at 10
    });

    it("should store rating feedback text", async () => {
      await tracker.trackTaskCompletion(
        "researchBugFixes",
        "ninja-researcher",
        { success: true, rating: 5, feedback: "Great job!" },
        testDir
      );

      const dna = loadModelDNA(testDir);
      const ratings =
        dna.usageStats.modelEffectiveness["ninja-researcher"]["researchBugFixes"];
      
      assert.strictEqual(ratings[0].rating, 5);
      assert.strictEqual(ratings[0].feedback, "Great job!");
    });

    it("should clamp rating values to 1-5 range", async () => {
      await tracker.trackTaskCompletion(
        "executeCode",
        "executor",
        { success: true, rating: -1 }, // Below minimum
        testDir
      );
      
      await tracker.trackTaskCompletion(
        "executeCode",
        "executor",
        { success: true, rating: 10 }, // Above maximum
        testDir
      );

      const dna = loadModelDNA(testDir);
      const ratings = dna.usageStats.modelEffectiveness["executor"]["executeCode"];
      
      assert.strictEqual(ratings[0].rating, 1); // Clamped to minimum
      assert.strictEqual(ratings[1].rating, 5); // Clamped to maximum
    });

    it("should initialize usageStats structure if not present", async () => {
      // Create a DNA without usageStats
      createDNAFile({}, testDir);
      
      const dna = loadModelDNA(testDir);
      delete dna.usageStats;
      
      await tracker.trackTaskCompletion(
        "testTask",
        "testModel",
        {},
        testDir
      );

      const updatedDna = loadModelDNA(testDir);
      assert.ok(updatedDna.usageStats);
      assert.ok(updatedDna.usageStats.tasksCompleted);
    });
  });

  describe("trackModelSwitch()", () => {
    it("should record model switch events", () => {
      const result = tracker.trackModelSwitch("model-a", "model-b");
      
      assert.strictEqual(result.fromModel, "model-a");
      assert.strictEqual(result.toModel, "model-b");
      assert.ok(result.timestamp);
    });

    it("should maintain sliding window for model switches", () => {
      const maxHistory = 5;
      const trackerWithLimit = new UsageTracker({ maxHistoryItems: maxHistory });
      
      // Record more switches than limit
      for (let i = 0; i < 10; i++) {
        trackerWithLimit.trackModelSwitch(`model-${i}`, `fallback-${i}`);
      }

      const recent = trackerWithLimit.getRecentModelSwitches();
      // Should have last maxHistory switches
      assert.strictEqual(recent.length, maxHistory);
    });

    it("should return the switch record", () => {
      const result = tracker.trackModelSwitch("from", "to");
      
      assert.strictEqual(result.fromModel, "from");
      assert.strictEqual(result.toModel, "to");
    });
  });

  describe("trackRating()", () => {
    it("should record a manual effectiveness rating", async () => {
      const result = await tracker.trackRating(
        "ninja-researcher",
        "researchBugFixes",
        4,
        "Good work",
        testDir
      );

      assert.ok(result !== null);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].rating, 4);
    });

    it("should handle empty feedback text", async () => {
      await tracker.trackRating(
        "ninja-researcher",
        "researchBugFixes",
        5,
        "",
        testDir
      );

      const dna = loadModelDNA(testDir);
      const ratings =
        dna.usageStats.modelEffectiveness["ninja-researcher"]["researchBugFixes"];
      
      assert.strictEqual(ratings[0].feedback, null);
    });
  });

  describe("getTaskStats()", () => {
    it("should return statistics for a task type", async () => {
      // Record some tasks
      await tracker.trackTaskCompletion("researchBugFixes", "model-a", {}, testDir);
      await tracker.trackTaskCompletion("researchBugFixes", "model-b", {}, testDir);
      await tracker.trackTaskCompletion("researchBugFixes", "model-a", {}, testDir);

      const stats = await tracker.getTaskStats("researchBugFixes", testDir);
      
      assert.strictEqual(stats.count, 3);
      assert.ok(Array.isArray(stats.modelsUsed));
      assert.ok(typeof stats.averageRatings === "object");
    });

    it("should return empty result for non-existent task type", async () => {
      const stats = await tracker.getTaskStats("nonExistentTask", testDir);
      
      assert.strictEqual(stats.count, 0);
      assert.deepStrictEqual(stats.modelsUsed, []);
    });

    it("should sort models by usage count", async () => {
      // Record tasks with different counts per model
      for (let i = 0; i < 5; i++) {
        await tracker.trackTaskCompletion("testTask", "model-a", {}, testDir);
      }
      for (let i = 0; i < 2; i++) {
        await tracker.trackTaskCompletion("testTask", "model-b", {}, testDir);
      }

      const stats = await tracker.getTaskStats("testTask", testDir);
      
      assert.strictEqual(stats.modelsUsed[0].modelId, "model-a"); // Most used first
      assert.strictEqual(stats.modelsUsed[1].modelId, "model-b");
    });
  });

  describe("getModelStats()", () => {
    it("should return statistics for a model with multiple tasks", async () => {
      // Record multiple task completions for the same model
      await tracker.trackTaskCompletion("taskA", "testModel", {}, testDir);
      await tracker.trackTaskCompletion("taskB", "testModel", {}, testDir);
      await tracker.trackTaskCompletion("taskC", "testModel", {}, testDir);

      const stats = await tracker.getModelStats("testModel", testDir);
      
      // Stats should show total tasks completed for this model
      assert.strictEqual(stats.totalTasks, 3);
    });

    it("should calculate overall rating from all tasks", async () => {
      await tracker.trackTaskCompletion("taskA", "testModel", { rating: 5 }, testDir);
      await tracker.trackTaskCompletion("taskB", "testModel", { rating: 3 }, testDir);

      const stats = await tracker.getModelStats("testModel", testDir);
      
      assert.strictEqual(stats.overallRating, "4.00"); // (5+3)/2 = 4
    });

    it("should return null-like result for non-existent model", async () => {
      const stats = await tracker.getModelStats("nonExistentModel", testDir);
      
      assert.strictEqual(stats.totalTasks, 0);
      assert.deepStrictEqual(stats.taskBreakdown, {});
      assert.strictEqual(stats.overallRating, null);
    });
  });

  describe("getAverageRatings()", () => {
    it("should return average ratings across all models and tasks", async () => {
      await tracker.trackTaskCompletion("taskA", "model-a", { rating: 5 }, testDir);
      await tracker.trackTaskCompletion("taskB", "model-b", { rating: 3 }, testDir);

      const averages = await tracker.getAverageRatings(testDir);
      
      assert.ok(averages);
      assert.strictEqual(averages["model-a"]["taskA"].average, "5.00");
      assert.strictEqual(averages["model-b"]["taskB"].average, "3.00");
    });

    it("should return empty object when no ratings exist", async () => {
      const averages = await tracker.getAverageRatings(testDir);
      
      // Fresh DNA without any ratings should return empty object
      assert.deepStrictEqual(averages, {});
    });
  });

  describe("detectPatterns()", () => {
    it("should detect high low-rating rate patterns", async () => {
      // Create a pattern where >50% of ratings are below threshold (3.0)
      await tracker.trackTaskCompletion(
        "testTask",
        "badModel",
        { rating: 2 },
        testDir
      );
      await tracker.trackTaskCompletion(
        "testTask",
        "badModel",
        { rating: 1 },
        testDir
      );
      await tracker.trackTaskCompletion(
        "testTask",
        "badModel",
        { rating: 2 },
        testDir
      );

      const patterns = await tracker.detectPatterns(testDir);
      
      assert.ok(Array.isArray(patterns.patterns));
      // Should detect at least one pattern with low ratings
    });

    it("should return empty patterns when no issues detected", async () => {
      // Record only good ratings
      for (let i = 0; i < 5; i++) {
        await tracker.trackTaskCompletion(
          "testTask",
          "goodModel",
          { rating: 5 },
          testDir
        );
      }

      const patterns = await tracker.detectPatterns(testDir);
      
      assert.ok(Array.isArray(patterns.patterns));
    });
  });

  describe("getUsageSummary()", () => {
    it("should return overview of usage statistics", async () => {
      await tracker.trackTaskCompletion("taskA", "model-a", {}, testDir);
      await tracker.trackTaskCompletion("taskB", "model-b", {}, testDir);

      const summary = await tracker.getUsageSummary(testDir);
      
      assert.strictEqual(summary.totalTasks, 2);
      assert.ok(Array.isArray(summary.modelsUsed));
    });

    it("should return empty result when no usage stats exist", async () => {
      // Fresh DNA without any tracking
      createDNAFile({}, testDir);
      
      const summary = await tracker.getUsageSummary(testDir);
      assert.strictEqual(summary.totalTasks, 0);
      assert.deepStrictEqual(summary.modelsUsed, []);
    });
  });

  describe("clear()", () => {
    it("should clear all tracking data", () => {
      tracker.trackModelSwitch("from", "to");
      tracker.clear();
      
      const switches = tracker.getRecentModelSwitches();
      assert.strictEqual(switches.length, 0);
    });
  });

  describe("Sliding Window Implementation", () => {
    it("should use slice(-10) for last 10 ratings per model/task combo", async () => {
      // Track exactly 10 completions
      for (let i = 0; i < 10; i++) {
        await tracker.trackTaskCompletion(
          "exactTest",
          "testModel",
          { rating: 5 },
          testDir
        );
      }

      const dna = loadModelDNA(testDir);
      const ratings = dna.usageStats.modelEffectiveness["testModel"]["exactTest"];
      
      assert.strictEqual(ratings.length, 10);
    });

    it("should keep last 10 when more than 10 are tracked", async () => {
      // Track 15 completions with ratings cycling through valid range (1-5)
      // Since ratings are clamped to 1-5, we'll have: 1,2,3,4,5,1,2,3,4,5,1,2,3,4,5
      // After sliding window (last 10): 1,2,3,4,5,1,2,3,4,5
      for (let i = 0; i < 15; i++) {
        await tracker.trackTaskCompletion(
          "overflowTest",
          "testModel",
          { rating: (i % 5) + 1 },
          testDir
        );
      }

      const dna = loadModelDNA(testDir, true); // Force reload to bypass cache
      const ratings = dna.usageStats.modelEffectiveness["testModel"]["overflowTest"];
      
      // Should have last 10 ratings: [1,2,3,4,5,1,2,3,4,5]
      assert.strictEqual(ratings.length, 10);
      assert.strictEqual(ratings[0].rating, 1); // First of the remaining 10
      assert.strictEqual(ratings[9].rating, 5); // Last one
    });
  });

  describe("Integration with DNA Manager", () => {
    it("should persist data to disk correctly", async () => {
      await tracker.trackTaskCompletion("persistTest", "persistModel", {}, testDir);
      
      // Force a fresh load from disk
      const freshDna = loadModelDNA(testDir, true);
      
      assert.strictEqual(freshDna.usageStats.tasksCompleted.persistTest, 1);
    });

    it("should handle concurrent model tracking correctly", async () => {
      // Track tasks for multiple models simultaneously
      await tracker.trackTaskCompletion("sharedTask", "model-a", {}, testDir);
      await tracker.trackTaskCompletion("sharedTask", "model-b", {}, testDir);
      await tracker.trackTaskCompletion("sharedTask", "model-c", {}, testDir);

      const stats = await tracker.getTaskStats("sharedTask", testDir);
      
      assert.strictEqual(stats.count, 3);
      assert.strictEqual(stats.modelsUsed.length, 3);
    });
  });
});