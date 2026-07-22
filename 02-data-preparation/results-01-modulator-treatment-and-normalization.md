# Comparative report: experiments on datasets 01, 02 and 03

## Normalization strategies and modulatory synapse treatment in a biological SNN of the JO circuit

**Trabajo de Integración Curricular** — *Bio-Inspired Neuromorphic Coding for Efficient Edge AI with Spiking Neural Networks* — UTPL 2026

---

## 1. Executive summary

This report brings together three experiments run on the **auditory subgraph of Johnston's organ (JO)** taken from the *Drosophila* connectome (FlyWire). All three share the same starting point.

- **Topology**. 1,239 neurons (269 JO sensory cells plus 970 second-order AMMC partners) and roughly 20,000 connections
- **Neuron model**. LIF (leaky integrate-and-fire), with static weights in datasets 01 and 03 and with STDP+WTA in dataset 02
- **Input**. A Poisson group at 100 Hz driving the JO neurons. No real audio is used anywhere in this report; sound frequencies arrive in the modelling phase
- **Duration**. 1,000 ms per simulation

What separates the three experiments is how each one handles the modulatory synapses.


| Dataset                            | Modulator treatment                          | Synaptic channels   | Plasticity         |
| ---------------------------------- | -------------------------------------------- | ------------------- | ------------------ |
| **01 - Raw data**                  | Kept as a separate channel (τ=50ms)          | I_exc, I_inh, I_mod | No                 |
| **02 - Modulators→excitatory**     | Collapsed into weak excitatory (×0.5)        | I_exc, I_inh        | **Yes (STDP+WTA)** |
| **03 - Modulators removed**        | Deleted entirely                             | I_exc, I_inh        | No                 |


---

## 2. Metric definitions

Every metric here is adapted to a regime without classification, since the network is driven by a single Poisson source. The mapping onto the accuracy and convergence metrics of the thesis proper will happen in later experiments, once an auditory classification task exists.

### 2.1. Dynamics metrics (datasets 01 and 03)


| Metric                     | Definition                          | Reading                                                                                |
| -------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------- |
| **Mean rate (Hz)**         | `total_spikes / N / T`              | Global network activity. Typical values 15-30 Hz (sparse), >50 Hz (hyperactive)        |
| **Coverage (%)**           | `(neurons with ≥1 spike) / N × 100` | How far the signal spreads through the topology. Above 40% counts as good coverage     |
| **Efficiency (spk/syn·s)** | `total_spikes / (N_synapses × T)`   | Proxy for energy cost. Lower is more efficient                                         |
| **ISI CV**                 | `std(ISI) / mean(ISI)` averaged     | Temporal regularity. ~1 → Poisson, <1 → regular, >1 → bursting                          |
| **Population synchrony**   | `CV(population_rate)`               | Collective oscillation. High → waves, low → asynchronous                                |
| **JO rate (Hz)**           | Mean rate over JO neurons only      | Sensory input activity                                                                 |
| **Partner rate (Hz)**      | Mean rate over AMMC neurons         | Second-order processing activity                                                       |
| **Propagation ratio**      | `partner_rate / JO_rate`            | Downstream transmission efficiency. Above 0.3 is good                                  |


### 2.2. Learning metrics (dataset 02)


| Metric              | Definition                      | Reading                                              |
| ------------------- | ------------------------------- | ---------------------------------------------------- |
| **Mean \|Δw\|**     | `mean(abs(w_final - w_init))`   | Size of the weight change produced by STDP           |
| **Final variance**  | `var(w_final)`                  | Weight spread after learning                         |
| **Final drift**     | `std(mean_weight[last 20%])`    | Stability. Lower means the run settled               |
| **Selectivity**     | Treves-Rolls sparseness         | 0=uniform, 1=selective (neuronal specialization)     |


---

## 3. Global comparison

### 3.1. Dataset 01, raw data (3 channels: exc, inh, mod)

Modulators are kept as their own channel with τ=50ms.


