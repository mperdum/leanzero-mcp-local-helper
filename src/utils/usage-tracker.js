/**
 * Usage Tracker - Phase 5 Evolution & Auto-Optimization
 * Tracks task completions, model switches, and effectiveness ratings
 */

import { loadModelDNA, getDNAPath } from "./model-dna-manager.js";

/**
 * UsageTracker class for tracking usage patterns and analytics
 */
export class UsageTracker {
  /**
   * Create a new UsageTracker instance
   * @param {Object} options - Configuration options
   * @param {number} [options.maxHistoryItems=10] - Maximum items to keep in history arrays (default: 10)
   */
  constructor(options = {}) {
    // Load maxHistoryItems from environment or use default (10 for consistency with getRecentModelSwitches)
    this.maxHistoryItems = parseInt(process.env.MAX_HISTORY_ITEMS || options.maxHistoryItems || "10", 10);
    
    // Track model switches separately (not stored in DNA)
    this.modelSwitches = [];
  }

  /**
   * Track a task completion with optional rating
   * @param {string} taskType - Type of task completed (e.g., "researchBugFixes")
   * @param {string} modelId - Model ID that executed the task
   * @param {Object} result - Task result object
   * @param {string} projectRoot - Project root directory for DNA file location
   * @returns {Object|null} Updated usage stats or null on failure
   */
  async trackTaskCompletion(taskType, modelId, result, projectRoot = process.cwd()) {
    // Force reload from disk to get latest data (bypass cache)
    const fs = await import("node:fs");
    const filePath = getDNAPath(projectRoot);
    
    let dna;
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }
      // Read the file fresh each time to avoid caching issues
      const content = fs.readFileSync(filePath, "utf-8");
      dna = JSON.parse(content);
    } catch (error) {
      // If file doesn't exist or can't be read, start fresh with empty object
      dna = {};
    }

    if (!dna.usageStats) {
      dna.usageStats = {};
    }
    if (!dna.usageStats.tasksCompleted) {
      dna.usageStats.tasksCompleted = {};
    }

    // Increment task completion count
    dna.usageStats.tasksCompleted[taskType] = (dna.usageStats.tasksCompleted[taskType] || 0) + 1;

    // Initialize modelEffectiveness tracking if needed
    if (!dna.usageStats.modelEffectiveness) {
      dna.usageStats.modelEffectiveness = {};
    }
    if (!dna.usageStats.modelEffectiveness[modelId]) {
      dna.usageStats.modelEffectiveness[modelId] = {};
    }
    // Ensure the array exists before modifying it
    if (!dna.usageStats.modelEffectiveness[modelId][taskType]) {
      dna.usageStats.modelEffectiveness[modelId][taskType] = [];
    }

    // If result contains rating, add it to the sliding window and track task count
    if (result && typeof result.rating === "number") {
      const clampedRating = Math.max(1, Math.min(5, result.rating));
      
      dna.usageStats.modelEffectiveness[modelId][taskType].push({
        rating: clampedRating,
        feedback: result.feedback?.trim() || null,
        timestamp: new Date().toISOString(),
      });

      // Keep only last 10 ratings per model/task combo (sliding window)
      const ratings = dna.usageStats.modelEffectiveness[modelId][taskType];
      if (ratings.length > 10) {
        dna.usageStats.modelEffectiveness[modelId][taskType] = ratings.slice(-10);
      }
    } else {
      // Even without a rating, track that this model completed this task
      // by adding an entry with null rating
      dna.usageStats.modelEffectiveness[modelId][taskType].push({
        rating: null,
        feedback: null,
        timestamp: new Date().toISOString(),
      });

      // Keep only last 10 entries per model/task combo (sliding window)
      const ratings = dna.usageStats.modelEffectiveness[modelId][taskType];
      if (ratings.length > 10) {
        dna.usageStats.modelEffectiveness[modelId][taskType] = ratings.slice(-10);
      }
    }

    // Save to disk - write fresh content each time with simple approach for reliability
    try {
      fs.writeFileSync(filePath, JSON.stringify(dna, null, 2), "utf-8");
    } catch (error) {
      console.error("[UsageTracker] Failed to save usage stats:", error.message);
    }

    return dna.usageStats;
  }

  /**
   * Record a model switch event (fallback scenario)
   * @param {string} fromModel - Original model that was tried first
   * @param {string} toModel - Fallback model that was used instead
   * @returns {Object} Switch record with timestamp
   */
  trackModelSwitch(fromModel, toModel) {
    const switchRecord = {
      fromModel,
      toModel,
      timestamp: new Date().toISOString(),
    };

    this.modelSwitches.push(switchRecord);

    // Keep only last maxHistoryItems switches (use instance's limit)
    if (this.modelSwitches.length > this.maxHistoryItems) {
      this.modelSwitches = this.modelSwitches.slice(-this.maxHistoryItems);
    }

    return switchRecord;
  }

  /**
   * Record a manual effectiveness rating
   * @param {string} modelRole - Model role (e.g., "ninja-researcher")
   * @param {string} taskType - Task type (e.g., "researchBugFixes")
   * @param {number} rating - Rating on 1-5 scale
   * @param {string} feedback - Optional feedback text
   * @param {string} projectRoot - Project root directory for DNA file location
   * @returns {Object|null} Updated ratings array or null on failure
   */
  async trackRating(modelRole, taskType, rating, feedback = "", projectRoot = process.cwd()) {
    const clampedRating = Math.max(1, Math.min(5, rating));

    // Use the DNA manager's existing function to handle storage
    return recordEffectivenessRatingWithTracker(modelRole, taskType, clampedRating, feedback, projectRoot);
  }

  /**
   * Get statistics for a specific task type
   * @param {string} taskType - Task type to get stats for
   * @param {string} projectRoot - Project root directory for DNA file location
   * @returns {Object|null} Task statistics or null if not found
   */
  async getTaskStats(taskType, projectRoot = process.cwd()) {
    // Force reload from disk to get latest data (bypass cache)
    const fs = await import("node:fs");
    const filePath = getDNAPath(projectRoot);
    
    let dna;
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }
      const content = fs.readFileSync(filePath, "utf-8");
      dna = JSON.parse(content);
    } catch (error) {
      return null;
    }

    if (!dna?.usageStats) {
      return null;
    }

    // Get total count for this task type
    const count = dna.usageStats.tasksCompleted?.[taskType] || 0;

    // Build models used breakdown
    const modelsUsed = [];
    const averageRatings = {};

    if (dna.usageStats.modelEffectiveness) {
      for (const [modelId, tasks] of Object.entries(dna.usageStats.modelEffectiveness)) {
        if (tasks[taskType] && tasks[taskType].length > 0) {
          modelsUsed.push({
            modelId,
            count: tasks[taskType].length,
          });

          // Calculate average rating for this model/task combo
          const ratings = tasks[taskType];
          const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
          averageRatings[modelId] = (sum / ratings.length).toFixed(2);
        }
      }
    }

    return {
      count,
      modelsUsed: modelsUsed.sort((a, b) => b.count - a.count), // Sort by most used first
      averageRatings,
    };
  }

  /**
   * Get statistics for a specific model
   * @param {string} modelId - Model ID to get stats for
   * @param {string} projectRoot - Project root directory for DNA file location
   * @returns {Object|null} Model statistics or null if not found
   */
  async getModelStats(modelId, projectRoot = process.cwd()) {
    // Force reload from disk to get latest data (bypass cache)
    const fs = await import("node:fs");
    const filePath = getDNAPath(projectRoot);
    
    let dna;
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }
      const content = fs.readFileSync(filePath, "utf-8");
      dna = JSON.parse(content);
    } catch (error) {
      return null;
    }

    if (!dna?.usageStats) {
      return null;
    }

    let totalTasks = 0;
    const taskBreakdown = {};
    const allRatings = [];

    // Aggregate data from modelEffectiveness
    if (dna.usageStats.modelEffectiveness?.[modelId]) {
      for (const [taskType, ratings] of Object.entries(
        dna.usageStats.modelEffectiveness[modelId]
      )) {
        const count = ratings.length;
        totalTasks += count;

        // Calculate average rating for this task type
        if (count > 0) {
          const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
          taskBreakdown[taskType] = {
            count,
            averageRating: (sum / count).toFixed(2),
          };

          // Collect all ratings for overall calculation
          allRatings.push(...ratings);
        }
      }
    }

    // Calculate overall rating
    let overallRating = null;
    if (allRatings.length > 0) {
      const sum = allRatings.reduce((acc, r) => acc + r.rating, 0);
      overallRating = (sum / allRatings.length).toFixed(2);
    }

    return {
      totalTasks,
      taskBreakdown,
      overallRating,
    };
  }

  /**
   * Get average ratings across all models and tasks
   * @param {string} projectRoot - Project root directory for DNA file location
   * @returns {Object|null} Average ratings or null if not found
   */
  async getAverageRatings(projectRoot = process.cwd()) {
    // Force reload from disk to get latest data (bypass cache)
    const fs = await import("node:fs");
    const filePath = getDNAPath(projectRoot);
    
    let dna;
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }
      const content = fs.readFileSync(filePath, "utf-8");
      dna = JSON.parse(content);
    } catch (error) {
      return null;
    }

    if (!dna?.usageStats?.modelEffectiveness) {
      return null;
    }

    const result = {};

    for (const [modelId, tasks] of Object.entries(
      dna.usageStats.modelEffectiveness
    )) {
      result[modelId] = {};

      for (const [taskType, ratings] of Object.entries(tasks)) {
        if (ratings.length > 0) {
          const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
          result[modelId][taskType] = {
            average: (sum / ratings.length).toFixed(2),
            count: ratings.length,
          };
        }
      }
    }

    return result;
  }

  /**
   * Detect usage patterns and issues
   * @param {string} projectRoot - Project root directory for DNA file location
   * @returns {Object|null} Detected patterns or null if not found
   */
  async detectPatterns(projectRoot = process.cwd()) {
    // Force reload from disk to get latest data (bypass cache)
    const fs = await import("node:fs");
    const filePath = getDNAPath(projectRoot);
    
    let dna;
    try {
      if (!fs.existsSync(filePath)) {
        return { patterns: [] };
      }
      const content = fs.readFileSync(filePath, "utf-8");
      dna = JSON.parse(content);
    } catch (error) {
      return { patterns: [] };
    }

    if (!dna?.usageStats?.modelEffectiveness) {
      return { patterns: [] };
    }

    const patterns = [];
    const lowRatingThreshold = parseFloat(
      process.env.EVOLUTION_LOW_RATING_THRESHOLD || "3.0"
    );

    // Analyze each model's performance across tasks
    for (const [modelId, tasks] of Object.entries(dna.usageStats.modelEffectiveness)) {
      for (const [taskType, ratings] of Object.entries(tasks)) {
        if (ratings.length === 0) continue;

        const lowRatings = ratings.filter((r) => r.rating < lowRatingThreshold).length;
        const totalRatings = ratings.length;
        const lowRatePercentage = lowRatings / totalRatings;

        // Detect high low-rating rate pattern (>50% of ratings below threshold)
        if (lowRatePercentage > 0.5 && totalRatings >= 3) {
          patterns.push({
            type: "high-low-rating-rate",
            modelId,
            taskType,
            lowRatingCount: lowRatings,
            totalRatings,
            lowRatePercentage: (lowRatePercentage * 100).toFixed(1),
            recommendation: `Consider reassigning ${taskType} from ${modelId}. Only ${(1 - lowRatePercentage) * 100}% of ratings are acceptable.`,
          });
        }
      }
    }

    return { patterns };
  }

  /**
   * Get a summary overview of usage statistics
   * @param {string} projectRoot - Project root directory for DNA file location
   * @returns {Object|null} Usage summary or null if not found
   */
  async getUsageSummary(projectRoot = process.cwd()) {
    // Force reload from disk to get latest data (bypass cache)
    const fs = await import("node:fs");
    const filePath = getDNAPath(projectRoot);
    
    let dna;
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }
      const content = fs.readFileSync(filePath, "utf-8");
      dna = JSON.parse(content);
    } catch (error) {
      return null;
    }

    if (!dna?.usageStats) {
      return null;
    }

    // Count total tasks completed
    let totalTasks = 0;
    if (dna.usageStats.tasksCompleted) {
      totalTasks = Object.values(dna.usageStats.tasksCompleted).reduce(
        (sum, count) => sum + count,
        0
      );
    }

    // Count models used
    const modelsUsed = [];
    let totalRatings = 0;

    if (dna.usageStats.modelEffectiveness) {
      for (const [modelId, tasks] of Object.entries(dna.usageStats.modelEffectiveness)) {
        let modelTaskCount = 0;
        let modelRatingCount = 0;

        for (const ratings of Object.values(tasks)) {
          modelTaskCount += ratings.length;
          modelRatingCount += ratings.length;
        }

        if (modelTaskCount > 0) {
          modelsUsed.push({
            modelId,
            tasksCompleted: modelTaskCount,
            totalRatings: modelRatingCount,
          });
        }

        totalRatings += modelRatingCount;
      }
    }

    return {
      totalTasks,
      totalRatings,
      modelsUsed: modelsUsed.sort((a, b) => b.tasksCompleted - a.tasksCompleted),
      taskTypes: Object.keys(dna.usageStats.tasksCompleted || {}),
      modelSwitchesCount: this.modelSwitches.length,
    };
  }

  /**
   * Get recent model switches (for debugging/analysis)
   * @param {number} [limit] - Maximum number of records to return (defaults to instance's maxHistoryItems)
   * @returns {Array} Recent switch records
   */
  getRecentModelSwitches(limit = this.maxHistoryItems) {
    // Return up to the smaller of limit and actual array length
    const count = Math.min(limit, this.modelSwitches.length);
    return this.modelSwitches.slice(-count);
  }

  /**
   * Clear all tracking data (useful for testing)
   */
  clear() {
    this.modelSwitches = [];
  }
}

