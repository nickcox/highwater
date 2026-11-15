import {
  experimental_ThreadContextCardRow as CardRow,
  experimental_Icon as Icon,
  experimental_useAppPanel,
  experimental_useThreadContextKind,
} from '@get-bb/plugin-sdk/app';
import { Button } from '../components/ui/button';
import type { ThreadSummaryData } from '../state';
import { useThreadAnalysis } from './use-thread-analysis';
import { stateMessage } from './ContextState';

export function formatTokens(value: number): string {
  const unit = value >= 1_000_000 ? 1_000_000 : value >= 1000 ? 1000 : 1;
  return (
    new Intl.NumberFormat('en-AU', { maximumFractionDigits: unit === 1 ? 0 : 1 }).format(
      value / unit,
    ) + (unit === 1_000_000 ? 'm' : unit === 1000 ? 'k' : '')
  );
}
/** Points in a 64×18 box; the top of the box is `maximum`, normally bb's context window. */
export function sparklinePoints(series: number[], maximum: number): [number, number][] {
  return series.map((value, index) => [
    series.length === 1 ? 32 : 1 + (index * 62) / (series.length - 1),
    maximum === 0 ? 17 : 17 - (value * 16) / maximum,
  ]);
}
/**
 * Reported input across the session as a filled area under a dashed context-window line, with
 * ticks from the top edge for compactions (like the Context River's markers) and a dot on the
 * latest value. Without a window, the session's peak is
 * the top and no line is drawn.
 */
