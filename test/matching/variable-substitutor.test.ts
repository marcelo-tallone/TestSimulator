import { describe, it, expect } from 'vitest';
import { substituteVariables } from '../../src/utils/variable-substitutor.js';

describe('variable substitution', () => {
  it('substitutes json-field values', () => {
    const template = '{"id":"{{requestId}}","monto":{{monto}}}';
    const body = JSON.stringify({ requestId: 'abc-123', monto: 5000 });
    const result = substituteVariables(template, [
      { name: 'requestId', source: 'json-field', path: 'requestId' },
      { name: 'monto', source: 'json-field', path: 'monto' },
    ], { body });
    expect(result).toBe('{"id":"abc-123","monto":5000}');
  });

  it('replaces built-in $timestamp', () => {
    const result = substituteVariables('t={{$timestamp}}', [], {});
    expect(result).not.toContain('{{$timestamp}}');
    expect(result).toMatch(/t=\d{4}-\d{2}-\d{2}T/);
  });

  it('generates unique $uuid values', () => {
    const result = substituteVariables('{{$uuid}}', [], {});
    expect(result).toMatch(/^[0-9a-f-]{36}$/);
  });
});
