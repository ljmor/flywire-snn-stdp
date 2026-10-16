# Phase 03 research log

From the biological subgraph to a spiking network we can simulate and compare.

This log follows the phase in chronological order. It records what we tried, what we found when we looked again and how we fixed it. The current results are in [`results.md`](results.md), and the code and its outputs are in the [calibration notebook](01-calibration.ipynb) and in [`calibrate.py`](calibrate.py).

A few terms first. A **spiking neural network** (SNN) is a network whose neurons communicate with brief electrical events, **spikes**; the number of spikes per second is the **firing rate**. Our neurons are **leaky integrate-and-fire** (LIF) neurons, which add up their input, leak it slowly and fire when their voltage crosses a threshold. The wiring is the auditory subgraph of Johnston's organ (JO), the fly's ear, taken from the FlyWire connectome in phase 02 (Dorkenwald et al., 2024). The network learns with **spike-timing-dependent plasticity** (STDP), which strengthens a connection when the sending neuron fires just before the receiving one, and it is kept in check by **winner-take-all** (WTA) inhibition. We compare the connectome with two random **control topologies**, an Erdős–Rényi graph and a configuration model, each with and without plasticity. Each of these six combinations is an experimental **arm**, and a **seed** is the number that fixes a random generator so that a run can be repeated.

---

## Starting point (July 2026)

The phase began as five exploratory notebooks, each testing one way of turning the subgraph into a network that can be simulated. One kept the modulatory connections in their own channel, one turned them into excitatory connections and one deleted them. A fourth tested plasticity under several weight normalizations, and the last one calibrated the lateral inhibition. Two reports summarized them.

Their conclusions fixed the configuration that the modeling phase then used. The modulatory connections kept their own slow channel with a gain of 1.0, and the weights were normalized by the mean. The winner-take-all layer was sparse, with `wta_p = 0.25` and `wta_inh = 0.1 nA`. A configuration counted as good when it met four targets together. The firing rate had to fall between 15 and 30 Hz. The other three were a minimum coverage, a minimum "propagation ratio" (the activity of the second-order neurons relative to the input layer) and a window of selectivity. Before all this, a preliminary experiment with single-channel neurons had checked that the connectome could be moved into Brian2 at all.

---

## Re-running every step (27 August 2026)

At the end of August we re-ran every step from the stored data instead of relying on the saved reports. Part of the work held up well. Every table in the two reports matched the notebook outputs number by number. The Brian2 implementation was also correct, from the units and the direction of the connections to the sign of the STDP update, the event-driven traces and the isolation between simulations. The problems were in the experimental design, and two of them invalidated the configuration that phase 04 was using.

### The chosen configuration did not replicate

The learning configuration had been chosen because it was the only one that met the four targets at once. That measurement came from a single seed, with a rate of 15.87 Hz. When we repeated it with four other seeds, the rate fell to between 11.2 and 14.2 Hz, below the minimum that the calibration itself required. The configuration had described one lucky realization.

Since then every sweep in this phase runs with five seeds and reports the mean and the standard deviation. Having the spread in view showed something else too. The random network varies much more from seed to seed than the connectome, and that is a result in itself.

### A target that made the task worse

One target asked the second-order neurons to reach a minimum fraction of the activity of the input layer. Meeting it had required raising the gain of the modulatory channel. The threshold had been set with uniform random input and no classification task, a limitation the report itself acknowledged. With real stimuli it could only be met by pushing the modulatory gain until the slow channel acted as a depolarizing floor. The whole network then fired alike and the response stopped depending on the stimulus.

We dropped that target. A calibration criterion that degrades the task it is meant to serve is not a criterion worth keeping.

### Arms that fired at different rates

Each topology used to run with the same input gain and fire at whatever rate came out. Phase 04 was thus comparing networks that ran anywhere between 2 and 77 Hz. A network that simply fires more hands more spikes to the classifier and looks like a better one.

We added a calibration step. For each of the six arms a bisection tunes the input gain `w_input` until the network reaches a common mean rate of 10 Hz, averaged over five seeds. The result is saved in `outputs/operating_point.json`, which phase 04 reads directly. The calibration was informative in its own right. The connectome needs about twice the input gain of the random network to reach the same rate, because its wiring dissipates more of the excitation. All three wirings have the same number of inhibitory connections, so the difference lies in where the connections are placed. That factor of two is the confound that would have contaminated every comparison without matching.

### Comparisons that changed two things at once

