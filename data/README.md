# Data

This folder holds the input data of the project and every file we derive from it. The notebooks and scripts of all phases read from here, so nothing else has to be downloaded once these files are in place.

Everything starts from FlyWire, the first complete wiring diagram of an adult fly brain. A wiring diagram of this kind is called a connectome. It lists the neurons of a brain and the synaptic contacts between them, reconstructed from electron-microscopy images. We use FlyWire public release v783 (snapshot 783), which covers 139,255 neurons of *Drosophila melanogaster* and is the version described by Dorkenwald et al. (2024) and Schlegel et al. (2024). We downloaded the files from Codex, the web portal through which FlyWire distributes its data (Matsliah et al., 2023).

## Layout

| Folder | What it contains | Versioned in the repository |
|---|---|---|
| `raw/` | the three FlyWire files, unmodified and with their original names | the two small files; the connection table is too large (see below) |
| `processed/` | the Johnston's organ subgraph that every later phase uses | yes |
| `interim/` | alternative subgraphs built with other contact thresholds | no, they are rebuilt on demand |

### raw/

- `classification.csv.gz` (0.9 MB). One row per neuron with its hierarchical annotations (flow, super class, class, subclass, hemilineage, side of the brain and nerve). We use it to find the neurons of Johnston's organ.
- `consolidated_cell_types.csv.gz` (0.9 MB). The cell type assigned to each neuron. It tells apart JO-A and JO-B, the two auditory subtypes of Johnston's organ.
- `connections_buhmann_no_threshold.csv.gz` (212.1 MB). The full connection table, with no minimum number of contacts per connection. Each of its 16,847,997 rows gives the contacts between one pair of neurons inside one neuropil, a dense region of the brain where the branches of neurons make their contacts. A row gives the presynaptic and postsynaptic neurons, the neuropil, the number of contacts and the predicted neurotransmitter. The contacts were detected automatically in the images (Buhmann et al., 2021; Heinrich et al., 2018), and the neurotransmitter was predicted from the same images (Eckstein et al., 2024). The contact counts in the file add up to 54,492,922, in line with the 54.5 million synapses published for v783.

