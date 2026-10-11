import { describe, expect, it } from 'vitest';
import { responseDuration, effectiveOutputRate, timingExplanation } from './call-timing';

describe('call timing presentation', () => {
  it('formats elapsed intervals without rounding subsecond calls to zero', () => {
    expect(responseDuration(null)).toBe('Unavailable');
    expect(responseDuration(1)).toBe('1 ms');
    expect(responseDuration(2000)).toBe('2 s');
    expect(responseDuration(62300)).toBe('1 min 2.3 s');
  });
  it('distinguishes unknown, real zero and small positive effective rates', () => {
    expect(effectiveOutputRate(null)).toBe('Unavailable');
    expect(effectiveOutputRate(0)).toBe('0 tok/s');
    expect(effectiveOutputRate(0.0001)).toBe('<0.01 tok/s');
    expect(effectiveOutputRate(50)).toBe('50 tok/s');
  });
  it('explains timing in terms of what each source records', () => {
    expect(timingExplanation('claude-code')).toMatch(/does not record when a request started/);
    expect(timingExplanation('pi')).toMatch(/^From Pi starting the response/);
    expect(timingExplanation('opencode')).toMatch(/^From OpenCode creating the response/);
    expect(timingExplanation('future-harness')).toMatch(/^From the recorded start/);
    for (const source of ['claude-code', 'pi', 'opencode', 'future-harness'])
      expect(timingExplanation(source).length).toBeLessThan(160);
  });
});
