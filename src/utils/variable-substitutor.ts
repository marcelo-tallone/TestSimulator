import { v4 as uuidv4 } from 'uuid';
import { VariableMapping } from '../models/simulation.js';

function resolveJsonField(body: string, path: string): string | undefined {
  try {
    const obj = JSON.parse(body);
    return getNestedValue(obj, path)?.toString();
  } catch {
    return undefined;
  }
}

export function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function resolveBuiltInVariable(name: string): string | undefined {
  switch (name) {
    case '$timestamp':
      return new Date().toISOString();
    case '$uuid':
      return uuidv4();
    case '$random':
      return Math.floor(Math.random() * 1000000).toString();
    case '$date':
      return new Date().toISOString().split('T')[0];
    default:
      return undefined;
  }
}

export interface SubstitutionContext {
  body?: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
}

export function substituteVariables(
  template: string,
  variables: VariableMapping[] | undefined,
  context: SubstitutionContext,
): string {
  let result = template;

  result = result.replace(/\{\{\$(\w+)\}\}/g, (_match, name: string) => {
    return resolveBuiltInVariable(`$${name}`) ?? _match;
  });

  if (!variables || variables.length === 0) return result;

  for (const mapping of variables) {
    let value: string | undefined;

    switch (mapping.source) {
      case 'json-field':
        if (context.body && mapping.path) {
          value = resolveJsonField(context.body, mapping.path);
        }
        break;
      case 'xpath':
        // XPath extraction handled separately for XML bodies
        break;
      case 'header':
        if (context.headers && mapping.path) {
          value = context.headers[mapping.path.toLowerCase()];
        }
        break;
      case 'query':
        if (context.query && mapping.path) {
          value = context.query[mapping.path];
        }
        break;
      case 'fixed':
        value = mapping.fixedValue;
        if (value) {
          value = value.replace(/\{\{\$(\w+)\}\}/g, (_m, n: string) => {
            return resolveBuiltInVariable(`$${n}`) ?? _m;
          });
        }
        break;
    }

    if (value !== undefined) {
      result = result.replaceAll(`{{${mapping.name}}}`, value);
    }
  }

  return result;
}
