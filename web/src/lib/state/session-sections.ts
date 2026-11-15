/** The parts of the session view that a host can order. */
export type SectionId = 'summary' | 'call' | 'chart' | 'details' | 'lifespans';

const SECTION_IDS: readonly SectionId[] = ['summary', 'call', 'chart', 'details', 'lifespans'];

/** The standalone viewer's order, and the default for embeds. */
export const STANDARD_SECTIONS: readonly SectionId[] = ['summary', 'chart', 'details', 'lifespans'];
/** A narrow side panel beside a live thread: the selected call comes before the chart. */
export const PANEL_SECTIONS: readonly SectionId[] = [
  'summary',
  'call',
  'chart',
  'details',
  'lifespans',
];

/**
 * Make a requested order usable: unknown and repeated IDs are dropped, and sections of the preset
 * that are missing are added after the preset section that precedes them. A saved order therefore
 * still shows sections added in later versions.
 */
export function normaliseSections(
  requested: readonly unknown[] | undefined,
  preset: readonly SectionId[] = STANDARD_SECTIONS,
): SectionId[] {
  const result: SectionId[] = [];
  for (const id of requested ?? preset) {
    if (SECTION_IDS.includes(id as SectionId) && !result.includes(id as SectionId))
      result.push(id as SectionId);
  }
  preset.forEach((id, position) => {
    if (result.includes(id)) return;
    const before = preset
      .slice(0, position)
      .reverse()
      .find((candidate) => result.includes(candidate));
    result.splice(before === undefined ? 0 : result.indexOf(before) + 1, 0, id);
  });
  return result;
}

const fullWidth = new Set<SectionId>(['summary', 'call']);

/**
 * Grid positions for a wide view with a selection, where details sit in a second column beside
 * the column-one sections next to them in the order. Narrow views ignore these and use the order.
 */
export function wideSectionPlacement(
  sections: readonly SectionId[],
): Map<SectionId, { column: string; row: string }> {
  const placement = new Map<SectionId, { column: string; row: string }>();
  const at = sections.indexOf('details');
  const besideColumn = (id: SectionId | undefined) => id !== undefined && !fullWidth.has(id);
  const beside = at >= 0 && (besideColumn(sections[at - 1]) || besideColumn(sections[at + 1]));
  const others = beside ? sections.filter((id) => id !== 'details') : sections;
  others.forEach((id, position) =>
    placement.set(id, {
      column: fullWidth.has(id) || id === 'details' ? '1 / -1' : '1',
      row: String(position + 1),
    }),
  );
  if (!beside) return placement;
  // Details span the run of column-one sections that contains their neighbours in the order.
  const neighbour = besideColumn(sections[at - 1]) ? sections[at - 1] : sections[at + 1];
  let first = others.indexOf(neighbour);
  let last = first;
  while (first > 0 && besideColumn(others[first - 1])) first -= 1;
  while (last < others.length - 1 && besideColumn(others[last + 1])) last += 1;
  placement.set('details', { column: '2', row: `${first + 1} / span ${last - first + 1}` });
  return placement;
}
