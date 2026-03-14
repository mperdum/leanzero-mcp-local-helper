/**
 * Evolution Engine - Phase 5 Evolution & Auto-Optimization
 * Analyzes DNA usage data and applies mutations for optimization
 */

import { loadModelDNA, getDNAPath } from "../utils/model-dna-manager.js";
import { ratingAnalyzer } from "./rating-analyzer.js";

/**
 * EvolutionEngine class for auto-evolving model configurations
 */
export class EvolutionEngine {
  /**
   * Create a new EvolutionEngine instance
   * @param {Object} options - Configuration options
   * @param {number} [options.lowRatingThreshold=3.0] - Rating below which mutations are suggested
   * @param {number} [options.minRatingsForEvolution=5] - Minimum ratings before evolution triggers
   * @param {number} [options.maxHistoryItems=100] - Maximum history entries to keep
   */
  constructor(options = {}) {
    // Load thresholds from environment or use defaults
    this.evolutionThresholds = {
      lowRatingThreshold: parseFloat(
        process.env.EVOLUTION_LOW_RATING_THRESHOLD ||
          options.lowRatingThreshold ||
          "3.0"
      ),
      minRatingsForEvolution: parseInt(
        process.env.EVOLUTION_MIN_RATINGS ||
          options.minRatingsForEvolution ||
          "5",
        10
      ),
    };

    // Evolution history (last maxHistoryItems entries)
    this.maxHistoryItems = parseInt(
      process.env.MAX_HISTORY_ITEMS || options.maxHistoryItems || "100",
      10
    );
    this.evolutionHistory = [];

    // Track mutation execution count for safety
    this.mutationExecutionCount = 0;
    this.maxMutationsPerEvolution = 5;
  }

  /**
   * Main entry point: analyze DNA and apply mutations if needed
   * @param {Object} dna - DNA configuration object (or projectRoot string to load from file)
   * @param {boolean} [apply=true] - Whether to automatically apply mutations
   * @param {string} [projectRoot] - Project root directory (optional, used if first param is a string)
   * @returns {Promise<Object|null>} Evolution result or null on failure
   */
  async analyzeAndEvolve(dnaOrPath, apply = true, projectRoot = process.cwd()) {
    let dna;

    // Handle both cases: passing DNA object directly or path string
    if (typeof dnaOrPath === "string") {
      dna = loadModelDNA(dnaOrPath);
      projectRoot = dnaOrPath;
    } else {
      dna = dnaOrPath;
    }

    if (!dna) {
      return null;
    }

    // Analyze usage data
    const analysis = this.analyzeUsage(dna, projectRoot);

    if (!analysis || !analysis.suggestions || analysis.suggestions.length === 0) {
      return {
        dna: null,
        mutationsApplied: [],
        analysis: analysis || {},
        wasEvolved: false,
        reason: "No actionable suggestions found",
      };
    }

    // Sort suggestions by priority
    const sortedSuggestions = this.sortByPriority(analysis.suggestions);

    // Generate mutations from top-priority suggestions
    const mutations = [];
    for (const suggestion of sortedSuggestions) {
      if (mutations.length >= this.maxMutationsPerEvolution) break;

      const mutation = this.generateMutationFromSuggestion(suggestion, dna);
      if (mutation) {
        mutations.push(mutation);
      }
    }

    // Apply mutations if requested and we have some to apply
    let appliedMutations = [];
    if (apply && mutations.length > 0) {
      const resultDNA = await this.applyMutationsToDNA(dna, mutations, projectRoot);

      if (resultDNA) {
        dna = resultDNA;
        appliedMutations = mutations.map((m) => ({
          mutation: m,
          timestamp: new Date().toISOString(),
        }));

        // Record each evolution event
        for (const mutation of appliedMutations) {
          this.recordEvolution(mutation.mutation, { success: true });
        }
      }
    }

    return {
      dna: apply ? dna : null,
      mutationsApplied: appliedMutations,
      analysis,
      wasEvolved: appliedMutations.length > 0,
      suggestions: sortedSuggestions.slice(0, this.maxMutationsPerEvolution),
    };
  }

