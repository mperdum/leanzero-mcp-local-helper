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
    description: "Code fixes, debugging, error resolution"
  },
  FEATURE_ARCHITECTURE: {
    id: "featureArchitecture",
    keywords: ["architecture", "design", "structure", "pattern", "module", "layer"],
    recommendedModel: "architect",
    description: "Feature architecture, design patterns, system structure"
  },
  CODE_EXECUTION: {
    id: "codeExecution",
    keywords: ["execute", "run", "write", "create", "edit", "generate", "modify"],
    recommendedModel: "executor",
    description: "Code execution, writing, and editing"
  },
  GENERAL_RESEARCH: {
    id: "generalResearch",
    keywords: ["research", "information", "overview", "summary", "explain", "what is"],
    recommendedModel: "researcher",
    description: "General research, information gathering"
  },
  IMAGE_ANALYSIS: {
    id: "imageAnalysis",
    keywords: ["image", "visual", "screenshot", "diagram", "chart", "graph", "picture"],
    recommendedModel: "vision",
    description: "Image analysis, visual content understanding"
  },
  CONVERSATION: {
    id: "conversation",
    keywords: ["chat", "talk", "discuss", "ask", "question", "hello"],
    recommendedModel: "conversationalist",
    description: "General conversation, questions"
  }
};

/**
 * Cache for classification results
 * @type {Map<string, Object>}
 */
const _classificationCache = new Map();
const CACHE_MAX_SIZE = 100;

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
  if (_classificationCache.size >= CACHE_MAX_SIZE) {
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
export function classifyTask(query) {
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

  const lowerQuery = query.toLowerCase();
  
  let bestCategory = TASK_CATEGORIES.CONVERSATION;
  let highestScore = 0;

  // Score each category based on keyword matches
  for (const category of Object.values(TASK_CATEGORIES)) {
    let score = 0;
    
    // Keyword matching (exact substring match)
    for (const keyword of category.keywords) {
      if (lowerQuery.includes(keyword)) {
        score += 10; // Full points for keyword match
      }
    }

    // Length bonus (longer queries typically more specific)
    if (query.length > 50) {
      score += 5;
    }
    
    // First word bonus (often indicates intent)
    const firstWord = lowerQuery.split(' ')[0];
    if (category.keywords.includes(firstWord)) {
      score += 3;
    }

    if (score > highestScore) {
      highestScore = score;
      bestCategory = category;
    }
  }

  // Determine confidence level
  let confidence = "low";
  if (highestScore >= 30) {
    confidence = "high";
  } else if (highestScore >= 15) {
    confidence = "medium";
  } else if (highestScore === 0) {
    confidence = "none"; // No keywords matched
  }

  const result = { 
    category: bestCategory, 
    score: highestScore, 
    confidence 
  };

  // Cache result
  addToCache(query, result);

  return result;
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
  TASK_CATEGORIES
};