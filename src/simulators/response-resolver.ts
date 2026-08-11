import { SimulationConfig, MatchingRule, ResponseConfig } from '../models/simulation.js';
import { evaluateCondition, MatchContext } from '../matching/matcher.js';
import { loadTemplate } from '../templates/template-loader.js';
import { substituteVariables, SubstitutionContext } from '../utils/variable-substitutor.js';

export interface ResolvedResponse {
  body: string;
  statusCode: number;
  headers: Record<string, string>;
  delay: number;
  matchedRule: MatchingRule | null;
}

function getRawBody(response: ResponseConfig): string {
  if (response.templateFile) {
    return loadTemplate(response.templateFile);
  }
  if (typeof response.inlineBody === 'string') {
    return response.inlineBody;
  }
  if (response.inlineBody !== undefined) {
    return JSON.stringify(response.inlineBody);
  }
  return '';
}

/**
 * Evaluates matching rules in priority order, selects a response (or the
 * default), loads its template/inline body and applies variable substitution.
 * Shared by both the WS and MQ handlers so the matching pipeline lives in one place.
 */
export function resolveResponse(
  sim: SimulationConfig,
  matchCtx: MatchContext,
  defaultStatusCode: number,
  defaultDelay: number,
): ResolvedResponse {
  const sorted = [...sim.rules].sort((a, b) => a.priority - b.priority);

  let chosen: ResponseConfig = sim.defaultResponse;
  let matchedRule: MatchingRule | null = null;

  for (const rule of sorted) {
    if (evaluateCondition(rule.condition, matchCtx)) {
      chosen = rule.response;
      matchedRule = rule;
      break;
    }
  }

  const raw = getRawBody(chosen);
  const subCtx: SubstitutionContext = {
    body: matchCtx.body,
    headers: matchCtx.headers,
    query: matchCtx.query,
  };
  const body = substituteVariables(raw, chosen.variables, subCtx);

  return {
    body,
    statusCode: chosen.statusCode ?? defaultStatusCode,
    headers: chosen.headers ?? {},
    delay: chosen.delay ?? defaultDelay,
    matchedRule,
  };
}
