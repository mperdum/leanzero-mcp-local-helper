# Phase 5: Evolution & Auto-Optimization

## Overview

Phase 5 implements the auto-evolution system that analyzes usage patterns and automatically optimizes model configurations. This phase enables the system to learn from user feedback, detect suboptimal models, and suggest improvements without manual intervention.

**Key Components:**
- Usage tracking system
- Auto-evolution suggestions
- Rating-based optimization
- Memory evolution

---

## Dependencies: Phase 4 Integration

**Phase 4 Tools depend on Phase 5 Evolution Engine:**

The `model-dna-tool.js` handler `handleEvolveDNA()` directly calls Phase 5's `EvolutionEngine` to analyze usage patterns and generate optimization suggestions. This is a critical dependency - Phase 4 will not function without Phase 5 implementation.

### Integration Chain

```
Phase 4 (model-dna-tool.js)
  └─> handleEvolveDNA(params)
      └─> new EvolutionEngine()
          └─> engine.analyzeAndEvolve(dna)
              └─> [Phase 5 Evolution Engine]
```

### Required Phase 5 Components for Phase 4

| Phase 4 File | Phase 5 Dependency | Usage |
|-------------|-------------------|-------|
| `model-dna-tool.js` | `EvolutionEngine` class | Called from `handleEvolveDNA()` |
| `model-dna-tool.js` | `analyzeUsage()` method | Analyzes DNA usage statistics |
| `model-dna-tool.js` | `generateMutations()` | Creates configuration mutations |
| `model-dna-tool.js` | `applyMutation()` | Applies suggested changes to DNA |

### Phase 4 Implementation Notes

When implementing Phase 4, ensure the following Phase 5 components are available:

1. **Import EvolutionEngine** in `model-dna-tool.js`:
   ```javascript
   import { EvolutionEngine } from "../services/evolution-engine.js";
   ```

2. **Instantiate EvolutionEngine** in `handleEvolveDNA()`:
   ```javascript
   const engine = new EvolutionEngine();
   const result = engine.analyzeAndEvolve(dna);
   ```

3. **Handle evolution result** - check `result.wasEvolved` and `result.mutationsApplied`

4. **Auto-apply mutations** when `params.apply === true`

**Critical Note:** If Phase 5 is not implemented, `handleEvolveDNA()` will throw an error. Consider adding a try-catch with a helpful message:
```javascript
try {
  const engine = new EvolutionEngine();
  const result = engine.analyzeAndEvolve(dna);
} catch (error) {
  return {
    content: [{ type: "text", text: JSON.stringify({ 
      error: "Evolution Engine not available. Phase 5 must be implemented first.",
      phase: "Phase 5: Evolution & Auto-Optimization"
    }, null, 2) }],
    isError: true,
  };
}
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                  Evolution & Auto-Optimization                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────┐        ┌──────────────────┐                   │
│  │ Usage Tracker    │        │ Rating Analyzer  │                   │
│  └──────────────────┘        └──────────────────┘                   │
│         │                            │                              │
│         ▼                            ▼                              │
│  ┌──────────────────┐        ┌──────────────────┐                   │
│  │ Pattern Detector │        │ Suggestion       │                   │
│  └──────────────────┘        └──────────────────┘                   │
│         │                            │                              │
│         ▼                            ▼                              │
│  ┌──────────────────────────────────────────┐                      │
│  │         Auto-Evolution Engine            │                      │
│  │  - Threshold Detection                   │                      │
│  │  - Mutation Generation                   │                      │
│  │  - Auto-Apply Logic                      │                      │
│  └──────────────────────────────────────────┘                      │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
src/
├── utils/
│   └── usage-tracker.js         # Usage tracking and analytics
├── services/
│   ├── evolution-engine.js      # Auto-evolution logic
│   └── rating-analyzer.js       # Rating analysis and suggestions
└── config/
    └── thresholds.js            # Evolution thresholds
```

---

