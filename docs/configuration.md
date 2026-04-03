# Configuration Reference - MCP Local Helper

**Last Updated:** April 3, 2026  
**Purpose:** Comprehensive configuration guide for the MCP Local Helper project

---

## Configuration Sources

Configuration is sourced from three levels (in order of priority):

```
1. Environment Variables (highest priority)
   ↓
2. .model-user.json (user-level overrides)
   ↓
3. .model-dna.json (project-level config)
   ↓
4. defaults.js (baseline configuration)
```

---

## Environment Variables

### LM Studio Connection

| Variable | Default | Description |
|----------|---------|-------------|
| `LM_STUDIO_URL` | http://localhost:1234 | LM Studio API base URL |
| `LM_STUDIO_API_KEY` | - | Optional API key for authentication |

### Concurrency and Load Management

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_PARALLEL_REQUESTS_GLOBAL` | 4 | Max concurrent requests on local device |
| `DEFAULT_DEVICE_CONCURRENT_LIMIT` | 2 | Max concurrent requests on remote devices |
| `DEVICE_COOLDOWN_MS` | 1000ms | Cooldown period after request completion |

### Timing Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_RETRIES` | 3 | Maximum retry attempts for failed requests |
| `RETRY_DELAY` | 1000ms | Base delay between retries (exponential) |
| `REQUEST_TIMEOUT` | 60000ms | Timeout per HTTP request |
| `HEALTH_CHECK_INTERVAL` | 30000ms | Interval between health checks |

### Device Discovery

| Variable | Default | Description |
|----------|---------|-------------|
| `DEVICE_DISCOVERY_INTERVAL_MS` | 30000ms | How often to scan for new devices |
| `REMOTE_DEVICE_TIMEOUT_MS` | 60000ms | Timeout for device operations |

---

## DNA Configuration

### Basic Structure

```json
{
  "version": 3,
  "primaryRole": "conversationalist",
  "models": { ... },
  "taskModelMapping": { ... },
  "memories": { ... },
  "usageStats": { ... },
  "orchestratorConfig": { ... }
}
```

### Full DNA Schema

```json
{
  "version": 3,
  "primaryRole": "conversationalist",
  
  "models": {
    "conversationalist": {
      "purpose": "general conversation and chat",
      "usageCount": 0,
      "rating": null,
      "createdAt": "2026-01-01T00:00:00.000Z"
    },
    "ninja-researcher": {
      "purpose": "code fixes and debugging solutions",
      "usageCount": 0,
      "rating": null
    },
    "architect": {
      "purpose": "feature architecture and design patterns",
      "usageCount": 0,
      "rating": null
    },
    "executor": {
      "purpose": "code execution, writing, and editing",
      "usageCount": 0,
      "rating": null
    },
    "researcher": {
      "purpose": "general research and information gathering",
      "usageCount": 0,
      "rating": null
    },
    "vision": {
      "purpose": "image analysis and visual content understanding",
      "usageCount": 0,
      "rating": null
    }
  },
  
  "taskModelMapping": {
    "codeFixes": "ninja-researcher",
    "featureArchitecture": "architect",
    "codeExecution": "executor",
    "generalResearch": "researcher",
    "imageAnalysis": "vision"
  },
  
  "memories": {
    "responseLengthPreference": {
      "value": "concise",
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  },
  
  "usageStats": {
    "tasksCompleted": {
      "codeFixes": 42,
      "generalResearch": 35
    },
    "modelEffectiveness": {
      "ninja-researcher": {
        "codeFixes": [
          { "rating": 4, "feedback": "Good debugging suggestions", "timestamp": "..." }
        ]
      }
    }
  },
  
  "mcpIntegrations": {
    "webSearch": true,
    "context7": true,
    "docProcessor": true
  },
  
  "hardwareProfile": {
    "minRamForParallel": 64,
    "recommendedRam": 256,
    "maxParallelModels": 3
  },
  
  "fallbackStrategy": {
    "autoFallback": true,
    "ratingThreshold": 3.0,
    "maxAttempts": 3
  }
}
```

---

## Orchestrator Configuration

```json
{
  "orchestratorConfig": {
    "enabled": true,
    "maxSubtasks": 5,
    "timeoutMs": 60000,
    
    "swarm": {
      "enabled": true,
      "maxLightweightModelsPerDevice": 2,
      "subtaskMaxTokens": 4000,
      "finalAggregationMaxTokens": 8000,
      "minMemoryGB": 8,
      "fallbackEnabled": true
    },
    
    "swarmModelIds": [
      "qwen3.5-9b-omnicoder-claude-polaris-text-dwq4-mlx",
      "meta-llama-3.2-9b-instruct"
    ]
  }
}
```

---

## Hardware Profile Configuration

