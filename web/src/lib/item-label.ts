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
