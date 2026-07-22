# Research overview

*Bio-Inspired Neuromorphic Coding for Efficient Edge AI with Spiking Neural Networks*
Luis Mora, Jean Alvarez. Director: Alexandra Cristina Gonzáles Eras.
Universidad Técnica Particular de Loja, 2026.

This document expands on the [README](../README.md). It explains where the problem
comes from, how the experiment is designed, what phases 2 and 3 already settled, and
what phase 4 still has to do.

---

## 1. Why the problem exists

Deep learning got very good and very expensive at the same time. Training GPT-3 drew
around 1,287 MWh, roughly what 120 American households consume in a year (Patterson et
al., 2021). A human brain runs richer cognition on about 20 watts (Raichle & Gusnard,
2002). Part of that gap is optimization, but a large part is architectural. Von Neumann
machines keep memory and computation physically apart and pay for it on every data
movement, the memory wall. Neuromorphic computing removes the separation by putting
memory in the synapse and communicating through discrete asynchronous events (Roy et
al., 2019).

Spiking neural networks are the mathematical form of that idea, proposed by Maass
(1997) as the third generation of neural network models. Hardware has followed. Intel
deployed Hala Point in 2024 with capacity for 1.15 billion artificial neurons at 2,600
watts, and IBM's NorthPole reported 25 times better energy efficiency than a comparable
GPU on image classification (Modha et al., 2023).

What has not followed is a principled way to design the topology. How many neurons, how
they group, which ones connect to which, all of it is still decided ad hoc through
heuristics, hyperparameter search, or a vague appeal to "modeled after visual cortex".
There is no theory that tells you the right wiring for a given task, so designers grope
around by trial and error.

Biology has been solving the same problem for a few hundred million years, under real
selective pressure for energy and speed. Comparing the two approaches was impossible
until very recently, because nobody had a synapse-level map of a working brain.

## 2. The window that opened in 2024

Dorkenwald et al. (2024) published the FlyWire connectome, about 127,978 neurons and 53
million synapses of an adult *Drosophila melanogaster* brain, reconstructed from
electron microscopy. Shiu et al. (2024) then ran that connectome as a LIF network in
Brian2, without modifying a single weight, and reproduced around 95% of the motor
behavior observed in live flies. Topology alone carried functional information. In
March 2026 Eon Systems extended the model into an embodied emulation inside MuJoCo,
where grooming, coordinated locomotion and chemotaxis appeared without being programmed
(Wissner-Gross, 2026).

Every one of those models freezes the synaptic weights. Plasticity, the mechanism that
makes learning and memory possible in the first place, is simply absent. The authors
themselves flag it. What exists today is a functional snapshot that cannot adapt to a
stimulus it has not seen.

We add the missing piece and then ask whether the biological wiring was worth keeping.

## 3. The experiment

One independent variable, and only one. Two networks share the neuron model, the
parameters, the learning rule and the stimuli. They differ in how their neurons are
connected.

**Biological network.** The Johnston's organ subgraph and its immediate projections,
extracted from FlyWire, filtered by synaptic weight and by the neurotransmitter
prediction of Eckstein et al. (2024), which sets excitatory or inhibitory polarity.
Johnston's organ is the fly's main mechanosensory organ. Its JO-A and JO-B populations
respond to vibrations between 10 and 1,000 Hz and work as sound sensors (Kamikouchi et
al., 2009), which is why the circuit is a reasonable substrate for an auditory task and
also why we can check the extraction against published anatomy.

**Control network.** Random connectivity with matched statistics. Two variants exist,
one built with the configuration model, which preserves the exact degree distribution,
and one Erdős–Rényi, which preserves only the density. If the biological network wins
against both, the advantage sits in the fine organization of the wiring rather than in
some aggregate property.

Stimuli will be segments of *Drosophila* courtship song against environmental noise,
encoded into spike trains through a gammatone filterbank and an inhomogeneous Poisson
process. Learning is pair-based asymmetric STDP with the constants measured by Song et
al. (2000), identical in both conditions, so neither network can be favored by a tuned
learning rule. Each condition repeats with ten seeds. After training the weights are
frozen, an unseen test set is presented, and five metrics are compared with
non-parametric tests and correction for multiple comparisons.

The success criterion was fixed in advance. A significant difference at 5% in at least
three of the five metrics, surviving that correction.

### Metrics

