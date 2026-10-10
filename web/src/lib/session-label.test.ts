import { describe, expect, it } from 'vitest';
import type { SessionListItem } from './api/client';
import {
  formatByteSize,
  formatSessionTime,
  sessionDetailLine,
  sessionOptionLabels,
} from './session-label';

const now = new Date(2026, 9, 11, 12, 0);
const session = (overrides: Partial<SessionListItem>): SessionListItem => ({
  id: 'pi-one',
  harness: 'pi',
  displayName: 'TokenPlume · 01a11eea',
  fileName: 'one.jsonl',
  workingDirectory: '/code/TokenPlume',
  startedAt: null,
  modifiedAt: null,
  byteSize: null,
  ...overrides,
});

describe('session labels', () => {
  it('formats start times in local time, with the year only when it differs', () => {
    const thisYear = new Date(2026, 9, 9, 15, 27).toISOString();
    const lastYear = new Date(2025, 0, 2, 8, 5).toISOString();
    expect(formatSessionTime(thisYear, now)).not.toMatch(/2026/);
    expect(formatSessionTime(thisYear, now)).toMatch(/9/);
    expect(formatSessionTime(lastYear, now)).toMatch(/2025/);
    expect(formatSessionTime(null, now)).toBeNull();
    expect(formatSessionTime('not a date', now)).toBeNull();
  });

  it('formats file sizes', () => {
    expect(formatByteSize(512)).toBe('512 B');
    expect(formatByteSize(2_126_721)).toMatch(/^2(\.0)? MB$/);
    expect(formatByteSize(null)).toBeNull();
  });

  it('adds the harness and start time, and disambiguates identical labels', () => {
    const started = new Date(2026, 9, 9, 15, 27).toISOString();
    const labels = sessionOptionLabels(
      [
        session({ id: 'pi-a', startedAt: started, fileName: 'a.jsonl' }),
        session({ id: 'pi-b', startedAt: started, fileName: 'b.jsonl' }),
        session({
          id: 'opencode-c',
          harness: 'opencode',
          displayName: 'Fix tests',
          parentReference: 'x',
        }),
      ],
      true,
      now,
    );
    expect(labels.get('pi-a')).toMatch(/^\[Pi\] TokenPlume · 01a11eea · .+ · a\.jsonl$/);
    expect(labels.get('pi-b')).toMatch(/· b\.jsonl$/);
    expect(labels.get('opencode-c')).toBe('[OpenCode] Fix tests · child session');
  });

  it('describes the selected session in one line', () => {
    const line = sessionDetailLine(
      session({ startedAt: new Date(2026, 9, 9, 15, 27).toISOString(), byteSize: 2048 }),
      now,
    );
    expect(line).toMatch(/^Started .+ · 2 KB · \/code\/TokenPlume$/);
  });
});
