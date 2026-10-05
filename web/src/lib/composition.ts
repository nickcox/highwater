import { hierarchy, treemap, treemapSquarify } from 'd3-hierarchy';
import type {
  ContextItem,
  ContextItemKind,
  IndexedAnalysis,
  TokenCoverage,
  TokenizationMethod,
} from './types';
import { displayItemLabel } from './item-label';
import { describeTokenDiagnostic } from './diagnostics';

export const COMPOSITION_KIND_ORDER: readonly ContextItemKind[] = [
  'system',
  'toolDefinition',
  'userMessage',
  'assistantMessage',
  'toolResult',
  'compactionSummary',
  'customMessage',
  'branchSummary',
  'other',
];

const KIND_LABELS: Readonly<Record<ContextItemKind, string>> = {
  system: 'System',
  toolDefinition: 'Tool definitions',
  userMessage: 'User messages',
  assistantMessage: 'Assistant messages',
  toolResult: 'Tool results',
  compactionSummary: 'Compaction summaries',
  customMessage: 'Custom messages',
  branchSummary: 'Branch summaries',
  other: 'Other context',
};

export type CompositionScope = 'atCall' | 'cumulative';

export interface CompositionExplanation {
  title: string;
  impact: string;
}

export interface CallCompositionItem {
  id: string;
  kind: ContextItemKind;
  kindLabel: string;
  label: string;
  sourceOrder: number;
  tokens: number | null;
  share: number | null;
  estimateMethod: TokenizationMethod | null;
  estimateMethods: TokenizationMethod[];
  estimateCoverage: TokenCoverage;
  explanations: CompositionExplanation[];
  ageAtCall: number | null;
  knownContributionCount: number;
  missingContributionCount: number;
  partialEstimateContributionCount: number;
  unavailableCoverageContributionCount: number;
  scopePresenceCount: number;
  overflowed: boolean;
}

export interface CallCompositionGroup {
  kind: ContextItemKind;
  label: string;
  items: CallCompositionItem[];
}

interface CompositionProjectionBase {
  callIndex: number | null;
  profileId: string | null;
  profileIds: string[];
  scope: CompositionScope;
  scopeStartCallIndex: number | null;
  scopeEndCallIndex: number | null;
  scopeCallCount: number;
  items: CallCompositionItem[];
  groups: CallCompositionGroup[];
  /** Retained legacy property name; UI terminology is estimated item tokens. */
  measuredTokenTotal: number | null;
  measuredItemCount: number;
  unmeasuredItemCount: number;
  numericItemCallCount: number;
  totalItemCallCount: number;
  missingItemCallCount: number;
  partialItemCallCount: number;
  unavailableCoverageItemCallCount: number;
  totalOverflow: boolean;
  hasPositiveWeights: boolean;
  allMeasuredZero: boolean;
}

export interface CallCompositionProjection extends CompositionProjectionBase {
  callIndex: number;
  profileId: string | null;
  scope: 'atCall';
}

export interface CumulativeCompositionProjection extends CompositionProjectionBase {
  scope: 'cumulative';
}

export type CompositionProjection = CallCompositionProjection | CumulativeCompositionProjection;

export interface CompositionRectangle {
  item: CallCompositionItem;
  x: number;
  y: number;
  width: number;
  height: number;
  labelFits: boolean;
  labelText: string;
  optionIndex: number;
}

export interface CompositionGroupRectangle {
  kind: ContextItemKind;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  labelText: string;
}

export interface CompositionTreemapLayout {
  width: number;
  height: number;
  rectangles: CompositionRectangle[];
  groups: CompositionGroupRectangle[];
}

interface TreemapDatum {
  label: string;
  kind?: ContextItemKind;
  item?: CallCompositionItem;
  children?: TreemapDatum[];
}

const EMPTY_LAYOUT = (width: number, height: number): CompositionTreemapLayout => ({
  width,
  height,
  rectangles: [],
  groups: [],
});

function safeTokens(tokens: number | null | undefined): number | null {
  return typeof tokens === 'number' && Number.isSafeInteger(tokens) && tokens >= 0 ? tokens : null;
}

