import type { ViewLinkState } from './view-link';

/** Navigation state observed by the standalone page, without owning the page address. */
export interface SessionViewSnapshot {
  linkedView: ViewLinkState;
  navigationRevision: number;
  riverReady: boolean;
  settled: boolean;
}
