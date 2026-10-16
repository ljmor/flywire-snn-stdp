#!/usr/bin/env python3
"""Full reproducible pipeline of this project.

Runs the project from start to finish, from the raw FlyWire files to the
result figures and tables. Stage 0 checks the environment and the raw files
before anything else runs, and every step prints the command it runs and how
long it took. If a step fails, the pipeline stops there with its exit code.

Usage:

    python 06-deployment/pipeline.py                  # everything, in order
    python 06-deployment/pipeline.py --stages 2 3     # only stages 2 and 3
    python 06-deployment/pipeline.py --quick          # skips the long phase-04 runs (test run)
    python 06-deployment/pipeline.py --list           # lists the stages

Prerequisite: the three FlyWire files in `data/raw/`. See
`06-deployment/README.md` for how to get them and how to cite them.
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

RAW_FILES = ['classification.csv.gz',
             'connections_buhmann_no_threshold.csv.gz',
             'consolidated_cell_types.csv.gz']

GREEN, RED, BLUE, GRAY, RESET = '\033[92m', '\033[91m', '\033[94m', '\033[90m', '\033[0m'


def log(msg, color=''):
    print(f'{color}{msg}{RESET}', flush=True)


def run_command(cmd, cwd, description):
    log(f'    $ {" ".join(cmd)}', GRAY)
    t0 = time.time()
    r = subprocess.run(cmd, cwd=cwd)
    if r.returncode != 0:
        log(f'    FAILED in {description} (exit code {r.returncode})', RED)
        raise SystemExit(r.returncode)
    log(f'    done in {time.time()-t0:.0f} s', GRAY)


def run_notebook(path, cwd):
    run_command([sys.executable, '-m', 'jupyter', 'nbconvert', '--to', 'notebook',
                 '--execute', '--inplace', path], cwd, path)


def run_script(path, cwd, extra=()):
    run_command([sys.executable, path, *extra], cwd, path)


# --- stages -----------------------------------------------------------------

def stage_0_check_environment(_):
    """Checks the environment and the raw files."""
    missing = [f for f in RAW_FILES if not (ROOT / 'data' / 'raw' / f).exists()]
    if missing:
        log(f'    Raw files missing from data/raw/: {", ".join(missing)}', RED)
        log('    See 06-deployment/README.md, section "Getting the FlyWire data".', RED)
        raise SystemExit(1)
    for f in RAW_FILES:
        mb = (ROOT / 'data' / 'raw' / f).stat().st_size / 1e6
        log(f'    {f}: {mb:.1f} MB', GRAY)
    import brian2, numpy, pandas, scipy, sklearn, networkx      # noqa: F401
    log(f'    brian2 {brian2.__version__} · numpy {numpy.__version__} · '
        f'scipy {scipy.__version__} · sklearn {sklearn.__version__}', GRAY)


def stage_1_extract_subgraph(_):
    """Phase 02: extracts the canonical subgraph into data/processed/."""
    from snnlib import extraction
    extraction.build()


def stage_2_data_understanding(_):
    """Phase 02: runs the data-understanding notebook."""
    run_notebook('01-exploratory-data-analysis.ipynb', ROOT / '02-data-understanding')


def stage_3_calibration(_):
    """Phase 03: matches the operating point and runs the notebook."""
    run_script('calibrate.py', ROOT / '03-data-preparation')
    run_notebook('01-calibration.ipynb', ROOT / '03-data-preparation')


def stage_4_experiments(args):
    """Phase 04: factorial design, controls and modeling notebooks."""
    d = ROOT / '04-modeling'
    run_script('run_experiments.py', d)
    if not args.quick:
        run_script('extra_seeds.py', d)
        run_script('control_stdp.py', d)
        run_script('threshold_sweep.py', d)
        run_script('plot_threshold_validation.py', d)
        run_script('energy_frontier.py', d)
        run_script('baseline_ann.py', d)
    for nb in ['01-audio-encoding', '02-control-networks',
               '03-connectome-static', '04-connectome-stdp']:
        run_notebook(f'{nb}.ipynb', d)


def stage_5_evaluation(_):
    """Phase 05: final comparative evaluation notebook."""
    run_notebook('01-comparative-evaluation.ipynb', ROOT / '05-evaluation')


def stage_6_verify_outputs(_):
    """Checks the generated outputs (see verify_outputs.py)."""
    run_script('verify_outputs.py', ROOT / '06-deployment')


STAGES = [
    ('0', 'Environment and raw-data check', stage_0_check_environment),
    ('1', 'Phase 02 · extraction of the canonical subgraph', stage_1_extract_subgraph),
    ('2', 'Phase 02 · data-understanding notebook', stage_2_data_understanding),
    ('3', 'Phase 03 · calibration of the operating point', stage_3_calibration),
    ('4', 'Phase 04 · experiments and modeling notebooks', stage_4_experiments),
    ('5', 'Phase 05 · comparative evaluation', stage_5_evaluation),
    ('6', 'Check of the generated outputs', stage_6_verify_outputs),
]


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--stages', nargs='*', help='ids of the stages to run')
    ap.add_argument('--quick', action='store_true',
                    help='skips the long runs of phase 04')
    ap.add_argument('--list', action='store_true', help='lists the stages and exits')
    args = ap.parse_args()

    if args.list:
        for i, d, _ in STAGES:
            print(f'  {i}  {d}')
        return

    selected = [e for e in STAGES if (args.stages is None or e[0] in args.stages)]
    log(f'\n{"="*72}', BLUE)
    log('  PIPELINE · spiking network wired like the Drosophila auditory connectome', BLUE)
    log(f'  {len(selected)} stage(s)' + ('  ·  quick mode' if args.quick else ''), BLUE)
    log(f'{"="*72}\n', BLUE)

    t0 = time.time()
    for i, desc, fn in selected:
        log(f'[{i}] {desc}', BLUE)
        fn(args)
        log('')
    log(f'{"="*72}', GREEN)
    log(f'  Pipeline finished in {(time.time()-t0)/60:.1f} min', GREEN)
    log(f'{"="*72}\n', GREEN)


if __name__ == '__main__':
    main()
