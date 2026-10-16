# Phase 01: problem understanding

This is the first phase of the project, and this document is all it contains. It explains the problem the repository works on and why we chose the fruit fly and its ear to study it. Then come the research question, the hypothesis, the objectives, the task, how we judge the answer and where the study stops. A map of the whole repository closes it. The results themselves come later, in phases 02 to 05, and the [repository README](../README.md) summarizes them.

---

## 1. Background

### Spiking neural networks

Most artificial neural networks pass continuous numbers from one unit to the next. In a **spiking neural network** (SNN) the neurons communicate through **spikes** instead, brief electrical events in time, as real neurons do. Maass (1997) called these networks the third generation of neural network models, after the networks of threshold units and those with continuous activation functions.

Spiking networks interest us because of **edge AI**, machine learning that runs inside small, battery-powered devices instead of sending the data to the cloud. Neuromorphic computing promises artificial intelligence with lower energy requirements (Roy et al., 2019). A **neuromorphic chip** is hardware built to run spiking networks, and it spends energy only when spikes occur. Such systems can often run on orders of magnitude less power than conventional computers (Schuman et al., 2022).

How to wire and train these networks is still an open problem. Loihi supports programmable on-chip learning rules (Davies et al., 2018), and SpiNNaker runs plasticity rules such as STDP in software on its processor cores (Furber et al., 2014). Even so, networks for these chips are usually trained offline, built by hand for a task, or connected at random, as in reservoir computing, where a random network stays fixed and only its output is trained (Schuman et al., 2022).

**Spike-timing-dependent plasticity** (STDP) is the learning rule we study. It strengthens a connection when the sending neuron fires just before the receiving one and weakens it when the order is reversed (Song et al., 2000). The effect was measured in cultured hippocampal neurons (Bi & Poo, 1998). STDP is a local rule. Each connection changes with the timing of the spikes of the two neurons it joins. No error signal has to travel back from the output, so the change can be computed where the connection is. A local rule, though, only learns what the wiring lets it learn. Which wiring gives it something useful to work with?

### Connectomes as a source of wiring

A **connectome** is a map of the neurons of a brain and of the connections between them, reconstructed from electron-microscopy images. FlyWire has produced one for the whole brain of an adult fruit fly, *Drosophila melanogaster* (Dorkenwald et al., 2024; Schlegel et al., 2024). It was traced in a complete electron-microscopy volume of that brain (Zheng et al., 2018). Its public release v783 contains 139,255 neurons and about 54.5 million synapses, the single points where one neuron passes a signal to another.

Several groups have already built models on connectomes. Shiu et al. (2024) turned the whole FlyWire brain into a network of leaky integrate-and-fire neurons, model neurons that add up their input, slowly leak it and fire when their voltage crosses a threshold. The weights were fixed by the connectome, and the model was simulated in the Brian2 simulator. Their model predicts the effects of activating many cell types. Lappalainen et al. (2024) showed that networks constrained by the connectome of the fly visual system predict neural activity across that system. Suárez et al. (2021) studied how the structure of a connectome shapes what a network wired with it can learn to compute.

Our question is narrower. Does the wiring of a real circuit help a spiking network that learns with a local rule, compared with random networks of the same size? There is a methodological trap in this kind of comparison. A recent preprint, not yet peer reviewed, argues that topology advantages reported for connectome-constrained networks can come from how the networks are initialized and from weak random controls (Dhiman, 2026). According to it, they largely disappear when the controls preserve degrees. The **degree** of a neuron is the number of connections that enter or leave it. That is why the strictest of our controls keeps the degree of every neuron.

### Why the fly's ear

The fruit fly has a complete and public connectome of an adult brain. The wiring we copy is therefore the real one, and anyone can check it. Within that brain we needed a small circuit, one we could simulate many times. Its input had to be a signal with a meaning, and the task had to depend on timing.

**Johnston's organ** (JO) meets those needs. It is the fly's ear, an organ in the antenna whose sensory neurons respond when sound or air currents move the antenna. Its subgroups A and B are the ones sensitive to vibration and sound (Kamikouchi et al., 2009). The JO neurons and the neurons they connect to form a circuit of 1,239 neurons and 20,059 connections when only the connections of at least five synapses are kept. One computer can simulate it many times over.

