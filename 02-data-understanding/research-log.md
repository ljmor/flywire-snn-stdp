# Phase 02 research log

From the full FlyWire connectome to the auditory subgraph of Johnston's organ.

This log follows the phase in chronological order. It records each problem we found when we looked again, and how we fixed it. The current results are in [`results.md`](results.md), and the code and its outputs are in the [notebook](01-exploratory-data-analysis.ipynb).

A few terms first. A **connectome** is a map of every neuron of a brain and of the connections between them. FlyWire is the public connectome of a whole adult fruit-fly brain (Dorkenwald et al., 2024; Schlegel et al., 2024). **Johnston's organ** (JO) is the ear of the fly, in the antenna, and its sensory neurons are the input of our circuit. A **synaptic contact** is one physical site where a neuron passes a signal to another. A **connection** is a directed pair of neurons, and its weight is the number of contacts between them. The **contact threshold** is the minimum number of contacts a connection needs to stay in the graph.

---

## Starting point (June–July 2026)

The phase began with the public FlyWire files and a plain aim: isolate the auditory circuit of Johnston's organ and turn it into something we could simulate. A notebook built the subgraph. Next to it sat a separate extraction script, and the notebook's tables were copied by hand into the folder that the later phases read.

That first version already produced the subgraph we use today, with 1,239 neurons, 20,059 connections and 269 JO neurons. What changed afterwards was the sign given to part of the connections and the choice of the neurons that receive the stimulus.

---

## Rebuilding every step from the raw files (27 August 2026)

At the end of August we re-ran every step from the raw files instead of relying on the saved tables. Part of the work held up well. The subgraph came out identical connection by connection, with the same weights and neurotransmitters, and every printed number matched. There were no duplicate connections, no self-connections and no orphan neurons. So the problems we found next were design decisions, not data errors. Four of them biased everything downstream, and in one place the text claimed the opposite of its own table.

### Half of the input layer was a dead end

The stimulus used to go into all 269 JO neurons of the graph. When we checked which of them could actually pass it on, only 123 turned out to have an outgoing connection. The other 146 (54.3 %) were in the graph only because other neurons sent them feedback, so more than half of the stimulus went nowhere.

It was worse than a waste. Phase 04 splits the sound into 32 frequency channels with a bank of band-pass filters, and each channel drives a block of input neurons. In an earlier version, with the channels split over the 269 neurons, a channel could drive anywhere from 1 to 8 useful neurons. The effective gain therefore changed up to eight-fold between channels, which explained a sensitivity to the mapping that had looked puzzling.

We redefined the **input layer** as the JO neurons with at least one outgoing connection; the column `is_input` of `jo_nodes.csv` marks them. The other 146 stay in the network, because the feedback they receive is real, but they get no stimulus. Every channel now drives 3 or 4 useful neurons. Most of the later corrections depend on this one.

### The neurotransmitter came from the first row of the file

Each connection used to take its neurotransmitter from the first row in which it appeared, through `groupby(...).agg(nt_type='first')`. A code comment justified this with Dale's principle, the idea that a neuron releases the same transmitter at all its terminals (Eccles, 1976; Svensson et al., 2019).

The raw table does not behave that way. The transmitter is predicted synapse by synapse (Eckstein et al., 2024), and 1,183 of the 1,303 presynaptic neurons of the subgraph carry more than one label. Even single pairs of neurons disagree, since 9.3 % of them get different labels in different neuropils, the dense brain regions where the contacts sit. In practice, the sign of part of the graph depended on the order of the rows in the CSV file.

We now assign one transmitter per presynaptic neuron, by a majority vote weighted by synapse count over the whole connectome, with ties broken in a fixed order. Eckstein et al. (2024) derive their neuron-level predictions the same way. This is the version of Dale's principle that the comment had promised. The change flipped the sign of 1,258 connections (6.3 %). The ratio of excitatory to inhibitory connections (E/I) went from 0.838 in the earlier version to 0.7443. The assignment also gained a confidence measure, the purity, which averages 0.866.

There was a side effect. Modulatory connections (serotonin, dopamine, octopamine) dropped from 445 in the earlier version to 110. Most of the old modulatory labels were classifier noise spread over the graph, and that later changed a conclusion of phase 03 about the modulatory channel (see [its research log](../03-data-preparation/research-log.md)).

### The ear's afferents entered as inhibitory or modulatory

Most JO neurons are cholinergic afferents (Ishikawa et al., 2017), so they should excite their targets. Yet 64 of the 960 connections leaving JO neurons, 6.7 % of them with 6.6 % of their weight, entered the model as inhibitory or modulatory. The transmitter classifier is known to mislabel some first-order sensory neurons (Eckstein et al., 2024). Without a fix, the network had inhibition right at the entrance of the stimulus, where it does the most harm.

