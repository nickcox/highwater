/** Find elements and focus in the document or shadow root that owns a mounted view. */
export function domRoot(node: Node | null | undefined): Document | ShadowRoot {
  const root = node?.getRootNode();
  return root instanceof Document || root instanceof ShadowRoot
    ? root
    : (node?.ownerDocument ?? document);
}
