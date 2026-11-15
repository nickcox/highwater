<script lang="ts">
  import type { IndexedAnalysis, ModelCall } from '../types';
  import { displayItemLabel } from '../item-label';
  import { formatAssessedCost } from '../cost-assessment';
  import { projectCallComposition, rankCompositionItems } from '../composition';
  import { formatInteger, formatMetric, formatPercent } from '../context-river/format';
  import { changeTokens, largestFirst } from './item-contribution';

  const LIMIT = 5;

  let {
    indexed,
    call,
    following = false,
    twoColumns = false,
    onSelectItem = () => {},
    onViewDetails = () => {},
    onShowComposition = () => {},
  }: {
    indexed: IndexedAnalysis;
    call: ModelCall | null;
    following?: boolean;
    /** Show the two lists side by side; the session view decides this with the summary. */
    twoColumns?: boolean;
    onSelectItem?: (id: string) => void;
    onViewDetails?: () => void;
    onShowComposition?: () => void;
  } = $props();

  let previousCall = $derived.by(() => {
    if (!call) return null;
    const position = indexed.analysis.modelCalls.findIndex((value) => value.index === call.index);
    return position > 0 ? indexed.analysis.modelCalls[position - 1] : null;
  });
  let inputChange = $derived(
    call?.reportedPromptTokens != null && previousCall?.reportedPromptTokens != null
      ? call.reportedPromptTokens - previousCall.reportedPromptTokens
      : null,
  );
  // Added items use this call's estimates; dropped items use the previous call's.
  let added = $derived(changeTokens(indexed, call?.addedItemIds ?? [], call));
  let dropped = $derived(changeTokens(indexed, call?.droppedItemIds ?? [], previousCall));
  let addedIds = $derived(largestFirst(call?.addedItemIds ?? [], added.items));
  let droppedIds = $derived(largestFirst(call?.droppedItemIds ?? [], dropped.items));
  let largest = $derived(
    call
      ? rankCompositionItems(projectCallComposition(indexed, call.index)?.items ?? []).slice(
          0,
          LIMIT,
        )
      : [],
  );
  let tools = $derived.by(() => {
    const counts = new Map<string, { count: number; failed: boolean }>();
    for (const tool of call?.toolCallsAfter ?? []) {
      const current = counts.get(tool.name) ?? { count: 0, failed: false };
      counts.set(tool.name, { count: current.count + 1, failed: current.failed || tool.failed });
    }
    return [...counts].map(([name, value]) => ({ name, ...value }));
  });

  function label(id: string): string {
    return displayItemLabel(indexed.itemById.get(id), id);
  }
  function changeCount(
    count: number,
    verb: string,
    change: { total: number; complete: boolean },
  ): string {
    if (count === 0) return `0 ${verb}`;
    return `${formatInteger(count)} ${verb} (≈ ${formatMetric(change.total)}${change.complete ? '' : ', partial'})`;
  }
  function signed(value: number): string {
    return `${value > 0 ? '+' : value < 0 ? '−' : '±'}${formatMetric(Math.abs(value))}`;
  }
</script>