We set every connection whose presynaptic neuron is a JO neuron to acetylcholine and left the prediction unchanged for all other neurons. The column `nt_source` records which connections carry this prior, so the decision stays traceable and can be undone.

### The text contradicted its own table

Two notebook cells stated that the five-contact threshold kept the structure of the circuit and every JO neuron. The sweep table right above them showed 269 of 393.

The real loss is 124 of the 393 annotated JO neurons (31.6 %). Measured on the 389 that have at least one connection, the base of the sweep, it is 30.8 %. It is also uneven. The left side loses 41.5 % of its JO neurons and the right side 18.1 %, a bias nobody had looked at before.

We corrected the text and added the breakdown by side, with a figure. At the time we attributed the imbalance to uneven proofreading of the two hemispheres. A later check of the FlyWire papers found no support for that explanation, since they report similar reconstruction completeness in both hemispheres (Dorkenwald et al., 2024). The results now describe the imbalance as unexplained, with possible technical causes. It matters. A false statement in the data-understanding phase would carry over into every later analysis. The imbalance also shapes the input layer, with 82 neurons on the right side and 41 on the left.

### The configuration model was built and never used

The notebook generated and justified two control networks and saved them to disk. One was an Erdős–Rényi random graph (Erdős & Rényi, 1959), the other a configuration model (Molloy & Reed, 1995; Newman et al., 2001). No later code read them. Phase 04 built its own random graph by another route, and the configuration model was never used at all.

Both controls now come from `snnlib/graph.py`, with the same number of connections per polarity and the same weight distribution as the connectome. Phase 04 runs them as real arms of its factorial design. The configuration model is the demanding control. It keeps the degree sequence of the connectome, that is, how many connections enter and leave each neuron, and rewires where they go. The copy is not perfect, since the shuffle refuses self-connections and repeated pairs. The out-degree correlation with the connectome is 0.999983, and 10 of the 1,239 neurons are off by 3 connections at most. Without this control, any advantage of the biological wiring could be explained by a few neurons that concentrate many connections. With it, that explanation can be put to the test.

On the way we fixed the Erdős–Rényi generator. It dropped self-connections without replacing them, so it drew a few connections fewer than the connectome, and it allowed some repeated pairs. It now draws exactly the same number of connections per polarity, with no self-connections and no repeats within a polarity. The three polarities are still drawn separately, so 65 pairs of neurons end up with two connections of different polarity. The directed graph then has 19,994 distinct edges, while the simulated connections are 20,059 in every network, and that is the number the design keeps equal.

### Retiring a faulty extraction script

The old extraction script built the graph by adding one edge per neuropil row, so each new row overwrote the weight of the connection instead of adding to it. A large share of its weights were wrong, and much of the synaptic weight was lost. Its output was never the canonical one, because the notebook produced the files the later phases used, so no result was affected. Still, the script sat in the repository as if it were the official extractor. We removed it together with its outputs and a duplicate copy of the annotation file. Extraction now lives in one place, `snnlib/extraction.py`, with each step documented.

---

## Bringing in the cell types (28 August 2026)

The input neurons were assigned to the 32 frequency channels by sorting them by their FlyWire identifier, the `root_id`. We had validated that order with a permutation test. Neighbors in the `root_id` order have more similar projections than chance (0.0671 against 0.0353 ± 0.0101 over 5,000 random orders, p = 0.0024). Still, the order remained a statistical proxy without an anatomical basis. The annotation file could not help, because its `auditory` label groups the JO-A and JO-B subtypes without telling them apart.

We added the cell-type table of Codex, `consolidated_cell_types.csv.gz` (Deutsch et al., 2025; Matsliah et al., 2024; Schlegel et al., 2024), and checked three things before using it.

1. **Coverage.** All 393 JO neurons have a subtype, 299 JO-B and 94 JO-A.
2. **An independent check of the selection.** The `auditory` subclass is exactly the set JO-A + JO-B, the same neurons and not just the same count. The `wind_gravity` subclass holds JO-C, JO-D, JO-E and their variants. A second source thus confirms which neurons count as the auditory part of Johnston's organ.
3. **A real difference.** Neurons of the same subtype project to targets 4.84 times more similar than neurons of different subtypes. JO-A sends 10.4 % of its contacts to the region AVLP_R against 0.7 % for JO-B, and JO-B leans towards the region SAD (39.9 % against 27.9 %).

The frequency mapping is now anchored on anatomy, with JO-B on the low channels and JO-A on the high ones (Kamikouchi et al., 2009; Matsuo et al., 2014).

