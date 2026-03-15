# Phase 5: Evolution & Auto-Optimization

## Overview

Phase 5 implements automatic DNA evolution based on usage patterns and model effectiveness ratings. The system analyzes accumulated rating data, identifies underperforming models, and suggests or automatically applies configuration mutations to optimize task-to-model assignments.

**Key Features:**
- **RatingAnalyzer** - Analyzes model effectiveness ratings across task types
- **EvolutionEngine** - Generates and applies mutations based on analysis
- **Auto-evolution** - Automatic DNA optimization when thresholds are met
- **Mutation tracking** - History of all evolution events for auditability

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Evolution Engine                         │
├─────────────────────────────────────────────────────────────┤
│  analyzeAndEvolve()                                         │
│    ├── Load DNA configuration                               │
│    ├── Analyze usage data (RatingAnalyzer)                  │
│    ├── Generate suggestions                                 │
│    ├── Create mutations from suggestions                    │
│    └── Apply mutations to DNA (if apply=true)               │
├─────────────────────────────────────────────────────────────┤
│  Rating Analyzer                                            │
│    ├── analyzeModelRatings() → Calculate statistics         │
│    ├── generateSuggestions() → Create recommendations       │
│    └── getActionableSuggestions() → Filter actionable items │
└─────────────────────────────────────────────────────────────┘
                        ↓
        ┌─────────────────────────────────┐
        │   Mutation Types                │
        ├─────────────────────────────────┤
        │ • reassign-tasks                │
        │ • restrict-model-usage          │
        │ • update-task-mapping           │
        └─────────────────────────────────┘
```

---

## File Structure

```
src/
├── services/
│   ├── evolution-engine.js      # Main evolution logic (~500 lines)
│   └── rating-analyzer.js       # Rating analysis & suggestions (~280 lines)
└── utils/
    └── usage-tracker.js         # Records task completion & ratings
```

---

## Rating Analyzer (rating-analyzer.js)

### Purpose

Analyzes model effectiveness ratings stored in DNA and generates improvement suggestions based on configurable thresholds.

### Constructor Options

| Option | Default | Description |
|--------|---------|-------------|
| `lowRating` | 3.0 | Rating below which low-rating suggestions are generated |
| `excellentRating` | 4.5 | Rating above which model is considered excellent |
| `minRatingsForAnalysis` | 5 | Minimum ratings required before generating suggestions |

### Environment Variables

```bash
EVOLUTION_LOW_RATING_THRESHOLD=3.0      # Low rating threshold
EVOLUTION_EXCELLENT_RATING=4.5          # Excellent rating threshold  
EVOLUTION_MIN_RATINGS=5                 # Minimum ratings for analysis
```

### Core Methods

#### analyzeModelRatings(dnaOrPath, projectRoot)

Analyzes all model effectiveness ratings and returns comprehensive statistics.

**Parameters:**
- `dnaOrPath` - DNA object or path string to load from file
- `projectRoot` - Project root directory (optional)

**Returns:**
```javascript
{
  totalModels: number,           // Total models in DNA
  modelsWithRatings: number,     // Models with at least one rating
  modelAnalysis: {               // Per-model analysis
    [modelRole]: {
      averageRating: string,     // Overall average (e.g., "4.25")
      ratingCount: number,       // Total ratings received
      taskBreakdown: {           // Per-task-type statistics
        [taskType]: {
          averageRating: string,
          ratingCount: number,
          variance: string,       // Standard deviation
          minRating: number,
          maxRating: number,
        }
      }
    }
  },
  overallAverageRating: string,  // Average across all models
  totalRatings: number,
}
```

#### generateSuggestions(analysis)

Generates improvement suggestions based on rating analysis.

**Suggestion Types:**

| Type | Trigger Condition | Description |
|------|------------------|-------------|
| `low-rating` | avg < threshold AND count >= min | Model performs poorly |
| `high-variance` | stdDev > 1.0 | Inconsistent performance across tasks |
| `underused` | count < minRatings | Not enough data for reliable analysis |

**Returns:** Array of suggestion objects:
```javascript
{
  type: string,              // "low-rating", "high-variance", or "underused"
  modelRole: string,         // Affected model role
  averageRating?: number,    // For low-rating suggestions
  variance?: number,         // For high-variance suggestions  
  ratingCount: number,       // Number of ratings analyzed
  recommendation: string,    // Human-readable suggestion text
}
```

#### getActionableSuggestions(suggestions)

Filters out informational "underused" warnings, returning only actionable items.

---

## Evolution Engine (evolution-engine.js)

### Purpose

Analyzes DNA usage data and applies mutations to optimize model configurations based on rating analysis.

### Constructor Options

| Option | Default | Description |
|--------|---------|-------------|
| `lowRatingThreshold` | 3.0 | Rating below which mutations are suggested |
| `minRatingsForEvolution` | 5 | Minimum ratings before evolution triggers |
| `maxHistoryItems` | 100 | Maximum history entries to keep |

### Core Methods

#### analyzeAndEvolve(dnaOrPath, apply, projectRoot)

Main entry point: analyzes DNA and optionally applies mutations.

**Parameters:**
- `dnaOrPath` - DNA object or path string
- `apply` - Whether to automatically apply mutations (default: true)
- `projectRoot` - Project root directory for saving

**Returns:**
```javascript
{
  dna: Object|null,              // Updated DNA if applied, null otherwise
  mutationsApplied: Array,       // Applied mutation details with timestamps
  analysis: Object,              // Full analysis result
  wasEvolved: boolean,           // Whether any mutations were applied
  suggestions: Array,            // Top suggestions considered
  reason?: string,               // Reason if no evolution occurred
}
```

#### analyzeUsage(dna, projectRoot)

Analyzes usage data using RatingAnalyzer and returns actionable suggestions.

**Returns:** Analysis object with filtered actionable suggestions (excludes "underused").

#### generateMutationFromSuggestion(suggestion, dna)

Creates a mutation object from a specific suggestion type.

| Suggestion Type | Mutation Generated |
|-----------------|-------------------|
| `low-rating` | Reassign tasks to better-rated model |
| `high-variance` | Restrict model to high-performing task types |
| `underused` | No mutation (informational only) |

#### applyMutation(dna, mutation)

Applies a single mutation using dot-notation paths.

**Example:**
```javascript
// Mutation with path "taskModelMapping.codeFixes"
applyMutation(dna, {
  type: "reassign-tasks",
  path: "taskModelMapping.codeFixes",
  value: "ninja-researcher"
});
// Sets dna.taskModelMapping.codeFixes = "ninja-researcher"
```

#### applyMutationsToDNA(dna, mutations, projectRoot)

Applies multiple mutations and saves to file. Returns null if any mutation fails (rollback).

#### recordEvolution(mutation, result)

Records an evolution event in the history for auditability.

#### getEvolutionHistory()

Returns all recorded evolution events (most recent first).

---

## Mutation Types

### 1. Reassign Tasks (`reassign-tasks`)

Moves task assignments from a low-rated model to a better-performing alternative.

```javascript
{
  type: "reassign-tasks",
  path: "taskModelMapping",
  value: { codeFixes: "ninja-researcher", ... },  // New mapping
  fromModel: "conversationalist",
  toModel: "ninja-researcher",
  affectedTasks: ["codeFixes", "generalResearch"],
}
```

### 2. Restrict Model Usage (`restrict-model-usage`)

Limits a high-variance model to only its best-performing task types.

```javascript
{
  type: "restrict-model-usage",
  path: "taskModelMapping",
  value: { codeFixes: "executor" },  // Only tasks with rating >= 4.0
  modelRole: "executor",
  allowedTasks: ["codeFixes"],
}
```

---

## Evolution Flow

```
1. User rates a model (rate-model tool)
   ↓
