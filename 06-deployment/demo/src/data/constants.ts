/* ---------------------------------------------------------------------------
   Numbers of the study. They all come from the reports of the repository; each
   block names the section it comes from, so that anyone can check it.
     05-evaluation/results.md    accuracy, interaction, contrasts, latency,
                                 spike efficiency, difficulty gradient
     data/processed/jo_meta.json size of the subgraph
--------------------------------------------------------------------------- */

import type { ModelName } from './types'

export const CHANCE = 0.2
export const INPUT_CEILING = 0.223 // 05-evaluation/results.md, Context and goal
export const N_NEURONS = 1239
/**
 * Connections of the graph: directed neuron → neuron pairs. They are NOT single
 * synapses: the weight of each connection is how many synaptic contacts form it,
 * and the sum of all those contacts is N_CONTACTS.
 */
export const N_CONNECTIONS = 20059
export const N_CONTACTS = 338013
export const N_INPUT = 123
export const SNAPSHOT = 'FlyWire v783'

export interface Series {
  id: ModelName
  name: string
  shortName: string
  wiring: string
  learns: boolean
  color: string
  light: string
  cssVar: string
  summary: string
}

/** The three arms that the demo plays live. */
export const SERIES: Record<ModelName, Series> = {
  connectome_stdp: {
    id: 'connectome_stdp',
    name: 'Connectome + STDP',
    shortName: 'Learning connectome',
    wiring: 'the fly’s real wiring',
    learns: true,
    color: '#199e70',
    light: '#35d89c',
    cssVar: 'var(--c-stdp)',
    summary: 'The real auditory circuit, with synaptic plasticity switched on.',
  },
  connectome_static: {
    id: 'connectome_static',
    name: 'Connectome, no learning',
    shortName: 'Frozen connectome',
    wiring: 'the fly’s real wiring',
    learns: false,
    color: '#9085e9',
    light: '#b5abff',
    cssVar: 'var(--c-static)',
    summary: 'The same wiring with its synapses frozen. It learns nothing.',
  },
  er_stdp: {
    id: 'er_stdp',
    name: 'Random wiring + STDP',
    shortName: 'Random network',
    wiring: 'connections drawn at random',
    learns: true,
    color: '#d95926',
    light: '#ff8a4c',
    cssVar: 'var(--c-er)',
    summary:
      'The same neurons and the same number of connections, placed at random (Erdős–Rényi). It learns with the same rule.',
  },
}

export const SERIES_ORDER: ModelName[] = [
  'connectome_stdp',
  'connectome_static',
  'er_stdp',
]

/** Ordinal amber ramp: the IPI is a magnitude, not a category. */
export const IPI_COLOR: Record<number, string> = {
  25: '#ffe29a',
  35: '#fbc55b',
  45: '#efa22b',
  55: '#d9820f',
  65: '#b96a08',
}

export const SPECIES: Record<number, { name: string; note: string }> = {
  35: {
    name: 'D. melanogaster',
    note: 'typical of the species studied here',
  },
  55: {
    name: 'D. simulans',
    note: 'in the range of this sister species, whose song is slower',
  },
}

export const WINDOWS_MS = [100, 250, 500, 1000, 2000]

/* ------------------------- 05-evaluation/results.md, Classification accuracy */
export interface AccuracyRow {
  label: string
  topology: 'Connectome' | 'Configuration model' | 'Erdős–Rényi'
  learns: boolean
  value: number
  sd: number
  n: number
  id?: ModelName
}