  /**
   * Analyze usage data from DNA configuration
   * @param {Object} dna - DNA configuration object
   * @param {string} [projectRoot] - Project root directory for additional context
   * @returns {Object|null} Analysis result or null on failure
   */
  analyzeUsage(dna, projectRoot = process.cwd()) {
    // Use the rating analyzer to get model ratings analysis
    const ratingsAnalysis = ratingAnalyzer.analyzeModelRatings(dna, projectRoot);

    if (!ratingsAnalysis) {
      return null;
    }

    // Generate suggestions from ratings analysis
    const suggestions = ratingAnalyzer.generateSuggestions(ratingsAnalysis);

    // Filter to only actionable suggestions (exclude underused warnings by default)
    const actionableSuggestions = ratingAnalyzer.getActionableSuggestions(suggestions);

    return {
      ...ratingsAnalysis,
      suggestions: actionableSuggestions,
      allSuggestions: suggestions,
    };
  }

  /**
   * Generate mutation objects from analysis suggestions
   * @param {Object} analysis - Analysis result
   * @returns {Array} Array of mutation objects
   */
  generateMutations(analysis) {
    if (!analysis?.suggestions) {
      return [];
    }

    const mutations = [];

    for (const suggestion of analysis.suggestions) {
      // Currently, we don't auto-generate mutations from rating suggestions alone
      // Mutations require knowing which alternative model to use
      // This is a placeholder for future enhancement
    }

    return mutations;
  }

  /**
   * Generate a mutation from a specific suggestion
   * @param {Object} suggestion - Suggestion object from rating analyzer
   * @param {Object} dna - DNA configuration
   * @returns {Object|null} Mutation object or null if cannot generate
   */
  generateMutationFromSuggestion(suggestion, dna) {
    // For low-rating suggestions, suggest reassigning tasks to different models
    if (suggestion.type === "low-rating") {
      return this.createReassignmentMutation(
        suggestion.modelRole,
        suggestion.averageRating,
        dna
      );
    }

    // For high-variance, suggest limiting model usage to specific task types
    if (suggestion.type === "high-variance") {
      return this.createRestrictedUsageMutation(suggestion.modelRole, dna);
    }

    // Underused doesn't need a mutation - just more usage data needed
    return null;
  }

  /**
   * Create a reassignment mutation for low-rated models
   * @param {string} modelRole - Model role to reassign from
   * @param {number} averageRating - Current average rating
   * @param {Object} dna - DNA configuration
   * @returns {Object|null} Mutation object or null if no alternative exists
   */
  createReassignmentMutation(modelRole, averageRating, dna) {
    // Find an alternative model with better ratings for similar tasks
    const alternativeModel = this.findBetterAlternative(
      modelRole,
      averageRating,
      dna
    );

    if (!alternativeModel) {
      return null;
    }

    // Get task types assigned to the low-rated model
    const taskTypesForModel = [];
    if (dna.taskModelMapping) {
      for (const [taskType, mapping] of Object.entries(dna.taskModelMapping)) {
        if (mapping === modelRole || (Array.isArray(mapping) && mapping.includes(modelRole))) {
          taskTypesForModel.push(taskType);
        }
      }
    }

    if (taskTypesForModel.length === 0) {
      return null;
    }

    // Create mutation to reassign these tasks
    return {
      type: "reassign-tasks",
      path: "taskModelMapping",
      value: this.createReassignmentValue(
        dna.taskModelMapping,
        taskTypesForModel,
        modelRole,
        alternativeModel
      ),
      fromModel: modelRole,
      toModel: alternativeModel,
      affectedTasks: taskTypesForModel,
    };
  }

  /**
   * Create a restricted usage mutation for high-variance models
   * @param {string} modelRole - Model role with inconsistent performance
   * @param {Object} dna - DNA configuration
   * @returns {Object|null} Mutation object or null if no changes needed
   */
  createRestrictedUsageMutation(modelRole, dna) {
    // Analyze which task types the model performs well on
    const dnaWithUsage = loadModelDNA(process.cwd());

    if (!dnaWithUsage?.usageStats?.modelEffectiveness?.[modelRole]) {
      return null;
    }

    const tasks = dnaWithUsage.usageStats.modelEffectiveness[modelRole];
    const goodTasks = [];

    for (const [taskType, ratings] of Object.entries(tasks)) {
      if (ratings.length >= 3) {
        const avgRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
        if (avgRating >= 4.0) {
          goodTasks.push(taskType);
        }
      }
    }

    if (goodTasks.length === 0) {
      return null;
    }

    // Only allow the model for its best-performing tasks
    const newMapping = {};

    // Keep existing mappings that are NOT to this model
    if (dna.taskModelMapping) {
      for (const [taskType, mapping] of Object.entries(dna.taskModelMapping)) {
        if (!Array.isArray(mapping) && mapping !== modelRole) {
          newMapping[taskType] = mapping;
        } else if (Array.isArray(mapping) && !mapping.includes(modelRole)) {
          newMapping[taskType] = mapping;
        }
      }
    }

    // Add the good tasks mapped to this model
    for (const taskType of goodTasks) {
      const currentMapping = dna.taskModelMapping?.[taskType];
      if (!currentMapping || currentMapping === modelRole) {
        newMapping[taskType] = modelRole;
      } else if (Array.isArray(currentMapping)) {
        // Only add if not already in the array
        if (!currentMapping.includes(modelRole)) {
          newMapping[taskType] = [...currentMapping, modelRole];
        }
      }
    }

    return {
      type: "restrict-model-usage",
      path: "taskModelMapping",
      value: newMapping,
      modelRole,
      allowedTasks: goodTasks,
    };
  }