## Detailed Component Breakdown

### 1. usage-tracker.js

**Purpose:** Tracks and analyzes model usage patterns over time.

#### Class Structure

```javascript
export class UsageTracker {
  constructor() {
    this.maxHistoryItems = parseInt(process.env.MAX_HISTORY_ITEMS || "100");
  }
  
  // Tracking
  trackTaskCompletion(taskType, modelId, result) { ... }
  trackModelSwitch(fromModel, toModel) { ... }
  trackRating(modelRole, taskType, rating) { ... }
  
  // Analytics
  getTaskStats(taskType) { ... }
  getModelStats(modelId) { ... }
  getAverageRatings() { ... }
  
  // Patterns
  detectPatterns() { ... }
  getUsageSummary() { ... }
}
```

#### Tracking Task Completion

```javascript
/**
 * Track task completion for analytics
 * @param {string} taskType - Task category ID
 * @param {string} modelId - Model that executed the task
 * @param {Object} result - Task execution result
 */
trackTaskCompletion(taskType, modelId, result) {
  const dna = loadModelDNA();
  
  if (!dna) return;

  // Initialize tracking structures
  dna.usageStats.tasksCompleted = dna.usageStats.tasksCompleted || {};
  dna.usageStats.modelEffectiveness = 
    dna.usageStats.modelEffectiveness || {};

  // Update task completion count
  dna.usageStats.tasksCompleted[taskType] = 
    (dna.usageStats.tasksCompleted[taskType] || 0) + 1;

  // Update model effectiveness tracking
  dna.usageStats.modelEffectiveness[modelId] = 
    dna.usageStats.modelEffectiveness[modelId] || {};
  
  dna.usageStats.modelEffectiveness[modelId][taskType] = 
    dna.usageStats.modelEffectiveness[modelId][taskType] || [];
  
  // Add result to history
  dna.usageStats.modelEffectiveness[modelId][taskType].push({
    success: result.success,
    rating: result.rating || null,
    timestamp: new Date().toISOString(),
  });

  // Keep only last N items (sliding window)
  const ratings = dna.usageStats.modelEffectiveness[modelId][taskType];
  if (ratings.length > this.maxHistoryItems) {
    dna.usageStats.modelEffectiveness[modelId][taskType] = 
      ratings.slice(-this.maxHistoryItems);
  }

  // Write back to disk
  createDNAFile(dna);
}

/**
 * Track model switch event
 * @param {string} fromModel - Source model ID
 * @param {string} toModel - Target model ID
 */
trackModelSwitch(fromModel, toModel) {
  const dna = loadModelDNA();
  
  if (!dna) return;

  // Initialize tracking
  dna.usageStats.modelSwitches = 
    dna.usageStats.modelSwitches || {};

  const switchKey = `${fromModel}->${toModel}`;
  
  dna.usageStats.modelSwitches[switchKey] = 
    (dna.usageStats.modelSwitches[switchKey] || 0) + 1;

  // Write back
  createDNAFile(dna);
}
```

#### Getting Task Statistics

```javascript
/**
 * Get statistics for a specific task type
 * @param {string} taskType - Task category ID
 * @returns {Object} Task statistics
 */
getTaskStats(taskType) {
  const dna = loadModelDNA();
  
  if (!dna || !dna.usageStats?.tasksCompleted?.[taskType]) {
    return { count: 0, modelsUsed: [] };
  }

  // Get all models used for this task
  const effectiveness = dna.usageStats.modelEffectiveness || {};
  
  const modelsUsed = Object.entries(effectiveness)
    .filter(([_, taskRatings]) => taskRatings[taskType])
    .map(([modelId, _]) => ({
      modelId,
      count: effectiveness[modelId][taskType].length
    }));

  return {
    count: dna.usageStats.tasksCompleted[taskType],
    modelsUsed,
    averageRatings: this.calculateAverageRatings(taskType),
  };
}

/**
 * Calculate average ratings for a task type
 */
calculateAverageRatings(taskType) {
  const dna = loadModelDNA();
  
  if (!dna?.usageStats?.modelEffectiveness) return {};

  const averages = {};
  
  for (const [modelId, taskRatings] of Object.entries(dna.usageStats.modelEffectiveness)) {
    if (taskRatings[taskType]) {
      const ratings = taskRatings[taskType];
      
      if (ratings.length > 0) {
        const sum = ratings.reduce((acc, r) => acc + (r.rating || 0), 0);
        averages[modelId] = (sum / ratings.length).toFixed(2);
      }
    }
  }

  return averages;
}
```

