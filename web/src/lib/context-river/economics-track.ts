import type { CacheRatioDiscontinuity, CostKind, ModelCall, SessionAnalysis } from '../types';
import { isPiSource } from '../cost-basis';
import { ECONOMICS_POLICIES, type EconomicsCacheCategory } from '../economics-policy';

export type EconomicsTrackMode = 'cache' | 'cost' | 'off';
export type CacheViewMode = 'tokens' | 'share';
export type CacheSegmentKind = EconomicsCacheCategory;
export type CacheMarkStatus = 'complete' | 'zero' | 'partial' | 'missing' | 'unsupported';
export type CacheShareStatus = 'complete' | 'zeroPrompt' | 'unavailable';
export type CostMarkStatus = 'known' | 'zero' | 'partial' | 'missing';
export type CacheCategoryAvailability =
  | 'available'
  | 'measuredZero'
  | 'partial'
  | 'missing'
  | 'notReported'
  | 'notRetained'
  | 'unsupported';

export interface EconomicsEventDetailEvent {
  id: string;
  kind: 'compaction' | 'targetChange' | 'ratioChange';
  callIndex: number;
  x: number;
  label: string;
  direction?: 'rise' | 'drop';
  magnitude?: 'notable' | 'large';
}

export interface EconomicsEventBreakdown {
  id: string;
  events: EconomicsEventDetailEvent[];
  callIndices: number[];
  anchorX: number;
  anchorY: number;
  laneTop: number;
  laneHeight: number;
}

export interface CacheTrackSegment {
  kind: CacheSegmentKind;
  label: string;
  value: number;
}

export interface CacheShareSegment extends CacheTrackSegment {
  percentage: number;
}

export interface CacheTrackPoint {
  callIndex: number;
  status: CacheMarkStatus;
  promptTokens: number | null;
  segments: CacheTrackSegment[];
  shareSegments: CacheShareSegment[];
  shareStatus: CacheShareStatus;
  shareDenominator: number | null;
  note: string;
  discontinuity: CacheRatioDiscontinuity | null;
}

export interface CacheCategoryPresentation {
  kind: CacheSegmentKind;
  label: string;
  shortLabel: string;
  applicablePolicyIds: string[];
  availability: CacheCategoryAvailability;
  completeCalls: number;
  applicableCalls: number;
  note: string;
}

export interface CachePresentationMetadata {
  categories: CacheCategoryPresentation[];
  applicablePolicyIds: string[];
  mixedPolicy: boolean;
  summary: string;
  notes: string[];
}

export interface CostTrackPoint {
  callIndex: number;
  /** How the cost was found; `apiEquivalent` points are drawn apart from billed ones. */
  kind: CostKind;
  status: CostMarkStatus;
  /** The assessed amount, or the low end of a range. */
  total: number | null;
  /** The high end of a range. */
  high: number | null;
  /** Component completeness of a cost the harness recorded. */
  componentStatus: string;
}

export interface EconomicsTrackProjection<T> {
  points: T[];
  maximum: number;
}

export interface CacheTrackProjection extends EconomicsTrackProjection<CacheTrackPoint> {
  presentation: CachePresentationMetadata;
}

const THREE_BUCKET_POLICIES = new Set([
  'anthropic-messages-cache-v1',
  'github-copilot-responses-cache-v1',
]);
const OPENAI_CHAT_POLICY = 'openai-completions-cache-v1';
const OPENAI_RESPONSES_POLICIES = new Set([
  'openai-responses-cache-read-v1',
  'openai-codex-responses-cache-read-v1',
]);

const POLICY_CATEGORIES: Record<string, readonly CacheSegmentKind[]> = Object.fromEntries(
  Object.entries(ECONOMICS_POLICIES).map(([id, policy]) => [id, policy.categories]),
);

const CATEGORY_LABELS: Record<CacheSegmentKind, { label: string; shortLabel: string }> = {
  cacheRead: { label: 'Cache read', shortLabel: 'Read' },
  cacheWrite: { label: 'Cache write', shortLabel: 'Write' },
  fresh: { label: 'Fresh input', shortLabel: 'Fresh' },
  uncached: { label: 'Uncached input', shortLabel: 'Uncached' },
  nonRead: { label: 'Non-cache-read input', shortLabel: 'Non-read' },
};

const CATEGORY_ORDER: CacheSegmentKind[] = [
  'cacheRead',
  'cacheWrite',
  'fresh',
  'uncached',
  'nonRead',
];

export function hasNumericCacheData(analysis: SessionAnalysis): boolean {
  return analysis.modelCalls.some(
    (call) =>
      call.economics.policyId !== null &&
      POLICY_CATEGORIES[call.economics.policyId] !== undefined &&
      call.economics.usageCompleteness === 'complete' &&
      call.economics.promptTokens !== null,
  );
}

export function projectCacheTrack(analysis: SessionAnalysis): CacheTrackProjection {
  const points = analysis.modelCalls.map((call) => projectCacheCall(call, analysis));
  const maximum = points.reduce(
    (current, point) =>
      point.status === 'complete' || point.status === 'zero'
        ? Math.max(current, point.promptTokens ?? 0)
        : current,
    0,
  );
  return { points, maximum, presentation: projectCachePresentation(analysis, points) };
}

