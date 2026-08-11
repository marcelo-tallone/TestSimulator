import express from 'express';
import type { Server } from 'node:http';
import { SimulationConfig } from '../../models/simulation.js';
import { createWsHandler } from './ws-handler.js';
import { logger } from '../../utils/logger.js';

const servers = new Map<string, Server>();

export function startWsSimulation(sim: SimulationConfig): Promise<void> {
  const ws = sim.ws;
  if (!ws) throw new Error('Simulation is missing ws config');
  if (servers.has(sim.id)) return Promise.resolve();

  const app = express();
  app.use(express.text({ type: '*/*', limit: '10mb' }));

  const handler = createWsHandler(sim);
  const method = ws.method.toLowerCase();

  if (ws.method === 'ANY') {
    app.all(ws.path, handler);
  } else {
    (app as unknown as Record<string, (path: string, h: typeof handler) => void>)[method](ws.path, handler);
  }

  return new Promise<void>((resolve, reject) => {
    const server = app.listen(ws.port, () => {
      servers.set(sim.id, server);
      logger.info(`[${sim.name}] WS listening on http://localhost:${ws.port}${ws.path} [${ws.method}]`);
      resolve();
    });
    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${ws.port} is already in use`));
      } else {
        reject(err);
      }
    });
  });
}

export function stopWsSimulation(id: string): Promise<void> {
  const server = servers.get(id);
  if (!server) return Promise.resolve();

  return new Promise<void>(resolve => {
    server.close(() => {
      servers.delete(id);
      resolve();
    });
  });
}

export function isWsRunning(id: string): boolean {
  return servers.has(id);
}
