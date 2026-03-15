/**
 * Model DNA Manager - Phase 1 Core DNA System
 * Manages DNA file operations with caching and CRUD operations
 */

import { existsSync, statSync, unlinkSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { watch } from "node:fs";

// Get current directory when running as ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// DNA file constants
export const DNA_FILENAME = ".model-dna.json";
export const USER_DNA_FILENAME = ".model-user.json";

// Cache structures
let _cache = { path: null, mtime: 0, data: null };
let _userCache = { path: null, mtime: 0, data: null };
let _watchers = { dna: null, user: null };

/**
 * Get absolute DNA file path
 * @param {string} projectRoot - Project root directory
 * @returns {string} Absolute path to DNA file
 */
export function getDNAPath(projectRoot) {
  const root = projectRoot || process.cwd();
  return join(root, DNA_FILENAME);
}

/**
 * Get absolute user DNA file path
 * @param {string} projectRoot - Project root directory
 * @returns {string} Absolute path to user DNA file
 */
export function getUserDNAPath(projectRoot) {
  const root = projectRoot || process.cwd();
  return join(root, USER_DNA_FILENAME);
}

/**
 * Load DNA from file with caching
 * @param {string} projectRoot - Project root directory
 * @param {boolean} forceReload - Bypass cache if true
 * @returns {Object|null} DNA configuration or null if file doesn't exist
 */
export function loadModelDNA(projectRoot, forceReload = false) {
  const filePath = getDNAPath(projectRoot);

  try {
    // Check if file exists
    if (!existsSync(filePath)) {
      return null;
    }

    // Check cache first (fast path)
    if (!forceReload && _cache.path === filePath) {
      try {
        const stat = statSync(filePath);
        if (stat.mtimeMs === _cache.mtime) {
          return _cache.data;
        }
      } catch (error) {
        // Stat failed, will reload
      }
    }

    // Load from disk
    const dna = loadDNAFromFile(filePath);

    if (!dna) {
      return null;
    }

    // Update cache
    try {
      const stat = statSync(filePath);
      _cache = { path: filePath, mtime: stat.mtimeMs, data: dna };
    } catch (error) {
      _cache = { path: filePath, mtime: Date.now(), data: dna };
    }

    return dna;
  } catch (error) {
    console.error(`[DNA Manager] Failed to load ${DNA_FILENAME}:`, error.message);
    return null;
  }
}

/**
 * Load user DNA with caching
 * @param {string} projectRoot - Project root directory
 * @param {boolean} forceReload - Bypass cache if true
 * @returns {Object|null} User DNA or null if file doesn't exist
 */
export function loadUserDNA(projectRoot, forceReload = false) {
  const filePath = getUserDNAPath(projectRoot);

  try {
    // Check if file exists
    if (!existsSync(filePath)) {
      return null;
    }

    // Check cache first
    if (!forceReload && _userCache.path === filePath) {
      try {
        const stat = statSync(filePath);
        if (stat.mtimeMs === _userCache.mtime) {
          return _userCache.data;
        }
      } catch (error) {
        // Stat failed, will reload
      }
    }

    // Load from disk
    const content = readFileSync(filePath, "utf-8");
    const userDNA = JSON.parse(content);

    // Update cache
    try {
      const stat = statSync(filePath);
      _userCache = { path: filePath, mtime: stat.mtimeMs, data: userDNA };
    } catch (error) {
      _userCache = { path: filePath, mtime: Date.now(), data: userDNA };
    }

    return userDNA;
  } catch (error) {
    console.error(`[DNA Manager] Failed to load ${USER_DNA_FILENAME}:`, error.message);
    return null;
  }
}

/**
 * Merge DNA from multiple levels (defaults, project, user)
 * Priority: User > Project > Defaults
 * @param {string} projectRoot - Project root directory
 * @returns {Object} Merged DNA configuration
 */
export function mergeDNALevels(projectRoot) {
  const defaults = getDefaultDNA();
  const projectDNA = loadModelDNA(projectRoot) || {};
  const userDNA = loadUserDNA(projectRoot) || {};

  // Deep merge with progressive override
  return {
    version: userDNA.version || projectDNA.version || defaults.version,
    primaryRole: userDNA.primaryRole || projectDNA.primaryRole || defaults.primaryRole,

    models: {
      ...defaults.models,
      ...projectDNA.models,
      ...userDNA.models,
    },

    taskModelMapping: {
      ...defaults.taskModelMapping,
      ...projectDNA.taskModelMapping,
      ...userDNA.taskModelMapping,
    },

    memories: {
      ...defaults.memories,
      ...projectDNA.memories,
      ...userDNA.memories,
    },

    usageStats: {
      ...defaults.usageStats,
      ...projectDNA.usageStats,
      ...userDNA.usageStats,
    },

    mcpIntegrations: {
      ...defaults.mcpIntegrations,
      ...projectDNA.mcpIntegrations,
      ...userDNA.mcpIntegrations,
    },

    hardwareProfile: {
      ...defaults.hardwareProfile,
      ...projectDNA.hardwareProfile,
      ...userDNA.hardwareProfile,
    },

    fallbackStrategy: {
      ...defaults.fallbackStrategy,
      ...projectDNA.fallbackStrategy,
      ...userDNA.fallbackStrategy,
    },
  };
}

/**
 * Create DNA file with validation
 * @param {Object} config - DNA configuration
 * @param {string} projectRoot - Project root directory
 * @returns {Object} Result with path and validation status
 */
export function createDNAFile(config = {}, projectRoot) {
  const filePath = getDNAPath(projectRoot);
  const defaults = getDefaultDNA();

  // Deep merge with defaults, preserving any custom fields
  const merged = {
    ...defaults,
    ...config,
    models: {
      ...defaults.models,
      ...(config.models || {}),
    },
    taskModelMapping: {
      ...defaults.taskModelMapping,
      ...(config.taskModelMapping || {}),
    },
    memories: {
      ...defaults.memories,
      ...(config.memories || {}),
    },
    usageStats: {
      ...defaults.usageStats,
      ...(config.usageStats || {}),
    },
    mcpIntegrations: {
      ...defaults.mcpIntegrations,
      ...(config.mcpIntegrations || {}),
    },
    hardwareProfile: {
      ...defaults.hardwareProfile,
      ...(config.hardwareProfile || {}),
    },
    fallbackStrategy: {
      ...defaults.fallbackStrategy,
      ...(config.fallbackStrategy || {}),
    },
  };

  // Validate before saving
  const validation = validateModelDNA(merged);
  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors,
      path: filePath,
    };
  }

  try {
    // Ensure directory exists
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      // Create directory recursively would be needed in production
      // For now assume parent exists
    }

    writeFileSync(filePath, JSON.stringify(merged, null, 2), "utf-8");

    // Update cache
    try {
      const stat = statSync(filePath);
      _cache = { path: filePath, mtime: stat.mtimeMs, data: merged };
    } catch (error) {
      _cache = { path: filePath, mtime: Date.now(), data: merged };
    }

    return {
      success: true,
      path: filePath,
      config: merged,
    };
  } catch (error) {
    return {
      success: false,
      errors: [error.message],
      path: filePath,
    };
  }
}

