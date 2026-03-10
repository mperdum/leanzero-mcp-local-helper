/**
 * MCP Local Helper - Core DNA System
 * Phase 1: Core DNA System Implementation
 * 
 * This module provides the core Document DNA functionality:
 * - Schema definition and validation
 * - File management and caching
 * - Inheritance and merging
 * - Configuration persistence
 */

// Core schema and validation
export { 
  MODEL_DNA_SCHEMA,
  VALID_MODEL_TYPES,
  getDefaultDNA,
  validateModelDNA,
  applyMigration 
} from "./utils/model-dna-schema.js";

// DNA file operations and management
export { 
  dnaManager,
  ModelDNAManager 
} from "./utils/model-dna-manager.js";

// DNA inheritance and merging
export { 
  mergeDNAConfigs,
  resolveConflict,
  inheritDNA,
  diffDNA 
} from "./utils/model-dna-inheritance.js";

// Re-export for convenience
export * as DNA from "./utils/model-dna-schema.js";
export * as DNAManager from "./utils/model-dna-manager.js";
export * as DNAInheritance from "./utils/model-dna-inheritance.js";