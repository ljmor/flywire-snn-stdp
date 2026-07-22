# Comparative report 2: STDP+WTA learning and calibration on the JO connectome network

## Choosing the base configurations for the auditory classification phase

**Trabajo de Integración Curricular** — *Bio-Inspired Neuromorphic Coding for Efficient Edge AI with Spiking Neural Networks* — UTPL 2026

---

## 1. Executive summary

This second report picks up where [results-01-modulator-treatment-and-normalization.md](results-01-modulator-treatment-and-normalization.md) left off, after datasets 01, 02 and 03. That first report compared modulator treatments and weight normalizations on a network with static weights. Here we switch on **STDP + WTA** over the same biological topology and calibrate the free parameters until the network learns stably, propagates the signal and specializes, all without leaving the physiological regime.

Two new experiments are covered.

| Notebook | What it does |
|---|---|
| `04-dataset01-stdp-learning.ipynb` | Adds STDP+WTA to the 3-channel network, compares 4 normalizations, sweeps `alpha_mod` |
| `05-dataset01-wta-calibration.ipynb` | Calibrates the strength (`wta_inh`) and density (`wta_p`) of the WTA, dense against sparse |

Both experiments, like those of the first report, drive the network with a **Poisson input group at 100 Hz** on the JO neurons. Real sound frequencies are not used anywhere here.

**Final result.** Two configurations come out selected, one without STDP and one with STDP+WTA, and they will serve as the base for the models built on real sound frequencies in the next phase.

---

## 2. Why dataset 01?

The three datasets of the previous report each handle the **modulatory synapses** (SER/DA/OCT, around 2% of the total) differently.

| Dataset | Modulators | Result |
|---|---|---|
| 01 — Raw data | **own channel** `I_mod` (τ=50 ms) | keeps their slow role, highest biological fidelity |
| 02 — →Excitatory | collapsed into excitatory ×0.5 | loses the slow dynamics |
| 03 — Removed | deleted | −12 to −27 % in rate and propagation |

That report showed that the modulators are functionally relevant, worth 12 to 27 % of the dynamics, and that keeping them as a separate channel is the treatment closest to the connectome. Since the thesis is asking whether *real* biological topology buys anything, we work on **dataset 01**, the only one that respects all three synapse types recorded in FlyWire (excitatory τ=5 ms, inhibitory τ=10 ms, modulatory τ=50 ms).

---

## 3. What `alpha_mod` is

`alpha_mod` is the gain of the modulatory channel, the factor multiplying each modulatory synaptic weight before its current is injected into `I_mod`. Put plainly, how much strength we give the modulators.

- The modulatory channel decays slowly (τ = 50 ms), so it behaves as a slow depolarizing floor, holding neurons near threshold across long windows.
- Raising `alpha_mod` raises that floor. Weakly connected downstream AMMC partners then cross threshold without needing exact temporal coincidence, and the JO→AMMC propagation ratio goes up.
- Push it too far and the network over-excites, with the rate leaving the 15-30 Hz window.

Biologically this stands for neuromodulation by serotonin, dopamine and octopamine. Modulators do not fire neurons on their own. They set the gain and internal state of the network, arousal and motivation, over hundreds of milliseconds.

---

## 4. Experiment A, `04-dataset01-stdp-learning`: normalization and the `alpha_mod` sweep

### 4.1. The four normalizations under STDP+WTA

We asked which weight normalization learns most stably. Baseline dynamics without plasticity, then stability under STDP.

| scheme | rate Hz | prop ratio | selectivity | final var | drift | reading |
|---|---|---|---|---|---|---|
| **mean** | 16.09 | 0.162 | 0.769 | **0.68** | **0.0002** | balanced and **the most stable** |
| median | 27.87 | 0.389 | 0.818 | 1.95 | 0.0002 | more gain, stable |
| shiu | 27.87 | 0.389 | 0.818 | **192.4** | 0.0001 | variance **blows up** → unstable |
| log | 23.12 | 0.342 | 0.777 | 0.073 | 0.0006 | minimal variance, loses biological range |

*Source: `outputs/04-dataset01-stdp/table01_normalization_schemes.csv`, figures `fig01_baseline_dynamics_four_schemes.png`, `fig02_baseline_vs_stdp.png` and `fig03_weight_stability.png`.*

The mean scheme gives the most stable learning while keeping the biological dynamic range, the same tendency we saw in dataset 02. Uncalibrated `shiu` sends the variance through the roof. The one weak point of the mean scheme is its low propagation ratio, 0.162.

### 4.2. Sweeping `alpha_mod` (mean scheme only) to repair propagation

| alpha_mod | rate Hz | prop ratio | drift | verdict |
|---|---|---|---|---|
| 0.5 (dataset 01 value) | 16.09 | 0.162 ✗ | 0.0002 | ratio below the 0.3 threshold |
| **1.0** | **23.58** | **0.343** ✓ | 0.0001 | **the right point**, ratio >0.3, rate in range, stable |
| 1.5 | 31.89 | 0.496 ✓ | 0.0001 | high ratio but the rate has already left the window (>30 Hz) |