/**
 * Record effectiveness rating for a model on a specific task
 * Maintains sliding window of last 10 ratings per model/task combo
 * @param {string} modelRole - Model role (e.g., "ninja-researcher")
 * @param {string} taskType - Task type (e.g., "researchBugFixes")
 * @param {number} rating - Rating 1-5 scale
 * @param {string} feedback - Optional feedback text
 * @param {string} projectRoot - Project root directory
 * @returns {Object|null} Updated usageStats or null on failure
 */
export function recordEffectivenessRating(modelRole, taskType, rating, feedback = "", projectRoot) {
  const dna = loadModelDNA(projectRoot);
  if (!dna) {
    return null;
  }

  // Validate rating
  const clampedRating = Math.max(1, Math.min(5, rating));

  // Initialize tracking structures
  if (!dna.usageStats) {
    dna.usageStats = {};
  }
  if (!dna.usageStats.modelEffectiveness) {
    dna.usageStats.modelEffectiveness = {};
  }
  if (!dna.usageStats.tasksCompleted) {
    dna.usageStats.tasksCompleted = {};
  }

  // Update task completion count
  dna.usageStats.tasksCompleted[taskType] = (dna.usageStats.tasksCompleted[taskType] || 0) + 1;

  // Initialize model ratings structure
  if (!dna.usageStats.modelEffectiveness[modelRole]) {
    dna.usageStats.modelEffectiveness[modelRole] = {};
  }
  if (!dna.usageStats.modelEffectiveness[modelRole][taskType]) {
    dna.usageStats.modelEffectiveness[modelRole][taskType] = [];
  }

  // Add new rating
  dna.usageStats.modelEffectiveness[modelRole][taskType].push({
    rating: clampedRating,
    feedback: feedback.trim() || null,
    timestamp: new Date().toISOString(),
  });

  // Keep only last 10 ratings per model/task combo (sliding window)
  const ratings = dna.usageStats.modelEffectiveness[modelRole][taskType];
  if (ratings.length > 10) {
    dna.usageStats.modelEffectiveness[modelRole][taskType] = ratings.slice(-10);
  }

  // Write back to disk
  const filePath = getDNAPath(projectRoot);
  const result = saveDNAToFile(filePath, dna);

  if (!result.success) {
    console.error("[DNA Manager] Failed to save rating:", result.errors);
    return null;
  }

  // Update cache
  try {
    const stat = statSync(filePath);
    _cache = { path: filePath, mtime: stat.mtimeMs, data: dna };
  } catch (error) {
    _cache = { path: filePath, mtime: Date.now(), data: dna };
  }

  return dna.usageStats.modelEffectiveness[modelRole][taskType];
}

