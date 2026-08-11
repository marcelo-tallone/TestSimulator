import express from 'express';
import cors from 'cors';
import type { Server } from 'node:http';
import { fileURLToPath } from 'node:url';
import { router } from './admin-routes.js';
import { config } from '../config/app-config.js';
import { logger } from '../utils/logger.js';

// Dashboard static files live at <project>/public (dist/admin -> ../../public).
const publicDir = fileURLToPath(new URL('../../public', import.meta.url));

export function startAdminServer(): Promise<Server> {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.text({ type: ['text/*', 'application/xml'], limit: '10mb' }));
  app.use('/api', router);
  app.use(express.static(publicDir));

  return new Promise<Server>((resolve, reject) => {
    const server = app.listen(config.adminPort, () => {
      logger.info(`Admin API listening on http://localhost:${config.adminPort}/api`);
      logger.info(`Dashboard available on http://localhost:${config.adminPort}/`);
      resolve(server);
    });
    server.on('error', reject);
  });
}
