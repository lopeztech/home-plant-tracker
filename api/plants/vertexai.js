'use strict';

const { PredictionServiceClient, helpers } = require('@google-cloud/aiplatform');

const PROJECT = process.env.VERTEX_AI_PROJECT;
const LOCATION = process.env.VERTEX_AI_LOCATION || 'us-central1';

let client;

function getClient() {
  if (!client) {
    client = new PredictionServiceClient({
      apiEndpoint: `${LOCATION}-aiplatform.googleapis.com`,
    });
  }
  return client;
}

/**
 * Send an online prediction request to a Vertex AI endpoint.
 * @param {string} endpointId - The Vertex AI endpoint ID.
 * @param {object[]} instances - Array of instance objects for prediction.
 * @returns {Promise<object[]>} Array of prediction result objects.
 */
async function predict(endpointId, instances) {
  if (!PROJECT) throw new Error('VERTEX_AI_PROJECT is not configured');
  if (!endpointId) throw new Error('endpointId is required');
  if (!Array.isArray(instances) || instances.length === 0) {
    throw new Error('instances must be a non-empty array');
  }

  const endpoint = `projects/${PROJECT}/locations/${LOCATION}/endpoints/${endpointId}`;
  const instanceValues = instances.map(i => helpers.toValue(i));

  const maxRetries = 2;
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const [response] = await getClient().predict({ endpoint, instances: instanceValues });
      return (response.predictions || []).map(p => helpers.fromValue(p));
    } catch (err) {
      lastErr = err;
      const code = err.code || 0;
      // Retry on UNAVAILABLE (14), RESOURCE_EXHAUSTED (8), DEADLINE_EXCEEDED (4)
      const retryable = [4, 8, 14].includes(code);
      if (!retryable || attempt === maxRetries) break;
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  const error = new Error(`Vertex AI prediction failed: ${lastErr.message}`);
  error.code = lastErr.code;
  throw error;
}

/**
 * Submit a batch prediction job.
 * @param {object} jobConfig - Batch prediction job configuration.
 * @param {string} jobConfig.modelId - Model resource ID.
 * @param {string} jobConfig.inputUri - GCS URI for input data (e.g. gs://bucket/input.jsonl).
 * @param {string} jobConfig.outputUri - GCS URI prefix for output (e.g. gs://bucket/output/).
 * @param {string} [jobConfig.displayName] - Human-readable job name.
 * @returns {Promise<object>} The created batch prediction job.
 */
async function batchPredict(jobConfig) {
  if (!PROJECT) throw new Error('VERTEX_AI_PROJECT is not configured');
  if (!jobConfig || !jobConfig.modelId) throw new Error('jobConfig.modelId is required');
  if (!jobConfig.inputUri) throw new Error('jobConfig.inputUri is required');
  if (!jobConfig.outputUri) throw new Error('jobConfig.outputUri is required');

  const { JobServiceClient } = require('@google-cloud/aiplatform');
  const jobClient = new JobServiceClient({
    apiEndpoint: `${LOCATION}-aiplatform.googleapis.com`,
  });

  const parent = `projects/${PROJECT}/locations/${LOCATION}`;
  const model = `projects/${PROJECT}/locations/${LOCATION}/models/${jobConfig.modelId}`;

  const [job] = await jobClient.createBatchPredictionJob({
    parent,
    batchPredictionJob: {
      displayName: jobConfig.displayName || `batch-predict-${Date.now()}`,
      model,
      inputConfig: {
        instancesFormat: 'jsonl',
        gcsSource: { uris: [jobConfig.inputUri] },
      },
      outputConfig: {
        predictionsFormat: 'jsonl',
        gcsDestination: { outputUriPrefix: jobConfig.outputUri },
      },
    },
  });

  return {
    name: job.name,
    displayName: job.displayName,
    state: job.state,
    createTime: job.createTime,
  };
}

/**
 * Check Vertex AI connectivity by listing endpoints.
 * @returns {Promise<object>} Status object with project, location, and reachability info.
 */
async function checkStatus() {
  if (!PROJECT) {
    return { status: 'unconfigured', project: null, location: LOCATION, error: 'VERTEX_AI_PROJECT is not set' };
  }

  try {
    const parent = `projects/${PROJECT}/locations/${LOCATION}`;
    const [endpoints] = await getClient().listEndpoints({ parent, pageSize: 1 });
    return {
      status: 'ok',
      project: PROJECT,
      location: LOCATION,
      endpointCount: Array.isArray(endpoints) ? endpoints.length : 0,
    };
  } catch (err) {
    return {
      status: 'error',
      project: PROJECT,
      location: LOCATION,
      error: err.message,
    };
  }
}

// Allow replacing the client for testing
function _setClient(mockClient) {
  client = mockClient;
}

module.exports = { predict, batchPredict, checkStatus, _setClient };
