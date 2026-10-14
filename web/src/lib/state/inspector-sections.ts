// Fixed per-session section choices, independent of selected identities and panel lifetime.
export function inspectorSections() {
  return {
    preview: false,
    expandedPreview: false,
    basis: false,
    diagnostics: false,
    identifiers: false,
    changes: false,
    usage: false,
    estimator: false,
  };
}
export type InspectorSections = ReturnType<typeof inspectorSections>;

export function rememberSection(
  node: HTMLDetailsElement,
  options: { state: InspectorSections; key: keyof InspectorSections },
) {
  node.open = options.state[options.key];
  const toggle = () => {
    options.state[options.key] = node.open;
  };
  node.addEventListener('toggle', toggle);
  return {
    update(next: typeof options) {
      if (next.state !== options.state || next.key !== options.key) {
        options = next;
        node.open = options.state[options.key];
      }
    },
    destroy() {
      options.state[options.key] = node.open;
      node.removeEventListener('toggle', toggle);
    },
  };
}