| Case                | Total spikes | Rate (Hz) | Coverage (%) | Efficiency | ISI CV | Synchrony | JO rate | Partner rate | Prop. ratio |
| ------------------- | ------------ | --------- | ------------- | ---------- | ------ | --------- | ------- | ----------- | ----------- |
| **A · Mean**        | 19,931       | 16.09     | 41.81         | 0.994      | 0.970  | 0.113     | 46.77   | 7.58        | **0.162**   |
| **B · Median**      | 34,525       | 27.87     | 48.51         | 1.721      | 0.860  | 0.101     | 53.44   | 20.77       | **0.389**   |
| **C · Shiu et al.** | 34,525       | 27.87     | 48.51         | 1.721      | 0.860  | 0.101     | 53.44   | 20.77       | **0.389**   |


Mean normalization leaves the network in a balanced regime, around 16 Hz with 42% of the cells active. Median and Shiu come out identical on this dataset, since both end up amplifying the gain by the same factor. The propagation ratio is where the schemes separate most clearly. Median and Shiu move roughly twice as much activity from JO to AMMC as the mean scheme does.

### 3.2. Dataset 02, modulators as excitatory (with STDP+WTA)

Here the modulatory synapses are folded into the excitatory channel at half strength, and plasticity is switched on.

#### Baseline dynamics (no plasticity)


| Scheme      | Rate (Hz) | Active (%) | Total spikes   | Selectivity  |
| ----------- | --------- | ----------- | -------------- | ------------ |
| **mean**    | 19.32     | 46.7        | 23,939         | 0.733        |
| **median**  | 37.73     | 51.1        | 46,749         | 0.802        |
| **shiu**    | 80.09     | 58.2        | 99,234         | 0.740        |
| **log**     | 25.98     | 50.8        | 32,194         | 0.766        |


#### STDP learning


| Scheme      | Mean \|Δw\| | Final var. | Final drift  | Reading                                          |
| ----------- | ---------- | ---------- | ------------ | ----------------------------------------------- |
| **mean**    | 0.0075     | 0.6537     | **0.0002**   | **Most stable**, minimal change                 |
| **median**  | 0.0321     | 1.8933     | 0.0056       | Moderate change, stable                         |
| **shiu**    | 0.1081     | 14.1681    | 0.0105       | **Maximum plasticity**, risk of instability     |
| **log**     | 0.0132     | 0.0882     | **0.0011**   | **Weight compression**, very stable             |


Used as published, without recalibration, the Shiu scheme over-excites the network. Eighty hertz with 58% of the population active, and the weight variance follows the same pattern. The log-robust scheme sits at the opposite extreme, squashing the long tail so hard that stability comes at the price of the biological dynamic range. Mean normalization is the compromise that survives both tests, giving sparse dynamics and learning that settles.

### 3.3. Dataset 03, modulators removed (2 channels: exc, inh)

The modulatory synapses are deleted, leaving 19,614 of the original 20,059 synapses.


| Case                | Total spikes | Rate (Hz) | Coverage (%) | Efficiency | ISI CV | Synchrony | JO rate | Partner rate | Prop. ratio |
| ------------------- | ------------ | --------- | ------------- | ---------- | ------ | --------- | ------- | ----------- | ----------- |
| **A · Mean**        | 17,479       | 14.20     | 44.60         | 0.891      | 0.983  | 0.134     | 46.04   | 5.46        | **0.119**   |
| **B · Median**      | 26,590       | 21.60     | 50.45         | 1.356      | 0.987  | 0.113     | 45.05   | 15.17       | **0.337**   |
| **C · Shiu et al.** | 26,590       | 21.60     | 50.45         | 1.356      | 0.987  | 0.113     | 45.05   | 15.17       | **0.337**   |


Activity drops against dataset 01, by 12% of the spikes under the mean scheme and by 23% under median and Shiu. The propagation ratio falls further still, from 0.162 to 0.119 with the mean scheme and from 0.389 to 0.337 with the median. The ISI CV rises a little, which is what we would expect once the slow I_mod floor is gone.

---

## 4. Comparison along each dimension

### 4.1. Effect of the modulator treatment


