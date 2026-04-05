/**
 * Rating Analyzer - Phase 5 Evolution & Auto-Optimization
 * Analyzes model ratings and generates improvement suggestions
 */

import { loadModelDNA } from "../utils/model-dna-manager.js";

/**
 * RatingAnalyzer class for analyzing model effectiveness ratings
 */
export class RatingAnalyzer {
  /**
   * Create a new RatingAnalyzer instance
   * @param {Object} options - Configuration options
   * @param {number} [options.lowRating=3.0] - Rating below which suggestions are generated
   * @param {number} [options.excellentRating=4.5] - Rating above which model is considered excellent
   * @param {number} [options.minRatingsForAnalysis=5] - Minimum ratings required before generating suggestions
   */
  constructor(options = {}) {
    const dna = loadModelDNA();
    const evoThresholds = dna?.evolutionThresholds || {};

    // Load thresholds from DNA, environment, or provided options/defaults
    this.thresholds = {
      lowRating: parseFloat(
        evoThresholds.lowRatingThreshold ||
        process.env.EVOLUTION_LOW_RATING_THRESHOLD ||
        options.lowRating ||
        "3.0"
      ),
      excellentRating: parseFloat(
        evoThresholds.excellentRatingThreshold ||
        process.env.EVOLUTION_EXCELLENT_RATING ||
        options.excellentRating ||
        "4.5"
      ),
      minRatingsForAnalysis: parseInt(
        evoThresholds.minRatingsForAnalysis ||
        process.env.EVOLUTION_MIN_RATINGS ||
        options.minRatingsForAnalysis ||
        "5",
        10
      ),
    };

    // High variance threshold (standard deviation)
    this.highVarianceThreshold = parseFloat(
      evoThresholds.highVarianceThreshold || "1.0"
    );
  }

  /**
   * Analyze ratings for all models in the DNA configuration
   * @param {Object} dna - DNA configuration object (or projectRoot string to load from file)
   * @param {string} [projectRoot] - Project root directory (optional, used if first param is a string)
   * @returns {Object|null} Analysis result or null on failure
   */
  analyzeModelRatings(dnaOrPath, projectRoot = process.cwd()) {
    // Handle both cases: passing DNA object directly or path string
    let dna;
    
    if (typeof dnaOrPath === "string") {
      dna = loadModelDNA(dnaOrPath);
      projectRoot = dnaOrPath;
    } else {
      dna = dnaOrPath;
    }

    if (!dna?.usageStats?.modelEffectiveness) {
      return null;
    }

    const analysis = {
      totalModels: 0,
      modelsWithRatings: 0,
      modelAnalysis: {},
      overallAverageRating: null,
      totalRatings: 0,
    };

    let allRatingsSum = 0;
    let allRatingsCount = 0;

    // Analyze each model's ratings
    for (const [modelRole, tasks] of Object.entries(dna.usageStats.modelEffectiveness)) {
      analysis.totalModels++;

      const modelRatings = [];
      const taskAnalysis = {};

      for (const [taskType, ratings] of Object.entries(tasks)) {
        if (ratings.length === 0) continue;

        // Calculate statistics for this task type
        const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
        const average = sum / ratings.length;

        // Calculate variance/standard deviation
        const squaredDiffs = ratings.map((r) => Math.pow(r.rating - average, 2));
        const variance = squaredDiffs.reduce((a, b) => a + b, 0) / ratings.length;
        const stdDev = Math.sqrt(variance);

        modelRatings.push(...ratings);
        allRatingsSum += sum;
        allRatingsCount += ratings.length;

        taskAnalysis[taskType] = {
          averageRating: average.toFixed(2),
          ratingCount: ratings.length,
          variance: stdDev.toFixed(3),
          minRating: Math.min(...ratings.map((r) => r.rating)),
          maxRating: Math.max(...ratings.map((r) => r.rating)),
        };

        analysis.modelsWithRatings++;
      }

      // Calculate overall model statistics
      if (modelRatings.length > 0) {
        const modelSum = modelRatings.reduce((acc, r) => acc + r.rating, 0);
        const modelAverage = modelSum / modelRatings.length;

        analysis.modelAnalysis[modelRole] = {
          averageRating: modelAverage.toFixed(2),
          ratingCount: modelRatings.length,
          taskBreakdown: taskAnalysis,
        };
      }
    }

    // Calculate overall average rating across all models
    if (allRatingsCount > 0) {
      analysis.overallAverageRating = (allRatingsSum / allRatingsCount).toFixed(2);
    }

    analysis.totalRatings = allRatingsCount;

    return analysis;
  }

