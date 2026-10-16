# Phase 06: deployment and reproduction guide

This phase packages the project so that anyone can regenerate its results from the raw data. It is the last phase of CRISP-DM, the Cross-Industry Standard Process for Data Mining, whose phases give this repository its folder structure (Chapman et al., 2000). In the knowledge discovery in databases (KDD) process, the same step is called putting the discovered knowledge to use (Fayyad et al., 1996).

A short reminder of what is being reproduced. The project builds a spiking neural network (SNN), a network whose neurons communicate through brief electrical events called spikes. Its wiring is copied from the connectome of the fruit fly *Drosophila melanogaster*. A connectome is the map of the neurons of a brain and of the connections between them; ours comes from FlyWire, the public connectome of a complete adult fly brain. We keep only the part around the Johnston's organ (JO), the fly's ear: its auditory neurons and the neurons they connect to. That piece of the connectome is the JO subgraph. The network learns with spike-timing-dependent plasticity (STDP), a local learning rule, and has to tell apart five rhythms of the courtship song. Two random networks of the same size serve as controls. The question and the results are in the [repository README](../README.md). This guide only explains how to reproduce them.

The heart of the phase is a pipeline, a chain of steps that goes from the raw files to the final figures. One script, the orchestrator, runs the steps in order. We call each step a stage.

| File | What it does |
|---|---|
| `pipeline.py` | runs the seven stages of the project in order, numbered 0 to 6 |
| `verify_outputs.py` | checks the outputs once the pipeline has finished |
| `demo/` | interactive web page that plays the songs to three of the six networks |
| `README.md` | this guide |
| `../requirements.txt`, `../requirements-lock.txt` | the Python packages, with minimum and with exact versions (Section 2) |

## 1. Requirements

- **Python 3.12 or later.** Brian2 2.10.1, the simulator that runs the network (Stimberg et al., 2019), does not install on older versions. We used Python 3.14.6, and that is the version to choose if you want our exact numbers.
- **A C++ compiler.** Brian2 turns the model equations into code when the simulation starts. `snnlib/network.py` sets its code-generation target to Cython, a tool that translates Python-like code into C or C++. Brian2 then compiles that code with a C++ compiler. On macOS that is `clang`, which comes with the Xcode Command Line Tools (`xcode-select --install`); on Linux it is `g++`. There is no fallback to slower pure-Python code. When we hid the compiler, the first simulation stopped with a `BrianObjectException`. Brian2 keeps the compiled models in a cache, so each model is compiled only once.
- **Disk space.** A fresh clone takes 12.4 MB. The connection table that you download adds 212.1 MB. The threshold sweep of phase 04 writes another 12.6 MB of subgraphs to `data/interim/`, and the Python environment needs 1.37 GB.
- **Memory.** The full pipeline ran on our 16 GB machine. We measured memory during a quick run, sampling every 5 s. All the processes of the pipeline together never went above 2.2 GB, and the largest single one, `run_experiments.py`, reached 1.7 GB. Stage 1, which reads the connection table in chunks, peaks at 0.96 GB. In a full run, the largest single process reached 2.4 GB; it is one of the scripts that quick mode skips.
- **Time.** The full pipeline took 136.5 min on our machine, an Apple M4 with 10 cores and 16 GB of memory. Quick mode took 46.0 min. Section 4 gives the time of every stage.
- **Node.js 18 or later**, only if you want to build the web demo (Section 9).

We ran everything on macOS. We have not tested Linux or Windows.

## 2. Setting up the environment

A virtual environment is a folder with its own copy of Python and its own packages, kept apart from the rest of the system. Create one inside the repository and install the packages there.

```bash
git clone https://github.com/ljmor/flywire-snn-stdp.git
cd flywire-snn-stdp
python3.14 -m venv env                    # Python 3.12 or later; we used 3.14.6
source env/bin/activate                   # on Windows: env\Scripts\activate
pip install -r requirements-lock.txt      # exact versions, as in our runs
```

Two files list the packages, and they serve different purposes.

