import { describe, expect, it } from 'vitest';
import { testAnalysis } from './context-river/test-data';
import { displayItemLabel } from './item-label';

describe('displayItemLabel', () => {
  it('prefers nonempty source labels and keeps content previews as a fallback', () => {
    const item = testAnalysis().contextItems[0];
    const preview = {
      text: 'bounded content preview',
      kind: 'text' as const,
      truncated: false,
      expandedText: 'bounded content preview',
      expandedTruncated: false,
    };
    expect(displayItemLabel({ ...item, label: 'Read · src/main.rs', preview })).toBe(
      'Read · src/main.rs',
    );
    expect(displayItemLabel({ ...item, label: '', preview })).toBe('bounded content preview');
    expect(displayItemLabel({ ...item, label: ' \n ', preview: null })).toBe('Tool result');
    expect(displayItemLabel(null, item.id)).toBe(item.id);
  });

  it('returns HTML-like labels as plain text values', () => {
    const item = testAnalysis().contextItems[0];
    const label = '<img src=x onerror=alert(1)>';
    expect(displayItemLabel({ ...item, label })).toBe(label);
  });
});
