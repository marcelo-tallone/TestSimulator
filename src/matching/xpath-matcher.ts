import { DOMParser } from '@xmldom/xmldom';
import xpath from 'xpath';
import { MatchCondition } from '../models/simulation.js';

export function matchXPath(body: string, condition: MatchCondition): boolean {
  if (!condition.expression) return false;

  try {
    const doc = new DOMParser().parseFromString(body, 'text/xml');
    const result = xpath.select(condition.expression, doc as unknown as Node);

    if (typeof result === 'boolean') return result;
    if (typeof result === 'number') return result !== 0;
    if (typeof result === 'string') return result.length > 0;
    if (Array.isArray(result)) return result.length > 0;
    return false;
  } catch {
    return false;
  }
}
