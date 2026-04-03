# Adding New Services - Developer Guide

**Last Updated:** April 3, 2026  
**Purpose:** Step-by-step guide for adding new services to the MCP Local Helper

---

## Overview

Services are the business logic layer of MCP Local Helper. They encapsulate complex operations and coordinate between multiple utilities.

### Service Categories
1. **Orchestrator Services** - Coordinate workflows across devices (e.g., orchestrator)
2. **Registry Services** - Track and manage resources (e.g., device-registry, load-tracker)
3. **Processor Services** - Transform data or execute operations (e.g., rating-analyzer)

---

## File Structure

```
src/services/
├── service-name.js       # Main service module
└── [existing services...] # See existing patterns for reference
```

### Required Components per Service
- Service class with initialize/shutdown methods
- Exported singleton instance
- Exported initialization function
- Test file in `tests/` directory

---

## Step-by-Step Implementation

### Step 1: Create the Service File

**File:** `src/services/my-service.js`

```javascript
/**
 * My Service - Business logic for [purpose]
 */

import { someUtility } from '../utils/some-utility.js';
import { anotherService } from './another-service.js';

// Configuration constants
const DEFAULT_CONFIG = {
  timeoutMs: parseInt(process.env.MY_SERVICE_TIMEOUT_MS || '60000'),
  maxRetries: parseInt(process.env.MY_SERVICE_MAX_RETRIES || '3'),
};

/**
 * MyService Class
 * Manages [service purpose] operations
 */
export class MyService {
  constructor() {
    // Configuration (from env vars or defaults)
    this.config = { ...DEFAULT_CONFIG };
    
    // State management
    this.state = {
      initialized: false,
      activeOperations: new Set(),
      cache: new Map(),
    };
    
    // Dependencies (dependency injection pattern)
    this.utility = someUtility;
    this.anotherService = anotherService;
  }

  /**
   * Initialize the service (start background tasks, connect to APIs, etc.)
   */
  async initialize() {
    console.log('[MyService] Initializing...');
    
    // Load initial configuration
    await this.loadConfiguration();
    
    // Connect to external systems if needed
    await this.connectToExternalSystems();
    
    // Start any background processes
    this.startBackgroundProcesses();
    
    this.state.initialized = true;
    
    console.log(`[MyService] Initialized with ${this.getStats()} stats`);
  }

  /**
   * Shutdown the service (cleanup resources, cancel pending operations)
   */
  shutdown() {
    console.log('[MyService] Shutting down...');
    
    // Cancel background processes
    if (this.backgroundInterval) {
      clearInterval(this.backgroundInterval);
    }
    
    // Close connections
    this.disconnectFromExternalSystems();
    
    // Clear state
    this.state.activeOperations.clear();
    this.state.cache.clear();
    
    console.log('[MyService] Shutdown complete');
  }

  /**
   * Main operation method
   * @param {Object} params - Operation parameters
   * @returns {Promise<Object>} Result object
   */
  async performOperation(params) {
    if (!this.state.initialized) {
      await this.initialize();
    }
    
    const { requiredParam, optionalParam } = params;
    
    // Validate inputs
    if (!requiredParam) {
      throw new Error('requiredParam is required');
    }
    
    // Check cache first (fast path)
    const cached = this.state.cache.get(requiredParam);
    if (cached) {
      return cached;
    }
    
    // Execute operation
    this.state.activeOperations.add(requiredParam);
    
    try {
      const result = await this.utility.processData(
        requiredParam,
        optionalParam || this.config.defaultOption
      );
      
      // Update cache
      this.state.cache.set(requiredParam, result);
      
      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`[MyService] Operation failed: ${error.message}`);
      throw error;
    } finally {
      this.state.activeOperations.delete(requiredParam);
    }
  }

  /**
   * Get service statistics
   * @returns {Object} Stats object
   */
  getStats() {
    return {
      initialized: this.state.initialized,
      activeOperations: this.state.activeOperations.size,
      cacheSize: this.state.cache.size,
      config: this.config,
    };
  }

  /**
   * Load configuration from environment variables
   */
  async loadConfiguration() {
    // Read and merge env vars with defaults
    const envConfig = {
      timeoutMs: parseInt(process.env.MY_SERVICE_TIMEOUT_MS || '60000'),
      maxRetries: parseInt(process.env.MY_SERVICE_MAX_RETRIES || '3'),
    };
    
    this.config = { ...this.config, ...envConfig };
  }

  /**
   * Connect to external systems
   */
  async connectToExternalSystems() {
    // Example: Connect to API, database, etc.
    console.log('[MyService] Connecting to external systems...');
  }

  /**
   * Disconnect from external systems
   */
  disconnectFromExternalSystems() {
    console.log('[MyService] Disconnecting from external systems...');
  }

  /**
   * Start background processes (intervals, event listeners)
   */
  startBackgroundProcesses() {
    // Example: Periodic health check
    this.backgroundInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckIntervalMs || 30000);
  }

  /**
   * Perform periodic health check
   */
  async performHealthCheck() {
    console.log('[MyService] Health check running...');
    
    // Check external systems, cache health, etc.
    const isHealthy = true; // Replace with actual checks
    
    if (!isHealthy) {
      console.warn('[MyService] Service health degraded');
    }
  }

  /**
   * Get current state
   */
  getState() {
    return this.state;
  }
}

// Export singleton instance
export const myService = new MyService();

/**
 * Initialize service on module load (optional auto-initialization)
 * @returns {Promise<MyService>} Initialized service
 */
export async function initializeMyService() {
  if (!myService.state.initialized) {
    await myService.initialize();
  }
  return myService;
}

// For testing: reset singleton state
export function resetService() {
  myService.shutdown();
}
```

