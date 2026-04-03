# Testing Documentation - MCP Local Helper

**Last Updated:** April 3, 2026  
**Purpose:** Comprehensive testing guide for the MCP Local Helper project

---

## Test Organization

```
tests/
├── dna.test.js                    # DNA schema validation, inheritance, migrations
├── lm-studio-switcher.test.js   # LM Studio API integration and model lifecycle
├── task-classifier.test.js      # Task intent classification
├── orchestrator.test.js         # Full orchestration flow and parallel execution
├── load-tracker.test.js         # Concurrency limits and request tracking
├── device-registry.test.js      # Device discovery and health checks
├── tools.test.js                 # MCP tool handler functionality
├── rating-analyzer.test.js      # Rating statistics calculation
├── evolution-engine.test.js     # Evolution suggestions and mutations
├── usage-tracker.test.js        # Usage pattern tracking
├── swarm-guardrails.test.js     # Swarm constraints enforcement (new in v3)
└── research-swarm.test.js       # Research swarm orchestration (new in v3)
```

---

## Running Tests

### Run All Tests

```bash
npm test
```

### Run Specific Test Files

```bash
# DNA validation and migrations
npx node --test tests/dna.test.js

# LM Studio API integration
npx node --test tests/lm-studio-switcher.test.js

# Task classification
npx node --test tests/task-classifier.test.js

# Full orchestration flow
npx node --test tests/orchestrator.test.js

# Concurrency limits and tracking
npx node --test tests/load-tracker.test.js

# Device discovery and health checks
npx node --test tests/device-registry.test.js

# MCP tool handler functionality
npx node --test tests/tools.test.js

# Rating statistics calculation
npx node --test tests/rating-analyzer.test.js

# Evolution suggestions
npx node --test tests/evolution-engine.test.js

# Usage pattern tracking
npx node --test tests/usage-tracker.test.js

# Swarm constraints enforcement (new in v3)
npx node --test tests/swarm-guardrails.test.js

# Research swarm orchestration (new in v3)
npx node --test tests/research-swarm.test.js
```

---

## Test Coverage Summary

| Test File | Tests | Purpose |
|-----------|-------|---------|
| `dna.test.js` | 24 | Schema validation, inheritance, migration |
| `lm-studio-switcher.test.js` | 38 | API integration, model lifecycle |
| `task-classifier.test.js` | 15 | Task intent classification |
| `orchestrator.test.js` | 42 | Full orchestration flow |
| `load-tracker.test.js` | 18 | Concurrency limits and tracking |
| `device-registry.test.js` | 36 | Device discovery and health checks |
| `tools.test.js` | 32 | MCP tool handler functionality |
| `rating-analyzer.test.js` | 24 | Rating statistics calculation |
| `evolution-engine.test.js` | 22 | Mutation generation and application |
| `usage-tracker.test.js` | 31 | Usage pattern tracking |
| `swarm-guardrails.test.js` | 18 | Guardrail enforcement and memory checks (new) |
| `research-swarm.test.js` | 24 | Full orchestration flow with lightweight models (new) |

**Total: 374 tests**

---

## Testing Patterns

### Service Testing Pattern

Services use a consistent testing pattern:

```javascript
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';

describe('service-name', () => {
  let serviceInstance;

  beforeEach(() => {
    // Reset or initialize service before each test
    serviceInstance = new ServiceClass();
  });

  it('should perform main operation', async () => {
    const result = await serviceInstance.performOperation({ param: 'value' });
    
    assert.strictEqual(result.success, true);
    assert.ok(result.data.includes('expected'));
  });

  it('should handle errors gracefully', async () => {
    // Set up error condition
    const mockError = new Error('Test error');
    
    const result = await serviceInstance.performOperation({ param: 'value' });
    
    assert.strictEqual(result.isError, true);
    assert.ok(result.content.includes(mockError.message));
  });
});
```

### Tool Testing Pattern

Tools are tested by directly invoking the handler:

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { myNewTool, handleMyNewTool } from '../src/tools/my-new-tool.js';

describe('my-new-tool', () => {
  it('should execute tool with valid parameters', async () => {
    const result = await handleMyNewTool({
      requiredParam: 'test-data',
      optionalParam: 75,
    });

    assert.strictEqual(result.content.length, 1);
    const content = JSON.parse(result.content[0].text);
    
    assert.strictEqual(content.success, true);
    assert.strictEqual(content.requiredParam, 'test-data');
  });
});
```

### DNA Testing Pattern

DNA tests validate schema, inheritance, and migrations:

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  loadModelDNA,
  createDNAFile,
  mergeDNALevels,
} from '../src/utils/model-dna-manager.js';

describe('dna', () => {
  it('should validate DNA against schema', async () => {
    const dna = await createDNAFile({
      version: 3,
      primaryRole: 'conversationalist',
      models: { ... },
    });

    assert.strictEqual(dna.success, true);
    assert.ok(dna.config.models.conversationalist);
  });
});
```

---

## Mocking External Dependencies

### Mock LM Studio API

```javascript
// In test setup
vi.mock('../services/lm-studio-switcher.js', () => ({
  lmStudioSwitcher: {
    getAvailableModels: vi.fn().mockResolvedValue([{
      id: 'test-model',
      name: 'Test Model',
      metadata: { tailscale_node_id: 'abc123' },
    }]),
    loadModel: vi.fn().mockResolvedValue({ success: true }),
    unloadModel: vi.fn().mockResolvedValue({ success: true }),
  },
}));
```

### Mock Service Dependencies

```javascript
// In test setup
vi.mock('../services/another-service.js', () => ({
  anotherService: {
    getParentData: vi.fn().mockResolvedValue({ data: 'parent' }),
  },
}));
```

---

## Testing Best Practices

1. **Test Isolation:** Use `beforeEach` to reset state for each test
2. **Mock Dependencies:** Mock external APIs (LM Studio, device registry)
3. **Error Cases:** Include tests for error handling paths
4. **Integration Tests:** Test full workflows across multiple components
5. **Coverage:** Aim for high coverage of utility functions and service methods

---

## CI/CD Integration

### Example GitHub Actions Workflow

```yaml
name: Node.js CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run tests
        run: npm test
        
      - name: Upload coverage reports
        uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/
```

---

## Test-Driven Development

### TDD Workflow

1. **Write Test First:** Create test file before implementing feature
2. **Run Failing Test:** Verify test fails as expected
3. **Implement Feature:** Add implementation code to pass the test
4. **Refactor:** Improve code while keeping tests passing
5. **Document:** Update documentation with new patterns

---

## Troubleshooting Common Issues

### Issue: Tests fail due to DNA not initialized

**Solution:** Ensure `createDNAFile()` is called in `beforeEach` or mock DNA:

```javascript
vi.mock('../utils/model-dna-manager.js', () => ({
  loadModelDNA: vi.fn().mockResolvedValue({ version: 3, models: { ... } }),
}));
```

### Issue: Device registry tests fail

**Solution:** Mock device discovery and health check calls:

```javascript
vi.mock('./device-registry.js', () => ({
  deviceRegistry: {
    getAllDevices: vi.fn().mockReturnValue([{ id: 'test-device' }]),
    isDeviceAvailable: vi.fn().mockReturnValue(true),
  },
}));
```

### Issue: Orchestration tests timeout

**Solution:** Adjust timeouts and mock async operations:

```javascript
it('should complete orchestration', { timeout: 10000 }, async () => {
  // Test implementation
});
```

---

## Next Steps

After setting up testing:
1. Add test coverage reporting (nyc/c8)
2. Set up CI/CD pipeline for automated testing
3. Create test fixtures for common scenarios