```json
{
  "hardwareProfile": {
    "minRamForParallel": 64,
    "recommendedRam": 256,
    "maxParallelModels": 3,
    
    "modelLoadLimits": {
      "*": 3,
      "device-local": 2,
      "device-abc123": 4
    }
  }
}
```

### Hardware-Based Recommendations

| RAM | Max Models | Max Parallel Models |
|-----|-----------|---------------------|
| < 8GB | 1 | 1 |
| 8-15GB | 1 | 1-2 |
| 16-31GB | 2 | 2-4 |
| 32GB+ | 4 | 4-8 |

---

## Fallback Strategy

```json
{
  "fallbackStrategy": {
    "autoFallback": true,
    "ratingThreshold": 3.0,
    "maxAttempts": 3,
    
    "perTaskType": {
      "codeFixes": {
        "ratingThreshold": 3.5,
        "maxAttempts": 4
      },
      "generalResearch": {
        "ratingThreshold": 3.0,
        "maxAttempts": 3
      }
    }
  }
}
```

---

## Memory Storage

Memories store persistent preferences that persist across model switches:

```json
{
  "memories": {
    "responseLengthPreference": {
      "value": "concise",
      "createdAt": "2026-01-01T00:00:00.000Z"
    },
    "preferredCodeStyle": {
      "value": "functional",
      "createdAt": "2026-01-02T00:00:00.000Z"
    }
  }
}
```

---

## Environment Variable Examples

### Development Setup

```bash
# LM Studio connection
export LM_STUDIO_URL=http://localhost:1234

# Concurrency limits (conservative)
export MAX_PARALLEL_REQUESTS_GLOBAL=2
export DEFAULT_DEVICE_CONCURRENT_LIMIT=2

# Timing
export DEVICE_COOLDOWN_MS=500
```

### Production Setup

```bash
# LM Studio connection
export LM_STUDIO_URL=http://localhost:1234

# Concurrency limits (aggressive)
export MAX_PARALLEL_REQUESTS_GLOBAL=8
export DEFAULT_DEVICE_CONCURRENT_LIMIT=4

# Timing
export DEVICE_COOLDOWN_MS=1000
export MAX_RETRIES=5
```

### Multi-Device Setup

```bash
# LM Studio connection
export LM_STUDIO_URL=http://localhost:1234

# Device limits (varies per device)
export MAX_MODELS_PER_DEVICE_LOCAL=4
export DEVICE_MAX_MODELS_abc1234567890=2

# Orchestrator
export ORCHESTRATOR_ENABLED=true
export MAX_SUBTASKS=8
```

---

## DNA File Locations

### Default Paths

| File | Location |
|------|----------|
| `.model-dna.json` | `<projectRoot>/.model-dna.json` |
| `.model-user.json` | `<userHome>/.model-user.json` |

### Custom Paths

Environment variables can override default locations:

```bash
# Override DNA file location
export MODEL_DNA_PATH=/custom/path/.model-dna.json
export USER_DNA_PATH=/custom/path/.model-user.json
```

---

## Configuration Validation

The system validates configuration on load:

1. **Schema validation** - Checks against defined schema
2. **Type validation** - Validates value types
3. **Range validation** - Checks numeric ranges
4. **Required field checks** - Ensures required fields exist

Errors are logged and the system gracefully handles missing or invalid configuration.

---

## Migration Strategy

DNA schema supports versioned migrations:

| Version | Changes |
|---------|---------|
| v1 | Initial schema with basic model definitions |
| v2 | Added taskModelMapping and usageStats |
| v3 | Enhanced with orchestratorConfig and memory storage |

Automatic migrations occur when loading older DNA versions.

---

## Troubleshooting Configuration

### Issue: Configuration not applied

**Check:** Environment variables override file-based configuration
**Solution:** Use `printenv` to verify env vars, or check `.model-user.json` for overrides

### Issue: Invalid JSON in DNA files

**Check:** Validate with `jq . <file>.json`
**Solution:** Fix syntax errors and ensure all commas are correct

### Issue: Defaults not loading

**Check:** Verify file paths exist at expected locations
**Solution:** Create missing DNA files or set environment variable overrides

---

## Best Practices

1. **Start with defaults** - Let system provide sensible defaults initially
2. **Use environment variables for secrets** - API keys, tokens in env vars
3. **Document custom configurations** - Keep notes on non-standard settings
4. **Version DNA files** - Include version number and update description
5. **Test changes incrementally** - Change one setting at a time, verify behavior

---

## Next Steps

After understanding configuration:
1. Set up environment variables for your deployment
2. Customize `.model-dna.json` with preferred settings
3. Monitor `usageStats` to understand actual usage patterns
4. Use evolution suggestions to auto-optimize over time