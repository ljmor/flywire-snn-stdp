# Phase 04 research log

Modeling: auditory encoding and the comparison of three wirings.

This log follows the phase in chronological order. It records what we tried, what we found when we looked again and how we fixed it. The current results are in [`results.md`](results.md), and the code is in the four notebooks of this folder and in its scripts.

A few terms first. A **spiking neural network** (SNN) is a network whose neurons communicate with brief electrical events, **spikes**. Our neurons are **leaky integrate-and-fire** (LIF) neurons with three synaptic channels. Each adds up its input, leaks it slowly and fires when its voltage crosses a threshold. The wiring is the auditory circuit of Johnston's organ (JO), the fly's ear, taken from the FlyWire **connectome** in phase 02 (Dorkenwald et al., 2024). The networks learn with **spike-timing-dependent plasticity** (STDP), which strengthens a connection when the sending neuron fires just before the receiving one, and they are kept in check by **winner-take-all** (WTA) inhibition. We compare the connectome with two random **control topologies**, an Erdős–Rényi graph and a configuration model that keeps the number of connections of each neuron. Each wiring runs with and without plasticity, and each of these combinations is an experimental **arm**. A **seed** fixes the random generators so that a run can be repeated. A **linear readout** (a logistic regression) names the stimulus from the spike counts of the network. Its accuracy is compared with the **chance level** and with the **input-only ceiling**, the accuracy of the same readout on the input layer alone.

---

## Starting point (August 2026)

The phase began with four notebooks and a report. One notebook turned sounds into spike trains, one ran the random control with plasticity, one the connectome with fixed weights and one the connectome with plasticity.

The task was to tell apart six pure tones, grouped into six levels of difficulty. The measure was the Pearson correlation between the firing-rate profiles that two classes evoked, read as "low correlation means the network tells them apart".

---

## The measure did not measure what we wanted

Our evaluation calls for classification accuracy, convergence speed, spike efficiency, selectivity and synaptic stability. What we had was a correlation, and it had three problems. It was not what the evaluation asks for, it had no reference value that could be interpreted, and a handful of very active neurons dominated it.

We replaced it with a standard train, freeze and read-out protocol.

1. The network is trained with STDP on training stimuli.
2. Its weights are **frozen**.
3. Its responses to the training stimuli are recorded with the frozen weights.
4. Its responses to test stimuli it has **never seen** are recorded.
5. A linear readout is trained on (3) and evaluated on (4).

The readout is trained in every arm, the static ones included, so that the comparison measures how well the network separates the stimuli and not whether a decoder is present. The readout population leaves out the input neurons.

The new measure has a meaning: the proportion of correct answers on unseen stimuli, against a known chance level. It also gives the efficiency metrics that matter for edge AI, machine learning that runs inside small devices instead of in the cloud.

---

## Re-running every step (late August 2026)

At the end of August we re-ran every step of the encoding and of the experiment from the stored data instead of relying on the saved reports. Six problems came to light.

### The filterbank was broken

`scipy.signal.gammatone(ftype='fir')` returns **661 coefficients (15 ms) for every channel**, whatever its center frequency. The gammatone response at 80 Hz lasts much longer than that, so the filter was cut short. When we measured it, the bandwidth at −3 dB was **78.4 to 86.5 Hz in every channel**. The theoretical ERB, the bandwidth an auditory filter should have, goes from 33.3 to 65.7 Hz. At 80 Hz the filter was 2.5 times wider than it should be. The text of the notebook also claimed to use the recursive (IIR) filters of Slaney (1993), which is not what the code did.

We implemented the **analytic impulse response** of the gammatone filter (Patterson et al., 1992), with a length matched to each center frequency. Each response lasts eight time constants, which is 37.5 ms at 80 Hz and 19.0 ms at 380 Hz. We discarded `ftype='iir'`. At these frequencies its poles sit so close to the unit circle that the filter **diverges numerically**, and its output reaches between $10^{85}$ and $10^{92}$ for an input bounded by 1. The [audio-encoding notebook](01-audio-encoding.ipynb) shows both failures.

The bandwidth now matches the theoretical ERB within 1 Hz, and the excitation patterns of different frequencies are clearly separated instead of all looking alike.

### The normalization left a shortcut

