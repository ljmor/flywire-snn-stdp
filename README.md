# A spiking neural network wired like the auditory circuit of *Drosophila*

**Connectome topology and spike-timing-dependent plasticity on the FlyWire Johnston's organ subgraph**

We copied the hearing circuit of the fruit fly into a simulated network, neuron by neuron and connection by connection, and asked whether that wiring helps the network learn. It does. With a local learning rule, the fly's wiring tells apart five rhythms of the fly's courtship song with an accuracy of 0.875. A random network of the same size, trained with the same rule, stays at 0.443. What surprised us is that the wiring only helps when the network learns. Without learning it does no better than a random network that keeps the number of connections of each neuron.

This repository holds the whole study. Every stored result sits next to the notebook that prints it. A single pipeline rebuilds everything from the raw data, and a web demo lets you hear the songs the networks heard.

---

## The question

A **spiking neural network** (SNN) is a network whose neurons communicate through **spikes**, brief electrical events like those of real neurons. A **connectome** is a map of the neurons of a brain and of the connections between them. FlyWire has reconstructed one for the whole brain of an adult fruit fly, *Drosophila melanogaster*, from electron-microscopy images (Dorkenwald et al., 2024; Schlegel et al., 2024). We take from it the circuit of **Johnston's organ** (JO), the fly's ear, an organ in the antenna that picks up sound. We keep the auditory JO neurons and the neurons they send connections to, and only the connections made of at least five synaptic contacts, the single points where one neuron passes a signal to another. In FlyWire release v783 that leaves a circuit of 1,239 neurons and 20,059 connections.

The network learns with **spike-timing-dependent plasticity** (STDP). The rule strengthens a connection when the sending neuron fires just before the receiving one, and weakens it when the order is reversed (Song et al., 2000). It is a local rule. Each connection changes with the activity of the two neurons it joins and nothing else, with no error signal sent back from the output.

So the question is this.

> Does a spiking network wired like the fly's auditory circuit, and trained with STDP, classify sounds better and with fewer spikes than networks of the same size with artificial wiring?

**Mostly yes, on the task we tested.** The biological wiring with STDP beats the other five conditions of the experiment with statistical significance. It also fires four times fewer spikes per correct answer than a random network that learns with the same rule, although two networks that do not learn spend fewer spikes for much lower accuracy. The advantage comes from wiring and learning together, since the same rule does not significantly help the artificial networks.

The background, the objectives and the scope of the project are in [`01-problem-understanding/`](01-problem-understanding/README.md).

### The experiment in brief

**The task.** A male fly courts a female with a pulse song, a train of brief clicks made by vibrating one wing. The time between clicks is the **inter-pulse interval** (IPI). It is one of the main cues the female uses to recognize her own species, about 34 ms in *D. melanogaster* and about 48 ms in its sister species *D. simulans* (Bennet-Clark & Ewing, 1969; Kyriacou & Hall, 1980). Our networks hear synthetic songs with intervals of 25, 35, 45, 55 or 65 ms and have to say which one is playing. In the fly, selectivity for the interval appears downstream of the circuit we model (Baker et al., 2022; Zhou et al., 2015). The task is therefore a proxy that we impose on this circuit, not a function known to happen there.

**From sound to spikes.** An artificial ear splits each song into 32 frequency bands between 80 and 380 Hz. It uses a gammatone filterbank, a widely used model of auditory filters (Patterson et al., 1992). Each band drives three or four of the 123 JO neurons that send connections into the circuit, and those 123 neurons form the input layer.

**The network.** Its neurons are **leaky integrate-and-fire** (LIF) neurons. Each one adds up its input current, slowly loses it, and fires when its voltage crosses a threshold. A connection is excitatory, inhibitory or modulatory depending on the neurotransmitter, the chemical messenger that FlyWire predicts for the sending neuron (Eckstein et al., 2024). Each connection has a weight, set from its number of synaptic contacts, and during training STDP changes the weights. **Winner-take-all** (WTA) inhibition, a pool of 50 inhibitory neurons, holds the network back when too many neurons fire, so that a few of them specialize. Everything runs in the Brian2 simulator (Stimberg et al., 2019).

