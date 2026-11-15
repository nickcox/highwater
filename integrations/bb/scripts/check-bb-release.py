#!/usr/bin/env python3
"""Check crate/plugin release versions and the binary pin without network access.

With --plugin-tag, also check that the tag names the plugin version, that the pin is that
same Highwater release, and that the tagged commit differs from the Highwater release tag
only in the pin file, so the vendored UI was built from the same source as the binary.
"""
import argparse
import json
import re
import subprocess
from pathlib import Path

package = Path(__file__).resolve().parents[1]
repository = package.parents[1]
PIN = 'integrations/bb/host/binary-release.json'

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--plugin-tag', help='The bb-plugin-vX.Y.Z tag being released')
args = parser.parse_args()

crate = re.search(r'^version = "([^"]+)"', (repository / 'Cargo.toml').read_text(), re.M).group(1)
plugin = json.loads((package / 'package.json').read_text())['version']
assert crate == plugin, f'Crate {crate} and plugin {plugin} versions differ'
pin = json.loads((repository / PIN).read_text())
version = tuple(int(part) for part in pin['version'].split('.')) if re.fullmatch(r'\d+\.\d+\.\d+', pin['version']) else None
assert version, 'Invalid pinned version'
# Between a Highwater release and its plugin tag, the pin is the previous release.
assert version <= tuple(int(part) for part in plugin.split('.')), f'Pinned {pin["version"]} is newer than plugin {plugin}'
platforms = {'darwin-arm64', 'darwin-x64', 'linux-arm64', 'linux-x64', 'win32-x64'}
assert set(pin['platforms']) == platforms, 'Incomplete release platform pins'
for key, asset in pin['platforms'].items():
    assert asset['format'] == ('zip' if key.startswith('win32') else 'tar.gz')
    assert re.fullmatch(r'[a-z0-9_-]+', asset['target'])
    for field in ['archiveSha256', 'binarySha256', 'licenceSha256']:
        assert re.fullmatch(r'[a-f0-9]{64}', asset[field]), f'Invalid {field}'
    assert 0 < asset['archiveBytes'] <= 32 * 1024 * 1024
    assert 0 < asset['binaryBytes'] <= 128 * 1024 * 1024

if args.plugin_tag:
    assert args.plugin_tag == f'bb-plugin-v{plugin}', f'Tag {args.plugin_tag} does not match plugin version {plugin}'
    assert pin['version'] == plugin, f'Plugin {plugin} must pin Highwater {plugin}, not {pin["version"]}'
    changed = subprocess.run(
        ['git', 'diff', '--name-only', f'v{plugin}', 'HEAD'],
        cwd=repository, check=True, capture_output=True, text=True,
    ).stdout.split()
    assert changed == [PIN], f'{args.plugin_tag} must differ from v{plugin} only in {PIN}; found {changed}'

print(f'Crate/plugin {plugin}; pinned binary {pin["version"]}.')
