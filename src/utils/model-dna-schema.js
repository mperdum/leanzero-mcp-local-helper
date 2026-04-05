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
      orchestratorConfig: {
        type: "object",
        required: false,
        default: {},
        description: "LM Link Multi-Device Orchestrator configuration",
        properties: {
          enabled: { type: "boolean", description: "Enable LM Link device discovery and orchestration" },
          maxParallelRequests: { type: "number", description: "Global limit on concurrent requests across all devices" },
          // New field: maxModelsPerDevice - default is 1 (one model per device by default)
          maxModelsPerDevice: {
            type: "object",
            description: "Maximum number of models that can be loaded simultaneously on each device",
            pattern: {
              "^[a-z0-9-]+$": { type: "number", minimum: 1, maximum: 10 },
            },
          },
          // Backwards compatibility: globalMaxModels (deprecated)
          globalMaxModels: { type: "number", description: "DEPRECATED: Use maxModelsPerDevice instead" },
          perDeviceLimits: {
            type: "object",
            pattern: {
              "^[a-z0-9-]+$": {
                type: "object",
                properties: {
                  maxConcurrent: { type: "number", description: "Max concurrent requests for this device" },
                  cooldownMs: { type: "number", description: "Cooldown period between requests in ms" },
                  dailyRequestLimit: { type: "number", description: "Daily request limit" },
                },
              },
            },
          },
          preferredDevices: {
            type: "array",
            items: { type: "string" },
            description: "Priority order for device selection",
          },
          autoLoadModels: { type: "boolean", description: "Auto-load models on remote devices when needed" },
          unloadAfterIdleMs: { type: "number", description: "Time in ms before auto-unloading idle models" },
          // SWARM Orchestrator Configuration
          swarm: {
            type: "object",
            required: false,
            description: "SWARM Research Orchestration configuration",
            properties: {
              enabled: { type: "boolean", description: "Enable SWARM orchestration for research tasks" },
              maxLightweightModelsPerDevice: {
                type: "number",
                minimum: 1,
                maximum: 8,
                default: 2,
                description: "Maximum concurrent lightweight models per device"
              },
              subtaskMaxTokens: {
                type: "number",
                minimum: 1000,
                maximum: 8000,
                default: 4000,
                description: "Maximum tokens for each research subtask result"
              },
              finalAggregationMaxTokens: {
                type: "number",
                minimum: 2000,
                maximum: 16000,
                default: 8000,
                description: "Maximum tokens for final aggregated response"
              },
              minMemoryGB: {
                type: "number",
                minimum: 4,
                default: 8,
                description: "Minimum free memory in GB to start SWARM operations"
              },
              maxSubtasks: {
                type: "number",
                minimum: 1,
                maximum: 32,
                default: 8,
                description: "Maximum number of parallel research bots"
              },
              fallbackEnabled: {
                type: "boolean",
                default: true,
                description: "Fall back to main models if lightweight models unavailable"
              },
            },
          },
        },
      },
};

/**
 * Get default DNA configuration
 * Provides baseline configuration for all model types and system settings
 */