**The readout.** After training, the weights are frozen. A **linear readout**, a logistic regression (Pedregosa et al., 2011), names the song from how many spikes each of the other 1,116 neurons fired in 250 ms. The readout is trained with the names of the songs. The network never sees them.

**The controls.** Two random networks of the same size serve as controls. An **Erdős–Rényi** graph keeps only the number of neurons and of connections of each sign (Erdős & Rényi, 1959). A **configuration model** also keeps how many connections enter and leave each neuron, its degree (Molloy & Reed, 1995; Newman et al., 2001). Nothing else changes between the three. They share the weight distribution, the input layer, the neuron model, the learning rule and the readout. Before learning, every network is tuned to the same **operating point**, a mean firing rate of 10 Hz.

**The design.** Each of the three wirings runs without plasticity (static) and with STDP + WTA, which makes six **arms**. The static arms have neither STDP nor the WTA pool, so the effect of plasticity reported below is that of the two together. We repeated the arms with plasticity with 15 **seeds** and the static arms with 5. A seed is the number that fixes the random draws, so that a run can be repeated exactly.

**Reading the numbers.** Accuracy is the fraction of unseen test songs that the readout names correctly. With five classes, guessing gets 0.200 right, the **chance level**. The same readout applied to the input layer alone, with no network in between, reaches 0.223. We call that the **input-only ceiling**. Whatever a network scores above it, the network computed. Values are means ± the standard deviation across seeds. Two arms are compared seed by seed with a two-sided paired t-test. Its **p-value** is the probability of a difference at least this large if there were none. **Cohen's d** gives the size of a difference in units of standard deviation (Cohen, 1988/2013).

---

## Key results

Five-class accuracy with a 250 ms window. Chance = 0.200, input-only ceiling = 0.223.

| Topology | Static (5 seeds) | STDP + WTA (15 seeds) |
|---|---|---|
| **Connectome** | 0.566 ± 0.082 | **0.875 ± 0.039** |
| Configuration model | 0.604 ± 0.050 | 0.768 ± 0.148 |
| Erdős–Rényi | 0.444 ± 0.057 | 0.443 ± 0.080 |

### The connectome with plasticity beats the other five arms

| Comparison | Δ accuracy | p | Cohen's d |
|---|---|---|---|
| vs Erdős–Rényi + STDP | +0.433 | < 0.00001 | 7.14 |
| vs connectome without STDP | +0.309 | 0.0047 | 5.31 |
| vs configuration model + STDP | +0.107 | 0.0167 | 1.02 |

The contrasts with the two remaining arms, both static, are in the [phase 05 results](05-evaluation/results.md). The last row of the table is the one that matters most. The configuration model keeps, almost exactly, the degree sequence of the connectome, so it rules out the simplest explanation, that the advantage comes from a few neurons with very many connections. A recent preprint, not yet peer reviewed, argues that topology advantages reported for connectome-constrained networks can disappear against such controls (Dhiman, 2026). Here the advantage survives. It is also the narrowest one, which is why we always give it with its effect size. The plastic arms were extended from five to fifteen seeds after a first, non-significant result, and on the ten added seeds alone the connectome still leads, by +0.083, with p = 0.0593.

### Plasticity only pays off significantly on the biological wiring

| Topology | Static | STDP + WTA | Gain from plasticity | p |
|---|---|---|---|---|
| **Connectome** | 0.566 | **0.875** | **+0.309** | **0.0047** |
| Configuration model | 0.604 | 0.768 | +0.164 | 0.213 |
| Erdős–Rényi | 0.444 | 0.443 | −0.001 | 0.706 |

This is the central finding of the project. The three networks have the same size, density and weight distribution, and they learn with the same rule and the same parameters. Only the biological wiring improves significantly. Without plasticity the configuration model is even slightly ahead of the connectome. With plasticity the order flips. On its own, then, the fly's wiring is no better than a random network with the same degrees. Its value lies in giving local learning something to work with. A direct test of the interaction, which compares the gains seed by seed, confirms it against Erdős–Rényi (p = 0.0114) but not against the configuration model (p = 0.0988). The gain of that control is about half that of the connectome. That comparison is the least certain part of the result.

