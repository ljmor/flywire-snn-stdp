"""Spiking network: three-channel LIF neurons, STDP and sparse WTA on Brian2.

A single function builds and simulates any of the experimental arms, so the
compared topologies differ ONLY in their wiring.

Changes from an earlier version:
  wmax is set to the largest initial excitatory weight, so no connection is
       clipped at the first spike. Before, wmax = 4·mean clipped 230
       connections that carried 16.7 % of the excitatory weight mass, and
       mixed up plasticity with truncation
  The same constructor builds the arms with and without plasticity for the
       three topologies, so the design is factorial (topology × plasticity)
  Every arm is actually simulated
"""
from __future__ import annotations

import numpy as np
from brian2 import (Mohm, Network, NetworkOperation, NeuronGroup, SpikeGeneratorGroup,
                    SpikeMonitor, Synapses, defaultclock, mV, ms, nA, prefs,
                    seed as brian2_seed, start_scope)

prefs.codegen.target = 'cython'

# --- default model parameters (phase 03) ------------------------------------
# The experiments override w_input and wta_inh with the values that phase 03
# stores in 03-data-preparation/outputs/operating_point.json.
P = dict(
    V_rest=-65., V_reset=-65., V_thresh=-52.,   # mV
    tau_m=10., tau_ref=2., R_m=10.,             # ms, ms, MOhm
    tau_exc=5., tau_inh=10., tau_mod=50.,       # ms
    alpha_exc=1.5, alpha_inh=0.75, alpha_mod=1.0, w_input=3.0,   # nA
    stdp_Aplus=0.05, stdp_Aminus=0.0525, stdp_tau=20.,           # -, -, ms
    wta_n=50, wta_exc=1.0, wta_inh=0.1, wta_p=0.25,              # -, nA, nA, -
    wmax_factor=None,   # None -> wmax = max of the initial weight; otherwise a multiple of the mean
)

EQUATIONS = '''
dv/dt     = (-(v - V_rest) + R_m*(I_exc + I_inh + I_mod))/tau_m : volt (unless refractory)
dI_exc/dt = -I_exc/tau_exc : amp
dI_inh/dt = -I_inh/tau_inh : amp
dI_mod/dt = -I_mod/tau_mod : amp
'''

_STDP_MODEL = ('w:1\n'
               'dapre/dt  = -apre/stdp_tau  : 1 (event-driven)\n'
               'dapost/dt = -apost/stdp_tau : 1 (event-driven)')
_STDP_PRE = ('I_exc_post += alpha_exc*w\n'
             'apre += stdp_Aplus\n'
             'w = clip(w + apost, 0, wmax)')
_STDP_POST = ('apost += -stdp_Aminus\n'
              'w = clip(w + apre, 0, wmax)')


def _namespace(p):
    return dict(V_rest=p['V_rest'] * mV, V_thresh=p['V_thresh'] * mV,
                V_reset=p['V_reset'] * mV, tau_m=p['tau_m'] * ms,
                R_m=p['R_m'] * Mohm, tau_exc=p['tau_exc'] * ms,
                tau_inh=p['tau_inh'] * ms, tau_mod=p['tau_mod'] * ms)


