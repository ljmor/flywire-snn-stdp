"""Calibration of the operating point (phase 03).

Changes from the earlier calibration:

  Every calibration figure is reported as mean ± standard deviation over
       SEVERAL seeds. The earlier configuration had been chosen with a single
       seed, and it did not replicate when we re-ran it with more seeds
  The "propagation ratio" criterion is dropped. It had been set with uniform
       Poisson input and no task. With tonal stimuli it could only be reached
       by raising alpha_mod to a point that destroyed discrimination
  The "shiu" scheme (a constant weight per synapse, after Shiu et al., 2024)
       is gone. On this subgraph it was the median normalization
       rescaled (an algebraic identity, not a separate result)

New criterion: a MATCHED OPERATING POINT. Each topology and plasticity
condition gets the input gain `w_input` that brings it to the SAME mean firing
rate. The later comparison then measures structure, not excitability. Without
this step, a network that simply fires more would look like a better classifier.
"""
from __future__ import annotations

import numpy as np

from . import audio as A
from . import evaluation as E
from . import network as NET


def mean_rate(C, topology, stdp, wta, w_input, seed, n_stimuli=5,
              params=None, window_ms=None):
    """Mean firing rate of the network for a short sequence of songs."""
    stim = E.Stimuli()
    mapping = C.channel_map(A.N_CHANNELS)
    I, T, V, y, dur = E.build_sequence(stim, mapping, 1, seed * 100, seed)
    p = dict(params or {}, w_input=w_input)
    r = NET.simulate(C, I, T, dur, topology=topology, stdp=stdp, wta=wta,
                     seed=seed, topology_seed=seed, params=p)
    width = window_ms or A.DURATION * 1000
    M = NET.counts_per_window(r['t'], r['i'], [(t0, t0 + width) for t0, t1 in V], C.N)
    return float(M.sum() / C.N / (len(V) * width / 1000.0))


def tune_w_input(C, topology, stdp, wta, target_hz, seeds=(0, 1, 2),
                 lo=0.1, hi=40.0, tol=0.05, max_iter=18, params=None, verbose=False):
    """Bisection on w_input until the mean rate matches the target.

    The rate grows monotonically with the input gain, so the bisection is
    stable. Each step averages several seeds, so the calibration does not
    depend on one particular realization.
    """
    def f(w):
        return float(np.mean([mean_rate(C, topology, stdp, wta, w, s, params=params)
                              for s in seeds]))

    t_lo, t_hi = f(lo), f(hi)
    if t_hi < target_hz:
        return hi, t_hi, False
    if t_lo > target_hz:
        return lo, t_lo, False
    for k in range(max_iter):
        mid = 0.5 * (lo + hi)
        t = f(mid)
        if verbose:
            print(f'    w={mid:6.3f} -> {t:6.2f} Hz')
        if abs(t - target_hz) / target_hz < tol:
            return mid, t, True
        if t < target_hz:
            lo = mid
        else:
            hi = mid
    return mid, t, False


def stdp_stability(C, topology, w_input, wta_inh, seeds=(0, 1, 2), params=None):
    """Checks whether plasticity settles or runs away, averaging over seeds."""
    stim = E.Stimuli()
    mapping = C.channel_map(A.N_CHANNELS)
    rates, drifts, changes = [], [], []
    for s in seeds:
        I, T, V, y, dur = E.build_sequence(stim, mapping, 3, s * 100, s)
        p = dict(params or {}, w_input=w_input, wta_inh=wta_inh)
        r = NET.simulate(C, I, T, dur, topology=topology, stdp=True, wta=True,
                         seed=s, topology_seed=s, params=p, record_weights=True)
        rates.append(len(r['t']) / C.N / (dur / 1000.0))
        changes.append(float(np.abs(r['w']['Excitatory'] - r['w0']['Excitatory']).mean()))
        if r['trace'] is not None and len(r['trace']) > 4:
            m = r['trace'].mean(axis=1)
            drifts.append(float(np.std(m[int(0.8 * len(m)):])))
    return dict(rate=float(np.mean(rates)), rate_sd=float(np.std(rates)),
                dw=float(np.mean(changes)),
                drift=float(np.mean(drifts)) if drifts else float('nan'))
