#!/usr/bin/env python3
"""Convert ctok's Claude tokenizer vocabularies into the form TokenPlume embeds.

ctok (https://github.com/sanderland/ctok, MIT) stores each measured piece with the evidence that
it is one token. TokenPlume needs only the pieces, so this keeps the pieces in ctok's internal
marker form (parsed with ctok's own parser), the byte-fallback prefixes, the contraction suffixes
and the family settings, and leaves the evidence upstream at the pinned commit.

    python3 scripts/convert-ctok-vocabulary.py --ctok ../ctok
    python3 scripts/convert-ctok-vocabulary.py --ctok ../ctok --check
"""
import argparse
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'data/tokenization'
PINNED = '8c43ffd'
FILES = {'claude-v3.json': 'pieces_v3.json', 'claude-v4.7.json': 'pieces_v4_7.json'}


def convert(ctok: pathlib.Path, source: str, commit: str) -> str:
    sys.path.insert(0, str(ctok))
    from ctok.notation import parse_marked  # noqa: E402  (ctok's own parser)
    document = json.loads((ctok / 'ctok/data' / source).read_text(encoding='utf-8'))
    tokens = document['tokens']
    meta = document['meta']
    pieces = sorted({parse_marked(piece) for group, entries in tokens.items()
                     if group != 'bytes_fallback' for piece in entries})
    return json.dumps({
        'source': f'ctok {commit} ctok/data/{source} (MIT; see LICENSE.ctok)',
        'family': meta['family'],
        'source_model': meta['source_model'],
        'message_overhead': meta['message_overhead'],
        'fold_quotes': meta['fold_quotes'],
        'allcaps_min': meta['allcaps_min'],
        'pieces': pieces,
        'contractions': sorted(tokens['contractions']),
        'bytes_fallback': sorted(tokens['bytes_fallback']),
    }, ensure_ascii=False, separators=(',', ':'), sort_keys=True) + '\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--ctok', type=pathlib.Path, required=True, help='a ctok checkout')
    parser.add_argument('--check', action='store_true', help='fail instead of writing when a file would change')
    arguments = parser.parse_args()
    commit = subprocess.run(['git', '-C', str(arguments.ctok), 'rev-parse', '--short=7', 'HEAD'],
                            capture_output=True, text=True).stdout.strip()
    if commit != PINNED:
        print(f'warning: ctok is at {commit or "an unknown commit"}, not the pinned {PINNED}')
    stale = []
    for target, source in FILES.items():
        text = convert(arguments.ctok, source, commit)
        path = OUT / target
        if arguments.check:
            if not path.exists() or path.read_text(encoding='utf-8') != text:
                stale.append(target)
            continue
        path.write_text(text, encoding='utf-8')
        print(f'wrote {path.relative_to(ROOT)} ({len(text.encode()) / 1e3:.0f} KB)')
    if stale:
        sys.exit(f'{", ".join(stale)} do not match ctok {commit}')
    if arguments.check:
        print('vocabularies match their inputs')


if __name__ == '__main__':
    main()
