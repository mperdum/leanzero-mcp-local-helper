# Implementation Plan: Phase 5 - Evolution & Auto-Optimization

## Overview

This document provides a complete implementation plan for Phase 5's auto-evolution system that analyzes usage patterns and automatically optimizes model configurations based on user feedback.

The implementation adds three new service files that integrate with the existing DNA system to track usage, analyze ratings, and suggest configuration improvements without requiring manual intervention.

## Scope

Phase 5 enables the system to:
- Track task completions, model switches, and effectiveness ratings
- Detect patterns in usage data (low ratings, high variance, underused models)
- Generate actionable suggestions for model-task alignment improvements
- Apply mutations automatically when explicitly requested via `model-dna evolve --apply`

The implementation is **non-breaking** - all new components are optional utilities that can be imported and used without modifying existing code paths.

## Type System Changes

### New Data Structures in DNA Schema

The following structures already exist in the DNA schema but will be fully utilized by Phase 5:

```javascript
// Usage statistics structure (already defined in model-dna-schema.js)
usageStats: {
  tasksCompleted: {
    "researchBugFixes": 42,      // Count per task type
    "executeCode": 128,
  },
  modelEffectiveness: {
    "ninja-researcher": {
      "researchBugFixes": [
        { rating: 5, feedback: "Great!", timestamp: "2026-03-14T19:00:00Z" },
        { rating: 4, feedback: "", timestamp: "2026-03-14T18:00:00Z" },
        // ... sliding window of last 10 ratings per model/task combo
      ]
    }
  }
}
```

### New Utility Types (usage-tracker.js)

```javascript
/**
 * UsageTracker class exports:
 * - trackTaskCompletion(taskType, modelId, result)
 * - trackModelSwitch(fromModel, toModel)
 * - trackRating(modelRole, taskType, rating)
 * - getTaskStats(taskType)
 * - getModelStats(modelId)
 * - getAverageRatings()
 * - detectPatterns()
 * - getUsageSummary()
 */

/**
 * Task statistics return type:
 * {
 *   count: number,              // Total completions for task type
 *   modelsUsed: Array<{         // Models used for this task
 *     modelId: string,
 *     count: number
 *   }>,
 *   averageRatings: Object      // { [modelId]: averageRating }
 * }

/**
 * Model statistics return type:
 * {
 *   totalTasks: number,         // Total tasks executed by this model
 *   taskBreakdown: {            // Per-task-type stats
 *     [taskType]: {
 *       count: number,
 *       averageRating: string   // 2 decimal places
 *     }
 *   },
 *   overallRating: string|null  // Overall average rating
 * }

/**
 * Pattern detection return type:
 * {
 *   patterns: Array<{           // Detected issues/patterns
 *     type: string,            // e.g., "high-low-rating-rate"
 *     modelId: string,
 *     taskType: string,
 *     lowRatingCount: number,
 *     totalRatings: number,
 *     recommendation: string   // Human-readable suggestion
 *   }>
 * }
```

### New Service Types (evolution-engine.js)

```javascript
/**
 * EvolutionEngine class exports:
 * - analyzeAndEvolve(dna)
 * - generateMutations(analysis)
 * - applyMutation(dna, mutation)
 * - recordEvolution(mutation, result)
 * - getEvolutionHistory()
 */

/**
 * Evolution analysis return type:
 * {
 *   totalTasks: number,         // Total tracked tasks
 *   modelUsage: {               // Per-model usage stats
 *     [modelRole]: {
 *       purpose: string,
 *       usageCount: number,
 *       averageRating: number|null
 *     }
 *   },
 *   suggestions: Array<{        // Generated suggestions
 *     type: string,            // e.g., "low-rating"
 *     taskType: string,
 *     modelRole: string,
 *     averageRating: number,
 *     ratingCount: number,
 *     recommendation: string,
 *     mutation: {              // Optional mutation to apply
 *       path: string,          // JSON path like "taskModelMapping.researchBugFixes"
 *       value: any             // New value to set
 *     }
 *   }>
 * }

/**
 * Evolution result return type:
 * {
 *   dna: Object,               // Modified DNA configuration
 *   mutationsApplied: Array<{  // List of applied mutations
 *     mutation: Object,
 *     timestamp: string
 *   }>,
 *   analysis: Object,          // Full analysis object
 *   wasEvolved: boolean        // True if any mutations were applied
 * }

/**
 * Mutation type:
 * {
 *   type: string,              // e.g., "update-task-model-mapping"
 *   path: string,              // Dot-notation path in DNA
 *   value: any                 // New value at that path
 * }
```