This third file is not in the repository. At 212.1 MB it exceeds the 100 MB per-file limit of GitHub, so it has to be downloaded by hand (see [Getting the connection table](#getting-the-connection-table)).

### processed/

Johnston's organ (JO) is the fly's ear, an organ in the antenna that picks up sound and vibration. From the full connectome we keep the 393 auditory JO neurons and the neurons that receive connections from them. A connection here is a directed pair of neurons, and its weight is the number of synaptic contacts between them. We add up the contacts of each pair, keep only the connections with at least 5 contacts, and label each connection as excitatory, inhibitory or modulatory according to the dominant neurotransmitter of the sending neuron. Connections that leave JO neurons are set to excitatory. What remains is a subgraph of 1,239 neurons, 20,059 connections and 338,013 contacts. It still contains 269 JO neurons, and only 123 of them send connections into the subgraph. Those 123 neurons are the input layer of the spiking network. The reasoning behind each of these choices is in [the phase 02 results](../02-data-understanding/results.md).

- `jo_nodes.csv` has one row per neuron of the subgraph. Besides the FlyWire annotations, it marks the JO neurons and the input layer and gives the cell type of each neuron.
- `jo_edges.csv` has one row per connection. It gives the two neurons, the number of contacts, the neurotransmitter and the polarity (excitatory, inhibitory or modulatory) that the model uses.
- `jo_meta.json` records the snapshot, the contact threshold and the counts given above.

Stage 1 of `06-deployment/pipeline.py` writes these three files, and the phase 02 notebook writes them again when it runs.

### interim/

The contact-threshold sweep of phase 04 (`04-modeling/threshold_sweep.py`) asks whether the conclusions hold when the minimum number of contacts per connection changes. It rebuilds the subgraph with thresholds of 1, 3, 5 and 10 contacts and stores each version in `interim/threshold_<n>/`. The script creates these folders the first time it runs. That run takes about a minute longer, because every rebuild reads the connection table again. The folders are not versioned.

## Getting the connection table

1. Create a free account at [Codex](https://codex.flywire.ai) and sign in.
2. Choose data version 783.
3. In the downloads section, get `connections_buhmann_no_threshold.csv.gz` and save it in `data/raw/` without renaming it.

The two small files are already in `data/raw/`, and the same downloads section offers them too. Codex keeps its files in step with its current annotations. A file downloaded today may therefore differ slightly from ours. We downloaded ours on these dates.

| File | Downloaded on |
|---|---|
| `connections_buhmann_no_threshold.csv.gz` | August 25, 2026 |
| `classification.csv.gz` | August 27, 2026 |
| `consolidated_cell_types.csv.gz` | August 28, 2026 |

To check that you have the same release, run the phase 02 notebook. It prints the number of annotated neurons (139,255) and the total number of contacts in the connection table (54,492,922). Different counts mean a different release.

## License and attribution

`classification.csv.gz` and `consolidated_cell_types.csv.gz` are unmodified copies of FlyWire public-release v783 files, downloaded from Codex (https://codex.flywire.ai) between August 25 and 28, 2026. FlyWire public-release data are licensed under CC BY-NC 4.0 (https://creativecommons.org/licenses/by-nc/4.0/; see also https://flywire.ai/guidelines). We share them here for non-commercial research only, with attribution to the FlyWire Consortium and to the publications listed below. The license of this repository's code does not cover them.

The files derived from them, such as the Johnston's organ subgraph in `processed/` and the subgraphs in `interim/`, are adapted material. They remain under CC BY-NC 4.0.

FlyWire was created at Princeton University with support from the US BRAIN Initiative (grants MH117815, MH129268 and U24 NS126935 to Murthy and Seung).

If you use these data, please cite Dorkenwald et al. (2024) and Schlegel et al. (2024). Cite as well Zheng et al. (2018) for the electron-microscopy volume, Buhmann et al. (2021) and Heinrich et al. (2018) for the synapse detection, Eckstein et al. (2024) for the neurotransmitter predictions, Matsliah et al. (2024) and Deutsch et al. (2025) for the cell types, and Matsliah et al. (2023) for Codex.

## References

- Buhmann, J., Sheridan, A., Malin-Mayor, C., Schlegel, P., Gerhard, S., Kazimiers, T., Krause, R., Nguyen, T. M., Heinrich, L., Lee, W.-C. A., Wilson, R., Saalfeld, S., Jefferis, G. S. X. E., Bock, D. D., Turaga, S. C., Cook, M., & Funke, J. (2021). Automatic detection of synaptic partners in a whole-brain *Drosophila* electron microscopy data set. *Nature Methods, 18*(7), 771–774. https://doi.org/10.1038/s41592-021-01183-7
- Deutsch, D., Matsliah, A., Crown, A., Wang, K., Dorkenwald, S., Mondal, A., Jana, S., Burke, A., Hebditch, J., Gager, J., Normand, E., Wang, M., MkKellar, C., Yu, S.-c., Sterling, A., Schlegel, P., Gerhard, S., Sterne, G., Costa, M., . . . Murthy, M. (2025). *Sexually dimorphic neurons in the Drosophila whole-brain connectome* [Preprint]. bioRxiv. https://doi.org/10.1101/2025.06.10.658788
- Dorkenwald, S., Matsliah, A., Sterling, A. R., Schlegel, P., Yu, S.-c., McKellar, C. E., Lin, A., Costa, M., Eichler, K., Yin, Y., Silversmith, W., Schneider-Mizell, C., Jordan, C. S., Brittain, D., Halageri, A., Kuehner, K., Ogedengbe, O., Morey, R., Gager, J., . . . The FlyWire Consortium. (2024). Neuronal wiring diagram of an adult brain. *Nature, 634*(8032), 124–138. https://doi.org/10.1038/s41586-024-07558-y
- Eckstein, N., Bates, A. S., Champion, A., Du, M., Yin, Y., Schlegel, P., Lu, A. K.-Y., Rymer, T., Finley-May, S., Paterson, T., Parekh, R., Dorkenwald, S., Matsliah, A., Yu, S.-C., McKellar, C., Sterling, A., Eichler, K., Costa, M., Seung, S., . . . Funke, J. (2024). Neurotransmitter classification from electron microscopy images at synaptic sites in *Drosophila melanogaster*. *Cell, 187*(10), 2574–2594.e23. https://doi.org/10.1016/j.cell.2024.03.016
- Heinrich, L., Funke, J., Pape, C., Nunez-Iglesias, J., & Saalfeld, S. (2018). Synaptic cleft segmentation in non-isotropic volume electron microscopy of the complete *Drosophila* brain. In *Medical image computing and computer assisted intervention – MICCAI 2018* (pp. 317–325). Springer. https://doi.org/10.1007/978-3-030-00934-2_36
- Matsliah, A., Sterling, A. R., Dorkenwald, S., Kuehner, K., Morey, R., Seung, H. S., & Murthy, M. (2023). *Codex: Connectome Data Explorer* [Preprint]. ResearchGate. https://doi.org/10.13140/RG.2.2.35928.67844
- Matsliah, A., Yu, S.-c., Kruk, K., Bland, D., Burke, A. T., Gager, J., Hebditch, J., Silverman, B., Willie, K. P., Willie, R., Sorek, M., Sterling, A. R., Kind, E., Garner, D., Sancer, G., Wernet, M. F., Kim, S. S., Murthy, M., Seung, H. S., & The FlyWire Consortium. (2024). Neuronal parts list and wiring diagram for a visual system. *Nature, 634*(8032), 166–180. https://doi.org/10.1038/s41586-024-07981-1
- Schlegel, P., Yin, Y., Bates, A. S., Dorkenwald, S., Eichler, K., Brooks, P., Han, D. S., Gkantia, M., dos Santos, M., Munnelly, E. J., Badalamente, G., Serratosa Capdevila, L., Sane, V. A., Fragniere, A. M. C., Kiassat, L., Pleijzier, M. W., Stürner, T., Tamimi, I. F. M., Dunne, C. R., . . . Jefferis, G. S. X. E. (2024). Whole-brain annotation and multi-connectome cell typing of *Drosophila*. *Nature, 634*(8032), 139–152. https://doi.org/10.1038/s41586-024-07686-5
- Zheng, Z., Lauritzen, J. S., Perlman, E., Robinson, C. G., Nichols, M., Milkie, D., Torrens, O., Price, J., Fisher, C. B., Sharifi, N., Calle-Schuler, S. A., Kmecova, L., Ali, I. J., Karsh, B., Trautman, E. T., Bogovic, J. A., Hanslovsky, P., Jefferis, G. S. X. E., Kazhdan, M., . . . Bock, D. D. (2018). A complete electron microscopy volume of the brain of adult *Drosophila melanogaster*. *Cell, 174*(3), 730–743.e22. https://doi.org/10.1016/j.cell.2018.06.019
