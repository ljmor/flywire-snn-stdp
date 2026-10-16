"""Auditory classification protocol and evaluation metrics.

This piece was missing altogether in the earlier version of the modeling phase.
Our evaluation covers classification accuracy, convergence speed, spike
efficiency, selectivity and synaptic stability, and until then the only measure
was a correlation between rate profiles.

Task design
-----------
Discrimination of the INTER-PULSE INTERVAL of the courtship song: five songs with
the same carrier and different intervals (25 to 65 ms). The interval is one of
the main cues the Drosophila female uses to recognize her species. In the fly,
selectivity for it appears downstream of the JO -> AMMC stage modeled here
(Zhou et al., 2015; Baker et al., 2022), so this is a proxy task imposed on an
early-stage circuit.

Why this task and not the tone discrimination used before? When we measured how
much information is ALREADY in the input layer, tones turned out to be perfectly
classifiable in the comparison window. With that ceiling the networks could only
lose information, so the comparison measured which one destroys less and not
which one computes better. With the inter-pulse interval the input ceiling drops
to 0.223 over a chance level of 0.200 (the mean over the 60 runs of the
experiment, the figure the reports give; a single measurement gives 0.250). Two
songs with the same carrier have the same spectrum (cosine 0.99996), and the
interval is not in the rate code. It can only be recovered through temporal
dynamics, which is where the topology can make a difference.

The READOUT COUNTS SPIKES IN A WINDOW, with no temporal resolution. This is
deliberate. A readout with temporal resolution would read the interval straight
from the input and bring the ceiling back to where it started. Because it only
counts spikes, the network has to turn temporal structure into differences in
firing rate.

The pairs of the difficulty gradient come from the same set of responses, with
no extra simulation.

Protocol (the same for every arm, with and without plasticity)
---------------------------------------------------------------
  1. Training of the NETWORK      with STDP on, if the arm has it
  2. Weights frozen
  3. Training responses           with the frozen weights
  4. Test responses               with the frozen weights, on unseen stimuli
  5. Linear readout trained on (3) and evaluated on (4)

The readout is trained in ALL arms, the static ones included. The comparison
therefore measures how well the network's representation separates the songs,
not whether a decoder is present. The readout population leaves out the input
neurons: the stimulus is injected straight into them, so reading them would
measure the input rather than the network (the input-only ceiling does that).
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from . import audio as A
from . import network as NET

# Inter-pulse intervals, in ms. 35 ms is typical of D. melanogaster and 55 ms
# falls in the range reported for D. simulans (Deutsch et al., 2019), so the
# range spans the difference between the two species.
IPIS = [25, 35, 45, 55, 65]
GAP_MS = 100.0
JITTER_MS = 2.0   # shifts each song pulse at random, so no alignment can be memorized

# Integration windows: how much response time the readout sees. They set the
# difficulty axis of the task, and they are also the metric that matters for
# edge AI, because a short window means fewer spikes, so less energy and a
# faster answer. All of them come from the SAME simulation; only the counted
# stretch changes.
WINDOWS_MS = [25, 50, 100, 250, 500]

# Difficulty gradient: pairs taken from the same run.
PAIRS = [('Very easy', 25, 65), ('Easy', 25, 55), ('Medium', 35, 55),
         ('Hard', 35, 45), ('Very hard', 45, 55)]


class Stimuli:
    """Builds the rate matrix of each (class, repetition), with a cache.

    EACH repetition gets its own jitter of the song pulses. If all the
    repetitions of a class shared the same temporal alignment, the readout
    could memorize it and the accuracy would be spurious.
    """

    def __init__(self, ipi_classes=None, jitter_ms=JITTER_MS):
        self.ipi_classes = list(ipi_classes or IPIS)
        self.jitter_ms = jitter_ms
        self._cache = {}

    def rates(self, ipi, seed):
        key = (ipi, seed)
        if key not in self._cache:
            self._cache[key] = A.song_rates(
                ipi, jitter_seed=seed, jitter_ms=self.jitter_ms)
        return self._cache[key]


def _plan(stimuli, repetitions, order_seed):
    """Presentation order, with the same shuffle as `build_sequence`."""
    plan = [(f, r) for r in range(repetitions) for f in stimuli.ipi_classes]
    np.random.RandomState(order_seed).shuffle(plan)
    return plan


def build_sequence(stimuli, mapping, repetitions, base_seed, order_seed=0):
    """Concatenates presentations into a single Brian2 run.

    The Poisson seed and the jitter seed depend on the REPETITION, never on the
    class. Two different classes share the realization, so the comparison
    stays paired.
    """
    plan = _plan(stimuli, repetitions, order_seed)
    I, T, windows, labels, off = [], [], [], [], 0.0
    for f, r in plan:
        i, t = A.spike_trains(stimuli.rates(f, base_seed + r), mapping,
                              seed=base_seed + r)
        I.append(i)
        T.append(t + off)
        windows.append((off, off + A.DURATION * 1000))
        labels.append(f)
        off += A.DURATION * 1000 + GAP_MS
    I = np.concatenate(I)
    T = np.concatenate(T)
    o = np.argsort(T, kind='stable')
    return I[o], T[o], windows, np.array(labels), off


def sparseness(r):
    """Population sparseness, the normalized Treves-Rolls measure (Vinje & Gallant, 2000).

    0 = every neuron responds equally, 1 = a single neuron responds.
    """
    r = np.asarray(r, float)
    n = len(r)
    if r.sum() <= 0:
        return 0.0
    return float((1 - r.mean() ** 2 / np.mean(r ** 2)) / (1 - 1.0 / n))


def _readout():
    return make_pipeline(StandardScaler(),
                         LogisticRegression(max_iter=2000, C=1.0))


def _accuracy(Xtr, ytr, Xte, yte):
    if len(np.unique(ytr)) < 2:
        return float('nan')
    m = _readout().fit(Xtr, ytr)
    return float(m.score(Xte, yte))


def experiment(C, topology='connectome', stdp=False, wta=False, seed=0,
               n_train=20, n_test=20, params=None,
               n_channels=A.N_CHANNELS, map_mode='subtype', map_seed=0,
               convergence_curve=True, windows_ms=None,
               main_window_ms=250.0):
    """Runs one complete arm and returns all the evaluation metrics."""
    mapping = C.channel_map(n_channels, mode=map_mode, seed=map_seed)
    stim = Stimuli(IPIS)

    # Test stimuli use seeds disjoint from the training ones, so the evaluation
    # always runs on realizations the network has never seen.
    s_tr = seed * 10_000
    s_te = seed * 10_000 + 5_000
    Itr, Ttr, Vtr, ytr, dur_tr = build_sequence(stim, mapping, n_train, s_tr, seed)
    Ite, Tte, Vte, yte, dur_te = build_sequence(stim, mapping, n_test, s_te, seed + 1)

    common = dict(topology=topology, seed=seed, topology_seed=seed,
                  params=params)

    # 1-2. Network training and weight freezing
    w_final, trace, dw = None, None, None
    if stdp:
        train_run = NET.simulate(C, Itr, Ttr, dur_tr, stdp=True, wta=wta,
                                 record_weights=convergence_curve, **common)
        w_final = train_run['w']
        trace = train_run['trace']
        dw = float(np.abs(w_final['Excitatory'] - train_run['w0']['Excitatory']).mean())

    # 3-4. Responses with frozen weights
    rtr = NET.simulate(C, Itr, Ttr, dur_tr, stdp=False, wta=wta, w_initial=w_final, **common)
    rte = NET.simulate(C, Ite, Tte, dur_te, stdp=False, wta=wta, w_initial=w_final, **common)
    readout_mask = ~C.is_input
    windows_ms = list(windows_ms or WINDOWS_MS)

    def _features(res, windows, width):
        clipped_windows = [(t0, min(t0 + width, t1)) for t0, t1 in windows]
        return NET.counts_per_window(res['t'], res['i'], clipped_windows, C.N)

    # Accuracy against integration time: same simulation, different stretch
    window_curve = {}
    for width in windows_ms:
        a = _features(rtr, Vtr, width)[:, readout_mask]
        b = _features(rte, Vte, width)[:, readout_mask]
        window_curve[width] = _accuracy(a, ytr, b, yte)

    Xtr = _features(rtr, Vtr, main_window_ms)
    Xte = _features(rte, Vte, main_window_ms)
    Ftr, Fte = Xtr[:, readout_mask], Xte[:, readout_mask]

    # Ceiling check: the accuracy the same readout reaches when it reads the
    # input layer DIRECTLY, with no network in between. If it is high, the task
    # is solved before the stimulus enters the circuit and comparing topologies
    # means nothing. It is always reported.
    Etr = np.array([np.bincount(A.spike_trains(stim.rates(f, s_tr + r), mapping,
                                               seed=s_tr + r)[0], minlength=C.N_input)
                    for f, r in _plan(stim, n_train, seed)], float)
    Ete = np.array([np.bincount(A.spike_trains(stim.rates(f, s_te + r), mapping,
                                               seed=s_te + r)[0], minlength=C.N_input)
                    for f, r in _plan(stim, n_test, seed + 1)], float)
    input_acc = _accuracy(Etr, ytr, Ete, yte)

    acc_5class = _accuracy(Ftr, ytr, Fte, yte)
    per_pair = {}
    for name, fa, fb in PAIRS:
        mtr = np.isin(ytr, [fa, fb])
        mte = np.isin(yte, [fa, fb])
        per_pair[name] = _accuracy(Ftr[mtr], ytr[mtr], Fte[mte], yte[mte])

    # Efficiency and representation metrics, in the main window
    test_spikes = float(Xte.sum())
    n_correct = acc_5class * len(yte)
    rate_hz = test_spikes / C.N / (len(yte) * main_window_ms / 1000.0)
    selectivity = float(np.mean([sparseness(x) for x in Fte]))
    coverage = float(100 * np.mean((Fte > 0).sum(axis=1)) / Fte.shape[1])
    ratio_prop = float(Xte[:, readout_mask].mean() / max(Xte[:, C.is_input].mean(), 1e-9))

    # Readout convergence: accuracy against the number of presentations seen
    curve = []
    if convergence_curve:
        for frac in [0.1, 0.25, 0.5, 0.75, 1.0]:
            k = max(len(IPIS) * 2, int(frac * len(ytr)))
            curve.append((k, _accuracy(Ftr[:k], ytr[:k], Fte, yte)))

    # Synaptic stability: drift of the mean weight over the last 20 % of training
    stability = None
    if trace is not None and len(trace) > 4:
        m = trace.mean(axis=1)
        stability = float(np.std(m[int(0.8 * len(m)):]))

    return dict(
        topology=topology, stdp=stdp, wta=wta, seed=seed,
        accuracy=acc_5class, chance=1.0 / len(IPIS), pair_accuracy=per_pair,
        input_accuracy=input_acc,
        test_spikes=test_spikes, mean_rate_hz=rate_hz,
        spikes_per_correct=test_spikes / max(n_correct, 1e-9),
        selectivity=selectivity, coverage_pct=coverage, propagation_ratio=ratio_prop,
        mean_dw=dw, weight_drift=stability, convergence_curve=curve,
        accuracy_vs_window=window_curve, main_window_ms=main_window_ms,
        n_train=len(ytr), n_test=len(yte),
    )


def load_results(directory=None):
    """Gathers every run of the factorial design into a single DataFrame.

    The experiments ran in two batches: five seeds for the six arms, and ten
    more seeds for the three arms with plasticity, where the spread kept the
    contrast from being resolved. This function joins them so the notebooks
    see a single set.
    """
    import pandas as pd
    from . import ROOT
    d = Path(directory) if directory else ROOT / '04-modeling' / 'outputs'
    parts = []
    for f in ['results.json', 'extra_seeds.json']:
        if (d / f).exists():
            parts.append(pd.DataFrame(json.loads((d / f).read_text())))
    if not parts:
        raise FileNotFoundError(f'no results in {d}')
    all_runs = pd.concat(parts, ignore_index=True)
    return all_runs.drop_duplicates(subset=['arm', 'seed'], keep='first')
