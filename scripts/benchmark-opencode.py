#!/usr/bin/env python3
"""Synthetic SQLite/HTTP correctness and sampled server RSS; never reads real logs."""
import argparse
import concurrent.futures
import json
import pathlib
import signal
import socket
import sqlite3
import statistics
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent


def generate(connection, name, calls, characters):
    session = f"ses_benchmark_{name}"
    connection.execute("INSERT INTO session (id,directory,title,version,time_created,time_updated) VALUES (?,?,?,?,?,?)",
                       (session, '/synthetic', name, '1.4.0', 10, 100))
    tokens = {'input': 100, 'output': 10, 'reasoning': 0, 'cache': {'read': 0, 'write': 0}}
    text = 'Synthetic text ' + 'x' * characters
    for call in range(calls):
        user, assistant = f'{session}_u{call:04}', f'{session}_a{call:04}'
        at = 10 + call * 10
        for identity, instant, data in [(user, at, {'role': 'user'}), (assistant, at + 1, {
            'role': 'assistant', 'parentID': user, 'providerID': 'openai', 'modelID': 'gpt-4.1',
            'time': {'created': at + 1, 'completed': at + 3}, 'finish': 'stop', 'cost': 0.01, 'tokens': tokens,
        })]:
            connection.execute('INSERT INTO message VALUES (?,?,?,?,?)', (identity, session, instant, instant, json.dumps(data)))
        for identity, message, data in [(user + '_text', user, {'type': 'text', 'text': text}),
                                         (assistant + '_1', assistant, {'type': 'step-start'}),
                                         (assistant + '_2', assistant, {'type': 'text', 'text': text}),
                                         (assistant + '_3', assistant, {'type': 'step-finish', 'tokens': tokens, 'cost': 0.01})]:
            connection.execute('INSERT INTO part VALUES (?,?,?,?,?,?)', (identity, message, session, at, at, json.dumps(data)))
    connection.commit()
    return session


