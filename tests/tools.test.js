/**
 * MCP Local Helper - Phase 4 Tools Test Suite
 *
 * Tests for the MCP server tools:
 * - switch-model
 * - execute-task
 * - model-dna
 * - rate-model
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import { join } from "node:path";

// Import tool handlers
import {
  handleSwitchModel,
  switchModelTool,
  getAverageRating
} from "../src/tools/switch-model.js";

import {
  handleExecuteTask,
  executeTaskTool
} from "../src/tools/execute-task.js";

import {
  handleModelDNA,
  modelDnaTool
} from "../src/tools/model-dna-tool.js";

import {
  handleRateModel,
  rateModelTool
} from "../src/tools/rate-model.js";

// Import core modules for setup/teardown
import {
  createDNAFile,
  loadModelDNA,
  resetDNA,
  clearCache
} from "../src/utils/model-dna-manager.js";
import { getDefaultDNA } from "../src/utils/model-dna-schema.js";

// Mock LM Studio API responses
const mockLMStudioResponse = (data, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
};

// Test utilities
let TEST_DIR = "";
let ORIGINAL_CWD = null;

const makeTestDir = () => {
  ORIGINAL_CWD = process.cwd();
  TEST_DIR = join(process.cwd(), `tests/tmp/tools-${Date.now()}`);
  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }
  process.chdir(TEST_DIR);
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
  if (ORIGINAL_CWD) {
    process.chdir(ORIGINAL_CWD);
  }
};

const setupTestEnvironment = async (dir) => {
  // Create DNA file explicitly in the test directory
  const result = createDNAFile({}, dir);
  if (!result.success) {
    throw new Error(`Failed to create DNA in setupTestEnvironment: ${result.errors.join(", ")}`);
  }
  clearCache();
  return dir;
};

// Tool Definition Tests
describe("Tool Definitions", () => {
  test("switch-model tool has correct structure", () => {
    assert.strictEqual(switchModelTool.name, "switch-model");
    assert.ok(switchModelTool.description.includes("[ROLE]"), "Should have ROLE section");
    assert.ok(switchModelTool.description.includes("[CONTEXT]"), "Should have CONTEXT section");
    assert.ok(switchModelTool.description.includes("[TASK]"), "Should have TASK section");
    assert.ok(switchModelTool.description.includes("[CONSTRAINTS]"), "Should have CONSTRAINTS section");
    assert.ok(switchModelTool.description.includes("[FORMAT]"), "Should have FORMAT section");

    assert.strictEqual(switchModelTool.inputSchema.type, "object");
    assert.ok(switchModelTool.inputSchema.properties.action);
    assert.ok(switchModelTool.inputSchema.properties.modelId);
  });

  test("execute-task tool has correct structure", () => {
    assert.strictEqual(executeTaskTool.name, "execute-task");
    assert.ok(executeTaskTool.description.includes("[ROLE]"));
    assert.ok(executeTaskTool.description.includes("[TASK]"));
    assert.ok(executeTaskTool.description.includes("[CONSTRAINTS]"));

    assert.strictEqual(executeTaskTool.inputSchema.type, "object");
    assert.ok(executeTaskTool.inputSchema.properties.query);
    assert.ok(executeTaskTool.inputSchema.properties.modelType);
  });

  test("model-dna tool has correct structure", () => {
    assert.strictEqual(modelDnaTool.name, "model-dna");
    assert.ok(modelDnaTool.description.includes("[ROLE]"));
    assert.ok(modelDnaTool.description.includes("[TASK]"));
    assert.ok(modelDnaTool.description.includes("[CONSTRAINTS]"));

    assert.strictEqual(modelDnaTool.inputSchema.type, "object");
    assert.ok(modelDnaTool.inputSchema.properties.action);
    assert.ok(modelDnaTool.inputSchema.properties.companyName);
    assert.ok(modelDnaTool.inputSchema.properties.memory);
    assert.ok(modelDnaTool.inputSchema.properties.key);
  });

  test("rate-model tool has correct structure", () => {
    assert.strictEqual(rateModelTool.name, "rate-model");
    assert.ok(rateModelTool.description.includes("[ROLE]"));
    assert.ok(rateModelTool.description.includes("[TASK]"));
    assert.ok(rateModelTool.description.includes("[CONSTRAINTS]"));

    assert.strictEqual(rateModelTool.inputSchema.type, "object");
    assert.ok(rateModelTool.inputSchema.properties.modelRole);
    assert.ok(rateModelTool.inputSchema.properties.taskType);
    assert.ok(rateModelTool.inputSchema.properties.rating);
    assert.ok(rateModelTool.inputSchema.properties.feedback);
  });
});

// Switch Model Tool Tests
describe("switch-model tool", () => {
  let dir;

  before(() => {
    dir = makeTestDir();
  });

  after(() => {
    cleanupTestDir(dir);
  });

  test("should validate required action", async () => {
    const result = await handleSwitchModel({});
    assert.ok(result.isError, "Should return error for missing action");
    assert.ok(result.content[0].text.includes("error"), "Error message should mention error");
  });

  test("should list models when action is 'list'", async () => {
    await setupTestEnvironment(dir);

    const result = await handleSwitchModel({ action: "list" });

    assert.ok(!result.isError, "Should not be an error");
    const content = JSON.parse(result.content[0].text);
    assert.strictEqual(content.success, true);
    assert.ok(Array.isArray(content.models), "Should return models array");
    assert.ok(content.total >= 0, "Should have total count");
  });

  test("should get current model when action is 'current'", async () => {
    await setupTestEnvironment(dir);

    const result = await handleSwitchModel({ action: "current" });

    assert.ok(!result.isError, "Should not be an error");
    const content = JSON.parse(result.content[0].text);
    assert.strictEqual(content.success, true);
    assert.ok("currentModel" in content, "Should have currentModel field");
  });

  test("should require modelId for load action", async () => {
    await setupTestEnvironment(dir);

    const result = await handleSwitchModel({ action: "load" });

    assert.ok(result.isError, "Should return error for missing modelId");
    const content = JSON.parse(result.content[0].text);
    assert.ok(content.error.includes("modelId"), "Error should mention modelId");
  });

  test("should attempt to load model with modelId", async () => {
    await setupTestEnvironment(dir);

    const result = await handleSwitchModel({ action: "load", modelId: "nonexistent-model" });

    // Note: This will likely fail due to LM Studio not being available, but should get proper error
    assert.ok(result.content[0].text, "Should have content");
    const content = JSON.parse(result.content[0].text);
    // Either success with alreadyLoaded or error about loading
    assert.ok("modelId" in content || "error" in content, "Should have modelId or error field");
  });

  test("should require modelId for unload action", async () => {
    await setupTestEnvironment(dir);

    const result = await handleSwitchModel({ action: "unload" });

    assert.ok(result.isError, "Should return error for missing modelId");
    const content = JSON.parse(result.content[0].text);
    assert.ok(content.error.includes("modelId"), "Error should mention modelId");
  });
});

// Model DNA Tool Tests
describe("model-dna tool", () => {
  let dir;

  before(() => {
    dir = makeTestDir();
  });

  after(() => {
    cleanupTestDir(dir);
  });

  test("should validate required action", async () => {
    const result = await handleModelDNA({});
    assert.ok(result.isError, "Should return error for missing action");
  });

  test("should return error when DNA not initialized for get", async () => {
    // Ensure clean state - no DNA file
    clearCache();

    const result = await handleModelDNA({ action: "get" });

    const content = JSON.parse(result.content[0].text);
    assert.ok(!content.success || content.success === false, "Should indicate failure");
    assert.ok(content.message && content.message.includes("init"), "Should mention init");
  });

  test("should initialize DNA with defaults", async () => {
    const result = await handleModelDNA({ action: "init" });

    assert.ok(!result.isError, "Should not be an error");
    const content = JSON.parse(result.content[0].text);
    assert.strictEqual(content.success, true);
    assert.ok(content.path, "Should return path");
    assert.ok(content.config, "Should return config");
  });

  test("should initialize DNA with custom settings", async () => {
    const result = await handleModelDNA({
      action: "init",
      companyName: "Test Corp",
      modelId: "custom-model"
    });

    assert.ok(!result.isError, "Should not be an error");
    const content = JSON.parse(result.content[0].text);
    assert.strictEqual(content.success, true);
    assert.strictEqual(content.config.companyName, "Test Corp");
    assert.strictEqual(content.config.defaultModel, "custom-model", "Should preserve modelId as defaultModel");
  });

  test("should get DNA when initialized", async () => {
    await setupTestEnvironment(dir);

    const result = await handleModelDNA({ action: "get" });

    assert.ok(!result.isError, "Should not be an error");
    const content = JSON.parse(result.content[0].text);
    assert.strictEqual(content.success, true);
    assert.ok(content.dna, "Should have dna object");
    assert.ok(content.dna.version, "Should have version");
    assert.ok(Array.isArray(content.dna.models), "Should have models array");
  });

  test("should save memory", async () => {
    await setupTestEnvironment(dir);

    const result = await handleModelDNA({
      action: "save-memory",
      memory: "test-memory-value"
    });

    assert.ok(!result.isError, "Should not be an error");
    const content = JSON.parse(result.content[0].text);
    assert.strictEqual(content.success, true);
    assert.ok(content.key, "Should have key");
    assert.ok(content.message.includes("Memory saved"), "Should confirm save");
  });

  test("should save memory with custom key", async () => {
    await setupTestEnvironment(dir);

    const result = await handleModelDNA({
      action: "save-memory",
      memory: "custom-value",
      key: "custom-key"
    });

    assert.ok(!result.isError, "Should not be an error");
    const content = JSON.parse(result.content[0].text);
    assert.strictEqual(content.success, true);
    assert.strictEqual(content.key, "custom-key", "Should use custom key");
  });

  test("should require memory for save-memory", async () => {
    await setupTestEnvironment(dir);

    const result = await handleModelDNA({
      action: "save-memory"
    });

    assert.ok(result.isError, "Should return error for missing memory");
  });

  test("should delete memory", async () => {
    await setupTestEnvironment(dir);

    // First save a memory
    await handleModelDNA({
      action: "save-memory",
      memory: "to-be-deleted",
      key: "delete-key"
    });

    // Then delete it
    const result = await handleModelDNA({
      action: "delete-memory",
      key: "delete-key"
    });

    assert.ok(!result.isError, "Should not be an error");
    const content = JSON.parse(result.content[0].text);
    assert.strictEqual(content.success, true);
    assert.ok(content.message.includes("deleted"), "Should confirm deletion");
  });

  test("should require key for delete-memory", async () => {
    await setupTestEnvironment(dir);

    const result = await handleModelDNA({
      action: "delete-memory"
    });

    assert.ok(result.isError, "Should return error for missing key");
  });

  test("should analyze usage with evolve", async () => {
    await setupTestEnvironment(dir);

    const result = await handleModelDNA({
      action: "evolve"
    });

    assert.ok(!result.isError, "Should not be an error");
    const content = JSON.parse(result.content[0].text);
    assert.strictEqual(content.success, true);
    assert.ok(content.analysis, "Should have analysis");
    assert.ok("totalTasks" in content.analysis, "Should have totalTasks");
    assert.ok("modelUsage" in content.analysis, "Should have modelUsage");
    assert.ok("suggestions" in content.analysis, "Should have suggestions");
  });

  test("should apply evolution suggestion when apply=true", async () => {
    await setupTestEnvironment(dir);

    // Record 10 low ratings for executor on codeExecution
    for (let i = 0; i < 10; i++) {
      await handleRateModel({
        modelRole: "executor",
        taskType: "codeExecution",
        rating: 1,
        feedback: `Poor performance ${i}`
      });
    }
    clearCache();

    // Record high ratings for researcher on generalResearch to provide an alternative
    for (let i = 0; i < 5; i++) {
      await handleRateModel({
        modelRole: "researcher",
        taskType: "generalResearch",
        rating: 5,
        feedback: `Excellent research ${i}`
      });
    }
    clearCache();

    // Evolve with apply=true
    const result = await handleModelDNA({
      action: "evolve",
      apply: true
    });

    assert.ok(!result.isError, "Evolution with apply should succeed");
    const content = JSON.parse(result.content[0].text);
    assert.strictEqual(content.success, true);
    assert.ok(content.analysis.suggestions.length > 0, "Should have suggestions");

    // If there's a suggestion with a mutation value, verify it was applied
    if (content.analysis.suggestions.length > 0 && content.analysis.suggestions[0].mutation && content.analysis.suggestions[0].mutation.value) {
      assert.ok(content.evolved, "Should return evolved DNA");
      const evolvedDna = content.evolved;
      const suggestion = content.analysis.suggestions[0];
      const mutationPath = suggestion.mutation.path;
      const expectedValue = suggestion.mutation.value;
      const parts = mutationPath.split(".");
      let actualValue = evolvedDna;
      for (const part of parts) {
        actualValue = actualValue[part];
      }
      assert.strictEqual(actualValue, expectedValue, "Mutation should be applied");
    }
  });

  test("getAverageRating helper function works correctly", async () => {
    await setupTestEnvironment(dir);

    // Should return null for a model with no ratings
    const dna = loadModelDNA();
    const avg1 = getAverageRating("nonexistent-model", dna);
    assert.strictEqual(avg1, null, "Should return null for model with no ratings");

    // Record ratings using handleRateModel
    await handleRateModel({ modelRole: "executor", taskType: "codeExecution", rating: 5 });
    await handleRateModel({ modelRole: "executor", taskType: "codeExecution", rating: 4 });
    await handleRateModel({ modelRole: "executor", taskType: "codeExecution", rating: 3 });
    clearCache();

    const dna2 = loadModelDNA();
    const avg2 = getAverageRating("executor", dna2);
    assert.strictEqual(avg2, 4, "Should calculate average as 4");
  });
});

// Rate Model Tool Tests
describe("rate-model tool", () => {
  let dir;

  before(() => {
    dir = makeTestDir();
  });

  after(() => {
    cleanupTestDir(dir);
  });

  test("should validate required fields", async () => {
    const result = await handleRateModel({});
    assert.ok(result.isError, "Should return error for missing required fields");
  });

  test("should validate rating range", async () => {
    const result = await handleRateModel({
      modelRole: "executor",
      taskType: "codeExecution",
      rating: 6
    });

    assert.ok(result.isError, "Should return error for invalid rating");
  });

  test("should record valid rating", async () => {
    await setupTestEnvironment(dir);

    const result = await handleRateModel({
      modelRole: "executor",
      taskType: "codeExecution",
      rating: 5,
      feedback: "Excellent performance"
    });

    assert.ok(!result.isError, "Should not be an error");
    const content = JSON.parse(result.content[0].text);
    assert.strictEqual(content.success, true);
    assert.strictEqual(content.modelRole, "executor");
    assert.strictEqual(content.taskType, "codeExecution");
    assert.strictEqual(content.rating, 5);
    assert.strictEqual(content.feedback, "Excellent performance");
    assert.ok(content.totalRatings >= 1, "Should have at least one rating");
  });

  test("should accumulate ratings for same model/task", async () => {
    await setupTestEnvironment(dir);

    // Record first rating
    await handleRateModel({
      modelRole: "executor",
      taskType: "codeExecution",
      rating: 4
    });
    clearCache();

    // Record second rating
    const result = await handleRateModel({
      modelRole: "executor",
      taskType: "codeExecution",
      rating: 5
    });

    const content = JSON.parse(result.content[0].text);
    assert.strictEqual(content.totalRatings, 2, "Should have accumulated 2 ratings");
  });

  test("should work with all valid model roles and task types", async () => {
    await setupTestEnvironment(dir);

    const testCases = [
      { modelRole: "conversationalist", taskType: "generalResearch" },
      { modelRole: "ninjaResearcher", taskType: "generalResearch" },
      { modelRole: "architect", taskType: "featureArchitecture" },
      { modelRole: "executor", taskType: "codeExecution" },
      { modelRole: "researcher", taskType: "generalResearch" },
      { modelRole: "vision", taskType: "imageAnalysis" }
    ];

    for (const testCase of testCases) {
      const result = await handleRateModel({
        ...testCase,
        rating: 3
      });

      assert.ok(!result.isError, `${testCase.modelRole}/${testCase.taskType} should succeed`);
    }
  });
});

// Execute Task Tool Tests
describe("execute-task tool", () => {
  let dir;

  before(() => {
    dir = makeTestDir();
  });

  after(() => {
    cleanupTestDir(dir);
  });

  test("should validate required query", async () => {
    const result = await handleExecuteTask({});
    assert.ok(result.isError, "Should return error for missing query");
  });

  test("should require DNA initialization", async () => {
    // Don't initialize DNA
    clearCache();
    
    const result = await handleExecuteTask({ query: "test task" });

    const content = JSON.parse(result.content[0].text);
    assert.ok(result.isError || content.error, "Should return error");
    assert.ok(content.error && (content.error.includes("DNA") || content.error.includes("init")), "Error should mention DNA or init");
  });

  test("should execute task with valid query and DNA", async () => {
    await setupTestEnvironment(dir);

    const result = await handleExecuteTask({ query: "Hello, how are you?" });

    // Note: This may fail if LM Studio is not running, but should get proper error response
    assert.ok(result.content[0].text, "Should have content");
    const content = JSON.parse(result.content[0].text);

    // Either success or error, but should have proper structure
    assert.ok("query" in content || "error" in content, "Should have query or error field");
  });

  test("should handle modelType override", async () => {
    await setupTestEnvironment(dir);

    const result = await handleExecuteTask({
      query: "Test task",
      modelType: "executor"
    });

    assert.ok(result.content[0].text, "Should have content");
    // The modelType override is logged but doesn't change behavior without proper model setup
  });
});

// Integration Tests
describe("Integration Tests", () => {
  let dir;

  before(() => {
    dir = makeTestDir();
  });

  after(() => {
    cleanupTestDir(dir);
  });

  test("Full workflow: init DNA, execute task, rate model, get stats", async () => {
    // 1. Initialize DNA
    const initResult = await handleModelDNA({
      action: "init",
      companyName: "Integration Test Corp"
    });

    assert.ok(!initResult.isError, "DNA initialization should succeed");

    // 2. Get DNA to verify initialization
    const getResult = await handleModelDNA({ action: "get" });
    assert.ok(!getResult.isError, "Getting DNA should succeed");

    // 3. Save a memory
    const memoryResult = await handleModelDNA({
      action: "save-memory",
      memory: "preferred-context-limit",
      key: "contextLimit"
    });
    assert.ok(!memoryResult.isError, "Saving memory should succeed");

    // 4. Record a rating
    const ratingResult = await handleRateModel({
      modelRole: "executor",
      taskType: "codeExecution",
      rating: 4,
      feedback: "Good job"
    });
    assert.ok(!ratingResult.isError, "Rating should succeed");

    // 5. Evolve DNA to analyze usage
    const evolveResult = await handleModelDNA({
      action: "evolve"
    });
    assert.ok(!evolveResult.isError, "Evolution analysis should succeed");

    // Verify the complete workflow succeeded
    assert.ok(true, "Full workflow completed successfully");
  });

  test("switch-model list shows initialized DNA models", async () => {
    await setupTestEnvironment(dir);

    const listResult = await handleSwitchModel({ action: "list" });
    assert.ok(!listResult.isError, "Listing models should succeed");

    const content = JSON.parse(listResult.content[0].text);
    assert.ok(Array.isArray(content.models), "Should return models array");
    assert.ok(content.total >= 0, "Should have total count");
  });
});

// Error Handling Tests
describe("Error Handling", () => {
  let dir;

  before(() => {
    dir = makeTestDir();
  });

  after(() => {
    cleanupTestDir(dir);
  });

  test("All tools handle unexpected errors gracefully", async () => {
    // Test with invalid parameters that should trigger validation errors
    const tools = [
      { tool: handleSwitchModel, params: { action: "invalid" } },
      { tool: handleExecuteTask, params: { query: "" } },
      { tool: handleModelDNA, params: { action: "invalid" } },
      { tool: handleRateModel, params: { modelRole: "invalid", taskType: "invalid", rating: 10 } }
    ];

    for (const { tool, params } of tools) {
      const result = await tool(params);
      assert.ok(result.isError || JSON.parse(result.content[0].text).error,
        `Tool should return error for invalid params`);
    }
  });

  test("Tools return consistent error format", async () => {
    const result = await handleSwitchModel({});
    assert.ok(result.isError, "Should be error");
    assert.ok(result.content[0].type === "text", "Content should be text type");
    assert.ok(result.content[0].text.includes("error"), "Text should mention error");
  });
});

// Performance Tests (basic)
describe("Performance", () => {
  let dir;

  before(() => {
    dir = makeTestDir();
  });

  after(() => {
    cleanupTestDir(dir);
  });

  test("switch-model list is reasonably fast", async () => {
    await setupTestEnvironment(dir);

    const startTime = Date.now();
    await handleSwitchModel({ action: "list" });
    const duration = Date.now() - startTime;

    assert.ok(duration < 5000, "List should complete in under 5 seconds");
  });

  test("model-dna get is reasonably fast", async () => {
    await setupTestEnvironment(dir);

    const startTime = Date.now();
    await handleModelDNA({ action: "get" });
    const duration = Date.now() - startTime;

    assert.ok(duration < 1000, "Get DNA should complete in under 1 second");
  });
});

console.log("Running Phase 4 Tools Tests...");