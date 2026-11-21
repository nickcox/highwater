import { experimental_useCodeTheme, experimental_usePluginId } from '@get-bb/plugin-sdk/app';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Button } from '../components/ui/button';
import type { ContextComposition } from '../state';
import { contextItemPresentation } from '../vendor/highwater-embed';

const percentFormat = new Intl.NumberFormat('en-AU', {
  style: 'percent',
  maximumFractionDigits: 1,
});

export function CompactContextSummary({
  composition,
  usagePercent,
  usageHeading,
  usageForecast,
  onOpen,
}: {
  composition?: ContextComposition;
  usagePercent: string | null;
  usageHeading: string;
  usageForecast: string;
  onOpen: () => void;
}) {
  const { mode } = experimental_useCodeTheme();
  const pluginId = experimental_usePluginId();
  const total = composition?.segments.reduce((sum, segment) => sum + segment.tokens, 0) ?? 0;
  const segments = composition?.segments.map(({ kind, tokens }) => ({
    kind,
    tokens,
    share: tokens / total,
    ...contextItemPresentation(kind, mode),
  }));
  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto shrink-0 gap-2 px-1 py-0.5 text-xs tabular-nums"
            onClick={onOpen}
            aria-label={
              usagePercent
                ? `Open Context tab, ${usagePercent} of the context window used`
                : 'Open Context tab, usage unavailable'
            }
          >
            {segments && (
              <span
                className="flex h-[7px] w-[72px] shrink-0 overflow-hidden rounded"
                aria-hidden="true"
                data-context-composition=""
              >
                {segments.map(({ kind, share, colour }) => (
                  <span key={kind} style={{ width: `${share * 100}%`, background: colour }} />
                ))}
              </span>
            )}
            {usagePercent ?? 'Usage unavailable'}
          </Button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            sideOffset={5}
            collisionPadding={8}
            data-bb-portaled-overlay=""
            data-bb-plugin-root=""
            data-bb-plugin={pluginId}
            className="z-50 max-w-[min(360px,var(--radix-tooltip-content-available-width))] rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
          >
            <p className="text-sm font-semibold">{usageHeading}</p>
            {usageForecast && <p className="mt-0.5 text-muted-foreground">{usageForecast}</p>}
            {segments && (
              <>
                <p className="mt-2 font-medium">Latest call · share of estimated input tokens</p>
                <dl className="mt-1 space-y-0.5">
                  {segments.map(({ kind, tokens, share, label, colour }) => (
                    <div key={kind} className="flex items-baseline justify-between gap-3">
                      <dt>
                        <span
                          aria-hidden="true"
                          className="mr-1.5 inline-block size-2 rounded-sm"
                          style={{ background: colour }}
                        />
                        {label}
                      </dt>
                      <dd className="shrink-0 tabular-nums">
                        {share < 0.001 ? '<0.1%' : percentFormat.format(share)}{' '}
                        <span className="text-muted-foreground">
                          ({tokens.toLocaleString('en-AU')})
                        </span>
                      </dd>
                    </div>
                  ))}
                </dl>
                {composition?.incomplete && (
                  <p className="mt-2 text-muted-foreground">
                    Some items have partial or missing token estimates.
                  </p>
                )}
              </>
            )}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