- `requirements-lock.txt` pins all 124 packages of the environment we worked in, with their exact versions. We rebuilt that environment from scratch with this file and re-ran the whole pipeline. Every stored output came out the same, apart from the run times that some of them record. Use it to reproduce the numbers.
- `requirements.txt` lists only the packages that the code imports, with minimum versions. They are Brian2, NumPy, pandas, SciPy, scikit-learn, NetworkX, Matplotlib, Jupyter, nbformat, nbconvert, Pillow and PyTorch. It is the better choice if you want to build on the code with newer packages. Results may then differ from ours in the last decimals. PyTorch is only used by one script of phase 04, the comparison with conventional networks, but the full pipeline runs that script.

The pipeline runs the notebooks with the Python of the active environment. If you open a notebook yourself, start Jupyter from the activated environment (`jupyter lab`). Its default kernel, `python3`, then uses the same Python and the same packages.

## 3. Getting the FlyWire data

We use FlyWire public release v783, a frozen version (snapshot) of the connectome described by Dorkenwald et al. (2024) and Schlegel et al. (2024). Its files are distributed through Codex, the FlyWire data portal (Matsliah et al., 2023). The project needs three of them, all in `data/raw/` with their original names. In these files a synaptic contact is a single point where one neuron passes signals to another, and a connection groups all the contacts from one neuron onto another.

| File | What it contains | Size | In the repository |
|---|---|---|---|
| `classification.csv.gz` | the hierarchical annotations of each neuron, used to find the JO neurons | 0.9 MB | yes |
| `consolidated_cell_types.csv.gz` | the cell type of each neuron, which tells apart JO-A and JO-B, the two auditory subtypes of the Johnston's organ | 0.9 MB | yes |
| `connections_buhmann_no_threshold.csv.gz` | the full connection table, with no minimum number of synaptic contacts per connection | 212.1 MB | no, download it |

The connection table is larger than the 100 MB per-file limit of GitHub, so you have to download it by hand.

