"""Accuracy-energy frontier: can the SNN cost less than a conventional (second-generation) network?

An earlier estimate put the energy per inference of the connectome with
plasticity several times above that of the reference multilayer perceptron
(MLP). The reason is that the network, calibrated to 10 Hz before learning,
fires thousands of spikes per inference.

Here we sweep the input gain directly below the calibrated point, not by
bisection, because simulating with high gains and active plasticity makes the
network fire out of control and the sweep becomes unworkable. For each
integration window we measure the accuracy and estimate the synaptic events per
inference.
"""
import json, sys, time
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from snnlib import evaluation as E, graph

SEEDS = [0, 1, 2]
WTA_INH = 0.6
OUT_DIR = Path(__file__).resolve().parent / 'outputs'
OP = json.loads((Path(__file__).resolve().parent.parent /
                 '03-data-preparation' / 'outputs' / 'operating_point.json').read_text())

# synaptic event on Loihi (Davies et al., 2018) · 16-bit floating-point MAC at 45 nm (Horowitz, 2014)
E_SYN_PJ, E_MAC_PJ = 23.6, 1.5
MACS_MLP = 3075 * 128 + 128 * 5
E_MLP_UJ = MACS_MLP * E_MAC_PJ / 1e6

C = graph.load()
OUT_DEGREE = np.bincount(C.pre, minlength=C.N).astype(float)   # synaptic events per spike

print(f'MLP reference: {MACS_MLP:,} MAC = {E_MLP_UJ:.2f} µJ/inference (accuracy 1.000)')
print(f'Equivalent budget for the SNN: {E_MLP_UJ*1e6/E_SYN_PJ:,.0f} synaptic events\n')

ARMS = [('connectome', True), ('connectome', False), ('er', True)]
FRACTIONS = [0.15, 0.25, 0.40, 0.60, 1.00]   # of the gain calibrated to 10 Hz

rows = []
t0 = time.time()
for topo, stdp in ARMS:
    w0 = OP['arms'][f'{topo}_{"stdp" if stdp else "static"}']['w_input']
    print(f'--- {topo} {"STDP" if stdp else "static"} (calibrated w_input = {w0:.2f} nA) ---',
          flush=True)
    for frac in FRACTIONS:
        w = w0 * frac
        p = {'w_input': w, 'wta_inh': WTA_INH}
        acc, evt, rates = {}, {}, []
        for s in SEEDS:
            r = E.experiment(C, topology=topo, stdp=stdp, wta=stdp, seed=s,
                             n_train=20, n_test=20, params=p)
            rates.append(r['mean_rate_hz'])
            # synaptic events: each spike costs the out-degree of the neuron that
            # fires, taken here as the mean out-degree of the network
            for v, a in r['accuracy_vs_window'].items():
                acc.setdefault(v, []).append(a)
                evt.setdefault(v, []).append(
                    r['test_spikes'] * (v / r['main_window_ms']) / r['n_test'] * OUT_DEGREE.mean())
        for v in sorted(acc):
            ev = float(np.mean(evt[v]))
            rows.append(dict(topology=topo, stdp=stdp, w_input=w, frac=frac,
                             rate=float(np.mean(rates)), window_ms=v,
                             accuracy=float(np.mean(acc[v])),
                             accuracy_sd=float(np.std(acc[v])),
                             events=ev, energy_uj=ev * E_SYN_PJ / 1e6))
        best_window = max(acc, key=lambda v: np.mean(acc[v]))
        print(f'  w={w:6.2f} nA (rate {np.mean(rates):5.2f} Hz)  best {np.mean(acc[best_window]):.3f} '
              f'at {best_window:3.0f} ms  |  {np.mean(evt[best_window])/1000:6.1f}k events '
              f'= {np.mean(evt[best_window])*E_SYN_PJ/1e6:5.2f} µJ', flush=True)

(OUT_DIR / 'energy_frontier.json').write_text(json.dumps(
    dict(reference=dict(macs=MACS_MLP, energy_uj=E_MLP_UJ, e_syn_pj=E_SYN_PJ,
                        e_mac_pj=E_MAC_PJ, accuracy=1.0), points=rows),
    indent=1, ensure_ascii=False))

ok_ = [f for f in rows if f['energy_uj'] <= E_MLP_UJ]
print(f'\nPoints with energy <= {E_MLP_UJ:.2f} µJ: {len(ok_)} of {len(rows)}')
for f in sorted(ok_, key=lambda f: -f['accuracy'])[:10]:
    print(f"  {f['topology']:10s} {'STDP' if f['stdp'] else 'static':9s} "
          f"w={f['w_input']:5.2f} {f['window_ms']:3.0f} ms -> accuracy={f['accuracy']:.3f}  "
          f"{f['energy_uj']:.3f} µJ ({E_MLP_UJ/f['energy_uj']:4.1f}x less energy than the MLP)")
print(f'\nSaved ({time.time()-t0:.0f}s)')
