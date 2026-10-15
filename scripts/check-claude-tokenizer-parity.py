#!/usr/bin/env python3
"""Check that Highwater's Rust port of ctok counts exactly as Python ctok does.

Counts every text in ctok's test fixtures (Rosetta Code, the Rosetta holdout, MultiPL-E and
the UDHR translations), a list of edge cases, and optionally a sample of texts from the local
Claude Code transcripts, with Python ctok for each tokenizer generation. It writes the cases to
a file and runs the ignored Rust test `claude_tokenizer_matches_ctok`, which fails on any count
that differs. Needs a ctok checkout at the pinned commit and Python with ctok's dependencies;
it is not part of scripts/check.sh.

    python3 scripts/check-claude-tokenizer-parity.py --ctok ../ctok
    python3 scripts/check-claude-tokenizer-parity.py --ctok ../ctok --local 2000
    python3 scripts/check-claude-tokenizer-parity.py --ctok ../ctok --write-sample

`--write-sample` also rewrites fixtures/tokenization/claude-multipl-e.json, the recorded
count_tokens results that the committed test `claude_estimates_match_recorded_counts` uses.
"""
import argparse
import glob
import gzip
import json
import os
import pathlib
import random
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
PINNED_CTOK = '8c43ffd'
SAMPLE = ROOT / 'fixtures/tokenization/claude-multipl-e.json'
# ctok's recorded counts, by fixture key -> (Highwater generation, the single-message overhead
# that count_tokens adds, from ctok's pieces metadata and ctok/main.py).
RECORDED = {'v3': ('v3', 7), 'v4.7': ('v4.7', 11), 'v5': ('v4.8', 6)}
FIXTURES = ('rosetta', 'rosetta_holdout', 'multipl_e', 'udhr')
# Highwater generation -> the version ctok routes to that family.
GENERATIONS = {'v3': '3.0', 'v4.7': '4.7', 'v4.8': '4.8'}

# Short texts that reach the rules a long document rarely isolates: the frame's leading space,
# trailing newlines, case markers, contractions, digits, marks, selectors and literal markers.
EDGE_CASES = [
    '', ' ', '  ', ' a', '  a', 'a', 'a ', 'a\n', 'a\n\n', '\n', '\n\n\n', '\t', '\ta',
    "it's", "x'S", "a 'b", "'First", "can't won't they'll we've I'm you'd", "('quoted')",
    'HELLO WORLD', 'Hello World', 'GaN WiFi QQ', 'ABC', 'ABCD', 'ΣΊΣΥΦΟΣ', 'İstanbul', 'STRAẞE',
    'ϴ Θϴ', 'ℳ ℂ', 'Ⅻ ⓐⒷ', '٣٤٥ 123 ۱۲', '½ ² ①', '文？ 1。？ 1', '々〆', '한국어', 'ไทย ำ',
    '⚖️ 👍🏽 👨‍👩‍👧', '́abc', 'á', 'ܑܐ', '﷐﷑﷒﷓﷔',
    ' private', 'a b c', 'nul\x00here', 'ctrl\x07char', '‘curly’ “quotes”',
    'x == y => z });', '— » « • ° „ – −', '​‍﻿', 'tab\tseparated\tvalues\n',
]


def fixture_texts(ctok):
    for name in FIXTURES:
        path = ctok / 'tests/fixtures' / f'{name}.jsonl.gz'
        for line in gzip.open(path, 'rt', encoding='utf-8'):
            yield f'{name}', json.loads(line)['text']


def write_sample(ctok, commit):
    fixtures = ctok / 'tests/fixtures'
    rows = [json.loads(line) for line in gzip.open(fixtures / 'multipl_e.jsonl.gz', 'rt', encoding='utf-8')]
    counts = json.loads((fixtures / 'multipl_e_counts.json').read_text(encoding='utf-8'))
    SAMPLE.write_text(json.dumps({
        'source': f'ctok {commit} tests/fixtures/multipl_e (MIT; see LICENSE.ctok)',
        'overheads': {generation: overhead for generation, overhead in RECORDED.values()},
        'texts': [{'name': row['lang'], 'text': row['text'],
                   'counts': {generation: counts[key]['counts'][row['lang']]
                              for key, (generation, _) in RECORDED.items()}}
                  for row in rows],
    }, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'wrote {SAMPLE.relative_to(ROOT)}')


def local_texts(limit):
    texts = set()
    for path in glob.glob(os.path.expanduser('~/.claude/projects/**/*.jsonl'), recursive=True):
        for line in open(path, encoding='utf-8', errors='replace'):
            try:
                content = (json.loads(line).get('message') or {}).get('content')
            except (ValueError, AttributeError):
                continue
            if isinstance(content, str):
                texts.add(content)
            for block in content if isinstance(content, list) else []:
                if not isinstance(block, dict):
                    continue
                body = block.get('text') or block.get('thinking') or block.get('content')
                if isinstance(body, str):
                    texts.add(body)
                elif block.get('type') == 'tool_use':
                    texts.add(json.dumps(block.get('input'), ensure_ascii=False))
    texts = sorted(text for text in texts if len(text) <= 200_000)
    random.Random(20261011).shuffle(texts)
    return [('local', text) for text in texts[:limit]]


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--ctok', type=pathlib.Path, required=True, help='a ctok checkout')
    parser.add_argument('--local', type=int, default=0, metavar='N',
                        help='also check N texts sampled from ~/.claude/projects')
    parser.add_argument('--write-sample', action='store_true',
                        help=f'also rewrite {SAMPLE.relative_to(ROOT)} from ctok\'s recorded counts')
    args = parser.parse_args()
    ctok = args.ctok.resolve()
    commit = subprocess.run(['git', '-C', str(ctok), 'rev-parse', '--short', 'HEAD'],
                            capture_output=True, text=True).stdout.strip()
    if not commit.startswith(PINNED_CTOK):
        print(f'warning: ctok is at {commit or "an unknown commit"}, not the pinned {PINNED_CTOK}')
    if args.write_sample:
        write_sample(ctok, commit)
    sys.path.insert(0, str(ctok))
    from ctok import token_count  # noqa: E402
    from ctok.main import FAMILIES, _family, _model  # noqa: E402

    texts = [('edge', text) for text in EDGE_CASES] + list(fixture_texts(ctok))
    if args.local:
        texts += local_texts(args.local)
    with tempfile.NamedTemporaryFile('w', suffix='.jsonl', delete=False, encoding='utf-8') as cases:
        for generation, version in GENERATIONS.items():
            overhead = _model(_family(version)).message_overhead
            assert _family(version) in FAMILIES
            for source, text in texts:
                count = token_count(text, version) - overhead
                cases.write(json.dumps({'source': source, 'generation': generation,
                                        'text': text, 'count': count}, ensure_ascii=False) + '\n')
    print(f'{len(texts)} texts x {len(GENERATIONS)} generations written to {cases.name}')
    result = subprocess.run(
        ['cargo', 'test', '--release', '--quiet', 'claude_tokenizer_matches_ctok', '--', '--ignored',
         '--nocapture'],
        cwd=ROOT, env={**os.environ, 'HIGHWATER_CLAUDE_PARITY_CASES': cases.name})
    os.unlink(cases.name)
    sys.exit(result.returncode)


if __name__ == '__main__':
    main()
