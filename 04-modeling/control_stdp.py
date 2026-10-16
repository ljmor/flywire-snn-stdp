"""Control of the STDP rule: variants of the weight ceiling and of the learning rate on the connectome.

The result with plasticity could depend on two settings of the rule rather than
on the wiring. Four variants of the connectome with STDP + WTA (three seeds each)
tell apart two possible causes of a poor result:
  (a) the high weight ceiling (wmax = largest initial weight) leaves room for
      runaway potentiation, which raises the activity and erases selectivity;
  (b) the learning rate is too high for the short training used here.
The variants lower the ceiling to four times the mean weight, divide the
learning rate by five, or do both.
"""
import json, sys, time
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from snnlib import evaluation as E, graph

PHASE_DIR = Path(__file__).resolve().parent
OP = json.loads((PHASE_DIR.parent/'03-data-preparation'/'outputs'/'operating_point.json').read_text())
C = graph.load()
cfg = OP['arms']['connectome_stdp']
base = dict(w_input=cfg['w_input'], wta_inh=OP['wta_inh'])
w_exc = C.w[C.mask['Excitatory']]

VARIANTS = {
    'high ceiling (initial max)':     dict(base),
    'ceiling 4×mean (previous)':      dict(base, wmax_factor=4.0),
    'learning rate ÷5':               dict(base, stdp_Aplus=0.01, stdp_Aminus=0.0105),
    'rate ÷5 + ceiling 4×mean':       dict(base, stdp_Aplus=0.01, stdp_Aminus=0.0105, wmax_factor=4.0),
}
rows=[]
print('Connectome + STDP + WTA, variants of the rule (3 seeds)\n')
print(f'{"variant":30s}{"accuracy":>16}{"rate Hz":>10}{"|dw|":>9}')
for name, p in VARIANTS.items():
    acc, rates, dws = [], [], []
    for s in [0,1,2]:
        r = E.experiment(C, 'connectome', stdp=True, wta=True, seed=s,
                         n_train=20, n_test=20, params=p)
        acc.append(r['accuracy']); rates.append(r['mean_rate_hz']); dws.append(r['mean_dw'])
    rows.append(dict(variant=name, accuracy=float(np.mean(acc)),
                     accuracy_sd=float(np.std(acc)), rate=float(np.mean(rates)),
                     dw=float(np.mean(dws))))
    print(f'{name:30s}{np.mean(acc):9.3f}±{np.std(acc):5.3f}{np.mean(rates):10.2f}{np.mean(dws):9.4f}', flush=True)
(PHASE_DIR/'outputs'/'control_stdp.json').write_text(json.dumps(rows, indent=1, ensure_ascii=False))
print('\nReference: connectome, static = 0.566 ± 0.082 at 10.38 Hz (5 seeds, outputs/results.json)')
