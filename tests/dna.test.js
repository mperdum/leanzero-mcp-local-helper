/**
 * MCP Local Helper - DNA System Tests
 * Phase 1: Core DNA System Test Suite
 */

import { test, describe } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import { join } from "node:path";

// Import core DNA modules
import {
  VALID_MODEL_TYPES,
  getDefaultDNA,
  validateModelDNA,
  applyMigration,
  loadDNAFromFile,
  saveDNAToFile,
} from "../src/utils/model-dna-schema.js";

import {
  loadModelDNA,
  loadUserDNA,
  createDNAFile,
  recordEffectivenessRating,
  getAverageRating,
  saveMemory,
  deleteMemory,
  updateDNA,
  resetDNA,
  clearCache,
  mergeDNALevels,
} from "../src/utils/model-dna-manager.js";

import {
  mergeDNALevels as mergeDNA,
  resolveEffectiveModel,
  diffDNAConfigurations,
  validateInheritanceChain,
} from "../src/utils/model-dna-inheritance.js";

// Test suite for schema and validation
describe("Model DNA Schema", () => {
  test("getDefaultDNA returns valid default configuration", () => {
    const defaultDNA = getDefaultDNA();
    const validation = validateModelDNA(defaultDNA);
    assert.strictEqual(validation.valid, true, "Default DNA should be valid");
    assert.strictEqual(validation.errors.length, 0, "Default DNA should have no errors");
  });

  test("getDefaultDNA has correct structure", () => {
    const defaultDNA = getDefaultDNA();

    assert.ok("version" in defaultDNA, "Should have version");
    assert.ok("primaryRole" in defaultDNA, "Should have primaryRole");
    assert.ok("models" in defaultDNA, "Should have models");
    assert.ok("taskModelMapping" in defaultDNA, "Should have taskModelMapping");
    assert.ok("memories" in defaultDNA, "Should have memories");
    assert.ok("usageStats" in defaultDNA, "Should have usageStats");
    assert.ok("mcpIntegrations" in defaultDNA, "Should have mcpIntegrations");
    assert.ok("hardwareProfile" in defaultDNA, "Should have hardwareProfile");
    assert.ok("fallbackStrategy" in defaultDNA, "Should have fallbackStrategy");

    assert.ok(VALID_MODEL_TYPES.includes(defaultDNA.primaryRole), "primaryRole should be valid");
  });

  test("validateModelDNA rejects invalid configuration", () => {
    const invalidDNA = {
      version: 1,
      primaryRole: "invalid-role", // Invalid role
      models: {},
    };

    const validation = validateModelDNA(invalidDNA);
    assert.strictEqual(validation.valid, false, "Invalid DNA should fail validation");
    assert.ok(validation.errors.length > 0, "Should have validation errors");
  });

  test("validateModelDNA accepts minimal valid configuration", () => {
    const minimalDNA = {
      version: 1,
      primaryRole: "executor",
      models: { executor: { purpose: "test" } },
      taskModelMapping: {},
    };

    const validation = validateModelDNA(minimalDNA);
    assert.strictEqual(validation.valid, true, "Minimal valid DNA should pass");
  });

  test("applyMigration handles version 1 to 4 upgrade", () => {
    const oldDNA = {
      version: 1,
      primaryRole: "executor",
      modelConfig: {
        temperature: 0.7,
        maxTokens: 1000,
      },
    };

    const migratedDNA = applyMigration(oldDNA);
    assert.strictEqual(migratedDNA.version, 4, "Version should be upgraded to 4");
    assert.ok("settings" in migratedDNA, "Should have settings field");
    assert.ok("hardwareProfile" in migratedDNA, "Should have hardwareProfile");
    assert.ok("fallbackStrategy" in migratedDNA, "Should have fallbackStrategy");
  });

  test("applyMigration leaves current version unchanged", () => {
    const currentDNA = getDefaultDNA();
    const migratedDNA = applyMigration(currentDNA);
    assert.strictEqual(migratedDNA.version, 4, "Current version should remain 4");
  });
});