| Metric | What it measures |
|---|---|
| Classification accuracy | Correct discrimination on the held-out test set |
| Convergence speed | How fast the STDP weight distribution stabilizes |
| Spike efficiency | Spikes emitted per correct classification, a proxy for energy |
| Output selectivity | Treves-Rolls sparseness, how specialized the output neurons become |
| Synaptic stability | Drift of the mean weight over the final fraction of training |

## 4. What phases 2 and 3 established

### The substrate

Filtering the connectome at a minimum of five synaptic contacts per connection leaves a
subgraph of 1,239 neurons, 269 of them JO sensory neurons and 970 second-order AMMC
partners, joined by 20,059 directed edges.

| Property | Value |
|---|---|
| Density | 0.0131 |
| Mean degree | 16.19 |
| Reciprocity | 0.129 |
| Largest strongly connected component | 978 neurons |
| Mean clustering coefficient | 0.183 |
| Transitivity | 0.149 |
| Louvain communities | 8, modularity Q = 0.411 |
| Excitatory / inhibitory ratio | 0.838 |

A modularity of 0.41 over eight communities matters for the argument. The circuit is
organized, not homogeneous, which is precisely the structure a random control cannot
reproduce.

### Preliminary validation

Before adding plasticity we checked three things. That the subgraph could be extracted
correctly, that it could be simulated in Brian2 with LIF neurons and produce coherent
activity under static connectome weights (the Shiu et al. condition), and that adding
STDP produced measurable weight change. All three held. Those runs live in
`01-data-understanding/preliminary-experiments/`.

### Modulatory synapses

The connectome contains serotonergic, dopaminergic and octopaminergic connections,
around 2% of the total, whose effect is neither excitation nor inhibition. We compared
three treatments. Keeping them as a separate slow channel with tau = 50 ms, collapsing
them into weak excitatory synapses at half strength, and deleting them.

Deleting them cost between 12 and 27 percent in firing rate and downstream propagation,
so they are not negligible. We kept the three-channel version, which is also the one
that stays closest to the connectome. Details and figures are in
[results-01](../02-data-preparation/results-01-modulator-treatment-and-normalization.md).

### Calibrated parameters

| Parameter | Value | Where it came from |
|---|---|---|
| Dataset | 01, three channels exc/inh/mod | Biological fidelity |
| Weight normalization | mean | Learning stability |
| `alpha_exc`, `alpha_inh` | 1.5 nA, 0.75 nA | Dataset 01 |
| `alpha_mod` | 1.0 nA | Sweep, restores propagation |
| Channel time constants | 5 ms, 10 ms, 50 ms | Excitatory, inhibitory, modulatory |
| STDP | Aplus 0.05, Aminus 0.0525, tau 20 ms, wmax 4·w̄ | Song et al. (2000), Diehl & Cook (2015) |
| `wta_p`, `wta_inh`, `wta_exc` | 0.25, 0.1 nA, 1.0 nA | WTA calibration |
| Input | Poisson group at 100 Hz on JO neurons | Placeholder until real audio |
| Simulation time | 1,000 ms | — |

Two configurations came out of this, one without plasticity and one with STDP plus
sparse WTA. Both are reported in
[results-02](../02-data-preparation/results-02-stdp-and-wta-calibration.md), and both
will be applied identically to the three networks of phase 4.

## 5. What comes next

Phase 4 replaces the Poisson input with real sound and runs the comparison.

| Network | Topology | Configurations |
|---|---|---|
| Erdős–Rényi control | Random, same N and density | Baseline and learning |
| Connectome | Real JO subgraph | Baseline and learning |
| Connectome with STDP | Real JO subgraph that learns | Learning |

The audio pipeline, the train/validation/test split at 70/15/15 with stratification and
a fixed seed, and the statistical comparison across seeds are the remaining pieces.

## 6. Risks we already know about

The subgraph could turn out too small to produce measurable classification. If that
happens we widen it to the full AMMC and wedge circuit (Patella & Wilson, 2018) and
bring in third-order neurons. If inhomogeneous Poisson encoding fails to capture the
fine temporal structure of the song, latency coding (VanRullen et al., 2005) or a BSA
style algorithm replaces it. If Brian2 becomes too slow, the model ports to NEST or to
Loihi 2, where the STDP rule we use is standard.