What phase 04 measured afterwards is worth stating plainly, because it supports the choice. Phase 04 tried four mappings (anchored, anchored but inverted, `root_id` order and random). The connectome network that learns reaches between 0.880 and 0.920 accuracy with all of them, accuracy being the fraction of test songs it classifies correctly. The anchored mapping is the least favorable of the four (0.880 against 0.920 for the random one). That was to be expected. The five songs of the task share one carrier frequency, so there is no frequency axis to exploit. Every mapping gives each channel the same number of input neurons, so what changes is which neurons receive the song. Only the connectome was run with the four mappings. We report the main results with the anchored mapping because it is the conservative choice. The details are in the [modeling results](../04-modeling/results.md).

---

## Testing the contact threshold (31 August 2026)

The threshold of five contacts per connection was first adopted as a community convention. Since it removes 31.6 % of the 393 annotated JO neurons, that was not enough. A later reading of the source supports that doubt. Dorkenwald et al. (2024) use five synapses for their analyses and call the value "reasonable but arbitrary".

We ran two checks. The first looked at how the synaptic weight is spread.

| Contacts per connection | Share of connections | Share of contacts |
|---|---|---|
| exactly 1 | 41.5 % | 7.0 % |
| **5 or more** | 28.0 % | **79.3 %** |

Single-contact connections are 41.5 % of all connections and carry 7.0 % of the contacts, so dropping them removes most of the likely detection noise at very little cost in signal.

The second check rebuilt the subgraph at 1, 3, 5 and 10 contacts, recalibrated each network and ran the whole task (phase 04). Without any threshold the connectome network with learning **gets worse**, 0.727 accuracy against 0.863 at five contacts, although it has 2.7 times more input neurons. At three contacts its advantage over the random control looks larger, mostly because the control drops (0.223 against 0.467 at five) while the connectome rises only a little (0.903). A threshold tuned on the results would produce exactly that pattern. With five contacts, a value fixed before any result, the conclusion holds at every threshold where the controls can be calibrated. The threshold went from an inherited decision to a tested one.

---

## Final consistency pass (29 September 2026)

We re-ran the notebook from top to bottom; its execution counters, out of order after cells had been run separately, are consecutive again. The pass also tightened three points of wording.

The **−31.6 %** loss was measured from a base the table does not use. The text said that going from one to five contacts kept 269 of the 393 auditory neurons, but at a threshold of one only 389 remain; the other four have no connection with the subgraph at all. The cell next to it therefore prints −30.8 %. Both figures circulate, so the text now gives each with its base, 120 of the 389 present or 124 of the 393 annotated.

**A connection is not a synapse.** Some passages called the 20,059 connections "synapses". They are directed neuron-to-neuron pairs, and together they contain 338,013 synaptic contacts, 16.85 per connection on average, so the old wording understated the circuit badly. The whole phase now uses "connection" for the edges of the graph and "synaptic contact" for the 338,013.

**The cholinergic prior had two counts.** The notebook measured 64 non-cholinergic JO connections, while the extraction reported 757 reassigned ones. They do not contradict each other. The prior is applied before the threshold, on the 71,621 merged connections, and 64 is what remains in the final graph of 20,059. The text now says so before the reader meets the two numbers.

No decision and no measured value changed. The subgraph, regenerated from the raw files, came out identical: 1,239 neurons, 20,059 connections, 269 JO neurons and 123 input neurons.

---

## Where the phase stands

```
02-data-understanding/
  01-exploratory-data-analysis.ipynb   exploration, decisions and checks
  results.md                           findings of the phase
  research-log.md                      this document

data/processed/                        product of the phase
  jo_nodes.csv                         1,239 neurons with is_jo, is_input, cell_type, side
  jo_edges.csv                         20,059 connections with weight, nt, polarity, nt_source
  jo_meta.json                         summary counts and FlyWire snapshot
```

The graph itself is the one we started with. It has 1,365 starting neurons, 108,374 internal rows and 71,621 merged connections, and after the threshold 20,059 connections among 1,239 neurons. Two things changed, the polarity of part of the connections and the neurons that form the input layer. Everything else is now documented and checked rather than inherited.

## Open questions

- **The tonotopic anchor has two levels, not a continuous map.** The column `additional_type(s)` is empty for the 393 neurons, so the cell-type table has no finer subdivision. A real 32-channel map would need the position of each neuron along the antenna, which the Codex tables do not provide.
- **The left–right imbalance is stronger in one subtype.** JO-A contributes 29 input neurons from the right side and 7 from the left, JO-B 53 and 34.
- **The neurotransmitter remains a prediction.** A mean purity of 0.866 means that, on average, about 13 % of the synapses of a neuron carry a label other than the winner.

## References