export function projectCachePresentation(
  analysis: SessionAnalysis,
  points = analysis.modelCalls.map((call) => projectCacheCall(call, analysis)),
): CachePresentationMetadata {
  const applicablePolicyIds = [
    ...new Set(
      analysis.modelCalls
        .map((call) => call.economics.policyId)
        .filter(
          (policy): policy is string => policy !== null && POLICY_CATEGORIES[policy] !== undefined,
        ),
    ),
  ];
  const pointByCall = new Map(points.map((point) => [point.callIndex, point]));
  const categories = CATEGORY_ORDER.flatMap((kind) => {
    const categoryPolicyIds = applicablePolicyIds.filter((policy) =>
      POLICY_CATEGORIES[policy]?.includes(kind),
    );
    if (categoryPolicyIds.length === 0) return [];
    const categoryPoints = analysis.modelCalls.flatMap((call) => {
      if (!categoryPolicyIds.includes(call.economics.policyId ?? '')) return [];
      const point = pointByCall.get(call.index);
      return point ? [point] : [];
    });
    const applicableCalls = categoryPoints.length;
    const completeCalls = categoryPoints.filter(
      (point) =>
        (point.status === 'complete' || point.status === 'zero') &&
        point.segments.some((segment) => segment.kind === kind),
    ).length;
    const values = categoryPoints.flatMap((point) =>
      point.segments.filter((segment) => segment.kind === kind).map((segment) => segment.value),
    );
    const allCoveredValuesAreZero = values.length > 0 && values.every((value) => value === 0);
    const missingCalls = categoryPoints.filter((point) => point.status === 'missing').length;
    const partialCalls = categoryPoints.filter((point) => point.status === 'partial').length;
    const unsupportedCalls = categoryPoints.filter(
      (point) => point.status === 'unsupported',
    ).length;
    let availability: CacheCategoryAvailability;
    let note = '';
    if (kind === 'cacheWrite' && categoryPolicyIds.includes(OPENAI_CHAT_POLICY)) {
      availability = 'notReported';
      note = 'Chat Completions does not report a separate cache-write bucket.';
    } else if (completeCalls === 0) {
      availability =
        unsupportedCalls === applicableCalls
          ? 'unsupported'
          : missingCalls === applicableCalls
            ? 'missing'
            : missingCalls > 0 || partialCalls > 0 || unsupportedCalls > 0
              ? 'partial'
              : 'missing';
    } else if (
      missingCalls > 0 ||
      partialCalls > 0 ||
      unsupportedCalls > 0 ||
      completeCalls < applicableCalls
    ) {
      availability = 'partial';
    } else {
      availability = allCoveredValuesAreZero ? 'measuredZero' : 'available';
    }
    if (kind === 'nonRead') {
      note = 'Read-only Responses policies cannot establish a separate fresh/write split.';
    }
    if (
      kind === 'cacheWrite' &&
      categoryPolicyIds.some((policy) => OPENAI_RESPONSES_POLICIES.has(policy))
    ) {
      // These read-only Responses policies never contribute a separate write series.
      availability = 'notRetained';
      note = isPiSource(analysis.session.source)
        ? 'The audited read-only policy does not establish separate cache-write detail from Pi.'
        : 'The audited read-only policy does not establish separate cache-write detail from the source.';
    }
    return [
      {
        kind,
        label: CATEGORY_LABELS[kind].label,
        shortLabel: CATEGORY_LABELS[kind].shortLabel,
        applicablePolicyIds: categoryPolicyIds,
        availability,
        completeCalls,
        applicableCalls,
        note,
      },
    ];
  });

  const notes: string[] = [];
  const unsupportedCallCount = analysis.modelCalls.filter(
    (call) =>
      call.economics.policyId === null || call.economics.usageCompleteness === 'unsupported',
  ).length;
  if (applicablePolicyIds.length === 0) {
    notes.push('No supported provider/API cache policy is available for this session.');
  } else if (unsupportedCallCount > 0) {
    notes.push(
      `${unsupportedCallCount} call${unsupportedCallCount === 1 ? '' : 's'} lack a supported cache interpretation; raw call details remain available.`,
    );
  }
  if (applicablePolicyIds.includes(OPENAI_CHAT_POLICY)) {
    notes.push(
      'Chat Completions does not report cache writes separately; its input series is labeled uncached.',
    );
  }
  if (applicablePolicyIds.some((policy) => OPENAI_RESPONSES_POLICIES.has(policy))) {
    notes.push(
      isPiSource(analysis.session.source)
        ? 'Read-only Responses policies: non-cache-read input may include writes; the audited Pi policy does not establish the write/fresh split.'
        : 'Read-only Responses policies: non-cache-read input may include writes; the source policy does not establish the write/fresh split.',
    );
  }
  const mixedPolicy = applicablePolicyIds.length > 1;
  if (mixedPolicy)
    notes.unshift('Categories vary by model/API; each call retains its exact policy semantics.');
  return {
    categories,
    applicablePolicyIds,
    mixedPolicy,
    summary:
      applicablePolicyIds.length === 0
        ? 'Cache categories unavailable under the retained provider/API policy.'
        : mixedPolicy
          ? 'Categories vary by model/API.'
          : 'Categories follow the audited provider/API policy.',
    notes,
  };
}

