# Bio-Inspired Neuromorphic Coding for Efficient Edge AI with Spiking Neural Networks

Does the wiring of a real brain compute better than wiring we design ourselves? That
is the whole question behind this repository. We take the auditory circuit of
*Drosophila melanogaster*, the Johnston's organ, exactly as it was mapped by the
FlyWire connectome, run it as a spiking neural network in Brian2, teach it with
spike-timing-dependent plasticity, and put it head to head against a control network
that has the same statistics but random connectivity.

This is the public code and data repository of an undergraduate research project
(*Trabajo de Integración Curricular*) at Universidad Técnica Particular de Loja. It is
open source and it grows phase by phase as the work advances.

Original title in Spanish: *Codificación Neuromórfica Bioinspirada para Edge AI
Eficiente con Redes Neuronales de Pulsos*.

---

## The people behind it

| Role | Name |
|---|---|
| Author | Luis Mora |
| Author | Jean Alvarez |
| Director | Alexandra Cristina Gonzáles Eras |
| Programme | Computer Science, Faculty of Engineering and Architecture |
| Institution | Universidad Técnica Particular de Loja (UTPL), Loja, Ecuador |
| Year | 2026 |

---

## The research question

In October 2024 the FlyWire consortium published the first complete synapse-resolution
connectome of an adult *Drosophila* brain, roughly 128,000 neurons and 53 million
synapses (Dorkenwald et al., 2024). Weeks later Shiu et al. (2024) showed that running
that connectome as a plain LIF network in Brian2 predicts about 95% of the motor
behavior measured in live flies, with no training whatsoever. In March 2026 Eon
Systems went further and drove a virtual fly body with the whole connectome.

Both of those systems share one limitation, and their own authors say so plainly. The
synaptic weights are frozen. There is no plasticity, so the network never learns and
never adapts. That gap is where our work starts.

The question we ask is narrow and testable.

> Given the same LIF neuron model, the same parameters, the same STDP rule and the
> same stimuli, does a network wired from the Johnston's organ subgraph perform better,
> worse, or the same as a control network with random connectivity but matched
> statistical properties, on an auditory classification task?

Any of the three answers is a result. If the biological topology loses or ties, that
tells the bio-inspired design community something useful about how far connectome
structure transfers outside its ecological niche.

---

## Objectives

**General.** Build and evaluate a neuromorphic simulation framework that uses the
synaptic topology of the *Drosophila* auditory circuit inside a spiking neural network
capable of learning through STDP, then compare it against an artificially generated
SNN to find out whether the biological architecture carries a computational advantage.

**Specific.**

1. Extract and process the Johnston's organ subgraph from the FlyWire connectome,
   with full connectivity, neurotransmitter identity and estimated synaptic weights.
2. Implement the biological SNN in Brian2 with LIF neurons and an STDP learning rule.
3. Design a control SNN whose topology is generated algorithmically with equivalent
   statistical properties.
4. Build the auditory encoding pipeline that turns sound into spike trains, and train
   both networks under identical, reproducible conditions.
5. Compare the two quantitatively on classification accuracy, convergence speed, spike
   efficiency, output selectivity and synaptic stability.

---

## Where the project stands

The work follows CRISP-DM, adapted to a controlled comparative experiment. The
methodology diagram is in [docs/figures/crisp-dm-pipeline.png](docs/figures/crisp-dm-pipeline.png).

| Phase | Status | What came out of it |
|---|---|---|
| 1. Problem understanding | done | Research question, success criterion, risk register |
| 2. Data understanding | done | JO subgraph extracted and characterized, 1,239 neurons and 20,059 synapses, modularity Q = 0.41 |
| 3. Data preparation | done | Modulator treatment and weight normalization decided, STDP and WTA calibrated, two base configurations fixed |
| 4. Modeling | open | Auditory classification with real audio across three networks |
| 5. Evaluation | open | Non-parametric comparison across ten seeds per condition |
| 6. Deployment | ongoing | This repository |

Everything published here so far drives the network with a **Poisson input group at
100 Hz**, not with sound. Real audio frequencies arrive in phase 4, and the parameters
calibrated in phase 3 are exactly what phase 4 will reuse.

### The two configurations phase 4 inherits

Both sit on dataset 01 (three synaptic channels, excitatory, inhibitory and
modulatory) with mean-based weight normalization.

| Configuration | Parameters | Rate | Propagation ratio | Selectivity | Drift |
|---|---|---|---|---|---|
| Baseline, no plasticity | `alpha_mod = 1.0` | 23.58 Hz | 0.343 | 0.807 | — |
| Learning | `alpha_mod = 1.0`, STDP, sparse WTA `wta_p = 0.25`, `wta_inh = 0.1` | 15.87 Hz | 0.645 | 0.869 | 0.0018 |

