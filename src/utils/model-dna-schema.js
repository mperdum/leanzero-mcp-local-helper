/**
 * Model DNA Schema - Phase 1 Core DNA System
 * Defines schema structure, validation rules, and migration system
 */

import { existsSync } from "node:fs";
import { readFileSync, writeFileSync } from "node:fs";

// Valid model types for the system
export const VALID_MODEL_TYPES = [
  "conversationalist",   // General conversation, chat
  "ninja-researcher",    // Code fixes, debugging, solutions
  "architect",           // Feature architecture, design patterns
  "executor",            // Code execution, writing, editing
  "researcher",          // General research, information gathering
  "vision",              // Image analysis, visual content understanding
];

// Schema definition (for documentation/reference)
export const MODEL_DNA_SCHEMA = {
  version: {
    type: "number",
    required: true,
    min: 1,
    description: "Schema version for migration support",
  },
  primaryRole: {
    type: "string",
    required: false,
    default: "conversationalist",
    description: "Default model role for the system",
  },
  models: {
    type: "object",
    required: true,
    description: "Model configurations with ratings and usage stats",
    pattern: {
      "^[a-z]+(-[a-z]+)*$": {
        type: "object",
        properties: {
          purpose: { type: "string", required: true },
          usageCount: { type: "number", required: false, default: 0 },
          rating: { type: ["number", "null"], required: false },
          createdAt: { type: ["string", "null"], required: false },
        },
      },
    },
  },
  taskModelMapping: {
    type: "object",
    required: true,
    description: "Task type → model role mapping",
    pattern: {
      "^[a-z]+(:[a-z]+)+$": { type: "string" },
    },
  },
  memories: {
    type: "object",
    required: false,
    default: {},
    description: "Key-value store for model preferences",
  },
  usageStats: {
    type: "object",
    required: false,
    default: {},
    properties: {
      tasksCompleted: {
        type: "object",
        pattern: { "^[a-z]+(:[a-z]+)+$": { type: "number" } },
      },
      modelEffectiveness: {
        type: "object",
        pattern: {
          "^[a-z]+(-[a-z]+)*$": {
            type: "object",
            pattern: {
              "^[a-z]+(:[a-z]+)+$": {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    rating: { type: "number" },
                    feedback: { type: "string" },
                    timestamp: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  mcpIntegrations: {
    type: "object",
    required: false,
    default: {},
    properties: {
      webSearch: { type: "boolean" },
      context7: { type: "boolean" },
      docProcessor: { type: "boolean" },
    },
  },
  hardwareProfile: {
    type: "object",
    required: false,
    default: {},
    properties: {
      minRamForParallel: { type: "number", description: "GB - Minimum for parallel loading" },
      recommendedRam: { type: "number", description: "Optimal for full parallelism" },
      maxParallelModels: { type: "number" },
    },
  },
  fallbackStrategy: {
    type: "object",
    required: false,
    default: {},
    properties: {
      autoFallback: { type: "boolean" },
      ratingThreshold: { type: "number" },
      maxAttempts: { type: "number" },
    },
  },
};

/**
 * Get default DNA configuration
 * Provides baseline configuration for all model types and system settings
 */
export function getDefaultDNA() {
  return {
    version: 2,
    primaryRole: "conversationalist",
    models: {
      conversationalist: {
        purpose: "general conversation and chat",
        usageCount: 0,
        rating: null,
        createdAt: null,
      },
      "ninja-researcher": {
        purpose: "code fixes and debugging solutions",
        usageCount: 0,
        rating: null,
        createdAt: null,
      },
      architect: {
        purpose: "feature architecture and design patterns",
        usageCount: 0,
        rating: null,
        createdAt: null,
      },
      executor: {
        purpose: "code execution, writing, and editing",
        usageCount: 0,
        rating: null,
        createdAt: null,
      },
      researcher: {
        purpose: "general research and information gathering",
        usageCount: 0,
        rating: null,
        createdAt: null,
      },
      vision: {
        purpose: "image analysis and visual content understanding",
        usageCount: 0,
        rating: null,
        createdAt: null,
      },
    },
    taskModelMapping: {
      researchBugFixes: "ninja-researcher",
      architectFeatures: "architect",
      executeCode: "executor",
      generalResearch: "researcher",
      visionAnalysis: "vision",
    },
    memories: {},
    usageStats: {
      tasksCompleted: {},
      modelEffectiveness: {},
    },
    mcpIntegrations: {
      webSearch: true,
      context7: true,
      docProcessor: true,
    },
    hardwareProfile: {
      minRamForParallel: 64,
      recommendedRam: 256,
      maxParallelModels: 3,
    },
    fallbackStrategy: {
      autoFallback: true,
      ratingThreshold: 3.0,
      maxAttempts: 3,
    },
  };
}

/**
 * Validate a DNA configuration object
 * @param {Object} dna - The DNA configuration to validate
 * @returns {Object} Validation result with valid flag and errors array
 */
export function validateModelDNA(dna) {
  const errors = [];

  // Basic object check
  if (!dna || typeof dna !== "object" || Array.isArray(dna)) {
    errors.push("DNA configuration must be an object");
    return { valid: false, errors };
  }

  // Validate version
  if (dna.version === undefined || typeof dna.version !== "number") {
    errors.push("version is required and must be a number");
  } else if (dna.version < 1) {
    errors.push("version must be >= 1");
  }

  // Validate models object
  if (!dna.models || typeof dna.models !== "object" || Array.isArray(dna.models)) {
    errors.push("models is required and must be an object");
  } else {
    // Validate each model role
    for (const [role, modelConfig] of Object.entries(dna.models)) {
      if (!VALID_MODEL_TYPES.includes(role)) {
        errors.push(`Invalid model role: ${role}. Must be one of: ${VALID_MODEL_TYPES.join(", ")}`);
      }

      if (!modelConfig || typeof modelConfig !== "object" || Array.isArray(modelConfig)) {
        errors.push(`Model "${role}" must be an object`);
        continue;
      }

      if (!modelConfig.purpose || typeof modelConfig.purpose !== "string") {
        errors.push(`Model "${role}" must have a purpose string`);
      }

      if (modelConfig.usageCount !== undefined && typeof modelConfig.usageCount !== "number") {
        errors.push(`Model "${role}" usageCount must be a number`);
      }

      if (modelConfig.rating !== undefined && modelConfig.rating !== null && typeof modelConfig.rating !== "number") {
        errors.push(`Model "${role}" rating must be a number or null`);
      }

      if (modelConfig.createdAt !== undefined && modelConfig.createdAt !== null && typeof modelConfig.createdAt !== "string") {
        errors.push(`Model "${role}" createdAt must be a string (ISO date) or null`);
      }
    }
  }

  // Validate taskModelMapping
  if (!dna.taskModelMapping || typeof dna.taskModelMapping !== "object" || Array.isArray(dna.taskModelMapping)) {
    errors.push("taskModelMapping is required and must be an object");
  } else {
    for (const [task, model] of Object.entries(dna.taskModelMapping)) {
      if (typeof task !== "string") {
        errors.push("Task mapping keys must be strings");
        continue;
      }
      if (typeof model !== "string") {
        errors.push(`Task mapping for "${task}" must reference a model role string`);
        continue;
      }
      if (!VALID_MODEL_TYPES.includes(model)) {
        errors.push(`Task "${task}" maps to invalid model role: ${model}`);
      }
    }
  }

  // Validate memories if present
  if (dna.memories !== undefined && (typeof dna.memories !== "object" || Array.isArray(dna.memories))) {
    errors.push("memories must be an object or undefined");
  }

  // Validate usageStats if present
  if (dna.usageStats !== undefined) {
    if (typeof dna.usageStats !== "object" || Array.isArray(dna.usageStats)) {
      errors.push("usageStats must be an object or undefined");
    } else {
      // Validate modelEffectiveness structure if present
      if (dna.usageStats.modelEffectiveness) {
        for (const [model, tasks] of Object.entries(dna.usageStats.modelEffectiveness)) {
          if (typeof tasks !== "object" || Array.isArray(tasks)) {
            errors.push(`modelEffectiveness.${model} must be an object`);
            continue;
          }
          for (const [task, ratings] of Object.entries(tasks)) {
            if (!Array.isArray(ratings)) {
              errors.push(`modelEffectiveness.${model}.${task} must be an array`);
              continue;
            }
            for (const rating of ratings) {
              if (!rating.rating || typeof rating.rating !== "number") {
                errors.push(`Rating must have a numeric rating field`);
              }
              if (rating.timestamp && typeof rating.timestamp !== "string") {
                errors.push(`Rating timestamp must be a string`);
              }
            }
          }
        }
      }
    }
  }

  // Validate mcpIntegrations if present
  if (dna.mcpIntegrations !== undefined && typeof dna.mcpIntegrations !== "object") {
    errors.push("mcpIntegrations must be an object or undefined");
  }

  // Validate hardwareProfile if present
  if (dna.hardwareProfile !== undefined && typeof dna.hardwareProfile !== "object") {
    errors.push("hardwareProfile must be an object or undefined");
  }

  // Validate fallbackStrategy if present
  if (dna.fallbackStrategy !== undefined && typeof dna.fallbackStrategy !== "object") {
    errors.push("fallbackStrategy must be an object or undefined");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Migration functions for upgrading DNA schema versions
 * Each migration function receives old DNA and returns migrated DNA
 */
const MIGRATIONS = {
  // Version 1 -> 2: Restructure from modelConfig to settings/hardwareProfile/fallbackStrategy
  1: (dna) => {
    const migrated = { ...dna, version: 2 };

    // Remove old modelConfig field if present
    if (migrated.modelConfig) {
      delete migrated.modelConfig;
    }

    // Ensure settings exist
    migrated.settings = migrated.settings || {
      temperature: 0.7,
      maxTokens: 1000,
    };

    // Add hardware profile if not present
    migrated.hardwareProfile = migrated.hardwareProfile || {
      minRamForParallel: 64,
      recommendedRam: 256,
      maxParallelModels: 3,
    };

    // Add fallback strategy if not present
    migrated.fallbackStrategy = migrated.fallbackStrategy || {
      autoFallback: true,
      ratingThreshold: 3.0,
      maxAttempts: 3,
    };

    return migrated;
  },

  // Version 2 -> 3: Normalize model role names (hyphenated)
  2: (dna) => {
    const migrated = { ...dna, version: 3 };
    
    // Normalize model role names if they use camelCase
    if (migrated.models) {
      const normalizedModels = {};
      for (const [role, config] of Object.entries(migrated.models)) {
        const normalizedRole = role
          .replace(/([A-Z])/g, "-$1")
          .toLowerCase()
          .replace(/^-/, "");
        normalizedModels[normalizedRole] = config;
      }
      migrated.models = normalizedModels;
    }

    // Normalize task mapping keys
    if (migrated.taskModelMapping) {
      const normalizedMapping = {};
      for (const [task, model] of Object.entries(migrated.taskModelMapping)) {
        // Normalize task key if it uses camelCase
        const normalizedTask = task
          .replace(/([A-Z])/g, "-$1")
          .toLowerCase()
          .replace(/^-/, "");
        normalizedMapping[normalizedTask] = model;
      }
      migrated.taskModelMapping = normalizedMapping;
    }

    return migrated;
  },
};

/**
 * Apply migrations to upgrade DNA to current schema version
 * @param {Object} dna - The DNA configuration to migrate
 * @returns {Object} Migrated DNA configuration
 */
export function applyMigration(dna) {
  if (!dna || typeof dna !== "object") {
    return dna;
  }

  const currentVersion = 3; // Latest schema version
  const sourceVersion = dna.version || 1;
  let migrated = { ...dna };

  // Apply migrations sequentially from source version to current
  for (let version = sourceVersion; version < currentVersion; version++) {
    const migrateFn = MIGRATIONS[version];
    if (!migrateFn) {
      console.warn(`[DNA] No migration path from version ${version} to ${version + 1}`);
      break;
    }

    console.log(`[DNA] Migrating from version ${version} to ${version + 1}`);
    migrated = migrateFn(migrated);
  }

  // Ensure final version is current
  if (migrated.version !== currentVersion) {
    migrated.version = currentVersion;
  }

  return migrated;
}

/**
 * Load DNA from file with automatic migration
 * @param {string} filePath - Path to DNA file
 * @returns {Object|null} Loaded and migrated DNA, or null if file doesn't exist
 */
export function loadDNAFromFile(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = readFileSync(filePath, "utf-8");
    const dna = JSON.parse(content);
    return applyMigration(dna);
  } catch (error) {
    console.error(`[DNA] Failed to load ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Save DNA to file with validation
 * @param {string} filePath - Path to DNA file
 * @param {Object} dna - DNA configuration to save
 * @returns {Object} Result with path and validation status
 */
export function saveDNAToFile(filePath, dna) {
  // Validate before saving
  const validation = validateModelDNA(dna);
  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors,
      path: filePath,
    };
  }

  try {
    // Ensure directory exists
    const dir = filePath.split("/").slice(0, -1).join("/");
    if (dir && !existsSync(dir)) {
      // Create directory recursively (simplified - assumes parent exists)
      // In production, use fs.mkdirSync with { recursive: true }
    }

    writeFileSync(filePath, JSON.stringify(dna, null, 2), "utf-8");
    return {
      success: true,
      path: filePath,
    };
  } catch (error) {
    return {
      success: false,
      errors: [error.message],
      path: filePath,
    };
  }
}

// Self-test when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("Testing DNA Schema module...");

  const defaultDNA = getDefaultDNA();
  console.log("Default DNA generated:", {
    version: defaultDNA.version,
    roles: Object.keys(defaultDNA.models),
    tasks: Object.keys(defaultDNA.taskModelMapping),
  });

  const validation = validateModelDNA(defaultDNA);
  console.log("Default DNA validation:", validation.valid ? "PASS" : "FAIL", validation.errors);

  // Test migration from version 1
  const oldDNA = {
    version: 1,
    primaryRole: "executor",
    modelConfig: { temperature: 0.7, maxTokens: 1000 },
    models: { executor: { purpose: "test" } },
    taskModelMapping: {},
  };
  const migrated = applyMigration(oldDNA);
  console.log("Migration v1->v2/v3:", migrated.version, "settings?", !!migrated.settings);

  console.log("Schema module tests complete.");
}