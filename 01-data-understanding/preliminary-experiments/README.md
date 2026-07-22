# Preliminary experiment — the JO auditory circuit in Brian2

Methodological validation carried out before the main comparative experiment of the project
*Bio-Inspired Neuromorphic Coding for Efficient Edge AI with Spiking Neural Networks* (UTPL 2026).
Everything described here lives in `preliminary-lif-stdp-experiment.ipynb`.

## Why this experiment exists

Two pieces of work motivate it. Shiu et al. (2024) took the complete *Drosophila melanogaster*
connectome released by FlyWire and ran it as a leaky integrate-and-fire network in Brian2, without
modifying a single weight. Biological wiring alone, with no training of any kind, reproduced around
95 % of the motor behavior seen in live flies. Eon Systems PBC (2026) then extended that model into
an embodied brain emulation, the whole fly brain (~127,400 neurons) inside a virtual body running in
MuJoCo, where antennal grooming, coordinated locomotion and chemotaxis emerged without being
programmed.

Neither model learns. In both, the synaptic weights are static, a frozen functional snapshot, and
their authors say as much. That is the gap our project probes, by adding spike-timing-dependent
plasticity on top of biological topology. Before doing that on a large scale we needed a small,
cheap check that the machinery works end to end.

## The three checks

1. The JO subgraph extracted from FlyWire loads correctly, with its polarity annotation intact, and
   translates into the integer index format Brian2 expects.
2. Simulated as a LIF network with the connectome weights left untouched, it produces coherent
   activity. This reproduces the baseline condition of Shiu et al. and is referred to throughout as
   the **static-weight run**.
3. Adding STDP and a winner-take-all mechanism on the same topology changes the weights measurably.
   That is the **STDP run**.

## From subgraph to Brian2 network

The input is the filtered subgraph produced by `../exploratory-data-analysis.ipynb`, read from
`../outputs/`. It holds 1,239 nodes, of which 269 are auditory JO neurons (JO-A and JO-B, sensitive
to 10–1000 Hz) and the rest are their first-order postsynaptic partners in the AMMC. There are
20,059 directed connections, all with a synaptic weight of at least 5 contacts, which discards
segmentation noise.

FlyWire identifies neurons by 18-digit `root_id`, so the notebook first builds a `root_id → index`
mapping and writes out the connection vectors as `.npy` arrays under `artifacts/`. Both simulation
runs then load the same arrays, which keeps the topology identical between them.

Every neuron is a LIF unit with a membrane time constant of 10 ms, a resting and reset potential of
−65 mV, a firing threshold of −52 mV and a refractory period of 2 ms. Membrane resistance is 10 MΩ.
Synaptic current decays with a single channel time constant, `tau_syn = 5 ms`, and receives a jump at
each presynaptic spike. The sign of that jump comes from the predicted neurotransmitter of the
connection (Eckstein et al., 2024), where acetylcholine gives an excitatory synapse and GABA or
glutamate an inhibitory one. Modulators (serotonin, dopamine, octopamine, roughly 2 % of the
connections) are folded in as weak excitatory synapses, since slow neuromodulation is not modelled
at this stage.

Two calibration decisions are worth recording. Weights are normalized by their mean rather than
their maximum, so the typical weight sits near 1 and the long FlyWire tail keeps its dynamic range;
dividing by the maximum flattens nearly everything to about 0.05 and the network goes silent. And
because the subgraph carries more inhibitory connections (10,674) than excitatory ones (9,385), the
recurrent inhibitory current is scaled to half the excitatory one.

Sensory drive is a Poisson group firing at 100 Hz, wired one-to-one onto the JO neurons, which are
the real afferents of the circuit. Real sound frequencies replace this in the modeling phase.

## What the STDP run adds

