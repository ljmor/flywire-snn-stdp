# Phase 03 results: calibrating the spiking network

Notebook: [`01-calibration.ipynb`](01-calibration.ipynb) · Script: [`calibrate.py`](calibrate.py) · Outputs: [`outputs/operating_point.json`](outputs/operating_point.json), [`outputs/wta_sweep.csv`](outputs/wta_sweep.csv)

---

## 1. Context and goal

Phase 02 extracted the auditory circuit of Johnston's organ (JO), the ear of the fruit fly, from the FlyWire connectome (Dorkenwald et al., 2024; Schlegel et al., 2024). A **connectome** is a map of all the neurons of a brain and of the connections between them. Here a **connection** is a directed pair of neurons. Its weight is the number of **synaptic contacts** between them, the physical sites where one neuron passes a signal to the other. The subgraph has 1,239 neurons, 20,059 connections and 338,013 synaptic contacts. Only 123 of its JO neurons send connections onward, and they form the input layer that receives the sound.

This phase turns that graph into a **spiking neural network** (SNN) that we can simulate, and it fixes the conditions under which the real wiring and its random controls are compared. In an SNN the neurons communicate with brief electrical events called **spikes**. The number of spikes a neuron fires per second is its **firing rate**, in hertz (Hz). We organize the project by the phases of CRISP-DM (Chapman et al., 2000), and this is its data-preparation phase. In the KDD process it corresponds to preprocessing and transformation (Fayyad et al., 1996).

A few more terms recur below. The network learns with **spike-timing-dependent plasticity** (STDP), a local rule. It strengthens a connection when the sending neuron fires just before the receiving one and weakens it when it fires just after. **Winner-take-all** (WTA) inhibition is a pool of inhibitory neurons that holds the network back when many neurons fire at once. The project compares three **topologies** (wirings). The **connectome** is the real one. An **Erdős–Rényi** graph keeps only the number of connections of each sign (Erdős & Rényi, 1959). A **configuration model** also keeps how many connections enter and leave each neuron (Molloy & Reed, 1995). Each topology runs without plasticity (static) and with STDP + WTA. Each of these six combinations is an experimental **arm**. A **seed** fixes the random generator, so that a run can be repeated exactly.

The phase makes five decisions, one per section from Section 3 to Section 7, and each comes from a sweep with several seeds. We simulate with Brian2 (Stimberg et al., 2019).

---

## 2. The neuron model

Each neuron is a **leaky integrate-and-fire** (LIF) neuron. It adds up the current it receives, leaks it away slowly, and fires a spike when its voltage crosses a threshold. Ours has **three separate synaptic channels**, one per polarity of the connections (excitatory, inhibitory and modulatory). Each channel has its own time constant.

$$\tau_m \frac{dv}{dt} = -(v - V_{rest}) + R_m (I_{exc} + I_{inh} + I_{mod})$$

Here $v$ is the membrane voltage, $\tau_m$ the membrane time constant, $R_m$ the membrane resistance and $I_{exc}$, $I_{inh}$, $I_{mod}$ the currents of the three channels. After a spike the voltage drops to $V_{reset}$ and the neuron stays silent for the refractory period $\tau_{ref}$.

| Parameter | Value | Where it comes from |
|---|---|---|
| $V_{rest}$, $V_{reset}$ | −65 mV | published code of Diehl and Cook (2015) |
| $V_{thresh}$ | −52 mV | published code of Diehl and Cook (2015) |
| $\tau_m$ | 10 ms | typical range for LIF models (Gerstner et al., 2014) |
| $\tau_{ref}$ | 2 ms | typical range for LIF models |
| $R_m$ | 10 MΩ | typical value (Dayan & Abbott, 2001) |
| $\tau_{exc}$ / $\tau_{inh}$ / $\tau_{mod}$ | 5 / 10 / 50 ms | modeling choice inspired by mammalian synaptic currents |
| $\alpha_{exc}$, $\alpha_{inh}$, $\alpha_{mod}$ | 1.5, 0.75, 1.0 nA | **calibrated in this work** |
| $w_{input}$ | calibrated per arm | **this work**, see Section 6 |

None of these values was measured in *Drosophila* JO neurons or in their targets. The 5 ms of the excitatory channel is close to the decay of AMPA-receptor currents and the 10 ms of the inhibitory one lies in the GABA-A range. The 50 ms modulatory channel is deliberately slower, but real neuromodulation is slower still, so it is a simplified stand-in rather than a model of neuromodulation (Gerstner et al., 2014). The current amplitudes come from no publication. We tuned them here and say so, instead of attributing them to sources that use other values.

