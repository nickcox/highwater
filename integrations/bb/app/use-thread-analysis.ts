import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import {
  experimental_usePluginId,
  useRealtime,
  useRealtimeConnectionState,
} from '@get-bb/plugin-sdk/app';
import { getThreadAnalysis, type Interest } from './thread-analysis';

export function useThreadAnalysis(
  threadId: string,
  visible: boolean,
  interest: Interest = 'analysis',
) {
  const pluginId = experimental_usePluginId();
  const thread = useMemo(() => getThreadAnalysis(pluginId, threadId), [pluginId, threadId]);
  useEffect(() => thread.retain(), [thread]);
  const subscribe = useCallback(
    (listener: () => void) => (visible ? thread.subscribe(listener, interest) : () => {}),
    [thread, visible, interest],
  );
  const snapshot = useSyncExternalStore(subscribe, thread.getSnapshot, thread.getSnapshot);
  useRealtime('thread-advanced', (payload) => {
    if (!visible || typeof payload !== 'object' || !payload) return;
    if (interest === 'summary' && thread.getSnapshot().summaryState?.state === 'unsupportedAgent')
      return;
    if (
      'threadId' in payload &&
      payload.threadId === threadId &&
      'idle' in payload &&
      typeof payload.idle === 'boolean'
    )
      thread.request({ idle: payload.idle });
  });
  const connection = useRealtimeConnectionState();
  const wasConnected = useRef(false);
  const previousConnection = useRef(connection);
  useEffect(() => {
    if (connection === 'connected') {
      if (visible && wasConnected.current && previousConnection.current !== 'connected')
        thread.request();
      wasConnected.current = true;
    }
    previousConnection.current = connection;
  }, [connection, thread, visible]);
  return { thread, snapshot, pluginId };
}
