"""Prepares the assets of the web demo from a simulation dump and the subgraph.

The assets already generated live in public/ and are versioned, so the demo starts
without running this script. It only has to run again if the subgraph, the
stimulus or one of the three networks changes.

Inputs
    outputs/demo_ipi.json                spike trains and predictions of the demo
                                         (a simulation dump that is not included
                                         in this repository; it uses the same
                                         English keys as meta.json)
    data/processed/jo_nodes.csv          canonical JO subgraph (phase 02)
    data/processed/jo_edges.csv

Outputs (in public/)
    audio/song-<ipi>.wav         the five songs, ready for <audio>
    data/meta.json               metadata, stimuli, predictions, PCA map,
                                 trajectories, song-pulse locking metrics
    data/network.bin             3D positions + attributes of the 1,239 neurons
                                 and the drawable edges of each topology
    data/spikes.bin              subsampled spikes of the three networks for the
                                 five songs, for the raster and the 3D views

The spike subsample uses the SAME fraction in the three networks, so the relative
density on screen is the real one (the random network fires about twice as many
spikes as the connectome with plasticity and about four times as many as the
static connectome; that difference is kept).

Usage:  python 06-deployment/demo/prepare_assets.py
"""
from __future__ import annotations

import base64
import json
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(ROOT))

SOURCE_DUMP = HERE / 'outputs' / 'demo_ipi.json'
PUB = HERE / 'public'
TOPOLOGY_SEED = 0              # the seed used when the dump was simulated
SPIKE_FRACTION = 0.40          # subsample for drawing, the same in the 3 networks
N_DRAWN_EDGES = 5500           # edges per topology sent to the browser
MODELS = ['connectome_stdp', 'connectome_static', 'er_stdp']
RATE_STEP_MS = 2.0             # resolution of the rhythm trace of the demo


