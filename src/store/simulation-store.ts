import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { SimulationConfig, CreateSimulationInput } from '../models/simulation.js';
import { RequestLog } from '../models/request-log.js';
import { config } from '../config/app-config.js';
import { logger } from '../utils/logger.js';

const simulations = new Map<string, SimulationConfig>();
const logs = new Map<string, RequestLog[]>();

function persist(): void {
  const dir = dirname(config.simulationsFile);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const data = Array.from(simulations.values()).map(s => ({
    ...s,
    status: 'stopped' as const,
  }));
  writeFileSync(config.simulationsFile, JSON.stringify(data, null, 2), 'utf-8');
}

export function loadSimulations(): SimulationConfig[] {
  if (!existsSync(config.simulationsFile)) return [];

  try {
    const raw = readFileSync(config.simulationsFile, 'utf-8');
    const data: SimulationConfig[] = JSON.parse(raw);
    for (const sim of data) {
      sim.status = 'stopped';
      simulations.set(sim.id, sim);
      logs.set(sim.id, []);
    }
    logger.info(`Loaded ${data.length} simulations from store`);
    return data;
  } catch (err) {
    logger.error(`Failed to load simulations file: ${String(err)}`);
    return [];
  }
}

export function getAllSimulations(): SimulationConfig[] {
  return Array.from(simulations.values());
}

export function getSimulation(id: string): SimulationConfig | undefined {
  return simulations.get(id);
}

export function createSimulation(input: CreateSimulationInput): SimulationConfig {
  const now = new Date().toISOString();
  const sim: SimulationConfig = {
    id: uuidv4(),
    name: input.name,
    type: input.type,
    status: 'stopped',
    createdAt: now,
    updatedAt: now,
    ws: input.ws,
    mq: input.mq,
    rules: (input.rules ?? []).map(r => ({
      ...r,
      id: r.id || uuidv4(),
    })),
    defaultResponse: input.defaultResponse,
  };

  simulations.set(sim.id, sim);
  logs.set(sim.id, []);
  persist();
  logger.info(`Created simulation: ${sim.name} (${sim.id})`);
  return sim;
}

export function updateSimulation(id: string, updates: Partial<CreateSimulationInput>): SimulationConfig | null {
  const sim = simulations.get(id);
  if (!sim) return null;

  if (updates.name !== undefined) sim.name = updates.name;
  if (updates.ws !== undefined) sim.ws = updates.ws;
  if (updates.mq !== undefined) sim.mq = updates.mq;
  if (updates.rules !== undefined) {
    sim.rules = updates.rules.map(r => ({
      ...r,
      id: r.id || uuidv4(),
    }));
  }
  if (updates.defaultResponse !== undefined) sim.defaultResponse = updates.defaultResponse;
  sim.updatedAt = new Date().toISOString();

  persist();
  return sim;
}

export function deleteSimulation(id: string): boolean {
  const sim = simulations.get(id);
  if (!sim) return false;
  if (sim.status === 'running') return false;

  simulations.delete(id);
  logs.delete(id);
  persist();
  logger.info(`Deleted simulation: ${sim.name} (${id})`);
  return true;
}

export function setSimulationStatus(id: string, status: SimulationConfig['status']): void {
  const sim = simulations.get(id);
  if (sim) {
    sim.status = status;
    sim.updatedAt = new Date().toISOString();
  }
}

export function addLog(simulationId: string, log: RequestLog): void {
  let simLogs = logs.get(simulationId);
  if (!simLogs) {
    simLogs = [];
    logs.set(simulationId, simLogs);
  }
  simLogs.push(log);
  if (simLogs.length > config.maxLogsPerSimulation) {
    simLogs.splice(0, simLogs.length - config.maxLogsPerSimulation);
  }
}

export function getLogs(simulationId: string, limit?: number): RequestLog[] {
  const simLogs = logs.get(simulationId) ?? [];
  if (limit) return simLogs.slice(-limit);
  return simLogs;
}

export function getAllLogs(limit?: number): RequestLog[] {
  const all: RequestLog[] = [];
  for (const simLogs of logs.values()) {
    all.push(...simLogs);
  }
  all.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  if (limit) return all.slice(-limit);
  return all;
}

export function clearLogs(simulationId: string): void {
  logs.set(simulationId, []);
}
