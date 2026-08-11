import { Router, Request, Response } from 'express';
import {
  getAllSimulations,
  getSimulation,
  createSimulation,
  updateSimulation,
  deleteSimulation,
  getLogs,
  getAllLogs,
  clearLogs,
} from '../store/simulation-store.js';
import { startSimulation, stopSimulation } from '../simulators/manager.js';
import {
  listTemplates,
  getTemplateContent,
  saveTemplate,
  deleteTemplate,
} from '../templates/template-loader.js';
import { CreateSimulationInput } from '../models/simulation.js';
import { logger } from '../utils/logger.js';

export const router = Router();

function validateInput(body: CreateSimulationInput): string | null {
  if (!body.name) return 'name is required';
  if (body.type !== 'ws' && body.type !== 'mq') return 'type must be "ws" or "mq"';
  if (body.type === 'ws' && !body.ws) return 'ws config is required for type "ws"';
  if (body.type === 'mq' && !body.mq) return 'mq config is required for type "mq"';
  if (!body.defaultResponse) return 'defaultResponse is required';
  return null;
}

// --- Health / status ---
router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'TestSimulator' });
});

router.get('/status', (_req: Request, res: Response) => {
  const sims = getAllSimulations();
  const summary = { running: 0, stopped: 0, error: 0, total: sims.length };
  for (const s of sims) summary[s.status]++;
  res.json(summary);
});

// --- Bulk operations (declared before :id routes) ---
router.get('/simulations/export', (_req: Request, res: Response) => {
  res.json(getAllSimulations());
});

router.post('/simulations/import', (req: Request, res: Response) => {
  const items: CreateSimulationInput[] = Array.isArray(req.body) ? req.body : [req.body];
  const created = [];
  for (const item of items) {
    const err = validateInput(item);
    if (err) {
      res.status(400).json({ error: `Invalid simulation "${item?.name ?? '?'}": ${err}` });
      return;
    }
    created.push(createSimulation(item));
  }
  res.status(201).json(created);
});

router.post('/start-all', async (_req: Request, res: Response) => {
  const results = [];
  for (const sim of getAllSimulations()) {
    try {
      await startSimulation(sim);
      results.push({ id: sim.id, name: sim.name, status: 'running' });
    } catch (err) {
      results.push({ id: sim.id, name: sim.name, status: 'error', error: String(err) });
    }
  }
  res.json(results);
});

router.post('/stop-all', async (_req: Request, res: Response) => {
  for (const sim of getAllSimulations()) {
    await stopSimulation(sim);
  }
  res.json({ stopped: true });
});

// --- Simulations CRUD ---
router.get('/simulations', (_req: Request, res: Response) => {
  res.json(getAllSimulations());
});

router.post('/simulations', (req: Request, res: Response) => {
  const err = validateInput(req.body);
  if (err) {
    res.status(400).json({ error: err });
    return;
  }
  const sim = createSimulation(req.body);
  res.status(201).json(sim);
});

router.get('/simulations/:id', (req: Request, res: Response) => {
  const sim = getSimulation(req.params.id);
  if (!sim) {
    res.status(404).json({ error: 'Simulation not found' });
    return;
  }
  res.json(sim);
});

router.put('/simulations/:id', (req: Request, res: Response) => {
  const sim = updateSimulation(req.params.id, req.body);
  if (!sim) {
    res.status(404).json({ error: 'Simulation not found' });
    return;
  }
  res.json(sim);
});

router.delete('/simulations/:id', (req: Request, res: Response) => {
  const sim = getSimulation(req.params.id);
  if (!sim) {
    res.status(404).json({ error: 'Simulation not found' });
    return;
  }
  if (sim.status === 'running') {
    res.status(409).json({ error: 'Stop the simulation before deleting it' });
    return;
  }
  deleteSimulation(req.params.id);
  res.status(204).send();
});

// --- Lifecycle ---
router.post('/simulations/:id/start', async (req: Request, res: Response) => {
  const sim = getSimulation(req.params.id);
  if (!sim) {
    res.status(404).json({ error: 'Simulation not found' });
    return;
  }
  try {
    await startSimulation(sim);
    res.json({ id: sim.id, status: sim.status });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/simulations/:id/stop', async (req: Request, res: Response) => {
  const sim = getSimulation(req.params.id);
  if (!sim) {
    res.status(404).json({ error: 'Simulation not found' });
    return;
  }
  await stopSimulation(sim);
  res.json({ id: sim.id, status: sim.status });
});

router.post('/simulations/:id/restart', async (req: Request, res: Response) => {
  const sim = getSimulation(req.params.id);
  if (!sim) {
    res.status(404).json({ error: 'Simulation not found' });
    return;
  }
  try {
    await stopSimulation(sim);
    await startSimulation(sim);
    res.json({ id: sim.id, status: sim.status });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// --- Logs ---
router.get('/simulations/:id/logs', (req: Request, res: Response) => {
  if (!getSimulation(req.params.id)) {
    res.status(404).json({ error: 'Simulation not found' });
    return;
  }
  const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
  res.json(getLogs(req.params.id, limit));
});

router.delete('/simulations/:id/logs', (req: Request, res: Response) => {
  clearLogs(req.params.id);
  res.status(204).send();
});

router.get('/logs', (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
  res.json(getAllLogs(limit));
});

// --- Templates ---
router.get('/templates', (_req: Request, res: Response) => {
  res.json(listTemplates());
});

router.get('/templates/:filename(*)', (req: Request, res: Response) => {
  const content = getTemplateContent(req.params.filename);
  if (content === null) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }
  res.type('text/plain').send(content);
});

router.put('/templates/:filename(*)', (req: Request, res: Response) => {
  const content = typeof req.body === 'string' ? req.body : JSON.stringify(req.body, null, 2);
  try {
    saveTemplate(req.params.filename, content);
    res.json({ filename: req.params.filename, saved: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete('/templates/:filename(*)', (req: Request, res: Response) => {
  const deleted = deleteTemplate(req.params.filename);
  if (!deleted) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }
  res.status(204).send();
});

router.use((err: Error, _req: Request, res: Response, _next: unknown) => {
  logger.error(`Admin API error: ${err.message}`);
  res.status(500).json({ error: err.message });
});