The rate map of each stimulus was normalized by its **peak**. Since the ratio between mean and peak depends on the center frequency, the total number of spikes ended up different between classes. On the easiest level one class produced clearly more spikes than the other, enough for a classifier to succeed by **counting spikes** without using the frequency content at all.

The normalization now fixes the **mean rate** of the map. Every stimulus has the same expected number of spikes, and the shortcut, which would have inflated the accuracy of every arm alike and made the comparison blind to topology, is gone.

### An artifact that treated each frequency differently

The envelope was extracted with a 2 ms rectangular moving average, which does not smooth carriers of a few hundred hertz. When we tried longer windows something worse appeared. A moving average of *T* ms has **exact zeros at the multiples of 1/T**, so some tones came out perfectly smooth and others kept their ripple. That is a difference **between frequencies** that has nothing to do with the stimulus classes and that a classifier could exploit. The current notebook shows the same effect with the 2 ms window. The ripple that survives is 0.169 at 150 Hz and only 0.001 at 250 Hz, the carrier of the song.

The envelope is now the **Hilbert envelope**, the magnitude of the analytic signal, which uses no window (Smith et al., 2002). Its ripple is 0.000 at every frequency tested.

### The compression flattened the excitation pattern

After rectification the signal was compressed with an exponent of 1/3. That squeezes five orders of magnitude of energy into fewer than two, and after normalization the floor dominates the profile. In the current notebook the mean similarity between the patterns of different tones is 0.705 with the cube root and 0.301 with the replacement.

The replacement is the **rate-level function of an auditory fiber** (Sachs & Abbas, 1974). It is a sigmoid on the level in decibels, with a threshold and saturation, and it is referred to a fixed level of the model rather than to the peak of each stimulus. A real fiber has a threshold and fires only spontaneously below it, and the pattern of excitation recovers its peaked shape instead of a plateau. The fixed reference also avoids an automatic gain control per stimulus.

### The seeds encoded the class

The spike trains were generated with one seed for class A and the next seed for class B, at every level. Two classes never shared a realization of the random process, so even two identical stimuli would have produced different responses, and that difference added to any real one. Besides, the saved files held fewer distinct trains than files, and each model saw each stimulus exactly once, with no variability at all.

The seed now depends on the **repetition**, never on the class. Each stimulus is presented 20 times for training and 20 for testing, with disjoint seeds. Without this there is neither a test set nor any statistics.

### A comparison that changed two things at once

Every comparison so far set the **static connectome** against an **Erdős–Rényi network with STDP and WTA**. The two arms differed in topology and in plasticity at the same time. They also differed in 50 extra inhibitory neurons and in the weight ceiling. No difference could be pinned on the wiring. The notebook of the connectome with plasticity had, moreover, **never been run**. Its cells had no outputs and its results folder was empty, while the report listed those outputs and called that condition the central hypothesis.

We moved to a **full factorial design**. Each of the three topologies ran with and without plasticity and with five seeds, thirty runs in all, every one executed and every contrast paired by seed. It is the only way to answer the research question. With the earlier design, a difference could come from topology, from plasticity or from their interaction, and there was no way to tell.

---

## The task had a ceiling (28 August 2026)

With the measure fixed, a bigger problem showed up.

We trained the same linear readout **directly on the spike counts of the 123 input neurons**, with no network in between. It reached an accuracy of **1.000 at 100 ms**, the window in which the networks were compared.

The task was solved before the signal entered the circuit. The three topologies could only **degrade** that information, so the experiment measured which one destroyed least, not which one computed best. With that ceiling the research hypothesis could not be tested, and that alone explained why the control that scrambles the wiring most came out best.

It is the most important methodological finding of the phase, and it was hidden. Without this measurement, the results would have been read as a property of the topologies when they were a property of the task.

---

## Changing the task: from pure tones to the courtship song (30 August 2026)

We replaced the task with the discrimination of the **inter-pulse interval** of the courtship song, the time between the clicks that a male produces with his wing. It is one of the main cues a female uses to recognize her species (Bennet-Clark & Ewing, 1969). Our network covers only the first stage of the song pathway. In the fly the selectivity for the interval appears further downstream (Baker et al., 2022; Zhou et al., 2015), so the interval is a proxy task imposed on this circuit.

