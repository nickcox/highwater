import type { SessionListItem } from './api/client';

const sameYear = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});
const otherYear = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});
const sizeFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

/** Local date and time, with the year only when it is not the current year. */
export function formatSessionTime(iso: string | null, now = new Date()): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return (date.getFullYear() === now.getFullYear() ? sameYear : otherYear).format(date);
}

export function formatByteSize(bytes: number | null): string | null {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${sizeFormat.format(bytes / 1024)} KB`;
  return `${sizeFormat.format(bytes / (1024 * 1024))} MB`;
}

export function harnessName(session: SessionListItem): string {
  if (session.harness === 'opencode') return 'OpenCode';
  if (session.harness === 'claude-code') return 'Claude Code';
  if (session.harness === 'codex') return 'Codex';
  if (session.harness === 'vscode-copilot') return 'VS Code Copilot';
  return 'Pi';
}

/** Option labels for the picker. Identical labels get the file name (or
 * reference) appended so every option can be told apart. */
export function sessionOptionLabels(
  sessions: readonly SessionListItem[],
  showHarness: boolean,
  now = new Date(),
): Map<string, string> {
  const base = new Map(
    sessions.map((session) => {
      const parts = [session.displayName];
      const started = formatSessionTime(session.startedAt, now);
      if (started) parts.push(started);
      if (session.parentReference)
        parts.push(
          session.subagentType ? `child session · ${session.subagentType}` : 'child session',
        );
      const prefix = showHarness ? `[${harnessName(session)}] ` : '';
      return [session.id, `${prefix}${parts.join(' · ')}`];
    }),
  );
  const counts = new Map<string, number>();
  for (const label of base.values()) counts.set(label, (counts.get(label) ?? 0) + 1);
  return new Map(
    sessions.map((session) => {
      const label = base.get(session.id)!;
      return [
        session.id,
        counts.get(label)! > 1 ? `${label} · ${session.fileName || session.id}` : label,
      ];
    }),
  );
}

/** One line describing the selected session in more detail than its label. */
export function sessionDetailLine(session: SessionListItem, now = new Date()): string {
  return [
    formatSessionTime(session.startedAt, now) &&
      `Started ${formatSessionTime(session.startedAt, now)}`,
    formatSessionTime(session.modifiedAt, now) &&
      `last changed ${formatSessionTime(session.modifiedAt, now)}`,
    formatByteSize(session.byteSize),
    session.workingDirectory,
  ]
    .filter(Boolean)
    .join(' · ');
}