---

## 3. Modulatory connections

Serotonin, dopamine and octopamine act as **neuromodulators**. Rather than giving the target neuron a fast push or pull, they change, slowly, how strongly it responds. Phase 02 assigned one neurotransmitter per neuron, as in the neuron-level predictions of Eckstein et al. (2024), and with that assignment only 110 connections are modulatory, 0.5 % of the total.

We compared keeping them in their own slow channel with switching them off. The comparison is a **same-network comparison**. All 1,239 neurons stay in both conditions and only the gain of the modulatory channel changes. Deleting the connections instead would leave some neurons with no connection at all and change the size of the network. We then swept the gain `alpha_mod` from 0 to 4 on the static connectome, with five seeds and the default input gain of 3.0 nA. Besides the rate, we measured the **coverage**, the percentage of neurons that fire at least once during a song. We also measured the **selectivity**, the normalized Treves–Rolls sparseness of the response. It goes from 0 when all neurons respond equally to 1 when a single neuron responds (Vinje & Gallant, 2000).

| Gain `alpha_mod` | Rate (Hz) | Coverage (%) | Selectivity |
|---|---|---|---|
| 0.0 (no modulators) | 2.288 ± 0.050 | 18.618 | 0.888 |
| 0.5 | 2.299 ± 0.050 | 18.818 | 0.887 |
| **1.0** | **2.322 ± 0.044** | **18.960** | **0.889** |
| 2.0 | 2.477 ± 0.065 | 19.004 | 0.905 |
| 4.0 | **21.176 ± 0.389** | 16.772 | 0.934 |

Mean ± standard deviation over five seeds. Figure: [`03-modulator-gain-sweep.png`](../docs/figures/03-modulator-gain-sweep.png).

There are two regimes. Between gain 0 and 2 the dynamics hardly change. The mean rate moves by **0.189 Hz**, 8.1 % of the mean, and coverage and selectivity stay where they were. Past that point the slow channel starts to drive the network. At gain 4 the rate **rises 8.5-fold** (2.48 → 21.18 Hz) while **coverage falls** (19.0 → 16.8 %) and selectivity rises (0.905 → 0.934). Many more spikes go to fewer neurons, a sign that a subpopulation runs away.

The spread across seeds is not what reveals this. At gain 4 it is 0.389 Hz, a coefficient of variation of 1.8 %, the smallest in the table, so the five realizations agree that the network runs away. The jump in rate together with the drop in coverage is what marks the unstable regime.

**We keep `alpha_mod = 1.0`**, inside the flat zone, so neuromodulation stays in its own channel instead of being deleted. With 0.5 % modulatory connections the choice is not critical, as long as the gain stays out of the unstable regime.

---

## 4. Weight normalization

The raw weight of a connection is its number of contacts. The median is 10 and the maximum 347. **Weight normalization** puts the weights on a common scale, so that the current amplitudes of the model apply to a weight of about 1, and the scheme decides how much of the long tail survives. We compared three schemes. Two divide every weight by a reference value, the mean or the median, and the third compresses the scale with `log(1+w) / mean(log(1+w))`.

| Scheme | Mean | Median | Maximum | 99th percentile |
|---|---|---|---|---|
| mean | 1.000 | 0.593 | 20.59 | 6.231 |
| median | 1.685 | 1.000 | 34.70 | 10.500 |
| logarithmic | 1.000 | 0.933 | 2.28 | 1.815 |

To compare how stable learning is under each scheme, we ran the connectome with STDP + WTA for five seeds. The **mean weight change** |Δw| is the average absolute change of the excitatory weights over the run. The **drift** is the spread of the mean weight over the last fifth of the run; a small drift means learning has settled.

| Scheme | Rate (Hz) | \|Δw\| | Drift |
|---|---|---|---|
| **mean** | **2.5680 ± 0.1230** | **0.1746** | **0.0070** |
| median | 3.2041 ± 0.1631 | 0.2615 | 0.0120 |
| logarithmic | 2.3420 ± 0.1199 | 0.1042 | 0.0036 |

Figure: [`03-weight-normalization.png`](../docs/figures/03-weight-normalization.png).

