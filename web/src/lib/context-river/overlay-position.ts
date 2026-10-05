import type { EconomicsEventBreakdown } from './economics-track';

function trackElement(host: HTMLElement): SVGSVGElement | null {
  return host.querySelector<SVGSVGElement>('.economics-track-svg');
}

function anchorPoint(host: HTMLElement, breakdown: EconomicsEventBreakdown) {
  const track = trackElement(host);
  if (!track) return null;
  const bounds = track.getBoundingClientRect();
  const width = Number(track.getAttribute('width')) || track.viewBox.baseVal.width;
  const scaleX = width > 0 ? bounds.width / width : 1;
  const scaleY =
    track.viewBox.baseVal.height > 0 ? bounds.height / track.viewBox.baseVal.height : 1;
  return {
    x: bounds.left + breakdown.anchorX * scaleX,
    y: bounds.top + breakdown.anchorY * scaleY,
  };
}

export function economicsAnchorVisible(
  host: HTMLElement,
  breakdown: EconomicsEventBreakdown,
): boolean {
  const point = anchorPoint(host, breakdown);
  if (!point) return false;
  const bounds = host.getBoundingClientRect();
  const plot = host.parentElement?.getBoundingClientRect();
  const left = Math.max(0, bounds.left, plot?.left ?? -Infinity);
  const right = Math.min(window.innerWidth, bounds.right, plot?.right ?? Infinity);
  const top = Math.max(0, bounds.top, plot?.top ?? -Infinity);
  const bottom = Math.min(window.innerHeight, bounds.bottom, plot?.bottom ?? Infinity);
  return (
    right >= left &&
    bottom >= top &&
    point.x >= left &&
    point.x <= right &&
    point.y >= top &&
    point.y <= bottom
  );
}

/** Measure at the DOM boundary; preserve the original lane-relative/clamped placement. */
export function positionEconomicsBreakdown(
  host: HTMLElement,
  element: HTMLElement | null,
  breakdown: EconomicsEventBreakdown | null,
): string {
  if (!breakdown || !element || window.innerWidth <= 620) return '';
  const point = anchorPoint(host, breakdown);
  const track = trackElement(host);
  if (!point || !track) return '';
  const trackBounds = track.getBoundingClientRect();
  const elementBounds = element.getBoundingClientRect();
  const hostBounds = host.getBoundingClientRect();
  const width = Math.min(300, Math.max(120, elementBounds.width || 300));
  const height = elementBounds.height || 160;
  const minLeft = Math.max(8, hostBounds.left + 8);
  const maxLeft = Math.max(
    minLeft,
    Math.min(window.innerWidth - width - 8, hostBounds.right - width - 8),
  );
  const left = Math.max(minLeft, Math.min(maxLeft, point.x - width / 2));
  const scaleY =
    track.viewBox.baseVal.height > 0 ? trackBounds.height / track.viewBox.baseVal.height : 1;
  const laneTop = trackBounds.top + breakdown.laneTop * scaleY;
  const laneBottom = trackBounds.top + (breakdown.laneTop + breakdown.laneHeight) * scaleY;
  const below = laneBottom + 8;
  const above = laneTop - height - 8;
  const top =
    below + height <= window.innerHeight - 8
      ? below
      : above >= 8
        ? above
        : Math.max(8, Math.min(window.innerHeight - height - 8, below));
  return `left:${left}px;top:${top}px;width:${width}px`;
}