The comparison of how to treat the modulatory connections changed two things at once. Deleting them also removed eight neurons, four of them JO neurons, so that variant ran on a smaller network with fewer inputs than the report stated. Another variant used a single synaptic channel with one time constant for excitation and inhibition, while the report described two channels.

We repeated the comparison on the same network. The "no modulators" condition now keeps every neuron and sets the gain of the modulatory channel to zero, with the same time constants everywhere. The conclusion changed. The earlier claim that the modulatory connections changed the dynamics by 12 to 27 % did not survive. After the per-neuron neurotransmitter assignment of phase 02 they are only 0.5 % of the connections, and moving their gain between 0 and 2 barely affects the network. Most of the earlier modulatory labels had been classifier noise.

### A normalization scheme that was an identity

Four normalization schemes were compared. The report pointed out that two of them gave bit-identical results, the median scheme and one based on the constant weight per synapse of Shiu et al. (2024). That was not a finding. The median weight of this subgraph is exactly 10. The second scheme divided by a constant and rescaled the amplitudes by 10, so the two were the same model written two ways. We kept only the three genuinely different schemes and explained why.

### The weight ceiling clipped the strongest connections

Every plastic run capped the weights at four times the mean weight. Because the connectome's weights have a long tail, that ceiling clipped 230 excitatory connections (2.70 %), which carried 16.7 % of the excitatory weight mass, before any learning took place.

We raised the ceiling to the largest initial excitatory weight, so no connection is clipped at the start, and kept a parameter, `wmax_factor`, that reproduces the earlier criterion for comparison. The comparison between the static and the plastic connectome no longer mixes learning with a truncation of the structure.

### The inhibition had been tuned on the connectome alone

The inhibition strength `wta_inh` had been set to 0.1 nA by looking at the biological network only. We swept it on the connectome and on the random network, with five seeds, and chose the value that keeps both stable, 0.6 nA. At 0.1 nA the random network ran away to 76.60 Hz, 18.7 times the rate of the connectome, and its weight drift was 4.3 times larger. A comparison made there would have measured which network loses stability first, not the effect of the wiring.

### Where each parameter comes from

The protocol document said that the LIF parameters were the standard ones of the literature and cited Shiu et al. (2024) and Diehl and Cook (2015). We checked each value against those papers. The resting, reset and threshold potentials do follow the published code of Diehl and Cook. The membrane time constant and the refractory period are not those of the excitatory neurons in either paper. In the code of Diehl and Cook the same two values appear only for the inhibitory neurons. The current amplitudes came from an undocumented sweep with a helper script. The notebook now says where each value comes from. The potentials follow Diehl and Cook, and the membrane parameters lie in the ranges commonly used for LIF models (Gerstner et al., 2014). The amplitudes are presented as our own calibration, with the sweep in view.

### Retiring the preliminary experiment

The preliminary experiment had concluded that STDP lowers the firing rate. The effect came from two other changes made at the same time. One was a dense winner-take-all layer, which this phase later discarded because it silenced the network. The other was an initial clipping of weights that reduced the total excitation before learning began. We removed the experiment. The shared simulation code in `snnlib/network.py`, which the notebooks of phases 03 and 04 use, now covers what it was meant to check.

---

## From five notebooks to one

The five exploratory notebooks were merged into a single calibration notebook. It answers the same questions in order, now with the corrections applied, from the treatment of the modulatory connections on the same network to the weight ceiling. The script `calibrate.py` runs the matching of the operating point and stores the result, so that no notebook of phase 04 carries a parameter written by hand.

---

## Recalibrating with the courtship song (30 August 2026)

Phase 04 changed its task at the end of August. Instead of telling apart pure tones, the network now had to tell apart the interval between the pulses of the courtship song, so we recalibrated the operating point with the new stimulus. The operating point depends on the input, so calibrating it with a different stimulus from the one used later would be inconsistent.

---

## Extending the inhibition sweep to three topologies (September 2026)

The inhibition sweep had covered the connectome and the Erdős–Rényi network, the only two arms at the time. When the configuration model became a full arm of the design (see the [data-understanding log](../02-data-understanding/research-log.md)), it inherited the value of 0.6 nA without a check of its own. We listed that as an open limitation.

The new sweep runs the three topologies in a single pass, and `outputs/wta_sweep.csv` grew from 10 to 15 rows. The ten earlier rows came out exactly the same, which also confirmed that the simulations are deterministic once the seeds are fixed. The configuration model falls between the other two on every measure. At 0.6 nA its rate is 4.43 Hz, between 2.57 for the connectome and 13.07 for Erdős–Rényi. Its drift and its weight change also fall in between. The shared value therefore holds it in range, as had been argued.

