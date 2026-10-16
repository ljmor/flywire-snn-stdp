# Interactive demo: the listening brain

This folder holds a web page that shows the main result of the project to readers with no background in neuroscience or computing. A **spiking neural network** (SNN) is a network of model neurons that talk to each other with brief electrical events, the **spikes**, as real neurons do. Ours is wired like the auditory circuit of the fruit fly *Drosophila melanogaster*. That wiring is copied from its **connectome**, the map of every neuron of a brain and of the connections between them, reconstructed from electron microscopy (Dorkenwald et al., 2024). The network learns with **spike-timing-dependent plasticity** (STDP), a local rule that strengthens a connection when the sending neuron fires just before the receiving one (Bi & Poo, 1998).

In one sentence, this is what the page shows. With the real wiring and STDP, the network tells the courtship songs of the fly apart better than control networks that are identical in everything except the wiring.

Everything that moves on the page comes from real simulated spikes. We did not draw any of the activity by hand.

---

## What the page shows

| Section | What it shows |
|---|---|
| **Hero** | The subgraph of Johnston's organ (1,239 neurons, FlyWire release v783) in 3D, firing in response to a song with a 35 ms interval. Johnston's organ is the hearing organ in the antenna of the fly. |
| **The song** | What the inter-pulse interval (IPI) is, the five songs of the experiment, and a game of six rounds in which the visitor tries to tell a typical *D. melanogaster* interval (35 ms) from one in the range of *D. simulans* (55 ms). |
| **The networks** | The real wiring next to a random one, in 3D and as an adjacency matrix, with two properties of each graph: clustering and reciprocal pairs. |
| **Live** | The lab. A song plays and three networks hear it at once. The page shows the artificial ear, the three networks in 3D, how well each one follows the rhythm, its spikes as a raster plot (one dot per spike, time against neuron) and its answer as the listening time grows. |
| **The decision** | The spike counts that the classifier reads, projected onto two dimensions, with one ellipse per song and the path of the song that is playing. |
| **The numbers** | Accuracy, the interaction between wiring and plasticity, latency, the difficulty gradient, spike efficiency and the paired contrasts. These are the statistics of the study. |
| **The conclusion** | The finding, where it might be useful, and what the work does **not** claim. |

The three networks of the lab are three of the six **arms** of the experiment (an arm is one combination of wiring and plasticity). One is the connectome with STDP. Another is the same connectome with frozen weights. The third is a random **Erdős–Rényi** graph with STDP (Erdős & Rényi, 1959). It keeps the number of neurons and of connections of each kind, but places the connections at random.

---

## Running it

You need Node.js 18 or later. The data and audio files are already generated in `public/`, so the page starts without simulating anything.

```bash
cd 06-deployment/demo
npm ci               # installs the exact versions of package-lock.json
npm run dev          # local server at http://localhost:5173

npm run build        # static site in dist/ (about 3.3 MB)
npm run preview      # serves dist/ to check it
```

`dist/` is a static site. Any static file server can host it, and so can services such as GitHub Pages, Netlify or Vercel.

> **Note.** The page has to be served over HTTP. Opening `dist/index.html` with a double click does not work, because the browser blocks reading the binary files from `file://`.

---

## What is measured and what is only shown

The page mixes two kinds of numbers, and it says which is which.

