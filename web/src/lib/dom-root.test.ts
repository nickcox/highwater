import { describe, expect, it } from 'vitest';
import { domRoot } from './dom-root';

describe('domRoot', () => {
  it('uses the document for standalone elements', () => {
    const node = document.createElement('div');
    document.body.append(node);
    expect(domRoot(node)).toBe(document);
    node.remove();
  });

  it('finds elements and focus within the owning shadow root', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = host.attachShadow({ mode: 'open' });
    const button = document.createElement('button');
    button.id = 'root-local-button';
    root.append(button);
    button.focus();
    expect(domRoot(button)).toBe(root);
    expect(domRoot(button).getElementById(button.id)).toBe(button);
    expect(domRoot(button).activeElement).toBe(button);
    expect(document.activeElement).toBe(host);
    host.remove();
  });

  it('uses the owner document for a detached element', () => {
    expect(domRoot(document.createElement('div'))).toBe(document);
  });
});