2. Rating stored in DNA.usageStats.modelEffectiveness
   ↓
3. Periodic analysis or manual trigger (model-dna evolve action)
   ↓
4. RatingAnalyzer.analyzeModelRatings() calculates statistics
   ↓
5. generateSuggestions() creates recommendations
   ↓
6. EvolutionEngine filters actionable suggestions
   ↓
7. Mutations generated from high-priority suggestions
   ↓
8. If apply=true: mutations applied to DNA and saved
   ↓
9. Evolution recorded in history for auditability
```

---

## Usage Examples

### Manual Analysis (No Auto-Apply)

```javascript
import { evolutionEngine } from './services/evolution-engine.js';

const result = await evolutionEngine.analyzeAndEvolve(process.cwd(), false);

console.log(result.analysis);  // View analysis
console.log(result.suggestions);  // View suggestions
// DNA not modified - apply=false
```

### Auto-Evolution (Apply Mutations)

```javascript
const result = await evolutionEngine.analyzeAndEvolve(process.cwd(), true);

if (result.wasEvolved) {
  console.log(`Applied ${result.mutationsApplied.length} mutations`);
  for (const m of result.mutationsApplied) {
    console.log(`- ${m.mutation.type}: ${m.mutation.path}`);
  }
} else {
  console.log("No evolution needed:", result.reason);
}
```

### Direct Rating Analysis

```javascript
import { ratingAnalyzer } from './services/rating-analyzer.js';

const analysis = ratingAnalyzer.analyzeModelRatings(process.cwd());

console.log(`Overall average: ${analysis.overallAverageRating}`);
console.log(`Total ratings: ${analysis.totalRatings}`);

for (const [model, data] of Object.entries(analysis.modelAnalysis)) {
  console.log(`${model}: avg=${data.averageRating}, count=${data.ratingCount}`);
}
```

### View Evolution History

```javascript
const history = evolutionEngine.getEvolutionHistory();

