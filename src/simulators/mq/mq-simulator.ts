import { v4 as uuidv4 } from 'uuid';
import { SimulationConfig } from '../../models/simulation.js';
import { StompMqClient } from './mq-client.js';
import { handleMqMessage } from './mq-handler.js';
import { addLog } from '../../store/simulation-store.js';
import { sleep } from '../../utils/sleep.js';
import { logger } from '../../utils/logger.js';

const clients = new Map<string, StompMqClient>();

export async function startMqSimulation(sim: SimulationConfig): Promise<void> {
  const mq = sim.mq;
  if (!mq) throw new Error('Simulation is missing mq config');
  if (clients.has(sim.id)) return;

  const client = new StompMqClient();
  await client.connect({
    host: mq.host,
    port: mq.port,
    user: mq.user,
    password: mq.password,
  });

  client.subscribe(mq.inputQueue, async message => {
    const start = Date.now();
    const reply = handleMqMessage(sim, message);

    if (reply.resolved.delay > 0) {
      await sleep(reply.resolved.delay);
    }

    client.send(reply.outputQueue, reply.body, reply.headers);

    addLog(sim.id, {
      id: uuidv4(),
      simulationId: sim.id,
      timestamp: new Date().toISOString(),
      type: 'mq',
      inputQueue: mq.inputQueue,
      outputQueue: reply.outputQueue,
      correlationId: message.headers['correlation-id'],
      messageBody: message.body,
      responseMessageBody: reply.body,
      matchedRuleId: reply.resolved.matchedRule?.id ?? null,
      matchedRuleName: reply.resolved.matchedRule?.name ?? null,
      processingTimeMs: Date.now() - start,
    });

    logger.info(
      `[${sim.name}] MQ ${mq.inputQueue} -> ${reply.outputQueue} ` +
        `(${reply.resolved.matchedRule?.name ?? 'default'})`,
    );
  });

  clients.set(sim.id, client);
  logger.info(`[${sim.name}] MQ listening on ${mq.host}:${mq.port} queue ${mq.inputQueue}`);
}

export function stopMqSimulation(id: string): Promise<void> {
  const client = clients.get(id);
  if (client) {
    client.disconnect();
    clients.delete(id);
  }
  return Promise.resolve();
}

export function isMqRunning(id: string): boolean {
  return clients.has(id);
}
