import { MatchCondition } from '../models/simulation.js';
import { matchJsonField } from './json-field-matcher.js';
import { matchXPath } from './xpath-matcher.js';
import { matchRegex } from './regex-matcher.js';

export interface MatchContext {
  body: string;
  path?: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
}

export function evaluateCondition(condition: MatchCondition, context: MatchContext): boolean {
  if (condition.and && condition.and.length > 0) {
    return condition.and.every(c => evaluateCondition(c, context));
  }

  if (condition.or && condition.or.length > 0) {
    return condition.or.some(c => evaluateCondition(c, context));
  }

  switch (condition.type) {
    case 'always':
      return true;
    case 'json-field':
      return matchJsonField(context.body, condition);
    case 'xpath':
      return matchXPath(context.body, condition);
    case 'regex': {
      const target = condition.field === 'path' ? (context.path ?? '') : context.body;
      return matchRegex(target, condition);
    }
    default:
      return false;
  }
}