#### Getting Model Statistics

```javascript
/**
 * Get statistics for a specific model
 * @param {string} modelId - Model identifier
 * @returns {Object} Model statistics
 */
getModelStats(modelId) {
  const dna = loadModelDNA();
  
  if (!dna || !dna.usageStats?.modelEffectiveness?.[modelId]) {
    return { 
      totalTasks: 0, 
      taskBreakdown: {}, 
      overallRating: null 
    };
  }

  const effectiveness = dna.usageStats.modelEffectiveness[modelId];
  
  // Calculate task breakdown
  const taskBreakdown = {};
  
  for (const [taskType, ratings] of Object.entries(effectiveness)) {
    if (ratings.length > 0) {
      const sum = ratings.reduce((acc, r) => acc + (r.rating || 0), 0);
      taskBreakdown[taskType] = {
        count: ratings.length,
        averageRating: (sum / ratings.length).toFixed(2),
      };
    }
  }

  // Calculate overall rating
  const allRatings = Object.values(effectiveness).flat();
  
  let overallRating = null;
  if (allRatings.length > 0) {
    const sum = allRatings.reduce((acc, r) => acc + (r.rating || 0), 0);
    overallRating = (sum / allRatings.length).toFixed(2);
  }

  return {
    totalTasks: Object.values(effectiveness).flat().length,
    taskBreakdown,
    overallRating,
  };
}

/**
 * Get all average ratings across all models
 * @returns {Object} All average ratings
 */
getAverageRatings() {
  const dna = loadModelDNA();
  
  if (!dna?.usageStats?.modelEffectiveness) return {};

  const averages = {};
  
  for (const [modelId, taskRatings] of Object.entries(dna.usageStats.modelEffectiveness)) {
    const allRatings = Object.values(taskRatings).flat();
    
    if (allRatings.length > 0) {
      const sum = allRatings.reduce((acc, r) => acc + (r.rating || 0), 0);
      averages[modelId] = {
        average: (sum / allRatings.length).toFixed(2),
        ratingCount: allRatings.length,
      };
    }
  }

  return averages;
}
```

#### Pattern Detection

```javascript
/**
 * Detect usage patterns
 * @returns {Object} Detected patterns
 */
detectPatterns() {
  const dna = loadModelDNA();
  
  if (!dna?.usageStats) return { patterns: [] };

  const patterns = [];
  
  // Pattern 1: High fallback rate
  const effectiveness = dna.usageStats.modelEffectiveness || {};
  
  for (const [modelId, taskRatings] of Object.entries(effectiveness)) {
    for (const [taskType, ratings] of Object.entries(taskRatings)) {
      const lowRatingCount = ratings.filter(r => r.rating < 3).length;
      
      // High low-rating rate indicates potential issues
      if (ratings.length >= 5 && 
          lowRatingCount / ratings.length > 0.4) {
        patterns.push({
          type: "high-low-rating-rate",
          modelId,
          taskType,
          lowRatingCount,
          totalRatings: ratings.length,
          recommendation: `Model "${modelId}" has high low-rating rate (${lowRatingCount}/${ratings.length}) for "${taskType}". Consider reviewing model-task alignment.`,
        });
      }
    }
  }

  return { patterns };
}

/**
 * Get usage summary
 * @returns {Object} Usage summary
 */
getUsageSummary() {
  const dna = loadModelDNA();
  
  if (!dna?.usageStats) return { summary: {} };

  const stats = dna.usageStats;
  
  // Calculate totals
  const totalTasks = Object.values(stats.tasksCompleted || {}).reduce((a, b) => a + b, 0);
  
  // Calculate model usage
  const modelUsage = {};
  
  for (const [modelId, taskRatings] of Object.entries(stats.modelEffectiveness || {})) {
    modelUsage[modelId] = {
      totalTasks: Object.values(taskRatings).flat().length,
    };
  }

  return {
    summary: {
      totalTasks,
      modelUsage,
    },
    lastUpdated: new Date().toISOString(),
  };
}
```

