# Phase 05 research log

Evaluation: the final comparison of the three wirings.

This log follows the phase in chronological order. It records how the evaluation took shape, what we found when we checked it again and what we changed. The current results are in [`results.md`](results.md), and the code is in the notebook [`01-comparative-evaluation.ipynb`](01-comparative-evaluation.ipynb).

A few terms first. The project compares **spiking neural networks** (SNNs), networks whose neurons communicate with brief electrical events called **spikes**. One is wired like the auditory circuit of Johnston's organ (JO), the fly's ear, taken from the FlyWire **connectome** (Dorkenwald et al., 2024). The other two are random controls of the same size. An **Erdős–Rényi** graph keeps only the number of connections, and a **configuration model** also keeps how many connections enter and leave each neuron. Each wiring runs with fixed weights (static) and with **spike-timing-dependent plasticity** (STDP), a local learning rule, and each of these six combinations is an experimental **arm**. A **seed** fixes the random generators so that a run can be repeated. A linear **readout** names one of five songs from the spike counts of the network, so the **chance level** of the task is 0.200. Two arms are compared seed by seed with a **paired t-test**. Its **p-value** is the probability of a difference at least this large if there were none. The size of a difference is given by **Cohen's d**, the difference in units of standard deviation. The **input-only ceiling** is the accuracy of the same readout on the input layer alone, and the **operating point** is the common firing rate of 10 Hz at which every network starts. The **integration window** is how much of the response the readout counts, and the **difficulty gradient** compares the songs two at a time. **Selectivity** and **coverage** describe how concentrated the response is, and the mean weight change |Δw| and the **drift** say how much the weights moved and whether they settled.

---

## Starting point

The phase did not exist in the original structure of the project. The comparison was spread across the modeling notebooks of phase 04, each looking at one part of the problem. The control-network notebook reported the artificial wirings, the static-connectome notebook the static arm, and the notebook of the connectome with plasticity its own arm and, at the end, a factorial comparison.

It worked, but it had two problems. The comparison is the evaluation the project is built for, and it answers the research question. Yet it sat as an appendix of the last modeling notebook, mixed with the implementation details of a single arm. And the metrics were scattered. To answer "which network is best?" one had to open three notebooks and cross tables by hand.

---

## Creating the phase (1 September 2026)

We created a dedicated notebook that gathers every metric of the project in one place and ends in a reasoned verdict. Phase 04 keeps the modeling notebooks, which document **how** each network is built. Phase 05 answers **which one wins and why**.

The notebook has one section per measure.

| Section | What it measures | Why it is there |
|---|---|---|
| 1 | Classification accuracy and statistical contrasts | the main measure of the evaluation |
| 2 | Topology × plasticity interaction | the central finding of the project |
| 3 | Convergence speed | learning speed is part of the evaluation |
| 4 | Spike efficiency | the proxy for energy cost |
| 5 | Latency against integration time | what matters for small devices |
| 6 | Difficulty gradient by pair of songs | it includes the pair that separates two species |
| 7 | Selectivity and coverage | how each network represents the song |
| 8 | Weight stability | whether learning settled |
| 9 | Robustness to seed, channel mapping and contact threshold | rules out artifacts of the design |
| 10 | Quantitative verdict | a summary that can be checked |
| 11 | Conclusions and scope | what can be claimed and what cannot |

The research question now has its answer in one document, with every metric the evaluation calls for and the statistics behind each one. Separating "how it is built" (phase 04) from "which one wins" (phase 05) also makes the work easier to follow for someone coming from outside.

---

## Fifteen seeds instead of five (1 September 2026)

With five seeds per arm, the most important contrast, the connectome against the configuration model with plasticity, gave +0.156 with p = 0.17. It was not significant, largely because that control varied so much from seed to seed (standard deviation ± 0.215).

That left the conclusion half finished. The connectome clearly beat the random network, but we could not claim that it beat the control that keeps the degree sequence. That is precisely the comparison that rules out the most obvious alternative explanation, that the advantage comes from a few highly connected neurons. A recent preprint, not yet peer reviewed, also argues that topology advantages reported for connectome-constrained networks can disappear against degree-preserving controls (Dhiman, 2026).