/**
 * Get average rating for a model on a specific task
 * @param {string} modelRole - Model role
 * @param {string} taskType - Task type
 * @param {string} projectRoot - Project root directory
 * @returns {string|null} Average rating to 2 decimal places, or null if no ratings
 */
export function getAverageRating(modelRole, taskType, projectRoot) {
  const dna = loadModelDNA(projectRoot);

  if (!dna || !dna.usageStats?.modelEffectiveness?.[modelRole]?.[taskType]) {
    return null;
  }

  const ratings = dna.usageStats.modelEffectiveness[modelRole][taskType];

  if (ratings.length === 0) {
    return null;
  }

  const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
  const avg = sum / ratings.length;

  // Return formatted to 2 decimal places
  return avg.toFixed(2);
}

/**
 * Save a memory preference
 * @param {string} key - Memory key
 * @param {*} value - Memory value (string, number, boolean, object)
 * @param {string} projectRoot - Project root directory
 * @returns {Object|null} Saved memory entry or null on failure
 */
export function saveMemory(key, value, projectRoot) {
  const dna = loadModelDNA(projectRoot) || getDefaultDNA();

  // Initialize memories if needed
  if (!dna.memories) {
    dna.memories = {};
  }

  // Save memory with timestamp
  dna.memories[key] = {
    value,
    createdAt: new Date().toISOString(),
  };

  // Write to disk
  const filePath = getDNAPath(projectRoot);
  const result = saveDNAToFile(filePath, dna);

  if (!result.success) {
    console.error("[DNA Manager] Failed to save memory:", result.errors);
    return null;
  }

  // Update cache
  try {
    const stat = statSync(filePath);
    _cache = { path: filePath, mtime: stat.mtimeMs, data: dna };
  } catch (error) {
    _cache = { path: filePath, mtime: Date.now(), data: dna };
  }

  return dna.memories[key];
}

/**
 * Delete a memory preference
 * @param {string} key - Memory key to delete
 * @param {string} projectRoot - Project root directory
 * @returns {boolean} True if deleted, false if not found
 */
export function deleteMemory(key, projectRoot) {
  const dna = loadModelDNA(projectRoot);

  if (!dna || !dna.memories?.[key]) {
    return false;
  }

  delete dna.memories[key];

  // Write back
  const filePath = getDNAPath(projectRoot);
  const result = saveDNAToFile(filePath, dna);

  if (!result.success) {
    console.error("[DNA Manager] Failed to delete memory:", result.errors);
    return false;
  }

  // Invalidate cache
  clearCache();

  return true;
}

/**
 * Update DNA with partial updates
 * @param {Object} updates - Partial DNA updates
 * @param {string} projectRoot - Project root directory
 * @returns {Object} Updated DNA configuration
 */
