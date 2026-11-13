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
export function sparklinePoints(series: number[]): [number, number][] {
  const maximum = Math.max(...series, 0);
  return series.map((value, index) => [
    series.length === 1 ? 32 : 1 + (index * 62) / (series.length - 1),
    maximum === 0 ? 9 : 17 - (value * 16) / maximum,
  ]);
}
export function Sparkline({ series, compact = false }: { series: number[]; compact?: boolean }) {
  if (!series.length) return null;
  const points = sparklinePoints(series);
  return (
    <svg
      width={compact ? 48 : 64}
      height={compact ? 14 : 18}
      viewBox="0 0 64 18"
      role="img"
      aria-label="Reported input tokens per model call"
      className="shrink-0 text-muted-foreground"
    >
      {points.length === 1 ? (
        <circle cx={points[0][0]} cy={points[0][1]} r="1.5" fill="currentColor" />
      ) : (
        <path
          d={points
            .map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`)
            .join(' ')}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}
function describe(data: ThreadSummaryData): string {
  const { callCount, compactionCount, partial } = data.summary;
  return `${callCount} ${callCount === 1 ? 'call' : 'calls'} · ${compactionCount} ${compactionCount === 1 ? 'compaction' : 'compactions'}${partial ? ' · partial' : ''}`;
}
function usageText(data: ThreadSummaryData): string {
  return data.usage
    ? `${formatTokens(data.usage.usedTokens)} / ${formatTokens(data.usage.contextWindowTokens)}`
    : 'Usage unavailable';
}

function ContextContent({ threadId, compact }: { threadId: string; compact: boolean }) {
  const panel = experimental_useAppPanel();
  const { snapshot } = useThreadAnalysis(threadId, true, 'summary');
  const state = snapshot.summaryState;
  if (state?.state === 'unsupportedAgent' || state?.state === 'noSession') return null;
  const data = snapshot.summary;
  const detail = state ? stateMessage(state).title : data ? describe(data) : 'Loading…';
  const title = state
    ? stateMessage(state).detail
    : data
      ? `${describe(data)}. ${data.usage ? `${data.usage.usedTokens.toLocaleString('en-AU')} of ${data.usage.contextWindowTokens.toLocaleString('en-AU')} context tokens, reported by bb.` : 'No current context usage reported by bb.'} The chart uses Highwater’s recorded input tokens.${snapshot.summaryLoading ? ' Updating.' : ''}`
      : 'Loading Highwater context summary.';
  const open = () => {
    panel.openTab({ tab: { id: 'context', context: { kind: 'thread' }, availability: 'action' } });
  };
  const trailing =
    !state && data ? (
      <span className="flex min-w-0 items-center gap-2">
        {compact && <Sparkline series={data.summary.series} compact />}
        <span className="whitespace-nowrap tabular-nums">{usageText(data)}</span>
      </span>
    ) : null;
  if (compact)
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-auto min-w-0 justify-start gap-2 px-1 py-0.5 text-xs"
        onClick={open}
        aria-description={title}
        aria-label={`Context: ${detail}${!state && data ? `; ${usageText(data)}` : ''}`}
      >
        <Icon name="ChartNoAxesCombined" className="size-3.5 shrink-0" aria-hidden />
        <span>Context</span>
        <span className="truncate text-muted-foreground">{detail}</span>
        {trailing}
      </Button>
    );
  return (
    <CardRow
      icon="ChartNoAxesCombined"
      label={
        <span className="flex min-w-0 flex-col">
          <span className="flex items-center gap-2">
            Context{!state && data && <Sparkline series={data.summary.series} compact />}
          </span>
          <span className="whitespace-normal text-xs leading-snug text-muted-foreground">
            {detail}
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