### New Service Types (rating-analyzer.js)

```javascript
/**
 * RatingAnalyzer class exports:
 * - analyzeModelRatings(dna)
 * - generateSuggestions(analysis)
 */

/**
 * Suggestion types:
 * - "low-rating": Model has average rating below threshold with sufficient data
 * - "high-variance": Model performance varies significantly across tasks
 * - "underused": Model has few ratings, needs more usage for reliable stats
 */

/**
 * Low rating suggestion type:
 * {
 *   type: "low-rating",
 *   modelRole: string,
 *   averageRating: number,
 *   ratingCount: number,
 *   recommendation: string
 * }

/**
 * High variance suggestion type:
 * {
 *   type: "high-variance",
 *   modelRole: string,
 *   variance: number,
 *   recommendation: string
 * }

/**
 * Underused suggestion type:
 * {
 *   type: "underused",
 *   modelRole: string,
 *   ratingCount: number,
 *   recommendation: string
 * }
```

## Files to Create

### New Files

1. **`src/utils/usage-tracker.js`** - Usage tracking and analytics utility
   - Tracks task completions with sliding window of last 10 ratings per model/task combo
   - Records model switches between fallback attempts
   - Stores effectiveness ratings via DNA manager integration
   - Provides query methods for statistics and pattern detection

2. **`src/services/evolution-engine.js`** - Auto-evolution service
   - Analyzes DNA usage data to detect optimization opportunities
   - Generates mutations for task-model reassignments based on ratings
   - Applies mutations directly to DNA configuration
   - Maintains evolution history (last 100 entries)

3. **`src/services/rating-analyzer.js`** - Rating analysis service
   - Analyzes model ratings across all task types
   - Generates suggestions for low-rated, high-variance, and underused models
   - Provides threshold-based suggestion filtering

### Configuration Updates

No new configuration files needed. All thresholds can be configured inline in the respective services:

```javascript
// usage-tracker.js
this.maxHistoryItems = parseInt(process.env.MAX_HISTORY_ITEMS || "100");

// evolution-engine.js
this.evolutionThresholds = {
  lowRatingThreshold: 3.0,
  minRatingsForEvolution: 5,
  maxAttempts: 3,
};

// rating-analyzer.js
this.thresholds = {
  lowRating: 3.0,
  excellentRating: 4.5,
  minRatingsForAnalysis: 5,
};
```

Optional environment variables for customization:
- `MAX_HISTORY_ITEMS` - Sliding window size for rating history (default: 100)
- `EVOLUTION_LOW_RATING_THRESHOLD` - Rating below which suggestions are generated (default: 3.0)
- `EVOLUTION_MIN_RATINGS` - Minimum ratings required before generating suggestions (default: 5)

## Function Modifications

### Existing Files No Changes Required

**Important:** Phase 5 components are **standalone utilities**. They can be imported and used without modifying any existing files. The integration points below are optional enhancements:

#### Optional Integration Points

1. **`src/services/task-dispatcher.js`** - Add usage tracking call
   - Location: `recordTaskSuccess()` method (around line 230)
   - Add: `usageTracker.trackTaskCompletion(taskType, modelId, result)` after successful task execution
   
2. **`src/tools/model-dna-tool.js`** - Replace inline analysis with rating-analyzer
   - Current: `analyzeUsage()` function (lines ~195-240)
   - Could be replaced with: `ratingAnalyzer.analyzeModelRatings(dna)`
   
3. **`src/utils/model-dna-manager.js`** - Already has `recordEffectivenessRating()` which Phase 5 will use

No modifications are required for Phase 5 to function. The services can be imported and called explicitly where needed.

## Class Modifications

### New Classes to Create

