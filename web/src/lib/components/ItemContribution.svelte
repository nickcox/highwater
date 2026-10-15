<script lang="ts">
  export let value: { share: number | null; detail: string };
  export let descriptionId: string;
</script>

<span>
  {#if value.share !== null}
    <span class="track" aria-hidden="true"
      ><span class="fill" style:width={`${value.share * 100}%`}></span></span
    >
  {:else}
    <span class="unknown" aria-hidden="true">Share unavailable</span>
  {/if}
  <span class="detail" id={descriptionId}>{value.detail}</span>
</span>

<style>
  .track {
    display: block;
    height: 3px;
    margin-top: 6px;
    overflow: hidden;
    border-radius: var(--radius-small);
    background: var(--separator);
  }
  .fill {
    display: block;
    height: 100%;
    background: var(--secondary);
  }
  .unknown,
  .detail {
    display: block;
    margin-top: 5px;
    color: var(--secondary);
    font-size: var(--text-xs);
    font-weight: normal;
  }
  .detail {
    display: none;
  }
  :global(button:focus) .detail {
    display: block;
  }
</style>