# --------------------------------------------------------------------------
# 1. 3D layout of the neurons
# --------------------------------------------------------------------------
def layout_3d(C, channel_map):
    """Places the 1,239 neurons in a readable volume anchored to the anatomy.

    1. Depth: distance in hops from the input layer. The sound comes in at the
       front and moves deeper into the brain.
    2. Lateral position: the first two non-trivial eigenvectors of the
       normalized Laplacian of the real wiring (spectral embedding), which group
       the neurons that share a neighborhood. A third one is mixed into depth.
    3. The three axes are normalized by RANK, not by magnitude: a force layout or
       a percentile normalization leaves almost the whole graph bunched in the
       center with a few long spokes, and nothing can be seen. With ranks the
       volume fills evenly.
    4. The resulting cube is rounded into an ellipsoid and smoothed four times
       over the real edges, so that connected neurons end up close and the
       bundles appear.
    5. The 123 input JO neurons are fixed at the end on two arcs, left and right
       antenna, traversed by frequency channel: the tonotopic map reads as a
       sweep along the bundle.
    """
    import scipy.sparse as sp
    import scipy.sparse.linalg as spl

    N = C.N
    rows = np.concatenate([C.pre, C.post])
    cols = np.concatenate([C.post, C.pre])
    A = sp.coo_matrix((np.ones(len(rows)), (rows, cols)), shape=(N, N)).tocsr()
    A.data[:] = 1.0
    A.setdiag(0)
    A.eliminate_zeros()

    # -- 1. depth in hops from the input -----------------------------------
    hop = np.full(N, -1)
    hop[C.input_idx] = 0
    frontier = C.input_idx.tolist()
    indptr, indices = A.indptr, A.indices
    while frontier:
        next_frontier = []
        for v in frontier:
            for w in indices[indptr[v]:indptr[v + 1]]:
                if hop[w] < 0:
                    hop[w] = hop[v] + 1
                    next_frontier.append(int(w))
        frontier = next_frontier
    hop[hop < 0] = hop.max() + 1

    # -- 2. spectral embedding ---------------------------------------------
    degree = np.asarray(A.sum(1)).ravel()
    dinv = sp.diags(1.0 / np.sqrt(np.maximum(degree, 1e-9)))
    L = sp.eye(N) - dinv @ A @ dinv
    vals, vecs = spl.eigsh(L.tocsc(), k=6, sigma=-1e-3, which='LM')
    order = np.argsort(vals)
    U = vecs[:, order[1:4]]                    # the trivial one is dropped

    # -- 3. rank normalization ---------------------------------------------
    def rank_normalize(v):
        r = np.empty(N, float)
        r[np.argsort(v, kind='stable')] = np.linspace(-1, 1, N)
        return r

    P = np.stack([rank_normalize(U[:, 0]), rank_normalize(U[:, 1]),
                  rank_normalize(hop + 0.35 * U[:, 2])], axis=1)

    # separation of the hemispheres: the side annotation of the connectome
    side = C.nodes.side.fillna('center').to_numpy()
    sign = np.where(side == 'left', -1.0, np.where(side == 'right', 1.0, 0.0))
    P[:, 0] = 0.62 * P[:, 0] + 0.42 * sign

    # -- 4. smoothing over the wiring, spreading out again on every pass ----
    # Plain smoothing ends up pulling the whole graph into one bright ball. After
    # each smoothing step the ranks are normalized again: neighbors move closer
    # (the bundles appear) but the volume stays evenly filled.
    safe_degree = np.maximum(degree, 1)[:, None]
    for _ in range(4):
        P = 0.72 * P + 0.28 * ((A @ P) / safe_degree)
        for j in range(3):
            P[:, j] = rank_normalize(P[:, j])

    # cube -> ellipsoid
    norm = np.linalg.norm(P, axis=1, keepdims=True)
    maxi = np.max(np.abs(P), axis=1, keepdims=True)
    P = P * np.divide(maxi, norm, out=np.ones_like(norm), where=norm > 1e-9)

    # -- 5. input arcs -----------------------------------------------------
    input_list = list(C.input_idx)
    for side_name, sgn in (('left', -1.0), ('right', 1.0)):
        selected = [i for i in input_list if side[i] == side_name]
        selected.sort(key=lambda i: (channel_map[input_list.index(i)],
                                     int(C.nodes.root_id[i])))
        n = max(len(selected), 1)
        for k, i in enumerate(selected):
            u = (k + 0.5) / n                       # 0 low .. 1 high
            ang = np.pi * (0.16 + 0.68 * u)
            P[i] = [sgn * (0.50 + 0.62 * np.sin(ang)),
                    -0.30 + 0.78 * np.cos(ang),
                    -1.34 - 0.10 * np.sin(ang)]
    for i in input_list:
        if side[i] not in ('left', 'right'):
            P[i] = [0.0, -0.55, -1.34]

    # -- final normalization to a comfortable volume -----------------------
    # The depth axis is compressed on purpose: when the scene rotates, the
    # silhouette barely changes width and the framing leaves no gaps.
    P = P - P.mean(0)
    scale = np.percentile(np.abs(P), 99.0, axis=0)
    P = P / np.maximum(scale, 1e-6) * np.array([1.26, 0.96, 0.86])
    P[:, 2] *= -1.0          # the antenna faces the camera
    return P.astype(np.float32), hop.astype(np.int32)


MATRIX_SIDE = 224


def connection_matrix(pre, post, inv_order, N, side=MATRIX_SIDE):
    """Heat map of the adjacency matrix, reordered in the same way for both
    topologies. The connectome shows blocks and bands; the random graph, a
    uniform speckle. It is the most direct visual evidence that the real wiring
    has structure and the random one does not."""
    a = inv_order[pre] * side // N
    b = inv_order[post] * side // N
    counts = np.bincount(a * side + b, minlength=side * side).astype(float)
    counts = np.log1p(counts)
    cap = np.percentile(counts[counts > 0], 99) if (counts > 0).any() else 1.0
    return np.clip(counts / max(cap, 1e-9), 0, 1).reshape(side, side)


