import { resolve } from 'node:path';

export const config = {
  adminPort: parseInt(process.env.ADMIN_PORT || '3000', 10),
  templatesDir: resolve(process.env.TEMPLATES_DIR || './templates'),
  simulationsDir: resolve(process.env.SIMULATIONS_DIR || './simulations'),
  simulationsFile: resolve(process.env.SIMULATIONS_DIR || './simulations', 'simulations.json'),
  maxLogsPerSimulation: parseInt(process.env.MAX_LOGS || '1000', 10),
  logLevel: process.env.LOG_LEVEL || 'info',
};
