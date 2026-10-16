"""Is a threshold of at least 5 contacts the right choice for the task?

Keeping only connections with at least 5 synaptic contacts is the threshold used
by Dorkenwald et al. (2024) and applied by default in Codex, to discard the false
positives of automatic synapse detection; the authors call it reasonable but
arbitrary. In this circuit it has a high cost. It removes 31.6 % of the 393
annotated JO neurons, and of the 269 that remain only 123 can still pass the
stimulus on.

This sweep tests the choice empirically. For each threshold it rebuilds the
subgraph in data/interim/ (when it is not there yet), recalibrates the operating
point (10 Hz) by bisection and runs the task with the connectome and with the
random control. Two questions matter:

  1. does accuracy improve when the threshold goes down, or does the noise of the
     weak connections weigh more than the connectivity they add?
  2. does the conclusion (connectome > Erdős–Rényi) hold at every threshold?
"""
import json, sys, time
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from snnlib import DATA_PROCESSED, calibration as CAL, evaluation as E, extraction, graph

THRESHOLDS = [1, 3, 5, 10]
SEEDS = [0, 1, 2]
TARGET_HZ, WTA_INH = 10.0, 0.6
OUT_DIR = Path(__file__).resolve().parent / 'outputs'

rows = []
t0 = time.time()
print(f'Threshold sweep: {THRESHOLDS} | {len(SEEDS)} seeds | target {TARGET_HZ} Hz\n')
for u in THRESHOLDS:
    sub_dir = DATA_PROCESSED.parent / 'interim' / f'threshold_{u}'
    if not (sub_dir / 'jo_meta.json').exists():
        extraction.build(min_contacts=u, save=True, out_dir=sub_dir)
    C = graph.load(sub_dir)
    print(f'--- threshold >= {u}: {C.N} nodes, {len(C.pre):,} connections, '
          f'{C.N_input} input neurons ---', flush=True)
    for topo in ['connectome', 'er']:
        for stdp in [False, True]:
            p0 = {'wta_inh': WTA_INH}
            w, rate, ok = CAL.tune_w_input(C, topo, stdp, stdp, TARGET_HZ,
                                           seeds=SEEDS, params=p0)
            p = {'w_input': w, 'wta_inh': WTA_INH}
            accs, ceilings, spikes_per_correct_list = [], [], []
            for s in SEEDS:
                r = E.experiment(C, topology=topo, stdp=stdp, wta=stdp, seed=s,
                                 n_train=20, n_test=20, params=p)
                accs.append(r['accuracy']); ceilings.append(r['input_accuracy'])
                spikes_per_correct_list.append(r['spikes_per_correct'])
            rows.append(dict(threshold=u, topology=topo, stdp=stdp, N=C.N,
                             n_connections=len(C.pre), n_input=C.N_input,
                             w_input=w, rate=rate,
                             accuracy=float(np.mean(accs)), accuracy_sd=float(np.std(accs)),
                             input_ceiling=float(np.mean(ceilings)),
                             spikes_per_correct=float(np.mean(spikes_per_correct_list))))
            print(f'  {topo:10s} {"STDP" if stdp else "static":9s} '
                  f'w_in={w:6.2f} rate={rate:5.2f}  accuracy={np.mean(accs):.3f}'
                  f'±{np.std(accs):.3f}  ceiling={np.mean(ceilings):.3f}', flush=True)
(OUT_DIR / 'threshold_sweep.json').write_text(json.dumps(rows, indent=1, ensure_ascii=False))
print(f'\nSaved to {OUT_DIR}/threshold_sweep.json  ({time.time()-t0:.0f}s)')