1. **`UsageTracker` class** (src/utils/usage-tracker.js)
   ```javascript
   export class UsageTracker {
     constructor();
     trackTaskCompletion(taskType, modelId, result);
     trackModelSwitch(fromModel, toModel);
     trackRating(modelRole, taskType, rating);
     getTaskStats(taskType);
     getModelStats(modelId);
     getAverageRatings();
     detectPatterns();
     getUsageSummary();
   }
   
   // Export singleton instance: export const usageTracker = new UsageTracker();
   ```

2. **`EvolutionEngine` class** (src/services/evolution-engine.js)
   ```javascript
   export class EvolutionEngine {
     constructor();
     analyzeAndEvolve(dna);
     analyzeUsage(dna);
     generateMutations(analysis);
     applyMutation(dna, mutation);
     recordEvolution(mutation, result);
     getEvolutionHistory();
     sortByPriority(suggestions);
     getSuggestionPriority(suggestion);
   }
   
   // Export singleton instance: export const evolutionEngine = new EvolutionEngine();
   ```

3. **`RatingAnalyzer` class** (src/services/rating-analyzer.js)
   ```javascript
   export class RatingAnalyzer {
     constructor();
     analyzeModelRatings(dna);
     generateSuggestions(modelRole, averageRating, variance, ratingCount);
     createLowRatingSuggestion(modelRole, averageRating, ratingCount);
     createHighVarianceSuggestion(modelRole, variance);
     createUnderusedSuggestion(modelRole, ratingCount);
   }
   
   // Export singleton instance: export const ratingAnalyzer = new RatingAnalyzer();
   ```

### Existing Classes No Modifications Required

No existing classes need to be modified. Phase 5 services are designed as standalone utilities that can be imported and used without affecting current code paths.

## Dependencies

### No New npm Dependencies

Phase 5 uses only Node.js built-in modules:
- `node:fs` - File operations (already used by DNA manager)
- `node:path` - Path manipulation (already used by DNA manager)
- `node:url` - URL utilities (already used by DNA manager)

No new packages need to be installed. All functionality builds on existing infrastructure.

## Testing Strategy

### Unit Tests Structure

Tests should be added to `tests/phase-5/` directory:

#### Phase 5 Test Files Needed

1. **`tests/usage-tracker.test.js`**
   - Test tracking task completions with sliding window
   - Test model switch recording
   - Test statistics queries (getTaskStats, getModelStats)
   - Test pattern detection logic
   
2. **`tests/rating-analyzer.test.js`**
   - Test rating analysis for single and multiple models
   - Test suggestion generation for low-rating cases
   - Test high-variance detection
   - Test underused model detection
   
3. **`tests/evolution-engine.test.js`**
   - Test analyzeAndEvolve with no mutations needed
   - Test mutation generation from analysis
   - Test mutation application to DNA structure
   - Test evolution history tracking

#### Example Test Structure (using Node's built-in test runner)

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { UsageTracker } from '../../src/utils/usage-tracker.js';
import { loadModelDNA, createDNAFile } from '../../src/utils/model-dna-manager.js';

