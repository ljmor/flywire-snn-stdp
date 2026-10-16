"""Runs the arms of phase 04 and saves the results to outputs/.

Full factorial design. The earlier comparisons set the static connectome against
a random network with STDP + WTA, so they confounded topology with plasticity.
Crossing the two factors separates their effects:

        topology ∈ {connectome, Erdős–Rényi, configuration model}
      × plasticity ∈ {static, STDP + WTA}
      × 5 independent seeds

Every arm starts from the SAME operating point (a mean rate of 10 Hz before
learning), set in phase 03 with a bisection on w_input. Without it, a network
that simply fires more would look like a better classifier.
"""
import json, sys, time
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from snnlib import evaluation as E, graph

PHASE_DIR = Path(__file__).resolve().parent
OUT_DIR = PHASE_DIR / 'outputs'; OUT_DIR.mkdir(exist_ok=True)
OP = json.loads((PHASE_DIR.parent/'03-data-preparation'/'outputs'/'operating_point.json').read_text())
SEEDS = [0, 1, 2, 3, 4]
N_TRAIN, N_TEST = 20, 20

C = graph.load()
rows = []
t0 = time.time()
print(f'Factorial design: 3 topologies × 2 plasticity conditions × {len(SEEDS)} seeds')
print(f'Matched operating point: {OP["target_hz"]} Hz | wta_inh={OP["wta_inh"]}\n')
for name, cfg in OP['arms'].items():
    for s in SEEDS:
        r = E.experiment(C, topology=cfg['topology'], stdp=cfg['stdp'],
                         wta=cfg['stdp'], seed=s,
                         n_train=N_TRAIN, n_test=N_TEST,
                         params={'w_input': cfg['w_input'], 'wta_inh': OP['wta_inh']})
        r['arm'] = name
        r['w_input'] = cfg['w_input']
        rows.append(r)
        print(f'  {name:26s} s={s}  accuracy={r["accuracy"]:.3f}  '
              f'rate={r["mean_rate_hz"]:5.2f} Hz  spikes/correct={r["spikes_per_correct"]:7.0f}',
              flush=True)

# Comparison of the channel-to-neuron mappings on the connectome.
# 'subtype' is the anatomical anchoring JO-B (low frequencies) / JO-A (high
# frequencies); the other modes are controls that measure how much it adds.
print('\nComparison of channel→JO mappings (connectome):')
for mode in ['subtype', 'subtype_inverted', 'root_id', 'random']:
    for arm_name in ['connectome_static', 'connectome_stdp']:
        cfg = OP['arms'][arm_name]
        for s in SEEDS:
            r = E.experiment(C, topology='connectome', stdp=cfg['stdp'], wta=cfg['stdp'],
                             seed=s, n_train=N_TRAIN, n_test=N_TEST,
                             map_mode=mode, map_seed=s,
                             params={'w_input': cfg['w_input'], 'wta_inh': OP['wta_inh']})
            r['arm'] = f'mapping_{mode}_{"stdp" if cfg["stdp"] else "static"}'
            r['map_mode'] = mode
            rows.append(r)
        last_rows = [f for f in rows if f['arm'] == r['arm']]
        acc = np.mean([f['accuracy'] for f in last_rows])
        print(f'  {mode:18s} {"STDP" if cfg["stdp"] else "static":9s} '
              f'mean accuracy = {acc:.3f}', flush=True)

(OUT_DIR/'results.json').write_text(json.dumps(rows, indent=1, ensure_ascii=False,
                                               default=lambda o: float(o)))
print(f'\nSaved to {OUT_DIR}/results.json  ({time.time()-t0:.0f}s)')
