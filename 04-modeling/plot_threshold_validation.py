"""Figure for the validation of the contact threshold (phase 04).

It reads the threshold sweep (outputs/threshold_sweep.json) and the subgraph built
with a threshold of one contact (data/interim/threshold_1/, which threshold_sweep.py
leaves behind; it is rebuilt here if it is missing). The figure has three panels:
how the connections are spread over the number of synaptic contacts they contain,
the accuracy of the four arms at each threshold, and the structural cost of each
threshold (connections and input neurons that remain). The script also prints the
shares of connections and contacts behind the first panel.
"""
import json, sys
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from snnlib import DATA_PROCESSED, FIGURES, ROOT, evaluation as E, extraction

THRESHOLD = 5
OUT_DIR = Path(__file__).resolve().parent / 'outputs'
rows = json.loads((OUT_DIR / 'threshold_sweep.json').read_text())
sub_dir = DATA_PROCESSED.parent / 'interim' / 'threshold_1'
if not (sub_dir / 'jo_meta.json').exists():
    extraction.build(min_contacts=1, save=True, out_dir=sub_dir)
w = pd.read_csv(sub_dir / 'jo_edges.csv').weight.to_numpy()

kept = w >= THRESHOLD
print(f'Connections with at least one contact: {len(w):,} ({w.sum():,} synaptic contacts)')
for k in [1, 2, 3, 4]:
    m = w == k
    print(f'  exactly {k} contact{"s" if k > 1 else ""}: {100*m.mean():4.1f} % of the connections, '
          f'{100*w[m].sum()/w.sum():4.1f} % of the contacts')
print(f'  {THRESHOLD} or more contacts: {100*kept.mean():4.1f} % of the connections, '
      f'{100*w[kept].sum()/w.sum():4.1f} % of the contacts')

plt.rcParams.update({'figure.dpi': 110, 'savefig.dpi': 150, 'savefig.bbox': 'tight',
                     'axes.titleweight': 'bold', 'font.size': 10})
BLUE, RED, GREEN = '#2E86AB', '#C73E1D', '#3CAEA3'
fig, ax = plt.subplots(1, 3, figsize=(15.5, 4.6), layout='constrained')

# 1. Share of connections by number of contacts (red: below the threshold)
k = np.arange(1, 31)
share = np.array([100 * np.mean(w == i) for i in k])
ax[0].bar(k, share, color=[RED if i < THRESHOLD else BLUE for i in k])
ax[0].axvline(THRESHOLD - 0.5, color='k', ls='--', lw=1.2)
ax[0].text(THRESHOLD + 1.5, 0.7 * share.max(),
           f'≥ {THRESHOLD} contacts:\n{100*kept.mean():.0f} % of the connections\n'
           f'but {100*w[kept].sum()/w.sum():.0f} % of the contacts', fontsize=9)
ax[0].set_xlabel('Synaptic contacts per connection'); ax[0].set_ylabel('% of connections')
ax[0].set_title('Weak connections are the majority\n(red: below the threshold)')

# 2. Accuracy of the four arms at each threshold (mean ± sd over the seeds)
for topo, c, name in [('connectome', BLUE, 'Connectome'), ('er', RED, 'Erdős–Rényi')]:
    for stdp, ls, mk in [(True, '-', 'o'), (False, '--', 's')]:
        rr = sorted((r for r in rows if r['topology'] == topo and r['stdp'] == stdp),
                    key=lambda r: r['threshold'])
        ax[1].errorbar([r['threshold'] for r in rr], [r['accuracy'] for r in rr],
                       yerr=[r['accuracy_sd'] for r in rr], color=c, ls=ls, marker=mk, capsize=3,
                       label=f'{name} · {"STDP + WTA" if stdp else "static"}')
ax[1].axhline(1 / len(E.IPIS), color='k', ls=':', lw=1, label='chance (5 classes)')
ax[1].set_ylim(0.1, 1.15)
ax[1].legend(fontsize=8, ncol=2, loc='upper center')
ax[1].set_ylabel('Accuracy (5 classes)')
ax[1].set_title('The connectome leads at every threshold')

# 3. Structural cost: connections and input neurons that remain
rr = sorted((r for r in rows if r['topology'] == 'connectome' and not r['stdp']),
            key=lambda r: r['threshold'])
u = [r['threshold'] for r in rr]
l1 = ax[2].plot(u, [r['n_connections'] / 1000 for r in rr], 'o-', color=BLUE, label='connections')
ax[2].set_ylabel('Connections (thousands)')
ax2 = ax[2].twinx()
l2 = ax2.plot(u, [r['n_input'] for r in rr], 's--', color=GREEN, label='input neurons')
ax2.set_ylabel('Input neurons')
ax[2].legend(l1 + l2, [h.get_label() for h in l1 + l2], fontsize=8)
ax[2].set_title('Structural cost of the threshold')

for a in ax[1:]:
    a.set_xscale('log'); a.set_xticks([1, 3, 5, 10], ['1', '3', '5', '10'])
    a.minorticks_off(); a.set_xlabel('Contact threshold')
    a.axvspan(THRESHOLD * 0.92, THRESHOLD * 1.08, color=GREEN, alpha=0.15)
ax2.minorticks_off()
fig.suptitle('Validation of the contact threshold')
fig.savefig(FIGURES / '04-contact-threshold-validation.png'); plt.close(fig)
print(f'\nSaved to {FIGURES.relative_to(ROOT)}/04-contact-threshold-validation.png')