And if the two networks end up statistically indistinguishable, we report that. It
would suggest that biological topology on its own, lifted out of its ecological
context, does not transfer a computational advantage. That is a finding worth
publishing and it redirects where bio-inspired design should look next.

## 7. Where this could be used

The experiments run in simulation, but the framework transfers to commercial
neuromorphic hardware such as Loihi 2 or NorthPole, and the architectural question
applies to any sensory system under a hard energy budget. Hearing aids need to classify
acoustic scenes in real time on milliwatts, and the WHO counted more than 1.5 billion
people living with some degree of hearing loss in 2024. Acoustic IoT monitoring for
biodiversity or urban safety runs below 100 mW. Predictive maintenance can catch a
failing turbine from its sound without streaming audio to the cloud. Implantable
devices and brain-computer interfaces stay under a milliwatt to avoid heating tissue.

The end user of this work is not a neuroscientist. It is the embedded systems engineer
who needs sensory intelligence at a power budget conventional deep learning cannot
reach.

## 8. Method

CRISP-DM (Chapman et al., 2000) structures the six phases and allows going back when a
later result invalidates an earlier decision, which matters in a project where one
filtering threshold on the connectome can force the whole preparation to be redone. KDD
(Fayyad et al., 1996) contributes its emphasis on selection, cleaning and
transformation, which carries unusual weight here, since the raw input is a connectome
with millions of synapses and neurotransmitter predictions of varying reliability. A
badly extracted subgraph would invalidate everything downstream.

Reproducibility is part of the design, not an afterthought. Seeds are fixed and
recorded, every run stores its hyperparameters and final weights, derived data is
published in open formats, and the notebooks regenerate every figure and table in the
written report.

---

## References

Chapman, P., et al. (2000). *CRISP-DM 1.0: Step-by-step data mining guide*. SPSS Inc.
Davies, M., et al. (2018). Loihi: a neuromorphic manycore processor with on-chip learning. *IEEE Micro*, 38(1), 82–99.
Diehl, P. U., & Cook, M. (2015). Unsupervised learning of digit recognition using spike-timing-dependent plasticity. *Frontiers in Computational Neuroscience*, 9, 99.
Dorkenwald, S., et al. (2024). Neuronal wiring diagram of an adult brain. *Nature*, 634, 124–138.
Eckstein, N., et al. (2024). Neurotransmitter classification from electron microscopy images at synaptic sites in *Drosophila melanogaster*. *Cell*, 187(10), 2574–2594.
Fayyad, U., Piatetsky-Shapiro, G., & Smyth, P. (1996). From data mining to knowledge discovery in databases. *AI Magazine*, 17(3), 37–54.
Kamikouchi, A., et al. (2009). The neural basis of *Drosophila* gravity-sensing and hearing. *Nature*, 458, 165–171.
Maass, W. (1997). Networks of spiking neurons: the third generation of neural network models. *Neural Networks*, 10(9), 1659–1671.
Modha, D. S., et al. (2023). Neural inference at the frontier of energy, space, and time. *Science*, 382(6668), 329–335.
Patella, P., & Wilson, R. I. (2018). Functional imaging of an auditory circuit. *Current Biology*, 28(11), 1899–1908.
Patterson, D., et al. (2021). Carbon emissions and large neural network training. *arXiv:2104.10350*.
Raichle, M. E., & Gusnard, D. A. (2002). Appraising the brain's energy budget. *PNAS*, 99(16), 10237–10239.
Roy, K., Jaiswal, A., & Panda, P. (2019). Towards spike-based machine intelligence with neuromorphic computing. *Nature*, 575, 607–617.
Shiu, P. K., et al. (2024). A leaky integrate-and-fire computational model based on the connectome of the entire adult *Drosophila* brain. *Nature*, 634, 210–219.
Song, S., Miller, K. D., & Abbott, L. F. (2000). Competitive Hebbian learning through spike-timing-dependent synaptic plasticity. *Nature Neuroscience*, 3, 919–926.
Stimberg, M., Brette, R., & Goodman, D. F. (2019). Brian 2, an intuitive and efficient neural simulator. *eLife*, 8, e47314.
VanRullen, R., Guyonneau, R., & Thorpe, S. J. (2005). Spike times make sense. *Trends in Neurosciences*, 28(1), 1–4.
Wissner-Gross, A. (2026). Embodied whole-brain emulation of *Drosophila melanogaster*. Eon Systems PBC.
