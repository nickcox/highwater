import type { ThreadState } from '../state';
import { Button } from '../components/ui/button';

export function stateMessage(state: ThreadState): { title: string; detail: string } {
  switch (state.state) {
    case 'unknownThread':
      return { title: 'Thread not found', detail: 'This thread is no longer available in bb.' };
    case 'unsupportedAgent':
      return {
        title: 'Agent not supported',
        detail: `Highwater currently supports Pi and Claude Code, not ${state.providerId}.`,
      };
    case 'noEnvironment':
      return {
        title: 'No machine assigned',
        detail: 'This thread needs an environment before Highwater can find its session.',
      };
    case 'noSession':
      return {
        title: 'No session yet',
        detail:
          'The context view appears after the first model call. After clearing context, send a new prompt to start a session.',
      };
    case 'binaryMissing':
      return {
        title: 'Highwater not installed',
        detail:
          'During development, install Highwater on the agent’s machine or set Highwater binary in the plugin settings.',
      };
    case 'unsupportedVersion':
      return {
        title: 'Highwater version not supported',
        detail: `Found ${state.version}. This plugin requires ${state.accepted}. Choose a compatible binary in the plugin settings.`,
      };
    case 'startFailed':
      return { title: 'Highwater could not start', detail: state.message };
    case 'sessionNotFound':
      return {
        title: 'Session file not found',
        detail: `Highwater could not find session ${state.providerThreadId}. New session files can take a moment to appear.`,
      };
    case 'error':
      return { title: 'Analysis could not be updated', detail: state.message };
  }
}
export function ContextState({
  state,
  loading,
  previous,
  retry,
}: {
  state: ThreadState | null;
  loading: boolean;
  previous: boolean;
  retry: () => void;
}) {
  if (!state)
    return (
      <div className="p-4 text-sm text-muted-foreground" role="status">
        Analysing session…
      </div>
    );
  const message = stateMessage(state);
  return (
    <section
      className="space-y-3 p-4 text-sm text-foreground"
      role={state.state === 'error' ? 'alert' : 'status'}
    >
      <h2 className="font-medium">{message.title}</h2>
      <p className="break-words text-muted-foreground">
        {message.detail}
        {previous ? ' Showing the previous analysis.' : ''}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" disabled={loading} onClick={retry}>
          {loading ? 'Updating…' : 'Retry'}
        </Button>
        {state.state === 'binaryMissing' && (
          <a
            className="text-primary underline"
            href="https://github.com/nickcox/highwater#install"
            target="_blank"
            rel="noreferrer"
          >
            Install instructions
          </a>
        )}
      </div>
    </section>
  );
}
