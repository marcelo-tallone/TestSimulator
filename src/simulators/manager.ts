import { SimulationConfig } from '../models/simulation.js';
import { setSimulationStatus } from '../store/simulation-store.js';
import { startWsSimulation, stopWsSimulation } from './ws/ws-simulator.js';
import { startMqSimulation, stopMqSimulation } from './mq/mq-simulator.js';
import { logger } from '../utils/logger.js';

/** Dispatches start/stop to the right simulator implementation by type. */
export async function startSimulation(sim: SimulationConfig): Promise<void> {
  if (sim.status === 'running') return;

  try {
    if (sim.type === 'ws') {
      await startWsSimulation(sim);
    } else {
      await startMqSimulation(sim);
    }
    setSimulationStatus(sim.id, 'running');
  } catch (err) {
    setSimulationStatus(sim.id, 'error');
    logger.error(`Failed to start simulation ${sim.name}: ${String(err)}`);
    throw err;
  }
}

export async function stopSimulation(sim: SimulationConfig): Promise<void> {
  if (sim.type === 'ws') {
    await stopWsSimulation(sim.id);
  } else {
    await stopMqSimulation(sim.id);
  }
  setSimulationStatus(sim.id, 'stopped');
}
