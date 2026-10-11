#!/usr/bin/env python3
"""Synthetic Claude Code transcript -> release server: request times and sampled RSS.

Never reads real transcripts. The generated session has split responses, parallel
tool calls, attachments and one compaction, and is about the size of the largest
transcript seen locally (17 MB) unless --calls says otherwise.
"""
import argparse
import json
import pathlib
import socket
import statistics
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
SESSION = '99999999-0000-4000-8000-000000000000'


def generate(path, calls, characters):
    clock = [0]
    lines = []

    def record(kind, uuid, parent, **fields):
        clock[0] += 1
        seconds = clock[0]
        lines.append(json.dumps({
            'parentUuid': parent, 'isSidechain': False, 'cwd': '/synthetic/benchmark',
            'sessionId': SESSION, 'version': '2.1.287', 'type': kind, 'uuid': uuid,
            'timestamp': f'2026-10-01T{seconds // 3600 % 24:02}:{seconds // 60 % 60:02}:{seconds % 60:02}.000Z',
            **fields,
        }, separators=(',', ':')))
        return uuid

    def usage(read):
        return {'input_tokens': 3, 'cache_read_input_tokens': read, 'cache_creation_input_tokens': 200,
                'cache_creation': {'ephemeral_1h_input_tokens': 200, 'ephemeral_5m_input_tokens': 0},
                'output_tokens': 120, 'output_tokens_details': {'thinking_tokens': 40}}

    text = 'Synthetic text ' + 'x' * characters
    parent = record('user', 'u0', None, message={'role': 'user', 'content': 'Start.'})
    for call in range(calls):
        if call == calls // 2:
            boundary = record('system', f'b{call}', None, subtype='compact_boundary', logicalParentUuid=parent,
                              compactMetadata={'trigger': 'auto', 'preTokens': 150000})
            parent = record('user', f's{call}', boundary, isCompactSummary=True,
                            message={'role': 'user', 'content': 'Summary. ' + text})
        message = f'msg_{call}'
        model = {'model': 'claude-opus-5-5', 'id': message, 'type': 'message', 'role': 'assistant',
                 'stop_reason': 'tool_use', 'usage': usage(call * 200)}
        first = record('assistant', f'a{call}t', parent,
                       message={**model, 'content': [{'type': 'thinking', 'thinking': text, 'signature': 'c2ln'}]})
        second = record('assistant', f'a{call}x', first,
                        message={**model, 'content': [{'type': 'tool_use', 'id': f't{call}x', 'name': 'Read',
                                                        'input': {'file_path': f'/synthetic/{call}x.txt'}}]})
        third = record('assistant', f'a{call}y', second,
                       message={**model, 'content': [{'type': 'tool_use', 'id': f't{call}y', 'name': 'Grep',
                                                       'input': {'pattern': 'synthetic'}}]})
        # Parallel results: one is a child of the earlier record, off the chain.
        result = lambda tool: {'role': 'user', 'content': [{'type': 'tool_result', 'tool_use_id': tool, 'content': text}]}
        record('user', f'r{call}x', second, message=result(f't{call}x'))
        parent = record('user', f'r{call}y', third, message=result(f't{call}y'))
        parent = record('attachment', f'k{call}', parent, attachment={'type': 'total_tokens_reminder'},
                        rendered=[{'content': '<system-reminder>Token usage</system-reminder>'}], renderedRole='system')
    record('assistant', 'final', parent, message={'model': 'claude-opus-5-5', 'id': 'msg_final', 'type': 'message',
                                                  'role': 'assistant', 'stop_reason': 'end_turn', 'usage': usage(0),
                                                  'content': [{'type': 'text', 'text': 'Done.'}]})
    path.write_text('\n'.join(lines) + '\n')


def rss_kib(pid):
    output = subprocess.run(['ps', '-o', 'rss=', '-p', str(pid)], capture_output=True, text=True).stdout.strip()
    return int(output) if output else 0


def request(url, etag=None):
    headers = {'If-None-Match': etag} if etag else {}
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=headers)) as response:
            body = response.read()
            return time.perf_counter() - started, response.status, response.headers.get('ETag'), body
    except urllib.error.HTTPError as error:
        return time.perf_counter() - started, error.code, error.headers.get('ETag'), b''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--calls', type=int, default=700)
    parser.add_argument('--characters', type=int, default=7000)
    parser.add_argument('--binary', default=str(ROOT / 'target/release/tokenplume'))
    arguments = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix='tokenplume-claude-code-benchmark-') as temporary:
        temporary = pathlib.Path(temporary)
        project = temporary / 'projects' / '-synthetic-benchmark'
        project.mkdir(parents=True)
        transcript = project / 'benchmark.jsonl'
        generate(transcript, arguments.calls, arguments.characters)
        (temporary / 'pi').mkdir()
        with socket.socket() as port_socket:
            port_socket.bind(('127.0.0.1', 0))
            port = port_socket.getsockname()[1]
        server = subprocess.Popen([arguments.binary, '--session-root', str(temporary / 'pi'), '--claude-root',
                                   str(temporary / 'projects'), '--port', str(port), '--tokenization', 'auto'],
                                  stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        peak = [0]
        stop = threading.Event()

        def sample():
            while not stop.is_set():
                peak[0] = max(peak[0], rss_kib(server.pid))
                time.sleep(0.05)

        sampler = threading.Thread(target=sample, daemon=True)
        try:
            base = f'http://127.0.0.1:{port}'
            for _ in range(100):
                try:
                    sessions = json.loads(urllib.request.urlopen(base + '/api/sessions').read())['sessions']
                    break
                except OSError:
                    time.sleep(0.1)
            else:
                raise SystemExit('server did not start')
            sampler.start()
            url = f"{base}/api/sessions/{sessions[0]['id']}/analysis"
            cold, status, etag, body = request(url)
            assert status == 200, status
            analysis = json.loads(body)
            warm = [request(url)[0] for _ in range(5)]
            conditional, status_304, _, _ = request(url, etag)
            assert status_304 == 304, status_304
            stop.set()
            sampler.join()
            print(json.dumps({
                'transcriptBytes': transcript.stat().st_size,
                'calls': len(analysis['modelCalls']),
                'contextItems': len(analysis['contextItems']),
                'compactions': len(analysis['compactions']),
                'responseBytes': len(body),
                'coldMs': round(cold * 1000, 1),
                'warmMedianMs': round(statistics.median(warm) * 1000, 1),
                'conditionalMs': round(conditional * 1000, 1),
                'peakSampledRssMiB': round(peak[0] / 1024, 1),
            }, indent=2))
        finally:
            stop.set()
            server.terminate()
            server.wait(timeout=10)


if __name__ == '__main__':
    main()