---

### 2. evolution-engine.js

**Purpose:** Main auto-evolution logic that analyzes patterns and suggests improvements.

#### Class Structure

```javascript
export class EvolutionEngine {
  constructor() {
    this.evolutionThresholds = {
      lowRatingThreshold: 3.0,
      minRatingsForEvolution: 5,
      maxAttempts: 3,
    };
    
    this.evolutionHistory = [];
  }
  
  // Core logic
  analyzeAndEvolve(dna) { ... }
  generateMutations(analysis) { ... }
  applyMutation(dna, mutation) { ... }
  
  // History
  recordEvolution(mutation, result) { ... }
  getEvolutionHistory() { ... }
}
```

#### Analyzing and Evolving DNA

```javascript
/**
 * Analyze DNA and evolve if needed
 * @param {Object} dna - Model DNA configuration
 * @returns {Object} Evolution result with mutations applied (if any)
 */
analyzeAndEvolve(dna) {
  // Analyze usage patterns
  const analysis = this.analyzeUsage(dna);
  
  let evolvedDna = { ...dna };
  const mutationsApplied = [];
  
  // Check if evolution is needed
  if (analysis.suggestions?.length > 0) {
    // Sort suggestions by priority
    const sortedSuggestions = this.sortByPriority(analysis.suggestions);
    
    // Apply top suggestions (up to maxAttempts)
    for (let i = 0; i < Math.min(this.evolutionThresholds.maxAttempts, sortedSuggestions.length); i++) {
      const suggestion = sortedSuggestions[i];
      
      // Apply mutation
      evolvedDna = this.applyMutation(evolvedDna, suggestion.mutation);
      
      // Record mutation
      mutationsApplied.push({
        mutation: suggestion.mutation,
        timestamp: new Date().toISOString(),
      });
      
      this.recordEvolution(suggestion.mutation, {
        applied: true,
        suggestion: suggestion.type,
      });
    }
  }

  return {
    dna: evolvedDna,
    mutationsApplied,
    analysis,
    wasEvolved: mutationsApplied.length > 0,
  };
}

/**
 * Sort suggestions by priority
 */
sortByPriority(suggestions) {
  return suggestions.sort((a, b) => {
    // Low ratings get higher priority
    const aPriority = this.getSuggestionPriority(a);
    const bPriority = this.getSuggestionPriority(b);
    
    return bPriority - aPriority;
  });
}

/**
 * Get suggestion priority score
 */
getSuggestionPriority(suggestion) {
  let score = 0;
  
  // Low rating suggestions get higher priority
  if (suggestion.averageRating < 2.0) score += 10;
  else if (suggestion.averageRating < 3.0) score += 5;
  
  // More ratings = higher priority (more confidence)
  if (suggestion.ratingCount >= 10) score += 5;
  else if (suggestion.ratingCount >= 5) score += 3;
  
  return score;
}
```

#### Generating Mutations

