#!/usr/bin/env python3
"""Collect installed runtime dependency licences for the bb package and embedded view."""
import json
from pathlib import Path

plugin = Path(__file__).resolve().parents[1]
root = plugin.parents[1]
packages = {}
def add(directory):
    package = json.loads((directory / 'package.json').read_text())
    packages[(package['name'], package['version'])] = directory
    return package

lock = json.loads((plugin / 'package-lock.json').read_text())
for name, metadata in lock['packages'].items():
    if name and not metadata.get('dev') and not metadata.get('devOptional'):
        add(plugin / name)

web_modules = root / 'web/node_modules'
visited = set()
def web_dependency(name):
    if name in visited:
        return
    visited.add(name)
    package = add(web_modules / name)
    for dependency in package.get('dependencies', {}):
        web_dependency(dependency)

for name in ['d3-array', 'd3-hierarchy', 'd3-scale', 'd3-shape']:
    web_dependency(name)
# The embedded Svelte runtime uses these; its compiler dependencies are not shipped.
for name in ['svelte', 'esm-env', 'clsx']:
    add(web_modules / name)

output = ['# Third-party notices\n\nLicence texts for production npm dependencies and the embedded view libraries. Regenerate with `python3 integrations/bb/scripts/generate-bb-notices.py` after installing both packages.\n']
for (name, version), directory in sorted(packages.items()):
    files = [f for f in directory.iterdir() if f.is_file() and f.name.lower().split('.')[0] in ('license', 'licence', 'copying')]
    if not files:
        raise ValueError(f'Missing licence text: {name}')
    text = files[0].read_text().strip()
    output.append(f'\n## {name} {version}\n\n```text\n{text}\n```\n')
(plugin / 'THIRD_PARTY_NOTICES.md').write_text(''.join(output))
print(f'Collected {len(packages)} dependency notices.')
