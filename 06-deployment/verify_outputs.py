#!/usr/bin/env python3
"""Integrity check of the pipeline outputs.

Checks that the canonical subgraph and the two outputs that the later stages
read (the operating point and the results of the factorial design) exist, that
the key numbers of the subgraph match the documented ones, that the notebooks
ran without errors, and that the phase reports and the figures are in place.
Exits with code 0 when nothing failed; warnings do not count as failures.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GREEN, RED, YELLOW, RESET = '\033[92m', '\033[91m', '\033[93m', '\033[0m'
failures, warnings_list = [], []


def ok(m):   print(f'{GREEN}  OK  {RESET}{m}')
def fail(m): failures.append(m); print(f'{RED} FAIL {RESET}{m}')
def warn(m): warnings_list.append(m); print(f'{YELLOW} WARN {RESET}{m}')


def check_exists(rel, min_bytes=0):
    p = ROOT / rel
    if not p.exists():
        fail(f'{rel} does not exist')
        return False
    if p.is_file() and p.stat().st_size < min_bytes:
        fail(f'{rel} is too small ({p.stat().st_size} B)')
        return False
    ok(rel)
    return True


print('\n--- Canonical data ---')
for f, m in [('data/processed/jo_nodes.csv', 10_000),
             ('data/processed/jo_edges.csv', 100_000),
             ('data/processed/jo_meta.json', 100)]:
    check_exists(f, m)

if (ROOT / 'data/processed/jo_meta.json').exists():
    meta = json.loads((ROOT / 'data/processed/jo_meta.json').read_text())
    EXPECTED = {'n_nodes': 1239, 'n_edges': 20059, 'n_jo_in_graph': 269,
                'n_jo_input': 123, 'flywire_snapshot': 'v783'}
    print('\n--- Subgraph numbers ---')
    for k, v in EXPECTED.items():
        if meta.get(k) == v:
            ok(f'{k} = {v}')
        else:
            fail(f'{k} = {meta.get(k)}, expected {v}')

print('\n--- Notebooks ran without errors ---')
for nb in sorted(ROOT.glob('0[2-6]-*/*.ipynb')):
    d = json.loads(nb.read_text())
    err = [i for i, c in enumerate(d['cells'])
           if any(o.get('output_type') == 'error' for o in c.get('outputs', []))]
    not_executed = [i for i, c in enumerate(d['cells'])
                    if c['cell_type'] == 'code' and not c.get('execution_count')]
    rel = nb.relative_to(ROOT)
    if err:
        fail(f'{rel}: error in cells {err}')
    elif not_executed:
        warn(f'{rel}: {len(not_executed)} cell(s) not executed')
    else:
        ok(f'{rel}')

print('\n--- Experimental results ---')
for f in ['03-data-preparation/outputs/operating_point.json',
          '04-modeling/outputs/results.json']:
    check_exists(f, 500)

print('\n--- Phase reports ---')
for phase_dir in ['02-data-understanding', '03-data-preparation',
                  '04-modeling', '05-evaluation']:
    for doc in ['results.md', 'research-log.md']:
        p = ROOT / phase_dir / doc
        (ok if p.exists() else warn)(f'{phase_dir}/{doc}')

print('\n--- Figures ---')
figs = sorted((ROOT / 'docs/figures').glob('*.png'))
if len(figs) >= 20:
    ok(f'{len(figs)} figures in docs/figures/')
else:
    warn(f'only {len(figs)} figures in docs/figures/ (expected 20 or more)')
try:
    from PIL import Image
    for f in figs:
        w, h = Image.open(f).size
        if w < 400 or h < 300:
            warn(f'{f.name} is too small ({w}x{h})')
except ImportError:
    warn('Pillow is not installed: the figure sizes were not checked')

print(f'\n{"="*60}')
if failures:
    print(f'{RED}{len(failures)} failure(s){RESET}' + (f' · {len(warnings_list)} warning(s)' if warnings_list else ''))
    sys.exit(1)
print(f'{GREEN}All checks passed{RESET}' + (f' · {len(warnings_list)} warning(s)' if warnings_list else ''))