def simulate(C, indices, times, duration_ms, topology='connectome', stdp=False,
             wta=False, w_initial=None, seed=0, topology_seed=0,
             params=None, dt_ms=0.1, record_weights=False):
    """Runs one simulation and returns the spikes, the final and initial weights and the weight trace.

    `indices`/`times` are the input spike train on the JO neurons of the input
    layer (indices 0..N_input-1, times in ms). Several stimuli can be
    concatenated in a single run and split later by time window, so
    plasticity accumulates along the sequence.

    `w_initial` starts from weights that were already learned (evaluation with
    frozen weights). If it is None, the run starts from the initial weights of
    the chosen topology.
    """
    p = dict(P, **(params or {}))
    start_scope()
    brian2_seed(seed)
    np.random.seed(seed)
    defaultclock.dt = dt_ms * ms
    ns = _namespace(p)

    G = NeuronGroup(C.N, EQUATIONS, threshold='v>V_thresh', reset='v=V_reset',
                    refractory=p['tau_ref'] * ms, method='euler', namespace=ns)
    G.v = ns['V_rest'] + np.random.uniform(0, 1, C.N) * (ns['V_thresh'] - ns['V_rest'])
    G.I_exc = G.I_inh = G.I_mod = 0 * nA

    gen = SpikeGeneratorGroup(C.N_input, indices, times * ms)
    s_in = Synapses(gen, G, on_pre='I_exc_post += w_input',
                    namespace={'w_input': p['w_input'] * nA})
    s_in.connect(i=np.arange(C.N_input), j=C.input_idx)
    objects = [G, gen, s_in]

    wiring = C.wiring(topology, seed=topology_seed)
    w0 = {k: (w_initial[k].copy() if w_initial and k in w_initial else v[2].copy())
          for k, v in wiring.items()}

    synapses = {}
    if 'Excitatory' in wiring:
        pre, post, _ = wiring['Excitatory']
        # wmax = largest initial weight, so no synapse is clipped at the start.
        # `wmax_factor` sets it instead as a multiple of the mean, the earlier
        # criterion, so that the two options can be compared.
        if p.get('wmax_factor'):
            wmax = float(p['wmax_factor'] * w0['Excitatory'].mean())
        else:
            wmax = float(max(w0['Excitatory'].max(), 1e-6))
        if stdp:
            s = Synapses(G, G, model=_STDP_MODEL, on_pre=_STDP_PRE, on_post=_STDP_POST,
                         namespace={'alpha_exc': p['alpha_exc'] * nA,
                                    'stdp_tau': p['stdp_tau'] * ms,
                                    'stdp_Aplus': p['stdp_Aplus'],
                                    'stdp_Aminus': p['stdp_Aminus'], 'wmax': wmax})
        else:
            s = Synapses(G, G, model='w:1', on_pre='I_exc_post += alpha_exc*w',
                         namespace={'alpha_exc': p['alpha_exc'] * nA})
        s.connect(i=pre, j=post)
        s.w = w0['Excitatory']
        synapses['Excitatory'] = s
        objects.append(s)

    for pol, sign, alpha, channel in [('Inhibitory', '-=', 'alpha_inh', 'I_inh'),
                                      ('Modulatory', '+=', 'alpha_mod', 'I_mod')]:
        if pol not in wiring:
            continue
        pre, post, _ = wiring[pol]
        s = Synapses(G, G, model='w:1', on_pre=f'{channel}_post {sign} {alpha}*w',
                     namespace={alpha: p[alpha] * nA})
        s.connect(i=pre, j=post)
        s.w = w0[pol]
        synapses[pol] = s
        objects.append(s)

    if wta:
        # Sparse WTA: each interneuron inhibits a random fraction wta_p of the
        # network. The dense variant silenced the network (phase 03).
        Gw = NeuronGroup(p['wta_n'], EQUATIONS, threshold='v>V_thresh',
                         reset='v=V_reset', refractory=p['tau_ref'] * ms,
                         method='euler', namespace=ns)
        Gw.v = ns['V_rest']
        Gw.I_exc = Gw.I_inh = Gw.I_mod = 0 * nA
        s_e2i = Synapses(G, Gw, on_pre='I_exc_post += wta_exc',
                         namespace={'wta_exc': p['wta_exc'] * nA})
        s_e2i.connect(j='i % wta_n', namespace={'wta_n': p['wta_n']})
        s_i2e = Synapses(Gw, G, on_pre='I_inh_post -= wta_inh',
                         namespace={'wta_inh': p['wta_inh'] * nA})
        s_i2e.connect(p=p['wta_p'])
        objects += [Gw, s_e2i, s_i2e]

    mon = SpikeMonitor(G)
    objects.append(mon)
    net = Network(*objects)

    trace = None
    if record_weights and stdp and 'Excitatory' in synapses:
        trace = []
        sample_idx = np.linspace(0, len(w0['Excitatory']) - 1, 500).astype(int)
        _s_exc = synapses['Excitatory']

        def _record():
            trace.append(np.array(_s_exc.w[:])[sample_idx].copy())
        net.add(NetworkOperation(_record, dt=50 * ms))

    net.run(duration_ms * ms, report=None)
    w_final = {k: np.array(s.w[:]) for k, s in synapses.items()}
    return dict(t=np.array(mon.t / ms), i=np.array(mon.i), w=w_final,
                w0=w0, trace=np.array(trace) if trace else None)


def counts_per_window(t, i, windows, N):
    """Matrix (n_stimuli, N) with the spikes of each neuron in each window."""
    M = np.zeros((len(windows), N))
    for k, (t0, t1) in enumerate(windows):
        m = (t >= t0) & (t < t1)
        M[k] = np.bincount(i[m], minlength=N)
    return M