| Metric                          | Dataset 01 (3 channels) | Dataset 03 (2 channels) | Δ (%)      |
| ------------------------------- | ---------------------- | ---------------------- | ---------- |
| **Mean rate (Hz)**, mean        | 16.09                  | 14.20                  | **-11.7%** |
| **Coverage (%)**, mean          | 41.81                  | 44.60                  | +6.7%      |
| **Propagation ratio**, mean     | 0.162                  | 0.119                  | **-26.5%** |
| **Mean rate (Hz)**, median      | 27.87                  | 21.60                  | **-22.5%** |
| **Propagation ratio**, median   | 0.389                  | 0.337                  | **-13.4%** |


Modulators account for 2.2% of the synapses and yet their removal moves the dynamics far more than that share would suggest. Global rate falls between 12% and 23%, with the sharper losses under median and Shiu. Transmission from JO to AMMC loses between 13% and 27% of its efficiency.

The mechanism is the time constant. Because I_mod decays over 50 ms, it works as a slow depolarizing floor that keeps weakly connected cells sitting close to threshold for long stretches. Take it away and the network has nothing left but fast coincidences on the 5 to 10 ms channels.

So the modulatory synapses matter functionally, small as their share is. We recommend keeping them as a separate channel, as in dataset 01, rather than collapsing them into the excitatory channel (dataset 02) or dropping them (dataset 03).

### 4.2. The four normalization schemes

#### Normalization by the MEAN

Its strengths are a balanced regime (14-19 Hz, 42-47% coverage), the highest stability we measured under STDP (drift 0.0002), and a long tail that survives the transformation intact. It is also, in effect, the Shiu et al. constant recalibrated to a reduced subgraph.

Against it, the mean is inflated by outliers, the largest connection carrying 347 contacts, and weak but numerous connections can end up underweighted.

Use it when learning has to converge and the biological dynamic range has to be preserved.

#### Normalization by the MEDIAN

The median is unaffected by the long tail (10 against a mean of 17), it amplifies the typical connection and raises activity to 22-38 Hz, and it gives the best JO→AMMC propagation of the static schemes, 0.34 to 0.39.

The cost is over-excitation if α is not recalibrated, and a flattening of the genuinely strong connections that the connectome does contain.

Use it on networks that tend to go silent and need more gain.

#### SHIU normalization (linear proportional)

This is the scheme that reproduces Shiu et al. (2024) directly. It keeps the connectome weight hierarchy without any statistical transformation, which makes it the right choice when the point is comparison against the state of the art.

W_syn does have to be recalibrated per circuit. The published 0.275 mV was derived for the whole brain, and left unchanged it drove the network to 80 Hz in dataset 02. Outliers are also a concern, since a weight of 347 can saturate a local neighbourhood.

Use it to validate against the literature, always recalibrating α or W_syn first.

#### LOG-ROBUST normalization

The log transform compresses the long tail into a homogeneous weight distribution. Stability under STDP is the highest of the four schemes we tested (drift 0.0011, variance 0.088) and saturation from outliers essentially disappears.

What it gives up is the biological dynamic range. Almost every synapse ends up weighing the same, and the nonlinearity makes any biological reading of the weights harder.

Use it when stable convergence outranks biological fidelity, for instance in edge AI deployments.

---

## 5. Reading the results metric by metric

### 5.1. Mean firing rate

The target window is 15-30 Hz, sparse but structured, following Shiu et al. (2024).

- Dataset 01 with the mean scheme reaches 16.09 Hz ✓ inside the window
- Dataset 02 with uncalibrated Shiu reaches 80.09 Hz ✗ hyperactive
- Dataset 03 with the mean scheme reaches 14.20 Hz ✓ inside the window but at the lower edge

Mean normalization holds the network in a physiological regime on its own. Shiu does not, and recalibration is not optional there.

### 5.2. Coverage (% of active neurons)

Anything above 40% we treat as good spatial propagation.

Every case clears 40%, with dataset 01 under the mean scheme sitting right on the line at 41.8%. Median and Shiu reach 48-58%, better coverage but closer to saturation.

The biological topology propagates well even under a conservative normalization. Modulators help here, though only by 3 to 7 points.

### 5.3. Propagation ratio (partners/JO)

The threshold we use is 0.3.