export function getDefaultDNA() {
  return {
    version: 5,
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
    orchestratorConfig: {
      enabled: true,
      maxParallelRequests: 4,
      // Default to empty object - hardware-based defaults will be used for actual limits
      maxModelsPerDevice: {},
      perDeviceLimits: {},
      preferredDevices: [],
      autoLoadModels: true,
      unloadAfterIdleMs: 120000,
      swarm: {
        enabled: true,
        maxLightweightModelsPerDevice: 2,
        subtaskMaxTokens: 4000,
        finalAggregationMaxTokens: 8000,
        minMemoryGB: 8,
        maxSubtasks: 8,
        fallbackEnabled: true,
      },
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

  // Validate orchestratorConfig if present
  if (dna.orchestratorConfig !== undefined) {
    if (typeof dna.orchestratorConfig !== "object" || Array.isArray(dna.orchestratorConfig)) {
      errors.push("orchestratorConfig must be an object or undefined");
    } else {
      // Validate enabled field
      if (dna.orchestratorConfig.enabled !== undefined && typeof dna.orchestratorConfig.enabled !== "boolean") {
        errors.push("orchestratorConfig.enabled must be a boolean");
      }
      
      // Validate maxParallelRequests
      if (dna.orchestratorConfig.maxParallelRequests !== undefined) {
        if (typeof dna.orchestratorConfig.maxParallelRequests !== "number" || dna.orchestratorConfig.maxParallelRequests < 1) {
          errors.push("orchestratorConfig.maxParallelRequests must be a positive number");
        }
      }

      // Validate perDeviceLimits
      if (dna.orchestratorConfig.perDeviceLimits !== undefined && typeof dna.orchestratorConfig.perDeviceLimits !== "object") {
        errors.push("orchestratorConfig.perDeviceLimits must be an object");
      } else if (dna.orchestratorConfig.perDeviceLimits) {
        for (const [deviceId, limit] of Object.entries(dna.orchestratorConfig.perDeviceLimits)) {
          if (typeof deviceId !== "string") {
            errors.push(`orchestratorConfig.perDeviceLimits key must be a string`);
            continue;
          }
          if (typeof limit !== "object" || Array.isArray(limit)) {
            errors.push(`orchestratorConfig.perDeviceLimits[${deviceId}] must be an object`);
            continue;
          }
          if (limit.maxConcurrent !== undefined && (typeof limit.maxConcurrent !== "number" || limit.maxConcurrent < 1)) {
            errors.push(`orchestratorConfig.perDeviceLimits[${deviceId}].maxConcurrent must be a positive number`);
          }
          if (limit.cooldownMs !== undefined && (typeof limit.cooldownMs !== "number" || limit.cooldownMs < 0)) {
            errors.push(`orchestratorConfig.perDeviceLimits[${deviceId}].cooldownMs must be a non-negative number`);
          }
          if (limit.dailyRequestLimit !== undefined && (typeof limit.dailyRequestLimit !== "number" || limit.dailyRequestLimit < 1)) {
            errors.push(`orchestratorConfig.perDeviceLimits[${deviceId}].dailyRequestLimit must be a positive number`);
          }
        }
      }

      // Validate preferredDevices
      if (dna.orchestratorConfig.preferredDevices !== undefined) {
        if (!Array.isArray(dna.orchestratorConfig.preferredDevices)) {
          errors.push("orchestratorConfig.preferredDevices must be an array");
        } else {
          for (const device of dna.orchestratorConfig.preferredDevices) {
            if (typeof device !== "string") {
              errors.push("orchestratorConfig.preferredDevices items must be strings");
              break;
            }
          }
        }
      }

      // Validate autoLoadModels
      if (dna.orchestratorConfig.autoLoadModels !== undefined && typeof dna.orchestratorConfig.autoLoadModels !== "boolean") {
        errors.push("orchestratorConfig.autoLoadModels must be a boolean");
      }

      // Validate unloadAfterIdleMs
      if (dna.orchestratorConfig.unloadAfterIdleMs !== undefined) {
        if (typeof dna.orchestratorConfig.unloadAfterIdleMs !== "number" || dna.orchestratorConfig.unloadAfterIdleMs < 0) {
          errors.push("orchestratorConfig.unloadAfterIdleMs must be a non-negative number");
        }
      }

      // Validate maxModelsPerDevice
      if (dna.orchestratorConfig.maxModelsPerDevice !== undefined && typeof dna.orchestratorConfig.maxModelsPerDevice !== "object") {
        errors.push("orchestratorConfig.maxModelsPerDevice must be an object or undefined");
      } else if (dna.orchestratorConfig.maxModelsPerDevice) {
        for (const [deviceId, maxModels] of Object.entries(dna.orchestratorConfig.maxModelsPerDevice)) {
          if (typeof deviceId !== "string") {
            errors.push(`orchestratorConfig.maxModelsPerDevice key must be a string`);
            continue;
          }
          if (typeof maxModels !== "number" || maxModels < 1 || maxModels > 10) {
            errors.push(`orchestratorConfig.maxModelsPerDevice[${deviceId}] must be a number between 1 and 10`);
          }
        }
      }

      // Check deprecated globalMaxModels
      if (dna.orchestratorConfig.globalMaxModels !== undefined) {
        console.warn("[DNA] globalMaxModels is DEPRECATED - use maxModelsPerDevice instead");
        if (typeof dna.orchestratorConfig.globalMaxModels !== "number" || dna.orchestratorConfig.globalMaxModels < 1) {
          errors.push("orchestratorConfig.globalMaxModels must be a positive number");
        }
      }

      // Validate swarm configuration
      if (dna.orchestratorConfig.swarm !== undefined) {
        const swarm = dna.orchestratorConfig.swarm;
        
        if (typeof swarm !== "object" || Array.isArray(swarm)) {
          errors.push("orchestratorConfig.swarm must be an object or undefined");
        } else {
          // Validate enabled
          if (swarm.enabled !== undefined && typeof swarm.enabled !== "boolean") {
            errors.push("orchestratorConfig.swarm.enabled must be a boolean");
          }
          
          // Validate maxLightweightModelsPerDevice
          if (swarm.maxLightweightModelsPerDevice !== undefined) {
            if (typeof swarm.maxLightweightModelsPerDevice !== "number" || 
                swarm.maxLightweightModelsPerDevice < 1 || 
                swarm.maxLightweightModelsPerDevice > 8) {
              errors.push("orchestratorConfig.swarm.maxLightweightModelsPerDevice must be a number between 1 and 8");
            }
          }
          
          // Validate subtaskMaxTokens
          if (swarm.subtaskMaxTokens !== undefined) {
            if (typeof swarm.subtaskMaxTokens !== "number" || 
                swarm.subtaskMaxTokens < 1000 || 
                swarm.subtaskMaxTokens > 8000) {
              errors.push("orchestratorConfig.swarm.subtaskMaxTokens must be a number between 1000 and 8000");
            }
          }
          
          // Validate finalAggregationMaxTokens
          if (swarm.finalAggregationMaxTokens !== undefined) {
            if (typeof swarm.finalAggregationMaxTokens !== "number" || 
                swarm.finalAggregationMaxTokens < 2000 || 
                swarm.finalAggregationMaxTokens > 16000) {
              errors.push("orchestratorConfig.swarm.finalAggregationMaxTokens must be a number between 2000 and 16000");
            }
          }
          
          // Validate minMemoryGB
          if (swarm.minMemoryGB !== undefined) {
            if (typeof swarm.minMemoryGB !== "number" || 
                swarm.minMemoryGB < 4) {
              errors.push("orchestratorConfig.swarm.minMemoryGB must be a number >= 4");
            }
          }
          
          // Validate maxSubtasks
          if (swarm.maxSubtasks !== undefined) {
            if (typeof swarm.maxSubtasks !== "number" || 
                swarm.maxSubtasks < 1 || 
                swarm.maxSubtasks > 32) {
              errors.push("orchestratorConfig.swarm.maxSubtasks must be a number between 1 and 32");
            }
          }
          
          // Validate fallbackEnabled
          if (swarm.fallbackEnabled !== undefined && typeof swarm.fallbackEnabled !== "boolean") {
            errors.push("orchestratorConfig.swarm.fallbackEnabled must be a boolean");
          }
        }
      }
    }
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

  // Version 3 -> 4: Add maxModelsPerDevice configuration
  3: (dna) => {
    const migrated = { ...dna, version: 4 };

    // Add maxModelsPerDevice with default value of 1 if not present
    if (!migrated.orchestratorConfig || !migrated.orchestratorConfig.maxModelsPerDevice) {
      // Ensure orchestratorConfig exists
      if (!migrated.orchestratorConfig) {
        migrated.orchestratorConfig = {};
      }
      
      // Set default maxModelsPerDevice to empty object (will use hardware-based defaults)
      migrated.orchestratorConfig.maxModelsPerDevice = {};
      
      // If old globalMaxModels exists, apply it as a fallback
      if (migrated.orchestrConfig && migrated.orchestratorConfig.globalMaxModels) {
        console.log(`[DNA] Migrating globalMaxModels=${migrated.orchestratorConfig.globalMaxModels} to maxModelsPerDevice`);
        migrated.orchestratorConfig.maxModelsPerDevice["*"] = migrated.orchestratorConfig.globalMaxModels;
      }
    }

    // Remove deprecated globalMaxModels field
    if (migrated.orchestratorConfig && migrated.orchestratorConfig.globalMaxModels !== undefined) {
      delete migrated.orchestratorConfig.globalMaxModels;
    }

    return migrated;
  },

  // Version 4 -> 5: Add swarm configuration
  4: (dna) => {
    const migrated = { ...dna, version: 5 };

    // Add swarm configuration with defaults if not present
    if (!migrated.orchestratorConfig || !migrated.orchestratorConfig.swarm) {
      if (!migrated.orchestratorConfig) {
        migrated.orchestratorConfig = {};
      }
      
      migrated.orchestratorConfig.swarm = {
        enabled: true,
        maxLightweightModelsPerDevice: 2,
        subtaskMaxTokens: 4000,
        finalAggregationMaxTokens: 8000,
        minMemoryGB: 8,
        maxSubtasks: 8,
        fallbackEnabled: true,
      };
      
      console.log(`[DNA] Added swarm configuration with defaults`);
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

  const currentVersion = 5; // Latest schema version (added swarm configuration)
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

    // If it doesn't have a version and doesn't have any DNA-like keys, 
    // it's probably not a DNA file.
    const isLikelyDNA = dna.version !== undefined || dna.models !== undefined || dna.primaryRole !== undefined;
    if (!isLikelyDNA) {
      return null;
    }

    const migratedDna = applyMigration(dna);

    // If migration happened, persist the new version to disk
    if (migratedDna.version !== dna.version) {
      const saveResult = saveDNAToFile(filePath, migratedDna);
      if (!saveResult.success) {
        console.error(`[DNA] Migration failed to persist to ${filePath}:`, saveResult.errors);
        return null;
      }
    }

    return migratedDna;
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
  console.log("Migration v1->v2/v3/v4:", migrated.version, "settings?", !!migrated.settings);

  console.log("Schema module tests complete.");
}