![Interaction between topology and plasticity](docs/figures/05-topology-plasticity-interaction.png)

*Left, the accuracy of each wiring without and with plasticity; the lines of the connectome and of the configuration model cross. Right, the gain that plasticity brings to each wiring, significant only for the connectome. The dashed line is chance.*

### Four times fewer spikes per correct answer

How many spikes does each correct answer cost? We count all the spikes that the 1,239 neurons of the circuit fire during the test, leaving out the 50 neurons of the WTA pool, and divide by the number of correct answers. On neuromorphic chips such as Loihi, hardware built to run spiking networks, energy is spent only when spikes occur (Davies et al., 2018; Schuman et al., 2022), so this count measures the activity a network needs. The connectome with plasticity needs 6,278 spikes per correct answer. The Erdős–Rényi network with the same rule needs 25,175, which makes the connectome 4.0 times cheaper in spikes for twice the accuracy.

### Speed, and the two species

The connectome with plasticity reaches 0.875 after hearing 250 ms of song, and twice that time adds almost nothing (0.877 at 500 ms). Its readout also learns fast. With only 10 of the 100 training presentations it already scores 0.543, more than either Erdős–Rényi network reaches with all of them.

The pair of songs at 35 and 55 ms has a meaning of its own. The first interval is typical of *D. melanogaster*, and the second falls in the range reported for *D. simulans* (Deutsch et al., 2019). When the readout only has to tell these two apart, the connectome with plasticity gets 0.998 right. This is a two-class question, so its chance level is 0.500.

### The result holds up

All fifteen seeds of the connectome with plasticity land between 0.800 and 0.950, above the input-only ceiling. The way the 32 sound channels are assigned to the input neurons barely changes its accuracy, which stays between 0.880 and 0.920 with four different assignments. Its gain from plasticity does change with them, from +0.142 to +0.314, and the control networks were run only with the default assignment. We also rebuilt the circuit with other minimum numbers of synaptic contacts per connection and recalibrated each time. Its lead over the random network with plasticity is +0.680 at 3 contacts, +0.397 at 5 and +0.370 at 10, with three seeds per network.

---

## What this work does not claim

