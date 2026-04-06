import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Save and restore env vars
const origEnv = { ...process.env };

beforeEach(() => {
  process.env.VERTEX_AI_PROJECT = 'test-project';
  process.env.VERTEX_AI_LOCATION = 'us-central1';
});

afterEach(() => {
  process.env = { ...origEnv };
  vi.restoreAllMocks();
});

// We test via proxyquire to mock the @google-cloud/aiplatform SDK
const proxyquire = require('proxyquire').noCallThru();

function loadModule(mocks = {}) {
  const defaultMocks = {
    '@google-cloud/aiplatform': {
      PredictionServiceClient: mocks.PredictionServiceClient || class {
        predict() { throw new Error('predict not mocked'); }
        listEndpoints() { throw new Error('listEndpoints not mocked'); }
      },
      JobServiceClient: mocks.JobServiceClient || class {
        createBatchPredictionJob() { throw new Error('createBatchPredictionJob not mocked'); }
      },
      helpers: {
        toValue: v => v,
        fromValue: v => v,
      },
    },
  };
  // Clear module from require cache to get a fresh instance
  delete require.cache[require.resolve('./vertexai')];
  return proxyquire('./vertexai', defaultMocks);
}

// ── predict() ────────────────────────────────────────────────────────────────

describe('predict()', () => {
  it('returns predictions from Vertex AI endpoint', async () => {
    const mod = loadModule({
      PredictionServiceClient: class {
        predict() {
          return [{ predictions: [{ pattern: 'optimal', confidence: 0.9 }] }];
        }
        listEndpoints() { return [[]]; }
      },
    });

    const result = await mod.predict('endpoint-123', [{ species: 'Monstera' }]);
    expect(result).toEqual([{ pattern: 'optimal', confidence: 0.9 }]);
  });

  it('throws when VERTEX_AI_PROJECT is not set', async () => {
    delete process.env.VERTEX_AI_PROJECT;
    const mod = loadModule();
    await expect(mod.predict('ep-1', [{}])).rejects.toThrow('VERTEX_AI_PROJECT is not configured');
  });

  it('throws when endpointId is empty', async () => {
    const mod = loadModule();
    await expect(mod.predict('', [{}])).rejects.toThrow('endpointId is required');
  });

  it('throws when instances is empty array', async () => {
    const mod = loadModule();
    await expect(mod.predict('ep-1', [])).rejects.toThrow('instances must be a non-empty array');
  });

  it('throws when instances is not an array', async () => {
    const mod = loadModule();
    await expect(mod.predict('ep-1', 'bad')).rejects.toThrow('instances must be a non-empty array');
  });

  it('retries on UNAVAILABLE (code 14) errors', async () => {
    let callCount = 0;
    const mod = loadModule({
      PredictionServiceClient: class {
        predict() {
          callCount++;
          if (callCount < 3) {
            const err = new Error('Service unavailable');
            err.code = 14;
            throw err;
          }
          return [{ predictions: [{ result: 'ok' }] }];
        }
        listEndpoints() { return [[]]; }
      },
    });

    const result = await mod.predict('ep-1', [{ x: 1 }]);
    expect(result).toEqual([{ result: 'ok' }]);
    expect(callCount).toBe(3);
  });

  it('retries on RESOURCE_EXHAUSTED (code 8) errors', async () => {
    let callCount = 0;
    const mod = loadModule({
      PredictionServiceClient: class {
        predict() {
          callCount++;
          if (callCount === 1) {
            const err = new Error('Quota exceeded');
            err.code = 8;
            throw err;
          }
          return [{ predictions: [{ ok: true }] }];
        }
        listEndpoints() { return [[]]; }
      },
    });

    const result = await mod.predict('ep-1', [{ x: 1 }]);
    expect(result).toEqual([{ ok: true }]);
    expect(callCount).toBe(2);
  });

  it('does not retry on non-retryable errors', async () => {
    let callCount = 0;
    const mod = loadModule({
      PredictionServiceClient: class {
        predict() {
          callCount++;
          const err = new Error('Permission denied');
          err.code = 7;
          throw err;
        }
        listEndpoints() { return [[]]; }
      },
    });

    await expect(mod.predict('ep-1', [{ x: 1 }])).rejects.toThrow('Vertex AI prediction failed: Permission denied');
    expect(callCount).toBe(1);
  });

  it('fails after max retries exhausted', async () => {
    let callCount = 0;
    const mod = loadModule({
      PredictionServiceClient: class {
        predict() {
          callCount++;
          const err = new Error('Service unavailable');
          err.code = 14;
          throw err;
        }
        listEndpoints() { return [[]]; }
      },
    });

    await expect(mod.predict('ep-1', [{ x: 1 }])).rejects.toThrow('Vertex AI prediction failed');
    expect(callCount).toBe(3); // initial + 2 retries
  });

  it('returns empty array when predictions is empty', async () => {
    const mod = loadModule({
      PredictionServiceClient: class {
        predict() { return [{ predictions: [] }]; }
        listEndpoints() { return [[]]; }
      },
    });

    const result = await mod.predict('ep-1', [{ x: 1 }]);
    expect(result).toEqual([]);
  });
});