We extended the three arms with plasticity to **fifteen seeds**, keeping the pairing by seed. The function `load_results` in `snnlib/evaluation.py` joins the two batches, so the notebooks see a single set of runs.

| | 5 seeds | 15 seeds |
|---|---|---|
| Δ against the degree-preserving control | +0.156 | **+0.107** |
| p | 0.17 (not significant) | **0.0167 (significant)** |
| Cohen's d | | **1.02** |

With fifteen seeds **the connectome with plasticity beats the other five arms with statistical significance**. On the ten added seeds alone the decisive contrast does not reach significance (+0.083, p = 0.0593), a point the results now state.

The estimated difference went **down** when seeds were added, from +0.156 to +0.107. The five-seed estimate had been inflated by noise. What changed is not that the effect grew, but that it was measured precisely enough to tell it apart from zero.

---

## Two problems in the figures (1 September 2026)

When we generated the figures of the phase we found two legibility problems. In the panel of the gain from plasticity, the label of the topology with no effect overlapped its own value, because its bar had almost zero length. We sorted the bars by size, moved all value labels to the same side and removed the redundant vertical axis. In the figures with a double code, color for topology and shade for plasticity, the legend patches used the color of the first topology, which suggested a false correspondence. We replaced them with neutral gray patches that code only plasticity.

---

## Tables brought up to fifteen seeds (28 September 2026)

The report of the phase still held five-seed means for the three plastic arms in its latency and gradient tables, from before the extension described above. The notebook already had the right values; only the report was behind. We regenerated both tables from the stored results. The most visible changes were in the gradient, where the configuration model with plasticity rose in every column and the hardest pair of the connectome with plasticity settled at **0.955**, against **0.682** for the random network.

We also added to each table the chance line that applies to it, **0.200** for latency, a five-class task, and **0.500** for the gradient, where the songs are compared two at a time. The two tables were being read as if they shared a scale, and that confusion made the hardest pair (0.750, against a two-class chance of 0.500) look better solved than the five-class task (0.566, against 0.200). The [phase 04 research log](../04-modeling/research-log.md) tells how the same problem was fixed in the figures.

No conclusion changed. The connectome with plasticity is still first on all five pairs and, from 50 ms on, along the whole latency curve.

---

## The weight table (29 September 2026)

Re-checking the phase 04 report showed that its weight-stability table and the one of this report still held five-seed means. Both also had the connectome and Erdős–Rényi **swapped** in the mean weight change |Δw|. They said the connectome moves more weight than the random network, when it is the other way round. With fifteen seeds the values are 0.543 for the connectome, 0.602 for Erdős–Rényi and 0.858 for the configuration model, with final drifts of 0.0124, 0.0252 and 0.0146. The firing rate of the connectome with plasticity in the representation section was also corrected to **17.7 Hz**.

The reading does not change. All three networks move a substantial amount of weight, and only in the connectome does that change turn into accuracy.

---

## Final consistency pass (29 September 2026)

We re-ran the notebook in full and checked every cell against its stored output and against the report. None of the inconsistencies we found was in a measured value.

**A claim the data did not support.** The report said that the connectome with plasticity "reaches 90 % of its final accuracy with fewer training presentations than the controls". It does not. **The three plastic arms reach it with the same 50 presentations**, Erdős–Rényi included, whose final value is 0.443. The indicator is relative to each network, so a poor network crosses it early without that meaning anything. What does set the connectome apart, and what the report now says with its table, is that **it is ahead at all five points of the curve**. With ten presentations it is already at 0.543. We added the same warning about the relative threshold to the notebook.

**"The only one that grows steadily."** The report described the latency curve of the connectome with plasticity that way, and so did the phase 04 report. In latency **two** curves grow steadily, the connectome and the degree-preserving control. What sets the connectome apart is that it **levels off within the range** (0.875 at 250 ms and 0.877 at 500 ms), while the control keeps rising to the end. We corrected both reports.