It had the property we needed. Two songs with the same carrier have the same spectrum (cosine 0.99996), so **the interval is not in the rate code of the input**. The input-only ceiling dropped to 0.226 with the five seeds of the time, and it is 0.223 over the sixty runs of the final design.

A design decision came with the change. **The readout counts spikes in a window, with no temporal resolution.** A readout with temporal resolution would read the interval straight from the input and bring the ceiling back. By counting, the network has to turn temporal structure into differences in firing rate.

This change turned a negative result that could not be interpreted into a positive and significant one. With tones, plasticity made the connectome slightly worse. With songs, on the same five seeds, it improved it by **+0.314** (p = 0.0047), and the connectome with plasticity beat the random network with plasticity by +0.452 (p = 0.0006). The central finding appeared at once. **Plasticity pays off on the biological topology** (+0.314), and much less on the controls (+0.120, not significant, on the degree-preserving control, and −0.016 on the random network). With fifteen seeds the current values are +0.309, +0.164 and −0.001, as [`results.md`](results.md) reports. Their direction is the same.

The ceiling check became a **permanent metric**. Every run now reports `input_accuracy` next to the accuracy of the network.

---

## The axis of difficulty

On the tone task, with 500 ms stimuli, every condition came close to perfect accuracy. Adding Gaussian noise did not help, because the filterbank averages it out, and accuracy stayed at the top even with strong noise.

The axis of difficulty became the **integration window**, the length of the response that the readout counts, from 25 to 500 ms. All the windows come from the same simulation, and only the stretch that is counted changes. This axis has no ceiling, and on the interval task it can be read mechanically, since a short window holds only a few song pulses. It is also the variable that matters for low-power devices, where a shorter window means fewer spikes, less energy and less latency.

---

## A channel mapping anchored to anatomy

The 32 channels of the filterbank were assigned to the input neurons in order of their FlyWire identifier (`root_id`), a statistical proxy with no anatomical basis. Once phase 02 recovered the JO-A and JO-B subtypes, the mapping was anchored to anatomy, with JO-B on the low channels and JO-A on the high ones. Four mappings now run as comparable conditions. Besides the anchored one there is its inverse, the earlier proxy and a random assignment.

The control rules out a lucky assignment. With all four mappings the connectome with plasticity stays between 0.880 and 0.920. It also showed something we had not expected to see so clearly. In the interval task tonotopic anchoring **does not help**, which makes sense because the five songs share the carrier and there is no frequency axis to exploit. We kept the anchored mapping anyway, because it is the **conservative** choice: the connectome reaches its advantage from the least favorable of the four mappings.

---

## Validating the contact threshold (31 August 2026)

The subgraph keeps only connections with at least 5 synaptic contacts, a threshold that removes a third of the JO neurons. We rebuilt the subgraph at thresholds of 1, 3, 5 and 10 contacts. At each one we recalibrated the operating point and ran the whole task (details in [`results.md`](results.md) and in the [phase 02 research log](../02-data-understanding/research-log.md)).

Without a threshold, performance drops. At threshold 3 the advantage of the connectome looks larger mainly because the random control gets worse. The advantage holds at every threshold that can be calibrated (+0.680, +0.397 and +0.370 at 3, 5 and 10 contacts). We kept 5, a value fixed before any result and the one used by Dorkenwald et al. (2024).

---

## Comparison with conventional networks (1 September 2026)

The motivation of the project appeals to the energy efficiency of spiking networks. We checked whether that advantage shows up on this task.

The first comparison was against a fixed reference perceptron, and it made the spiking network look cheaper. A fixed model is an arbitrary yardstick, so we built the **energy-accuracy frontier** of both families instead, the cheapest model of each kind at every level of accuracy. The result reversed the picture. A **linear** classifier on 10 time windows reaches an accuracy of 0.960 with 6,150 multiply-accumulate operations, 0.0095 µJ. The spiking network needs 184,859 synaptic events to reach 0.880. **The gap is 461×, and no tuning closes it.** To break even, a synaptic event would have to cost 0.034 times a multiply-accumulate operation, and published costs point the other way.

The cause is neither the topology nor plasticity but the **scale of the problem**. A subgraph of 1,239 neurons is oversized for a five-class task that a linear model solves with 6,150 operations.