The sweep also brought a new detail. At 0.6 nA the configuration model has the largest relative spread across seeds of the three topologies (15.9 %, against 13.0 % for Erdős–Rényi and 4.8 % for the connectome). That fits with it being the arm with the largest variance in accuracy in phase 04, and it is a plausible reason why that contrast needed fifteen seeds to be resolved. The value of the inhibition did not change, so no result of phases 04 and 05 was affected.

---

## Final consistency pass (29 September 2026)

A final consistency pass re-ran the notebook and checked the text against the stored outputs. The inhibition sweep came out digit for digit the same in its fifteen rows. None of the changes touched a measured number.

The parameter table of the neuron model prints the **default** values of the simulation code, where `wta_inh` is 0.1 and `w_input` is 3.0, two of the values that the notebook recalibrates. A reader looking only at that table would take away the wrong values, so a note above it now says which ones are recalibrated, where, and to what.

The text had said that the logarithmic normalization makes all weights nearly equal. What we measure is a compression. The ratio between the strongest connection and the median falls from 34.7× with the mean scheme to 2.4× with the logarithmic one, about fourteen times less contrast but not equal weights, and the argument for discarding it holds just as well stated with the exact number.

The summary table still said the inhibition was swept on two topologies, and two sections shared the same number. Both were fixed. The text on open questions also gave the rates of the plastic arms after learning from the five-seed runs; with fifteen seeds they are 17.74 to 33.94 Hz.

---

## Where the phase stands

```
03-data-preparation/
  01-calibration.ipynb        the five decisions, with sweeps over several seeds
  calibrate.py                matching of the operating point, runnable on its own
  results.md                  findings of the phase
  research-log.md             this document
  outputs/
    operating_point.json      calibrated input gains of the six arms
    wta_sweep.csv             sweep of the lateral inhibition
```

The configuration fixed in this phase is a three-channel LIF neuron (time constants of 5, 10 and 50 ms), weights normalized by the mean, the modulatory channel at gain 1.0, a sparse winner-take-all layer with `wta_inh = 0.6 nA`, STDP capped at the largest initial weight, and an input gain calibrated per arm so that all six arms run at 10 Hz before learning.

---

## Open questions

- **The operating point is matched before learning, not after.** Plasticity moves it, and the plastic arms end between 17.74 and 33.94 Hz. Phase 04 compensates by reading the accuracy together with the spikes per correct classification and with the energy frontier, and a calibration that fixed the rate after learning would bring its own confound, one that the results judge worse than the problem (see the limitations in [`results.md`](results.md)).
- **The 10 Hz target is a reasoned choice**, not a value taken from recordings of these neurons. No such rates have been published, and repeating the factorial design at other targets is the control that is still missing.

---

## References

- Diehl, P. U., & Cook, M. (2015). Unsupervised learning of digit recognition using spike-timing-dependent plasticity. *Frontiers in Computational Neuroscience, 9*, Article 99. https://doi.org/10.3389/fncom.2015.00099
- Dorkenwald, S., Matsliah, A., Sterling, A. R., Schlegel, P., Yu, S.-c., McKellar, C. E., Lin, A., Costa, M., Eichler, K., Yin, Y., Silversmith, W., Schneider-Mizell, C., Jordan, C. S., Brittain, D., Halageri, A., Kuehner, K., Ogedengbe, O., Morey, R., Gager, J., . . . The FlyWire Consortium. (2024). Neuronal wiring diagram of an adult brain. *Nature, 634*(8032), 124–138. https://doi.org/10.1038/s41586-024-07558-y
- Gerstner, W., Kistler, W. M., Naud, R., & Paninski, L. (2014). *Neuronal dynamics: From single neurons to networks and models of cognition*. Cambridge University Press. https://doi.org/10.1017/CBO9781107447615
- Shiu, P. K., Sterne, G. R., Spiller, N., Franconville, R., Sandoval, A., Zhou, J., Simha, N., Kang, C. H., Yu, S., Kim, J. S., Dorkenwald, S., Matsliah, A., Schlegel, P., Yu, S.-c., McKellar, C. E., Sterling, A., Costa, M., Eichler, K., Bates, A. S., . . . Scott, K. (2024). A *Drosophila* computational brain model reveals sensorimotor processing. *Nature, 634*(8032), 210–219. https://doi.org/10.1038/s41586-024-07763-9