  /**
   * Generate suggestions based on rating analysis
   * @param {Object} analysis - Analysis result from analyzeModelRatings()
   * @returns {Array} Array of suggestion objects
   */
  generateSuggestions(analysis) {
    if (!analysis || !analysis.modelAnalysis) {
      return [];
    }

    const suggestions = [];

    for (const [modelRole, modelData] of Object.entries(analysis.modelAnalysis)) {
      // Check for low rating suggestion
      const avgRating = parseFloat(modelData.averageRating);
      
      if (
        modelData.ratingCount >= this.thresholds.minRatingsForAnalysis &&
        avgRating < this.thresholds.lowRating
      ) {
        suggestions.push(
          this.createLowRatingSuggestion(
            modelRole,
            avgRating,
            modelData.ratingCount
          )
        );
      }

      // Check for high variance suggestion (across all tasks)
      if (modelData.taskBreakdown && Object.keys(modelData.taskBreakdown).length > 1) {
        const variances = Object.values(modelData.taskBreakdown).map(
          (t) => parseFloat(t.variance) || 0
        );
        
        // Check if any task has high variance OR if there's significant variation between tasks
        const maxVariance = Math.max(...variances);
        const avgRatingAcrossTasks = modelData.taskBreakdown;
        
        // High variance: any single task with stdDev > threshold
        for (const [taskType, stats] of Object.entries(avgRatingAcrossTasks)) {
          if (parseFloat(stats.variance) > this.highVarianceThreshold) {
            suggestions.push(
              this.createHighVarianceSuggestion(modelRole, parseFloat(stats.variance))
            );
            break; // Only add one high variance suggestion per model
          }
        }
      }

      // Check for underused suggestion
      if (modelData.ratingCount < this.thresholds.minRatingsForAnalysis) {
        suggestions.push(
          this.createUnderusedSuggestion(modelRole, modelData.ratingCount)
        );
      }
    }

    return suggestions;
  }

  /**
   * Create a suggestion for low-rated models
   * @param {string} modelRole - Model role with low ratings
   * @param {number} averageRating - Average rating (below threshold)
   * @param {number} ratingCount - Number of ratings received
   * @returns {Object} Suggestion object
   */
  createLowRatingSuggestion(modelRole, averageRating, ratingCount) {
    return {
      type: "low-rating",
      modelRole,
      averageRating: parseFloat(averageRating.toFixed(2)),
      ratingCount,
      recommendation: `Model ${modelRole} has a low average rating of ${averageRating.toFixed(2)} (${ratingCount} ratings). Consider reassigning tasks to a different model or improving the current configuration.`,
    };
  }

  /**
   * Create a suggestion for models with high variance in ratings
   * @param {string} modelRole - Model role with inconsistent performance
   * @param {number} variance - Standard deviation of ratings (>1.0)
   * @returns {Object} Suggestion object
   */
  createHighVarianceSuggestion(modelRole, variance) {
    return {
      type: "high-variance",
      modelRole,
      variance: parseFloat(variance.toFixed(3)),
      recommendation: `Model ${modelRole} shows inconsistent performance with rating variance of ${variance.toFixed(3)}. Consider using this model only for specific task types where it performs reliably.`,
    };
  }

  /**
   * Create a suggestion for underused models
   * @param {string} modelRole - Model role with few ratings
   * @param {number} ratingCount - Number of ratings (below minimum threshold)
   * @returns {Object} Suggestion object
   */
  createUnderusedSuggestion(modelRole, ratingCount) {
    return {
      type: "underused",
      modelRole,
      ratingCount,
      recommendation: `Model ${modelRole} has only ${ratingCount} ratings (${this.thresholds.minRatingsForAnalysis} minimum for reliable analysis). Increase usage to gather more performance data.`,
    };
  }

  /**
   * Get suggestions filtered by type
   * @param {Array} suggestions - Array of suggestion objects
   * @param {string} type - Suggestion type to filter by ("low-rating", "high-variance", "underused")
   * @returns {Array} Filtered suggestions
   */
  filterByType(suggestions, type) {
    return suggestions.filter((s) => s.type === type);
  }

  /**
   * Get only recommendations that should trigger action (not underused warnings)
   * @param {Array} suggestions - Array of suggestion objects
   * @returns {Array} Actionable suggestions
   */
  getActionableSuggestions(suggestions) {
    return suggestions.filter((s) => s.type !== "underused");
  }

  /**
   * Format suggestions for display output
   * @param {Array} suggestions - Array of suggestion objects
   * @returns {string} Formatted string for display
   */
  formatSuggestions(suggestions) {
    if (!suggestions || suggestions.length === 0) {
      return "No improvement suggestions at this time.";
    }

    let output = "\n=== Model Improvement Suggestions ===\n\n";

    for (const [index, suggestion] of suggestions.entries()) {
      output += `${index + 1}. [${suggestion.type.toUpperCase()}] ${suggestion.modelRole}\n`;
      output += `   ${suggestion.recommendation}\n\n`;
    }

    return output;
  }
}

// Export singleton instance for easy import
export const ratingAnalyzer = new RatingAnalyzer();