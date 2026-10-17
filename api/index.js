import graph from '../frontend/public/data/graph.json' with { type: 'json' };
import { createApp } from '../backend/app.js';
import { createServerlessStorage } from '../backend/services/serverless-storage.js';

let application;

function getApplication() {
  if (!application) {
    application = createApp({
      graph,
      storage: createServerlessStorage(),
      staticDir: false,
    }).catch((error) => {
      application = undefined;
      throw error;
    });
  }
  return application;
}

export default async function handler(request, response) {
  try {
    const app = await getApplication();
    return app(request, response);
  } catch (error) {
    console.error('Back Track API initialization:', error.message);
    response.statusCode = 503;
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Cache-Control', 'no-store');
    response.end(JSON.stringify({
      error: 'The music service is starting up. Please try again.',
      code: 'SERVICE_UNAVAILABLE',
    }));
  }
}