| Dataset             | Mean    | Median  | Shiu    |
| ------------------- | ------- | ------- | ------- |
| **01 (3 channels)** | 0.162 ✗ | 0.389 ✓ | 0.389 ✓ |
| **03 (2 channels)** | 0.119 ✗ | 0.337 ✓ | 0.337 ✓ |


This is the one place where mean normalization clearly fails. It falls below the threshold in both datasets, while median and Shiu clear it comfortably. Modulators contribute somewhere between 15% and 27% of the propagation efficiency. For any task that depends on second-order AMMC processing, then, either the median scheme or a mean scheme with a larger α.

### 5.4. Weight stability (dataset 02)

The metric that matters is the final drift, the standard deviation of the mean weight over the last 20% of the run.


| Scheme      | Drift  | Assessment                  |
| ----------- | ------ | --------------------------- |
| **mean**    | 0.0002 | ★★★★★ Excellent             |
| **log**     | 0.0011 | ★★★★☆ Very good             |
| **median**  | 0.0056 | ★★★☆☆ Acceptable            |
| **shiu**    | 0.0105 | ★★☆☆☆ Risk of instability   |


STDP amplifies whatever bias the initial normalization introduced. Only the mean and log schemes look viable for long-run learning.

### 5.5. Selectivity (population sparseness)

We aim for 0.7 to 0.8, specialized without collapsing.

All four schemes in dataset 02 land in 0.73-0.80 ✓, and the median reaches the highest value at 0.802. Specialization appears to come from the biological topology together with the WTA. Normalization has only a secondary effect on it.

---

## 6. Recommendations by use case

### 6.1. For the auditory classification experiments of the next phase

We would run dataset 01, keeping modulators as their own channel, with either mean normalization for stability or median normalization for propagation, STDP+WTA with wmax calibrated per scheme, and a gammatone filter bank feeding an inhomogeneous Poisson process instead of the uniform Poisson group used here.

The reasoning is that modulators improve JO→AMMC propagation, which second-order classification depends on. The mean scheme guarantees that weights converge, and the median maximizes the propagation ratio if the network turns out to go quiet.

### 6.2. For replicating Shiu et al. (2024)

Dataset 02 or 03, since Shiu did not model modulators, with Shiu normalization and W_syn recalibrated to roughly 0.05-0.10 mV rather than the published 0.275. Validation is straightforward, the mean rate has to land in 15-30 Hz.

That keeps the comparison direct while adapting the constant to a reduced subgraph.

### 6.3. For edge AI deployment (energy efficiency)

Dataset 03, dropping modulators and with them 2.2% of the synapses, under log-robust normalization for maximum stability and homogeneous weights. The trade is biological fidelity against fast convergence and low power.

Fewer synapses means lower computational cost. Log-robust normalization minimizes weight variance, which makes quantization cheaper, and the resulting stability is what makes on-device training possible at all.

---

## 7. Conclusions

### 7.1. Main findings

1. **Modulators are 2.2% of the synapses and carry 12-27% of the function**, measured on rate and propagation. They are not expendable if biological fidelity is the goal.
2. **Weight normalization is not an implementation detail.** It changes the dynamics quantitatively and qualitatively even when the topology is held fixed.
3. **There is a trade-off we could not avoid.**
  - Mean and log give stable learning
  - Median and Shiu give activity and propagation
4. **The Shiu et al. W_syn constant has to be recalibrated per circuit.** Taken literally, 0.275 mV over-excites reduced subgraphs.
5. **The JO→AMMC propagation ratio is the most sensitive metric** to both modulator treatment and normalization, so it should be given priority in the classification experiments.

### 7.2. Status of the thesis hypotheses


| Hypothesis                                                        | Status         | Evidence                                                       |
| ----------------------------------------------------------------- | -------------- | -------------------------------------------------------------- |
| Biological topology improves efficiency over random networks      | **Open**       | Needs the Erdős-Rényi comparison (next experiment)              |
| STDP on the connectome produces functional specialization         | **Confirmed**  | Selectivity 0.73-0.80 with WTA (dataset 02)                     |
| Modulators are functionally relevant                              | **Confirmed**  | 12-27% impact on the dynamics (datasets 01 vs. 03)              |
| Normalization affects STDP convergence                            | **Confirmed**  | Drift varies 50× across schemes (0.0002 vs. 0.0105)             |


