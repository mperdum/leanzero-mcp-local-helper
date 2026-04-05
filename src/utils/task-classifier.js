/**
 * Task Classifier - Intent analysis and task category mapping
 * Classifies user queries into task categories for optimal model routing
 */

/**
 * Task category definitions with keywords and recommended models
 */
export const TASK_CATEGORIES = {
  CODE_FIXES: {
    id: "codeFixes",
    keywords: ["fix", "bug", "error", "debug", "syntax", "crash", "exception"],
    recommendedModel: "ninjaResearcher",
    description: "Code fixes, debugging, error resolution",
    requiredCapabilities: ["toolUse"]
  },
  FEATURE_ARCHITECTURE: {
    id: "featureArchitecture",
    keywords: ["architecture", "design", "structure", "pattern", "module", "layer"],
    recommendedModel: "architect",
    description: "Feature architecture, design patterns, system structure",
    requiredCapabilities: ["toolUse"]
  },
  CODE_EXECUTION: {
    id: "codeExecution",
    keywords: ["execute", "run", "write", "create", "edit", "generate", "modify"],
    recommendedModel: "executor",
    description: "Code execution, writing, and editing",
    requiredCapabilities: ["toolUse"]
  },
  GENERAL_RESEARCH: {
    id: "generalResearch",
    keywords: ["research", "information", "overview", "summary", "explain", "what is"],
    recommendedModel: "researcher",
    description: "General research, information gathering",
    requiredCapabilities: []
  },
  IMAGE_ANALYSIS: {
    id: "imageAnalysis",
    keywords: ["image", "visual", "screenshot", "diagram", "chart", "graph", "picture"],
    recommendedModel: "vision",
    description: "Image analysis, visual content understanding",
    requiredCapabilities: ["vision"]
  },
  CONVERSATION: {
    id: "conversation",
    keywords: ["chat", "talk", "discuss", "ask", "question", "hello"],
    recommendedModel: "conversationalist",
    description: "General conversation, questions",
    requiredCapabilities: []
  }
};

/**
 * Cache for classification results
 * @type {Map<string, Object>}
 */
const _classificationCache = new Map();
let _cacheMaxSize = 100;

/**
 * Configuration for the classifier
 */
let _classifierConfig = {
  scoreIncrements: {
    keywordMatch: 10,
    lengthBonus: 5,
    firstWordBonus: 3
  },
  confidenceThresholds: {
    high: 30,
    medium: 15
  }
};

/**
 * Initialize the classifier with DNA configuration
 * @param {Object} config - Configuration object
 */
export async function initializeClassifier() {
  try {
    const { loadModelDNA } = await import('./model-dna-manager.js');
    const dna = loadModelDNA();
    if (dna?.classifierConfig) {
      const cfg = dna.classifierConfig;
      if (cfg.cacheMaxSize) _cacheMaxSize = cfg.cacheMaxSize;
      if (cfg.scoreIncrements) _classifierConfig.scoreIncrements = cfg.scoreIncrements;
      if (cfg.confidenceThresholds) _classifierConfig.confidenceThresholds = cfg.confidenceThresholds;
    }
  } catch (error) {
    console.warn('[TaskClassifier] Failed to initialize with DNA:', error.message);
  }
}

/**
 * Get cache key from query
 * @param {string} query - Query string
 * @returns {string} Cache key
 */
function getCacheKey(query) {
  return query.toLowerCase().substring(0, 100);
}

/**
 * Add result to cache
 * @param {string} query - Original query
 * @param {Object} result - Classification result
 */
function addToCache(query, result) {
  const key = getCacheKey(query);
  
  // Manage cache size
  if (_classificationCache.size >= _cacheMaxSize) {
    const firstKey = _classificationCache.keys().next().value;
    _classificationCache.delete(firstKey);
  }
  
  _classificationCache.set(key, result);
}

/**
 * Get result from cache
 * @param {string} query - Query to look up
 * @returns {Object|null} Cached result or null
 */
function getFromCache(query) {
  const key = getCacheKey(query);
  return _classificationCache.get(key) || null;
}

/**
 * Classify user query into a task category
 * @param {string} query - The user's query text
 * @returns {Object} Classification result with category, score, confidence
 */
export async function classifyTask(query) {
  // Edge case: empty or invalid query
  if (!query || typeof query !== "string") {
    return { 
      category: TASK_CATEGORIES.CONVERSATION, 
      confidence: "low",
      score: 0
    };
  }

  // Check cache first
  const cached = getFromCache(query);
  if (cached) {
    return cached;
  }

  // 1. Heuristic Classification
  const heuristicResult = _performHeuristicClassification(query);

  // 2. Semantic Classification (if heuristic is uncertain or query is complex)
  if (heuristicResult.confidence === "low" || 
      heuristicResult.confidence === "none" || 
      query.length > 100) {
    
    try {
      const semanticResult = await _performSemanticClassification(query);
      if (semanticResult && semanticResult.id) {
        const finalResult = {
          category: semanticResult,
          score: 100, // Semantic match is considered high confidence
          confidence: "high"
        };
        addToCache(query, finalResult);
        return finalResult;
      }
    } catch (error) {
      console.warn('[TaskClassifier] Semantic classification failed, falling back to heuristic:', error.message);
    }
  }

  // Cache and return heuristic result if semantic failed or wasn't needed
  addToCache(query, heuristicResult);
  return heuristicResult;
}

