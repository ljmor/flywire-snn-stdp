"""Loading of the canonical subgraph and generation of the control topologies.

The three topologies share exactly the number of neurons, the number of
connections of each polarity and the input layer, and the controls draw their
weights from the weight distribution of the connectome.
Only the WIRING changes, and it is the independent variable of the experiment.

  connectome     real biological topology (FlyWire v783)
  er             Erdős–Rényi, keeps only the density
  configuration  configuration model, also keeps the degree sequence
                 (a control that the data-understanding phase argued for and
                 that had not been used until then)

Changes from an earlier version. The configuration model became a full
experimental arm. The ER generator now produces exactly m edges: self-loops
and repeated pairs are drawn again instead of being dropped.
"""
from __future__ import annotations

import json
import numpy as np
import pandas as pd

from . import DATA_PROCESSED

POLARITIES = ('Excitatory', 'Inhibitory', 'Modulatory')


class Connectome:
    """JO subgraph ready to simulate, with dense indices, normalized weights and masks."""

    def __init__(self, nodes, edges, meta):
        self.meta = meta
        self.nodes = nodes.reset_index(drop=True)
        self.N = len(self.nodes)
        self.idx = {int(r): i for i, r in enumerate(self.nodes.root_id)}

        self.pre = edges.pre_root_id.map(self.idx).to_numpy(np.int32)
        self.post = edges.post_root_id.map(self.idx).to_numpy(np.int32)
        self.raw_weight = edges.weight.to_numpy(float)
        # Normalization by the mean sets the mean synaptic gain to 1 and keeps
        # the dynamic range of the long tail (chosen in phase 03).
        self.w = self.raw_weight / self.raw_weight.mean()
        self.polarity = edges.polarity.to_numpy()

        self.mask = {p: self.polarity == p for p in POLARITIES}
        self.is_jo = self.nodes.is_jo.to_numpy(bool)
        self.is_input = self.nodes.is_input.to_numpy(bool)
        self.input_idx = np.where(self.is_input)[0]
        self.N_input = len(self.input_idx)
        col = self.nodes.get('cell_type')
        self.input_type = (col.to_numpy()[self.input_idx] if col is not None
                           else np.full(self.N_input, None))

    # -- topologies ---------------------------------------------------------
    def wiring(self, topology='connectome', seed=0):
        """Returns {polarity: (pre, post, w)} for the requested topology."""
        if topology == 'connectome':
            return {p: (self.pre[m], self.post[m], self.w[m])
                    for p, m in self.mask.items() if m.sum()}
        if topology == 'er':
            gen = self._er
        elif topology == 'configuration':
            gen = self._configuration
        else:
            raise ValueError(f'unknown topology: {topology}')
        rng = np.random.RandomState(seed)
        out = {}
        for p, m in self.mask.items():
            if not m.sum():
                continue
            pre, post = gen(int(m.sum()), self.pre[m], self.post[m], rng)
            # Weights are resampled from the SAME empirical distribution of that
            # polarity, so the three topologies share the weight histogram.
            out[p] = (pre, post, rng.choice(self.w[m], size=len(pre), replace=True))
        return out

    def _er(self, m, pre_bio, post_bio, rng):
        """m distinct directed edges without self-loops, uniform over N×N."""
        seen, pre, post = set(), [], []
        while len(pre) < m:
            missing = m - len(pre)
            a = rng.randint(0, self.N, size=missing * 2)
            b = rng.randint(0, self.N, size=missing * 2)
            for i, j in zip(a, b):
                if i == j or (i, j) in seen:
                    continue
                seen.add((i, j)); pre.append(i); post.append(j)
                if len(pre) == m:
                    break
        return np.array(pre, np.int32), np.array(post, np.int32)

    def _configuration(self, m, pre_bio, post_bio, rng):
        """Keeps the biological out- and in-degree sequences, almost exactly.

        Shuffles the edge ends (stubs) and rejects self-loops and repeats,
        rewiring the rejected ones until there are m edges.
        """
        out_stubs, in_stubs = pre_bio.copy(), post_bio.copy()
        seen, pre, post = set(), [], []
        pending_out, pending_in = out_stubs, in_stubs
        for _ in range(200):
            rng.shuffle(pending_out); rng.shuffle(pending_in)
            rejected_out, rejected_in = [], []
            for i, j in zip(pending_out, pending_in):
                if i == j or (i, j) in seen:
                    rejected_out.append(i); rejected_in.append(j); continue
                seen.add((i, j)); pre.append(i); post.append(j)
            if not rejected_out:
                break
            pending_out = np.array(rejected_out); pending_in = np.array(rejected_in)
        # The few stubs that cannot be paired are closed with random valid targets.
        while len(pre) < m:
            i, j = rng.randint(0, self.N), rng.randint(0, self.N)
            if i != j and (i, j) not in seen:
                seen.add((i, j)); pre.append(i); post.append(j)
        return np.array(pre[:m], np.int32), np.array(post[:m], np.int32)

    # -- channel -> input neuron mapping -------------------------------------
    def input_order(self, mode='subtype', seed=0):
        """Returns the order of the input neurons, from low to high channel.

        mode='subtype'  ANATOMICAL ANCHOR. JO-B first, then JO-A. The two
            subtypes project to separate zones of the AMMC and differ in
            tuning: JO-B prefers low-frequency vibrations and JO-A carries the
            high-frequency responses (Kamikouchi et al., 2009; Matsuo et al.,
            2014). Within each subtype neurons are sorted by root_id. It is a
            coarse tonotopic mapping with a biological basis, and it replaces
            the earlier proxy.
        mode='subtype_inverted'  CONTROL. Swaps the assignment (JO-A on the low
            channels). If the anchor helps, this variant should do worse.
        mode='root_id'  earlier proxy: blocks over the root_id order. A
            permutation test (phase 02) puts it above chance (p = 0.0024), but
            it has no anatomical basis.
        mode='random'  control that treats the mapping as a nuisance variable.
        """
        n = self.N_input
        if mode == 'root_id':
            return np.arange(n)
        if mode == 'random':
            return np.random.RandomState(seed).permutation(n)
        if mode in ('subtype', 'subtype_inverted'):
            cell_types = np.asarray(self.input_type, dtype=object)
            if all(t is None or (isinstance(t, float) and np.isnan(t)) for t in cell_types):
                raise ValueError('no cell subtype in the data: '
                                 'rebuild data/processed/ with consolidated_cell_types.csv.gz')
            low_type, high_type = ('JO-B', 'JO-A') if mode == 'subtype' else ('JO-A', 'JO-B')
            # within each subtype the root_id order is kept
            return np.concatenate([np.where(cell_types == low_type)[0],
                                   np.where(cell_types == high_type)[0]])
        raise ValueError(f'unknown mapping mode: {mode}')

    def channel_map(self, n_channels, mode='subtype', seed=0):
        """Filterbank channel that drives each input neuron.

        Channels go from low to high frequency, and the neurons are split into
        blocks of balanced size over the order returned by `input_order`.
        """
        n = self.N_input
        blocks = np.floor(np.arange(n) * n_channels / n).astype(int)
        mapping = np.empty(n, dtype=int)
        mapping[self.input_order(mode, seed)] = blocks
        return mapping


def load(directory=None):
    d = directory or DATA_PROCESSED
    nodes = pd.read_csv(d / 'jo_nodes.csv')
    edges = pd.read_csv(d / 'jo_edges.csv')
    meta = json.loads((d / 'jo_meta.json').read_text())
    return Connectome(nodes, edges, meta)
