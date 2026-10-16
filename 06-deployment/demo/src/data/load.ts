import type {
  Edges,
  Meta,
  TopologyName,
  Bundle,
  Network,
  SpikeTrain,
} from './types'

/** Path relative to the site base (works in subdirectories and over file://). */
export function url(rel: string): string {
  return new URL(rel, document.baseURI).toString()
}

async function json<T>(rel: string): Promise<T> {
  const r = await fetch(url(rel))
  if (!r.ok) throw new Error(`Could not read ${rel} (HTTP ${r.status})`)
  return (await r.json()) as T
}

async function binary(rel: string): Promise<ArrayBuffer> {
  const r = await fetch(url(rel))
  if (!r.ok) throw new Error(`Could not read ${rel} (HTTP ${r.status})`)
  return await r.arrayBuffer()
}

function readNetwork(meta: Meta, buf: ArrayBuffer): Network {
  const n = meta.network.n
  let o = 0
  const pos = new Float32Array(buf, o, n * 3)
  o += n * 12
  const nodeType = new Uint8Array(buf, o, n)
  o += n
  const side = new Uint8Array(buf, o, n)
  o += n
  const channel = new Uint8Array(buf, o, n)
  o += n
  const hop = new Uint8Array(buf, o, n)

  const topologies = {} as Record<TopologyName, Edges>
  for (const [name, entry] of Object.entries(meta.network.topologies)) {
    const base = entry.offset
    const lm = meta.network.matrix_side
    topologies[name as TopologyName] = {
      a: new Uint16Array(buf, base, entry.n),
      b: new Uint16Array(buf, base + entry.n * 2, entry.n),
      pol: new Uint8Array(buf, base + entry.n * 4, entry.n),
      total: entry.total,
      matrix: new Uint8Array(buf, entry.matrix_offset, lm * lm),
      clustering: entry.clustering,
      triangles: entry.triangles,
      reciprocalPairs: entry.reciprocal_pairs,
    }
  }
  return { n, pos, nodeType, side, channel, hop, matrixSide: meta.network.matrix_side, topologies }
}

function readTrains(meta: Meta, buf: ArrayBuffer): Map<string, SpikeTrain> {
  const trains = new Map<string, SpikeTrain>()
  for (const [key, entry] of Object.entries(meta.spike_index)) {
    trains.set(key, {
      t: new Uint16Array(buf, entry.offset, entry.n),
      i: new Uint16Array(buf, entry.offset + entry.n * 2, entry.n),
      n: entry.n,
    })
  }
  return trains
}

export const trainKey = (model: string, ipiClass: number) => `${model}|${ipiClass}`

export async function loadBundle(
  onProgress?: (fraction: number, label: string) => void,
): Promise<Bundle> {
  onProgress?.(0.08, 'metadata')
  const meta = await json<Meta>('data/meta.json')

  onProgress?.(0.3, 'connectome wiring')
  const bufNetwork = await binary('data/network.bin')
  const network = readNetwork(meta, bufNetwork)

  onProgress?.(0.55, 'spike trains')
  const bufSpikes = await binary('data/spikes.bin')
  const trains = readTrains(meta, bufSpikes)

  onProgress?.(1, 'done')
  return { meta, network, trains }
}