The sound this ear hears matters to the fly. A male courts with a pulse song, a train of brief clicks called song pulses. The interval between them is one of the main cues a female uses to recognize her species (Bennet-Clark & Ewing, 1969; Kyriacou & Hall, 1980). The neural pathway that processes the song has been studied in detail, from the ear to central neurons tuned to it (Baker et al., 2022; Clemens et al., 2015; Zhou et al., 2015). The interval is a matter of timing, and timing is what spikes carry and what STDP responds to.

---

## 2. Research question and hypothesis

> Does a spiking neural network wired like the auditory circuit of the *Drosophila melanogaster* connectome, and trained with STDP, classify more accurately and with fewer spikes than networks with equivalent artificial wiring on the same task?

"Equivalent artificial wiring" means two random networks with the same number of neurons and of connections. One of them also keeps the degree of every neuron.

We started from the hypothesis that it does. Trained with STDP, the biological wiring would classify more accurately than artificial wiring of the same size, and spend fewer spikes. The answer, summarized in [Key results](../README.md#key-results), turned out more specific than that.

---

## 3. Objectives

**General objective.** To develop and evaluate a simulation framework for an auditory classification task. It compares a spiking network wired like the auditory circuit of the fly connectome with spiking networks of artificial wiring, with and without STDP.

**Specific objectives.**

| Objective | Where it is addressed |
|---|---|
| Extract the auditory subgraph of Johnston's organ from the connectome and describe its topology, cell types and polarities | [phase 02](../02-data-understanding/results.md) |
| Encode sound as spike trains, with an artificial ear that turns a song into the input of the network | [audio-encoding notebook](../04-modeling/01-audio-encoding.ipynb), phase 04 |
| Build the spiking networks in Brian2, the connectome and its controls with equivalent artificial wiring, with leaky integrate-and-fire neurons and STDP, and calibrate them | [phase 03](../03-data-preparation/results.md) and [phase 04](../04-modeling/results.md) |
| Compare the spiking networks with one another in accuracy, learning speed, spike efficiency, selectivity and weight stability | [phase 05](../05-evaluation/results.md), with the experiments of phase 04 |
| Make the whole pipeline public and reproducible | [phase 06](../06-deployment/README.md) |

The fourth objective is the evaluation objective, and it also sets the reach of the conclusions. Learning speed is how many training examples the readout needs, the simple classifier that names the song from the spike counts of the network. Spike efficiency is the number of spikes per correct classification. Selectivity says how much the response concentrates on a few neurons, and weight stability whether the weights settle by the end of training. All of these compare spiking networks with one another. We also compared the spiking networks with conventional neural networks, to see how far the conclusions reach, but that comparison is outside the objectives.

---

## 4. The task

The networks hear synthetic courtship songs and have to say which one is playing. The songs differ only in their **inter-pulse interval** (IPI), the time between two consecutive pulses, which is 25, 35, 45, 55 or 65 ms. The 35 ms song is typical of *D. melanogaster*, whose interval is about 34 ms. The 55 ms song falls in the range reported for its sister species *D. simulans* (Deutsch et al., 2019).

The network covers only the first stage of the song pathway, the JO neurons and their direct partners. In the fly, selectivity for the interval appears further downstream (Baker et al., 2022; Zhou et al., 2015). Classifying the interval is therefore a proxy task that we impose on this circuit, not a function known to happen there.

With five classes, guessing gets one answer in five right, so the **chance level** is 0.200. Before comparing networks we measure how much the input already solves. The same readout applied to the input neurons alone, with no network in between, reaches 0.223. We call this the **input-only ceiling**. The readout counts spikes without looking at when they occur, which is why the ceiling stays this low. Anything a network scores above it is computed by the network.

We did not start with this task. An earlier version of the project asked the networks to classify pure tones, and the input layer alone already solved that task perfectly, so no network could improve on it. Since then every experiment reports the input-only ceiling, and the song interval replaced the tones. The full story is in [Why this task and not pure tones](../04-modeling/results.md#why-this-task-and-not-pure-tones).

---

## 5. How we judge the answer

The evaluation in phases 04 and 05 accepts an advantage of the connectome only when several conditions hold.

A network counts as computing something only if it scores above the input-only ceiling, not just above chance. Every network is calibrated to the same **operating point** before it learns, a mean firing rate of 10 Hz, so that no network wins simply by firing more. The networks are then compared in **arms**, each a combination of wiring (the connectome or one of the two controls) and plasticity (static, or with STDP together with a winner-take-all inhibition that lets a few neurons specialize). Each arm is repeated with several **seeds**, the numbers that fix the random draws of a run.

Two arms are compared seed by seed with a two-sided paired t-test. Its **p-value** is the probability of a difference at least this large if there were none. We call a difference significant when that value is below 0.05, and we give its size as Cohen's d, the difference measured in standard deviations. The comparison that decides is the one against the control that keeps the degree of every neuron.

Efficiency is judged by the spikes each correct answer costs, not by accuracy alone. Finally, the result has to survive a change of seed. It also has to survive other assignments of the sound channels to the input neurons, and other contact thresholds for the circuit.

---

## 6. Scope

The study compares spiking networks with one another, on one circuit and one task, in simulation. Several questions stay outside it.

- **Energy against conventional networks.** We do not claim that the spiking network saves energy compared with a conventional neural network. Phase 04 checked it on this task and found the opposite, as its [comparison with conventional networks](../04-modeling/results.md#11-comparison-with-conventional-networks) explains. The energy argument for spiking networks stays a motivation from the literature.
- **The biological function of the circuit.** The task is a proxy, so the results say how useful this wiring is for a learning network. They do not say what the circuit does in the fly.
- **Hardware.** Nothing runs on a neuromorphic chip. The networks are simulated in Brian2 (Stimberg et al., 2019).
- **Biological detail.** The model has no synaptic delays and treats both ears as one input layer, and the songs are synthetic. Each phase report lists the limitations that apply to it.
- **Statistical reach.** The p-values are not corrected for multiple comparisons, and the effect of plasticity includes the winner-take-all inhibition, which only the plastic arms have. The [results of phase 05](../05-evaluation/results.md#scope-and-limitations) give the details.

---

## 7. The repository as CRISP-DM and KDD

The repository follows CRISP-DM, the Cross-Industry Standard Process for Data Mining, whose six phases give the folders their names (Chapman et al., 2000). Its first phase is called business understanding, and here it is the research problem. The table also maps each phase onto the steps of knowledge discovery in databases (KDD) described by Fayyad et al. (1996). In KDD the steps are the selection of the target data, preprocessing, transformation, data mining, interpretation and evaluation, and putting the discovered knowledge to use.

| Phase | Folder | KDD step | Main products |
|---|---|---|---|
| 1. Business understanding (the research problem) | `01-problem-understanding/` | understanding the domain and the goal | this document |
| 2. Data understanding | [`02-data-understanding/`](../02-data-understanding/results.md) | selection of the target data | the JO subgraph in `data/processed/` and its exploratory analysis |
| 3. Data preparation | [`03-data-preparation/`](../03-data-preparation/results.md) | preprocessing and transformation | the calibrated network, with its operating point and inhibition sweep in `outputs/` |
| 4. Modeling | [`04-modeling/`](../04-modeling/results.md) | data mining | the experiment scripts and their outputs |
| 5. Evaluation | [`05-evaluation/`](../05-evaluation/results.md) | interpretation and evaluation | the statistical comparison of the six arms and the next steps |
| 6. Deployment | [`06-deployment/`](../06-deployment/README.md) | putting the discovered knowledge to use | the pipeline, the output checks, the reproduction guide and the web demo |

Three folders serve every phase. [`data/`](../data/README.md) stores the FlyWire files and the subgraph, `snnlib/` is the library that all notebooks and scripts import, and `docs/figures/` holds the figures, each named after the phase that draws it.

---

## References

- Baker, C. A., McKellar, C., Pang, R., Nern, A., Dorkenwald, S., Pacheco, D. A., Eckstein, N., Funke, J., Dickson, B. J., & Murthy, M. (2022). Neural network organization for courtship-song feature detection in *Drosophila*. *Current Biology, 32*(15), 3317–3333.e7. https://doi.org/10.1016/j.cub.2022.06.019
- Bennet-Clark, H. C., & Ewing, A. W. (1969). Pulse interval as a critical parameter in the courtship song of *Drosophila melanogaster*. *Animal Behaviour, 17*(4), 755–759. https://doi.org/10.1016/S0003-3472(69)80023-0
- Bi, G.-q., & Poo, M.-m. (1998). Synaptic modifications in cultured hippocampal neurons: Dependence on spike timing, synaptic strength, and postsynaptic cell type. *The Journal of Neuroscience, 18*(24), 10464–10472. https://doi.org/10.1523/JNEUROSCI.18-24-10464.1998
- Chapman, P., Clinton, J., Kerber, R., Khabaza, T., Reinartz, T., Shearer, C., & Wirth, R. (2000). *CRISP-DM 1.0: Step-by-step data mining guide*. SPSS Inc. https://web.archive.org/web/20060207174803/http://www.crisp-dm.org/CRISPWP-0800.pdf
- Clemens, J., Girardin, C. C., Coen, P., Guan, X.-J., Dickson, B. J., & Murthy, M. (2015). Connecting neural codes with behavior in the auditory system of *Drosophila*. *Neuron, 87*(6), 1332–1343. https://doi.org/10.1016/j.neuron.2015.08.014
- Davies, M., Srinivasa, N., Lin, T.-H., Chinya, G., Cao, Y., Choday, S. H., Dimou, G., Joshi, P., Imam, N., Jain, S., Liao, Y., Lin, C.-K., Lines, A., Liu, R., Mathaikutty, D., McCoy, S., Paul, A., Tse, J., Venkataramanan, G., . . . Wang, H. (2018). Loihi: A neuromorphic manycore processor with on-chip learning. *IEEE Micro, 38*(1), 82–99. https://doi.org/10.1109/MM.2018.112130359
- Deutsch, D., Clemens, J., Thiberge, S. Y., Guan, G., & Murthy, M. (2019). Shared song detector neurons in *Drosophila* male and female brains drive sex-specific behaviors. *Current Biology, 29*(19), 3200–3215.e5. https://doi.org/10.1016/j.cub.2019.08.008
- Dhiman, N. (2026). *Topological sensitivity in connectome-constrained neural networks* (arXiv:2604.04033) [Preprint]. arXiv. https://doi.org/10.48550/arXiv.2604.04033
- Dorkenwald, S., Matsliah, A., Sterling, A. R., Schlegel, P., Yu, S.-c., McKellar, C. E., Lin, A., Costa, M., Eichler, K., Yin, Y., Silversmith, W., Schneider-Mizell, C., Jordan, C. S., Brittain, D., Halageri, A., Kuehner, K., Ogedengbe, O., Morey, R., Gager, J., . . . The FlyWire Consortium. (2024). Neuronal wiring diagram of an adult brain. *Nature, 634*(8032), 124–138. https://doi.org/10.1038/s41586-024-07558-y
- Fayyad, U., Piatetsky-Shapiro, G., & Smyth, P. (1996). From data mining to knowledge discovery in databases. *AI Magazine, 17*(3), 37–54. https://doi.org/10.1609/aimag.v17i3.1230
- Furber, S. B., Galluppi, F., Temple, S., & Plana, L. A. (2014). The SpiNNaker project. *Proceedings of the IEEE, 102*(5), 652–665. https://doi.org/10.1109/JPROC.2014.2304638
- Kamikouchi, A., Inagaki, H. K., Effertz, T., Hendrich, O., Fiala, A., Göpfert, M. C., & Ito, K. (2009). The neural basis of *Drosophila* gravity-sensing and hearing. *Nature, 458*(7235), 165–171. https://doi.org/10.1038/nature07810
- Kyriacou, C. P., & Hall, J. C. (1980). Circadian rhythm mutations in *Drosophila melanogaster* affect short-term fluctuations in the male’s courtship song. *Proceedings of the National Academy of Sciences, 77*(11), 6729–6733. https://doi.org/10.1073/pnas.77.11.6729
- Lappalainen, J. K., Tschopp, F. D., Prakhya, S., McGill, M., Nern, A., Shinomiya, K., Takemura, S.-y., Gruntman, E., Macke, J. H., & Turaga, S. C. (2024). Connectome-constrained networks predict neural activity across the fly visual system. *Nature, 634*(8036), 1132–1140. https://doi.org/10.1038/s41586-024-07939-3
- Maass, W. (1997). Networks of spiking neurons: The third generation of neural network models. *Neural Networks, 10*(9), 1659–1671. https://doi.org/10.1016/S0893-6080(97)00011-7
- Roy, K., Jaiswal, A., & Panda, P. (2019). Towards spike-based machine intelligence with neuromorphic computing. *Nature, 575*(7784), 607–617. https://doi.org/10.1038/s41586-019-1677-2
- Schlegel, P., Yin, Y., Bates, A. S., Dorkenwald, S., Eichler, K., Brooks, P., Han, D. S., Gkantia, M., dos Santos, M., Munnelly, E. J., Badalamente, G., Serratosa Capdevila, L., Sane, V. A., Fragniere, A. M. C., Kiassat, L., Pleijzier, M. W., Stürner, T., Tamimi, I. F. M., Dunne, C. R., . . . Jefferis, G. S. X. E. (2024). Whole-brain annotation and multi-connectome cell typing of *Drosophila*. *Nature, 634*(8032), 139–152. https://doi.org/10.1038/s41586-024-07686-5
- Schuman, C. D., Kulkarni, S. R., Parsa, M., Mitchell, J. P., Date, P., & Kay, B. (2022). Opportunities for neuromorphic computing algorithms and applications. *Nature Computational Science, 2*(1), 10–19. https://doi.org/10.1038/s43588-021-00184-y
- Shiu, P. K., Sterne, G. R., Spiller, N., Franconville, R., Sandoval, A., Zhou, J., Simha, N., Kang, C. H., Yu, S., Kim, J. S., Dorkenwald, S., Matsliah, A., Schlegel, P., Yu, S.-c., McKellar, C. E., Sterling, A., Costa, M., Eichler, K., Bates, A. S., . . . Scott, K. (2024). A *Drosophila* computational brain model reveals sensorimotor processing. *Nature, 634*(8032), 210–219. https://doi.org/10.1038/s41586-024-07763-9
- Song, S., Miller, K. D., & Abbott, L. F. (2000). Competitive Hebbian learning through spike-timing-dependent synaptic plasticity. *Nature Neuroscience, 3*(9), 919–926. https://doi.org/10.1038/78829
- Stimberg, M., Brette, R., & Goodman, D. F. M. (2019). Brian 2, an intuitive and efficient neural simulator. *eLife, 8*, Article e47314. https://doi.org/10.7554/eLife.47314
- Suárez, L. E., Richards, B. A., Lajoie, G., & Misic, B. (2021). Learning function from structure in neuromorphic networks. *Nature Machine Intelligence, 3*(9), 771–786. https://doi.org/10.1038/s42256-021-00376-1
- Zheng, Z., Lauritzen, J. S., Perlman, E., Robinson, C. G., Nichols, M., Milkie, D., Torrens, O., Price, J., Fisher, C. B., Sharifi, N., Calle-Schuler, S. A., Kmecova, L., Ali, I. J., Karsh, B., Trautman, E. T., Bogovic, J. A., Hanslovsky, P., Jefferis, G. S. X. E., Kazhdan, M., . . . Bock, D. D. (2018). A complete electron microscopy volume of the brain of adult *Drosophila melanogaster*. *Cell, 174*(3), 730–743.e22. https://doi.org/10.1016/j.cell.2018.06.019
- Zhou, C., Franconville, R., Vaughan, A. G., Robinett, C. C., Jayaraman, V., & Baker, B. S. (2015). Central neural circuitry mediating courtship song perception in male *Drosophila*. *eLife, 4*, Article e08477. https://doi.org/10.7554/eLife.08477
