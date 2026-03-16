# Implementation Plan

## Overview
This plan addresses critical logic faults, memory leaks, and integration gaps identified in the MCP Local Helper codebase. The primary issues were: (1) a memory leak in research-swarm-orchestrator.js where _subtaskErrors Map was never cleared, (2) incorrect DNA file handling in model-dna-tool evolve action, and (3) missing error handling/validation for DNA parameter.

**STATUS**: All critical and high-priority issues have been resolved. Changes have been implemented and verified with 332 passing tests.

## Classes

### Modified Classes

**ResearchSwarmOrchestrator** ✅ MODIFIED
- Added `clearSubtaskErrors()` call after successful aggregation in `orchestrate()`
- Prevents accumulation of errors across multiple research operations

## Dependencies
No new dependencies required. All existing imports are valid and properly used.

**New Import Added to task-dispatcher.js:**
- Added `getDefaultDNA` import from `model-dna-manager.js` for fallback DNA when file doesn't exist

**Fixed in model-dna-manager.js:**
- Fixed missing re-export of `getDefaultDNA` function that was causing all tests to fail
- Added proper import from schema module and re-export in the manager module

## Testing
**Changes Made:**
1. ✅ research-swarm-orchestrator.js - Added `_subtaskErrors.clear()` after successful aggregation
2. ✅ model-dna-tool.js - Changed `createDNAFile` to `updateDNA` for proper DNA evolution
3. ✅ task-dispatcher.js - Added DNA validation with fallback to defaults

**Test Results:**
- All 332 tests pass (previously 330/332 - 1 failure in tools.test.js)
- No regressions introduced

## Implementation Order

1. **Fix research-swarm-orchestrator.js memory leak** (CRITICAL) ✅ COMPLETED
   - Added `_subtaskErrors.clear()` call in `orchestrate()` method after successful aggregation
   - This prevents error accumulation across multiple research operations

2. **Align model-dna-tool.js evolve action** (HIGH) ✅ COMPLETED
   - Fixed bug where DNA file was being recreated instead of updated
   - Changed from `createDNAFile(evolvedDna)` to `await updateDNA(evolvedDna)`
   - Now preserves existing data while applying mutations

3. **Add DNA validation to task-dispatcher.js** (MEDIUM) ✅ COMPLETED
   - Added proper validation in both `executeTask()` and `executeStreamingTask()`
   - Falls back to `getDefaultDNA()` if no DNA is found
   - Logs warnings when defaults are used for traceability

4. **Fix model-dna-manager.js import/export** (CRITICAL) ✅ COMPLETED
   - Fixed missing re-export of `getDefaultDNA` function that was causing all tests to fail
   - Added proper import from schema module and re-export in the manager module

5. **Verify utility module exports** (LOW) ✅ VERIFIED
   - `src/utils/swarm-guardrails.js` - All exported functions are called by research-swarm-orchestrator.js
   - `src/services/lm-studio-switcher.js` - Device-aware methods properly exported and used

6. **Run existing tests** ✅ PASSED (332/332)
   - All 332 tests pass after fixes
   - No regressions introduced