  /**
   * Find a better alternative model for reassignment
   * @param {string} currentModel - Current low-rated model role
   * @param {number} currentRating - Current average rating
   * @param {Object} dna - DNA configuration
   * @returns {string|null} Alternative model role or null if none found
   */
  findBetterAlternative(currentModel, currentRating, dna) {
    // Look for models with higher ratings in the same task types
    const allModels = Object.keys(dna.models || {});

    for (const candidate of allModels) {
      if (candidate === currentModel) continue;

      // Check if this model has better performance
      const candidateStats = ratingAnalyzer.analyzeModelRatings({
        usageStats: {
          modelEffectiveness: dna.usageStats?.modelEffectiveness || {},
        },
      });

      if (candidateStats?.modelAnalysis?.[candidate]) {
        const candidateRating = parseFloat(
          candidateStats.modelAnalysis[candidate].averageRating
        );
        const candidateCount = candidateStats.modelAnalysis[candidate]
          .ratingCount;

        // Prefer models with higher ratings and sufficient data
        if (
          candidateRating > currentRating &&
          candidateCount >= this.evolutionThresholds.minRatingsForEvolution
        ) {
          return candidate;
        }
      }
    }

    // If no better model found, return a fallback option from the primary role
    const primaryRole = dna.primaryRole || "ninja-researcher";
    if (primaryRole !== currentModel) {
      return primaryRole;
    }

    return null;
  }

  /**
   * Create reassignment value for task model mapping
   * @param {Object} currentMapping - Current task model mapping
   * @param {string[]} tasksToReassign - Task types to reassign
   * @param {string} fromModel - Model to remove
   * @param {string} toModel - Model to add
   * @returns {Object} New task model mapping value
   */
  createReassignmentValue(currentMapping, tasksToReassign, fromModel, toModel) {
    const newMapping = {};

    for (const [taskType, mapping] of Object.entries(currentMapping || {})) {
      if (tasksToReassign.includes(taskType)) {
        // Reassign this task to the new model
        if (Array.isArray(mapping)) {
          // Convert array to single value or add to array
          newMapping[taskType] = mapping.includes(toModel)
            ? mapping
            : [toModel, ...mapping.filter((m) => m !== fromModel)];
        } else {
          newMapping[taskType] = toModel;
        }
      } else {
        // Keep existing mapping unchanged
        newMapping[taskType] = mapping;
      }
    }

    return newMapping;
  }

