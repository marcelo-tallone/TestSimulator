import { MatchCondition } from '../models/simulation.js';

export function matchRegex(text: string, condition: MatchCondition): boolean {
  if (!condition.pattern) return false;

  try {
    const regex = new RegExp(condition.pattern, condition.flags ?? '');
    return regex.test(text);
  } catch {
    return false;
  }
}