**An advantage that contradicted the notebook.** The section on robustness gave an advantage of the connectome over the random network at threshold 5 taken from a separate run of a threshold comparison. The notebook prints **+0.397**, from the threshold sweep. We now quote the sweep.

**The input-only ceiling, again.** The note on the ceiling at the start of the notebook said 0.226, right below a cell that prints 0.223. We adopted **0.223**, the mean over all sixty runs, and explain the other two values where they appear.

**One standard deviation printed two ways.** The robustness section printed a standard deviation of 0.037 for the connectome with plasticity, while the tables said 0.039. The first came from the population formula (`numpy.std`, ddof = 0) and the second from the sample formula (`pandas.std`, ddof = 1). We use the sample formula everywhere except in the shaded bands of the latency figure, including that value and the error bars of the accuracy figure. Cohen's d keeps the population variance, and the code now says so.

**The gradient.** Its figure drew the chance line at 0.500 without a label, and neither the notebook nor the report said that the section is a two-class task. Both say so now, the line carries its value, and the text explains that the pairs are ordered by **relative** difference. 35 vs 45 ms and 45 vs 55 ms are both 10 ms apart, and the second is harder because 10 ms is 22 % of a 45 ms interval against 29 % of a 35 ms one.

**Minor.** "20,059 synapses" became "20,059 connections (338,013 synaptic contacts)", following the convention of phase 02. The range of rates after learning became 17.7 to 33.9 Hz.

No conclusion changed. The connectome with plasticity is still the best arm in accuracy and representation, the cheapest in spikes among the plastic arms, and it still beats the other five with significance.

---

## Rethinking the next steps (6 October 2026)

An earlier version of the next steps proposed two moves. The first was to replicate the result on the connectome of a male fly. The second was to grow the network to about 9,900 neurons by copying the subgraph eight times as columns. The goal was to detect keywords in the Google Speech Commands dataset (Warden, 2018), against a baseline that Blouw et al. (2019) ran on the Loihi chip.

We changed it for four reasons.

1. **It went against the aim of the project.** We work toward **edge AI**, machine learning inside small battery-powered devices. The gap of 461 times in energy against a linear classifier comes precisely from the network already being too large for the task. Multiplying it by eight, with the same activity per neuron, also multiplies by eight the synaptic events that have to be paid for.
2. **The argument of silence was weaker than it looked.** Our network spends nothing in silence. Against a conventional network that runs all the time, it becomes cheaper below a **duty cycle** (the fraction of time with a signal) of 0.22 %, 1.81 % or 13.06 %, depending on its configuration. But a real device switches the conventional network off when there is no signal. With that switch we expect the advantage to almost disappear.
3. **Speech does not fall in the range where we expect the effect.** Words last hundreds of milliseconds, and we expect the advantage to fade on that time scale. Nothing supported betting on the level of phonemes. It seemed more prudent to start with real signals whose rhythm is closer to the one we tested.
4. **"It only works for fly songs" is not an applicable result.** We needed to state the general principle the work does show and to look for real signals with the same shape.