*Source: `outputs/04-dataset01-stdp/table02_alpha_mod_sweep.csv`, figure `fig04_alpha_mod_sweep.png`.*

Raising `alpha_mod` from 0.5 to 1.0 repairs the propagation ratio, 0.162 to 0.343, without pulling the rate out of the physiological regime. We fix **`alpha_mod = 1.0`**.

### 4.3. An unexpected finding, dense WTA was shutting the network down

With STDP and a **dense WTA** (`wta_inh = 0.5`) enabled, the rate collapsed from roughly 16-24 Hz to about 4.5 Hz across all four schemes, and the propagation ratio fell with it. The competition was simply too strong. That is what prompted experiment B.

---

## 5. Experiment B, `05-dataset01-wta-calibration`: calibrating lateral competition

The fixed configuration is the winner from A, mean normalization with `alpha_mod = 1.0`. Two WTA parameters were calibrated, its strength `wta_inh` and its density `wta_p`.

### 5.1. Sweeping `wta_inh` (dense WTA)

| wta_inh | rate Hz | prop ratio | selectivity | drift | reading |
|---|---|---|---|---|---|
| 0.0 | 26.73 | 0.371 | 0.772 | 0.0088 | active but **unstable** (STDP with no brake) |
| 0.01 | 17.32 | 0.289 | 0.830 | 0.0054 | ratio below threshold |
| **0.02** | **14.41** | **0.344** | **0.803** | 0.0028 | **best dense point**, ratio >0.3, stable |
| 0.03 | 12.76 | 0.312 | 0.833 | 0.0005 | very stable, rate already low |
| 0.05 | 9.98 | 0.297 | 0.817 | 0.0002 | fading out |
| 0.5 | 4.38 | 0.061 | 0.887* | 0.0001 | switched off (selectivity is *trivially sparse*) |

*Source: `outputs/05-dataset01-wta/table01_wta_calibration.csv`, figures `fig01_metrics_vs_wta_inhibition.png`, `fig02_activity_selectivity_tradeoff.png`, `fig03_weight_stability.png` and `fig04_raster_comparison.png`.*

`wta_inh ≈ 0.02` is the best the dense variant offers, and even there the rate sits just under 15 Hz. The activity against specialization trade-off is too abrupt, because the inhibition is global and every inhibitory cell brakes the whole network at once.

*(\*) High selectivity at large `wta_inh` is misleading. The population looks selective only because almost nobody is firing, not because anything specialized.*

### 5.2. Sparse WTA (local inhibition) opens the window

Making the inhibition local, so that each inhibitory cell brakes only a fraction `wta_p` of the network, softens the trade-off considerably.

| config | n_lat | rate Hz | prop ratio | coverage | selectivity | drift |
|---|---|---|---|---|---|---|
| dense 0.02 (best dense) | 61 950 | 14.41 | 0.344 | 43.1 | 0.803 | 0.0028 |
| **sparse `p=0.25, wi=0.1`** | **15 429** | **15.87** | **0.645** | 40.2 | **0.869** | **0.0018** |
| sparse `p=0.1, wi=0.1` | 6 133 | 20.38 | 0.444 | 43.9 | 0.815 | 0.0088 |

*Source: `outputs/05-dataset01-wta/table02_fine_sweep_and_sparse.csv`, figures `fig05_fine_sweep.png` and `fig06_dense_vs_sparse_wta.png`.*

The sparse configuration at `p=0.25, wta_inh=0.1` satisfies all four conditions at once, rate inside the window, propagation ratio more than twice the threshold, high selectivity and stable drift. It does so with four times fewer lateral synapses than the dense variant, which makes it cheaper as well. Local inhibition provides enough competition to specialize the population without the blanket suppression that was shutting the network down.

---

## 6. Key concepts

### 6.1. WTA (winner-take-all)

A lateral competition mechanism. A small population of inhibitory neurons receives excitation from the whole network and returns inhibition, so in practice the neuron that fires first or hardest silences the rest.

Why bother? Without a WTA, STDP pushes every neuron towards reinforcing the same connections and responding to the same pattern, which gives a redundant and useless representation. The WTA breaks that tie and different neurons come to specialize on different patterns. It is the ingredient that turns plasticity into usable unsupervised learning (Diehl & Cook, 2015). Selectivity is how we measure its effect.

### 6.2. `wta_inh` and `wta_p`

- **`wta_inh`** is the *strength* of lateral inhibition in nA per synapse. It is the hardness knob on the competition. High values give fierce competition, few winners and a network that goes quiet. Low values give soft competition, more activity and less specialization. Zero means no competition at all.
- **`wta_p`** is the *density*, the connection probability of the lateral inhibition. At `wta_p = 1.0` each inhibitory cell brakes every neuron, which is the global case. At `wta_p = 0.25` it brakes only a randomly chosen quarter of the network, which is the local case.