export function Sparkline({
  series,
  compactionPoints = [],
  contextWindow = null,
  compact = false,
}: {
  series: number[];
  compactionPoints?: number[];
  contextWindow?: number | null;
  compact?: boolean;
}) {
  if (!series.length) return null;
  const maximum = Math.max(contextWindow ?? 0, ...series);
  const points = sparklinePoints(series, maximum);
  const line = points
    .map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(' ');
  const [lastX, lastY] = points[points.length - 1];
  const windowY = contextWindow ? 17 - (contextWindow * 16) / maximum : null;
  return (
    <svg
      width={compact ? 48 : 64}
      height={compact ? 14 : 18}
      viewBox="0 0 64 18"
      role="img"
      aria-label={
        contextWindow
          ? 'Reported input tokens per model call, against the context window'
          : 'Reported input tokens per model call'
      }
      className="shrink-0 text-muted-foreground"
    >
      <title>
        {contextWindow
          ? 'Input per call across the session. Dashed line: context window.'
          : 'Input per call across the session.'}
      </title>
      {windowY !== null && (
        <line
          x1="1"
          x2="63"
          y1={windowY}
          y2={windowY}
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="2 2"
          vectorEffect="non-scaling-stroke"
          data-part="window"
        />
      )}
      {points.length > 1 && (
        <path
          d={`${line} L${lastX.toFixed(2)},17 L${points[0][0].toFixed(2)},17 Z`}
          fill="currentColor"
          fillOpacity="0.25"
          data-part="area"
        />
      )}
      {points.length > 1 && (
        <path
          d={line}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {compactionPoints
        .filter((position) => position < points.length)
        .map((position) => (
          <line
            key={position}
            x1={points[position][0]}
            x2={points[position][0]}
            y1="0"
            y2="5"
            stroke="currentColor"
            strokeWidth="1.25"
            vectorEffect="non-scaling-stroke"
            data-part="compaction"
          />
        ))}
      <circle cx={lastX} cy={lastY} r="1.6" fill="currentColor" data-part="latest" />
    </svg>
  );
}
function signedTokens(value: number): string {
  return `${value > 0 ? '+' : value < 0 ? '−' : '±'}${formatTokens(Math.abs(value))}`;
}
export const GROWTH_EXPLANATION = 'Median growth per call over the last 10 calls';
/** The summary's parts; compactions are left out when there are none. */
function describeParts(data: ThreadSummaryData): { text: string; growth?: true }[] {
  const { callCount, compactionCount, recentGrowth } = data.summary;
  return [
    { text: `${callCount} ${callCount === 1 ? 'call' : 'calls'}` },
    ...(compactionCount > 0
      ? [{ text: `${compactionCount} ${compactionCount === 1 ? 'compaction' : 'compactions'}` }]
      : []),
    ...(recentGrowth === null
      ? []
      : [{ text: `input ${signedTokens(recentGrowth)}/call`, growth: true as const }]),
  ];
}
function describe(data: ThreadSummaryData): string {
  return describeParts(data)
    .map((part) => part.text)
    .join(' · ');
}
/** The summary with its own tooltip on the growth rate, which is not self-explanatory. */
function Detail({ data }: { data: ThreadSummaryData }) {
  return describeParts(data).map((part, index) => (
    <span key={part.text}>
      {index > 0 && ' · '}
      {part.growth ? <span title={GROWTH_EXPLANATION}>{part.text}</span> : part.text}
    </span>
  ));
}
function usagePercent(data: ThreadSummaryData): string | null {
  return data.usage && data.usage.contextWindowTokens > 0
    ? `${Math.round((data.usage.usedTokens / data.usage.contextWindowTokens) * 100)}%`
    : null;
}
function usageText(data: ThreadSummaryData, compact = false): string {
  const percent = usagePercent(data);
  if (!data.usage || percent === null) return 'Usage unavailable';
  return compact
    ? percent
    : `${formatTokens(data.usage.usedTokens)} / ${formatTokens(data.usage.contextWindowTokens)} · ${percent}`;
}
/** Whole thousands above 1,000, so the tooltip's text changes less often. */
function roundedTokens(value: number): string {
  return value >= 1000 ? formatTokens(Math.round(value / 1000) * 1000) : formatTokens(value);
}
/** An estimate for the tooltip only: it assumes the recent rate continues. */
export function forecast(data: ThreadSummaryData): string {
  const growth = data.summary.recentGrowth;
  if (!data.usage || growth === null || growth <= 0) return '';
  const remaining = data.usage.contextWindowTokens - data.usage.usedTokens;
  if (remaining <= 0) return '';
  // Rounded so the tooltip's text changes rarely; a changing title hides a native tooltip.
  const exact = Math.ceil(remaining / growth);
  const calls = exact > 20 ? Math.round(exact / 10) * 10 : exact;
  return ` Full in about ${calls.toLocaleString('en-AU')} ${calls === 1 ? 'call' : 'calls'} at the recent rate.`;
}

function sparklineProps(data: ThreadSummaryData) {
  return {
    series: data.summary.series,
    compactionPoints: data.summary.compactionPoints,
    contextWindow: data.usage?.contextWindowTokens ?? null,
  };
}

function ContextContent({ threadId, compact }: { threadId: string; compact: boolean }) {
  const panel = experimental_useAppPanel();
  const { snapshot } = useThreadAnalysis(threadId, true, 'summary');
  const state = snapshot.summaryState;
  if (state?.state === 'unsupportedAgent' || state?.state === 'noSession') return null;
  const data = snapshot.summary;
  const detail = state ? stateMessage(state).title : data ? describe(data) : 'Loading…';
  const detailNode = !state && data ? <Detail data={data} /> : detail;
  const title = state
    ? stateMessage(state).detail
    : data
      ? data.usage
        ? `${roundedTokens(data.usage.usedTokens)} of ${roundedTokens(data.usage.contextWindowTokens)} tokens (${usagePercent(data)}).${forecast(data)}`
        : 'No current usage from bb.'
      : 'Loading Highwater context summary.';
  const open = () => {
    panel.openTab({ tab: { id: 'context', context: { kind: 'thread' }, availability: 'action' } });
  };
  const trailing =
    !state && data ? (
      <span className="flex min-w-0 items-center gap-2">
        {compact && <Sparkline {...sparklineProps(data)} compact />}
        <span className="whitespace-nowrap tabular-nums">{usageText(data, compact)}</span>
      </span>
    ) : null;
  if (compact)
    return (
      // bb shows plain title tooltips; the Button component does not accept one directly.
      <span className="flex min-w-0" title={title}>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto min-w-0 justify-start gap-2 px-1 py-0.5 text-xs"
          onClick={open}
          aria-description={title}
          aria-label={`Context: ${detail}${!state && data ? `; ${usageText(data)}` : ''}`}
        >
          <Icon name="highwater/gauge" className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate text-muted-foreground">{detailNode}</span>
          {trailing}
        </Button>
      </span>
    );
  return (
    <CardRow
      icon="highwater/gauge"
      label={
        <span className="flex min-w-0 flex-col">
          <span className="flex items-center gap-2">
            Context{!state && data && <Sparkline {...sparklineProps(data)} compact />}
          </span>
          <span className="whitespace-normal text-xs leading-snug text-muted-foreground">
            {detailNode}
          </span>
        </span>
      }
      trailing={trailing}
      title={title}
      onClick={open}
    />
  );
}
export function ContextRow({ threadId }: { threadId: string }) {
  return <ContextContent threadId={threadId} compact={false} />;
}
export function useContextSegmentVisible({ threadId }: { threadId: string }): boolean {
  const kind = experimental_useThreadContextKind();
  const { snapshot } = useThreadAnalysis(threadId, kind === 'banner', 'summary');
  const state = snapshot.summaryState?.state;
  return kind === 'banner' && state !== 'unsupportedAgent' && state !== 'noSession';
}
export function ContextSegment({ threadId }: { threadId: string }) {
  const kind = experimental_useThreadContextKind();
  return kind === 'card' ? null : <ContextContent threadId={threadId} compact />;
}