export const ACCURACY: AccuracyRow[] = [
  {
    label: 'Connectome · STDP + WTA',
    topology: 'Connectome',
    learns: true,
    value: 0.875,
    sd: 0.039,
    n: 15,
    id: 'connectome_stdp',
  },
  {
    label: 'Configuration model · STDP + WTA',
    topology: 'Configuration model',
    learns: true,
    value: 0.768,
    sd: 0.148,
    n: 15,
  },
  {
    label: 'Configuration model · static',
    topology: 'Configuration model',
    learns: false,
    value: 0.604,
    sd: 0.05,
    n: 5,
  },
  {
    label: 'Connectome · static',
    topology: 'Connectome',
    learns: false,
    value: 0.566,
    sd: 0.082,
    n: 5,
    id: 'connectome_static',
  },
  {
    label: 'Erdős–Rényi · static',
    topology: 'Erdős–Rényi',
    learns: false,
    value: 0.444,
    sd: 0.057,
    n: 5,
  },
  {
    label: 'Erdős–Rényi · STDP + WTA',
    topology: 'Erdős–Rényi',
    learns: true,
    value: 0.443,
    sd: 0.08,
    n: 15,
    id: 'er_stdp',
  },
]

/* -------- 05-evaluation/results.md, The interaction between topology and plasticity */
export const INTERACTION = [
  {
    topology: 'Connectome',
    staticAcc: 0.566,
    plasticAcc: 0.875,
    delta: 0.309,
    p: '0.0047',
    significant: true,
  },
  {
    topology: 'Configuration model',
    staticAcc: 0.604,
    plasticAcc: 0.768,
    delta: 0.164,
    p: '0.213',
    significant: false,
  },
  {
    topology: 'Erdős–Rényi',
    staticAcc: 0.444,
    plasticAcc: 0.443,
    delta: -0.001,
    p: '0.706',
    significant: false,
  },
]

/* ---- 05-evaluation/results.md, The connectome with plasticity beats the other five arms */
export const CONTRASTS = [
  { against: 'Erdős–Rényi + STDP', delta: 0.433, p: '< 0.00001', d: 7.14 },
  { against: 'Erdős–Rényi, static', delta: 0.431, p: '0.00011', d: 9.67 },
  { against: 'Connectome, static', delta: 0.309, p: '0.0047', d: 5.31 },
  { against: 'Configuration model, static', delta: 0.271, p: '0.0016', d: 6.56 },
  {
    against: 'Configuration model + STDP',
    delta: 0.107,
    p: '0.0167',
    d: 1.02,
    decisive: true,
  },
]

/* ------------------------------------------- 05-evaluation/results.md, Latency */
export const LATENCY_MS = [25, 50, 100, 250, 500]

export const LATENCY: { label: string; id?: ModelName; v: number[] }[] = [
  {
    label: 'Connectome · STDP',
    id: 'connectome_stdp',
    v: [0.423, 0.545, 0.717, 0.875, 0.877],
  },
  { label: 'Configuration model · STDP', v: [0.404, 0.468, 0.659, 0.768, 0.806] },
  { label: 'Configuration model · static', v: [0.444, 0.376, 0.462, 0.604, 0.562] },
  {
    label: 'Connectome · static',
    id: 'connectome_static',
    v: [0.414, 0.388, 0.43, 0.566, 0.554],
  },
  { label: 'Erdős–Rényi · static', v: [0.444, 0.33, 0.37, 0.444, 0.504] },
  {
    label: 'Erdős–Rényi · STDP',
    id: 'er_stdp',
    v: [0.328, 0.306, 0.374, 0.443, 0.534],
  },
]

/* ---------------------------------- 05-evaluation/results.md, Spike efficiency */
export const EFFICIENCY: { label: string; id?: ModelName; v: number }[] = [
  { label: 'Configuration model · static', v: 5325 },
  { label: 'Connectome · static', id: 'connectome_static', v: 5784 },
  { label: 'Connectome · STDP', id: 'connectome_stdp', v: 6278 },
  { label: 'Configuration model · STDP', v: 9209 },
  { label: 'Erdős–Rényi · static', v: 9235 },
  { label: 'Erdős–Rényi · STDP', id: 'er_stdp', v: 25175 },
]

/* ------------------------------- 05-evaluation/results.md, Difficulty gradient */
export const PAIRS = ['25 vs 65', '25 vs 55', '35 vs 55', '35 vs 45', '45 vs 55']