describe('UsageTracker', () => {
  let tracker;
  let testDir;

  beforeEach(() => {
    testDir = './tests/tmp/test-phase5';
    tracker = new UsageTracker();
    
    // Setup: create clean DNA file for testing
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    createDNAFile({}, testDir);
  });

  afterEach(() => {
    // Cleanup
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('trackTaskCompletion()', () => {
    it('should track task completion and update usageStats', async () => {
      await tracker.trackTaskCompletion('researchBugFixes', 'ninja-researcher', { success: true });
      
      const dna = loadModelDNA(testDir);
      assert.strictEqual(dna.usageStats.tasksCompleted['researchBugFixes'], 1);
    });

    it('should maintain sliding window of last 10 ratings per model/task combo', async () => {
      // Track 15 completions with ratings
      for (let i = 0; i < 15; i++) {
        await tracker.trackTaskCompletion('executeCode', 'executor', { 
          success: true,
          rating: i % 5 + 1
        });
      }
      
      const dna = loadModelDNA(testDir);
      const ratings = dna.usageStats.modelEffectiveness['executor']['executeCode'];
      assert.strictEqual(ratings.length, 10); // Should be capped at 10
    });
  });
});
```

### Integration Tests

4. **`tests/phase-5-integration.test.js`** - Test end-to-end flow:
   - Task execution → usage tracking → rating analysis → evolution suggestions
   - Verify mutations are correctly applied to DNA structure

### Manual Testing Checklist

1. Initialize Model DNA with `model-dna init`
2. Execute various tasks through the system
3. Manually record ratings using `recordEffectivenessRating()` helper
4. Run `model-dna evolve` and verify suggestions are generated
5. Apply mutations with `model-dna evolve --apply` and verify DNA changes

## Implementation Order

### Step 1: Create Usage Tracker (src/utils/usage-tracker.js)
- Implement constructor with configurable maxHistoryItems
- Add trackTaskCompletion() with sliding window logic
- Add trackModelSwitch() for recording fallback events
- Add trackRating() for manual rating entries
- Add getTaskStats(), getModelStats(), getAverageRatings() query methods
- Add detectPatterns() for issue detection
- Add getUsageSummary() for overview data
- Export singleton instance

### Step 2: Create Rating Analyzer (src/services/rating-analyzer.js)
- Implement constructor with threshold configuration
- Add analyzeModelRatings() to process all model ratings
- Add generateSuggestions() to create suggestion objects
- Add helper methods: createLowRatingSuggestion(), createHighVarianceSuggestion(), createUnderusedSuggestion()
- Export singleton instance

### Step 3: Create Evolution Engine (src/services/evolution-engine.js)
- Implement constructor with thresholds and history array
- Add analyzeAndEvolve() as main entry point
- Add analyzeUsage() to generate analysis object from DNA
- Add generateMutations() to create mutation objects from suggestions
- Add applyMutation() for direct DNA structure modification
- Add recordEvolution() and getEvolutionHistory() for tracking
- Add sortByPriority() and getSuggestionPriority() helpers
- Export singleton instance

### Step 4: Update model-dna-tool.js (Optional Enhancement)
- Import ratingAnalyzer from new service
- Replace inline analyzeUsage() function with call to ratingAnalyzer.analyzeModelRatings()
- Update handleEvolveDNA() to use evolutionEngine for mutation application

### Step 5: Add Integration Points (Optional Enhancements)
- In task-dispatcher.js, import usageTracker and call trackTaskCompletion after successful tasks
- Document integration points in Phase 4 documentation

### Step 6: Create Test Files
- tests/usage-tracker.test.js
- tests/rating-analyzer.test.js
- tests/evolution-engine.test.js
- tests/phase-5-integration.test.js (optional)

## Quality Standards

- All new files must follow existing code style (ES modules, JSDoc comments)
- Usage tracker must maintain backward compatibility with existing DNA structure
- Evolution engine mutations must be idempotent and safe to apply multiple times
- Rating analyzer thresholds must be configurable via constructor or environment variables
- All services must handle missing/empty data gracefully without throwing errors
- Sliding window logic in usage-tracker must use `slice(-10)` for last 10 ratings per model/task combo

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing DNA structure | Phase 5 only reads/writes to existing `usageStats` field which already exists in schema |
| Performance impact from tracking | Sliding window capped at 10 items per model/task; maxHistoryItems env var limits total history |
| Incorrect mutation application | Mutations use safe path navigation with error checking; mutations are logged before application |
| Evolution triggers too frequently | Thresholds (minRatingsForEvolution: 5, lowRatingThreshold: 3.0) prevent premature suggestions |

## Success Criteria

1. **Usage tracking works**: Tasks completed and ratings are stored in DNA file correctly
2. **Pattern detection works**: Low-rating patterns are identified when thresholds are met
3. **Evolution suggestions work**: `model-dna evolve` returns actionable suggestions
4. **Mutation application works**: `model-dna evolve --apply` correctly modifies task-model mappings
5. **No breaking changes**: Existing functionality continues to work without modification

## Future Enhancements (Out of Scope for Phase 5)

- A/B testing framework for comparing model performance
- Automated background evolution on configurable schedule (e.g., every N tasks)
- Cross-project learning from multiple DNA files
- ML-based pattern detection beyond simple threshold checks
- Visualization dashboard for usage statistics and evolution history