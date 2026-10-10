import { describe, expect, it } from 'vitest';
import { formatCostTick } from './format';

describe('cost axis labels', () => {
  it('rounds to two significant digits with a dollar sign', () => {
    expect(formatCostTick(0)).toBe('$0');
    expect(formatCostTick(0.1)).toBe('$0.1');
    expect(formatCostTick(0.354952)).toBe('$0.35');
    expect(formatCostTick(0.0012345)).toBe('$0.0012');
    expect(formatCostTick(27.77749)).toBe('$28');
  });
});
