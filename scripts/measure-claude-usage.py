#!/usr/bin/env python3
"""Measure TokenPlume's Claude token estimates against the usage the provider reported.

Runs the ignored Rust test `export_claude_usage_steps` on this machine's Claude Code and Pi
sessions. Between two consecutive calls to the same Claude model where the second only adds
context items, the growth in the reported prompt size should equal the estimated size of the
added items plus any per-request content the transcript does not record. For each harness this
fits

    growth = a * tool results + b * assistant messages + c * thinking + d * other items
             + e * (number of tool results)

by least squares and prints each coefficient with a 90% bootstrap range, and the median error
per step. Coefficients of 1 and a small e mean the estimates match the reported usage. The
export holds item kinds and sizes only, and this prints aggregates only, never session content.
Needs only Python 3; it is not part of scripts/check.sh.

    python3 scripts/measure-claude-usage.py
"""
import collections
import json
import os
import pathlib
import random
import statistics
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
TERMS = ['tool results', 'assistant messages', 'thinking', 'other items', 'per tool round trip']
KINDS = {'toolResult': 0, 'assistantMessage': 1, 'thinking': 2}
MINIMUM_STEPS_WITH_TERM = 8
BOOTSTRAP_ROUNDS = 300


def steps(path):
    by_harness = collections.defaultdict(list)
    for line in open(path, encoding='utf-8'):
        step = json.loads(line)
        if step['growth'] <= 0 or any(item['tokens'] is None for item in step['items']):
            continue
        row = [0.0] * len(TERMS)
        for item in step['items']:
            row[KINDS.get(item['kind'], 3)] += item['tokens']
            row[4] += item['kind'] == 'toolResult'
        by_harness[step['harness']].append((float(step['growth']), row))
    return by_harness


def solve(rows, terms):
    """Least squares through the normal equations, over the chosen columns."""
    size = len(terms)
    matrix = [[sum(row[i] * row[j] for _, row in rows) for j in terms] for i in terms]
    vector = [sum(growth * row[i] for growth, row in rows) for i in terms]
    for column in range(size):
        pivot = max(range(column, size), key=lambda r: abs(matrix[r][column]))
        if abs(matrix[pivot][column]) < 1e-9:
            return None
        matrix[column], matrix[pivot] = matrix[pivot], matrix[column]
        vector[column], vector[pivot] = vector[pivot], vector[column]
        for other in range(size):
            if other != column:
                scale = matrix[other][column] / matrix[column][column]
                matrix[other] = [a - scale * b for a, b in zip(matrix[other], matrix[column])]
                vector[other] -= scale * vector[column]
    return [vector[i] / matrix[i][i] for i in range(size)]


def report(harness, rows):
    terms = [i for i in range(len(TERMS)) if sum(row[i] != 0 for _, row in rows) >= MINIMUM_STEPS_WITH_TERM]
    coefficients = solve(rows, terms)
    if coefficients is None:
        print(f'{harness}: {len(rows)} steps, too few to fit')
        return
    errors = [abs(sum(c * row[i] for c, i in zip(coefficients, terms)) - growth) / growth
              for growth, row in rows]
    generator = random.Random(4)
    rounds = [solve([generator.choice(rows) for _ in rows], terms) for _ in range(BOOTSTRAP_ROUNDS)]
    rounds = [fit for fit in rounds if fit is not None]
    print(f'{harness}: {len(rows)} steps, median error per step {100 * statistics.median(errors):.1f}%')
    for position, term in enumerate(terms):
        values = sorted(fit[position] for fit in rounds)
        low, high = values[int(0.05 * len(values))], values[int(0.95 * len(values)) - 1]
        print(f'   {TERMS[term]:20} {coefficients[position]:8.2f}  ({low:.2f} to {high:.2f})')


def main():
    with tempfile.TemporaryDirectory() as directory:
        export = pathlib.Path(directory) / 'steps.jsonl'
        result = subprocess.run(
            ['cargo', 'test', '--release', '--quiet', 'export_claude_usage_steps', '--', '--ignored'],
            cwd=ROOT, env={**os.environ, 'TOKENPLUME_USAGE_EXPORT': str(export)},
            stdout=subprocess.DEVNULL)
        if result.returncode != 0 or not export.exists():
            sys.exit('The export test failed.')
        by_harness = steps(export)
    if not by_harness:
        sys.exit('No steps between Claude calls were found in the local sessions.')
    for harness, rows in sorted(by_harness.items()):
        report(harness, rows)


if __name__ == '__main__':
    main()