function explanationFor(code: string): CompositionExplanation {
  return (
    describeTokenDiagnostic(code) ?? {
      title: 'Additional estimate limitation',
      impact: 'Select this item to inspect additional diagnostics.',
    }
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareMeasuredDescending(left: CallCompositionItem, right: CallCompositionItem): number {
  if (left.tokens === null) return right.tokens === null ? 0 : 1;
  if (right.tokens === null) return -1;
  return right.tokens - left.tokens;
}

export function rankCompositionItems(items: readonly CallCompositionItem[]): CallCompositionItem[] {
  return [...items].sort(
    (left, right) =>
      compareMeasuredDescending(left, right) ||
      left.sourceOrder - right.sourceOrder ||
      compareText(left.id, right.id),
  );
}

function groupsFor(items: CallCompositionItem[]): CallCompositionGroup[] {
  return COMPOSITION_KIND_ORDER.flatMap((kind) => {
    const groupItems = rankCompositionItems(items.filter((item) => item.kind === kind));
    return groupItems.length === 0 ? [] : [{ kind, label: KIND_LABELS[kind], items: groupItems }];
  });
}

function ageAtPosition(
  firstPresencePosition: number | null,
  endpointPosition: number,
): number | null {
  return firstPresencePosition === null || firstPresencePosition > endpointPosition
    ? null
    : endpointPosition - firstPresencePosition;
}

type CompositionItemInput = Omit<
  CallCompositionItem,
  'id' | 'kind' | 'kindLabel' | 'label' | 'share' | 'estimateMethod'
> & { item: ContextItem };

function makeItem({
  item,
  sourceOrder,
  tokens,
  ageAtCall,
  estimateMethods,
  estimateCoverage,
  explanations,
  knownContributionCount,
  missingContributionCount,
  partialEstimateContributionCount,
  unavailableCoverageContributionCount,
  scopePresenceCount,
  overflowed,
}: CompositionItemInput): CallCompositionItem {
  return {
    id: item.id,
    kind: item.kind,
    kindLabel: KIND_LABELS[item.kind],
    label: displayItemLabel(item),
    sourceOrder,
    tokens,
    share: null,
    estimateMethod: estimateMethods.length === 1 ? estimateMethods[0] : null,
    estimateMethods,
    estimateCoverage,
    explanations,
    ageAtCall,
    knownContributionCount,
    missingContributionCount,
    partialEstimateContributionCount,
    unavailableCoverageContributionCount,
    scopePresenceCount,
    overflowed,
  };
}

function assignShares(items: CallCompositionItem[], total: number | null): void {
  if (total === null || total <= 0) return;
  for (const item of items) {
    if (item.tokens !== null) item.share = item.tokens / total;
  }
}

function finishProjection(
  base: Omit<
    CompositionProjectionBase,
    | 'groups'
    | 'measuredItemCount'
    | 'unmeasuredItemCount'
    | 'missingItemCallCount'
    | 'partialItemCallCount'
    | 'unavailableCoverageItemCallCount'
    | 'hasPositiveWeights'
    | 'allMeasuredZero'
  >,
): CompositionProjectionBase {
  const groups = groupsFor(base.items);
  const measuredItemCount = base.items.filter((item) => item.tokens !== null).length;
  const unmeasuredItemCount = base.items.length - measuredItemCount;
  const missingItemCallCount = base.items.reduce(
    (sum, item) => sum + item.missingContributionCount,
    0,
  );
  const partialItemCallCount = base.items.reduce(
    (sum, item) => sum + item.partialEstimateContributionCount,
    0,
  );
  const unavailableCoverageItemCallCount = base.items.reduce(
    (sum, item) => sum + item.unavailableCoverageContributionCount,
    0,
  );
  const total =
    base.totalOverflow || base.numericItemCallCount === 0 ? null : base.measuredTokenTotal;
  const hasPositiveWeights = total !== null && total > 0;
  const allMeasuredZero = measuredItemCount > 0 && total === 0;
  assignShares(base.items, total);
  return {
    ...base,
    measuredTokenTotal: total,
    groups,
    measuredItemCount,
    unmeasuredItemCount,
    missingItemCallCount,
    partialItemCallCount,
    unavailableCoverageItemCallCount,
    hasPositiveWeights,
    allMeasuredZero,
  };
}

/** Build a point-in-time projection using only the inspected call's applicable item estimates. */
export function projectCallComposition(
  indexed: IndexedAnalysis,
  callIndex: number,
): CallCompositionProjection | null {
  const call = indexed.callByIndex.get(callIndex);
  if (!call) return null;

  const calls = indexed.analysis.modelCalls;
  const callPosition = calls.findIndex((candidate) => candidate.index === callIndex);
  const positionByCallIndex = new Map(
    calls.map((candidate, position) => [candidate.index, position]),
  );
  const seen = new Set<string>();
  let measuredTokenTotal = 0;
  let totalOverflow = false;
  let numericItemCallCount = 0;
  const items: CallCompositionItem[] = [];

  call.contextItemIds.forEach((itemId, sourceOrder) => {
    if (seen.has(itemId)) return;
    seen.add(itemId);
    const item = indexed.itemById.get(itemId);
    if (!item) return;

    const estimate = call.tokenizationProfileId
      ? (indexed.itemEstimateByProfile.get(itemId)?.get(call.tokenizationProfileId) ?? null)
      : null;
    const tokens = safeTokens(estimate?.tokens);
    const known = tokens === null ? 0 : 1;
    const missing = tokens === null ? 1 : 0;
    const partial = estimate?.coverage === 'partial' ? 1 : 0;
    const unavailableCoverage = estimate?.coverage === 'unavailable' ? 1 : 0;
    if (tokens !== null) {
      numericItemCallCount += 1;
      if (measuredTokenTotal > Number.MAX_SAFE_INTEGER - tokens) totalOverflow = true;
      else measuredTokenTotal += tokens;
    }

    const firstPosition = positionByCallIndex.get(item.firstModelCall) ?? null;
    const estimateMethods = estimate ? [estimate.method] : [];
    const estimateCoverage: TokenCoverage =
      tokens === null ? 'unavailable' : (estimate?.coverage ?? 'unavailable');
    items.push(
      makeItem({
        item,
        sourceOrder,
        tokens,
        ageAtCall: ageAtPosition(firstPosition, callPosition),
        estimateMethods,
        estimateCoverage,
        explanations: (estimate?.noteCodes ?? []).map(explanationFor),
        knownContributionCount: known,
        missingContributionCount: missing,
        partialEstimateContributionCount: partial,
        unavailableCoverageContributionCount: unavailableCoverage,
        scopePresenceCount: 1,
        overflowed: false,
      }),
    );
  });

  return {
    ...finishProjection({
      callIndex,
      profileId: call.tokenizationProfileId,
      profileIds: call.tokenizationProfileId ? [call.tokenizationProfileId] : [],
      scope: 'atCall',
      scopeStartCallIndex: call.index,
      scopeEndCallIndex: call.index,
      scopeCallCount: 1,
      items,
      measuredTokenTotal: measuredTokenTotal,
      numericItemCallCount,
      totalItemCallCount: items.length,
      totalOverflow,
    }),
    scope: 'atCall',
    callIndex,
  };
}

interface ItemAccumulator {
  item: ContextItem;
  sourceOrder: number;
  totalTokens: number;
  overflowed: boolean;
  knownContributionCount: number;
  missingContributionCount: number;
  partialEstimateContributionCount: number;
  unavailableCoverageContributionCount: number;
  scopePresenceCount: number;
  firstPresencePosition: number;
  methods: Set<TokenizationMethod>;
  explanationCodes: Set<string>;
}

/** Aggregate exact present-item estimates once per call through the inclusive ordered endpoint. */
export function projectCumulativeComposition(
  indexed: IndexedAnalysis,
  endpointCallIndex: number | null = null,
): CumulativeCompositionProjection | null {
  const calls = indexed.analysis.modelCalls;
  if (endpointCallIndex !== null && !indexed.callByIndex.has(endpointCallIndex)) return null;
  const endpointPosition =
    endpointCallIndex === null
      ? calls.length - 1
      : calls.findIndex((call) => call.index === endpointCallIndex);
  if (endpointCallIndex !== null && endpointPosition < 0) return null;
  const includedCalls = endpointPosition < 0 ? [] : calls.slice(0, endpointPosition + 1);
  const sourceOrderById = new Map(
    indexed.analysis.contextItems.map((item, order) => [item.id, order]),
  );
  const accumulators = new Map<string, ItemAccumulator>();
  const profileIds = new Set<string>();
  let measuredTokenTotal = 0;
  let totalOverflow = false;
  let numericItemCallCount = 0;
  let totalItemCallCount = 0;

  for (let position = 0; position < includedCalls.length; position += 1) {
    const call = includedCalls[position];
    if (call.tokenizationProfileId) profileIds.add(call.tokenizationProfileId);
    const seenThisCall = new Set<string>();
    for (const itemId of call.contextItemIds) {
      if (seenThisCall.has(itemId)) continue;
      seenThisCall.add(itemId);
      const item = indexed.itemById.get(itemId);
      if (!item) continue;
      totalItemCallCount += 1;
      let accumulator = accumulators.get(itemId);
      if (!accumulator) {
        accumulator = {
          item,
          sourceOrder: sourceOrderById.get(itemId) ?? Number.MAX_SAFE_INTEGER,
          totalTokens: 0,
          overflowed: false,
          knownContributionCount: 0,
          missingContributionCount: 0,
          partialEstimateContributionCount: 0,
          unavailableCoverageContributionCount: 0,
          scopePresenceCount: 0,
          firstPresencePosition: position,
          methods: new Set(),
          explanationCodes: new Set(),
        };
        accumulators.set(itemId, accumulator);
      }
      accumulator.scopePresenceCount += 1;

      const estimate = call.tokenizationProfileId
        ? (indexed.itemEstimateByProfile.get(itemId)?.get(call.tokenizationProfileId) ?? null)
        : null;
      // Evidence exists independently of whether a numeric estimate is available.
      if (estimate) {
        accumulator.methods.add(estimate.method);
        for (const code of estimate.noteCodes) accumulator.explanationCodes.add(code);
      }
      const tokens = safeTokens(estimate?.tokens);
      if (estimate?.coverage === 'partial') accumulator.partialEstimateContributionCount += 1;
      if (estimate?.coverage === 'unavailable')
        accumulator.unavailableCoverageContributionCount += 1;
      if (tokens === null || !estimate) {
        accumulator.missingContributionCount += 1;
        continue;
      }
      numericItemCallCount += 1;
      accumulator.knownContributionCount += 1;

      if (accumulator.totalTokens > Number.MAX_SAFE_INTEGER - tokens) accumulator.overflowed = true;
      else if (!accumulator.overflowed) accumulator.totalTokens += tokens;
      if (measuredTokenTotal > Number.MAX_SAFE_INTEGER - tokens) totalOverflow = true;
      else if (!totalOverflow) measuredTokenTotal += tokens;
    }
  }

  const items = [...accumulators.values()]
    .sort(
      (left, right) =>
        left.sourceOrder - right.sourceOrder || compareText(left.item.id, right.item.id),
    )
    .map((accumulator) => {
      const overflowed = accumulator.overflowed;
      const tokens =
        accumulator.knownContributionCount === 0 || overflowed ? null : accumulator.totalTokens;
      const estimateCoverage: TokenCoverage =
        accumulator.knownContributionCount === 0
          ? 'unavailable'
          : accumulator.missingContributionCount > 0 ||
              accumulator.partialEstimateContributionCount > 0 ||
              accumulator.unavailableCoverageContributionCount > 0
            ? 'partial'
            : 'complete';
      return makeItem({
        item: accumulator.item,
        sourceOrder: accumulator.sourceOrder,
        tokens,
        ageAtCall: ageAtPosition(accumulator.firstPresencePosition, endpointPosition),
        estimateMethods: [...accumulator.methods].sort(),
        estimateCoverage,
        explanations: [...accumulator.explanationCodes].sort().map(explanationFor),
        knownContributionCount: accumulator.knownContributionCount,
        missingContributionCount: accumulator.missingContributionCount,
        partialEstimateContributionCount: accumulator.partialEstimateContributionCount,
        unavailableCoverageContributionCount: accumulator.unavailableCoverageContributionCount,
        scopePresenceCount: accumulator.scopePresenceCount,
        overflowed,
      });
    });

  const profileIdList = [...profileIds].sort();
  return {
    ...finishProjection({
      callIndex: endpointCallIndex,
      profileId: profileIdList.length === 1 ? profileIdList[0] : null,
      profileIds: profileIdList,
      scope: 'cumulative',
      scopeStartCallIndex: includedCalls[0]?.index ?? null,
      scopeEndCallIndex: includedCalls[includedCalls.length - 1]?.index ?? null,
      scopeCallCount: includedCalls.length,
      items,
      measuredTokenTotal,
      numericItemCallCount,
      totalItemCallCount,
      totalOverflow,
    }),
    scope: 'cumulative',
  };
}

export interface CompositionProjectionCache {
  /** Narrow retention diagnostic; not a measurement of the surrounding object graph. */
  readonly retainedEntryCount: number;
  get(
    indexed: IndexedAnalysis,
    scope: CompositionScope,
    endpointCallIndex: number | null,
  ): CompositionProjection | null;
}

/** At most two entries: latest endpoint per scope for the current immutable analysis identity. */
export function createCompositionProjectionCache(): CompositionProjectionCache {
  let currentAnalysis: IndexedAnalysis | null = null;
  const projections = new Map<
    CompositionScope,
    { endpoint: number | null; projection: CompositionProjection | null }
  >();
  return {
    get retainedEntryCount() {
      return projections.size;
    },
    get(indexed, scope, endpointCallIndex) {
      if (currentAnalysis !== indexed) {
        projections.clear();
        currentAnalysis = indexed;
      }
      const cached = projections.get(scope);
      if (cached?.endpoint === endpointCallIndex) return cached.projection;
      const projection =
        scope === 'atCall'
          ? endpointCallIndex === null
            ? null
            : projectCallComposition(indexed, endpointCallIndex)
          : projectCumulativeComposition(indexed, endpointCallIndex);
      projections.set(scope, { endpoint: endpointCallIndex, projection });
      return projection;
    },
  };
}

/** Clip/truncate a label conservatively for a tile or group-header width. */
export function fitCompositionLabel(label: string, width: number, fontSize = 10): string {
  const usableWidth = width - 12;
  const maxCharacters = Math.floor(usableWidth / (fontSize * 0.62));
  if (maxCharacters < 4) return '';
  if (label.length <= maxCharacters) return label;

  const path = label.match(/(?:[A-Za-z]:)?(?:[/\\][^/\\\s]+)+$/)?.[0];
  if (path) {
    const segments = path.split(/[\\/]/).filter(Boolean);
    const basename = segments[segments.length - 1] ?? path;
    const prefix = label.slice(0, label.length - path.length);
    const joined = `${prefix}…/${basename}`;
    if (joined.length <= maxCharacters) return joined;
    if (basename.length >= maxCharacters - 1) return `…${basename.slice(-(maxCharacters - 1))}`;
    const prefixRoom = maxCharacters - basename.length - 2;
    return `${prefix.slice(0, Math.max(0, prefixRoom))}…/${basename}`;
  }
  const start = Math.ceil((maxCharacters - 1) / 2);
  const end = Math.floor((maxCharacters - 1) / 2);
  return `${label.slice(0, start)}…${end > 0 ? label.slice(-end) : ''}`;
}

/** Deterministic squarified tiling; group header/gutters reduce usable area, so area is approximate. */
export function layoutCompositionTreemap(
  projection: CompositionProjection,
  width: number,
  height: number,
): CompositionTreemapLayout {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    !projection.hasPositiveWeights ||
    projection.totalOverflow
  ) {
    return EMPTY_LAYOUT(
      Number.isFinite(width) && width > 0 ? width : 0,
      Number.isFinite(height) && height > 0 ? height : 0,
    );
  }

  const children: TreemapDatum[] = projection.groups
    .map((group) => ({
      label: group.label,
      kind: group.kind,
      children: group.items
        .filter((item) => item.tokens !== null)
        .map((item) => ({ label: item.label, kind: item.kind, item })),
    }))
    .filter((group) => (group.children?.length ?? 0) > 0);
  const root = hierarchy<TreemapDatum>({ label: 'Composition', children }).sum(
    (datum) => datum.item?.tokens ?? 0,
  );
  const layout = treemap<TreemapDatum>()
    .size([width, height])
    .tile(treemapSquarify)
    .paddingInner(2)
    .paddingTop((node) => (node.depth === 1 ? 15 : 0))
    .round(false);
  const laidOut = layout(root);
  const optionIndexById = new Map(
    rankCompositionItems(projection.items).map((item, index) => [item.id, index]),
  );
  const rectangles: CompositionRectangle[] = [];
  const groups: CompositionGroupRectangle[] = [];

  laidOut.each((node) => {
    const nodeWidth = node.x1 - node.x0;
    const nodeHeight = node.y1 - node.y0;
    if (node.depth === 1 && node.data.kind && nodeWidth > 0 && nodeHeight > 0) {
      groups.push({
        kind: node.data.kind,
        label: node.data.label,
        x: node.x0,
        y: node.y0,
        width: nodeWidth,
        height: nodeHeight,
        labelText:
          nodeWidth >= 58 && nodeHeight >= 17
            ? fitCompositionLabel(node.data.label, nodeWidth, 9)
            : '',
      });
    }
    const item = node.data.item;
    if (!item || nodeWidth <= 0 || nodeHeight <= 0 || (item.tokens ?? 0) <= 0) return;
    const optionIndex = optionIndexById.get(item.id);
    if (optionIndex === undefined) return;
    const labelFits = nodeWidth >= 68 && nodeHeight >= 38;
    rectangles.push({
      item,
      x: node.x0,
      y: node.y0,
      width: nodeWidth,
      height: nodeHeight,
      labelFits,
      labelText: labelFits ? fitCompositionLabel(item.label, nodeWidth, 10) : '',
      optionIndex,
    });
  });

  return { width, height, rectangles, groups };
}