export function updateDNA(updates, projectRoot) {
  const currentDNA = loadModelDNA(projectRoot) || getDefaultDNA();

  // Merge updates
  const updatedDNA = {
    ...currentDNA,
    ...updates,
    models: {
      ...currentDNA.models,
      ...(updates.models || {}),
    },
    taskModelMapping: {
      ...currentDNA.taskModelMapping,
      ...(updates.taskModelMapping || {}),
    },
    memories: {
      ...currentDNA.memories,
      ...(updates.memories || {}),
    },
    usageStats: {
      ...currentDNA.usageStats,
      ...(updates.usageStats || {}),
    },
    mcpIntegrations: {
      ...currentDNA.mcpIntegrations,
      ...(updates.mcpIntegrations || {}),
    },
    hardwareProfile: {
      ...currentDNA.hardwareProfile,
      ...(updates.hardwareProfile || {}),
    },
    fallbackStrategy: {
      ...currentDNA.fallbackStrategy,
      ...(updates.fallbackStrategy || {}),
    },
  };

  // Save updated DNA
  const filePath = getDNAPath(projectRoot);
  const result = saveDNAToFile(filePath, updatedDNA);

  if (!result.success) {
    throw new Error(`Failed to update DNA: ${result.errors.join(", ")}`);
  }

  // Update cache
  try {
    const stat = statSync(filePath);
    _cache = { path: filePath, mtime: stat.mtimeMs, data: updatedDNA };
  } catch (error) {
    _cache = { path: filePath, mtime: Date.now(), data: updatedDNA };
  }

  return updatedDNA;
}

/**
 * Reset DNA to default configuration
 * @param {string} projectRoot - Project root directory
 * @returns {Object} Default DNA configuration
 */
export function resetDNA(projectRoot) {
  const defaultDNA = getDefaultDNA();
  const filePath = getDNAPath(projectRoot);

  // Save default DNA
  const result = saveDNAToFile(filePath, defaultDNA);

  if (!result.success) {
    throw new Error(`Failed to reset DNA: ${result.errors.join(", ")}`);
  }

  // Update cache
  try {
    const stat = statSync(filePath);
    _cache = { path: filePath, mtime: stat.mtimeMs, data: defaultDNA };
  } catch (error) {
    _cache = { path: filePath, mtime: Date.now(), data: defaultDNA };
  }

  return defaultDNA;
}

/**
 * Clear all DNA caches
 */
export function clearCache() {
  _cache = { path: null, mtime: 0, data: null };
  _userCache = { path: null, mtime: 0, data: null };

  // Stop file watchers
  if (_watchers.dna) {
    _watchers.dna.close();
    _watchers.dna = null;
  }
  if (_watchers.user) {
    _watchers.user.close();
    _watchers.user = null;
  }
}

/**
 * Watch DNA files for changes and auto-reload cache
 * @param {string} projectRoot - Project root directory
 * @param {Function} callback - Called when file changes
 * @returns {Object} With stop() function
 */
export function watchDNAFiles(projectRoot, callback) {
  const dnaPath = getDNAPath(projectRoot);
  const userPath = getUserDNAPath(projectRoot);

  // Ensure files exist before watching
  if (!existsSync(dnaPath)) {
    createDNAFile({}, projectRoot);
  }
  if (!existsSync(userPath)) {
    writeFileSync(userPath, JSON.stringify({}, null, 2), "utf-8");
  }

  // Start watchers
  const dnaWatcher = watch(dnaPath, (eventType, filename) => {
    if (eventType === "change") {
      clearCache();
      const newDNA = loadModelDNA(projectRoot, true);
      callback("dna", newDNA, filename);
    }
  });

  const userWatcher = watch(userPath, (eventType, filename) => {
    if (eventType === "change") {
      clearCache();
      const newUserDNA = loadUserDNA(projectRoot, true);
      callback("user", newUserDNA, filename);
    }
  });

  _watchers = { dna: dnaWatcher, user: userWatcher };

  return {
    stop: () => {
      clearCache();
    },
  };
}

// Re-export from schema module
import {
  getDefaultDNA,
  validateModelDNA,
  applyMigration,
  loadDNAFromFile,
  saveDNAToFile,
} from "./model-dna-schema.js";

// Hardware detector import
import { hardwareDetector } from "./hardware-detector.js";

