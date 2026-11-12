#!/usr/bin/env bash
# Check the committed standalone embeddable module without installing any bb tooling.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
python3 - <<'PY'
from pathlib import Path
import subprocess
import sys

artifact = Path('integrations/bb/vendor/highwater-embed.js')
before = artifact.read_bytes()
subprocess.run(['npm', '--prefix', 'web', 'run', 'build:embed'], check=True)
if artifact.read_bytes() != before:
    print('The embeddable module was stale. Review and include the rebuilt integrations/bb/vendor/highwater-embed.js.', file=sys.stderr)
    sys.exit(1)
PY
