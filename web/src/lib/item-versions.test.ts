import { describe, expect, it } from 'vitest';
import { itemVersions, systemPromptChange, versionChain } from './item-versions';
import { indexTestAnalysis } from './testing/wire-analysis';
import { versionScenario } from './testing/version-scenario';

describe('item versions', () => {
  it('links system prompts, and tool definitions with the same tool name, in call order', () => {
    const versions = itemVersions(versionScenario().contextItems);
    expect(versions.get('s1')).toEqual({
      firstId: 's1',
      number: 1,
      count: 3,
      previousId: null,
      nextId: 's2',
    });
    expect(versions.get('s3')).toMatchObject({ firstId: 's1', number: 3, previousId: 's2' });
    expect(versions.get('web2')).toMatchObject({ firstId: 'web1', number: 2, count: 2 });
    for (const id of ['read', 'fetch', 'check', 'user']) expect(versions.has(id)).toBe(false);
  });

  it('leaves out items that are in the same call, because neither replaced the other', () => {
    const analysis = versionScenario();
    const second = analysis.contextItems.find((item) => item.id === 's2')!;
    second.firstModelCall = 1;
    expect(itemVersions(analysis.contextItems).has('s1')).toBe(false);
  });

  it('lists every version from any one of them', () => {
    const indexed = indexTestAnalysis(versionScenario());
    expect(
      versionChain(indexed.itemById, indexed.versionByItemId, 's2').map((item) => item.id),
    ).toEqual(['s1', 's2', 's3']);
    expect(
      versionChain(indexed.itemById, indexed.versionByItemId, 'read').map((item) => item.id),
    ).toEqual(['read']);
  });

  it('puts a new version where the version it replaced was in the stack', () => {
    const indexed = indexTestAnalysis(versionScenario());
    expect(indexed.orderedItemIdsByCall.get(3)).toEqual([
      's2',
      'read',
      'web1',
      'fetch',
      'check',
      'user',
    ]);
    expect(indexed.orderedItemIdsByCall.get(4)).toEqual(['s3', 'read', 'web2', 'check', 'user']);
  });

  it('describes a new system prompt version by the tool changes at the same call', () => {
    const { contextItems } = versionScenario();
    const versions = itemVersions(contextItems);
    expect(systemPromptChange(contextItems, versions, 2)).toBe(
      'tools added: fetch, source_check, web_search',
    );
    expect(systemPromptChange(contextItems, versions, 4)).toBe(
      'tool definitions changed: web_search; tools removed: fetch',
    );
    expect(systemPromptChange(contextItems, versions, 3)).toBe('the prompt text changed');
  });
});
