# Implementation Plan: Phase 4 Tools - Missing Features & Fixes

[Overview]
This plan addresses critical gaps and missing functionality in the Phase 4 Tools Implementation, including unregistered streaming task execution, broken evolution analysis, missing helper exports, incomplete error handling, and performance optimizations that were specified in the documentation but not fully implemented.

The current implementation has the core structure but lacks several key features: the streaming execution handler is defined but not registered, the DNA evolution analysis has logical errors, the average rating helper is not properly exported, and the tool responses don't fully match the documented format. These issues prevent the system from operating at full capacity.

[Types]
No new type definitions required. Existing types from Phase 1 and Phase 4 are sufficient. However, we need to ensure proper type exports for helper functions like `getAverageRating` and add proper TypeScript/JSDoc annotations for better documentation and error detection.

[Files]
The following file modifications are needed:

- **src/tools/switch-model.js**: Export `getAverageRating` helper function for use by other modules and tests
- **src/tools/execute-task.js**: Register `handleExecuteStreamingTask` in the tool definition or remove it if streaming is handled differently
- **src/tools/model-dna-tool.js**: Fix `analyzeUsage()` mutation path calculation logic that incorrectly tries to reverse lookup taskModelMapping
- **src/server.js**: Add streaming support for execute-task tool if needed, or document that streaming uses a separate endpoint
- **tests/tools.test.js**: Update tests to reflect actual behavior and add missing test cases for streaming and error scenarios

[Functions]
- **switch-model.js**: 
  - `getAverageRating()` - Currently defined but not exported. Should be exported for use by other modules and for better testability
  - `handleListModels()` - Should handle case where DNA is not initialized more gracefully
  - `handleLoadModel()` and `handleUnloadModel()` - Need better error messages from LM Studio API

- **execute-task.js**:
  - `handleExecuteTask()` - Already implemented correctly
  - `handleExecuteStreamingTask()` - Defined but never registered; either register it or remove to avoid confusion
  - Need to fix the `fallbackUsed` field naming inconsistency (uses both `fallbackUsed` and `fallbackAttempted`)

- **model-dna-tool.js**:
  - `analyzeUsage()` - Critical bug: mutation path calculation tries to find task by reversing modelRole lookup, which won't work. Should iterate through taskModelMapping properly
  - `handleEvolveDNA()` - Should validate that `topSuggestion.mutation.path` actually exists before trying to apply it
  - `handleSaveMemory()` - Return format should include the actual key used when generated

- **rate-model.js**:
  - `handleRateModel()` - Currently calls `recordEffectivenessRating()` but doesn't properly handle the return value structure

[Classes]
No new classes required. Existing classes (LMStudioSwitcher, TaskDispatcher, ContextManager) are adequate. However, we should consider:

- Adding a `ToolRegistry` class to centralize tool registration and validation
- Creating custom error classes for different failure modes (DNAUninitializedError, ModelUnavailableError, etc.)

[Testing]
- Existing tests in `tests/tools.test.js` need updates:
  - Fix tests that expect specific error messages that may have changed
  - Add tests for streaming functionality if we keep `handleExecuteStreamingTask`
  - Add tests for edge cases: DNA uninitialized, LM Studio connection failures, invalid model IDs
  - Add integration test for the full workflow: init → execute → rate → evolve
  - Mock LM Studio API more comprehensively to test failure scenarios

- Test coverage gaps:
  - No tests for `getAverageRating` helper
  - No tests for streaming execution
  - No tests for DNA evolution with actual mutations
  - Insufficient error handling tests

[Implementation Order]
The logical sequence for implementing fixes:

1. First, fix critical bugs that break functionality:
   - Fix `analyzeUsage()` mutation path in model-dna-tool.js (prevents proper evolution)
   - Export `getAverageRating` from switch-model.js (needed by other code)
   - Resolve streaming handler registration issue

2. Then, improve error handling and validation:
   - Standardize error responses across all tools
   - Add proper validation for all input parameters
   - Improve LM Studio error messages

3. Next, add missing features from documentation:
   - Implement rate limiting if specified
   - Add request caching for performance
   - Ensure all tool responses match documented format

4. Finally, update tests and documentation:
   - Fix broken tests
   - Add comprehensive test coverage
   - Update inline documentation

5. Performance and polish:
   - Optimize caching strategies
   - Reduce redundant DNA loading
   - Improve logging consistency

[Detailed Implementation Steps]

### Step 1: Fix Critical Bugs

1.1 In `src/tools/switch-model.js`:
- Export `getAverageRating` function at module level
- Add JSDoc for the function
- Ensure it handles null/undefined DNA gracefully

1.2 In `src/tools/model-dna-tool.js`:
- Fix `analyzeUsage()` mutation path: Instead of trying to find task by modelRole, properly iterate taskModelMapping to find tasks mapped to that model
- Add safety check before applying mutation in `handleEvolveDNA()`
- Fix return value of `handleSaveMemory()` to use actual generated key

1.3 In `src/tools/execute-task.js`:
- Decide whether to keep streaming handler: either register it as a separate tool "execute-task-streaming" or remove it
- Fix inconsistent field naming: `fallbackUsed` vs `fallbackAttempted`

### Step 2: Standardize Error Handling

2.1 Create consistent error response format:
```javascript
{
  content: [{ type: "text", text: JSON.stringify({ 
    error: "Error message", 
    details: {...}, 
    suggestion: "How to fix" 
  }, null, 2) }],
  isError: true
}
```

2.2 Update all tool handlers to use this format

2.3 Add specific error types:
- DNAUninitializedError
- ModelLoadFailedError
- InvalidParameterError

### Step 3: Complete Tool Registration

3.1 Review `src/server.js` tool registrations:
- Ensure all four core tools are registered with correct Zod schemas
- Verify streaming support if needed
- Check that error handling is consistent

3.2 Add tool description sections parsing for better AI integration

### Step 4: Performance Optimizations

4.1 Implement caching as documented:
- Cache recent tool results (30s TTL)
- Cache model recommendations (already exists, verify TTL)
- Cache DNA loads (already exists)

4.2 Add rate limiting:
- Per-client request tracking
- Configurable limits

4.3 Optimize DNA loading:
- Reduce redundant loads within same request
- Share DNA instance between tools

### Step 5: Testing & Validation

5.1 Update `tests/tools.test.js`:
- Fix any failing tests
- Add missing test coverage
- Add streaming tests
- Add evolution tests

5.2 Add integration tests:
- Full workflow with mocks
- Error recovery scenarios
- Concurrent access

5.3 Run full test suite and verify all pass

### Step 6: Documentation & Polish

6.1 Update inline documentation to match actual implementation

6.2 Verify all tool descriptions have proper ROLE/CONTEXT/TASK/CONSTRAINTS/FORMAT sections

6.3 Add changelog and migration notes

[Quality Standards Checklist]
- ✅ All tools have consistent error handling
- ✅ All functions that should be exported are exported
- ✅ Critical bugs fixed (DNA evolution, rating helper)
- ✅ Streaming functionality addressed
- ✅ Test coverage improved
- ✅ Performance optimizations applied
- ✅ Code follows existing patterns
- ✅ No breaking changes to existing API
- ✅ Documentation matches implementation
- ✅ All tests pass (npm test)