We rewrote the closing section of the notebook and replaced the old plan with five steps, A to E, written so that they can be followed without the jargon. They are in the [Next steps](results.md#next-steps-from-the-fly-to-low-power-devices) section of the results, the only place where the plan is described. Two ideas of the old plan survive inside step E. Growing by columns becomes one way to scale a design recipe, and the male connectome (Berg et al., 2026) becomes a test of whether the recipe belongs to one brain only. It comes from a male fly, so the comparison would test sexual dimorphism, not just repeat the experiment.

---

## Re-running the evaluation for this repository (October 2026)

When we prepared this repository we re-ran the notebook in a fresh environment, on the outputs that phase 04 regenerated. Every number came out identical. Reading each text against its output again led to a few corrections.

- The convergence section said that ten presentations already beat what "the two random networks" reach with a hundred. That holds for the two Erdős–Rényi networks (0.444 and 0.443), not for the configuration model, which reaches 0.604 static and 0.768 with plasticity.
- The latency section said that the four curves without steady growth move "around chance". They do not. All of them stay well above 0.200 and end between 0.504 and 0.562 at 500 ms.
- The efficiency section said that the static arms spend fewer spikes than the connectome with plasticity. That is true for the static connectome and configuration model, not for static Erdős–Rényi (9,235 spikes per correct answer against 6,278).
- The representation section read the high selectivity of the connectome with plasticity as real specialization, "not the trivial selectivity of a network where almost no one fires". Its coverage is in fact the lowest of the six arms, 5.851 % of the readout neurons, and a response spread evenly over so few neurons would already reach a selectivity of about 0.94. The report now says that learning concentrates the response on a small group, and that selectivity alone does not prove specialization.
- The pair 35 vs 55 ms was described as the discrimination that the real circuit performs in nature. In the fly the selectivity for the interval appears downstream of the circuit we model, so the report now presents the task as a proxy.
- Earlier versions of the next steps quoted the range of intervals where the effect holds and where it disappears, from exploratory runs whose code is not part of this repository. We now present those limits as hypotheses to test. The literature figures of that section were checked against their sources and corrected where needed.

---

## Where the phase stands

```
05-evaluation/
  01-comparative-evaluation.ipynb   every metric and the verdict
  results.md                        findings of the phase and next steps
  research-log.md                   this document
```

Figures, in `docs/figures/`: `05-accuracy-by-topology`, `05-topology-plasticity-interaction`, `05-readout-convergence`, `05-spike-efficiency`, `05-latency-integration-window`, `05-difficulty-gradient`, `05-representation` and `05-weight-change-vs-accuracy`.

---

## Open questions

- **The operating point is matched before learning**, not after, so accuracy must always be read together with the spikes per correct classification.
- **The advantage over the degree-preserving control is the narrowest** of the set (+0.107). It is significant with fifteen seeds, but it should always be reported with its effect size.
- **The readout is linear.** A non-linear decoder could change the order of the topologies, and not necessarily in the same way for all of them.

---

## References

- Berg, S., Beckett, I. R., Costa, M., Schlegel, P., Januszewski, M., Marin, E. C., Nern, A., Preibisch, S., Qiu, W., Takemura, S.-y., Fragniere, A. M. C., Champion, A. S., Adjavon, D.-Y., Cook, M., Gkantia, M., Hayworth, K. J., Huang, G. B., Katz, W. T., Kämpf, F., . . . Jefferis, G. S. X. E. (2026). Sexual dimorphism in the complete *Drosophila* male central nervous system connectome. *Cell, 189*(18), 5504–5526.e15. https://doi.org/10.1016/j.cell.2026.08.015
- Blouw, P., Choo, X., Hunsberger, E., & Eliasmith, C. (2019). Benchmarking keyword spotting efficiency on neuromorphic hardware. In *Proceedings of the 7th Annual Neuro-inspired Computational Elements Workshop (NICE ’19)* (pp. 1–8). ACM. https://doi.org/10.1145/3320288.3320304
- Dhiman, N. (2026). *Topological sensitivity in connectome-constrained neural networks* (arXiv:2604.04033) [Preprint]. arXiv. https://doi.org/10.48550/arXiv.2604.04033
- Dorkenwald, S., Matsliah, A., Sterling, A. R., Schlegel, P., Yu, S.-c., McKellar, C. E., Lin, A., Costa, M., Eichler, K., Yin, Y., Silversmith, W., Schneider-Mizell, C., Jordan, C. S., Brittain, D., Halageri, A., Kuehner, K., Ogedengbe, O., Morey, R., Gager, J., . . . The FlyWire Consortium. (2024). Neuronal wiring diagram of an adult brain. *Nature, 634*(8032), 124–138. https://doi.org/10.1038/s41586-024-07558-y
- Warden, P. (2018). *Speech Commands: A dataset for limited-vocabulary speech recognition* (arXiv:1804.03209) [Preprint]. arXiv. https://doi.org/10.48550/arXiv.1804.03209