- **The lab and the decision map come from one simulation run, with one seed**, with the weights learned (where the network learns) and then frozen. Their clips last 2 s, longer than the 0.5 s presentations of the evaluation. They are there to show the mechanism. They do not prove anything on their own.
- **The statistics are in "The numbers".** They come from the evaluation of the project, with 15 independent seeds in the arms that learn and 5 in the static ones. A seed is the number that fixes the random draws of a run, so that the run can be repeated exactly. The full report is in [`05-evaluation/results.md`](../../05-evaluation/results.md). There, the connectome with STDP reaches an accuracy of 0.875 ± 0.039 (mean ± standard deviation across seeds) against 0.443 for the random network with the same rule. Chance is 0.200, since there are five songs.
- **The spike subsample uses the same fraction (40 %) in the three networks**, so the difference in density on screen is the real one. Over the five songs, the random network fires 489,394 spikes, about twice the 214,110 of the connectome with STDP and about four times the 121,049 of the frozen connectome. The simulation and every metric use all the spikes.
- **The 3D view draws a sample of 5,498 of the 20,059 connections** of each wiring, so that the structure can be seen. Each kind of connection (excitatory, inhibitory or modulatory) keeps its share of the sample, and heavier connections are more likely to be drawn. The simulation uses all of them.
- **The 3D layout comes from the real wiring and is the same for the three networks.** Depth mainly follows the number of steps from the input layer. The other two axes come from a spectral embedding of the graph, which places close together the neurons that share neighbors (Belkin & Niyogi, 2003). Between panels, only the connections and the spikes change.
- **Clustering and reciprocal pairs** in "The networks" are computed on the whole graph, not on the drawn sample. Clustering here is the global coefficient, which measures how often two neighbors of a neuron are also connected. It is 0.149 in the connectome and 0.026 in the random graph. The phase reports use a related measure, the mean clustering coefficient (0.1835 in the connectome). The connectome has 1,291 pairs of neurons connected in both directions; the random graph has 147.
- **The "separation" in the decision map is the silhouette score** of the five songs in the space of spike counts (Rousseeuw, 1987). It goes from −1 to +1, and above 0 the songs form separate groups. The map is a principal component projection of 50 test presentations (Pearson, 1901). The connectome with STDP scores +0.43, the frozen connectome −0.14 and the random network +0.02.

> **Connection and synapse are not the same here.** The graph has **20,059 connections**, that is, directed neuron → neuron pairs. The weight of each one is the number of synaptic contacts that form it, and those contacts add up to **338,013**. No connection has fewer than five contacts, the threshold chosen in phase 02. The page says "connections" for the pairs and keeps "synapses" for the contacts.

---

## Time on the page

The five WAV files last **exactly 2.0 s** (44,100 samples at 22,050 Hz), and every other file matches that length. The last song pulse comes at 1.98 s, the filterbank envelope has 100 frames at 50 frames per second, and the fine firing rate has 1,000 samples of 2 ms.

Wall-clock time runs longer than 2 s for two reasons, and the page says both.

- The clip plays **in a loop**, so it sounds without a gap. The counter of the card "What is playing" reads, for instance, `1.24 / 2.00 s · loop 6`.
- At **½× or ¼×**, those same 2 s of signal take 4 or 8 s to play. Every axis of the lab measures **signal time**, not clock time, and the note under the title gives the conversion when the speed is not 1×.

The song timeline has a tick every 0.5 s (every 1 s on narrow screens) and marks the end of the clip. Its dotted lines mark the integration windows of the readout. A window is the stretch of response that the readout counts before it decides. They are 100 ms, 250 ms, 500 ms and 1 s, and the verdicts also use the full 2 s.

---

## The data files

```
public/
  audio/song-{25,35,45,55,65}.wav   the five stimuli (88 kB each)
  data/meta.json                    about 210 kB
  data/network.bin                  about 175 kB
  data/spikes.bin                   about 1.3 MB
```

- **`meta.json`** holds the classes and the stimuli, with the times of the song pulses and the envelope of the 32 gammatone channels. For each network it stores the answers of the readout for five integration windows and the silhouette. It also stores the cloud of the decision map and the path of each song through it. The population rate every 2 ms and the measures of how well the network follows the rhythm close the file. Its keys are described in `src/data/types.ts`.
- **`network.bin`** holds the 3D positions and attributes of the 1,239 neurons, plus the drawable connections and the adjacency matrix of each wiring. The offsets of each block are in `meta.json` (`network.topologies`).
- **`spikes.bin`** holds the spike trains `(t, neuron)` of the three networks for the five songs, as 16-bit integers. The offset of each train is in `meta.json` (`spike_index`).

