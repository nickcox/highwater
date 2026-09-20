import { describe, expect, it } from 'vitest';
import type { LineageEdge } from '../types';
import { relatedItemIds } from './lineage';

const lineage: LineageEdge[] = [
  { from: 'a', to: 'summary-1', kind: 'frameworkCompaction' },
  { from: 'b', to: 'summary-1', kind: 'frameworkCompaction' },
  { from: 'summary-1', to: 'summary-2', kind: 'frameworkCompaction' },
  { from: 'summary-2', to: 'a', kind: 'frameworkCompaction' },
];

describe('relatedItemIds', () => {
  it('traverses sources, summaries, repeated compactions, and cycles', () => {
    expect([...relatedItemIds('a', lineage)].sort()).toEqual(['a', 'b', 'summary-1', 'summary-2']);
    expect([...relatedItemIds('summary-1', lineage)].sort()).toEqual(['a', 'b', 'summary-1', 'summary-2']);
  });
});