1. Create a free account at [Codex](https://codex.flywire.ai) and sign in.
2. Choose data version 783.
3. In the downloads section, get `connections_buhmann_no_threshold.csv.gz` and save it in `data/raw/` without renaming it.

Codex now also offers connection tables built with a newer synapse-detection method (Yu et al., 2025). Do not use them. Our numbers come from the file whose name contains `buhmann`: its synapses were detected with the method of Buhmann et al. (2021) and refined with that of Heinrich et al. (2018).

**Checking that you have the right release.** Stage 0 of the pipeline only checks that the three files are in place and prints their sizes (0.9, 212.1 and 0.9 MB). The real check happens in the phase 02 notebook, stage 2 of the pipeline. It prints the number of annotated neurons, 139,255, and the sum of the contact counts of the connection table, 54,492,922. That sum is consistent with the 54.5 million synapses published for v783 (Dorkenwald et al., 2024). Different counts mean a different release. Even within v783, Codex keeps its files in step with its current annotations, so a file downloaded later than ours (August 25–28, 2026) may differ slightly. [`data/README.md`](../data/README.md) gives the exact download date of each file, the layout of the data folder and the license notice.

## 4. Running the pipeline

With the environment active, run from the root of the repository:

```bash
python 06-deployment/pipeline.py                    # all stages, in order
python 06-deployment/pipeline.py --stages 1 2 3     # only some stages
python 06-deployment/pipeline.py --quick            # shorter test run (Section 5)
python 06-deployment/pipeline.py --list             # list the stages and exit
```

`--stages` takes the stage numbers shown by `--list`. The selected stages always run in their own order, whatever order you type them in. Each step prints the command it runs and the time it took. If one fails, the pipeline stops there and returns that step's exit code. The notebooks run in place: the pipeline overwrites each `.ipynb` file with its fresh outputs.

Some terms used in the table. The *operating point* is a common level of activity, a mean firing rate of 10 spikes per second (10 Hz). Every network is tuned to it before the comparison, and that tuning is the *calibration*. The experiment follows a *factorial design*: three wirings (the connectome and two random controls) are each tested with and without plasticity. Each of these six combinations is an *arm*. A *seed* is the number that fixes the random draws of a run, so that the run can be repeated exactly.

| Stage | What runs | What it writes | Time |
|---|---|---|---|
| 0 | checks that the three raw files are in `data/raw/` and prints their sizes and the versions of Brian2, NumPy, SciPy and scikit-learn | nothing | 2 s |
| 1 | `snnlib.extraction.build()`, which extracts the JO subgraph from the raw files (phase 02) | `data/processed/` | 15 s |
| 2 | `02-data-understanding/01-exploratory-data-analysis.ipynb` | the 5 figures `docs/figures/02-*.png`; it also writes `data/processed/` again, with the same content | 40 s |
| 3 | `03-data-preparation/calibrate.py`, then `01-calibration.ipynb` | `outputs/operating_point.json`; `outputs/wta_sweep.csv` and the 4 figures `03-*.png` | 517 s (8.6 min) |
| 4 | the scripts of `04-modeling/` listed below, then its four notebooks | the six JSON files of `04-modeling/outputs/` and the 13 figures `04-*.png` | 7,611 s (126.9 min) |
| 5 | `05-evaluation/01-comparative-evaluation.ipynb` | the 8 figures `05-*.png` | 4 s |
| 6 | `06-deployment/verify_outputs.py` (Section 6) | nothing; it reports in the console | under 1 s |

The times come from one full run of the pipeline on the machine described in Section 1. It took 136.5 min (8,190 s). Stage 4 takes almost all of it.

| Step of stage 4 | What it computes | Output | Time |
|---|---|---|---|
| `run_experiments.py` | the factorial design: the six arms with 5 seeds each, plus the controls of how the sound channels are assigned to the input neurons, the JO neurons through which the sound enters the network (70 runs in total) | `results.json` | 2,255 s |
| `extra_seeds.py` | 10 more seeds for the three arms with plasticity, which brings them to 15 | `extra_seeds.json` | 1,310 s |
| `control_stdp.py` | four variants of the plasticity rule on the connectome | `control_stdp.json` | 500 s |
| `threshold_sweep.py` | a reduced experiment (the connectome and one random control, with and without plasticity, 3 seeds) on subgraphs that keep only the connections with at least 1, 3, 5 or 10 contacts, recalibrated each time | `threshold_sweep.json` | 1,911 s |
| `plot_threshold_validation.py` | the figure of that sweep | `docs/figures/04-contact-threshold-validation.png` | 2 s |
| `energy_frontier.py` | the energy-accuracy frontier: accuracy against the estimated energy per classification of three arms, with weaker input gains and shorter listening times | `energy_frontier.json` | 1,594 s |
| `baseline_ann.py` | conventional (second-generation) networks, whose units pass continuous values instead of spikes, on the same input: a linear classifier, a multilayer perceptron and a recurrent network of gated recurrent units (GRU) | `baseline_ann.json` | 21 s |
| the four notebooks | read those files and draw the figures; they do not simulate | 12 figures | 20 s |

`threshold_sweep.py` builds its four subgraphs the first time it runs and stores them in `data/interim/`. Each build reads the connection table again and takes about 15 s. A first run in a fresh clone with a new environment pays two more one-time costs. The first import of the newly installed packages is slow, and Brian2 has to compile each model before its first simulation. We timed such a run from scratch. It took 139.8 min (8,390 s), 3.3 min more than the run in the table. Stage 0, which only checks the files and imports the packages, took 41 s instead of 2 s. Stage 3 took 612 s instead of 517 s, and `threshold_sweep.py` 1,980 s instead of 1,911 s. No other step changed by more than 11 s. In the run of the table the subgraphs were already there, and the time of `plot_threshold_validation.py` comes from a separate run of the script.

On a laptop, keep the computer awake during a long run. A system that goes to sleep pauses the pipeline, which resumes on wake with the same results but a longer wall-clock time. On macOS, `caffeinate -i python 06-deployment/pipeline.py` prevents sleep until the pipeline ends.

## 5. Quick mode

`--quick` keeps every stage but shortens stage 4. That stage then runs only `run_experiments.py` and the four notebooks, and skips six long scripts (`extra_seeds.py`, `control_stdp.py`, `threshold_sweep.py`, `plot_threshold_validation.py`, `energy_frontier.py` and `baseline_ann.py`). Our quick run took 46.0 min.

What a quick run does reproduce. It rebuilds the subgraph from the raw files, recalibrates the operating point, re-runs the main experiment (the 70 runs) and executes all seven notebooks. In our quick run, the subgraph, `operating_point.json` (apart from its run time), `wta_sweep.csv`, `results.json` and the 29 figures it draws came out identical to the stored ones, and the verification passed. The notebooks printed the same numbers as before; only the duration of one sweep changed. They can do so because the outputs of the skipped scripts are stored in `04-modeling/outputs/` and the notebooks read them from there.

What it does not reproduce. It does not recompute those six outputs. A quick run therefore tells you nothing about whether the ten extra seeds, the variants of the plasticity rule, the threshold sweep, the energy frontier or the conventional networks come out the same. Only the full pipeline checks them.

The stored `extra_seeds.json` matters more than it seems. Without it, `snnlib.evaluation.load_results()` falls back on `results.json` alone, and the arms with plasticity keep only five seeds. One of the main contrasts then loses its significance. It sets the connectome with STDP against the configuration model with STDP, a random network that keeps the number of connections entering and leaving each neuron. With five seeds the connectome is ahead by +0.156 in accuracy, but the p-value is 0.17, far from significant. A p-value is the probability of seeing a difference this large if there were no real difference.

## 6. Checking the outputs

```bash
python 06-deployment/verify_outputs.py
```

Stage 6 runs this script, and you can also run it on its own at any time. It checks five things.

- The three files of `data/processed/` exist and are not suspiciously small.
- The subgraph has its documented size, with 1,239 neurons, 20,059 connections, 269 JO neurons, 123 of them in the input layer, and snapshot v783. A connection here is a directed pair of neurons, and its weight is the number of synaptic contacts between them; the 20,059 connections add up to 338,013 contacts. The input layer is formed by the JO neurons that send connections into the subgraph.
- The seven notebooks of phases 02 to 05 contain no cell that ended in an error. A code cell that never ran gives a warning.
- `03-data-preparation/outputs/operating_point.json` and `04-modeling/outputs/results.json` exist, the two outputs that the later stages read.
- The `results.md` and `research-log.md` reports of phases 02 to 05 exist, and `docs/figures/` holds at least 20 figures of at least 400 × 300 pixels. A missing report, fewer than 20 figures or a small figure gives a warning. Measuring the figures needs Pillow.

The script ends with `All checks passed` or with the number of failures. Warnings are listed but do not count as failures. With at least one failure it exits with code 1, so it can run in continuous integration, the automatic checks that a code-hosting service runs after every change. On the current repository it passes with no warnings and finds 30 figures.

The script does not compare the numbers of the experiments. Each phase report quotes the numbers that its notebook prints, and the notebooks are in the repository with their outputs.

## 7. How the framework is organized

Every phase imports the shared library `snnlib/`. The data flow through the repository, from top to bottom:

```
data/raw/                   three FlyWire v783 files
  |  snnlib.extraction.build()
  v
data/processed/             jo_nodes.csv, jo_edges.csv, jo_meta.json
  |  snnlib.graph.load()  ->  Connectome, plus the wiring of the control networks
  v
03-data-preparation/        calibrate.py  ->  outputs/operating_point.json
  v
04-modeling/                scripts (audio -> network -> evaluation)  ->  outputs/*.json
  v
notebooks of phases 02-05   read the outputs  ->  docs/figures/*.png
```

The scripts run the simulations and store the results as JSON files. Apart from the calibration notebook, which runs its own parameter sweeps (279 s of the 517 s of stage 3), the notebooks do not simulate. They read the JSON files and draw the figures, so re-running one of them takes seconds.

| Module of `snnlib` | What it does |
|---|---|
| `__init__.py` | the paths of the repository (`ROOT`, `DATA_RAW`, `DATA_PROCESSED`, `FIGURES`) and the snapshot name `FLYWIRE_SNAPSHOT` |
| `extraction.py` | from the raw FlyWire files to the JO subgraph: selection of the neurons, one neurotransmitter per neuron (the chemical a neuron releases at its contacts, which makes a connection excitatory, inhibitory or modulatory) and the threshold of 5 contacts per connection (`build()`) |
| `graph.py` | loads the subgraph (`load()`, class `Connectome`), generates the two control networks (`Connectome.wiring()`) and assigns the sound channels to the input neurons (`Connectome.channel_map()`) |
| `audio.py` | the artificial ear: synthetic courtship songs (`pulse_song()`), a gammatone filterbank, a widely used model of auditory filters, which splits the sound into 32 frequency bands, and the conversion of each band into random spike trains (`spike_trains()`) |
| `network.py` | the network in Brian2 (`simulate()`): leaky integrate-and-fire (LIF) neurons, which add up their input current, slowly lose it and fire when they cross a threshold; three synaptic channels; STDP; and a winner-take-all (WTA) inhibition that holds back the network when too many neurons fire. The default parameters are in `P`; the experiments take the input gain and the inhibition strength from phase 03 |
| `calibration.py` | the operating point, found by bisection on the input gain (how strongly each input spike drives the neuron that receives it): the search interval is halved until the network fires at 10 Hz (`tune_w_input()`) |
| `evaluation.py` | the protocol: training with plasticity, frozen weights, test on unseen songs, a linear readout that counts the spikes of each neuron, and the metrics (`experiment()`, `load_results()`) |

### Extension points

| To use… | Change |
|---|---|
| another circuit of the connectome | `extraction.jo_neurons()` and `extraction.subgraph_connections()`, which picks the neurons connected to them |
| another stimulus or task | `audio.py` (`pulse_song()`, `song_rates()`) and the classes in `evaluation.IPIS`, the inter-pulse intervals of the songs in ms |
| another neuron model | `network.EQUATIONS` and `network.P` |
| another plasticity rule | `network._STDP_MODEL`, `network._STDP_PRE` and `network._STDP_POST` |
| another control network | `graph.Connectome.wiring()`, with `_er()` and `_configuration()` as examples |
| another readout | `evaluation._readout()` |
| another stage of the pipeline | a function `stage_N(args)` and its entry in `STAGES`, in `06-deployment/pipeline.py` |

The equations and the plasticity rule are strings in the syntax of Brian2. The topology names (`'connectome'`, `'er'`, `'configuration'`) are compared in `graph.py`, so a new control network needs its own branch in `wiring()`.

## 8. Reproducibility notes

- **Fixed seeds.** Every simulation receives its seed. `network.simulate()` seeds Brian2 and NumPy with it, and the seeds of the stimuli depend on the repetition of a song, never on its class.
- **No state carried over.** Each simulation opens its own `start_scope()` and builds its own Brian2 `Network`, so one run cannot leak into the next.
- **Same environment, same numbers.** In the environment of `requirements-lock.txt`, re-running the pipeline reproduces every stored output byte for byte. Only the wall-clock times change, that is, the `seconds` field of `operating_point.json` and the durations that scripts and notebooks print.
- **Stored results.** All outputs of the experiments are in the repository, so the notebooks can be read, or run again, without re-running the experiment scripts.
- **Without the connection table.** `data/processed/` is in the repository. Stages 3 to 6 run without the large file, as long as stage 4 runs in quick mode. The command is `python 06-deployment/pipeline.py --stages 3 4 5 6 --quick`. Only stages 1 and 2, the threshold sweep and its figure read the raw files. Stage 0 stops when they are missing, which is why the command leaves it out.
- **Notebooks run in place.** After a run, `git diff` shows changes in the notebooks even when the numbers are the same, because the execution metadata and the printed durations change.

## 9. The interactive demo

`demo/` is a static web page for readers without a background in neuroscience. A courtship song plays, and three of the six networks listen to it at the same time. The page shows their real simulated spikes in 3D and as a raster plot (one dot per spike, time against neuron). It also follows the rhythm they pick up and how the readout's decision changes as the listening time grows.

```bash
cd 06-deployment/demo
npm ci              # installs the exact versions of package-lock.json
npm run dev         # local server at http://localhost:5173
npm run build       # static site in dist/
```

It needs Node.js 18 or later. The data and audio files of the page are already in `demo/public/`, so it works without simulating anything. The script that generated them, `demo/prepare_assets.py`, documents the format but needs a simulation dump that is not in the repository. [`demo/README.md`](demo/README.md) describes each section of the page and which of its numbers carry statistics.

## 10. Data credits and license

The raw data are part of FlyWire public release v783 and are licensed under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) (FlyWire, n.d.). The two small files in `data/raw/` are unmodified copies, shared for non-commercial research with attribution. The files derived from them, such as the subgraph in `data/processed/`, are adapted material and remain under the same license. The license of the code of this repository does not cover the data. The full notice is in [`data/README.md`](../data/README.md).