def topology_metrics(pre, post, N):
    """Clustering coefficient and reciprocal pairs: two invariants of the graph,
    independent of how it is drawn."""
    import scipy.sparse as sp

    A = sp.coo_matrix((np.ones(len(pre)), (pre, post)), shape=(N, N)).tocsr()
    A.data[:] = 1.0
    reciprocal_pairs = int((A.multiply(A.T)).sum() // 2)
    S = ((A + A.T) > 0).astype(float)
    S.setdiag(0)
    S.eliminate_zeros()
    degree = np.asarray(S.sum(1)).ravel()
    triangles = float((S @ S @ S).diagonal().sum() / 6.0)
    triads = float(np.sum(degree * (degree - 1) / 2.0))
    return dict(
        clustering=round(3 * triangles / max(triads, 1e-9), 4),
        triangles=int(round(triangles)),
        reciprocal_pairs=reciprocal_pairs)


def sample_drawn_edges(pre, post, weight, n_max, seed=3):
    """Subsamples edges for drawing, favoring the heavier ones."""
    m = len(pre)
    if m <= n_max:
        selected = np.arange(m)
    else:
        p = weight / weight.sum()
        selected = np.random.RandomState(seed).choice(m, size=n_max, replace=False, p=p)
        selected.sort()
    return pre[selected].astype(np.uint16), post[selected].astype(np.uint16)


# --------------------------------------------------------------------------
# 2. Metrics derived from the full spike trains
# --------------------------------------------------------------------------
def fine_rate(t_s, duration, step_ms=2.0, sigma_ms=4.0):
    """Smoothed population rate, in spikes per bin, sampled every step_ms."""
    n = int(round(duration * 1000 / step_ms))
    h = np.histogram(t_s, bins=n, range=(0.0, duration))[0].astype(float)
    r = max(int(round(3 * sigma_ms / step_ms)), 1)
    x = np.arange(-r, r + 1) * step_ms
    k = np.exp(-0.5 * (x / sigma_ms) ** 2)
    return np.convolve(h, k / k.sum(), mode='same')


def song_pulse_locking(t_s, song_pulses, duration, tolerance_ms=12.0):
    """Fraction of song pulses that produce a peak of rate in the network.

    It is the metric of the "hearing" step of the demo: how many of the 31 to 80
    pulses of the song leave a recognizable rise in activity. The prominence
    threshold is measured against the MEAN rate of the network itself, not
    against its deviation: a circuit that fires steadily with minimal ripple
    locks to no pulse however much its noise is amplified, which is exactly
    what sets the random control apart.
    """
    from scipy.signal import find_peaks

    step = 2.0
    r = fine_rate(t_s, duration, step_ms=step)
    if r.mean() <= 0:
        return 0.0, 0.0
    peaks, _ = find_peaks(r, prominence=0.30 * r.mean(), distance=int(10.0 / step))
    contrast = float((r.max() - r.min()) / (r.mean() + 1e-9))
    t_peaks = peaks * step / 1000.0
    p = np.asarray(song_pulses)
    p = p[(p >= 0.02) & (p <= duration - 0.02)]
    if len(t_peaks) == 0 or len(p) == 0:
        return 0.0, contrast
    d = np.abs(p[:, None] - t_peaks[None, :]).min(axis=1)
    return float((d <= tolerance_ms / 1000.0).mean()), contrast


def modulation(t_s, song_pulses, duration, ipi_s):
    """Modulation depth at the rhythm of the song (0 = flat, 1 = all or nothing)."""
    r = fine_rate(t_s, duration, step_ms=2.0)
    if r.max() <= 0:
        return 0.0
    phase = (np.arange(len(r)) * 2.0 / 1000.0) % ipi_s / ipi_s
    profile = np.array([r[(phase >= a) & (phase < a + 0.05)].mean()
                        for a in np.arange(0, 1, 0.05)])
    profile = np.nan_to_num(profile)
    if profile.max() + profile.min() <= 0:
        return 0.0
    return float((profile.max() - profile.min()) / (profile.max() + profile.min()))


def pca_trajectory(t_s, i_ord, v1, v2, mproj, scale, n_input, duration, n_steps=100):
    """Path of the stimulus through the decision plane as evidence arrives.

    Reproduces the projection stored in the simulation dump: the accumulated
    counts of the readout population projected onto the first two components.
    """
    readout = i_ord >= n_input
    tl = t_s[readout]
    il = (i_ord[readout] - n_input).astype(int)
    order = np.argsort(tl, kind='stable')
    tl, il = tl[order], il[order]

    counts = np.zeros(len(v1))
    points = np.zeros((n_steps, 2), dtype=np.float32)
    k = 0
    for p in range(n_steps):
        limit = duration * (p + 1) / n_steps
        while k < len(tl) and tl[k] < limit:
            counts[il[k]] += 1.0
            k += 1
        points[p, 0] = (counts @ v1 - mproj[0]) / scale[0]
        points[p, 1] = (counts @ v2 - mproj[1]) / scale[1]
    return points


# --------------------------------------------------------------------------
# 3. Main program
# --------------------------------------------------------------------------
def main():
    if not SOURCE_DUMP.exists():
        raise SystemExit(
            f'{SOURCE_DUMP} does not exist.\n'
            'The demo assets are already generated in public/, so the page works\n'
            'without this step. It is only needed again if the subgraph, the stimulus\n'
            'or one of the three networks changes, and that requires producing first\n'
            'the simulation dump in outputs/demo_ipi.json, which is not included in\n'
            'this repository.')

    print(f'Reading {SOURCE_DUMP.name} ({SOURCE_DUMP.stat().st_size / 1e6:.1f} MB)...')
    D = json.loads(SOURCE_DUMP.read_text())
    duration = float(D['duration_s'])
    classes = [int(c) for c in D['classes']]
    n_input = int(D['n_input'])
    N = int(D['n_neurons'])

    (PUB / 'data').mkdir(parents=True, exist_ok=True)
    (PUB / 'audio').mkdir(parents=True, exist_ok=True)

    # -- audio -------------------------------------------------------------
    for e in D['stimuli']:
        path = PUB / 'audio' / f"song-{int(e['ipi_class'])}.wav"
        path.write_bytes(base64.b64decode(e['wav']))
    print(f'  audio: {len(D["stimuli"])} WAV')

    # -- connectome: 3D layout and edges -----------------------------------
    from snnlib import graph, audio as A
    C = graph.load()
    assert C.N == N and C.N_input == n_input, 'the subgraph does not match the JSON'
    channel_map = C.channel_map(A.N_CHANNELS, mode='subtype', seed=TOPOLOGY_SEED)

    print('  3D layout (spectral embedding of the real wiring)...')
    P, hop = layout_3d(C, channel_map)

    # the same reordering used by the exported events: input first
    order = np.argsort(~C.is_input, kind='stable')
    i_demo = np.empty(C.N, int)
    i_demo[order] = np.arange(C.N)          # original neuron -> demo index

    P_demo = np.zeros_like(P)
    P_demo[i_demo] = P
    hop_demo = np.zeros_like(hop)
    hop_demo[i_demo] = hop

    channel = np.full(C.N, 255, dtype=np.uint8)
    channel[C.input_idx] = channel_map
    channel_demo = np.full(C.N, 255, dtype=np.uint8)
    channel_demo[i_demo] = channel

    side_text = C.nodes.side.fillna('center').to_numpy()
    node_type = np.where(C.is_input, 0, np.where(C.is_jo, 1, 2)).astype(np.uint8)
    side = np.array([0 if s == 'left' else 1 if s == 'right' else 2
                     for s in side_text], dtype=np.uint8)
    node_type_demo = np.zeros_like(node_type); node_type_demo[i_demo] = node_type
    side_demo = np.zeros_like(side); side_demo[i_demo] = side

    # common order of the two matrices: the same spectral embedding as the layout
    spectral_order = np.argsort(P[:, 0], kind='stable')
    inv_order = np.empty(C.N, int)
    inv_order[spectral_order] = np.arange(C.N)

    topologies = {}
    matrices = {}
    metrics = {}
    for name, topo in (('connectome', 'connectome'), ('er', 'er')):
        wiring = C.wiring(topo, seed=TOPOLOGY_SEED)
        pre = np.concatenate([v[0] for v in wiring.values()])
        post = np.concatenate([v[1] for v in wiring.values()])
        weight = np.concatenate([v[2] for v in wiring.values()])
        pol = np.concatenate([np.full(len(v[0]), k) for k, v in wiring.items()])
        # inhibitory and excitatory separately: the color of the edge carries information
        sel_pre, sel_post, sel_pol = [], [], []
        for pol_name, code in (('Excitatory', 0), ('Inhibitory', 1), ('Modulatory', 2)):
            m = pol == pol_name
            if not m.sum():
                continue
            quota = max(int(N_DRAWN_EDGES * m.sum() / len(pre)), 1)
            a, b = sample_drawn_edges(pre[m], post[m], weight[m], quota)
            sel_pre.append(i_demo[a.astype(int)].astype(np.uint16))
            sel_post.append(i_demo[b.astype(int)].astype(np.uint16))
            sel_pol.append(np.full(len(a), code, dtype=np.uint8))
        topologies[name] = (np.concatenate(sel_pre), np.concatenate(sel_post),
                            np.concatenate(sel_pol), len(pre))
        matrices[name] = (connection_matrix(pre, post, inv_order, C.N) * 255
                          ).astype(np.uint8)
        metrics[name] = topology_metrics(pre, post, C.N)
        print(f'  edges {name}: {len(pre)} in total, '
              f'{len(topologies[name][0])} drawable · '
              f'clustering {metrics[name]["clustering"]:.4f} · '
              f'reciprocal pairs {metrics[name]["reciprocal_pairs"]}')

    # -- network.bin -------------------------------------------------------
    blocks = [P_demo.astype('<f4').tobytes(),
              node_type_demo.tobytes(), side_demo.tobytes(), channel_demo.tobytes(),
              np.clip(hop_demo, 0, 255).astype(np.uint8).tobytes()]
    network_header = dict(n=N, order=['pos', 'node_type', 'side', 'channel', 'hop'],
                          matrix_side=MATRIX_SIDE, topologies={})
    offset = sum(len(b) for b in blocks)
    for name, (a, b, pol, total) in topologies.items():
        network_header['topologies'][name] = dict(
            n=len(a), total=int(total), offset=offset,
            matrix_offset=offset + len(a) * 5,
            **metrics[name])
        blocks += [a.astype('<u2').tobytes(), b.astype('<u2').tobytes(),
                   pol.tobytes(), matrices[name].tobytes()]
        offset += len(a) * 5 + MATRIX_SIDE * MATRIX_SIDE
        # the Uint16Array views of the browser need an even offset
        if offset % 4:
            padding = 4 - offset % 4
            blocks.append(b'\0' * padding)
            offset += padding
    (PUB / 'data' / 'network.bin').write_bytes(b''.join(blocks))
    print(f'  network.bin: {(PUB / "data" / "network.bin").stat().st_size / 1e3:.0f} kB')

    # -- spikes and metrics ------------------------------------------------
    rng = np.random.RandomState(19)
    chunks, index = [], {}
    offset = 0
    models_meta = {}
    ipi_by_class = {int(e['ipi_class']): float(e['ipi_class']) / 1000.0 for e in D['stimuli']}
    song_pulses_by_class = {int(e['ipi_class']): e['song_pulses'] for e in D['stimuli']}

    for name in MODELS:
        M = D['models'][name]
        mp = M['map']
        v1 = np.asarray(mp['v1'], float)
        v2 = np.asarray(mp['v2'], float)
        by_class = {}
        for k, ipi_class in enumerate(classes):
            ev = M['events'][k]
            t = np.asarray(ev['t'], dtype=np.float64)
            i = np.asarray(ev['i'], dtype=np.int32)
            sort_idx = np.argsort(t, kind='stable')
            t, i = t[sort_idx], i[sort_idx]

            locking, contrast = song_pulse_locking(
                t, song_pulses_by_class[ipi_class], duration)
            # Rate at 2 ms: at 50 fps a rhythm of 35 ms falls below Nyquist and
            # the trace looks like noise. At 2 ms each rise of the song can be
            # told apart one by one.
            rf = fine_rate(t, duration, step_ms=RATE_STEP_MS)
            rf_hz = rf * (1000.0 / RATE_STEP_MS) / N
            mod_depth = modulation(t, song_pulses_by_class[ipi_class], duration, ipi_by_class[ipi_class])
            traj = pca_trajectory(t, i, v1, v2, mp['mproj'], mp['scale'],
                                  n_input, duration)

            # subsample for drawing (the same fraction in the three networks)
            n_sub = int(len(t) * SPIKE_FRACTION)
            selected = np.sort(rng.choice(len(t), size=n_sub, replace=False))
            t_tenths_ms = np.clip(np.round(t[selected] * 10_000), 0, 65_535).astype('<u2')
            idx = i[selected].astype('<u2')
            chunks += [t_tenths_ms.tobytes(), idx.tobytes()]
            index[f'{name}|{ipi_class}'] = dict(offset=offset, n=int(n_sub))
            offset += n_sub * 4

            by_class[str(ipi_class)] = dict(
                n_spikes=int(len(t)),
                rate=[round(float(x), 2) for x in ev['rate']],
                fine_rate=[round(float(x), 1) for x in rf_hz],
                locking=round(locking, 3),
                contrast=round(contrast, 3),
                modulation=round(mod_depth, 3),
                trajectory=[[round(float(a), 4), round(float(b), 4)] for a, b in traj])

        models_meta[name] = dict(
            stdp=bool(M['stdp']), topology=M['topology'],
            silhouette=float(mp['silhouette']),
            map=[dict(x=p['x'], y=p['y'], ipi_class=int(p['ipi_class'])) for p in mp['points']],
            window_predictions={k: [int(x) for x in v]
                                for k, v in M['window_predictions'].items()},
            true_classes=[int(x) for x in M['true_classes']],
            classes=by_class)
        print(f'  {name}: {sum(v["n_spikes"] for v in by_class.values())} spikes '
              f'({SPIKE_FRACTION:.0%} drawable)')

    (PUB / 'data' / 'spikes.bin').write_bytes(b''.join(chunks))
    print(f'  spikes.bin: {(PUB / "data" / "spikes.bin").stat().st_size / 1e6:.2f} MB')

    # -- meta.json ---------------------------------------------------------
    meta = dict(
        duration=duration, fps=int(D['fps']), classes=classes,
        rate_step_ms=RATE_STEP_MS,
        n_neurons=N, n_input=n_input,
        spike_fraction=SPIKE_FRACTION,
        cf=[round(float(x), 1) for x in D['stimuli'][0]['cf']],
        network=network_header,
        spike_index=index,
        stimuli=[dict(ipi_class=int(e['ipi_class']),
                      audio=f"audio/song-{int(e['ipi_class'])}.wav",
                      song_pulses=[round(float(x), 4) for x in e['song_pulses']],
                      bands=[[round(float(x), 3) for x in row] for row in e['bands']])
                 for e in D['stimuli']],
        models=models_meta)
    path = PUB / 'data' / 'meta.json'
    path.write_text(json.dumps(meta, ensure_ascii=False, separators=(',', ':')))
    print(f'  meta.json: {path.stat().st_size / 1e6:.2f} MB')

    print('\nSummary of song-pulse locking (fraction of song pulses that the '
          'network turns into a peak of activity):')
    for name in MODELS:
        v = [models_meta[name]['classes'][str(c)]['locking'] for c in classes]
        m = [models_meta[name]['classes'][str(c)]['modulation'] for c in classes]
        print(f'  {name:20s} locking ' + ' '.join(f'{x:.2f}' for x in v)
              + '   modulation ' + ' '.join(f'{x:.2f}' for x in m))


if __name__ == '__main__':
    main()
