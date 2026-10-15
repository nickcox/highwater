<script lang="ts">
  let {
    value,
    descriptionId,
  }: { value: { share: number | null; detail: string }; descriptionId: string } = $props();
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
