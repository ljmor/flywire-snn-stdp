/** Types of the assets written by `prepare_assets.py`. */

export type ModelName = 'connectome_stdp' | 'connectome_static' | 'er_stdp'
export type TopologyName = 'connectome' | 'er'

export interface ClassResponse {
  /** total spikes of the simulation (before the drawing subsample) */
  n_spikes: number
  /** population rate in Hz per neuron, 50 fps */
  rate: number[]
  /** the same rate sampled every 2 ms: at 50 fps the song rhythm aliases */
  fine_rate: number[]
  /** fraction of song pulses that the network turns into a peak of activity */
  locking: number
  /** (max − min) / mean of the smoothed population rate */
  contrast: number
  /** modulation depth at the song rhythm, 0 = flat */
  modulation: number
  /** path through the decision plane, 100 steps of [x, y] */
  trajectory: [number, number][]
}

export interface ModelMeta {
  stdp: boolean
  topology: TopologyName
  /** silhouette of the five clouds in the space the classifier reads */
  silhouette: number
  map: { x: number; y: number; ipi_class: number }[]
  /** readout prediction for each number of ms of response it sees: "100" | "250" | ... */
  window_predictions: Record<string, number[]>
  true_classes: number[]
  classes: Record<string, ClassResponse>
}

export interface StimulusMeta {
  ipi_class: number
  audio: string
  /** times (s) of the song pulses */
  song_pulses: number[]
  /** gammatone filterbank envelope: 32 channels × 100 frames */
  bands: number[][]
}

export interface Meta {
  duration: number
  fps: number
  /** sampling step of `fine_rate`, in ms */
  rate_step_ms: number
  classes: number[]
  n_neurons: number
  n_input: number
  spike_fraction: number
  cf: number[]
  network: {
    n: number
    order: string[]
    matrix_side: number
    topologies: Record<
      TopologyName,
      {
        n: number
        total: number
        offset: number
        matrix_offset: number
        clustering: number
        triangles: number
        reciprocal_pairs: number
      }
    >
  }
  spike_index: Record<string, { offset: number; n: number }>
  stimuli: StimulusMeta[]
  models: Record<ModelName, ModelMeta>
}

export interface Edges {
  a: Uint16Array
  b: Uint16Array
  /** 0 excitatory · 1 inhibitory · 2 modulatory */
  pol: Uint8Array
  /** actual number of connections of the topology (a sample is drawn) */
  total: number
  /** reordered adjacency matrix, side × side, 0–255 */
  matrix: Uint8Array
  /** global clustering coefficient of the graph */
  clustering: number
  triangles: number
  /** pairs of neurons connected in both directions */
  reciprocalPairs: number
}

export interface Network {
  n: number
  pos: Float32Array
  /** 0 input JO neuron · 1 other JO neuron · 2 central neuron */
  nodeType: Uint8Array
  /** 0 left · 1 right · 2 no side annotated */
  side: Uint8Array
  /** gammatone filterbank channel (0 low … 31 high), 255 if not an input neuron */
  channel: Uint8Array
  /** hops from the input layer */
  hop: Uint8Array
  matrixSide: number
  topologies: Record<TopologyName, Edges>
}

/** Spike train of one model for one song, already sorted by time. */
export interface SpikeTrain {
  /** time in tenths of a millisecond */
  t: Uint16Array
  /** neuron index (0 … n−1; the first `n_input` are the input layer) */
  i: Uint16Array
  n: number
}

export interface Bundle {
  meta: Meta
  network: Network
  trains: Map<string, SpikeTrain>
}