function projectCacheCall(call: ModelCall, analysis: SessionAnalysis): CacheTrackPoint {
  const economics = call.economics;
  const incomplete = (
    status: Exclude<CacheMarkStatus, 'complete' | 'zero'>,
    note: string,
  ): CacheTrackPoint => ({
    callIndex: call.index,
    status,
    promptTokens: null,
    segments: [],
    shareSegments: [],
    shareStatus: 'unavailable',
    shareDenominator: null,
    note,
    discontinuity: null,
  });

  if (economics.policyId === null || economics.usageCompleteness === 'unsupported') {
    return incomplete(
      'unsupported',
      'Cache policy unsupported; raw fields remain in call details.',
    );
  }
  if (economics.usageCompleteness === 'missing') {
    return incomplete('missing', 'Prompt usage is missing; this is not a numeric zero.');
  }
  if (economics.usageCompleteness !== 'complete' || economics.promptTokens === null) {
    return incomplete(
      'partial',
      'Required prompt buckets are incomplete; no complete stack is shown.',
    );
  }

  const { input, cacheRead, cacheWrite } = call.usage;
  if (input === null || cacheRead === null) {
    return incomplete('partial', 'Required normalized prompt buckets are incomplete.');
  }
  let segments: CacheTrackSegment[];
  let note = '';
  if (THREE_BUCKET_POLICIES.has(economics.policyId)) {
    if (cacheWrite === null) {
      return incomplete('partial', 'Recorded cache-write usage is incomplete.');
    }
    segments = [
      { kind: 'cacheRead', label: 'Cache read', value: cacheRead },
      { kind: 'cacheWrite', label: 'Cache write', value: cacheWrite },
      { kind: 'fresh', label: 'Fresh input', value: input },
    ];
  } else if (economics.policyId === OPENAI_CHAT_POLICY) {
    segments = [
      { kind: 'cacheRead', label: 'Cache read', value: cacheRead },
      { kind: 'uncached', label: 'Uncached input', value: input },
    ];
    note = 'The audited Chat Completions target does not report a separate cache-write bucket.';
  } else if (OPENAI_RESPONSES_POLICIES.has(economics.policyId)) {
    segments = [
      { kind: 'cacheRead', label: 'Cache read', value: cacheRead },
      { kind: 'nonRead', label: 'Non-cache-read input', value: input },
    ];
    note = isPiSource(analysis.session.source)
      ? 'Non-cache-read input may include writes; Pi does not retain the write/fresh split.'
      : 'Non-cache-read input may include writes; the source does not retain the write/fresh split.';
  } else {
    return incomplete(
      'unsupported',
      'Cache policy unsupported; raw fields remain in call details.',
    );
  }

  const status = economics.promptTokens === 0 ? 'zero' : 'complete';
  const shareStatus: CacheShareStatus = economics.promptTokens === 0 ? 'zeroPrompt' : 'complete';
  const shareSegments =
    economics.promptTokens > 0
      ? segments.map((segment) => ({
          ...segment,
          percentage: (segment.value / economics.promptTokens!) * 100,
        }))
      : [];
  return {
    callIndex: call.index,
    status,
    promptTokens: economics.promptTokens,
    segments,
    shareSegments,
    shareStatus,
    shareDenominator: economics.promptTokens,
    note,
    discontinuity: economics.cacheRatioDiscontinuity,
  };
}

export function projectCostTrack(
  analysis: SessionAnalysis,
): EconomicsTrackProjection<CostTrackPoint> {
  const points = analysis.modelCalls.map(projectCostCall);
  const maximum = points.reduce(
    (current, point) =>
      point.status === 'known' || point.status === 'zero'
        ? Math.max(current, point.high ?? point.total ?? 0)
        : current,
    0,
  );
  return { points, maximum };
}

function projectCostCall(call: ModelCall): CostTrackPoint {
  const assessed = call.costAssessment;
  const point = {
    callIndex: call.index,
    kind: assessed.kind,
    componentStatus: assessed.kind === 'recorded' ? call.economics.costCompleteness : 'complete',
  };
  if (assessed.amount !== null) {
    return {
      ...point,
      status: assessed.amount === 0 ? 'zero' : 'known',
      total: assessed.amount,
      high: assessed.amountHigh,
    };
  }
  // No cost could be assessed; recorded components without a total are still partial data.
  const costs = call.cost;
  const hasComponents = costs
    ? [costs.input, costs.output, costs.cacheRead, costs.cacheWrite].some((value) => value !== null)
    : false;
  return { ...point, status: hasComponents ? 'partial' : 'missing', total: null, high: null };
}
