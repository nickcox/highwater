import { describe, expect, it } from 'vitest';
import { formatCost, formatCostTick, formatSessionCost } from './format';

it('shows call costs to at most four decimal places', () => {
  expect(formatCost(0.0012345)).toBe('$0.0012');
  expect(formatCost(0.00001)).toBe('<$0.0001');
  expect(formatCost(0)).toBe('$0.00');
});

it('shows session totals to the nearest cent, distinguishing sub-cent totals from zero', () => {
  expect(formatSessionCost(4.126)).toBe('$4.13');
  expect(formatSessionCost(0.009)).toBe('<$0.01');
  expect(formatSessionCost(0)).toBe('$0.00');
  expect(formatSessionCost(null)).toBe('Unknown');
});

describe('cost axis labels', () => {
  it('rounds to two significant digits with a dollar sign', () => {
    expect(formatCostTick(0)).toBe('$0');
    expect(formatCostTick(0.1)).toBe('$0.1');
    expect(formatCostTick(0.354952)).toBe('$0.35');
    expect(formatCostTick(0.0012345)).toBe('$0.0012');
    expect(formatCostTick(27.77749)).toBe('$28');
  });
});
