import { describe, expect, it } from 'vitest';
import { testAnalysis } from './context-river/test-data';
import { conciseLifespanLabels, displayItemLabel } from './item-label';

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

  it('precomputes distinguishing filename context for absolute paths while preserving full labels', () => {
    const items = testAnalysis().contextItems;
    const first = { ...items[0], label: 'Read · /repo/src/alpha/config.ts' };
    const second = { ...items[1], label: 'Read · /repo/tests/alpha/config.ts' };
    const labels = conciseLifespanLabels([first, second]);

    expect(labels.get(first.id)).toBe('Read · src/alpha/config.ts');
    expect(labels.get(second.id)).toBe('Read · tests/alpha/config.ts');
    expect(displayItemLabel(first)).toBe('Read · /repo/src/alpha/config.ts');
  });

  it.each(['Read', 'Write', 'Edit'])(
    'keeps %s result explicit when shortening file paths',
    (tool) => {
      const items = testAnalysis().contextItems;
      const first = { ...items[0], label: `${tool} result · /repo/src/alpha/config.ts` };
      const second = { ...items[1], label: `${tool} result · /repo/tests/alpha/config.ts` };
      const labels = conciseLifespanLabels([first, second]);
      expect(labels.get(first.id)).toBe(`${tool} result · src/alpha/config.ts`);
      expect(labels.get(second.id)).toBe(`${tool} result · tests/alpha/config.ts`);
      expect(displayItemLabel(first)).toBe(first.label);
      const assistant = { ...first, label: `Assistant · ${tool.toLowerCase()}` };
      expect(conciseLifespanLabels([assistant]).get(first.id)).toBe(assistant.label);
    },
  );

  it('splits tool prefixes before interpreting relative and Windows paths', () => {
    const items = testAnalysis().contextItems;
    const relative = { ...items[0], label: 'Read · web/src/App.svelte' };
    const relativeSibling = { ...items[1], label: 'Read · web/tests/App.svelte' };
    const relativeLabels = conciseLifespanLabels([relative, relativeSibling]);
    const uniqueRelative = conciseLifespanLabels([relative]);
    const windows = { ...items[0], label: 'Read · C:\\repo\\src\\App.svelte' };

    expect(relativeLabels.get(relative.id)).toBe('Read · src/App.svelte');
    expect(relativeLabels.get(relativeSibling.id)).toBe('Read · tests/App.svelte');
    expect(uniqueRelative.get(relative.id)).toBe('Read · App.svelte');
    expect(conciseLifespanLabels([windows]).get(windows.id)).toBe('Read · App.svelte');
  });

  it('preserves shell commands, URLs, and message text that happen to contain slashes', () => {
    const template = testAnalysis().contextItems[0];
    const command = { ...template, id: 'bash', label: 'Bash · git diff -- web/src/App.svelte' };
    const url = {
      ...template,
      id: 'url',
      label: 'Bash · curl https://example.com/repo/src/App.svelte',
    };
    const readUrl = {
      ...template,
      id: 'read-url',
      label: 'Read · https://example.com/repo/src/App.svelte',
    };
    const message = { ...template, id: 'user', label: 'User · inspect web/src/App.svelte' };
    const labels = conciseLifespanLabels([command, url, readUrl, message]);

    expect(labels.get(command.id)).toBe(command.label);
    expect(labels.get(url.id)).toBe(url.label);
    expect(labels.get(readUrl.id)).toBe(readUrl.label);
    expect(labels.get(message.id)).toBe(message.label);
  });

  it('precomputes labels for thousands of items by ID', () => {
    const template = testAnalysis().contextItems[0];
    const items = Array.from({ length: 4_000 }, (_, index) => ({
      ...template,
      id: `item-${index}`,
      label: `Read · workspace/module-${index}/config.ts`,
    }));

    const labels = conciseLifespanLabels(items);

    expect(labels).toHaveLength(4_000);
    expect(labels.get('item-3999')).toBe('Read · module-3999/config.ts');
  });

  it('returns HTML-like labels as plain text values', () => {
    const item = testAnalysis().contextItems[0];
    const label = '<img src=x onerror=alert(1)>';
    expect(displayItemLabel({ ...item, label })).toBe(label);
  });
});