The STDP run reuses the same arrays, the same parameters and the same seed. On the excitatory
synapses it installs the pair-based rule of Song et al. (2000), implemented with `event-driven`
traces `apre` and `apost`, with `taupre = taupost = 20 ms`, `Aplus = 0.05`, `Aminus = 0.0525` and a
weight ceiling of 4.0. Depression is deliberately stronger than potentiation, which keeps the weight
distribution from running away (Diehl & Cook, 2015). The learning rate is well above the canonical
0.01 on purpose, so that a 1 s simulation is long enough for the effect to show.

Inhibitory connectome synapses stay static. On top of them sits a WTA layer, 50 inhibitory neurons
that receive excitation from the whole population and send global lateral inhibition back, which
pushes neurons toward responding to different patterns instead of all to the same one.

## Outputs

Figures land in `outputs/`.

| File | Shows |
|---|---|
| `fig01_subgraph_characterization.png` | E/I/modulatory balance of the subgraph and the synaptic weight distribution. |
| `fig02_lif_static_weights.png` | Raster, population rate and sample voltage traces for the static-weight run. |
| `fig03_lif_with_stdp.png` | Raster and rate under STDP, weight trajectories over time, and the weight distribution before against after. |
| `fig04_static_vs_stdp_comparison.png` | Mean firing rate, active neuron count and mean excitatory weight, side by side. |

Arrays and metrics land in `artifacts/`. The `.npy` files plus `id_mapping.json` are the Brian2-ready
topology. `metrics_static_weights.json` records spike count, mean rate and how many neurons were
active in the baseline run. `metrics_stdp.json` records the same quantities for the STDP run and
adds the weight statistics, mean weight before and after, the mean and absolute mean of Δw, and how
many synapses were potentiated, depressed or left essentially unchanged.

Read together, the two metric files are what the third check rests on. They also give the baseline
against which the Erdős–Rényi control network, matched in statistical properties, will be compared
under the same STDP regime.

## Reproducing it

Requirements are Python 3.11 and `brian2`, alongside `numpy`, `pandas`, `matplotlib` and `networkx`.
The first cell of the notebook installs them if they are missing.

Run `../exploratory-data-analysis.ipynb` first. It writes `jo_nodes_filtered.csv` and
`jo_edges_filtered.csv` into `../outputs/`, which is where this notebook reads from. Then run
`preliminary-lif-stdp-experiment.ipynb` from this directory, top to bottom; all paths are relative to
it. The seed is fixed at 42 and both runs finish in well under a minute on a laptop CPU.

If the network comes out silent or saturated, the first knobs to turn are `w_scale` and `w_input`,
the current scaling factors. Nothing else needs to change.

## References

- Diehl, P. U., & Cook, M. (2015). Unsupervised learning of digit recognition using spike-timing-dependent plasticity. *Frontiers in Computational Neuroscience*, 9, 99.
- Dorkenwald, S. et al. (2024). Neuronal wiring diagram of an adult brain. *Nature*, 634, 124–138.
- Eckstein, N. et al. (2024). Neurotransmitter classification from electron microscopy images at synaptic sites in *Drosophila melanogaster*. *Cell*, 187(10), 2574–2594.
- Eon Systems PBC. (2026). Embodied brain emulation of *Drosophila melanogaster*. https://eon.systems/updates/embodied-brain-emulation
- Kamikouchi, A. et al. (2009). The neural basis of *Drosophila* gravity-sensing and hearing. *Nature*, 458, 165–171.
- Schlegel, P. et al. (2024). Whole-brain annotation and multi-connectome cell typing of *Drosophila*. *Nature*, 634, 139–152.
- Shiu, P. K. et al. (2024). A leaky integrate-and-fire computational model based on the connectome of the entire adult *Drosophila melanogaster* brain. *PLOS Computational Biology*, 20(8), e1012280.
- Song, S., Miller, K. D., & Abbott, L. F. (2000). Competitive Hebbian learning through spike-timing-dependent synaptic plasticity. *Nature Neuroscience*, 3(9), 919–926.
- Stimberg, M., Brette, R., & Goodman, D. F. (2019). Brian 2, an intuitive and efficient neural simulator. *eLife*, 8, e47314.