---

### Step 2: Import and Use the Service

**File:** `src/server.js` or wherever service is used

```javascript
import { myService } from './services/my-service.js';

// Use in tool handlers
async function handleSomeTool(params) {
  const result = await myService.performOperation({
    requiredParam: params.data,
    optionalParam: params.option,
  });
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify(result, null, 2),
    }],
  };
}
```

---

### Step 3: Add Tests

**File:** `tests/my-service.test.js`

```javascript
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { myService, resetService } from '../src/services/my-service.js';

describe('my-service', () => {
  let mockUtility;

  beforeEach(() => {
    // Reset service state before each test
    resetService();
    
    // Mock utility for testing
    mockUtility = {
      processData: async (requiredParam, optionalParam) => ({
        id: requiredParam,
        option: optionalParam,
        processedAt: new Date().toISOString(),
      }),
    };
    
    vi.mock('../utils/some-utility.js', () => ({
      someUtility: mockUtility,
    }));
  });

  it('should initialize service successfully', async () => {
    await myService.initialize();
    
    assert.strictEqual(myService.state.initialized, true);
    assert.ok(myService.getStats().activeOperations === 0);
  });

  it('should perform operation with valid parameters', async () => {
    const result = await myService.performOperation({
      requiredParam: 'test-data',
      optionalParam: 42,
    });
    
    assert.strictEqual(result.success, true);
    assert.ok(result.data.id.includes('test'));
    assert.strictEqual(result.data.option, 42);
  });

  it('should use default option when not provided', async () => {
    const result = await myService.performOperation({
      requiredParam: 'test',
    });
    
    assert.strictEqual(result.data.option, 
      myService.config.defaultOption || 50); // Adjust based on actual default
  });

  it('should cache results for repeated operations', async () => {
    const firstResult = await myService.performOperation({
      requiredParam: 'cached-data',
    });
    
    const secondResult = await myService.performOperation({
      requiredParam: 'cached-data',
    });
    
    assert.deepStrictEqual(firstResult, secondResult);
  });

  it('should shutdown gracefully', () => {
    myService.shutdown();
    
    // Verify state is cleared
    assert.strictEqual(myService.state.activeOperations.size, 0);
    assert.strictEqual(myService.state.cache.size, 0);
  });
});
```

---

## Service Pattern Reference

### Initialization Pattern
```javascript
export class ServiceClass {
  constructor() { /* initialize state */ }
  
  async initialize() { /* start services */ }
  
  shutdown() { /* cleanup resources */ }
}

// Singleton instance
export const serviceInstance = new ServiceClass();

// Auto-initialization (optional)
export async function initializeService() {
  if (!serviceInstance.state.initialized) {
    await serviceInstance.initialize();
  }
  return serviceInstance;
}
```

### Dependency Injection Pattern
```javascript
export class ServiceClass {
  constructor({ utility, anotherService } = {}) {
    this.utility = utility || someUtility;
    this.anotherService = anotherService || otherService;
  }
}

// Allows easy mocking in tests
const mockService = new ServiceClass({
  utility: mockUtility,
  anotherService: mockAnotherService,
});
```

---

## Service Registration Checklist

When creating a service, ensure:

- [ ] Class has `initialize()` and `shutdown()` methods
- [ ] Exported singleton instance for easy access
- [ ] Configuration supports environment variables
- [ ] Error handling with descriptive logging
- [ ] Cache or state management where applicable
- [ ] Tests cover initialization, operation, and shutdown

---

## Integration Patterns

### Pattern 1: Service Chain
Services that depend on other services:
```javascript
export class DependentService {
  constructor({ parentService } = {}) {
    this.parentService = parentService;
  }
  
  async execute() {
    const parentData = await this.parentService.getParentData();
    return this.processWithParent(parentData);
  }
}
```

### Pattern 2: Event Emitter Service
Services that emit events:
```javascript
export class EventEmitterService extends EventEmitter {
  constructor() {
    super();
    this.state = {};
  }
  
  updateState(data) {
    this.state = { ...this.state, ...data };
    this.emit('state-changed', data);
  }
}
```

### Pattern 3: Background Worker Service
Services with periodic tasks:
```javascript
export class BackgroundWorkerService {
  constructor() {
    this.workers = [];
  }
  
  startBackgroundTasks() {
    this.workers.push(setInterval(() => {
      this.processPendingItems();
    }, this.config.workerInterval));
  }
}
```

---

## Best Practices

1. **State Management**: Use a dedicated `state` object for all mutable data
2. **Configuration**: Support environment variables with sensible defaults
3. **Error Handling**: Log errors with service-specific prefixes (e.g., `[MyService]`)
4. **Testing**: Export a `reset()` function for test isolation
5. **Documentation**: Include description in JSDoc comments

---

## Next Steps

After creating your service, consider:

1. Adding to architecture documentation (`docs/architecture/`)
2. Updating this guide if new patterns emerge
3. Creating integration examples with other services