FlyWire was created at Princeton University with support from the US BRAIN Initiative (grants MH117815, MH129268 and U24 NS126935 to Murthy and Seung). Many scientists around the world proofread and annotated the connectome. We use only the published v783 release. The [FlyWire principles](https://edit.flywire.ai/principles.html) let anyone use published neurons, with the appropriate citations, without asking the agreement of the people who reconstructed them. The annotations keep improving and Codex updates them about once a week.

FlyWire asks every user to cite Dorkenwald et al. (2024) and Schlegel et al. (2024), and each component of the data has its own references. For the files we use, these are Zheng et al. (2018) for the electron-microscopy volume, Buhmann et al. (2021) and Heinrich et al. (2018) for the synapses, Eckstein et al. (2024) for the neurotransmitters, Matsliah et al. (2024) and Deutsch et al. (2025) for the cell types, and Matsliah et al. (2023) for Codex.

Please cite the software that runs the project as well. That means Brian2 (Stimberg et al., 2019), NumPy (Harris et al., 2020), SciPy (Virtanen et al., 2020), pandas (McKinney, 2010), scikit-learn (Pedregosa et al., 2011), NetworkX (Hagberg et al., 2008), Matplotlib (Hunter, 2007), Jupyter (Kluyver et al., 2016) and PyTorch (Ansel et al., 2024).

## 11. Troubleshooting

| Symptom | Likely cause | What to do |
|---|---|---|
| Stage 0 prints `Raw files missing from data/raw/` | the connection table (or another raw file) is not in `data/raw/` | download it from Codex (Section 3) and keep its original name |
| `BrianObjectException` in the first simulation, with a compilation error in the details | no working C++ compiler | install one (Section 1) and run the pipeline again |
| Brian2 warns `Removing unsupported flag '-march=native'` | a compiler option that the compiler does not accept (we see it with Apple's `clang`) | nothing; the warning is harmless and does not change the results |
| `verify_outputs.py` reports `n_nodes = …, expected 1239` or another subgraph number | a release other than v783, or a modified raw file | download the files of version 783 again (Section 3) |
| Stage 4 runs for about two hours | this is its normal duration in full mode | use `--quick` for a test run (Section 5) |
| A run took much longer than the times of Section 4 | the computer went to sleep | keep it awake (`caffeinate -i` on macOS) |
| A notebook stops because an input file is missing | a previous stage has not run yet | run the stages in order, at least from the stage that writes the missing file |
| `ModuleNotFoundError: No module named 'snnlib'` in a notebook | the notebook was started outside its phase folder; some editors start it in the repository root | open it from its own folder, which is what Jupyter does by default |
| `ModuleNotFoundError` for `brian2` or another package in a notebook | the kernel uses a Python other than the one of the environment | start Jupyter from the activated environment (Section 2) |

## References

- Ansel, J., Yang, E., He, H., Gimelshein, N., Jain, A., Voznesensky, M., Bao, B., Bell, P., Berard, D., Burovski, E., Chauhan, G., Chourdia, A., Constable, W., Desmaison, A., DeVito, Z., Ellison, E., Feng, W., Gong, J., Gschwind, M., . . . Chintala, S. (2024). PyTorch 2: Faster machine learning through dynamic Python bytecode transformation and graph compilation. In *Proceedings of the 29th ACM International Conference on Architectural Support for Programming Languages and Operating Systems, Volume 2* (pp. 929–947). ACM. https://doi.org/10.1145/3620665.3640366
- Buhmann, J., Sheridan, A., Malin-Mayor, C., Schlegel, P., Gerhard, S., Kazimiers, T., Krause, R., Nguyen, T. M., Heinrich, L., Lee, W.-C. A., Wilson, R., Saalfeld, S., Jefferis, G. S. X. E., Bock, D. D., Turaga, S. C., Cook, M., & Funke, J. (2021). Automatic detection of synaptic partners in a whole-brain *Drosophila* electron microscopy data set. *Nature Methods, 18*(7), 771–774. https://doi.org/10.1038/s41592-021-01183-7
- Chapman, P., Clinton, J., Kerber, R., Khabaza, T., Reinartz, T., Shearer, C., & Wirth, R. (2000). *CRISP-DM 1.0: Step-by-step data mining guide*. SPSS Inc. https://web.archive.org/web/20060207174803/http://www.crisp-dm.org/CRISPWP-0800.pdf
- Deutsch, D., Matsliah, A., Crown, A., Wang, K., Dorkenwald, S., Mondal, A., Jana, S., Burke, A., Hebditch, J., Gager, J., Normand, E., Wang, M., MkKellar, C., Yu, S.-c., Sterling, A., Schlegel, P., Gerhard, S., Sterne, G., Costa, M., . . . Murthy, M. (2025). *Sexually dimorphic neurons in the Drosophila whole-brain connectome* [Preprint]. bioRxiv. https://doi.org/10.1101/2025.06.10.658788
- Dorkenwald, S., Matsliah, A., Sterling, A. R., Schlegel, P., Yu, S.-c., McKellar, C. E., Lin, A., Costa, M., Eichler, K., Yin, Y., Silversmith, W., Schneider-Mizell, C., Jordan, C. S., Brittain, D., Halageri, A., Kuehner, K., Ogedengbe, O., Morey, R., Gager, J., . . . The FlyWire Consortium. (2024). Neuronal wiring diagram of an adult brain. *Nature, 634*(8032), 124–138. https://doi.org/10.1038/s41586-024-07558-y
- Eckstein, N., Bates, A. S., Champion, A., Du, M., Yin, Y., Schlegel, P., Lu, A. K.-Y., Rymer, T., Finley-May, S., Paterson, T., Parekh, R., Dorkenwald, S., Matsliah, A., Yu, S.-C., McKellar, C., Sterling, A., Eichler, K., Costa, M., Seung, S., . . . Funke, J. (2024). Neurotransmitter classification from electron microscopy images at synaptic sites in *Drosophila melanogaster*. *Cell, 187*(10), 2574–2594.e23. https://doi.org/10.1016/j.cell.2024.03.016
- Fayyad, U., Piatetsky-Shapiro, G., & Smyth, P. (1996). From data mining to knowledge discovery in databases. *AI Magazine, 17*(3), 37–54. https://doi.org/10.1609/aimag.v17i3.1230
- FlyWire. (n.d.). *Citing guidelines for publishing with FlyWire*. Retrieved October 14, 2026, from https://flywire.ai/guidelines
- Hagberg, A. A., Schult, D. A., & Swart, P. J. (2008). Exploring network structure, dynamics, and function using NetworkX. In G. Varoquaux, T. Vaught, & J. Millman (Eds.), *Proceedings of the 7th Python in Science Conference* (pp. 11–15). https://doi.org/10.25080/TCWV9851
- Harris, C. R., Millman, K. J., van der Walt, S. J., Gommers, R., Virtanen, P., Cournapeau, D., Wieser, E., Taylor, J., Berg, S., Smith, N. J., Kern, R., Picus, M., Hoyer, S., van Kerkwijk, M. H., Brett, M., Haldane, A., Fernández del Río, J., Wiebe, M., Peterson, P., . . . Oliphant, T. E. (2020). Array programming with NumPy. *Nature, 585*(7825), 357–362. https://doi.org/10.1038/s41586-020-2649-2
- Heinrich, L., Funke, J., Pape, C., Nunez-Iglesias, J., & Saalfeld, S. (2018). Synaptic cleft segmentation in non-isotropic volume electron microscopy of the complete *Drosophila* brain. In *Medical image computing and computer assisted intervention – MICCAI 2018* (pp. 317–325). Springer. https://doi.org/10.1007/978-3-030-00934-2_36
- Hunter, J. D. (2007). Matplotlib: A 2D graphics environment. *Computing in Science & Engineering, 9*(3), 90–95. https://doi.org/10.1109/MCSE.2007.55
- Kluyver, T., Ragan-Kelley, B., Pérez, F., Granger, B., Bussonnier, M., Frederic, J., Kelley, K., Hamrick, J., Grout, J., Corlay, S., Ivanov, P., Avila, D., Abdalla, S., Willing, C., & Jupyter Development Team. (2016). Jupyter Notebooks – a publishing format for reproducible computational workflows. In F. Loizides & B. Schmidt (Eds.), *Positioning and power in academic publishing: Players, agents and agendas* (pp. 87–90). IOS Press. https://doi.org/10.3233/978-1-61499-649-1-87
- Matsliah, A., Sterling, A. R., Dorkenwald, S., Kuehner, K., Morey, R., Seung, H. S., & Murthy, M. (2023). *Codex: Connectome Data Explorer* [Preprint]. ResearchGate. https://doi.org/10.13140/RG.2.2.35928.67844
- Matsliah, A., Yu, S.-c., Kruk, K., Bland, D., Burke, A. T., Gager, J., Hebditch, J., Silverman, B., Willie, K. P., Willie, R., Sorek, M., Sterling, A. R., Kind, E., Garner, D., Sancer, G., Wernet, M. F., Kim, S. S., Murthy, M., Seung, H. S., & The FlyWire Consortium. (2024). Neuronal parts list and wiring diagram for a visual system. *Nature, 634*(8032), 166–180. https://doi.org/10.1038/s41586-024-07981-1
- McKinney, W. (2010). Data structures for statistical computing in Python. In S. van der Walt & J. Millman (Eds.), *Proceedings of the 9th Python in Science Conference* (pp. 56–61). https://doi.org/10.25080/Majora-92bf1922-00a
- Pedregosa, F., Varoquaux, G., Gramfort, A., Michel, V., Thirion, B., Grisel, O., Blondel, M., Prettenhofer, P., Weiss, R., Dubourg, V., Vanderplas, J., Passos, A., Cournapeau, D., Brucher, M., Perrot, M., & Duchesnay, É. (2011). Scikit-learn: Machine learning in Python. *Journal of Machine Learning Research, 12*, 2825–2830. https://jmlr.org/papers/v12/pedregosa11a.html
- Schlegel, P., Yin, Y., Bates, A. S., Dorkenwald, S., Eichler, K., Brooks, P., Han, D. S., Gkantia, M., dos Santos, M., Munnelly, E. J., Badalamente, G., Serratosa Capdevila, L., Sane, V. A., Fragniere, A. M. C., Kiassat, L., Pleijzier, M. W., Stürner, T., Tamimi, I. F. M., Dunne, C. R., . . . Jefferis, G. S. X. E. (2024). Whole-brain annotation and multi-connectome cell typing of *Drosophila*. *Nature, 634*(8032), 139–152. https://doi.org/10.1038/s41586-024-07686-5
- Stimberg, M., Brette, R., & Goodman, D. F. M. (2019). Brian 2, an intuitive and efficient neural simulator. *eLife, 8*, Article e47314. https://doi.org/10.7554/eLife.47314
- Virtanen, P., Gommers, R., Oliphant, T. E., Haberland, M., Reddy, T., Cournapeau, D., Burovski, E., Peterson, P., Weckesser, W., Bright, J., van der Walt, S. J., Brett, M., Wilson, J., Millman, K. J., Mayorov, N., Nelson, A. R. J., Jones, E., Kern, R., Larson, E., . . . Vázquez-Baeza, Y. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*(3), 261–272. https://doi.org/10.1038/s41592-019-0686-2
- Yu, S.-c., Bae, J. A., Matsliah, A., Dorkenwald, S., Gager, J., Hebditch, J., Silverman, B., Willie, K. P., Willie, R., Burke, A. T., Macrina, T., Seung, S., & Murthy, M. (2025). *New synapse detection in the whole-brain connectome of Drosophila* [Preprint]. bioRxiv. https://doi.org/10.1101/2025.07.11.664377
- Zheng, Z., Lauritzen, J. S., Perlman, E., Robinson, C. G., Nichols, M., Milkie, D., Torrens, O., Price, J., Fisher, C. B., Sharifi, N., Calle-Schuler, S. A., Kmecova, L., Ali, I. J., Karsh, B., Trautman, E. T., Bogovic, J. A., Hanslovsky, P., Jefferis, G. S. X. E., Kazhdan, M., . . . Bock, D. D. (2018). A complete electron microscopy volume of the brain of adult *Drosophila melanogaster*. *Cell, 174*(3), 730–743.e22. https://doi.org/10.1016/j.cell.2018.06.019
