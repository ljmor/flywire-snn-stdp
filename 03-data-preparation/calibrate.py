"""Calibration of the operating point: runs it and saves it to 03-data-preparation/outputs/."""
import json, sys, time
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from snnlib import calibration as CAL, graph

TARGET_HZ = 10.0
WTA_INH = 0.6
SEEDS = (0, 1, 2, 3, 4)
OUT_DIR = Path(__file__).resolve().parent / 'outputs'
OUT_DIR.mkdir(exist_ok=True)

C = graph.load()
res = {'target_hz': TARGET_HZ, 'wta_inh': WTA_INH, 'seeds': list(SEEDS), 'arms': {}}
t0 = time.time()
print(f'Matching the mean rate of every arm to {TARGET_HZ} Hz '
      f'(bisection on w_input, {len(SEEDS)} seeds)\n')
print(f'{"arm":30s}{"w_input":>9}{"rate Hz":>16}{"ok":>5}')
for topo in ['connectome', 'er', 'configuration']:
    for stdp in [False, True]:
        p = {'wta_inh': WTA_INH}
        w, t, ok = CAL.tune_w_input(C, topo, stdp, stdp, TARGET_HZ,
                                    seeds=SEEDS, params=p)
        tt = [CAL.mean_rate(C, topo, stdp, stdp, w, s, params=p) for s in SEEDS]
        name = f'{topo}_{"stdp" if stdp else "static"}'
        res['arms'][name] = dict(topology=topo, stdp=stdp, w_input=w,
                                 rate=float(np.mean(tt)), rate_sd=float(np.std(tt)),
                                 converged=bool(ok))
        print(f'{name:30s}{w:9.3f}{np.mean(tt):10.2f}±{np.std(tt):4.2f}{"  yes" if ok else "   no":>5}')
res['seconds'] = time.time() - t0
(OUT_DIR / 'operating_point.json').write_text(json.dumps(res, indent=2, ensure_ascii=False))
print(f'\nSaved to {OUT_DIR}/operating_point.json  ({res["seconds"]:.0f}s)')