### Regenerating the files

`prepare_assets.py` documents how the files were built (`npm run assets` runs it). It needs a dump of the simulation, `outputs/demo_ipi.json`, which is **not included in this repository**. Without it, the script stops with a message that explains this. The page does not need the script, because the generated files are versioned.

We checked the part of the script that does not depend on the dump. Run again on the subgraph of `data/processed/`, it rebuilds the published `network.bin` with the same size, neuron attributes, drawn connections and graph statistics. The 3D positions are another matter. They change from one run to the next, and the order of the adjacency matrices changes with them. The reason is that the eigenvalue solver of the spectral embedding starts from a random vector. The published layout is one of those runs, and we keep it.

---

## Code layout

```
src/
  main.tsx                entry point
  App.tsx                 data loading, playback engine and sections
  data/
    types.ts              format of meta.json, network.bin and spikes.bin
    load.ts               reading and mapping the binary files (no copies)
    constants.ts          numbers of the study, with the report section they come from
  core/
    engine.ts             single clock for the audio, the 3D views, the raster and the verdicts
    util.ts               hooks for size, visibility and drawing loops; number formatters
  three/
    Brain.tsx             one network in 3D: points that glow with each spike, plus connections
    Scene.tsx             WebGL canvas with drag, inertia and a pause when off screen
  components/
    Hero.tsx  Lab.tsx  sections.tsx
    canvases.tsx          the six kinds of 2D drawing (canvas)
    charts.tsx            the five result charts (SVG)
    ui.tsx                shared pieces and icons
  styles/
    base.css              visual system and design tokens
    components.css        styles per component
```

**The clock does not go through React.** `engine.clock` is a mutable object that the drawing loops read 60 times per second. React only hears about discrete changes, such as the chosen song, play and pause, or the speed. That is why the page does not re-render 60 times per second, even with 4 WebGL canvases and 14 2D canvases on it.

**WebGL canvases freeze when they leave the screen** (`frameloop="never"`) instead of being unmounted, so scrolling does not rebuild the geometry.

The simulations behind the page were run with Brian2 (Stimberg et al., 2019). The page itself is built with React, Three.js and Vite, at the versions fixed in `package-lock.json`.

---

## Design and accessibility

- The three series colors, one per network, were chosen for a dark background. We checked that they stay within a band of lightness, keep a minimum chroma, remain distinct for the common forms of color-vision deficiency, and contrast enough with the background. All four checks pass.
- The five songs are a **magnitude**, not categories, so they share an ordinal amber ramp.
- On the decision map, color never works alone. Each cloud also has its ellipse and a number.
- In the charts, the arms that do not appear in the lab are drawn in neutral ink and labeled directly, so that they do not use up a series color.
- The page respects `prefers-reduced-motion`: the automatic rotation and the transitions stop.
- Touch targets are between 38 and 46 px tall. Focus is always visible, there is a link to skip to the lab, tables have headers, and the canvases have text alternatives.
- The audio **never** starts when the page opens. It starts the first time the interactive zone comes into view and stops when it leaves. The space bar plays and pauses.
- If the browser blocks autoplay, the simulation keeps running against its own clock and the page says so.
- Dragging the 3D views does not capture the vertical scroll of the page.

---

## Credits and license

Luis Mora and Jean Alvarez · Advisor: Alexandra Cristina Gonzáles Eras · Universidad Técnica Particular de Loja, 2026.

The connectome of *Drosophila melanogaster* comes from **FlyWire**, public release **v783** (Dorkenwald et al., 2024; Schlegel et al., 2024). FlyWire was created at Princeton University with support from the US BRAIN Initiative (grants MH117815, MH129268 and U24 NS126935 to Murthy and Seung). Its data are licensed under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) (FlyWire, n.d.), and so are the files of `public/data/`, which derive from them. Using the FlyWire resource also requires citing the publication behind each part of the data. The connectome was traced in the electron-microscopy volume of Zheng et al. (2018). The synapses were detected with the methods of Buhmann et al. (2021) and Heinrich et al. (2018), and the neurotransmitters were predicted by Eckstein et al. (2024). The cell types come from Matsliah et al. (2024) and Deutsch et al. (2025). The files were downloaded from Codex (Matsliah et al., 2023). The full data notice is in [`data/README.md`](../../data/README.md).