// Test suite for DNA Manager
describe("Model DNA Manager", () => {
  let TEST_DIR = "";
  const makeTestDir = () => {
    TEST_DIR = `./tests/tmp/dna-manager-${Date.now()}`;
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
    return TEST_DIR;
  };

  const cleanupTestDir = (dir) => {
    try {
      if (fs.existsSync(dir)) {
        fs.rmdirSync(dir, { recursive: true });
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  };

  test("loadModelDNA returns null when file doesn't exist", () => {
    const dir = makeTestDir();
    try {
      const dna = loadModelDNA(dir);
      assert.strictEqual(dna, null, "Should return null for missing file");
    } finally {
      cleanupTestDir(dir);
    }
  });

  test("createDNAFile creates valid DNA file", () => {
    const dir = makeTestDir();
    try {
      const result = createDNAFile({ primaryRole: "executor" }, dir);
      const TEST_DNA_PATH = join(dir, ".model-dna.json");

      assert.strictEqual(result.success, true, "Should create DNA file successfully");
      assert.ok(fs.existsSync(TEST_DNA_PATH), "DNA file should exist");

      const dna = loadModelDNA(dir);
      assert.ok(dna, "Should load created DNA");
      assert.strictEqual(dna.primaryRole, "executor", "Should have custom primaryRole");
    } finally {
      cleanupTestDir(dir);
    }
  });

  test("createDNAFile validates before saving", () => {
    const dir = makeTestDir();
    try {
      // Provide config with invalid model role that fails validation even after merging with defaults
      const result = createDNAFile({ 
        models: { "invalid-role": { purpose: "test" } }
      }, dir);
      assert.strictEqual(result.success, false, "Should fail validation");
      assert.ok(result.errors.length > 0, "Should have validation errors");
    } finally {
      cleanupTestDir(dir);
    }
  });

  test("recordEffectivenessRating updates usage stats", () => {
    const dir = makeTestDir();
    try {
      createDNAFile({}, dir);
      const ratings = recordEffectivenessRating("executor", "executeCode", 5, "Great!", dir);

      assert.ok(ratings, "Should return ratings array");
      assert.strictEqual(ratings.length, 1, "Should have one rating");
      assert.strictEqual(ratings[0].rating, 5, "Rating should be 5");
      assert.strictEqual(ratings[0].feedback, "Great!", "Feedback should match");

      const dna = loadModelDNA(dir);
      const savedRatings = dna.usageStats.modelEffectiveness?.executor?.executeCode;
      assert.ok(savedRatings, "Should have saved ratings");
      assert.strictEqual(savedRatings.length, 1, "Should have one saved rating");
    } finally {
      cleanupTestDir(dir);
    }
  });

  test("getAverageRating calculates correctly", () => {
    const dir = makeTestDir();
    try {
      createDNAFile({}, dir);

      recordEffectivenessRating("executor", "executeCode", 4, "", dir);
      recordEffectivenessRating("executor", "executeCode", 6, "", dir);
      recordEffectivenessRating("executor", "executeCode", 5, "", dir);

      const avg = getAverageRating("executor", "executeCode", dir);
      assert.strictEqual(avg, "4.67", "Average should be 4.67 (4+5+5)/3");
    } finally {
      cleanupTestDir(dir);
    }
  });

  test("saveMemory stores preferences", () => {
    const dir = makeTestDir();
    try {
      createDNAFile({}, dir);
      const memory = saveMemory("preferredModel", "executor", dir);

      assert.ok(memory, "Should save memory");
      assert.strictEqual(memory.value, "executor", "Should store correct value");
      assert.ok(memory.createdAt, "Should have timestamp");

      const dna = loadModelDNA(dir);
      assert.strictEqual(dna.memories.preferredModel.value, "executor", "Memory should be persisted");
    } finally {
      cleanupTestDir(dir);
    }
  });

  test("deleteMemory removes preferences", () => {
    const dir = makeTestDir();
    try {
      createDNAFile({}, dir);
      saveMemory("testKey", "testValue", dir);

      const deleted = deleteMemory("testKey", dir);
      assert.strictEqual(deleted, true, "Should return true on successful delete");

      const dna = loadModelDNA(dir);
      assert.ok(!dna.memories.testKey, "Memory should be removed");
    } finally {
      cleanupTestDir(dir);
    }
  });

  test("updateDNA merges changes correctly", () => {
    const dir = makeTestDir();
    try {
      createDNAFile({ primaryRole: "conversationalist" }, dir);
      const updated = updateDNA({ primaryRole: "executor" }, dir);

      assert.strictEqual(updated.primaryRole, "executor", "primaryRole should be updated");
      assert.ok(updated.models.executor, "Should still have default models");
    } finally {
      cleanupTestDir(dir);
    }
  });

  test("resetDNA restores defaults", () => {
    const dir = makeTestDir();
    try {
      createDNAFile({ primaryRole: "custom" }, dir);
      const reset = resetDNA(dir);
      const defaults = getDefaultDNA();

      assert.strictEqual(reset.primaryRole, defaults.primaryRole, "primaryRole should be reset");
      assert.deepStrictEqual(reset.models, defaults.models, "Models should be reset");
    } finally {
      cleanupTestDir(dir);
    }
  });

  test("clearCache resets cache", () => {
    const dir = makeTestDir();
    try {
      createDNAFile({}, dir);
      loadModelDNA(dir);
      clearCache();
      const dna = loadModelDNA(dir);
      assert.ok(dna, "Should still load after cache clear");
    } finally {
      cleanupTestDir(dir);
    }
  });
});

// Test suite for DNA inheritance and merging
describe("DNA Inheritance and Merging", () => {
  const defaultDNA = getDefaultDNA();

  // Minimal project DNA (only overrides)
  const minimalProjectDNA = {
    primaryRole: "executor",
    models: {
      executor: {
        purpose: "Execute tasks efficiently",
        usageCount: 15,
        rating: 4.2,
        createdAt: "2026-01-03T00:00:00Z",
      },
    },
    taskModelMapping: {
      "task:execution": "executor",
    },
  };

  // Minimal user DNA (only overrides)
  const minimalUserDNA = {
    primaryRole: "planner",
    models: {
      planner: {
        purpose: "Plan tasks and strategies",
        usageCount: 10,
        rating: 4.5,
        createdAt: "2026-01-01T00:00:00Z",
      },
    },
    taskModelMapping: {
      "task:planning": "planner",
    },
  };

  test("mergeDNALevels combines configurations with user priority", () => {
    // mergeDNA(user, project) - user has highest priority
    const merged = mergeDNA(minimalUserDNA, minimalProjectDNA);

    // User's primaryRole should override project's
    assert.strictEqual(merged.primaryRole, "planner", "User primaryRole should override project");
    // Both user's and project's models should be present
    assert.ok(merged.models.planner, "Should include user's custom model");
    assert.ok(merged.models.executor, "Should include project's executor model");
    // Default models should also be present
    assert.ok(merged.models.conversationalist, "Should include default models");
  });

  test("resolveEffectiveModel finds task mapping", () => {
    const merged = mergeDNA(minimalProjectDNA, defaultDNA);
    const model = resolveEffectiveModel(merged, "task:execution");
    assert.strictEqual(model, "executor", "Should resolve to executor for execution task");
  });

  test("resolveEffectiveModel falls back to primaryRole", () => {
    const merged = mergeDNA({ primaryRole: "researcher" }, defaultDNA);
    const model = resolveEffectiveModel(merged, "unknownTask");
    assert.strictEqual(model, "researcher", "Should fall back to primaryRole");
  });

  test("diffDNAConfigurations detects changes", () => {
    const dna1 = { ...defaultDNA, primaryRole: "conversationalist" };
    const dna2 = { ...defaultDNA, primaryRole: "executor" };

    const diff = diffDNAConfigurations(dna1, dna2);

    // diff returns {added, modified, removed}
    assert.ok(diff.modified.primaryRole, "Should detect primaryRole change");
    assert.strictEqual(diff.modified.primaryRole.old, "conversationalist", "Should have old value");
    assert.strictEqual(diff.modified.primaryRole.new, "executor", "Should have new value");
  });

  test("diffDNAConfigurations finds no differences for identical configs", () => {
    const diff = diffDNAConfigurations(defaultDNA, defaultDNA);

    // For identical configs, diff should be null
    assert.strictEqual(diff, null, "Should return null for identical configs");
  });

  test("validateInheritanceChain checks for invalid model roles", () => {
    const invalidUserDNA = {
      models: {
        "invalid-role": { purpose: "test" },
      },
    };

    const result = validateInheritanceChain(invalidUserDNA, {});

    assert.strictEqual(result.valid, false, "Should detect invalid role");
    assert.ok(result.warnings.some(w => w.includes("invalid-role")), "Should have warning about invalid role");
  });
});

// Simple integration test
describe("Integration Tests", () => {
  let TEST_DIR = "";
  const makeTestDir = () => {
    TEST_DIR = `./tests/tmp/integration-${Date.now()}`;
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
    return TEST_DIR;
  };

  const cleanupTestDir = (dir) => {
    try {
      if (fs.existsSync(dir)) {
        fs.rmdirSync(dir, { recursive: true });
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  };

  test("Full DNA lifecycle: create, update, ratings, memory", async () => {
    const dir = makeTestDir();
    try {
      // 1. Create initial DNA
      const result1 = createDNAFile({ primaryRole: "executor" }, dir);
      assert.strictEqual(result1.success, true, "Should create DNA");

      // 2. Load and verify
      const dna1 = loadModelDNA(dir);
      assert.ok(dna1, "Should load DNA");
      assert.strictEqual(dna1.primaryRole, "executor", "Should have custom primaryRole");

      // 3. Update configuration
      const updated = updateDNA({ primaryRole: "coordinator" }, dir);
      assert.strictEqual(updated.primaryRole, "coordinator", "Should update primaryRole");

      // 4. Record effectiveness rating
      const ratings = recordEffectivenessRating("executor", "executeCode", 5, "Excellent!", dir);
      assert.ok(ratings, "Should record rating");
      assert.strictEqual(ratings.length, 1, "Should have one rating");

      // 5. Get average rating
      const avg = getAverageRating("executor", "executeCode", dir);
      assert.strictEqual(avg, "5.00", "Average should be 5.00");

      // 6. Save memory
      const memory = saveMemory("preferredModel", "executor", dir);
      assert.ok(memory, "Should save memory");

      // 7. Load and verify all changes persisted
      const dna2 = loadModelDNA(dir);
      assert.strictEqual(dna2.usageStats.modelEffectiveness.executor.executeCode[0].rating, 5, "Rating should persist");
      assert.strictEqual(dna2.memories.preferredModel.value, "executor", "Memory should persist");

      // 8. Reset to defaults
      const reset = resetDNA(dir);
      const defaults = getDefaultDNA();
      assert.strictEqual(reset.primaryRole, defaults.primaryRole, "Should reset to default primaryRole");
    } finally {
      cleanupTestDir(dir);
    }
  });
});

console.log("Running DNA System Tests...");