**We normalize by the mean.** This scheme keeps the dynamic range of the long tail, which is real information in the connectome, and its drift stays low. The logarithmic scheme is even more stable, but it flattens the weight hierarchy. The ratio between the strongest connection and the median falls from 34.7× with the mean scheme to 2.4× with the logarithmic one. That is a fourteenfold compression of the contrast between strong and weak connections, a property of the connectome that the model should keep.

We left out a fourth scheme built on the constant weight per synapse of Shiu et al. (2024). In this subgraph the median weight is exactly 10, so dividing by the median and rescaling the amplitudes by 10 give the same model. Reporting the two as schemes that agree would present an algebraic identity as a finding.

---

## 5. Lateral inhibition

STDP makes the connections onto one neuron compete (Song et al., 2000), but by itself it does not make different neurons learn different inputs. **Winner-take-all** inhibition adds that competition between neurons (Diehl & Cook, 2015; Masquelier et al., 2009). A pool of 50 inhibitory **interneurons** receives excitation from the whole network and sends inhibition back to a random fraction of it (`wta_p = 0.25`). This is the **sparse** variant; the dense one, where every interneuron reaches the whole network, silenced the network. In mammalian cortex inhibitory interneurons act mostly locally (Isaacson & Scanziani, 2011), and our sparse layer is a computational simplification inspired by that, not a model of the fly's inhibitory circuitry.

The strength of the inhibition, `wta_inh`, is **shared by every plastic arm**. We therefore swept it on the **three topologies**, with five seeds per point and the default input gain of 3.0 nA.

| `wta_inh` (nA) | Connectome: rate | drift | Configuration: rate | drift | Erdős–Rényi: rate | drift |
|---|---|---|---|---|---|---|
| 0.10 | 4.10 ± 0.40 | 0.01114 | 14.66 ± 3.94 | 0.02582 | **76.60 ± 2.56** | **0.04803** |
| 0.20 | 3.36 ± 0.25 | 0.00626 | 11.05 ± 3.19 | 0.01315 | 34.19 ± 6.81 | 0.03701 |
| 0.30 | 3.03 ± 0.12 | 0.00693 | 8.62 ± 1.35 | 0.02909 | 26.13 ± 3.57 | 0.02075 |
| **0.60** | **2.57 ± 0.12** | **0.00696** | **4.43 ± 0.71** | **0.01528** | **13.07 ± 1.70** | **0.01652** |
| 1.00 | 2.31 ± 0.11 | 0.00681 | 3.40 ± 0.25 | 0.01087 | 7.69 ± 1.91 | 0.00892 |

Rates in Hz. Values from `outputs/wta_sweep.csv`, written by the sweep cell of the notebook. Figure: [`03-wta-inhibition-calibration.png`](../docs/figures/03-wta-inhibition-calibration.png).

**We set `wta_inh = 0.6 nA`**, the value that keeps runaway activity in check on the three topologies at once. It is not the minimum-drift value of any single topology, which would be 0.2 for the connectome and 1.0 for the other two. It is a compromise between stability and activity. Below it the controls fire far above the connectome and their weights drift more. At 1.0 nA the drift is slightly lower still in all three topologies, but the connectome falls to 2.31 Hz and its weights move less (|Δw| of 0.1549 against 0.1746).

The first row shows why the sweep had to include the controls. With the low value used before (0.1 nA), the Erdős–Rényi network fires at 76.60 Hz, 18.7 times the rate of the connectome. Its weight drift is 4.3 times larger (0.04803 against 0.01114). A comparison run at that point would have measured which network loses stability first, not the effect of the wiring.

At 0.6 nA the configuration model sits **between the two extremes in rate, drift and |Δw|**, as expected from a topology that keeps the degrees of the connectome but not its fine wiring. At 0.6 nA its rate is 4.43 Hz (between 2.57 and 13.07), its drift 0.01528 (between 0.00696 and 0.01652) and its |Δw| 0.2922 (between 0.1746 and 0.3056). One caveat is worth recording. Its relative spread across seeds is the largest of the three, 15.9 % against 13.0 % for Erdős–Rényi and 4.8 % for the connectome. This fits with it being the arm with the largest variance in accuracy in phase 04 (0.768 ± 0.148 with fifteen seeds). It is worth keeping in mind when that contrast is read.

---

## 6. A matched operating point

