#!/usr/bin/env python3
"""Run integrated browser tests against a separate Highwater server for each source."""
import argparse
from contextlib import ExitStack
import os
from pathlib import Path
import re
import shutil
import sqlite3
import subprocess
import tempfile
import time
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
GREP = {
    'pi': 'integrated Rust-served|is applied before the application module loads',
    'opencode': 'integrated OpenCode',
    'claude-code': 'integrated Claude Code',
    'vscode-copilot': 'integrated VS Code Copilot',
}


def database(path, scripts):
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path)
    try:
        for script in scripts:
            connection.executescript(script.read_text())
        connection.execute('PRAGMA journal_mode=WAL')
    finally:
        connection.close()


def fixtures(source, folder, env):
    pi = folder / 'pi'
    pi.mkdir(parents=True)
    run(['python3', 'scripts/generate-benchmark-session.py', '--case', 'small',
         '--output', pi / 'synthetic.jsonl'])
    args = ['--session-root', pi]
    if source == 'opencode':
        path = folder / 'store/opencode.db'
        database(path, [ROOT / 'fixtures/opencode' / name for name in
                        ('legacy-schema.sql', 'simple.sql', 'modern-schema.sql', 'modern.sql')])
        env['HIGHWATER_OPENCODE_FIXTURE'] = str(path)
        args.extend(['--opencode-db', path])
    elif source == 'claude-code':
        path = folder / 'projects'
        shutil.copytree(ROOT / 'fixtures/claude-code/projects', path)
        env['HIGHWATER_CLAUDE_CODE_FIXTURE'] = str(path)
        args.extend(['--claude-root', path])
    elif source == 'vscode-copilot':
        path = folder / 'User'
        shutil.copytree(ROOT / 'fixtures/vscode-copilot/User', path)
        database(path / 'globalStorage/github.copilot-chat/agent-traces.db',
                 [ROOT / 'fixtures/vscode-copilot/traces.sql'])
        env['HIGHWATER_VSCODE_COPILOT_FIXTURE'] = str(path)
        args.extend(['--vscode-user-dir', path])
    return args


def run(args, **kwargs):
    subprocess.run(args, cwd=ROOT, check=True, **kwargs)


def start_server(stack, command, log):
    output = stack.enter_context(log.open('w'))
    server = stack.enter_context(subprocess.Popen(command, stdout=output, stderr=subprocess.STDOUT))
    stack.callback(server.kill)
    deadline = time.monotonic() + 20
    while server.poll() is None and time.monotonic() < deadline:
        match = re.search(r'^Listening on (http://127\.0\.0\.1:\d+)$', log.read_text(), re.M)
        if match:
            return match[1]
        time.sleep(0.05)
    raise RuntimeError(f'Highwater did not start:\n{log.read_text()}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', choices=[*GREP, 'all'])
    source = parser.parse_args().source
    sources = list(GREP) if source == 'all' else [source]
    profile = os.environ.get('HIGHWATER_BROWSER_BUILD_PROFILE', 'debug')
    if profile not in ('debug', 'release'):
        parser.error('HIGHWATER_BROWSER_BUILD_PROFILE must be debug or release')
    if os.environ.get('HIGHWATER_FRONTEND_BUILT') != '1':
        run(['scripts/build-web.sh'])
    run(['cargo', 'build', '--locked', '--quiet'] + (['--release'] if profile == 'release' else []))
    binary = ROOT / 'target' / profile / 'highwater'
    env = {**os.environ, 'HIGHWATER_BROWSER_INTEGRATED': '1'}
    with tempfile.TemporaryDirectory(prefix='highwater-browser-') as tmp, ExitStack() as stack:
        for index, name in enumerate(sources):
            folder = Path(tmp).resolve() / name
            args = fixtures(name, folder, env)
            port = os.environ.get('HIGHWATER_BROWSER_PORT', '0') if index == 0 else '0'
            url = start_server(stack, [binary, 'serve', *args, '--port', port,
                                       '--tokenization', 'heuristic'], folder / 'server.log')
            if name == 'pi':
                with urlopen(url, timeout=10) as response:
                    if b'Highwater' not in response.read():
                        raise RuntimeError('Highwater did not serve its embedded frontend')
            if index == 0:
                env['HIGHWATER_BROWSER_BASE_URL'] = url
            if name != 'pi':
                env['HIGHWATER_' + name.upper().replace('-', '_') + '_URL'] = url
        run(['npm', '--prefix', 'web', 'run', 'test:browser', '--', '--grep',
             '|'.join(GREP[name] for name in sources)], env=env)


if __name__ == '__main__':
    main()