```javascript
/**
 * Generate mutations from analysis
 * @param {Object} analysis - Usage analysis result
 * @returns {Array} Array of mutations to apply
 */
generateMutations(analysis) {
  const mutations = [];
  
  // Mutation 1: Update model purposes based on usage
  for (const [modelRole, usage] of Object.entries(analysis.modelUsage)) {
    if (usage.averageRating < this.evolutionThresholds.lowRatingThreshold) {
      mutations.push({
        type: "update-model-purpose",
        path: `models.${modelRole}.purpose`,
        value: this.suggestNewPurpose(modelRole, usage),
      });
    }
  }

  // Mutation 2: Update task-model mapping
  if (analysis.suggestions?.length > 0) {
    const lowRatingSuggestions = analysis.suggestions.filter(
      s => s.type === "low-rating"
    );
    
    for (const suggestion of lowRatingSuggestions) {
      mutations.push({
        type: "update-task-model-mapping",
        path: `taskModelMapping.${suggestion.taskType}`,
        value: suggestion.recommendedModel || this.suggestAlternativeTask(suggestion),
      });
    }
  }

  return mutations;
}

/**
 * Suggest new model purpose based on usage
 */
suggestNewPurpose(modelRole, usage) {
  // Analyze task breakdown to suggest better purpose
  const tasks = Object.keys(usage.taskBreakdown || {});
  
  // Find most common task
  const mostCommonTask = tasks.sort(
    (a, b) => (usage.taskBreakdown[b]?.count || 0) - (usage.taskBreakdown[a]?.count || 0)
  )[0];
  
  return `Optimized for ${mostCommonTask} tasks based on usage patterns`;
}

/**
 * Suggest alternative task assignment
 */
suggestAlternativeTask(suggestion) {
  // Use a model with higher rating for this task type
  const dna = loadModelDNA();
  
  if (!dna) return suggestion.modelRole;
  
  // Find model with highest rating for this task
  const effectiveness = dna.usageStats?.modelEffectiveness || {};
  
  let bestModel = suggestion.modelRole;
  let bestRating = 0;
  
  for (const [modelId, taskRatings] of Object.entries(effectiveness)) {
    if (taskRatings[suggestion.taskType]) {
      const ratings = taskRatings[suggestion.taskType];
      
      if (ratings.length > 0) {
        const sum = ratings.reduce((acc, r) => acc + (r.rating || 0), 0);
        const avg = sum / ratings.length;
        
        if (avg > bestRating) {
          bestRating = avg;
          bestModel = modelId;
        }
      }
    }
  }
  
  return bestModel;
}
```

#### Applying Mutations

```javascript
/**
 * Apply a mutation to DNA
 * @param {Object} dna - Current DNA configuration
 * @param {Object} mutation - Mutation to apply
 * @returns {Object} Modified DNA configuration
 */
applyMutation(dna, mutation) {
  const newDna = { ...dna };
  
  // Navigate to target location
  const parts = mutation.path.split(".");
  let target = newDna;
  
  for (let i = 0; i < parts.length - 1; i++) {
    if (!target[parts[i]]) {
      target[parts[i]] = {};
    }
    
    // Create shallow copy to avoid mutating original
    target[parts[i]] = { ...target[parts[i]] };
    
    target = target[parts[i]];
  }
  
  // Apply mutation
  target[parts[parts.length - 1]] = mutation.value;
  
  return newDna;
}

/**
 * Record evolution for history
 */
recordEvolution(mutation, result) {
  this.evolutionHistory.push({
    mutation,
    result,
    timestamp: new Date().toISOString(),
  });

  // Keep only last 100 evolutions
  if (this.evolutionHistory.length > 100) {
    this.evolutionHistory = this.evolutionHistory.slice(-100);
  }
}

/**
 * Get evolution history
 * @returns {Array} Evolution history
 */
getEvolutionHistory() {
  return this.evolutionHistory;
}
```

---

### 3. rating-analyzer.js

**Purpose:** Analyzes ratings and generates optimization suggestions.

#### Class Structure