The baseline pins down a common dynamic operating point. The learning configuration
pins down how the networks learn. Applying both to all three networks of phase 4 is
what keeps topology as the only variable that moves. Full reasoning and the sweeps
behind every number are in
[results-02-stdp-and-wta-calibration.md](02-data-preparation/results-02-stdp-and-wta-calibration.md).

---

## Repository structure

```
01-data-understanding/
    exploratory-data-analysis.ipynb    CRISP-DM phase 2, plus the filtering decisions of phase 3
    data/                              FlyWire input tables
    outputs/                           JO subgraph, control networks, EDA figures, summary metrics
    preliminary-experiments/           methodological validation of the substrate
        preliminary-lif-stdp-experiment.ipynb
        artifacts/                     Brian2-ready arrays and run metrics
        outputs/                       figures of the static-weight and STDP runs

02-data-preparation/                   CRISP-DM phase 3
    01-dataset01-raw-connectome-weights.ipynb    modulators kept as their own slow channel
    02-dataset02-modulators-as-excitatory.ipynb  modulators collapsed into weak excitatory
    03-dataset03-modulators-removed.ipynb        modulators deleted
    04-dataset01-stdp-learning.ipynb             STDP and WTA on the chosen dataset, alpha_mod sweep
    05-dataset01-wta-calibration.ipynb           WTA strength and density, dense versus sparse
    results-01-modulator-treatment-and-normalization.md
    results-02-stdp-and-wta-calibration.md
    outputs/                           one folder per experiment, figures and tables

03-modeling/                           CRISP-DM phase 4, in progress
docs/figures/                          methodology diagram
requirements.txt
```

Every notebook writes into the `outputs/` folder next to it, and every figure or table
in the written report comes from one of those folders.

---

## Getting the data

Two tables from the FlyWire Codex feed the pipeline.

`classification.csv.gz`, the per-neuron annotation table, ships with the repository in
`01-data-understanding/data/`. The connection table
`connections_buhmann_no_threshold.csv.gz` does not. It carries roughly 17 million rows
and is far too large for a Git repository, so download it from the
[FlyWire Codex download page](https://codex.flywire.ai/api/download) and drop it into
that same folder before running the EDA notebook. The notebook checks that both files
are present and tells you if one is missing.

Data usage follows the FlyWire terms. Neurotransmitter polarity comes from the
predictions of Eckstein et al. (2024), which the codex distributes alongside the
connectivity.

## Running it

```bash
python3.11 -m venv env
source env/bin/activate          # Windows: env\Scripts\activate
pip install -r requirements.txt
jupyter lab
```

Run the notebooks in the order they are numbered. The EDA notebook produces the
filtered subgraph that everything downstream reads, so it comes first. Launch each
notebook from its own directory, since all paths are relative to it. Brian2 compiles
C++ at runtime, so the first simulation cell in a fresh environment takes a while.

---

## Stack

| Area | Tools |
|---|---|
| Language | Python 3.11 |
| SNN simulation | [Brian2](https://brian2.readthedocs.io/) |
| Connectome and graphs | NetworkX, python-louvain, FlyWire Codex data |
| Data and computation | NumPy, pandas, SciPy |
| Visualization | Matplotlib, Seaborn |
| Audio to spikes (phase 4) | Librosa, SciPy |
| Reproducibility | Jupyter, Git |

---

## Reading further

[docs/research-overview.md](docs/research-overview.md) covers the background, the
experimental design, the metrics and the roadmap in more depth. The two results reports
inside `02-data-preparation/` document every decision taken during data preparation,
with the sweeps and the numbers that justified each one.

## References

- Dorkenwald, S., et al. (2024). Neuronal wiring diagram of an adult brain. *Nature*, 634, 124–138.
- Eckstein, N., et al. (2024). Neurotransmitter classification from electron microscopy images at synaptic sites in *Drosophila melanogaster*. *Cell*, 187(10), 2574–2594.
- Shiu, P. K., et al. (2024). A leaky integrate-and-fire computational model based on the connectome of the entire adult *Drosophila* brain reveals insights into sensorimotor processing. *Nature*, 634, 210–219.
- Kamikouchi, A., et al. (2009). The neural basis of *Drosophila* gravity-sensing and hearing. *Nature*, 458, 165–171.
- Song, S., Miller, K. D., & Abbott, L. F. (2000). Competitive Hebbian learning through spike-timing-dependent synaptic plasticity. *Nature Neuroscience*, 3, 919–926.
- Bi, G., & Poo, M. (1998). Synaptic modifications in cultured hippocampal neurons. *Journal of Neuroscience*, 18(24), 10464–10472.
- Diehl, P. U., & Cook, M. (2015). Unsupervised learning of digit recognition using spike-timing-dependent plasticity. *Frontiers in Computational Neuroscience*, 9, 99.
- Stimberg, M., Brette, R., & Goodman, D. F. (2019). Brian 2, an intuitive and efficient neural simulator. *eLife*, 8, e47314.
- Maass, W. (1997). Networks of spiking neurons: the third generation of neural network models. *Neural Networks*, 10(9), 1659–1671.