<section class="panel call-overview" aria-labelledby="call-overview-heading">
  <div class="heading">
    <h2 id="call-overview-heading">
      {call ? (following ? 'Latest call' : `Call ${call.index}`) : 'Latest call'}
    </h2>
    {#if call}
      <span class="model"
        >{call.provider ?? 'Unknown provider'} / {call.model ?? 'Unknown model'}</span
      >
      <button type="button" onclick={onViewDetails}>View details</button>
    {/if}
  </div>

  {#if !call}
    <p class="empty">
      {indexed.analysis.modelCalls.length === 0
        ? 'No model calls yet.'
        : 'Select a call in the chart to see it here.'}
    </p>
  {:else}
    <dl class="figures">
      <div>
        <dt>Call</dt>
        <dd>{call.index} of {formatInteger(indexed.analysis.modelCalls.length)}</dd>
      </div>
      <div>
        <dt>Input</dt>
        <dd>
          {call.usage.placeholder ? 'Unavailable' : formatMetric(call.reportedPromptTokens)}
          {#if inputChange !== null && !call.usage.placeholder}
            <small title={`Change since call ${previousCall?.index}`}>{signed(inputChange)}</small>
          {/if}
        </dd>
      </div>
      <div>
        <dt>Cost</dt>
        <dd>{call.usage.placeholder ? 'Unavailable' : formatAssessedCost(call.costAssessment)}</dd>
      </div>
    </dl>

    <div class="lists" class:two-columns={twoColumns}>
      <div>
        <h3 title="Highwater's token estimates; they need not match the reported change in input.">
          Context changes · {changeCount(call.addedItemIds.length, 'added', added)} · {changeCount(
            call.droppedItemIds.length,
            'dropped',
            dropped,
          )}
        </h3>
        {#if call.addedItemIds.length === 0 && call.droppedItemIds.length === 0}
          <p class="empty">No items added or dropped.</p>
        {:else}
          <ul role="list">
            {#each addedIds.slice(0, LIMIT) as id (id)}
              {@const size = added.items.get(id)}
              <li>
                <span class="change added" aria-hidden="true">+</span>
                <button type="button" onclick={() => onSelectItem(id)}
                  ><span class="visually-hidden">Added </span>{label(id)}</button
                >
                <span class="size" title={size?.partial ? 'Partial or missing estimate' : undefined}
                  >{size?.tokens == null ? 'Unknown' : formatMetric(size.tokens)}</span
                >
              </li>
            {/each}
            {#if call.addedItemIds.length > LIMIT}
              <li class="more">{formatInteger(call.addedItemIds.length - LIMIT)} more added</li>
            {/if}
            {#each droppedIds.slice(0, LIMIT) as id (id)}
              {@const size = dropped.items.get(id)}
              <li>
                <span class="change dropped" aria-hidden="true">−</span>
                <button type="button" onclick={() => onSelectItem(id)}
                  ><span class="visually-hidden">Dropped </span>{label(id)}</button
                >
                <span class="size" title={size?.partial ? 'Partial or missing estimate' : undefined}
                  >{size?.tokens == null ? 'Unknown' : formatMetric(size.tokens)}</span
                >
              </li>
            {/each}
            {#if call.droppedItemIds.length > LIMIT}
              <li class="more">
                {formatInteger(call.droppedItemIds.length - LIMIT)} more dropped
              </li>
            {/if}
          </ul>
        {/if}
      </div>

      <div>
        <h3>Largest items in context</h3>
        {#if largest.length === 0}
          <p class="empty">No item estimates at this call.</p>
        {:else}
          <ol role="list">
            {#each largest as item (item.id)}
              <li>
                <button type="button" onclick={() => onSelectItem(item.id)}>{item.label}</button>
                <span class="size"
                  >{formatMetric(item.tokens)}{item.share === null
                    ? ''
                    : ` · ${formatPercent(item.share)}`}</span
                >
              </li>
            {/each}
          </ol>
          <button type="button" class="link" onclick={onShowComposition}
            >Show all in Composition</button
          >
        {/if}
      </div>
    </div>

    {#if tools.length > 0}
      <div class="tools">
        <h3>Tools invoked after this response</h3>
        <div class="tool-list">
          {#each tools as tool (tool.name)}
            <span class="tool-chip" class:failed={tool.failed}
              >{tool.name}{tool.count > 1 ? ` × ${tool.count}` : ''}{tool.failed
                ? ' · failed'
                : ''}</span
            >
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</section>

<style>
  .panel {
    background: var(--surface);
    border-radius: var(--radius);
    padding: var(--panel-padding);
    min-width: 0;
  }
  .heading {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 12px;
  }
  h2 {
    margin: 0;
    font-size: var(--text-lg);
  }
  .model {
    color: var(--secondary);
    font-size: var(--text-sm);
    overflow-wrap: anywhere;
  }
  .heading button {
    margin-left: auto;
  }
  .figures {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px 16px;
    margin: 12px 0 0;
  }
  .figures dt {
    color: var(--secondary);
    font-size: var(--text-sm);
  }
  .figures dd {
    margin: 0;
    color: var(--text-strong);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .figures small {
    margin-left: 4px;
    color: var(--secondary);
    font-weight: 400;
  }
  .lists {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px 24px;
    margin-top: 14px;
  }
  .lists.two-columns {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  h3 {
    margin: 0 0 6px;
    color: var(--text-strong);
    font-size: var(--text-sm);
  }
  ul,
  ol {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: flex;
    align-items: baseline;
    gap: 6px;
    min-width: 0;
    padding: 2px 0;
  }
  li button {
    min-width: 0;
    padding: 0;
    overflow: hidden;
    border: 0;
    background: transparent;
    color: var(--text);
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  li button:hover {
    color: var(--accent);
    text-decoration: underline;
  }
  .change {
    flex: none;
    width: 1ch;
    font-weight: 700;
  }
  .added {
    color: var(--accent);
  }
  .dropped {
    color: var(--secondary);
  }
  .size {
    flex: none;
    margin-left: auto;
    color: var(--secondary);
    font-size: var(--text-sm);
    font-variant-numeric: tabular-nums;
  }
  .more,
  .empty {
    color: var(--secondary);
    font-size: var(--text-sm);
  }
  .empty {
    margin: 8px 0 0;
  }
  .link {
    margin-top: 6px;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--accent);
    font-size: var(--text-sm);
  }
  .tools {
    margin-top: 14px;
  }
  .tool-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .tool-chip {
    padding: 2px 8px;
    border: 1px solid var(--separator);
    border-radius: 999px;
    font-size: var(--text-sm);
  }
  .tool-chip.failed {
    border-color: var(--error);
    color: var(--error);
  }
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
</style>