/**
 * Internal heuristic-based classification
 * @private
 */
function _performHeuristicClassification(query) {
  const lowerQuery = query.toLowerCase();
  let bestCategory = TASK_CATEGORIES.CONVERSATION;
  let highestScore = 0;

  for (const category of Object.values(TASK_CATEGORIES)) {
    let score = 0;
    for (const keyword of category.keywords) {
      if (lowerQuery.includes(keyword)) {
        score += _classifierConfig.scoreIncrements.keywordMatch;
      }
    }
    if (query.length > 50) {
      score += _classifierConfig.scoreIncrements.lengthBonus;
    }
    const firstWord = lowerQuery.split(' ')[0];
    if (category.keywords.includes(firstWord)) {
      score += _classifierConfig.scoreIncrements.firstWordBonus;
    }
    if (score > highestScore) {
      highestScore = score;
      bestCategory = category;
    }
  }

  let confidence = "low";
  if (highestScore >= _classifierConfig.confidenceThresholds.high) {
    confidence = "high";
  } else if (highestScore >= _classifierConfig.confidenceThresholds.medium) {
    confidence = "medium";
  } else if (highestScore === 0) {
    confidence = "none";
  }

  return { category: bestCategory, score: highestScore, confidence };
}

/**
 * LLM-driven semantic classification
 * @private
 */
async function _performSemanticClassification(query) {
  let lmStudioSwitcher;
  try {
    const module = await import('../services/lm-studio-switcher.js');
    lmStudioSwitcher = module.lmStudioSwitcher;
  } catch (error) {
    console.error('[TaskClassifier] Failed to import lmStudioSwitcher:', error.message);
    return null;
  }

  const categoriesInfo = Object.values(TASK_CATEGORIES)
    .map(c => `- ${c.id}: ${c.description}`)
    .join('\n');

  const systemPrompt = `You are an expert task classifier. Your goal is to analyze a user's intent and map it to the most appropriate task category.

AVAILABLE CATEGORIES:
${categoriesInfo}

INSTRUCTIONS:
1. Analyze the user's query.
2. Select the single best category ID from the list above.
3. Return ONLY the category ID as your response. Do not include any other text, explanation, or markdown.

EXAMPLES:
Query: "Can you help me fix this syntax error in my python code?"
Response: codeFixes

Query: "Tell me about the history of the internet"
Response: generalResearch

Query: "Draw a diagram of this architecture"
Response: imageAnalysis`;

  const result = await lmStudioSwitcher.executeChatCompletion(
    'architect', // Using architect as default for classification
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Query: "${query}"` }
    ],
    { temperature: 0.1 }
  );

  if (!result.success) return null;

  const predictedId = result.result.content.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // Find the category in TASK_CATEGORIES by ID (case-insensitive and normalized)
  const category = Object.values(TASK_CATEGORIES).find(c => 
    c.id.toLowerCase().replace(/[^a-z0-9]/g, '') === predictedId
  );
  
  return category || null;
}

/**
 * Get all task categories for discovery/display
 * @returns {Array} Array of category objects
 */
export function getTaskCategories() {
  return Object.entries(TASK_CATEGORIES).map(([key, cat]) => ({
    id: key,
    ...cat
  }));
}

/**
 * Register a custom task category (extensibility)
 * @param {Object} category - Category to register
 * @param {string} category.id - Unique category ID
 * @param {Array<string>} category.keywords - Keywords that match this category
 * @param {string} category.recommendedModel - Recommended model for this category
 * @param {string} [category.description] - Optional description
 * @throws {Error} If category is invalid
 */
export function registerTaskCategory(category) {
  if (!category.id || !category.keywords || !category.recommendedModel) {
    throw new Error("Category must have id, keywords, and recommendedModel");
  }
  
  TASK_CATEGORIES[category.id.toUpperCase()] = {
    id: category.id,
    keywords: category.keywords,
    recommendedModel: category.recommendedModel,
    description: category.description || ""
  };
}

/**
 * Clear classification cache
 */
export function clearClassificationCache() {
  _classificationCache.clear();
}

// Export singleton-like functions for convenience
export default {
  classifyTask,
  getTaskCategories,
  registerTaskCategory,
  clearClassificationCache,
  initializeClassifier,
  TASK_CATEGORIES
};