**No energy advantage over conventional networks.** The usual case for spiking networks is energy. On neuromorphic hardware they promise to compute with much less of it than conventional networks, whose units pass continuous values instead of spikes (Roy et al., 2019; Schuman et al., 2022). We tested that promise on this task, and it does not hold. A linear classifier on the input spikes, split into 10 time windows so that it sees when they occur, reaches 0.960 with 6,150 multiply-accumulate operations, the basic arithmetic step of a conventional network. It scores far above the input-only ceiling because the interval is a matter of timing, and the readout of the spiking networks only counts spikes. Costed with published energies per operation (Davies et al., 2018; Horowitz, 2014), the spiking network needs about 461 times more energy to reach 0.880. Neither the wiring nor the learning rule is to blame. The problem is scale, because a circuit of 1,239 neurons is far too large for a five-class task. The energy argument for spiking networks remains a motivation taken from the literature, and this work does not support it. The full analysis is in [Comparison with conventional networks](04-modeling/results.md#11-comparison-with-conventional-networks).

**Other limits.** The task is a proxy, as explained above. The operating point is matched before learning, and afterwards the arms with plasticity fire between 17.74 and 33.94 Hz, so accuracy should be read together with the spike counts. The readout is linear, and a non-linear decoder might read each wiring differently. The songs are synthetic, with five intervals and a single carrier frequency, and the model has no synaptic delays. Finally, the p-values are not corrected for multiple comparisons. Over the five contrasts of the connectome with plasticity, the Holm procedure keeps all of them below 0.05. The stricter Bonferroni correction raises the decisive one to 0.0836.

Where this could lead, from the song of a fly to low-power sensors, is discussed in [Next steps](05-evaluation/results.md#next-steps-from-the-fly-to-low-power-devices). Nothing in that section is a result of this repository.

---

## How the study is organized

The folders follow the six phases of CRISP-DM, the Cross-Industry Standard Process for Data Mining (Chapman et al., 2000). The table also gives the matching step of the process of knowledge discovery in databases (KDD) described by Fayyad et al. (1996).

| Folder | CRISP-DM phase | KDD step | What happens there |
|---|---|---|---|
| [`01-problem-understanding/`](01-problem-understanding/README.md) | business understanding, here the research problem | understanding the domain and the goal | the question, the objectives and the scope |
| [`02-data-understanding/`](02-data-understanding/results.md) | data understanding | selection | extracting the JO subgraph from FlyWire and describing it |
| [`03-data-preparation/`](03-data-preparation/results.md) | data preparation | preprocessing and transformation | turning the graph into a spiking network and calibrating it |
| [`04-modeling/`](04-modeling/results.md) | modeling | data mining | running the experiments and storing their outputs |
| [`05-evaluation/`](05-evaluation/results.md) | evaluation | interpretation and evaluation | comparing the six arms with statistics |
| [`06-deployment/`](06-deployment/README.md) | deployment | using the discovered knowledge | the pipeline, the checks, the reproduction guide and the web demo |

Phases 02 to 05 each have two documents. `results.md` is the report of the phase. It gives the numbers and the figures, says what they mean and lists the limitations. `research-log.md` is the history of the phase: where it started and what we corrected along the way, and why. Each report can be read on its own. The numbers it quotes come from its notebook or from the scripts of its phase, and a few from a simple calculation on the stored outputs.

Only the scripts simulate. They store their results as JSON and CSV files in the `outputs/` folder of their phase, and the notebooks read those files and draw the figures. The one exception is the calibration notebook, which runs its own parameter sweeps.

---

## Repository layout

```
flywire-snn-stdp/
├── README.md                     this file
├── LICENSE                       MIT license of the code
├── CITATION.cff                  citation metadata
├── requirements.txt              Python packages, minimum versions
├── requirements-lock.txt         Python packages, the exact versions behind our numbers
├── data/                         FlyWire v783 files and the JO subgraph (see data/README.md)
│   ├── raw/                      the three FlyWire files (the large one is downloaded by hand)
│   ├── processed/                the JO subgraph that every phase uses
│   └── interim/                  subgraphs of the contact-threshold sweep, rebuilt on demand
├── snnlib/                       library shared by all phases
│   ├── extraction.py             FlyWire files -> JO subgraph
│   ├── graph.py                  loads the subgraph and builds the control networks
│   ├── audio.py                  courtship songs -> spike trains
│   ├── network.py                LIF network with STDP and WTA in Brian2
│   ├── calibration.py            matches the operating point
│   └── evaluation.py             training, readout and metrics
├── 01-problem-understanding/     README.md
├── 02-data-understanding/        exploratory notebook, results.md, research-log.md
├── 03-data-preparation/          calibrate.py, calibration notebook, outputs/, results.md, research-log.md
├── 04-modeling/                  experiment scripts, four notebooks, outputs/, results.md, research-log.md
├── 05-evaluation/                comparative-evaluation notebook, results.md, research-log.md
├── 06-deployment/                pipeline.py, verify_outputs.py, README.md (reproduction guide)
│   └── demo/                     interactive web page (React, Three.js, Vite)
└── docs/figures/                 the 30 figures, prefixed with the phase that draws them
```

---

## Quick start

You need Python 3.12 or later (we used 3.14.6) and a C++ compiler, because Brian2 compiles the model before it simulates (on macOS, `xcode-select --install`). The web demo also needs Node.js 18 or later. We ran everything on macOS.

```bash
git clone https://github.com/ljmor/flywire-snn-stdp.git
cd flywire-snn-stdp
python3.14 -m venv env                   # Python 3.12 or later
source env/bin/activate
pip install -r requirements-lock.txt     # the exact versions behind our numbers
```

The two small FlyWire files are already in `data/raw/`. The connection table (212.1 MB) is above the 100 MB per-file limit of GitHub, so you have to download it from Codex, the FlyWire data portal, into the same folder. [`data/README.md`](data/README.md) explains how. Then run, from the root of the repository:

```bash
python 06-deployment/pipeline.py             # every stage, from the raw files to the figures
python 06-deployment/pipeline.py --quick     # skips the extra seeds and the robustness and energy scripts
python 06-deployment/verify_outputs.py       # checks the outputs
```

On our machine, an Apple M4, the full pipeline took 136.5 min and quick mode 46.0 min. Every result is already stored in the repository, so you can read the notebooks, or run them again, without running the experiment scripts. Even without the connection table, `python 06-deployment/pipeline.py --stages 3 4 5 6 --quick` re-runs the calibration, the main experiment and the notebooks of phases 03 to 05.

In the web demo a courtship song plays and three of the six networks listen to it at the same time. It runs locally with two commands.

```bash
cd 06-deployment/demo
npm ci              # installs the exact versions of package-lock.json
npm run dev         # local server at http://localhost:5173
```

The [reproduction guide](06-deployment/README.md) covers every stage, its run time, quick mode, the checks and the troubleshooting. The [demo README](06-deployment/demo/README.md) describes the page.

---

## Where to find each result

| Question | Where |
|---|---|
| Why this question, and why the ear of a fly? | [`01-problem-understanding/README.md`](01-problem-understanding/README.md) |
| Where does the circuit come from, and why these 1,239 neurons? | [Phase 02 results](02-data-understanding/results.md) |
| How were the parameters of the network chosen? | [Phase 03 results](03-data-preparation/results.md) |
| How does a song become spikes? | [Audio-encoding notebook](04-modeling/01-audio-encoding.ipynb) |
| What did each experiment give? | [Phase 04 results](04-modeling/results.md) |
| Which wiring wins, and by how much? | [Phase 05 results](05-evaluation/results.md) |
| Is it more energy-efficient than a conventional network? | [Comparison with conventional networks](04-modeling/results.md#11-comparison-with-conventional-networks). It is not, and the section explains why. |
| How did the project reach its current form? | the `research-log.md` of each phase, from [phase 02](02-data-understanding/research-log.md) to [phase 05](05-evaluation/research-log.md) |
| What could come next? | [Next steps](05-evaluation/results.md#next-steps-from-the-fly-to-low-power-devices) |
| How do I reproduce it all? | [Reproduction guide](06-deployment/README.md) |
| Can I see and hear it? | [Demo README](06-deployment/demo/README.md) |

---

## Data: FlyWire license and attribution

The connectome data come from FlyWire public release v783, downloaded from Codex (Matsliah et al., 2023) between August 25 and 28, 2026. FlyWire public-release data are licensed under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) (FlyWire, n.d.), which allows sharing them, with attribution, for non-commercial purposes. The two small files in `data/raw/` are unmodified copies. Everything we derived from them, starting with the JO subgraph in `data/processed/`, stays under the same license. The full notice, with the download date of each file, is in [`data/README.md`](data/README.md).

FlyWire was created at Princeton University with support from the US BRAIN Initiative (grants MH117815, MH129268 and U24 NS126935 to Murthy and Seung). FlyWire asks every user to cite Dorkenwald et al. (2024) and Schlegel et al. (2024), and each part of the data has its own references. For the files we use, these are Zheng et al. (2018) for the electron-microscopy volume, Buhmann et al. (2021) and Heinrich et al. (2018) for the synapses, Eckstein et al. (2024) for the neurotransmitters, Matsliah et al. (2024) and Deutsch et al. (2025) for the cell types, and Matsliah et al. (2023) for Codex.

---

## License

The code of this repository is released under the [MIT License](LICENSE). That covers `snnlib/`, the scripts, the code of the notebooks and the web demo.

The MIT License does not cover the data. The FlyWire files in `data/raw/` and everything derived from the connectome are distributed under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/), the license of FlyWire public-release data. That includes the subgraphs in `data/processed/` and `data/interim/`, the experiment outputs in `03-data-preparation/outputs/` and `04-modeling/outputs/`, the figures in `docs/figures/` and the data files of the demo in `06-deployment/demo/public/data/`. You may share and adapt them for non-commercial purposes, with attribution to FlyWire and to the publications listed above.

---

## How to cite

If you use this code or its results, please cite the repository.

> Mora, L., & Alvarez, J. (2026). *A spiking neural network wired like the auditory circuit of* Drosophila [Computer software]. Universidad Técnica Particular de Loja. https://github.com/ljmor/flywire-snn-stdp

[`CITATION.cff`](CITATION.cff) holds the same information in machine-readable form. If you use the data, please cite FlyWire as described above. If you run the simulations, please cite Brian2 (Stimberg et al., 2019) as well. The [data credits of the reproduction guide](06-deployment/README.md#10-data-credits-and-license) list the references of all the software the project uses.

---

## Authors

Luis Mora and Jean Alvarez\
Advisor: Alexandra Cristina Gonzáles Eras\
Undergraduate thesis project, Computer Science program, Universidad Técnica Particular de Loja (UTPL), Ecuador, 2026

We thank the FlyWire Consortium, whose members proofread and annotated the connectome, and the Princeton FlyWire team, which develops and maintains it.

---

## References

- Baker, C. A., McKellar, C., Pang, R., Nern, A., Dorkenwald, S., Pacheco, D. A., Eckstein, N., Funke, J., Dickson, B. J., & Murthy, M. (2022). Neural network organization for courtship-song feature detection in *Drosophila*. *Current Biology, 32*(15), 3317–3333.e7. https://doi.org/10.1016/j.cub.2022.06.019
- Bennet-Clark, H. C., & Ewing, A. W. (1969). Pulse interval as a critical parameter in the courtship song of *Drosophila melanogaster*. *Animal Behaviour, 17*(4), 755–759. https://doi.org/10.1016/S0003-3472(69)80023-0
- Buhmann, J., Sheridan, A., Malin-Mayor, C., Schlegel, P., Gerhard, S., Kazimiers, T., Krause, R., Nguyen, T. M., Heinrich, L., Lee, W.-C. A., Wilson, R., Saalfeld, S., Jefferis, G. S. X. E., Bock, D. D., Turaga, S. C., Cook, M., & Funke, J. (2021). Automatic detection of synaptic partners in a whole-brain *Drosophila* electron microscopy data set. *Nature Methods, 18*(7), 771–774. https://doi.org/10.1038/s41592-021-01183-7
- Chapman, P., Clinton, J., Kerber, R., Khabaza, T., Reinartz, T., Shearer, C., & Wirth, R. (2000). *CRISP-DM 1.0: Step-by-step data mining guide*. SPSS Inc. https://web.archive.org/web/20060207174803/http://www.crisp-dm.org/CRISPWP-0800.pdf
- Cohen, J. (2013). *Statistical power analysis for the behavioral sciences* (2nd ed.). Routledge. https://doi.org/10.4324/9780203771587 (Original work published 1988)
- Davies, M., Srinivasa, N., Lin, T.-H., Chinya, G., Cao, Y., Choday, S. H., Dimou, G., Joshi, P., Imam, N., Jain, S., Liao, Y., Lin, C.-K., Lines, A., Liu, R., Mathaikutty, D., McCoy, S., Paul, A., Tse, J., Venkataramanan, G., . . . Wang, H. (2018). Loihi: A neuromorphic manycore processor with on-chip learning. *IEEE Micro, 38*(1), 82–99. https://doi.org/10.1109/MM.2018.112130359
- Deutsch, D., Clemens, J., Thiberge, S. Y., Guan, G., & Murthy, M. (2019). Shared song detector neurons in *Drosophila* male and female brains drive sex-specific behaviors. *Current Biology, 29*(19), 3200–3215.e5. https://doi.org/10.1016/j.cub.2019.08.008
- Deutsch, D., Matsliah, A., Crown, A., Wang, K., Dorkenwald, S., Mondal, A., Jana, S., Burke, A., Hebditch, J., Gager, J., Normand, E., Wang, M., MkKellar, C., Yu, S.-c., Sterling, A., Schlegel, P., Gerhard, S., Sterne, G., Costa, M., . . . Murthy, M. (2025). *Sexually dimorphic neurons in the Drosophila whole-brain connectome* [Preprint]. bioRxiv. https://doi.org/10.1101/2025.06.10.658788
- Dhiman, N. (2026). *Topological sensitivity in connectome-constrained neural networks* (arXiv:2604.04033) [Preprint]. arXiv. https://doi.org/10.48550/arXiv.2604.04033
- Dorkenwald, S., Matsliah, A., Sterling, A. R., Schlegel, P., Yu, S.-c., McKellar, C. E., Lin, A., Costa, M., Eichler, K., Yin, Y., Silversmith, W., Schneider-Mizell, C., Jordan, C. S., Brittain, D., Halageri, A., Kuehner, K., Ogedengbe, O., Morey, R., Gager, J., . . . The FlyWire Consortium. (2024). Neuronal wiring diagram of an adult brain. *Nature, 634*(8032), 124–138. https://doi.org/10.1038/s41586-024-07558-y
- Eckstein, N., Bates, A. S., Champion, A., Du, M., Yin, Y., Schlegel, P., Lu, A. K.-Y., Rymer, T., Finley-May, S., Paterson, T., Parekh, R., Dorkenwald, S., Matsliah, A., Yu, S.-C., McKellar, C., Sterling, A., Eichler, K., Costa, M., Seung, S., . . . Funke, J. (2024). Neurotransmitter classification from electron microscopy images at synaptic sites in *Drosophila melanogaster*. *Cell, 187*(10), 2574–2594.e23. https://doi.org/10.1016/j.cell.2024.03.016
- Erdős, P., & Rényi, A. (1959). On random graphs I. *Publicationes Mathematicae Debrecen, 6*(3–4), 290–297. https://doi.org/10.5486/PMD.1959.6.3-4.12
- Fayyad, U., Piatetsky-Shapiro, G., & Smyth, P. (1996). From data mining to knowledge discovery in databases. *AI Magazine, 17*(3), 37–54. https://doi.org/10.1609/aimag.v17i3.1230
- FlyWire. (n.d.). *Citing guidelines for publishing with FlyWire*. Retrieved October 14, 2026, from https://flywire.ai/guidelines
- Heinrich, L., Funke, J., Pape, C., Nunez-Iglesias, J., & Saalfeld, S. (2018). Synaptic cleft segmentation in non-isotropic volume electron microscopy of the complete *Drosophila* brain. In *Medical image computing and computer assisted intervention – MICCAI 2018* (pp. 317–325). Springer. https://doi.org/10.1007/978-3-030-00934-2_36
- Horowitz, M. (2014). 1.1 Computing’s energy problem (and what we can do about it). In *2014 IEEE International Solid-State Circuits Conference Digest of Technical Papers (ISSCC)* (pp. 10–14). IEEE. https://doi.org/10.1109/ISSCC.2014.6757323
- Kyriacou, C. P., & Hall, J. C. (1980). Circadian rhythm mutations in *Drosophila melanogaster* affect short-term fluctuations in the male’s courtship song. *Proceedings of the National Academy of Sciences, 77*(11), 6729–6733. https://doi.org/10.1073/pnas.77.11.6729
- Matsliah, A., Sterling, A. R., Dorkenwald, S., Kuehner, K., Morey, R., Seung, H. S., & Murthy, M. (2023). *Codex: Connectome Data Explorer* [Preprint]. ResearchGate. https://doi.org/10.13140/RG.2.2.35928.67844
- Matsliah, A., Yu, S.-c., Kruk, K., Bland, D., Burke, A. T., Gager, J., Hebditch, J., Silverman, B., Willie, K. P., Willie, R., Sorek, M., Sterling, A. R., Kind, E., Garner, D., Sancer, G., Wernet, M. F., Kim, S. S., Murthy, M., Seung, H. S., & The FlyWire Consortium. (2024). Neuronal parts list and wiring diagram for a visual system. *Nature, 634*(8032), 166–180. https://doi.org/10.1038/s41586-024-07981-1
- Molloy, M., & Reed, B. (1995). A critical point for random graphs with a given degree sequence. *Random Structures & Algorithms, 6*(2–3), 161–180. https://doi.org/10.1002/rsa.3240060204
- Newman, M. E. J., Strogatz, S. H., & Watts, D. J. (2001). Random graphs with arbitrary degree distributions and their applications. *Physical Review E, 64*(2), Article 026118. https://doi.org/10.1103/PhysRevE.64.026118
- Patterson, R. D., Robinson, K., Holdsworth, J., McKeown, D., Zhang, C., & Allerhand, M. (1992). Complex sounds and auditory images. In Y. Cazals, L. Demany, & K. Horner (Eds.), *Auditory physiology and perception* (pp. 429–446). Pergamon. https://doi.org/10.1016/B978-0-08-041847-6.50054-X
- Pedregosa, F., Varoquaux, G., Gramfort, A., Michel, V., Thirion, B., Grisel, O., Blondel, M., Prettenhofer, P., Weiss, R., Dubourg, V., Vanderplas, J., Passos, A., Cournapeau, D., Brucher, M., Perrot, M., & Duchesnay, É. (2011). Scikit-learn: Machine learning in Python. *Journal of Machine Learning Research, 12*, 2825–2830. https://jmlr.org/papers/v12/pedregosa11a.html
- Roy, K., Jaiswal, A., & Panda, P. (2019). Towards spike-based machine intelligence with neuromorphic computing. *Nature, 575*(7784), 607–617. https://doi.org/10.1038/s41586-019-1677-2
- Schlegel, P., Yin, Y., Bates, A. S., Dorkenwald, S., Eichler, K., Brooks, P., Han, D. S., Gkantia, M., dos Santos, M., Munnelly, E. J., Badalamente, G., Serratosa Capdevila, L., Sane, V. A., Fragniere, A. M. C., Kiassat, L., Pleijzier, M. W., Stürner, T., Tamimi, I. F. M., Dunne, C. R., . . . Jefferis, G. S. X. E. (2024). Whole-brain annotation and multi-connectome cell typing of *Drosophila*. *Nature, 634*(8032), 139–152. https://doi.org/10.1038/s41586-024-07686-5
- Schuman, C. D., Kulkarni, S. R., Parsa, M., Mitchell, J. P., Date, P., & Kay, B. (2022). Opportunities for neuromorphic computing algorithms and applications. *Nature Computational Science, 2*(1), 10–19. https://doi.org/10.1038/s43588-021-00184-y
- Song, S., Miller, K. D., & Abbott, L. F. (2000). Competitive Hebbian learning through spike-timing-dependent synaptic plasticity. *Nature Neuroscience, 3*(9), 919–926. https://doi.org/10.1038/78829
- Stimberg, M., Brette, R., & Goodman, D. F. M. (2019). Brian 2, an intuitive and efficient neural simulator. *eLife, 8*, Article e47314. https://doi.org/10.7554/eLife.47314
- Zheng, Z., Lauritzen, J. S., Perlman, E., Robinson, C. G., Nichols, M., Milkie, D., Torrens, O., Price, J., Fisher, C. B., Sharifi, N., Calle-Schuler, S. A., Kmecova, L., Ali, I. J., Karsh, B., Trautman, E. T., Bogovic, J. A., Hanslovsky, P., Jefferis, G. S. X. E., Kazhdan, M., . . . Bock, D. D. (2018). A complete electron microscopy volume of the brain of adult *Drosophila melanogaster*. *Cell, 174*(3), 730–743.e22. https://doi.org/10.1016/j.cell.2018.06.019
- Zhou, C., Franconville, R., Vaughan, A. G., Robinett, C. C., Jayaraman, V., & Baker, B. S. (2015). Central neural circuitry mediating courtship song perception in male *Drosophila*. *eLife, 4*, Article e08477. https://doi.org/10.7554/eLife.08477
