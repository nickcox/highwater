// Run from web/: node scripts/measure-maintainability.mjs [--compare|--baseline <git-ref>]
// Synthetic Node/Vite observations, not browser heap or frame-time measurements.
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createServer } from 'vite';

const mode = process.argv[2];
const baselineRef = mode === '--compare' || mode === '--baseline' ? process.argv[3] : null;
if (mode && !baselineRef) throw new Error('Usage: --compare|--baseline <git-ref>');
const baselineSources = new Map();
if (baselineRef) {
  for (const name of ['analysis', 'composition']) {
    baselineSources.set(
      resolve(`src/lib/__baseline-${name}.ts`),
      execFileSync('git', ['show', `${baselineRef}:web/src/lib/${name}.ts`], { encoding: 'utf8' }),
    );
  }
}
const server = await createServer({
  server: { middlewareMode: true },
  plugins: [
    {
      name: 'read-only-maintainability-baseline',
      enforce: 'pre',
      resolveId(source) {
        const id = resolve(source.replace(/^\/src\//, 'src/'));
        return baselineSources.has(id) ? id : null;
      },
      load(id) {
        return baselineSources.get(id);
      },
    },
  ],
});
try {
  const { compositionScenario } = await server.ssrLoadModule(
    '/src/lib/testing/composition-scenarios.ts',
  );
  const currentAnalysis = await server.ssrLoadModule('/src/lib/analysis.ts');
  const currentComposition = await server.ssrLoadModule('/src/lib/composition.ts');
  const input = compositionScenario(404);
  function measure(operation, count = 100) {
    for (let n = 0; n < 10; n++) operation();
    const samples = Array.from({ length: count }, () => {
      const start = performance.now();
      operation();
      return performance.now() - start;
    }).sort((a, b) => a - b);
    return { medianMs: samples[Math.floor(count / 2)], p95Ms: samples[Math.floor(count * 0.95)] };
  }
  function report(
    { indexAnalysis },
    { projectCumulativeComposition, createCompositionProjectionCache },
  ) {
    const indexed = indexAnalysis(input);
    const cache = createCompositionProjectionCache();
    return {
      index: measure(() => indexAnalysis(input)),
      cumulative: measure(() => projectCumulativeComposition(indexed, 4)),
      repeated10000: measure(() => {
        for (let n = 0; n < 10000; n++) cache.get(indexed, 'cumulative', 4);
      }, 20),
      browse300: measure(() => {
        for (let n = 0; n < 300; n++) cache.get(indexed, 'cumulative', (n % 4) + 1);
      }, 20),
      retainedEntries: cache.retainedEntryCount ?? 1,
    };
  }
  const baseline = baselineRef
    ? report(
        await server.ssrLoadModule('/src/lib/__baseline-analysis.ts'),
        await server.ssrLoadModule('/src/lib/__baseline-composition.ts'),
      )
    : null;
  console.log(
    JSON.stringify(
      {
        fixture: {
          calls: input.modelCalls.length,
          items: input.contextItems.length,
          presences: input.modelCalls.reduce((n, call) => n + call.contextItemIds.length, 0),
        },
        baselineRef,
        baseline,
        current: mode === '--baseline' ? null : report(currentAnalysis, currentComposition),
        operationCounts: {
          cumulativeItemCalls: 1616,
          browse300ItemCalls: 303000,
          cacheCapacity: 2,
        },
        note: 'Pre-diagnostic baseline retained count is structurally inferred; current count uses the narrow getter.',
      },
      null,
      2,
    ),
  );
} finally {
  await server.close();
}
