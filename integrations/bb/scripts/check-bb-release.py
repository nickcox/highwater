#!/usr/bin/env python3
"""Check crate/plugin release versions and the preferred binary pin without network access."""
import json
import re
from pathlib import Path

package = Path(__file__).resolve().parents[1]
repository = package.parents[1]
crate = re.search(r'^version = "([^"]+)"', (repository / 'Cargo.toml').read_text(), re.M).group(1)
plugin = json.loads((package / 'package.json').read_text())['version']
assert crate == plugin, f'Crate {crate} and plugin {plugin} versions differ'
pins = json.loads((package / 'host/binary-release.json').read_text())['releases']
assert pins, 'No binary release pins'
assert pins[0]['version'].split('.')[:2] == plugin.split('.')[:2], 'Preferred binary is outside the plugin minor range'
assert len({r['version'] for r in pins}) == len(pins), 'Duplicate pinned versions'
platforms = {'darwin-arm64', 'darwin-x64', 'linux-arm64', 'linux-x64', 'win32-x64'}
for release in pins:
    assert re.fullmatch(r'\d+\.\d+\.\d+', release['version']), 'Invalid pinned version'
    assert set(release['platforms']) == platforms, 'Incomplete release platform pins'
    for key, asset in release['platforms'].items():
        assert asset['format'] == ('zip' if key.startswith('win32') else 'tar.gz')
        assert re.fullmatch(r'[a-z0-9_-]+', asset['target'])
        for field in ['archiveSha256', 'binarySha256', 'licenceSha256']:
            assert re.fullmatch(r'[a-f0-9]{64}', asset[field]), f'Invalid {field}'
        assert 0 < asset['archiveBytes'] <= 32 * 1024 * 1024
        assert 0 < asset['binaryBytes'] <= 128 * 1024 * 1024
print(f'Crate/plugin {plugin}; preferred binary {pins[0]["version"]}; {len(pins)} pinned release(s).')
