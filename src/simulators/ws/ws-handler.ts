import type { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { SimulationConfig, ResponseFormat } from '../../models/simulation.js';
import { MatchContext } from '../../matching/matcher.js';
import { resolveResponse } from '../response-resolver.js';
import { addLog } from '../../store/simulation-store.js';
import { sleep } from '../../utils/sleep.js';
import { logger } from '../../utils/logger.js';

function contentTypeFor(format: ResponseFormat): string {
  switch (format) {
    case 'json':
      return 'application/json';
    case 'xml':
      return 'application/xml';
    case 'soap':
      return 'text/xml; charset=utf-8';
    case 'text':
    default:
      return 'text/plain';
  }
}

function wrapSoapIfNeeded(body: string): string {
  if (/<\w*:?Envelope/i.test(body)) return body;
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
${body}
  </soap:Body>
</soap:Envelope>`;
}

function normalizeHeaders(req: Request): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    result[key.toLowerCase()] = Array.isArray(value) ? value.join(',') : String(value ?? '');
  }
  return result;
}

export function createWsHandler(sim: SimulationConfig) {
  const ws = sim.ws!;

  return async (req: Request, res: Response): Promise<void> => {
    const start = Date.now();
    const body = typeof req.body === 'string' ? req.body : '';
    const headers = normalizeHeaders(req);
    const query = req.query as Record<string, string>;

    const matchCtx: MatchContext = { body, path: req.originalUrl, headers, query };

    let resolved;
    try {
      resolved = resolveResponse(sim, matchCtx, ws.defaultStatusCode, ws.defaultDelay ?? 0);
    } catch (err) {
      logger.error(`[${sim.name}] response error: ${String(err)}`);
      res.status(500).json({ error: 'Simulation response error', detail: String(err) });
      return;
    }

    if (resolved.delay > 0) {
      await sleep(resolved.delay);
    }

    let responseBody = resolved.body;
    if (ws.responseFormat === 'soap') {
      responseBody = wrapSoapIfNeeded(responseBody);
    }

    res.status(resolved.statusCode);
    res.set('Content-Type', contentTypeFor(ws.responseFormat));
    for (const [key, value] of Object.entries(resolved.headers)) {
      res.set(key, value);
    }
    res.send(responseBody);

    addLog(sim.id, {
      id: uuidv4(),
      simulationId: sim.id,
      timestamp: new Date().toISOString(),
      type: 'ws',
      method: req.method,
      path: req.originalUrl,
      requestHeaders: headers,
      requestBody: body,
      responseStatusCode: resolved.statusCode,
      responseBody,
      matchedRuleId: resolved.matchedRule?.id ?? null,
      matchedRuleName: resolved.matchedRule?.name ?? null,
      processingTimeMs: Date.now() - start,
    });

    logger.info(
      `[${sim.name}] ${req.method} ${req.originalUrl} -> ${resolved.statusCode} ` +
        `(${resolved.matchedRule?.name ?? 'default'})`,
    );
  };
}