This is the decision that makes the comparison of phase 04 meaningful. Fed with the same input gain, the three topologies fire at very different rates. A network that simply fires more would hand more spikes to the classifier that reads it out and would look better without being better. So we fix an **operating point**, the same mean firing rate of 10 Hz in every arm, measured from the untrained weights before the experiment, and tune the input gain `w_input` of each arm until it reaches it. In the arms with plasticity, plasticity is already active during that short calibration run. We chose 10 Hz because it is a sparse but active regime that gives STDP enough pairs of spikes, and all six arms can reach it.

The tuning is a **bisection**. The rate grows steadily with the input gain, so we start from the interval 0.1 to 40 nA, simulate the midpoint, keep the half that still contains the target and repeat. The search stops when the rate is within 5 % of the target, or after 18 steps, and each evaluation averages five seeds. `calibrate.py` runs it for the six arms and stores the result in `outputs/operating_point.json`.

| Arm | `w_input` (nA) | Rate reached (Hz) |
|---|---|---|
| Connectome, static | 10.075 | 10.41 ± 0.46 |
| Connectome, STDP + WTA | 17.556 | 10.06 ± 0.22 |
| Erdős–Rényi, static | **5.088** | 9.83 ± 1.58 |
| Erdős–Rényi, STDP + WTA | 15.062 | 10.16 ± 0.69 |
| Configuration model, static | 6.334 | 10.14 ± 0.91 |
| Configuration model, STDP + WTA | 15.062 | 10.16 ± 0.69 |

Mean ± standard deviation over five seeds; the bisection converged in all six arms. Figure: [`03-operating-point-calibration.png`](../docs/figures/03-operating-point-calibration.png).

Two readings of this table are informative. First, **the connectome needs about twice the input gain of the random network** to reach the same rate (10.075 against 5.088 nA in the static arms). Its wiring dissipates much more of the excitation. All three wirings have the same number of inhibitory connections (an E/I ratio of 0.7443, from phase 02), so the difference has to come from where the connections are placed. The modular organization of the connectome, which keeps activity confined, is a plausible cause. That factor of two is exactly the confound that would have contaminated a comparison without matching. Second, **the random network is less stable across seeds** in the static condition (± 1.58 Hz against ± 0.46 Hz for the connectome), so its behavior depends more on the particular draw of its wiring. The plastic arms need more gain than the static ones, because they run with the WTA layer switched on and with plasticity changing their weights during the calibration run.

The calibration uses the courtship-song stimulus of phase 04, five synthetic songs whose inter-pulse intervals (the time between consecutive song pulses) go from 25 to 65 ms. The operating point depends on the stimulus, so calibrating it with a different one would be inconsistent.

---

## 7. Weight ceiling under plasticity

The ceiling `wmax` caps how far a weight can grow during learning; STDP clips any weight that would exceed it, as in Song et al. (2000). We set it to the **largest initial excitatory weight** (15.607 in normalized units). The earlier criterion, four times the mean (3.863), clipped **230 of the 8,512 excitatory connections (2.70 %), which carried 16.7 % of the excitatory weight mass**, before the network had learned anything. That truncation got mixed up with the effect of plasticity.

With the new criterion no connection is clipped at the start. The parameter `wmax_factor` can reproduce the earlier criterion, and phase 04 runs it as a control, because a higher ceiling has a cost of its own.

---

## 8. Final configuration

```
Data             data/processed/  (1,239 neurons, 20,059 connections, 123 input neurons)
Neuron           three-channel LIF, τ = 5 / 10 / 50 ms, dt = 0.1 ms
Normalization    by the mean
alpha_mod        1.0
WTA              sparse, wta_n = 50, wta_p = 0.25, wta_inh = 0.6 nA
STDP             additive, pair-based: Aplus = 0.05, Aminus = 0.0525, τ = 20 ms
                 wmax = largest initial excitatory weight
w_input          calibrated per arm (table in Section 6)
Operating point  10 Hz mean rate, matched in the six arms before learning
```

The STDP rule follows the form of Song et al. (2000). Potentiation and depression share a time constant of 20 ms, and the depression step is 1.05 times the potentiation step, so depression slightly outweighs potentiation, which they showed is needed for stable, competitive learning. Our potentiation step (0.05, in units of the mean weight) is our own choice for the short training used here. Song et al. express theirs as a fraction of the maximum weight, so the two values are not on the same scale.

