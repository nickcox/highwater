import { useEffect, useRef } from 'react';
import { experimental_useCodeTheme, experimental_useTabVisible } from '@get-bb/plugin-sdk/app';
import { mountHighwater, sectionPresets, type HighwaterEmbed } from '../vendor/highwater-embed';
import { useThreadAnalysis } from './use-thread-analysis';
import { ContextState } from './ContextState';
import pinned from '../host/binary-release.json';

export function ContextTab({ threadId }: { threadId: string }) {
  const visible = experimental_useTabVisible();
  const { mode } = experimental_useCodeTheme();
  const { thread, snapshot, pluginId } = useThreadAnalysis(threadId, visible);
  const target = useRef<HTMLDivElement>(null);
  const view = useRef<HighwaterEmbed | null>(null);
  const refreshedCycle = useRef(0);
  const hasAnalysis = snapshot.analysis !== null;
  const version = snapshot.analysis?.version ?? null;
  const theme = useRef(mode);
  theme.current = mode;

  useEffect(() => {
    if (!hasAnalysis || !target.current) return;
    let deliveredRevision = 0;
    const handle = mountHighwater({
      target: target.current,
      preferencesKey: `${pluginId}.highwater.presentation.v1`,
      theme: theme.current,
      sections: sectionPresets.panel,
      density: 'compact',
      // Following shows recent calls, so scale the River to them.
      defaultVerticalScale: 'visible',
      loadAnalysis: async (signal, etag) => {
        try {
          return await thread.read(signal, etag, deliveredRevision);
        } finally {
          deliveredRevision = thread.getSnapshot().revision;
        }
      },
    });
    view.current = handle;
    refreshedCycle.current = thread.getSnapshot().cycle;
    return () => {
      view.current = null;
      handle.destroy();
    };
  }, [thread, pluginId, hasAnalysis]);
  useEffect(() => {
    view.current?.setTheme(mode);
  }, [mode]);
  useEffect(() => {
    if (visible && view.current && snapshot.analysis && refreshedCycle.current !== snapshot.cycle) {
      refreshedCycle.current = snapshot.cycle;
      view.current.refresh();
    }
  }, [snapshot, visible]);

  return (
    <div className="h-full min-h-0 overflow-auto text-foreground" data-highwater-thread={threadId}>
      {!hasAnalysis && (
        <ContextState
          state={snapshot.state}
          loading={snapshot.loading}
          previous={hasAnalysis}
          retry={() => thread.request({ retry: true })}
        />
      )}
      {version !== null && version !== pinned.version && (
        <p className="px-3 pt-3 text-xs text-muted-foreground" role="note">
          Using Highwater {version} from the Highwater binary setting. This plugin was built for{' '}
          {pinned.version}, so some views may not work.
        </p>
      )}
      <div ref={target} hidden={!hasAnalysis} className="bg-transparent" />
    </div>
  );
}