// ── batchPredict() ───────────────────────────────────────────────────────────

describe('batchPredict()', () => {
  it('creates a batch prediction job', async () => {
    const mod = loadModule({
      JobServiceClient: class {
        createBatchPredictionJob() {
          return [{ name: 'projects/test/jobs/123', displayName: 'test-job', state: 'RUNNING', createTime: '2026-01-01' }];
        }
      },
    });

    const result = await mod.batchPredict({
      modelId: 'model-1',
      inputUri: 'gs://bucket/input.jsonl',
      outputUri: 'gs://bucket/output/',
    });

    expect(result.name).toBe('projects/test/jobs/123');
    expect(result.state).toBe('RUNNING');
  });

  it('throws when VERTEX_AI_PROJECT is not set', async () => {
    delete process.env.VERTEX_AI_PROJECT;
    const mod = loadModule();
    await expect(mod.batchPredict({ modelId: 'm', inputUri: 'gs://a', outputUri: 'gs://b' }))
      .rejects.toThrow('VERTEX_AI_PROJECT is not configured');
  });

  it('throws when modelId is missing', async () => {
    const mod = loadModule();
    await expect(mod.batchPredict({ inputUri: 'gs://a', outputUri: 'gs://b' }))
      .rejects.toThrow('jobConfig.modelId is required');
  });

  it('throws when inputUri is missing', async () => {
    const mod = loadModule();
    await expect(mod.batchPredict({ modelId: 'm', outputUri: 'gs://b' }))
      .rejects.toThrow('jobConfig.inputUri is required');
  });

  it('throws when outputUri is missing', async () => {
    const mod = loadModule();
    await expect(mod.batchPredict({ modelId: 'm', inputUri: 'gs://a' }))
      .rejects.toThrow('jobConfig.outputUri is required');
  });
});

// ── checkStatus() ────────────────────────────────────────────────────────────

describe('checkStatus()', () => {
  it('returns ok status when Vertex AI is reachable', async () => {
    const mod = loadModule({
      PredictionServiceClient: class {
        predict() { return [{}]; }
        listEndpoints({ pageSize }) {
          expect(pageSize).toBe(1);
          return [[{ name: 'endpoint-1' }]];
        }
      },
    });

    const result = await mod.checkStatus();
    expect(result).toEqual({
      status: 'ok',
      project: 'test-project',
      location: 'us-central1',
      endpointCount: 1,
    });
  });

  it('returns unconfigured when VERTEX_AI_PROJECT is not set', async () => {
    delete process.env.VERTEX_AI_PROJECT;
    const mod = loadModule();

    const result = await mod.checkStatus();
    expect(result.status).toBe('unconfigured');
    expect(result.error).toContain('VERTEX_AI_PROJECT');
  });

  it('returns error status when Vertex AI is unreachable', async () => {
    const mod = loadModule({
      PredictionServiceClient: class {
        predict() { return [{}]; }
        listEndpoints() { throw new Error('Network error'); }
      },
    });

    const result = await mod.checkStatus();
    expect(result.status).toBe('error');
    expect(result.error).toBe('Network error');
    expect(result.project).toBe('test-project');
  });
});