The one advantage we found is silence, and it rests on an assumption. If silence produces no input spikes, the spiking network fires nothing and costs nothing, while a conventional network runs a full inference in every window. In an always-on setting the spiking network is cheaper below a duty cycle of 13.06 % in its sparsest regime, and below 0.22 % in its most accurate one.

**What this means for the project.** The claim of energy efficiency over conventional networks **cannot be made**. It lies outside the declared scope, which compares the spiking networks with one another, and there the connectome needs 4.0 times fewer spikes per correct answer than the random network.

---

## Control of the plasticity rule

When the weight ceiling `wmax` was corrected in phase 03, so that no connection is clipped before learning, the ceiling rose from four times the mean excitatory weight to about 16 times. That leaves more room for potentiation, which could be a problem in itself. We ran a control with four variants of the rule on the connectome, two ceilings times two learning rates, with three seeds each.

On the tone task none of the variants made plasticity useful. On the song task the standard configuration already gave a large gain, so the problem had been the task, not the rule. The stored output of the control still came from the tone task, and it was only re-run on the song task in October 2026 (see the section on re-running the pipeline, below).

---

## Two tasks that were easy to confuse (28 September 2026)

The phase measures accuracy in two ways, and the figures did not say so. Five-class accuracy has its chance level at 0.200. The difficulty gradient compares the songs **two at a time**, so its chance level is 0.500. In the figure of the static connectome the two panels sat side by side with both axes labeled just "Accuracy" and with two chance lines at different heights. The natural reading, that the hardest pair (0.750) does better than the five-class task (0.566), was the wrong reading.

The notebook of the static connectome now explains both tasks before showing any number, with their chance levels and how to read one against the other. Each accuracy is read against its own chance line, 0.566 against 0.200 and 0.750 against 0.500, and the two are not compared. The figures now label their axes as five-class or two-class accuracy and write the value of each chance line next to it. Under each bar of the gradient they name the two songs being compared. The report says plainly that chance rises from 0.200 to 0.500. No measured value or conclusion changed. It was a labeling problem.

---

## Tables updated to fifteen seeds (28 September 2026)

The three arms with plasticity went from five to fifteen seeds on 1 September, with `extra_seeds.py`, because five seeds could not resolve the contrast with the configuration model. Some tables of the report still held five-seed means, although the notebooks had already been re-run. We regenerated them from the stored results and noted under each table how many seeds each arm has. The most visible change was in the pair that separates the two species, where the connectome with plasticity had been described as perfect and scores 0.998 with fifteen seeds. The conclusion stands, and the adverb became "almost".

No conclusion changed. The connectome with plasticity is still first on all five pairs of the gradient and, from 50 ms on, along the whole latency curve. At 25 ms it is still slightly below two static arms, as before. With so short a window every arm sits between 0.328 and 0.444, and the order between them says little.

---

## Final consistency pass (29 September 2026)

We re-ran the four notebooks in full and checked every cell, both reports and every output file against each other. None of the inconsistencies we found was in a measured value. They included leftovers of the tone task (a notebook still announced six tones above a cell that prints a chance level of 0.200), five-seed figures that had survived the extension to fifteen seeds, and a table of thresholds that mixed two different runs, which we split. They also included two p-values copied wrongly, standard deviations computed with a different convention from the rest of the report, an error in one row of the energy frontier, "synapses" written where the text meant connections, and a description of the difficulty gradient that suggested an order by milliseconds instead of by relative difference.

---

## Re-running the pipeline for this repository (October 2026)

When we prepared this repository we re-ran the whole pipeline in a fresh environment and checked every number against its output. The stored results came out identical, with one expected exception. The control of the plasticity rule ran on the song task for the first time. The configuration we use turned out to be the best of the four variants (0.863 ± 0.045 over three seeds), and every slower or more constrained variant does worse.

The check also corrected a few readings.

- One notebook compared the anchored and random channel mappings after sorting each list of accuracies by value instead of pairing them by seed. Paired by seed, the difference (−0.170) gives p = 0.0327, the same value as the notebook of the connectome with plasticity.
- The duty cycle below which the sparsest spiking network becomes cheaper is 13.06 %, and the break-even cost of a synaptic event, once the additions of the linear classifier are counted, is 0.034 times a multiply-accumulate operation.
- In the two Erdős–Rényi arms the hardest pair of the gradient comes out slightly better than the next one. The order by relative difference holds in four of the six arms, not in all six.
- The band of the `scipy` FIR filter is 78.4 to 86.5 Hz, as the notebook measures it.
- With the shortest integration window (25 ms) every arm is well above chance, between 0.328 and 0.444. An earlier description said almost none of them was.