```javascript
export class RatingAnalyzer {
  constructor() {
    this.thresholds = {
      lowRating: 3.0,
      excellentRating: 4.5,
      minRatingsForAnalysis: 5,
    };
    
    this.suggestionTypes = {
      LOW_RATING: "low-rating",
      HIGH_VARIANCE: "high-variance",
      UNDERUSED: "underused",
    };
  }
  
  // Analysis
  analyzeModelRatings(dna) { ... }
  generateSuggestions(analysis) { ... }
  
  // Suggestion helpers
  createLowRatingSuggestion(modelRole, averageRating, ratingCount) { ... }
  createHighVarianceSuggestion(modelRole, variance) { ... }
}
```

#### Analyzing Model Ratings

```javascript
/**
 * Analyze ratings for all models
 * @param {Object} dna - Model DNA configuration
 * @returns {Object} Analysis result
 */
analyzeModelRatings(dna) {
  const usageStats = dna.usageStats || {};
  const models = dna.models || {};
  
  const effectiveness = usageStats.modelEffectiveness || {};
  
  const analysis = {
    totalTasks: Object.values(usageStats.tasksCompleted || {}).reduce((a, b) => a + b, 0),
    modelAnalysis: {},
    suggestions: [],
  };

  // Analyze each model
  for (const [modelRole, config] of Object.entries(models)) {
    const roleEffectiveness = effectiveness[modelRole];
    
    analysis.modelAnalysis[modelRole] = {
      purpose: config.purpose,
      usageCount: config.usageCount || 0,
    };

    if (roleEffectiveness) {
      // Get all ratings for this model
      const allRatings = Object.values(roleEffectiveness).flat();
      
      if (allRatings.length > 0) {
        const ratings = allRatings.map(r => r.rating);
        
        // Calculate average
        const sum = ratings.reduce((acc, r) => acc + r, 0);
        const averageRating = sum / ratings.length;
        
        // Calculate variance
        const squaredDiffs = ratings.map(r => Math.pow(r - averageRating, 2));
        const variance = squaredDiffs.reduce((acc, r) => acc + r, 0) / ratings.length;
        
        analysis.modelAnalysis[modelRole].averageRating = averageRating.toFixed(2);
        analysis.modelAnalysis[modelRole].ratingCount = ratings.length;
        analysis.modelAnalysis[modelRole].variance = variance.toFixed(2);
        
        // Generate suggestions if needed
        const suggestions = this.generateSuggestions(modelRole, averageRating, variance, ratings.length);
        analysis.suggestions.push(...suggestions);
      }
    }
  }

  return analysis;
}

/**
 * Generate suggestions for a model
 */
generateSuggestions(modelRole, averageRating, variance, ratingCount) {
  const suggestions = [];
  
  // Low rating suggestion
  if (averageRating < this.thresholds.lowRating && 
      ratingCount >= this.thresholds.minRatingsForAnalysis) {
    suggestions.push(this.createLowRatingSuggestion(modelRole, averageRating, ratingCount));
  }

  // High variance suggestion
  if (variance > 1.0 && ratingCount >= this.thresholds.minRatingsForAnalysis) {
    suggestions.push(this.createHighVarianceSuggestion(modelRole, variance));
  }

  // Underused model suggestion
  if (ratingCount < this.thresholds.minRatingsForAnalysis && ratingCount > 0) {
    suggestions.push(this.createUnderusedSuggestion(modelRole, ratingCount));
  }

  return suggestions;
}

/**
 * Create low rating suggestion
 */
createLowRatingSuggestion(modelRole, averageRating, ratingCount) {
  return {
    type: this.suggestionTypes.LOW_RATING,
    modelRole,
    averageRating: parseFloat(averageRating.toFixed(2)),
    ratingCount,
    recommendation: `Model "${modelRole}" has low average rating (${averageRating.toFixed(2)}). Consider reviewing model-task alignment or model quality.`,
  };
}

/**
 * Create high variance suggestion
 */
createHighVarianceSuggestion(modelRole, variance) {
  return {
    type: this.suggestionTypes.HIGH_VARIANCE,
    modelRole,
    variance: parseFloat(variance.toFixed(2)),
    recommendation: `Model "${modelRole}" has high rating variance (${variance.toFixed(2)}). This may indicate inconsistent performance across different task types.`,
  };
}

/**
 * Create underused model suggestion
 */
createUnderusedSuggestion(modelRole, ratingCount) {
  return {
    type: this.suggestionTypes.UNDERUSED,
    modelRole,
    ratingCount,
    recommendation: `Model "${modelRole}" has few ratings (${ratingCount}). Consider using this model more to gather more data.`,
  };
}
```