def run(binary, full):
    cases = [('small', 8, 256), ('medium', 160, 512)]
    if full:
        cases += [('large', 64, 1024 * 1024), ('uncached', 1600, 16)]
    with tempfile.TemporaryDirectory(prefix='tokenplume-opencode-benchmark-') as temporary:
        temporary = pathlib.Path(temporary)
        database = temporary / 'synthetic.db'
        connection = sqlite3.connect(database)
        connection.executescript((ROOT / 'fixtures/opencode/legacy-schema.sql').read_text())
        identities = {name: generate(connection, name, calls, size) for name, calls, size in cases}
        connection.execute('PRAGMA journal_mode=WAL')
        connection.execute('PRAGMA wal_autocheckpoint=0')
        (temporary / 'pi').mkdir()
        with socket.socket() as port_socket:
            port_socket.bind(('127.0.0.1', 0))
            port = port_socket.getsockname()[1]
        stop = threading.Event()
        peak = [0]
        with (temporary / 'server.log').open('w') as log:
            server = subprocess.Popen([str(binary), '--session-root', str(temporary / 'pi'), '--opencode-db', str(database),
                                       '--port', str(port), '--tokenization', 'heuristic'], stdout=log, stderr=log)
            base = f'http://127.0.0.1:{port}'

            def request(path, etag=None):
                started = time.monotonic()
                headers = {'If-None-Match': etag} if etag else {}
                try:
                    response = urllib.request.urlopen(urllib.request.Request(base + path, headers=headers), timeout=60)
                except urllib.error.HTTPError as error:
                    response = error
                with response:
                    body = response.read()
                    return response.status, response.headers.get('ETag'), body, (time.monotonic() - started) * 1000

            def monitor():
                while not stop.wait(0.02):
                    result = subprocess.run(['ps', '-o', 'rss=', '-p', str(server.pid)], capture_output=True, text=True)
                    if result.stdout.strip().isdigit():
                        peak[0] = max(peak[0], int(result.stdout.strip()))

            sampling = threading.Thread(target=monitor)
            sampling.start()
            try:
                for _ in range(200):
                    if server.poll() is not None:
                        raise RuntimeError('synthetic server exited before readiness')
                    try:
                        status, _, body, _ = request('/api/sessions')
                        if status == 200:
                            break
                    except OSError:
                        time.sleep(0.05)
                else:
                    raise RuntimeError('synthetic server readiness timeout')
                listing = json.loads(body)['sessions']
                paths = {entry['displayName']: '/api/sessions/' + entry['id'] + '/analysis' for entry in listing}
                for name, calls, _ in cases:
                    status, etag, body, cold = request(paths[name])
                    assert status == 200 and len(json.loads(body)['modelCalls']) == calls
                    response_bytes = len(body)
                    warm = []
                    for _ in range(5):
                        status, current, body, elapsed = request(paths[name], etag)
                        assert status == 304 and current == etag and not body
                        warm.append(elapsed)
                    print(f'opencode_http case={name} calls={calls} cold_ms={cold:.3f} conditional_p50_ms={statistics.median(warm):.3f} response_bytes={response_bytes}', flush=True)
                    if name == 'uncached':
                        assert response_bytes > 16 * 1024 * 1024, 'fixture must exceed response cache budget'
                path = paths['small']
                status, old, _, _ = request(path)
                assert status == 200
                unchanged_main = database.read_bytes()
                stale_rejections = 0
                for generation in range(20):
                    # Same-size part-only commits, no session time_updated change.
                    text = f'Synthetic WAL revision {generation:04}'
                    part = identities['small'] + '_u0000_text'
                    connection.execute('UPDATE part SET data=? WHERE id=?', (json.dumps({'type': 'text', 'text': text}), part))
                    connection.commit()
                    assert database.read_bytes() == unchanged_main, 'WAL commits must leave main file unchanged'
                    status, new, body, _ = request(path, old)
                    assert status == 200 and new != old
                    assert any(text in item['preview']['text'] for item in json.loads(body)['contextItems'])
                    old = new
                    stale_rejections += 1
                with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
                    results = list(pool.map(lambda _: request(path, old), range(16)))
                assert all(status == 304 and etag == old and not body for status, etag, body, _ in results)
                connection.execute('PRAGMA wal_checkpoint(TRUNCATE)')
                assert request(path, old)[0] == 304, 'checkpoint must not change logical revision'
                parts = [identities['small'] + '_u0000_text', identities['small'] + '_a0000_2']
                def churn():
                    with sqlite3.connect(database) as writer:
                        for generation in range(200):
                            data = json.dumps({'type': 'text', 'text': f'Synthetic concurrent revision {generation:04}'})
                            writer.executemany('UPDATE part SET data=? WHERE id=?', [(data, part) for part in parts])
                            writer.commit()
                            time.sleep(0.01)
                coherent_reads = 0
                with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                    writing = pool.submit(churn)
                    while not writing.done():
                        status, _, body, _ = request(path)
                        assert status == 200
                        previews = [item['preview']['text'] for item in json.loads(body)['contextItems'] if item['preview']['text'].startswith('Synthetic concurrent revision')]
                        if previews:
                            assert len(previews) == 2 and len(set(previews)) == 1, 'snapshot mixed committed generations'
                            coherent_reads += 1
                    writing.result()
                assert coherent_reads >= 10, 'must read during sustained writes'
                print(f'opencode_wal committed_edits={stale_rejections} concurrent_conditionals=16 sustained_commits=200 coherent_reads={coherent_reads} checkpoint_unchanged=true sampled_peak_rss_kib={peak[0]}', flush=True)
            finally:
                stop.set()
                sampling.join()
                connection.close()
                server.send_signal(signal.SIGINT)
                try:
                    server.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    server.kill()
                    server.wait()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--full', action='store_true', help='include ~128 MiB source and >16 MiB response cases')
    parser.add_argument('--binary', type=pathlib.Path, default=ROOT / 'target/release/tokenplume')
    arguments = parser.parse_args()
    run(arguments.binary.resolve(), arguments.full)
