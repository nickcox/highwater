<script lang="ts">
  let {
    kind,
    direction = undefined,
    size = 22,
    label = undefined,
    svg = false,
    x = undefined,
    y = undefined,
  }: {
    kind: 'compaction' | 'targetChange' | 'ratioChange';
    direction?: 'rise' | 'drop';
    size?: number;
    label?: string;
    /** Chart callers set this so the glyph is positioned in the parent SVG. */
    svg?: boolean;
    x?: number;
    y?: number;
  } = $props();
</script>

{#if svg}
  <g
    class={`event-glyph-svg event-glyph-svg-${kind} ${direction ?? ''}`}
    transform={`translate(${x ?? 0} ${y ?? 0})`}
    aria-label={label}
  >
    {#if kind === 'compaction'}
      <rect x="1" y="1" width={size - 2} height={size - 2} rx="4" class="glyph-compaction" />
      <text x={size / 2} y={size / 2 + 4} text-anchor="middle">C</text>
    {:else if kind === 'targetChange'}
      <path
        d={`M ${size / 2} 1 l ${size / 2 - 1} ${size / 2 - 1} l -${size / 2 - 1} ${size / 2 - 1} l -${size / 2 - 1} -${size / 2 - 1} Z`}
        class="glyph-target"
      />
      <text x={size / 2} y={size / 2 + 4} text-anchor="middle">M</text>
    {:else}
      <circle cx={size / 2} cy={size / 2} r={size / 2 - 2} class="glyph-ratio" />
      <text x={size / 2} y={size / 2 + 4} text-anchor="middle">
        {direction === 'drop' ? '↓' : '↑'}
      </text>
    {/if}
  </g>
{:else}
  <svg
    class={`event-glyph-svg event-glyph-svg-${kind} ${direction ?? ''}`}
    width={size}
    height={size}
    viewBox={`0 0 ${size} ${size}`}
    aria-label={label}
    aria-hidden={label ? undefined : 'true'}
    role={label ? 'img' : undefined}
  >
    {#if kind === 'compaction'}
      <rect x="1" y="1" width={size - 2} height={size - 2} rx="4" class="glyph-compaction" />
      <text x={size / 2} y={size / 2 + 4} text-anchor="middle">C</text>
    {:else if kind === 'targetChange'}
      <path
        d={`M ${size / 2} 1 l ${size / 2 - 1} ${size / 2 - 1} l -${size / 2 - 1} ${size / 2 - 1} l -${size / 2 - 1} -${size / 2 - 1} Z`}
        class="glyph-target"
      />
      <text x={size / 2} y={size / 2 + 4} text-anchor="middle">M</text>
    {:else}
      <circle cx={size / 2} cy={size / 2} r={size / 2 - 2} class="glyph-ratio" />
      <text x={size / 2} y={size / 2 + 4} text-anchor="middle">
        {direction === 'drop' ? '↓' : '↑'}
      </text>
    {/if}
  </svg>
{/if}

<style>
  .event-glyph-svg {
    display: inline-block;
    flex: 0 0 auto;
    overflow: visible;
    vertical-align: middle;
  }
  .event-glyph-svg text {
    fill: #fff;
    font:
      750 9px ui-sans-serif,
      system-ui,
      sans-serif;
    pointer-events: none;
  }
  .glyph-compaction {
    fill: #4b3821;
    stroke: var(--compaction);
    stroke-width: 1.25;
  }
  .glyph-target {
    fill: var(--action);
    stroke: #aad3ef;
    stroke-width: 1.25;
  }
  .glyph-ratio {
    fill: #ffbd64;
    stroke: var(--page);
    stroke-width: 1.25;
  }
  .event-glyph-svg.rise .glyph-ratio {
    fill: #80dcba;
  }
</style>
