import express from 'express';
import { z } from 'zod';

export function createApp(dependencies = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));
  app.get('/health', (_request, response) => response.json({ status: 'ok', service: 'image-relevance' }));
  if (dependencies.routes) app.use(dependencies.routes);
  app.use((_request, response) => response.status(404).json({ error: 'Resource not found' }));
  app.use((error, _request, response, _next) => {
    const status = error instanceof z.ZodError ? 400 : error.status >= 400 && error.status < 500 ? error.status : 500;
    response.status(status).json({ error: status === 500 ? 'Internal server error' : error instanceof z.ZodError ? 'Invalid request' : error.message });
  });
  return app;
}
