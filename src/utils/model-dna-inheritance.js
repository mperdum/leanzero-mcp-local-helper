/**
 * Model DNA Inheritance - Phase 1 Core DNA System
 * Provides hierarchical merging of DNA configurations with priority resolution
 */

import { getDefaultDNA } from "./model-dna-schema.js";

/**
 * Deep merge two objects with custom merge strategy
 * @param {Object} target - Target object to merge into
 * @param {Object} source - Source object to merge from
 * @param {number} depth - Current recursion depth (for cycle detection)
 * @returns {Object} Merged object
 */
function deepMerge(target, source, depth = 0) {
  // Prevent infinite recursion
  if (depth > 10) {
    return target;
  }

  // Handle null/undefined source
  if (source === null || source === undefined) {
    return target;
  }

  // Handle non-objects (primitives) - source overwrites target
  if (typeof source !== "object" || Array.isArray(source)) {
    return source;
  }

  // Ensure target is an object
  const output = target && typeof target === 'object' && !Array.isArray(target) ? { ...target } : {};

  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = target && typeof target === 'object' && !Array.isArray(target) ? target[key] : undefined;

    // Skip undefined values in source
    if (sourceVal === undefined) {
      continue;
    }

    // If target value is not an object or is null/undefined, use source value
    if (targetVal === null || targetVal === undefined || typeof targetVal !== 'object' || Array.isArray(targetVal)) {
      output[key] = sourceVal;
    } else {
      // Both are objects - recursively merge
      output[key] = deepMerge(targetVal, sourceVal, depth + 1);
    }
  }

  return output;
}

/**
 * Merge DNA from multiple levels with proper priority
 * Priority order (highest to lowest):
 *   1. User DNA (.model-user.json)
 *   2. Project DNA (.model-dna.json)
 *   3. Default DNA (built-in)
 *
 * This function is also exported from model-dna-manager.js but kept here
 * as a standalone utility for advanced use cases.
 *
 * @param {Object} userDNA - User-level configuration overrides
 * @param {Object} projectDNA - Project-level configuration
 * @returns {Object} Fully merged DNA configuration
 */
export function mergeDNALevels(userDNA = {}, projectDNA = {}) {
  const defaults = getDefaultDNA();

  // Validate inputs
  if (typeof userDNA !== "object" || Array.isArray(userDNA)) {
    console.warn("[DNA Inheritance] Invalid userDNA, using empty object");
    userDNA = {};
  }
  if (typeof projectDNA !== "object" || Array.isArray(projectDNA)) {
    console.warn("[DNA Inheritance] Invalid projectDNA, using empty object");
    projectDNA = {};
  }

  // Merge with progressive override: defaults < project < user
  return {
    // Primitive values: user > project > defaults
    version: userDNA.version || projectDNA.version || defaults.version,
    primaryRole: userDNA.primaryRole || projectDNA.primaryRole || defaults.primaryRole,

    // Complex objects: deep merge with three levels
    models: deepMerge(deepMerge(defaults.models, projectDNA.models), userDNA.models),
    taskModelMapping: deepMerge(deepMerge(defaults.taskModelMapping, projectDNA.taskModelMapping), userDNA.taskModelMapping),
    memories: deepMerge(deepMerge(defaults.memories, projectDNA.memories), userDNA.memories),
    usageStats: deepMerge(deepMerge(defaults.usageStats, projectDNA.usageStats), userDNA.usageStats),
    mcpIntegrations: deepMerge(deepMerge(defaults.mcpIntegrations, projectDNA.mcpIntegrations), userDNA.mcpIntegrations),
    hardwareProfile: deepMerge(deepMerge(defaults.hardwareProfile, projectDNA.hardwareProfile), userDNA.hardwareProfile),
    fallbackStrategy: deepMerge(deepMerge(defaults.fallbackStrategy, projectDNA.fallbackStrategy), userDNA.fallbackStrategy),
  };
}

/**
 * Calculate the "effective" model for a given task type
 * This resolves which model role should handle a task based on inheritance
 *
 * @param {Object} mergedDNA - Already merged DNA configuration
 * @param {string} taskType - Task type identifier (e.g., "researchBugFixes")
 * @returns {string} Model role that should handle the task
 */
export function resolveEffectiveModel(mergedDNA, taskType) {
  // Check if task type exists in mapping
  if (mergedDNA.taskModelMapping && mergedDNA.taskModelMapping[taskType]) {
    return mergedDNA.taskModelMapping[taskType];
  }

  // Fallback to primary role
  return mergedDNA.primaryRole || "conversationalist";
}

/**
 * Compare two DNA configurations and identify differences
 * Useful for debugging inheritance issues and showing user what changed
 *
 * @param {Object} oldDNA - Previous DNA configuration
 * @param {Object} newDNA - New DNA configuration
 * @returns {Object|null} Object describing differences, or null if identical
 */
