import { SimulationConfig } from '../../models/simulation.js';
import { MatchContext } from '../../matching/matcher.js';
import { resolveResponse, ResolvedResponse } from '../response-resolver.js';
import { IncomingMqMessage } from './mq-client.js';

export interface MqReply {
  outputQueue: string;
  body: string;
  headers: Record<string, string>;
  resolved: ResolvedResponse;
}

function stripQueuePrefix(destination: string): string {
  return destination.replace(/^\/queue\//, '');
}

/**
 * Builds the reply for an incoming MQ message: runs the matching pipeline,
 * decides the output queue (config or the message's reply-to header) and
 * preserves the correlation id when configured.
 */
export function handleMqMessage(sim: SimulationConfig, message: IncomingMqMessage): MqReply {
  const mq = sim.mq!;
  const matchCtx: MatchContext = { body: message.body, headers: message.headers };
  const resolved = resolveResponse(sim, matchCtx, 200, mq.defaultDelay ?? 0);

  const replyTo = message.headers['reply-to'];
  const outputQueue =
    mq.useReplyToQueue && replyTo ? stripQueuePrefix(replyTo) : mq.outputQueue;

  const headers: Record<string, string> = {};
  if (mq.preserveCorrelId && message.headers['correlation-id']) {
    headers['correlation-id'] = message.headers['correlation-id'];
  }
  if (mq.responseFormat === 'json') {
    headers['content-type'] = 'application/json';
  } else if (mq.responseFormat === 'xml' || mq.responseFormat === 'soap') {
    headers['content-type'] = 'text/xml';
  }

  return { outputQueue, body: resolved.body, headers, resolved };
}