- Deutsch, D., Matsliah, A., Crown, A., Wang, K., Dorkenwald, S., Mondal, A., Jana, S., Burke, A., Hebditch, J., Gager, J., Normand, E., Wang, M., MkKellar, C., Yu, S.-c., Sterling, A., Schlegel, P., Gerhard, S., Sterne, G., Costa, M., . . . Murthy, M. (2025). *Sexually dimorphic neurons in the Drosophila whole-brain connectome* [Preprint]. bioRxiv. https://doi.org/10.1101/2025.06.10.658788
- Dorkenwald, S., Matsliah, A., Sterling, A. R., Schlegel, P., Yu, S.-c., McKellar, C. E., Lin, A., Costa, M., Eichler, K., Yin, Y., Silversmith, W., Schneider-Mizell, C., Jordan, C. S., Brittain, D., Halageri, A., Kuehner, K., Ogedengbe, O., Morey, R., Gager, J., . . . The FlyWire Consortium. (2024). Neuronal wiring diagram of an adult brain. *Nature, 634*(8032), 124–138. https://doi.org/10.1038/s41586-024-07558-y
- Eccles, J. C. (1976). From electrical to chemical transmission in the central nervous system: The closing address of the Sir Henry Dale Centennial Symposium. *Notes and Records of the Royal Society of London, 30*(2), 219–230. https://doi.org/10.1098/rsnr.1976.0015
- Eckstein, N., Bates, A. S., Champion, A., Du, M., Yin, Y., Schlegel, P., Lu, A. K.-Y., Rymer, T., Finley-May, S., Paterson, T., Parekh, R., Dorkenwald, S., Matsliah, A., Yu, S.-C., McKellar, C., Sterling, A., Eichler, K., Costa, M., Seung, S., . . . Funke, J. (2024). Neurotransmitter classification from electron microscopy images at synaptic sites in *Drosophila melanogaster*. *Cell, 187*(10), 2574–2594.e23. https://doi.org/10.1016/j.cell.2024.03.016
- Erdős, P., & Rényi, A. (1959). On random graphs I. *Publicationes Mathematicae Debrecen, 6*(3–4), 290–297. https://doi.org/10.5486/PMD.1959.6.3-4.12
- Ishikawa, Y., Okamoto, N., Nakamura, M., Kim, H., & Kamikouchi, A. (2017). Anatomic and physiologic heterogeneity of subgroup-A auditory sensory neurons in fruit flies. *Frontiers in Neural Circuits, 11*, Article 46. https://doi.org/10.3389/fncir.2017.00046
- Kamikouchi, A., Inagaki, H. K., Effertz, T., Hendrich, O., Fiala, A., Göpfert, M. C., & Ito, K. (2009). The neural basis of *Drosophila* gravity-sensing and hearing. *Nature, 458*(7235), 165–171. https://doi.org/10.1038/nature07810
- Matsliah, A., Yu, S.-c., Kruk, K., Bland, D., Burke, A. T., Gager, J., Hebditch, J., Silverman, B., Willie, K. P., Willie, R., Sorek, M., Sterling, A. R., Kind, E., Garner, D., Sancer, G., Wernet, M. F., Kim, S. S., Murthy, M., Seung, H. S., & The FlyWire Consortium. (2024). Neuronal parts list and wiring diagram for a visual system. *Nature, 634*(8032), 166–180. https://doi.org/10.1038/s41586-024-07981-1
- Matsuo, E., Yamada, D., Ishikawa, Y., Asai, T., Ishimoto, H., & Kamikouchi, A. (2014). Identification of novel vibration- and deflection-sensitive neuronal subgroups in Johnston’s organ of the fruit fly. *Frontiers in Physiology, 5*, Article 179. https://doi.org/10.3389/fphys.2014.00179
- Molloy, M., & Reed, B. (1995). A critical point for random graphs with a given degree sequence. *Random Structures & Algorithms, 6*(2–3), 161–180. https://doi.org/10.1002/rsa.3240060204
- Newman, M. E. J., Strogatz, S. H., & Watts, D. J. (2001). Random graphs with arbitrary degree distributions and their applications. *Physical Review E, 64*(2), Article 026118. https://doi.org/10.1103/PhysRevE.64.026118
- Schlegel, P., Yin, Y., Bates, A. S., Dorkenwald, S., Eichler, K., Brooks, P., Han, D. S., Gkantia, M., dos Santos, M., Munnelly, E. J., Badalamente, G., Serratosa Capdevila, L., Sane, V. A., Fragniere, A. M. C., Kiassat, L., Pleijzier, M. W., Stürner, T., Tamimi, I. F. M., Dunne, C. R., . . . Jefferis, G. S. X. E. (2024). Whole-brain annotation and multi-connectome cell typing of *Drosophila*. *Nature, 634*(8032), 139–152. https://doi.org/10.1038/s41586-024-07686-5
- Svensson, E., Apergis-Schoute, J., Burnstock, G., Nusbaum, M. P., Parker, D., & Schiöth, H. B. (2019). General principles of neuronal co-transmission: Insights from multiple model systems. *Frontiers in Neural Circuits, 12*, Article 117. https://doi.org/10.3389/fncir.2018.00117
