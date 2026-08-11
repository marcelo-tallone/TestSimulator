import { MatchCondition } from '../models/simulation.js';
import { getNestedValue } from '../utils/variable-substitutor.js';

export function matchJsonField(body: string, condition: MatchCondition): boolean {
  if (!condition.field || !condition.operator) return false;

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return false;
  }

  const actual = getNestedValue(parsed, condition.field);

  if (condition.operator === 'exists') {
    return actual !== undefined && actual !== null;
  }

  if (actual === undefined || actual === null) return false;

  const expected = condition.value;

  switch (condition.operator) {
    case 'eq':
      // eslint-disable-next-line eqeqeq
      return actual == expected;
    case 'neq':
      // eslint-disable-next-line eqeqeq
      return actual != expected;
    case 'gt':
      return Number(actual) > Number(expected);
    case 'lt':
      return Number(actual) < Number(expected);
    case 'gte':
      return Number(actual) >= Number(expected);
    case 'lte':
      return Number(actual) <= Number(expected);
    case 'contains':
      return String(actual).includes(String(expected));
    default:
      return false;
  }
}
