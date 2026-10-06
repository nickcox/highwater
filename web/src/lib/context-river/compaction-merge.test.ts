import { describe, expect, it } from 'vitest';
import { compactionMergePaths } from './compaction-merge';

describe('decorative compaction compression', () => {
  it('joins the actual summary interval, without assigning it source token shares', () => {
    const merge = compactionMergePaths(10, 20, 80, 50, 90, 110, 24);
    expect(merge.mergePath).toBe('M 10 20 C 30 20, 30 90, 50 90 L 50 110 C 30 110, 30 80, 10 80 Z');
    expect(merge.path).toBe('M 10 50 C 30 50, 30 100, 50 100');
  });
  it('overlaps multiple sources into one real summary band rather than inventing additive lanes', () => {
    const first = compactionMergePaths(10, 0, 80, 50, 90, 110, 24);
    const second = compactionMergePaths(10, 80, 100, 50, 90, 110, 24);
    expect(first.mergePath).toContain('50 90 L 50 110');
    expect(second.mergePath).toContain('50 90 L 50 110');
  });

  it('does not fabricate filled geometry for zero or unavailable thickness', () => {
    expect(compactionMergePaths(10, 20, 20, 50, 90, 110, 24).mergePath).toBe('');
    expect(compactionMergePaths(10, 20, 80, 50, 90, 90, 24).mergePath).toBe('');
  });

  it('bounds the bend to the transition even in tightly fitted sessions', () => {
    const merge = compactionMergePaths(10, 20, 80, 11, 90, 110, 24);
    expect(merge.mergePath).toContain('C 10.5 20, 10.5 90, 11 90');
    expect(compactionMergePaths(10, 20, 80, 10, 90, 110, 24).mergePath).not.toMatch(/NaN|Infinity/);
  });
});