---

## Where the phase stands

```
04-modeling/
  01-audio-encoding.ipynb        auditory encoding, with its checks
  02-control-networks.ipynb      Erdős–Rényi and configuration-model controls
  03-connectome-static.ipynb     connectome with fixed weights
  04-connectome-stdp.ipynb       connectome with plasticity and the factorial comparison
  run_experiments.py             factorial design and comparison of mappings
  extra_seeds.py                 ten more seeds for the three plastic arms
  control_stdp.py                variants of the plasticity rule
  threshold_sweep.py             robustness to the contact threshold
  plot_threshold_validation.py   figure of the threshold validation
  energy_frontier.py             energy-accuracy frontier of the SNN
  baseline_ann.py                energy-accuracy frontier of conventional networks
  results.md                     findings of the phase
  research-log.md                this document
  outputs/                       every result, in JSON
```

---

## Open questions

- **The operating point is matched before learning**, not after.
- **The readout is linear.** A non-linear decoder could extract structure that logistic regression misses, and not necessarily to the same degree in every topology.
- **Five intervals, one carrier.** The result should be checked with other carriers and with recorded natural songs.
- **No synaptic delays.** In a temporal task, delays proportional to anatomical distance would give the spatial structure of the connectome an extra dynamic consequence.

---

## References

- Baker, C. A., McKellar, C., Pang, R., Nern, A., Dorkenwald, S., Pacheco, D. A., Eckstein, N., Funke, J., Dickson, B. J., & Murthy, M. (2022). Neural network organization for courtship-song feature detection in *Drosophila*. *Current Biology, 32*(15), 3317–3333.e7. https://doi.org/10.1016/j.cub.2022.06.019
- Bennet-Clark, H. C., & Ewing, A. W. (1969). Pulse interval as a critical parameter in the courtship song of *Drosophila melanogaster*. *Animal Behaviour, 17*(4), 755–759. https://doi.org/10.1016/S0003-3472(69)80023-0
- Dorkenwald, S., Matsliah, A., Sterling, A. R., Schlegel, P., Yu, S.-c., McKellar, C. E., Lin, A., Costa, M., Eichler, K., Yin, Y., Silversmith, W., Schneider-Mizell, C., Jordan, C. S., Brittain, D., Halageri, A., Kuehner, K., Ogedengbe, O., Morey, R., Gager, J., . . . The FlyWire Consortium. (2024). Neuronal wiring diagram of an adult brain. *Nature, 634*(8032), 124–138. https://doi.org/10.1038/s41586-024-07558-y
- Patterson, R. D., Robinson, K., Holdsworth, J., McKeown, D., Zhang, C., & Allerhand, M. (1992). Complex sounds and auditory images. In Y. Cazals, L. Demany, & K. Horner (Eds.), *Auditory physiology and perception* (pp. 429–446). Pergamon. https://doi.org/10.1016/B978-0-08-041847-6.50054-X
- Sachs, M. B., & Abbas, P. J. (1974). Rate versus level functions for auditory-nerve fibers in cats: Tone-burst stimuli. *The Journal of the Acoustical Society of America, 56*(6), 1835–1847. https://doi.org/10.1121/1.1903521
- Slaney, M. (1993). *An efficient implementation of the Patterson–Holdsworth auditory filter bank* (Apple Computer Technical Report No. 35). Apple Computer. https://engineering.purdue.edu/~malcolm/apple/tr35/PattersonsEar.pdf
- Smith, Z. M., Delgutte, B., & Oxenham, A. J. (2002). Chimaeric sounds reveal dichotomies in auditory perception. *Nature, 416*(6876), 87–90. https://doi.org/10.1038/416087a
- Zhou, C., Franconville, R., Vaughan, A. G., Robinett, C. C., Jayaraman, V., & Baker, B. S. (2015). Central neural circuitry mediating courtship song perception in male *Drosophila*. *eLife, 4*, Article e08477. https://doi.org/10.7554/eLife.08477