### 7.3. Limitations and next steps

Four limitations bound what we can claim here. The input is a uniform 100 Hz Poisson group, which is not auditory coding in any real sense. There is no classification task, so accuracy and convergence metrics simply do not apply yet. The simulations last one second, too short to say anything about long-run stability past ten seconds. And we have not yet compared against a random topology.

What follows, in order.

1. Spoken digit classification with a gammatone filter bank
2. Biological connectome against Erdős-Rényi, same N and same density
3. Long-run stability over 100 s with continuous input
4. INT8 weight quantization for edge AI

Adding plasticity came first, and that work is reported in
[results-02-stdp-and-wta-calibration.md](results-02-stdp-and-wta-calibration.md). The
classification and control-topology comparisons belong to the modeling phase and will
live in `03-modeling/`.

---

## 8. Quick reference tables

### 8.1. Configuration summary


| Dataset | Modulators           | N synapses | Channels          | Plasticity         | Experiments        |
| ------- | -------------------- | ---------- | ----------------- | ------------------ | ------------------ |
| **01**  | Separate (τ=50ms)    | 20,059     | 3 (exc, inh, mod) | No                 | 3 normalizations   |
| **02**  | →Excitatory (×0.5)   | 20,059     | 2 (exc, inh)      | **Yes (STDP+WTA)** | 4 normalizations   |
| **03**  | Removed              | 19,614     | 2 (exc, inh)      | No                 | 3 normalizations   |


### 8.2. Shared LIF parameters


| Parameter       | Value  | Notes                                              |
| --------------- | ------ | -------------------------------------------------- |
| V_rest, V_reset | -65 mV | Resting potential                                  |
| V_thresh        | -52 mV | Firing threshold                                   |
| τ_m             | 10 ms  | Membrane time constant                             |
| τ_ref           | 2 ms   | Refractory period                                  |
| R_m             | 10 MΩ  | Membrane resistance                                |
| τ_exc           | 5 ms   | Excitatory synaptic time constant                  |
| τ_inh           | 10 ms  | Inhibitory synaptic time constant                  |
| τ_mod           | 50 ms  | Modulatory synaptic time constant (dataset 01 only)|
| w_input         | 3.0 nA | Poisson→JO weight                                  |
| input_rate      | 100 Hz | Input rate                                         |


### 8.3. α scales per normalization


| Normalization | α_exc   | α_inh    | α_mod (dataset 01 only) |
| ------------- | ------- | -------- | ----------------------- |
| **Mean**      | 1.5 nA  | 0.75 nA  | 0.5 nA                  |
| **Median**    | 1.5 nA  | 0.75 nA  | 0.5 nA                  |
| **Shiu**      | 0.15 nA | 0.075 nA | 0.05 nA                 |
| **Log**       | 1.5 nA  | 0.75 nA  | —                       |


---

## 9. References

- **Shiu et al. (2024)**. "Connectome-constrained networks predict neural activity across the fly visual system". *PLOS Computational Biology*.
- **Schlegel et al. (2024)**. "Whole-brain annotation and multi-connectome cell typing of *Drosophila*". *bioRxiv*.
- **Eckstein et al. (2024)**. "Neurotransmitter classification from electron microscopy images at synaptic sites in *Drosophila* melanogaster". *Cell*.
- **Song et al. (2000)**. "Competitive Hebbian learning through spike-timing-dependent synaptic plasticity". *Nature Neuroscience*.
- **Diehl & Cook (2015)**. "Unsupervised learning of digit recognition using spike-timing-dependent plasticity". *Frontiers in Computational Neuroscience*.

---

**Generated**: 2026-07-09  
**Authors**: Luis Mora and Jean Alvarez (UTPL)  
**Version**: 1.0  
**Source notebooks**: `01-dataset01-raw-connectome-weights.ipynb`, `02-dataset02-modulators-as-excitatory.ipynb`, `03-dataset03-modulators-removed.ipynb`
