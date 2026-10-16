"""Extra seeds for the contrast between the connectome and the configuration model, both with STDP.

With five seeds the difference between these two arms did not reach significance,
largely because of the spread of the configuration-model arm. We add ten seeds to
the three plastic arms, which brings them to fifteen, and keep every comparison
paired by seed.
"""
import json, sys, time
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from snnlib import evaluation as E, graph

PHASE_DIR = Path(__file__).resolve().parent
OUT_DIR = PHASE_DIR / 'outputs'
OP = json.loads((PHASE_DIR.parent / '03-data-preparation' / 'outputs' /
                 'operating_point.json').read_text())
NEW_SEEDS = list(range(5, 15))
ARMS = ['connectome_stdp', 'configuration_stdp', 'er_stdp']

C = graph.load()
rows = []
t0 = time.time()
print(f'Extra seeds {NEW_SEEDS} for {ARMS}\n')
for name in ARMS:
    cfg = OP['arms'][name]
    for s in NEW_SEEDS:
        r = E.experiment(C, topology=cfg['topology'], stdp=cfg['stdp'],
                         wta=cfg['stdp'], seed=s, n_train=20, n_test=20,
                         params={'w_input': cfg['w_input'], 'wta_inh': OP['wta_inh']})
        r['arm'] = name
        r['w_input'] = cfg['w_input']
        rows.append(r)
        print(f'  {name:24s} s={s:2d}  accuracy={r["accuracy"]:.3f}  '
              f'rate={r["mean_rate_hz"]:5.2f} Hz', flush=True)
(OUT_DIR / 'extra_seeds.json').write_text(
    json.dumps(rows, indent=1, ensure_ascii=False, default=float))
print(f'\nSaved ({time.time()-t0:.0f}s)')