### 6.3. Dense against sparse WTA

| | **Dense** (`wta_p = 1`) | **Sparse** (`wta_p < 1`) |
|---|---|---|
| Lateral connectivity | global, all ↔ all | local, each to a fraction |
| Lateral synapse count | many (61 950) | few (6 000–15 000) |
| Effect | blanket suppression → **shuts down** the network | **local** competition → specializes without shutting down |
| Trade-off | abrupt (collapses between 0.0 and 0.05) | smooth (wide window) |
| Cost (edge AI) | high | low |

The sparse variant is also the more biologically plausible one, since real cortical inhibition is mostly local, and it is computationally cheaper. It was what closed the problem.

---

## 7. Metric glossary (quick reference)

| Metric | What it measures, plainly | Threshold / reading |
|---|---|---|
| **Mean rate (Hz)** | spikes per neuron per second | 15–30 = sparse and healthy; <15 quiet; >50 saturated |
| **Coverage (%)** | share of neurons that take part (≥1 spike) | >40 = good spatial propagation |
| **Propagation ratio** | activity reaching the 2nd layer (AMMC) from the input (JO) | >0.3 = the signal flows downstream |
| **Selectivity** | neuronal specialization (sparseness) | 0.7–0.8 = specialized without collapsing |
| **Efficiency (spk/syn·s)** | energy cost (proxy) | lower = more efficient |
| **ISI CV** | firing regularity | ~1 = Poisson-like (natural); <1 regular; >1 bursting |
| **Mean \|Δw\|** | how far the weights moved under STDP | neither ~0 (no learning) nor huge (unstable) |
| **Final variance** | weight spread after learning | very high = risk of instability |
| **Final drift** | are the weights still moving at the end? (std over the last 20 %) | lower = converged stably |

---

## 8. The two selected configurations

On dataset 01 (3 channels) with mean normalization and `alpha_mod = 1.0`, two configurations are now fixed.

### BASE configuration (no plasticity)
> **Dataset 01 · mean · `alpha_mod = 1.0` · no STDP · no WTA**

| rate Hz | coverage | prop ratio | selectivity | ISI CV |
|---|---|---|---|---|
| 23.58 | 45.9 % | 0.343 | 0.807 | 0.98 |

This is the dynamic ceiling of the biological network without learning. Sparse regime, good propagation, physiological activity.

### LEARNING configuration
> **Dataset 01 · mean · `alpha_mod = 1.0` · STDP · sparse WTA `wta_p = 0.25`, `wta_inh = 0.1`**

| rate Hz | coverage | prop ratio | selectivity | drift | n_lat |
|---|---|---|---|---|---|
| 15.87 | 40.2 % | 0.645 | 0.869 | 0.0018 | 15 429 |

It meets all four target conditions at once and it is efficient. This is the network that learns stably and specializes.

---

## 9. How these configurations will be used

The two of them form the methodological base for the classification phase, the one that will use **real sound frequencies** rather than the Poisson input group used throughout this report. They will be applied to three networks and compared against each other.

| Network | Topology | Configuration |
|---|---|---|
| **Erdős–Rényi (control)** | random (same N, same density) | BASE + LEARNING |
| **Connectome (biological)** | real JO subgraph | BASE + LEARNING |
| **Connectome + STDP** | real JO subgraph that learns | LEARNING |

The BASE configuration fixes a common dynamic operating point and the LEARNING configuration fixes how the networks learn, with STDP and the calibrated sparse WTA. Any difference in auditory classification performance can then be attributed to the topology, biological against random, rather than to a parameter mismatch. Which is exactly the research question of the thesis.

---

## 10. Final fixed parameters

| Parameter | Value | Origin |
|---|---|---|
| Dataset | 01 (3 channels exc/inh/mod) | biological fidelity (§2) |
| Normalization | mean | learning stability (§4.1) |
| `alpha_exc`, `alpha_inh` | 1.5 nA, 0.75 nA | dataset 01 |
| **`alpha_mod`** | **1.0 nA** | sweep §4.2 (repairs propagation) |
| STDP | Aplus=0.05, Aminus=0.0525, τ=20 ms, wmax=4·w̄ | Song 2000 / Diehl-Cook 2015 |
| **`wta_p`** | **0.25** (sparse) | calibration §5.2 |
| **`wta_inh`** | **0.1 nA** | calibration §5.2 |
| `wta_exc` | 1.0 nA | — |
| Input | Poisson 100 Hz on JO | initial regime, replaced by real audio in the modelling phase |
| T_sim | 1000 ms | — |

---

**Generated**: 2026-07-20
**Authors**: Luis Mora and Jean Alvarez (UTPL)
**Version**: 2.0
**Source notebooks**: `04-dataset01-stdp-learning.ipynb`, `05-dataset01-wta-calibration.ipynb`