/**
 * Helper function to record effectiveness rating with tracker integration
 * @param {string} modelRole - Model role
 * @param {string} taskType - Task type
 * @param {number} rating - Rating on 1-5 scale
 * @param {string} feedback - Optional feedback text
 * @param {string} projectRoot - Project root directory
 * @returns {Object|null} Updated ratings array or null on failure
 */
async function recordEffectivenessRatingWithTracker(
  modelRole,
  taskType,
  rating,
  feedback = "",
  projectRoot
) {
  // Force reload from disk to get latest data (bypass cache)
  const fs = await import("node:fs");
  const filePath = getDNAPath(projectRoot);
  
  let dna;
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    // Read the file fresh each time to avoid caching issues
    const content = fs.readFileSync(filePath, "utf-8");
    dna = JSON.parse(content);
  } catch (error) {
    // If file doesn't exist or can't be read, start fresh with empty object
    dna = {};
  }

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
  dna.usageStats.tasksCompleted[taskType] =
    (dna.usageStats.tasksCompleted[taskType] || 0) + 1;

  // Initialize model ratings structure
  if (!dna.usageStats.modelEffectiveness[modelRole]) {
    dna.usageStats.modelEffectiveness[modelRole] = {};
  }
  if (!dna.usageStats.modelEffectiveness[modelRole][taskType]) {
    dna.usageStats.modelEffectiveness[modelRole][taskType] = [];
  }

  // Add new rating
  dna.usageStats.modelEffectiveness[modelRole][taskType].push({
    rating: Math.max(1, Math.min(5, rating)),
    feedback: feedback.trim() || null,
    timestamp: new Date().toISOString(),
  });

  // Keep only last 10 ratings per model/task combo (sliding window)
  const ratings = dna.usageStats.modelEffectiveness[modelRole][taskType];
  if (ratings.length > 10) {
    dna.usageStats.modelEffectiveness[modelRole][taskType] = ratings.slice(-10);
  }

  // Write back to disk - write fresh content each time with simple approach for reliability
  try {
    fs.writeFileSync(filePath, JSON.stringify(dna, null, 2), "utf-8");
  } catch (error) {
    console.error("[UsageTracker] Failed to save rating:", error.message);
    return null;
  }

  return dna.usageStats.modelEffectiveness[modelRole][taskType];
}

// Export singleton instance for easy import
export const usageTracker = new UsageTracker();