The species cue that the songs imitate, the inter-pulse interval, is about 34 ms in *D. melanogaster* and longer in *D. simulans* (Bennet-Clark & Ewing, 1969; Deutsch et al., 2019; Kyriacou & Hall, 1980).

---

## References

- Belkin, M., & Niyogi, P. (2003). Laplacian eigenmaps for dimensionality reduction and data representation. *Neural Computation, 15*(6), 1373–1396. https://doi.org/10.1162/089976603321780317
- Bennet-Clark, H. C., & Ewing, A. W. (1969). Pulse interval as a critical parameter in the courtship song of *Drosophila melanogaster*. *Animal Behaviour, 17*(4), 755–759. https://doi.org/10.1016/S0003-3472(69)80023-0
- Bi, G.-q., & Poo, M.-m. (1998). Synaptic modifications in cultured hippocampal neurons: Dependence on spike timing, synaptic strength, and postsynaptic cell type. *The Journal of Neuroscience, 18*(24), 10464–10472. https://doi.org/10.1523/JNEUROSCI.18-24-10464.1998
- Buhmann, J., Sheridan, A., Malin-Mayor, C., Schlegel, P., Gerhard, S., Kazimiers, T., Krause, R., Nguyen, T. M., Heinrich, L., Lee, W.-C. A., Wilson, R., Saalfeld, S., Jefferis, G. S. X. E., Bock, D. D., Turaga, S. C., Cook, M., & Funke, J. (2021). Automatic detection of synaptic partners in a whole-brain *Drosophila* electron microscopy data set. *Nature Methods, 18*(7), 771–774. https://doi.org/10.1038/s41592-021-01183-7
- Deutsch, D., Clemens, J., Thiberge, S. Y., Guan, G., & Murthy, M. (2019). Shared song detector neurons in *Drosophila* male and female brains drive sex-specific behaviors. *Current Biology, 29*(19), 3200–3215.e5. https://doi.org/10.1016/j.cub.2019.08.008
- Deutsch, D., Matsliah, A., Crown, A., Wang, K., Dorkenwald, S., Mondal, A., Jana, S., Burke, A., Hebditch, J., Gager, J., Normand, E., Wang, M., MkKellar, C., Yu, S.-c., Sterling, A., Schlegel, P., Gerhard, S., Sterne, G., Costa, M., . . . Murthy, M. (2025). *Sexually dimorphic neurons in the Drosophila whole-brain connectome* [Preprint]. bioRxiv. https://doi.org/10.1101/2025.06.10.658788
- Dorkenwald, S., Matsliah, A., Sterling, A. R., Schlegel, P., Yu, S.-c., McKellar, C. E., Lin, A., Costa, M., Eichler, K., Yin, Y., Silversmith, W., Schneider-Mizell, C., Jordan, C. S., Brittain, D., Halageri, A., Kuehner, K., Ogedengbe, O., Morey, R., Gager, J., . . . The FlyWire Consortium. (2024). Neuronal wiring diagram of an adult brain. *Nature, 634*(8032), 124–138. https://doi.org/10.1038/s41586-024-07558-y
- Eckstein, N., Bates, A. S., Champion, A., Du, M., Yin, Y., Schlegel, P., Lu, A. K.-Y., Rymer, T., Finley-May, S., Paterson, T., Parekh, R., Dorkenwald, S., Matsliah, A., Yu, S.-C., McKellar, C., Sterling, A., Eichler, K., Costa, M., Seung, S., . . . Funke, J. (2024). Neurotransmitter classification from electron microscopy images at synaptic sites in *Drosophila melanogaster*. *Cell, 187*(10), 2574–2594.e23. https://doi.org/10.1016/j.cell.2024.03.016
- Erdős, P., & Rényi, A. (1959). On random graphs I. *Publicationes Mathematicae Debrecen, 6*(3–4), 290–297. https://doi.org/10.5486/PMD.1959.6.3-4.12
- FlyWire. (n.d.). *Citing guidelines for publishing with FlyWire*. Retrieved October 14, 2026, from https://flywire.ai/guidelines
- Heinrich, L., Funke, J., Pape, C., Nunez-Iglesias, J., & Saalfeld, S. (2018). Synaptic cleft segmentation in non-isotropic volume electron microscopy of the complete *Drosophila* brain. In *Medical image computing and computer assisted intervention – MICCAI 2018* (pp. 317–325). Springer. https://doi.org/10.1007/978-3-030-00934-2_36
- Kyriacou, C. P., & Hall, J. C. (1980). Circadian rhythm mutations in *Drosophila melanogaster* affect short-term fluctuations in the male’s courtship song. *Proceedings of the National Academy of Sciences, 77*(11), 6729–6733. https://doi.org/10.1073/pnas.77.11.6729
- Matsliah, A., Sterling, A. R., Dorkenwald, S., Kuehner, K., Morey, R., Seung, H. S., & Murthy, M. (2023). *Codex: Connectome Data Explorer* [Preprint]. ResearchGate. https://doi.org/10.13140/RG.2.2.35928.67844
- Matsliah, A., Yu, S.-c., Kruk, K., Bland, D., Burke, A. T., Gager, J., Hebditch, J., Silverman, B., Willie, K. P., Willie, R., Sorek, M., Sterling, A. R., Kind, E., Garner, D., Sancer, G., Wernet, M. F., Kim, S. S., Murthy, M., Seung, H. S., & The FlyWire Consortium. (2024). Neuronal parts list and wiring diagram for a visual system. *Nature, 634*(8032), 166–180. https://doi.org/10.1038/s41586-024-07981-1
- Pearson, K. (1901). LIII. On lines and planes of closest fit to systems of points in space. *The London, Edinburgh, and Dublin Philosophical Magazine and Journal of Science, 2*(11), 559–572. https://doi.org/10.1080/14786440109462720
- Rousseeuw, P. J. (1987). Silhouettes: A graphical aid to the interpretation and validation of cluster analysis. *Journal of Computational and Applied Mathematics, 20*, 53–65. https://doi.org/10.1016/0377-0427(87)90125-7
- Schlegel, P., Yin, Y., Bates, A. S., Dorkenwald, S., Eichler, K., Brooks, P., Han, D. S., Gkantia, M., dos Santos, M., Munnelly, E. J., Badalamente, G., Serratosa Capdevila, L., Sane, V. A., Fragniere, A. M. C., Kiassat, L., Pleijzier, M. W., Stürner, T., Tamimi, I. F. M., Dunne, C. R., . . . Jefferis, G. S. X. E. (2024). Whole-brain annotation and multi-connectome cell typing of *Drosophila*. *Nature, 634*(8032), 139–152. https://doi.org/10.1038/s41586-024-07686-5
- Stimberg, M., Brette, R., & Goodman, D. F. M. (2019). Brian 2, an intuitive and efficient neural simulator. *eLife, 8*, Article e47314. https://doi.org/10.7554/eLife.47314
- Zheng, Z., Lauritzen, J. S., Perlman, E., Robinson, C. G., Nichols, M., Milkie, D., Torrens, O., Price, J., Fisher, C. B., Sharifi, N., Calle-Schuler, S. A., Kmecova, L., Ali, I. J., Karsh, B., Trautman, E. T., Bogovic, J. A., Hanslovsky, P., Jefferis, G. S. X. E., Kazhdan, M., . . . Bock, D. D. (2018). A complete electron microscopy volume of the brain of adult *Drosophila melanogaster*. *Cell, 174*(3), 730–743.e22. https://doi.org/10.1016/j.cell.2018.06.019