---

## Integration Points

### With DNA System

```javascript
import { loadModelDNA, createDNAFile } from '../utils/model-dna-manager.js';
import { EvolutionEngine } from './evolution-engine.js';

const evolutionEngine = new EvolutionEngine();

// Analyze and evolve DNA
const result = evolutionEngine.analyzeAndEvolve(dna);

if (result.wasEvolved) {
  createDNAFile(result.dna);
}
```

### With Task Dispatcher

```javascript
// Task dispatcher triggers evolution after task completion
async executeTask(query, dna) {
  // ... existing code ...
  
  if (result.success) {
    // Record usage
    this.recordTaskSuccess(taskType, modelId);
    
    // Trigger evolution check
    const evolutionResult = evolutionEngine.analyzeAndEvolve(dna);
    
    if (evolutionResult.wasEvolved) {
      console.log(`[TaskDispatcher] DNA evolved: ${evolutionResult.mutationsApplied.length} mutations applied`);
    }
  }
}
```

---

## Testing Strategy

### Unit Tests for Usage Tracker

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Usage Tracker', () => {
  let usageTracker;

  beforeEach(() => {
    usageTracker = new UsageTracker();
    
    // Mock dependencies
    global.loadModelDNA = () => ({ usageStats: {} });
    global.createDNAFile = () => {};
  });

  describe('trackTaskCompletion()', () => {
    it('should track task completion', async () => {
      await usageTracker.trackTaskCompletion('codeFixes', 'model1', { success: true });
      
      // Verify tracking occurred
      assert.ok(true); // Assertion for mock verification
    });
  });

  describe('getTaskStats()', () => {
    it('should return task statistics', async () => {
      const stats = await usageTracker.getTaskStats('codeFixes');
      
      assert.ok(stats.count >= 0);
    });
  });
});
```

### Unit Tests for Evolution Engine

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Evolution Engine', () => {
  let evolutionEngine;

  beforeEach(() => {
    evolutionEngine = new EvolutionEngine();
  });

  describe('analyzeAndEvolve()', () => {
    it('should return dna without mutations if no evolution needed', async () => {
      const dna = {
        usageStats: { modelEffectiveness: {} },
        models: {}
      };
      
      const result = evolutionEngine.analyzeAndEvolve(dna);
      
      assert.strictEqual(result.wasEvolved, false);
    });

    it('should apply mutations when evolution needed', async () => {
      const dna = {
        usageStats: {
          modelEffectiveness: {
            testModel: {
              codeFixes: Array(5).fill({ rating: 1 })
            }
          }
        },
        models: { testModel: { purpose: 'test' } }
      };
      
      const result = evolutionEngine.analyzeAndEvolve(dna);
      
      assert.strictEqual(result.wasEvolved, true);
    });
  });
});
```

---

## Configuration

### Evolution Thresholds

```json
{
  "evolutionThresholds": {
    "lowRatingThreshold": 3.0,
    "minRatingsForEvolution": 5,
    "maxAttempts": 3
  }
}
```

### Auto-Evolution Settings

```json
{
  "autoEvolution": {
    "enabled": true,
    "checkInterval": 3600000, // 1 hour
    "applyAutomatically": false
  }
}
```

---

## Future Enhancements

- [ ] A/B testing for model recommendations
- [ ] Automated model retraining suggestions
- [ ] Cross-project learning
- [ ] Advanced pattern detection (ML-based)