for (const event of history) {
  console.log(`[${event.timestamp}] ${event.mutation.type}`);
  console.log(`  Path: ${event.mutation.path}`);
  console.log(`  Success: ${event.result.success}`);
}
```

---

## Threshold Configuration

### Low Rating Detection

A model is flagged as "low-rated" when:
- Average rating < `EVOLUTION_LOW_RATING_THRESHOLD` (default: 3.0)
- Number of ratings >= `EVOLUTION_MIN_RATINGS` (default: 5)

### High Variance Detection

A model shows "high variance" when:
- Standard deviation > 1.0 for any task type
- Indicates inconsistent performance across similar tasks

### Priority Scoring

Suggestions are prioritized by calculated score:

```javascript
// Low-rating: more severe = higher priority
score = (threshold - averageRating) * 10 + ratingCount * 2;

// High-variance: larger variance = higher priority  
score = variance * 5;

// Underused: informational only, negative priority
score = -ratingCount;
```

---

## Integration with Phase 4 Tools

### model-dna Tool Evolution Action

The `model-dna` tool's `evolve` action uses EvolutionEngine:

```javascript
async function handleEvolveDNA(params) {
  const dna = loadModelDNA();
  if (!dna) return { error: "Model DNA not initialized" };

  const analysis = analyzeUsage(dna);  // Uses RatingAnalyzer internally

  let evolvedDna = dna;
  if (params.apply && analysis.suggestions?.length > 0) {
    // Apply top suggestion mutation
    const topSuggestion = analysis.suggestions[0];
    if (topSuggestion.mutation) {
      const parts = topSuggestion.mutation.path.split(".");
      let target = evolvedDna;
      for (let i = 0; i < parts.length - 1; i++) target = target[parts[i]];
      target[parts[parts.length - 1]] = topSuggestion.mutation.value;
      createDNAFile(evolvedDna);
    }
  }

  return { success: true, analysis };
}
```

---

## Testing Strategy

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ratingAnalyzer } from '../src/services/rating-analyzer.js';
import { evolutionEngine } from '../src/services/evolution-engine.js';

describe('Rating Analyzer', () => {
  it('should calculate average ratings correctly', () => {
    const dna = {
      usageStats: {
        modelEffectiveness: {
          'test-model': { codeFixes: [{ rating: 4 }, { rating: 5 }] }
        }
      }
    };
    
    const analysis = ratingAnalyzer.analyzeModelRatings(dna);
    assert.strictEqual(analysis.modelAnalysis['test-model'].averageRating, '4.50');
  });

  it('should generate low-rating suggestion when threshold exceeded', () => {
    const dna = {
      usageStats: {
        modelEffectiveness: {
          'bad-model': { codeFixes: Array(6).fill({ rating: 2 }) }
        }
      }
    };
    
    const analysis = ratingAnalyzer.analyzeModelRatings(dna);
    const suggestions = ratingAnalyzer.generateSuggestions(analysis);
    
    assert.ok(suggestions.some(s => s.type === 'low-rating'));
  });

  it('should not generate suggestion for underused models', () => {
    const dna = {
      usageStats: {
        modelEffectiveness: {
          'new-model': { codeFixes: [{ rating: 1 }] }  // Only 1 rating
        }
      }
    };
    
    const analysis = ratingAnalyzer.analyzeModelRatings(dna);
    const actionable = ratingAnalyzer.getActionableSuggestions(
      ratingAnalyzer.generateSuggestions(analysis)
    );
    
    assert.strictEqual(actionable.length, 0);
  });
});

describe('Evolution Engine', () => {
  it('should return null when no suggestions found', async () => {
    const dna = { usageStats: { modelEffectiveness: {} } };
    const result = await evolutionEngine.analyzeAndEvolve(dna, false);
    
    assert.strictEqual(result.wasEvolved, false);
  });

  it('should record evolution in history', async () => {
    // Setup DNA with low-rated model...
    // Trigger evolution...
    const history = evolutionEngine.getEvolutionHistory();
    assert.ok(history.length > 0);
  });

  it('should rollback on mutation failure', async () => {
    // Test that partial failures don't corrupt DNA
  });
});
```

---

## Changes from Original Specification

| Aspect | Original Spec | Actual Implementation |
|--------|--------------|----------------------|
| Evolution trigger | Manual only | Both manual and automatic via tool |
| Mutation types | Generic mutations | Specific: reassign-tasks, restrict-model-usage |
| Rating analysis | Basic averages | Full statistics with variance/stdDev |
| History tracking | Not specified | Full evolution history with timestamps |
| Threshold config | Hardcoded | Environment variable configurable |

---

## Future Enhancements

1. **A/B Testing** - Gradually shift traffic between models to gather comparative data
2. **Contextual Evolution** - Consider task complexity and user preferences in mutations
3. **Rollback Mechanism** - Automatic rollback if evolved configuration performs worse
4. **Multi-objective Optimization** - Balance speed, quality, and cost in model selection
5. **Collaborative Filtering** - Learn from other users' model effectiveness data

---

## Summary

Phase 5 completes the intelligent model management system by adding automatic optimization capabilities. The RatingAnalyzer provides deep insights into model performance across task types, while the EvolutionEngine uses these insights to continuously improve DNA configuration through targeted mutations. Together with Phase 4's tools interface, this creates a self-optimizing system that adapts to user preferences and model capabilities over time.