/**
 * Get effective max models per device for a given device ID
 * Combines hardware-based defaults with user DNA overrides
 * @param {string|null} deviceId - Device ID (null for default)
 * @param {string|null} projectRoot - Project root directory
 * @returns {Promise<number>} Maximum models allowed on this device
 */
export async function getMaxModelsPerDevice(deviceId = null, projectRoot) {
  // Load DNA configuration
  const dna = loadModelDNA(projectRoot);
  
  // Get hardware-based default
  const hwMaxModels = await hardwareDetector.getMaxModelsPerDevice(deviceId);
  
  // Check for user override in DNA
  let maxModels = hwMaxModels;
  
  if (dna?.orchestratorConfig) {
    // First check specific device limit
    if (dna.orchestratorConfig.maxModelsPerDevice && deviceId) {
      const specificLimit = dna.orchestratorConfig.maxModelsPerDevice[deviceId];
      if (specificLimit !== undefined) {
        maxModels = specificLimit;
      }
    }
    
    // If no specific limit, check global default for all devices
    if (maxModels === hwMaxModels && dna.orchestratorConfig.maxModelsPerDevice) {
      const wildcardLimit = dna.orchestratorConfig.maxModelsPerDevice["*"];
      if (wildcardLimit !== undefined) {
        maxModels = wildcardLimit;
      }
    }
  }
  
  // Also check environment variable for user override
  const envMaxModels = process.env.MAX_MODELS_PER_DEVICE;
  if (envMaxModels) {
    const parsed = parseInt(envMaxModels, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 10) {
      maxModels = parsed;
    }
  }
  
  // Also check device-specific environment variable
  if (deviceId) {
    const envDeviceLimit = process.env[`DEVICE_MAX_MODELS_${deviceId.toUpperCase().replace(/-/g, '_')}`];
    if (envDeviceLimit) {
      const parsed = parseInt(envDeviceLimit, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 10) {
        maxModels = parsed;
      }
    }
  }
  
  // Clamp to valid range
  maxModels = Math.max(1, Math.min(10, maxModels));
  
  console.log(`[DNA] Max models per device '${deviceId || 'default'}': ${maxModels} (hw: ${hwMaxModels}, dna: ${dna?.orchestratorConfig?.maxModelsPerDevice ? 'override' : 'none'})`);
  
  return maxModels;
}

// Self-test when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("Testing DNA Manager module...");

  const testDir = "./tests/tmp/test-dna-manager";
  import("node:fs").then(({ mkdirSync, rmdirSync, unlinkSync, readdirSync, rmdir }) => {
    // Clean up any previous test artifacts
    const cleanup = (dir) => {
      if (existsSync(dir)) {
        try {
          readdirSync(dir).forEach(file => {
            const filePath = join(dir, file);
            if (statSync(filePath).isDirectory()) {
              cleanup(filePath);
              rmdirSync(filePath);
            } else {
              unlinkSync(filePath);
            }
          });
          rmdirSync(dir);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };

    // Clean up before starting
    cleanup(testDir);

    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }

    console.log("1. Creating DNA file...");
    const result = createDNAFile({ primaryRole: "executor" }, testDir);
    console.log("Created:", result.success ? "OK" : "FAIL", result.path);

    console.log("2. Loading DNA...");
    const dna = loadModelDNA(testDir);
    console.log("Loaded:", dna ? `v${dna.version}, role: ${dna.primaryRole}` : "FAIL");

    console.log("3. Recording rating...");
    const ratings = recordEffectivenessRating("executor", "executeCode", 5, "Great!", testDir);
    console.log("Ratings:", ratings ? `${ratings.length} entries` : "FAIL");

    console.log("4. Getting average rating...");
    const avg = getAverageRating("executor", "executeCode", testDir);
    console.log("Average:", avg ? `${avg}/5` : "FAIL");

    console.log("5. Saving memory...");
    const memory = saveMemory("preferredModel", "executor", testDir);
    console.log("Memory saved:", memory ? "OK" : "FAIL");

    console.log("6. Resetting DNA...");
    const reset = resetDNA(testDir);
    console.log("Reset:", reset ? `v${reset.version}` : "FAIL");

    console.log("DNA Manager module tests complete.");

    // Cleanup after tests
    setTimeout(() => {
      cleanup(testDir);
      console.log("Cleaned up test artifacts");
    }, 100);
  });
}