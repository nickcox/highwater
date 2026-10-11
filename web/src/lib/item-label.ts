import type { ContextItem } from './types';

type LabelFields = Pick<ContextItem, 'kind' | 'label' | 'preview'>;

const KIND_FALLBACKS: Record<string, string> = {
  system: 'System context',
  toolDefinition: 'Tool definition',
  userMessage: 'User message',
  assistantMessage: 'Assistant message',
  toolResult: 'Tool result',
  compactionSummary: 'Compaction summary',
  customMessage: 'Custom context message',
  branchSummary: 'Branch summary',
  thinking: 'Thinking',
  other: 'Context item',
};

/** Prefer structured source labels; bounded content previews are only a legacy fallback. */
export function displayItemLabel(
  item: LabelFields | null | undefined,
  fallback = 'Unlabelled context item',
): string {
  const label = item?.label;
  if (label && label.trim().length > 0) return label;

  const preview = item?.preview?.text;
  if (preview && preview.trim().length > 0) return preview;

  if (item) {
    const kind = item.kind.trim();
    const readableKind =
      KIND_FALLBACKS[kind] ??
      kind.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^\w/, (first) => first.toUpperCase());
    return readableKind || fallback;
  }
  return fallback;
}

interface ParsedSourcePath {
  prefix: string;
  segments: string[];
}

interface SuffixNode {
  pathCount: number;
  children: Map<string, SuffixNode>;
}

function splitSourcePath(label: string): ParsedSourcePath | null {
  const match = label.trim().match(/^((?:Read|Write|Edit)(?: result)?)\s*[·:]\s*(.+)$/i);
  if (!match) return null;

  const prefix = match[1];
  const path = match[2].trim();
  if (!/[\\/]/.test(path) || /^[a-z][a-z\d+.-]*:\/\//i.test(path)) return null;

  const segments = path.split(/[\\/]/).filter(Boolean);
  return segments.length > 0 ? { prefix, segments } : null;
}

/** Precompute concise labels for one accepted item set in time proportional to path segments. */
export function conciseLifespanLabels(
  items: readonly (LabelFields & Pick<ContextItem, 'id'>)[],
): Map<string, string> {
  const parsed = items.map((item) => {
    const fullLabel = displayItemLabel(item);
    return { id: item.id, fullLabel, source: splitSourcePath(fullLabel) };
  });
  const root: SuffixNode = { pathCount: 0, children: new Map() };

  for (const { source } of parsed) {
    if (!source) continue;
    let node = root;
    for (let index = source.segments.length - 1; index >= 0; index -= 1) {
      const segment = source.segments[index];
      let child = node.children.get(segment);
      if (!child) {
        child = { pathCount: 0, children: new Map() };
        node.children.set(segment, child);
      }
      child.pathCount += 1;
      node = child;
    }
  }

  return new Map(
    parsed.map(({ id, fullLabel, source }) => {
      if (!source) return [id, fullLabel];
      let node = root;
      let distinguishingDepth = source.segments.length;
      for (let index = source.segments.length - 1, depth = 1; index >= 0; index -= 1, depth += 1) {
        node = node.children.get(source.segments[index])!;
        if (node.pathCount === 1) {
          distinguishingDepth = depth;
          break;
        }
      }
      const pathLabel = source.segments.slice(-distinguishingDepth).join('/');
      return [id, source.prefix ? `${source.prefix} · ${pathLabel}` : pathLabel];
    }),
  );
}