  /**
   * Apply a single mutation to the DNA structure using dot-notation paths
   * @param {Object} dna - DNA configuration object (modified in place)
   * @param {Object} mutation - Mutation object with path and value
   * @returns {boolean} True if mutation was applied successfully
   */
  applyMutation(dna, mutation) {
    const { path, value } = mutation;

    if (!path || !dna) {
      return false;
    }

    try {
      // Navigate to the parent object using dot notation
      const parts = path.split(".");
      let current = dna;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        
        // Create the property if it doesn't exist (for new paths)
        if (!(part in current)) {
          current[part] = {};
        } else if (i < parts.length - 2 && typeof current[part] !== 'object') {
          // If we need to traverse further but this is not an object, replace with empty object
          current[part] = {};
        }
        
        current = current[part];
      }

      // Set the value at the target path
      const lastPart = parts[parts.length - 1];
      current[lastPart] = value;

      return true;
    } catch (error) {
      console.error(
        `[EvolutionEngine] Failed to apply mutation to '${path}':`,
        error.message
      );
      return false;
    }
  }

  /**
   * Apply multiple mutations to DNA and save to file
   * @param {Object} dna - DNA configuration object
   * @param {Array} mutations - Array of mutation objects
   * @param {string} projectRoot - Project root directory for saving
   * @returns {Promise<Object|null>} Updated DNA or null on failure
   */
  async applyMutationsToDNA(dna, mutations, projectRoot = process.cwd()) {
    if (!mutations || mutations.length === 0) {
      return dna;
    }

    // Make a deep copy to avoid modifying the original until all succeed
    const updatedDNA = JSON.parse(JSON.stringify(dna));

    // Apply each mutation
    for (const mutation of mutations) {
      if (!this.applyMutation(updatedDNA, mutation)) {
        console.warn(
          `[EvolutionEngine] Failed to apply mutation:`,
          mutation.type
        );
        return null; // Rollback by returning null
      }

      this.mutationExecutionCount++;
    }

    // Save updated DNA to file
    const filePath = getDNAPath(projectRoot);

    try {
      const fs = await import("node:fs");
      
      fs.writeFileSync(filePath, JSON.stringify(updatedDNA, null, 2), "utf-8");

      return updatedDNA;
    } catch (error) {
      console.error(`[EvolutionEngine] Failed to save DNA:`, error.message);
      return null;
    }
  }

  /**
   * Record an evolution event in the history
   * @param {Object} mutation - Mutation that was applied
   * @param {Object} result - Result of the evolution operation
   */
  recordEvolution(mutation, result) {
    // Use JSON parse/stringify for deep copy to handle nested objects correctly
    const entry = {
      mutation: JSON.parse(JSON.stringify(mutation)),
      result: JSON.parse(JSON.stringify(result)),
      timestamp: new Date().toISOString(),
    };

    this.evolutionHistory.push(entry);

    // Keep only last maxHistoryItems entries (sliding window)
    if (this.evolutionHistory.length > this.maxHistoryItems) {
      this.evolutionHistory = this.evolutionHistory.slice(-this.maxHistoryItems);
    }
  }

  /**
   * Get the evolution history
   * @returns {Array} Array of evolution events (most recent first)
   */
  getEvolutionHistory() {
    // Return most recent first
    return [...this.evolutionHistory].reverse();
  }

  /**
   * Sort suggestions by priority score
   * @param {Array} suggestions - Array of suggestion objects
   * @returns {Array} Sorted array (highest priority first)
   */
  sortByPriority(suggestions) {
    return [...suggestions].sort(
      (a, b) => this.getSuggestionPriority(b) - this.getSuggestionPriority(a)
    );
  }

  /**
   * Calculate a priority score for a suggestion
   * Higher scores indicate more urgent action needed
   * @param {Object} suggestion - Suggestion object
   * @returns {number} Priority score (higher = more urgent)
   */
  getSuggestionPriority(suggestion) {
    let score = 0;

    switch (suggestion.type) {
      case "low-rating":
        // More severe for lower ratings and more data points
        // Rating severity is positive when below threshold, negative when above
        const ratingSeverity = this.evolutionThresholds.lowRatingThreshold - suggestion.averageRating;
        score += ratingSeverity * 10; // Lower rating = higher priority (more urgent)
        score += suggestion.ratingCount * 2; // Weight by number of ratings (more data = more reliable)
        break;

      case "high-variance":
        // Higher variance = higher priority
        score += Math.abs(suggestion.variance || 0) * 5;
        break;

      case "underused":
        // Underused is informational, low priority (lower count = lower urgency since more usage needed)
        score -= suggestion.ratingCount || 0;
        break;

      default:
        score = 0;
    }

    return score; // Allow negative scores for underused suggestions
  }

  /**
   * Clear evolution history (useful for testing)
   */
  clearHistory() {
    this.evolutionHistory = [];
  }

  /**
   * Get statistics about past evolutions
   * @returns {Object} Evolution statistics
   */
  getEvolutionStats() {
    return {
      totalEvolutions: this.evolutionHistory.length,
      mutationExecutionCount: this.mutationExecutionCount,
      avgMutationsPerEvolution:
        this.evolutionHistory.length > 0
          ? this.mutationExecutionCount / this.evolutionHistory.length
          : 0,
    };
  }
}

// Export singleton instance for easy import
export const evolutionEngine = new EvolutionEngine();