The calibrated input gains and the inhibition strength are stored in `outputs/operating_point.json`, which phase 04 reads directly. The other values are the defaults of `snnlib/network.py` and `snnlib/graph.py`. No modeling notebook writes a parameter by hand.

---

## 9. Conclusions

1. **With 0.5 % modulatory connections, their treatment is no longer a critical decision**, as long as the gain stays out of the unstable regime.
2. **Normalizing by the mean is the best compromise** between keeping the biological dynamic range and keeping learning stable.
3. **A shared parameter has to be calibrated on every arm that uses it.** The inhibition strength that worked for the connectome left the random network in runaway activity.
4. **The three topologies need very different input gains to run at the same rate.** That alone rules out any comparison that does not match the operating point first.
5. **No calibration number rests on a single seed.** At least one decision of an earlier version did not survive a change of seed.

---

## Limitations

### The operating point is matched before training, not after

Plasticity raises the rate, and not by the same amount in every arm. The plastic arms end at 17.74 Hz (connectome), 21.54 Hz (configuration model) and 33.94 Hz (Erdős–Rényi). The static ones run between 10.32 and 12.74 Hz. The matching therefore comes undone in the three arms that matter most.

We do not correct this by matching the final rate, and the reason is not computing time. The correction would be worse than the problem, for two reasons. It would trade one confound for another, because making the six arms end at the same rate would require giving them different starting points, an initial difference in excitability, which is exactly what this step exists to avoid. And how far plasticity raises the rate is a result in itself. The Erdős–Rényi network climbs to 33.94 Hz and gains no accuracy, while the connectome stays at 17.74 Hz and gains +0.309. Forcing both to the same final rate would erase the finding behind the reading of spike efficiency.

Phase 04 compensates by reporting the **spikes per correct classification** next to the accuracy. The connectome with STDP spends 6,278 spikes per correct answer, and Erdős–Rényi with STDP 25,175. The advantage of the connectome does not come from firing more. Any comparison of accuracy across plasticity conditions should be read together with that column.

### The 10 Hz target is a reasoned choice, not a measured value

No firing rates have been published for these neurons, and several of the neurons that receive input from the ear respond to sound with graded potentials rather than spikes (Tootoonian et al., 2012). Even if a rate were available, our model is not a biophysical replica. It uses three-channel LIF neurons with amplitudes calibrated here, not measured conductances, so matching it to an experimental number would suggest a precision it does not have.

The target is **the same for the six arms**, so it does not hand any of them an advantage in excitability. A different target could still change how each topology performs, and we have not tested that. What is compared is structure at equal excitability.

What would close this question is a sweep of the target itself. The work swept the contact threshold, the channel mapping and the seeds, but not the target rate. Repeating the factorial design at, say, 5 and 20 Hz is the missing control.

### The parameter sweeps ran far from the operating point

The sweeps of the modulatory gain, of the normalization and of the inhibition ran with the default input gain of 3.0 nA, where the connectome fires far below the operating point used later. We did not repeat them at the calibrated gains, so their conclusions are checked only in that low-activity regime.

### A limitation that is now closed

The inhibition strength was first swept only on the connectome and the Erdős–Rényi network. The configuration model inherited the value without a check of its own. The sweep now covers all three topologies (Section 5) and confirms the inherited value. The configuration model sits between the other two in rate, drift and |Δw|.

---

## References

