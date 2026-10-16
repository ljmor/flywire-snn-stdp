"""Energy-accuracy frontier of second-generation (conventional) networks, to compare with the SNN.

An earlier comparison used a fixed MLP (3075 -> 128 -> 5). That choice is
arbitrary. If the ANN is oversized the SNN looks better than it is, and if it is
undersized the SNN looks worse. The fair test is to find the SMALLEST ANN that
reaches each accuracy level and to compare frontier against frontier.

Three families are evaluated on THE SAME spike train that the SNN receives:
  linear   on T time windows       (needs a T x 123 buffer)
  MLP      on T time windows
  GRU      processing the stream step by step (streaming, no buffer)

The cost is counted in multiply-accumulate operations (MAC) per inference, plus
the cost of building the features (one addition per spike).
"""
import json, sys, time
from pathlib import Path
import numpy as np
import torch, torch.nn as nn
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from snnlib import audio as A, evaluation as E, graph
from sklearn.linear_model import LogisticRegression
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

E_MAC_PJ, E_ADD_PJ = 1.5, 0.1
OUT_DIR = Path(__file__).resolve().parent / 'outputs'
torch.manual_seed(0); np.random.seed(0)

C = graph.load(); mapping = C.channel_map(A.N_CHANNELS, mode='subtype')
stim = E.Stimuli(); DUR = A.DURATION * 1000


def make_dataset(n_rep, base_seed, n_bins):
    X, y, n_spikes = [], [], []
    for r in range(n_rep):
        for ipi in stim.ipi_classes:
            T = stim.rates(ipi, base_seed + r)
            i_, t_ = A.spike_trains(T, mapping, seed=base_seed + r)
            H, _, _ = np.histogram2d(t_, i_, bins=[n_bins, C.N_input],
                                     range=[[0, DUR], [0, C.N_input]])
            X.append(H); y.append(ipi); n_spikes.append(len(i_))
    return np.array(X, np.float32), np.array(y), float(np.mean(n_spikes))


def energy(macs, n_spikes):
    return (macs * E_MAC_PJ + n_spikes * E_ADD_PJ) / 1e6      # µJ


rows = []
t0 = time.time()
for n_bins in [5, 10, 25, 50]:
    Xtr, ytr, n_spikes_mean = make_dataset(20, 0, n_bins)
    Xte, yte, _ = make_dataset(20, 5000, n_bins)
    F = n_bins * C.N_input
    ftr, fte = Xtr.reshape(len(Xtr), -1), Xte.reshape(len(Xte), -1)

    m = make_pipeline(StandardScaler(), LogisticRegression(max_iter=3000)).fit(ftr, ytr)
    macs = F * len(stim.ipi_classes)
    rows.append(dict(model='linear', bins=n_bins, H=0, accuracy=float(m.score(fte, yte)),
                     macs=macs, energy_uj=energy(macs, n_spikes_mean)))

    for H in [8, 16, 32, 64, 128]:
        m = make_pipeline(StandardScaler(),
                          MLPClassifier((H,), max_iter=1500, random_state=0)).fit(ftr, ytr)
        macs = F * H + H * len(stim.ipi_classes)
        rows.append(dict(model='MLP', bins=n_bins, H=H, accuracy=float(m.score(fte, yte)),
                         macs=macs, energy_uj=energy(macs, n_spikes_mean)))

    # streaming GRU: processes the n_bins windows one step at a time
    for H in [8, 16, 32, 64]:
        mu, sd = Xtr.mean((0, 1), keepdims=True), Xtr.std((0, 1), keepdims=True) + 1e-6
        xtr = torch.tensor((Xtr - mu) / sd); xte = torch.tensor((Xte - mu) / sd)
        cls = sorted(set(ytr)); idx = {c: i for i, c in enumerate(cls)}
        ttr = torch.tensor([idx[v] for v in ytr]); tte = torch.tensor([idx[v] for v in yte])

        class G(nn.Module):
            def __init__(s):
                super().__init__()
                s.g = nn.GRU(C.N_input, H, batch_first=True)
                s.o = nn.Linear(H, len(cls))
            def forward(s, x):
                return s.o(s.g(x)[0][:, -1])
        net = G(); opt = torch.optim.Adam(net.parameters(), 3e-3)
        lf = nn.CrossEntropyLoss()
        for ep in range(300):
            opt.zero_grad(); lf(net(xtr), ttr).backward(); opt.step()
        with torch.no_grad():
            acc = float((net(xte).argmax(1) == tte).float().mean())
        macs = n_bins * 3 * (C.N_input * H + H * H) + H * len(cls)
        rows.append(dict(model='GRU', bins=n_bins, H=H, accuracy=acc,
                         macs=macs, energy_uj=energy(macs, n_spikes_mean)))
    print(f'  {n_bins:2d} windows done ({time.time()-t0:.0f}s)', flush=True)

(OUT_DIR / 'baseline_ann.json').write_text(json.dumps(
    dict(e_mac_pj=E_MAC_PJ, e_add_pj=E_ADD_PJ, points=rows), indent=1, ensure_ascii=False))

d = sorted(rows, key=lambda f: f['energy_uj'])
pareto, best = [], -1
for f in d:
    if f['accuracy'] > best:
        pareto.append(f); best = f['accuracy']
print('\nPARETO FRONTIER OF THE ANNs (chance 0.200)\n')
print(f'{"model":9s}{"bins":>6}{"H":>5}{"accuracy":>11}{"MAC":>12}{"energy":>11}')
for f in pareto:
    print(f'{f["model"]:9s}{f["bins"]:6d}{f["H"]:5d}{f["accuracy"]:11.3f}'
          f'{f["macs"]:12,}{f["energy_uj"]:10.4f} µJ')
mn = [f for f in rows if f['accuracy'] >= 0.88]
if mn:
    b = min(mn, key=lambda f: f['energy_uj'])
    print(f'\nCheapest ANN with accuracy >= 0.880 (close to the accuracy of the SNN):')
    print(f'  {b["model"]} bins={b["bins"]} H={b["H"]}: {b["accuracy"]:.3f}, '
          f'{b["macs"]:,} MAC = {b["energy_uj"]:.4f} µJ')
print(f'\n({time.time()-t0:.0f}s)')