export function diffDNAConfigurations(oldDNA, newDNA) {
  // Handle null/undefined cases
  if (!oldDNA && !newDNA) {
    return null;
  }
  if (!oldDNA) {
    return { added: newDNA, modified: {}, removed: {} };
  }
  if (!newDNA) {
    return { added: {}, modified: {}, removed: oldDNA };
  }

  const differences = {
    added: {},
    modified: {},
    removed: {},
  };

  let hasChanges = false;

  // Check for added/modified keys
  for (const key of Object.keys(newDNA)) {
    if (!(key in oldDNA)) {
      differences.added[key] = newDNA[key];
      hasChanges = true;
    } else if (typeof newDNA[key] === 'object' && newDNA[key] !== null && !Array.isArray(newDNA[key]) &&
               typeof oldDNA[key] === 'object' && oldDNA[key] !== null && !Array.isArray(oldDNA[key])) {
      // Recursively diff nested objects
      const nestedDiff = diffDNAConfigurations(oldDNA[key], newDNA[key]);
      if (nestedDiff && (Object.keys(nestedDiff.added).length > 0 ||
                        Object.keys(nestedDiff.modified).length > 0 ||
                        Object.keys(nestedDiff.removed).length > 0)) {
        differences.modified[key] = nestedDiff;
        hasChanges = true;
      }
    } else if (oldDNA[key] !== newDNA[key]) {
      differences.modified[key] = {
        old: oldDNA[key],
        new: newDNA[key],
      };
      hasChanges = true;
    }
  }

  // Check for removed keys
  for (const key of Object.keys(oldDNA)) {
    if (!(key in newDNA)) {
      differences.removed[key] = oldDNA[key];
      hasChanges = true;
    }
  }

  // If no changes, return null
  if (!hasChanges) {
    return null;
  }

  return differences;
}

/**
 * Validate inheritance chain and report warnings
 * Checks for potential issues like circular references or invalid model roles
 *
 * @param {Object} userDNA - User-level DNA
 * @param {Object} projectDNA - Project-level DNA
 * @returns {Object} Validation result with warnings
 */
export function validateInheritanceChain(userDNA, projectDNA) {
  const warnings = [];

  // Check for invalid model roles in userDNA
  if (userDNA && userDNA.models) {
    for (const role of Object.keys(userDNA.models)) {
      const validRoles = ["conversationalist", "ninja-researcher", "architect", "executor", "researcher", "vision"];
      if (!validRoles.includes(role)) {
        warnings.push(`Invalid model role in user DNA: ${role}`);
      }
    }
  }

  // Check for invalid model roles in projectDNA
  if (projectDNA && projectDNA.models) {
    for (const role of Object.keys(projectDNA.models)) {
      const validRoles = ["conversationalist", "ninja-researcher", "architect", "executor", "researcher", "vision"];
      if (!validRoles.includes(role)) {
        warnings.push(`Invalid model role in project DNA: ${role}`);
      }
    }
  }

  // Check for version conflicts (user version should be >= project version)
  if (userDNA?.version && projectDNA?.version && userDNA.version < projectDNA.version) {
    warnings.push(`User DNA version (${userDNA.version}) is older than project DNA version (${projectDNA.version})`);
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

/**
 * Create a DNA inheritance chain report
 * Shows exactly how the final configuration was derived
 *
 * @param {string} projectRoot - Project root directory
 * @returns {Object} Detailed inheritance report
 */
export function getInheritanceReport(projectRoot) {
  const defaults = getDefaultDNA();

  return {
    generated: new Date().toISOString(),
    inheritanceChain: [
      { level: "defaults", source: "built-in", keys: Object.keys(defaults) },
      { level: "project", source: ".model-dna.json", keys: [] },
      { level: "user", source: ".model-user.json", keys: [] },
    ],
    resolutionRules: {
      primitiveValues: "User > Project > Defaults",
      objects: "Deep merge with progressive override",
      arrays: "Source overwrites target",
    },
  };
}

// Self-test when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("Testing DNA Inheritance module...");

  const defaults = getDefaultDNA();
  console.log("Defaults:", Object.keys(defaults.models).join(", "));

  // Test merging
  const projectDNA = {
    models: {
      executor: { purpose: "custom executor" },
    },
    taskModelMapping: {
      executeCode: "executor",
    },
  };

  const userDNA = {
    models: {
      executor: { purpose: "user's executor" },
    },
    primaryRole: "researcher",
  };

  const merged = mergeDNALevels(userDNA, projectDNA);
  console.log("Merged primaryRole:", merged.primaryRole);
  console.log("Merged executor purpose:", merged.models.executor.purpose);

  // Test resolution
  const resolved = resolveEffectiveModel(merged, "executeCode");
  console.log("Resolved model for executeCode:", resolved);

  // Test diff
  const oldConfig = { version: 1, models: { executor: { purpose: "old" } } };
  const newConfig = { version: 2, models: { executor: { purpose: "new" } } };
  const diff = diffDNAConfigurations(oldConfig, newConfig);
  console.log("Diff modified:", Object.keys(diff.modified));

  console.log("DNA Inheritance module tests complete.");
}