- Chapman, P., Clinton, J., Kerber, R., Khabaza, T., Reinartz, T., Shearer, C., & Wirth, R. (2000). *CRISP-DM 1.0: Step-by-step data mining guide*. SPSS Inc. https://web.archive.org/web/20060207174803/http://www.crisp-dm.org/CRISPWP-0800.pdf
- Dayan, P., & Abbott, L. F. (2001). *Theoretical neuroscience: Computational and mathematical modeling of neural systems*. MIT Press. https://mitpress.mit.edu/9780262041997/theoretical-neuroscience/
- Diehl, P. U., & Cook, M. (2015). Unsupervised learning of digit recognition using spike-timing-dependent plasticity. *Frontiers in Computational Neuroscience, 9*, Article 99. https://doi.org/10.3389/fncom.2015.00099
- Dorkenwald, S., Matsliah, A., Sterling, A. R., Schlegel, P., Yu, S.-c., McKellar, C. E., Lin, A., Costa, M., Eichler, K., Yin, Y., Silversmith, W., Schneider-Mizell, C., Jordan, C. S., Brittain, D., Halageri, A., Kuehner, K., Ogedengbe, O., Morey, R., Gager, J., . . . The FlyWire Consortium. (2024). Neuronal wiring diagram of an adult brain. *Nature, 634*(8032), 124–138. https://doi.org/10.1038/s41586-024-07558-y
- Eckstein, N., Bates, A. S., Champion, A., Du, M., Yin, Y., Schlegel, P., Lu, A. K.-Y., Rymer, T., Finley-May, S., Paterson, T., Parekh, R., Dorkenwald, S., Matsliah, A., Yu, S.-C., McKellar, C., Sterling, A., Eichler, K., Costa, M., Seung, S., . . . Funke, J. (2024). Neurotransmitter classification from electron microscopy images at synaptic sites in *Drosophila melanogaster*. *Cell, 187*(10), 2574–2594.e23. https://doi.org/10.1016/j.cell.2024.03.016
- Erdős, P., & Rényi, A. (1959). On random graphs I. *Publicationes Mathematicae Debrecen, 6*(3–4), 290–297. https://doi.org/10.5486/PMD.1959.6.3-4.12
- Fayyad, U., Piatetsky-Shapiro, G., & Smyth, P. (1996). From data mining to knowledge discovery in databases. *AI Magazine, 17*(3), 37–54. https://doi.org/10.1609/aimag.v17i3.1230
- Gerstner, W., Kistler, W. M., Naud, R., & Paninski, L. (2014). *Neuronal dynamics: From single neurons to networks and models of cognition*. Cambridge University Press. https://doi.org/10.1017/CBO9781107447615
- Isaacson, J. S., & Scanziani, M. (2011). How inhibition shapes cortical activity. *Neuron, 72*(2), 231–243. https://doi.org/10.1016/j.neuron.2011.09.027
- Masquelier, T., Guyonneau, R., & Thorpe, S. J. (2009). Competitive STDP-based spike pattern learning. *Neural Computation, 21*(5), 1259–1276. https://doi.org/10.1162/neco.2008.06-08-804
- Molloy, M., & Reed, B. (1995). A critical point for random graphs with a given degree sequence. *Random Structures & Algorithms, 6*(2–3), 161–180. https://doi.org/10.1002/rsa.3240060204
- Schlegel, P., Yin, Y., Bates, A. S., Dorkenwald, S., Eichler, K., Brooks, P., Han, D. S., Gkantia, M., dos Santos, M., Munnelly, E. J., Badalamente, G., Serratosa Capdevila, L., Sane, V. A., Fragniere, A. M. C., Kiassat, L., Pleijzier, M. W., Stürner, T., Tamimi, I. F. M., Dunne, C. R., . . . Jefferis, G. S. X. E. (2024). Whole-brain annotation and multi-connectome cell typing of *Drosophila*. *Nature, 634*(8032), 139–152. https://doi.org/10.1038/s41586-024-07686-5
- Shiu, P. K., Sterne, G. R., Spiller, N., Franconville, R., Sandoval, A., Zhou, J., Simha, N., Kang, C. H., Yu, S., Kim, J. S., Dorkenwald, S., Matsliah, A., Schlegel, P., Yu, S.-c., McKellar, C. E., Sterling, A., Costa, M., Eichler, K., Bates, A. S., . . . Scott, K. (2024). A *Drosophila* computational brain model reveals sensorimotor processing. *Nature, 634*(8032), 210–219. https://doi.org/10.1038/s41586-024-07763-9
- Song, S., Miller, K. D., & Abbott, L. F. (2000). Competitive Hebbian learning through spike-timing-dependent synaptic plasticity. *Nature Neuroscience, 3*(9), 919–926. https://doi.org/10.1038/78829
- Stimberg, M., Brette, R., & Goodman, D. F. M. (2019). Brian 2, an intuitive and efficient neural simulator. *eLife, 8*, Article e47314. https://doi.org/10.7554/eLife.47314
- Tootoonian, S., Coen, P., Kawai, R., & Murthy, M. (2012). Neural representations of courtship song in the *Drosophila* brain. *The Journal of Neuroscience, 32*(3), 787–798. https://doi.org/10.1523/JNEUROSCI.5104-11.2012
- Vinje, W. E., & Gallant, J. L. (2000). Sparse coding and decorrelation in primary visual cortex during natural vision. *Science, 287*(5456), 1273–1276. https://doi.org/10.1126/science.287.5456.1273