export const GRADIENT: { label: string; id?: ModelName; v: number[] }[] = [
  {
    label: 'Connectome · STDP',
    id: 'connectome_stdp',
    v: [1.0, 0.997, 0.998, 0.983, 0.955],
  },
  { label: 'Configuration model · STDP', v: [0.99, 0.995, 0.983, 0.95, 0.927] },
  {
    label: 'Connectome · static',
    id: 'connectome_static',
    v: [0.97, 0.92, 0.9, 0.81, 0.75],
  },
  {
    label: 'Erdős–Rényi · STDP',
    id: 'er_stdp',
    v: [0.933, 0.905, 0.848, 0.672, 0.682],
  },
]

/* ------------------------------------------------------------------- credits */
export const CREDITS = {
  title: 'A spiking network wired like the auditory circuit of Drosophila',
  authors: 'Luis Mora and Jean Alvarez',
  advisor: 'Alexandra Cristina Gonzáles Eras',
  institution: 'Universidad Técnica Particular de Loja, 2026',
}

export const REFERENCES = [
  {
    text:
      'Dorkenwald, S., Matsliah, A., Sterling, A. R., Schlegel, P., Yu, S.-c., McKellar, C. E., Lin, A., Costa, M., Eichler, K., Yin, Y., Silversmith, W., Schneider-Mizell, C., Jordan, C. S., Brittain, D., Halageri, A., Kuehner, K., Ogedengbe, O., Morey, R., Gager, J., . . . The FlyWire Consortium. (2024). Neuronal wiring diagram of an adult brain. Nature, 634(8032), 124–138. https://doi.org/10.1038/s41586-024-07558-y',
    note: 'FlyWire connectome, public release v783',
  },
  {
    text:
      'Schlegel, P., Yin, Y., Bates, A. S., Dorkenwald, S., Eichler, K., Brooks, P., Han, D. S., Gkantia, M., dos Santos, M., Munnelly, E. J., Badalamente, G., Serratosa Capdevila, L., Sane, V. A., Fragniere, A. M. C., Kiassat, L., Pleijzier, M. W., Stürner, T., Tamimi, I. F. M., Dunne, C. R., . . . Jefferis, G. S. X. E. (2024). Whole-brain annotation and multi-connectome cell typing of Drosophila. Nature, 634(8032), 139–152. https://doi.org/10.1038/s41586-024-07686-5',
    note: 'cell-type annotations, including the JO-A and JO-B subgroups',
  },
  {
    text:
      'Zheng, Z., Lauritzen, J. S., Perlman, E., Robinson, C. G., Nichols, M., Milkie, D., Torrens, O., Price, J., Fisher, C. B., Sharifi, N., Calle-Schuler, S. A., Kmecova, L., Ali, I. J., Karsh, B., Trautman, E. T., Bogovic, J. A., Hanslovsky, P., Jefferis, G. S. X. E., Kazhdan, M., . . . Bock, D. D. (2018). A complete electron microscopy volume of the brain of adult Drosophila melanogaster. Cell, 174(3), 730–743.e22. https://doi.org/10.1016/j.cell.2018.06.019',
    note: 'electron microscopy volume of the fly brain',
  },
  {
    text:
      'Buhmann, J., Sheridan, A., Malin-Mayor, C., Schlegel, P., Gerhard, S., Kazimiers, T., Krause, R., Nguyen, T. M., Heinrich, L., Lee, W.-C. A., Wilson, R., Saalfeld, S., Jefferis, G. S. X. E., Bock, D. D., Turaga, S. C., Cook, M., & Funke, J. (2021). Automatic detection of synaptic partners in a whole-brain Drosophila electron microscopy data set. Nature Methods, 18(7), 771–774. https://doi.org/10.1038/s41592-021-01183-7',
    note: 'automatic detection of synapses',
  },
  {
    text:
      'Heinrich, L., Funke, J., Pape, C., Nunez-Iglesias, J., & Saalfeld, S. (2018). Synaptic cleft segmentation in non-isotropic volume electron microscopy of the complete Drosophila brain. In Medical image computing and computer assisted intervention – MICCAI 2018 (pp. 317–325). Springer. https://doi.org/10.1007/978-3-030-00934-2_36',
    note: 'segmentation of synaptic clefts',
  },
  {
    text:
      'Eckstein, N., Bates, A. S., Champion, A., Du, M., Yin, Y., Schlegel, P., Lu, A. K.-Y., Rymer, T., Finley-May, S., Paterson, T., Parekh, R., Dorkenwald, S., Matsliah, A., Yu, S.-C., McKellar, C., Sterling, A., Eichler, K., Costa, M., Seung, S., . . . Funke, J. (2024). Neurotransmitter classification from electron microscopy images at synaptic sites in Drosophila melanogaster. Cell, 187(10), 2574–2594.e23. https://doi.org/10.1016/j.cell.2024.03.016',
    note: 'neurotransmitter predictions',
  },
  {
    text:
      'Matsliah, A., Yu, S.-c., Kruk, K., Bland, D., Burke, A. T., Gager, J., Hebditch, J., Silverman, B., Willie, K. P., Willie, R., Sorek, M., Sterling, A. R., Kind, E., Garner, D., Sancer, G., Wernet, M. F., Kim, S. S., Murthy, M., Seung, H. S., & The FlyWire Consortium. (2024). Neuronal parts list and wiring diagram for a visual system. Nature, 634(8032), 166–180. https://doi.org/10.1038/s41586-024-07981-1',
    note: 'cell-type column of the FlyWire files',
  },
  {
    text:
      'Deutsch, D., Matsliah, A., Crown, A., Wang, K., Dorkenwald, S., Mondal, A., Jana, S., Burke, A., Hebditch, J., Gager, J., Normand, E., Wang, M., MkKellar, C., Yu, S.-c., Sterling, A., Schlegel, P., Gerhard, S., Sterne, G., Costa, M., . . . Murthy, M. (2025). Sexually dimorphic neurons in the Drosophila whole-brain connectome [Preprint]. bioRxiv. https://doi.org/10.1101/2025.06.10.658788',
    note: 'cell-type column of the FlyWire files',
  },
  {
    text:
      'Matsliah, A., Sterling, A. R., Dorkenwald, S., Kuehner, K., Morey, R., Seung, H. S., & Murthy, M. (2023). Codex: Connectome Data Explorer [Preprint]. ResearchGate. https://doi.org/10.13140/RG.2.2.35928.67844',
    note: 'Codex, the portal the files were downloaded from',
  },
  {
    text:
      'FlyWire. (n.d.). Citing guidelines for publishing with FlyWire. Retrieved October 14, 2026, from https://flywire.ai/guidelines',
    note: 'license and citation guidelines of FlyWire',
  },
  {
    text:
      'Kamikouchi, A., Inagaki, H. K., Effertz, T., Hendrich, O., Fiala, A., Göpfert, M. C., & Ito, K. (2009). The neural basis of Drosophila gravity-sensing and hearing. Nature, 458(7235), 165–171. https://doi.org/10.1038/nature07810',
    note: 'subgroups of the neurons of Johnston’s organ',
  },
  {
    text:
      'Bennet-Clark, H. C., & Ewing, A. W. (1969). Pulse interval as a critical parameter in the courtship song of Drosophila melanogaster. Animal Behaviour, 17(4), 755–759. https://doi.org/10.1016/S0003-3472(69)80023-0',
    note: 'the inter-pulse interval as a cue for the species',
  },
  {
    text:
      'Kyriacou, C. P., & Hall, J. C. (1980). Circadian rhythm mutations in Drosophila melanogaster affect short-term fluctuations in the male’s courtship song. Proceedings of the National Academy of Sciences, 77(11), 6729–6733. https://doi.org/10.1073/pnas.77.11.6729',
    note: 'typical intervals of D. melanogaster and D. simulans',
  },
  {
    text:
      'Deutsch, D., Clemens, J., Thiberge, S. Y., Guan, G., & Murthy, M. (2019). Shared song detector neurons in Drosophila male and female brains drive sex-specific behaviors. Current Biology, 29(19), 3200–3215.e5. https://doi.org/10.1016/j.cub.2019.08.008',
    note: 'range of intervals reported for D. simulans',
  },
  {
    text:
      'Bi, G.-q., & Poo, M.-m. (1998). Synaptic modifications in cultured hippocampal neurons: Dependence on spike timing, synaptic strength, and postsynaptic cell type. The Journal of Neuroscience, 18(24), 10464–10472. https://doi.org/10.1523/JNEUROSCI.18-24-10464.1998',
    note: 'experimental basis of STDP',
  },
  {
    text:
      'Stimberg, M., Brette, R., & Goodman, D. F. M. (2019). Brian 2, an intuitive and efficient neural simulator. eLife, 8, Article e47314. https://doi.org/10.7554/eLife.47314',
    note: 'the Brian2 simulator',
  },
  {
    text:
      'Erdős, P., & Rényi, A. (1959). On random graphs I. Publicationes Mathematicae Debrecen, 6(3–4), 290–297. https://doi.org/10.5486/PMD.1959.6.3-4.12',
    note: 'random graph used as a control',
  },
  {
    text:
      'Molloy, M., & Reed, B. (1995). A critical point for random graphs with a given degree sequence. Random Structures & Algorithms, 6(2–3), 161–180. https://doi.org/10.1002/rsa.3240060204',
    note: 'random graph with a given degree sequence (configuration model)',
  },
  {
    text:
      'Belkin, M., & Niyogi, P. (2003). Laplacian eigenmaps for dimensionality reduction and data representation. Neural Computation, 15(6), 1373–1396. https://doi.org/10.1162/089976603321780317',
    note: 'spectral embedding behind the 3D layout',
  },
  {
    text:
      'Pearson, K. (1901). LIII. On lines and planes of closest fit to systems of points in space. The London, Edinburgh, and Dublin Philosophical Magazine and Journal of Science, 2(11), 559–572. https://doi.org/10.1080/14786440109462720',
    note: 'principal component analysis behind the decision map',
  },
  {
    text:
      'Rousseeuw, P. J. (1987). Silhouettes: A graphical aid to the interpretation and validation of cluster analysis. Journal of Computational and Applied Mathematics, 20, 53–65. https://doi.org/10.1016/0377-0427(87)90125-7',
    note: 'silhouette score',
  },
  {
    text:
      'Davies, M., Srinivasa, N., Lin, T.-H., Chinya, G., Cao, Y., Choday, S. H., Dimou, G., Joshi, P., Imam, N., Jain, S., Liao, Y., Lin, C.-K., Lines, A., Liu, R., Mathaikutty, D., McCoy, S., Paul, A., Tse, J., Venkataramanan, G., . . . Wang, H. (2018). Loihi: A neuromorphic manycore processor with on-chip learning. IEEE Micro, 38(1), 82–99. https://doi.org/10.1109/MM.2018.112130359',
    note: 'Loihi, a neuromorphic chip with on-chip learning',
  },
  {
    text:
      'Furber, S. B., Galluppi, F., Temple, S., & Plana, L. A. (2014). The SpiNNaker project. Proceedings of the IEEE, 102(5), 652–665. https://doi.org/10.1109/JPROC.2014.2304638',
    note: 'SpiNNaker',
  },
  {
    text:
      'Schuman, C. D., Kulkarni, S. R., Parsa, M., Mitchell, J. P., Date, P., & Kay, B. (2022). Opportunities for neuromorphic computing algorithms and applications. Nature Computational Science, 2(1), 10–19. https://doi.org/10.1038/s43588-021-00184-y',
    note: 'how networks for neuromorphic chips are built; energy motivation',
  },
  {
    text:
      'Roy, K., Jaiswal, A., & Panda, P. (2019). Towards spike-based machine intelligence with neuromorphic computing. Nature, 575(7784), 607–617. https://doi.org/10.1038/s41586-019-1677-2',
    note: 'energy motivation of spiking networks',
  },
]
