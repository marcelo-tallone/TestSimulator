import { describe, it, expect } from 'vitest';
import { evaluateCondition } from '../../src/matching/matcher.js';

describe('json-field matching', () => {
  const body = JSON.stringify({ monto: 5000, moneda: 'ARS', cliente: { tipo: 'VIP' } });

  it('matches eq', () => {
    expect(evaluateCondition({ type: 'json-field', field: 'moneda', operator: 'eq', value: 'ARS' }, { body })).toBe(true);
  });

  it('matches lt', () => {
    expect(evaluateCondition({ type: 'json-field', field: 'monto', operator: 'lt', value: 10000 }, { body })).toBe(true);
  });

  it('matches gte false', () => {
    expect(evaluateCondition({ type: 'json-field', field: 'monto', operator: 'gte', value: 10000 }, { body })).toBe(false);
  });

  it('matches nested field with dot-notation', () => {
    expect(evaluateCondition({ type: 'json-field', field: 'cliente.tipo', operator: 'eq', value: 'VIP' }, { body })).toBe(true);
  });

  it('exists', () => {
    expect(evaluateCondition({ type: 'json-field', field: 'moneda', operator: 'exists' }, { body })).toBe(true);
    expect(evaluateCondition({ type: 'json-field', field: 'noexiste', operator: 'exists' }, { body })).toBe(false);
  });
});

describe('regex matching', () => {
  it('matches on path', () => {
    expect(evaluateCondition({ type: 'regex', field: 'path', pattern: 'by-numero/0000001' }, { body: '', path: '/v1/cuentas/by-numero/0000001' })).toBe(true);
  });
});

describe('xpath matching', () => {
  const xml = '<root><AccountNumber>12345</AccountNumber></root>';
  it('matches element value', () => {
    expect(evaluateCondition({ type: 'xpath', expression: "//AccountNumber[text()='12345']" }, { body: xml })).toBe(true);
    expect(evaluateCondition({ type: 'xpath', expression: "//AccountNumber[text()='99999']" }, { body: xml })).toBe(false);
  });
});

describe('compound conditions', () => {
  const body = JSON.stringify({ monto: 5000, moneda: 'ARS' });

  it('and', () => {
    expect(evaluateCondition({
      type: 'always',
      and: [
        { type: 'json-field', field: 'moneda', operator: 'eq', value: 'ARS' },
        { type: 'json-field', field: 'monto', operator: 'lt', value: 10000 },
      ],
    }, { body })).toBe(true);
  });

  it('or', () => {
    expect(evaluateCondition({
      type: 'always',
      or: [
        { type: 'json-field', field: 'moneda', operator: 'eq', value: 'USD' },
        { type: 'json-field', field: 'monto', operator: 'lt', value: 10000 },
      ],
    }, { body })).toBe(true);
  });
});
