/* ---------------------------------------------------------------------------
   The six 2D canvases of the demo: equalizer, song timeline, rhythm trace,
   raster, decision map and connection matrix. They all read the same mutable
   clock of the engine and are drawn outside React, so the page does not
   re-render at 60 fps.
--------------------------------------------------------------------------- */

import { useEffect, useMemo, useRef } from 'react'

import { IPI_COLOR } from '../data/constants'
import type {
  Edges,
  ClassResponse,
  StimulusMeta,
  ModelMeta,
  SpikeTrain,
} from '../data/types'
import type { Clock } from '../core/engine'
import { useLoop, useOnScreen, useSize, clamp } from '../core/util'

/* ------------------------------------------------------------------ helpers */
function fitCanvas(
  canvasEl: HTMLCanvasElement,
  width: number,
  height: number,
): CanvasRenderingContext2D | null {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = Math.max(Math.round(width * dpr), 1)
  const h = Math.max(Math.round(height * dpr), 1)
  if (canvasEl.width !== w || canvasEl.height !== h) {
    canvasEl.width = w
    canvasEl.height = h
  }
  const ctx = canvasEl.getContext('2d')
  if (!ctx) return null
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return ctx
}

const AMBER = '#efa22b'
const AMBER_LIGHT = '#ffe29a'
const INK_3 = '#6c7987'

/* --------------------------------------------------------- 1. equalizer ---- */
/** The 32 bands of the gammatone filterbank, live. This is what the network "hears". */
export function Equalizer({
  stimulus,
  clock,
  duration,
  cf,
  height = 108,
}: {
  stimulus: StimulusMeta
  clock: Clock
  duration: number
  cf: number[]
  height?: number
}) {
  const box = useRef<HTMLDivElement>(null)
  const canvasEl = useRef<HTMLCanvasElement>(null)
  const visible = useOnScreen(box, '200px')
  const { width } = useSize(box)
  const levels = useRef<Float32Array>(new Float32Array(32))

  useLoop((dt) => {
    const cv = canvasEl.current
    if (!cv || width < 4) return
    const ctx = fitCanvas(cv, width, height)
    if (!ctx) return

    const bands = stimulus.bands
    const nf = bands[0].length
    const f = clamp(Math.floor((clock.t / duration) * nf), 0, nf - 1)

    let maxVal = 1e-6
    for (let c = 0; c < bands.length; c++) maxVal = Math.max(maxVal, bands[c][f])
    const scale = Math.max(maxVal, 0.12)

    const n = bands.length
    const gap = 2
    const w = (width - gap * (n - 1)) / n
    ctx.clearRect(0, 0, width, height)

    const k = 1 - Math.exp(-dt / 0.055)
    for (let c = 0; c < n; c++) {
      const goal = clamp(bands[c][f] / scale, 0, 1)
      levels.current[c] += (goal - levels.current[c]) * k
      const v = levels.current[c]
      const h = Math.max(2, v * (height - 6))
      const x = c * (w + gap)
      const y = height - h

      // frequency is a magnitude: ordinal amber ramp from low to high
      const u = c / (n - 1)
      const toInt = (x: number) => Math.round(x)
      const grad = ctx.createLinearGradient(0, y, 0, height)
      grad.addColorStop(
        0,
        `rgba(${toInt(255 - 60 * u)},${toInt(226 - 70 * u)},${toInt(154 - 90 * u)},${(0.35 + 0.6 * v).toFixed(3)})`,
      )
      grad.addColorStop(
        1,
        `rgba(${toInt(200 - 70 * u)},${toInt(120 - 40 * u)},20,${(0.16 + 0.3 * v).toFixed(3)})`,
      )
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.roundRect(x, y, w, h, Math.min(w / 2, 2.5))
      ctx.fill()
    }

    // axis: the two ends of the filterbank
    ctx.font = '10px "JetBrains Mono", monospace'
    ctx.fillStyle = INK_3
    ctx.textBaseline = 'top'
    ctx.fillText(`${Math.round(cf[0])} Hz`, 0, 2)
    ctx.textAlign = 'right'
    ctx.fillText(`${Math.round(cf[cf.length - 1])} Hz`, width, 2)
    ctx.textAlign = 'left'
  }, visible)

  return (
    <div ref={box} className="canvas-box" style={{ height: height }}>
      <canvas ref={canvasEl} style={{ width: '100%', height: height, display: 'block' }} />
    </div>
  )
}

/* ---------------------------------------------------- 2. song timeline ---- */
/**
 * Pulse train of the song with a time axis, playhead, decision windows and
 * click to seek. The axis runs from 0 to the end of the clip (2 s), which is the
 * time of the SIGNAL: played at half speed, those same 2 s take twice as long to
 * sound, and the clip repeats in a loop.
 */
export function SongTimeline({
  stimulus,
  clock,
  duration,
  windows,
  height = 62,
  onSeek,
}: {
  stimulus: StimulusMeta
  clock: Clock
  duration: number
  windows?: number[]
  height?: number
  onSeek?: (t: number) => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const canvasEl = useRef<HTMLCanvasElement>(null)
  const playhead = useRef<HTMLDivElement>(null)
  const visible = useOnScreen(box, '200px')
  const { width } = useSize(box)
  const color = IPI_COLOR[stimulus.ipi_class] ?? AMBER

  // static background: redrawn only when the song or the size changes
  useEffect(() => {
    const cv = canvasEl.current
    if (!cv || width < 4) return
    const ctx = fitCanvas(cv, width, height)
    if (!ctx) return
    ctx.clearRect(0, 0, width, height)

    const y0 = height - 12
    ctx.font = '9.5px "JetBrains Mono", monospace'
    const narrow = width < 520

    // time axis of the clip; on narrow screens, one tick per second
    const step = narrow ? 1 : 0.5
    for (let t = 0; t <= duration + 1e-6; t += step) {
      const x = Math.min(Math.round((t / duration) * width) + 0.5, width - 0.5)
      const isEnd = t >= duration - 1e-6
      ctx.strokeStyle = isEnd ? 'rgba(233,238,245,.32)' : 'rgba(154,167,182,.16)'
      ctx.beginPath()
      ctx.moveTo(x, y0 - 2)
      ctx.lineTo(x, height)
      ctx.stroke()
      ctx.fillStyle = isEnd ? 'rgba(233,238,245,.62)' : INK_3
      ctx.textAlign = isEnd ? 'right' : t === 0 ? 'left' : 'center'
      const text = `${t.toFixed(1)} s`
      ctx.fillText(
        isEnd && !narrow ? `${text} · end of clip` : text,
        isEnd ? width - 3 : Math.min(x, width - 3),
        height - 2.5,
      )
      ctx.textAlign = 'left'
    }

    // decision windows: on narrow screens only the line, no label, except 250 ms
    if (windows) {
      ctx.setLineDash([2, 4])
      ctx.strokeStyle = 'rgba(154,167,182,.28)'
      ctx.lineWidth = 1
      ctx.fillStyle = INK_3
      for (const v of windows) {
        const x = Math.round((v / 1000 / duration) * width) + 0.5
        if (x > width - 2) continue
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, y0 - 2)
        ctx.stroke()
        if (!narrow || v === 250)
          ctx.fillText(v < 1000 ? `${v} ms` : `${v / 1000} s`, x + 3, 10)
      }
      ctx.setLineDash([])
    }

    // baseline and song pulses
    ctx.strokeStyle = 'rgba(154,167,182,.20)'
    ctx.beginPath()
    ctx.moveTo(0, y0 + 0.5)
    ctx.lineTo(width, y0 + 0.5)
    ctx.stroke()

    for (const p of stimulus.song_pulses) {
      const x = (p / duration) * width
      const h = height - 32
      const g = ctx.createLinearGradient(0, y0 - h, 0, y0)
      g.addColorStop(0, color)
      g.addColorStop(1, 'rgba(239,162,43,.08)')
      ctx.fillStyle = g
      ctx.fillRect(x - 1, y0 - h, 2, h)
    }
  }, [stimulus, width, height, duration, color, windows])

  useLoop(() => {
    const c = playhead.current
    if (!c || width < 4) return
    c.style.transform = `translateX(${(clock.t / duration) * width}px)`
  }, visible)

  return (
    <div
      ref={box}
      className={`canvas-box song-timeline${onSeek ? ' clickable' : ''}`}
      style={{ height: height }}
      onPointerDown={
        onSeek
          ? (e) => {
              const r = e.currentTarget.getBoundingClientRect()
              onSeek(clamp((e.clientX - r.left) / r.width, 0, 0.999) * duration)
            }
          : undefined
      }
    >
      <canvas ref={canvasEl} style={{ width: '100%', height: height, display: 'block' }} />
      <div ref={playhead} className="playhead" style={{ background: color }} />
    </div>
  )
}

/* ------------------------------------- 3. rhythm trace (does it hear it?) */
/**
 * Firing rate of the population in a sliding window of 400 ms, with the song
 * pulses marked below. If the network "hears" the rhythm, the curve rises and
 * falls with the marks; if not, it is a flat line however active the network
 * is. The window is short on purpose: at the scale of the full 2 s, a rhythm of
 * 35 ms does not fit on the screen.
 */
export function RhythmTrace({
  classData,
  stimulus,
  clock,
  duration,
  stepMs,
  color,
  height = 84,
  windowMs = 400,
}: {
  classData: ClassResponse
  stimulus: StimulusMeta
  clock: Clock
  duration: number
  stepMs: number
  color: string
  height?: number
  windowMs?: number
}) {
  const box = useRef<HTMLDivElement>(null)
  const canvasEl = useRef<HTMLCanvasElement>(null)
  const visible = useOnScreen(box, '200px')
  const { width } = useSize(box)

  useLoop(() => {
    const cv = canvasEl.current
    if (!cv || width < 4) return
    const ctx = fitCanvas(cv, width, height)
    if (!ctx) return
    ctx.clearRect(0, 0, width, height)

    const r = classData.fine_rate
    const n = r.length
    const win = windowMs / 1000
    // the window slides with the playhead and stops when it reaches the end
    const t0 = clamp(clock.t - win, 0, Math.max(duration - win, 0))
    const t1 = t0 + win
    const now = clamp(clock.t, t0, t1)
    let maxVal = 1
    for (let i = 0; i < n; i++) if (r[i] > maxVal) maxVal = r[i]

    const base = height - 13
    const usable = base - 9
    const px = (t: number) => ((t - t0) / win) * width
    const py = (v: number) => base - (v / maxVal) * usable
    const indexAt = (t: number) => clamp(Math.round((t * 1000) / stepMs), 0, n - 1)
    const tracePath = (start: number, end: number) => {
      const c = new Path2D()
      c.moveTo(px((start * stepMs) / 1000), py(r[start]))
      for (let i = start + 1; i <= end; i++)
        c.lineTo(px((i * stepMs) / 1000), py(r[i]))
      return c
    }

    // song pulses inside the window
    for (const p of stimulus.song_pulses) {
      if (p < t0 || p > t1) continue
      const x = px(p)
      ctx.fillStyle = 'rgba(239,162,43,.18)'
      ctx.fillRect(x - 0.5, 0, 1, base)
      ctx.fillStyle = '#efa22b'
      ctx.fillRect(x - 1, base + 3, 2, 7)
    }
    ctx.strokeStyle = 'rgba(154,167,182,.18)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, base + 0.5)
    ctx.lineTo(width, base + 0.5)
    ctx.stroke()

    const a = indexAt(t0)
    const b = indexAt(t1)
    const c = indexAt(now)
    ctx.lineJoin = 'round'

    // what has not been played yet, dimmed
    if (b > c) {
      ctx.strokeStyle = 'rgba(154,167,182,.22)'
      ctx.lineWidth = 1.5
      ctx.stroke(tracePath(c, b))
    }

    // what has already been played: fill + stroke
    if (c > a) {
      const fillPath = tracePath(a, c)
      fillPath.lineTo(px(now), base)
      fillPath.lineTo(px(t0), base)
      fillPath.closePath()
      const g = ctx.createLinearGradient(0, 0, 0, base)
      g.addColorStop(0, `${color}4d`)
      g.addColorStop(1, `${color}00`)
      ctx.fillStyle = g
      ctx.fill(fillPath)

      ctx.strokeStyle = color
      ctx.lineWidth = 1.9
      ctx.stroke(tracePath(a, c))

      ctx.beginPath()
      ctx.arc(px((c * stepMs) / 1000), py(r[c]), 3, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
    }

    ctx.font = '9.5px "JetBrains Mono", monospace'
    ctx.fillStyle = INK_3
    ctx.textBaseline = 'top'
    ctx.fillText(`last ${windowMs} ms`, 3, 2)
    ctx.textBaseline = 'alphabetic'
  }, visible)

  return (
    <div ref={box} className="canvas-box" style={{ height: height }}>
      <canvas ref={canvasEl} style={{ width: '100%', height: height, display: 'block' }} />
    </div>
  )
}

/* --------------------------------------------------------------- 4. raster */
/**
 * One dot per spike: time on the x axis, neuron on the y axis. It is drawn
 * incrementally, so the raster writes itself at the pace of the audio.
 * The top band is the input layer, which receives the same input in the
 * three networks.
 */
export function Raster({
  train,
  clock,
  duration,
  nNeurons,
  nInput,
  color,
  stimulus,
  height = 132,
}: {
  train: SpikeTrain | null
  clock: Clock
  duration: number
  nNeurons: number
  nInput: number
  color: string
  stimulus: StimulusMeta
  height?: number
}) {
  const box = useRef<HTMLDivElement>(null)
  const canvasEl = useRef<HTMLCanvasElement>(null)
  const playhead = useRef<HTMLDivElement>(null)
  const visible = useOnScreen(box, '200px')
  const { width } = useSize(box)
  const cursor = useRef({ k: 0, lap: -1, train: null as SpikeTrain | null, width: 0 })

  useLoop(() => {
    const cv = canvasEl.current
    if (!cv || width < 4 || !train) return
    const ctx = fitCanvas(cv, width, height)
    if (!ctx) return

    const c = cursor.current
    const limit = clock.t * 10_000
    // rewinding also forces a repaint: otherwise bright spikes would remain
    // ahead of the playhead
    const rewound = c.k > 0 && train.t[c.k - 1] > limit
    const mustReset =
      c.train !== train ||
      c.lap !== clock.lap ||
      c.width !== width ||
      rewound
    const kx = width / (duration * 10_000)
    const ky = height / nNeurons

    if (mustReset) {
      c.train = train
      c.lap = clock.lap
      c.width = width
      c.k = 0
      ctx.clearRect(0, 0, width, height)
      for (const p of stimulus.song_pulses) {
        ctx.fillStyle = 'rgba(239,162,43,.16)'
        ctx.fillRect((p / duration) * width - 0.5, 0, 1, height)
      }
      // The whole pattern stays in the background, very faint: the raster is
      // never empty and the difference in density between networks shows at a
      // glance. The part that has already played is written on top.
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = 0.17
      ctx.fillStyle = color
      // fixed step, the same in the three networks: the background keeps the
      // real difference in density (the random network fires about twice as
      // many spikes as the connectome with plasticity)
      for (let k = 0; k < train.n; k += 2)
        ctx.fillRect(train.t[k] * kx, train.i[k] * ky, 1.1, 1.1)
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
      // separator of the input layer
      const yInput = (nInput / nNeurons) * height
      ctx.fillStyle = 'rgba(154,167,182,.3)'
      ctx.fillRect(0, yInput, width, 0.7)
    }

    ctx.globalCompositeOperation = 'lighter'
    let drawnCount = 0
    while (c.k < train.n && train.t[c.k] <= limit) {
      const i = train.i[c.k]
      if (i < nInput) {
        ctx.fillStyle = AMBER_LIGHT
        ctx.globalAlpha = 0.55
      } else {
        ctx.fillStyle = color
        ctx.globalAlpha = 0.66
      }
      ctx.fillRect(train.t[c.k] * kx, i * ky, 1.15, 1.15)
      c.k++
      if (++drawnCount > 14_000) break // safety bound after a large jump
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'

    const cb = playhead.current
    if (cb) cb.style.transform = `translateX(${(clock.t / duration) * width}px)`
  }, visible)

  return (
    <div ref={box} className="canvas-box raster" style={{ height: height }}>
      <canvas ref={canvasEl} style={{ width: '100%', height: height, display: 'block' }} />
      <div ref={playhead} className="playhead faint" />
    </div>
  )
}

/* ------------------------------------------------------ 5. decision map */
/** Scatter ellipse (mean ± k standard deviations) of a set of points. */
function fitEllipse(points: { x: number; y: number }[], k = 1.7) {
  const n = points.length
  if (n < 3) return null
  let mx = 0
  let my = 0
  for (const p of points) {
    mx += p.x
    my += p.y
  }
  mx /= n
  my /= n
  let sxx = 0
  let syy = 0
  let sxy = 0
  for (const p of points) {
    const dx = p.x - mx
    const dy = p.y - my
    sxx += dx * dx
    syy += dy * dy
    sxy += dx * dy
  }
  sxx /= n - 1
  syy /= n - 1
  sxy /= n - 1
  // eigenvalues and eigenvectors of a symmetric 2x2 matrix
  const tr = sxx + syy
  const det = sxx * syy - sxy * sxy
  const sqrtTerm = Math.sqrt(Math.max(tr * tr / 4 - det, 0))
  const l1 = tr / 2 + sqrtTerm
  const l2 = Math.max(tr / 2 - sqrtTerm, 1e-9)
  const ang = Math.abs(sxy) > 1e-9 ? Math.atan2(l1 - sxx, sxy) : sxx >= syy ? 0 : Math.PI / 2
  return {
    mx,
    my,
    rx: k * Math.sqrt(Math.max(l1, 1e-9)),
    ry: k * Math.sqrt(l2),
    ang,
  }
}

/**
 * What the classifier sees, projected onto two dimensions (PCA). Each dot is a
 * test presentation; its color, the song that was playing. The ellipse encloses
 * the spread of each song: if the network separates them, there are five small,
 * tidy ellipses; if not, they all overlap. The trail is the stimulus playing
 * now, moving as evidence arrives.
 */
export function DecisionMap({
  model,
  ipiClass,
  classes,
  clock,
  duration,
  color,
  height = 250,
}: {
  model: ModelMeta
  ipiClass: number
  classes: number[]
  clock: Clock
  duration: number
  color: string
  height?: number
}) {
  const box = useRef<HTMLDivElement>(null)
  const canvasEl = useRef<HTMLCanvasElement>(null)
  const visible = useOnScreen(box, '200px')
  const { width } = useSize(box)

  const groups = useMemo(
    () =>
      classes.map((c) => {
        const pts = model.map.filter((p) => p.ipi_class === c)
        return { ipiClass: c, pts, el: fitEllipse(pts) }
      }),
    [model, classes],
  )

  useLoop(() => {
    const cv = canvasEl.current
    if (!cv || width < 4) return
    const ctx = fitCanvas(cv, width, height)
    if (!ctx) return
    ctx.clearRect(0, 0, width, height)

    // the two axes come normalized separately, so each one can fill its side of
    // the box without distorting the figure
    const m = 20
    const RX = (width - m * 2) / 2
    const RY = (height - m * 2) / 2
    const cx = width / 2
    const cy = height / 2
    const X = (x: number) => cx + clamp(x, -1.28, 1.28) * (RX / 1.28)
    const Y = (y: number) => cy - clamp(y, -1.28, 1.28) * (RY / 1.28)

    ctx.strokeStyle = 'rgba(154,167,182,.09)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(m, cy)
    ctx.lineTo(width - m, cy)
    ctx.moveTo(cx, m)
    ctx.lineTo(cx, height - m)
    ctx.stroke()

    // scatter ellipses per song
    for (const g of groups) {
      if (!g.el) continue
      const tone = IPI_COLOR[g.ipiClass] ?? AMBER
      const active = g.ipiClass === ipiClass
      ctx.save()
      ctx.translate(X(g.el.mx), Y(g.el.my))
      ctx.rotate(-g.el.ang)
      ctx.beginPath()
      ctx.ellipse(
        0,
        0,
        Math.max(g.el.rx * (RX / 1.28), 4),
        Math.max(g.el.ry * (RY / 1.28), 4),
        0,
        0,
        Math.PI * 2,
      )
      ctx.fillStyle = tone
      ctx.globalAlpha = active ? 0.16 : 0.085
      ctx.fill()
      ctx.globalAlpha = active ? 0.9 : 0.45
      ctx.lineWidth = active ? 1.8 : 1.1
      ctx.strokeStyle = tone
      ctx.stroke()
      ctx.restore()
    }
    ctx.globalAlpha = 1

    // test points
    for (const g of groups) {
      const tone = IPI_COLOR[g.ipiClass] ?? AMBER
      const active = g.ipiClass === ipiClass
      for (const p of g.pts) {
        ctx.beginPath()
        ctx.arc(X(p.x), Y(p.y), active ? 3.6 : 2.6, 0, Math.PI * 2)
        ctx.fillStyle = tone
        ctx.globalAlpha = active ? 1 : 0.6
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1

    // direct label at the center of each cloud: the color never goes alone
    ctx.font = '600 11px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const g of groups) {
      if (!g.el) continue
      const tone = IPI_COLOR[g.ipiClass] ?? AMBER
      const x = X(g.el.mx)
      const y = Y(g.el.my)
      ctx.lineWidth = 3
      ctx.strokeStyle = 'rgba(8,11,16,.92)'
      ctx.strokeText(String(g.ipiClass), x, y)
      ctx.fillStyle = tone
      ctx.globalAlpha = g.ipiClass === ipiClass ? 1 : 0.85
      ctx.fillText(String(g.ipiClass), x, y)
      ctx.globalAlpha = 1
    }
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'

    // trail of the current stimulus
    const tr = model.classes[String(ipiClass)]?.trajectory
    if (tr && tr.length) {
      const end = clamp(
        Math.floor((clock.t / duration) * (tr.length - 1)),
        0,
        tr.length - 1,
      )
      if (end > 1) {
        ctx.beginPath()
        ctx.moveTo(X(tr[0][0]), Y(tr[0][1]))
        for (let i = 1; i <= end; i++) ctx.lineTo(X(tr[i][0]), Y(tr[i][1]))
        ctx.strokeStyle = color
        ctx.globalAlpha = 0.6
        ctx.lineWidth = 1.8
        ctx.lineJoin = 'round'
        ctx.stroke()
        ctx.globalAlpha = 1

        const [px, py] = tr[end]
        ctx.beginPath()
        ctx.arc(X(px), Y(py), 6, 0, Math.PI * 2)
        ctx.fillStyle = IPI_COLOR[ipiClass] ?? AMBER
        ctx.fill()
        ctx.lineWidth = 2
        ctx.strokeStyle = '#080b10'
        ctx.stroke()
      }
    }
  }, visible)

  return (
    <div ref={box} className="canvas-box" style={{ height: height }}>
      <canvas ref={canvasEl} style={{ width: '100%', height: height, display: 'block' }} />
    </div>
  )
}

/* ------------------------------------------------ 6. connection matrix */
/**
 * Adjacency of the graph, reordered by the same spectral embedding in both
 * topologies: row = sending neuron, column = receiving neuron. The real wiring
 * draws blocks and bands (groups of neurons that talk to one another); the
 * random one, a uniform speckle. No knowledge of graphs is needed to see the
 * difference.
 */
export function ConnectionMatrix({
  edges,
  side,
  color,
  height = 200,
}: {
  edges: Edges
  side: number
  color: string
  height?: number
}) {
  const canvasEl = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = canvasEl.current
    if (!cv) return
    cv.width = side
    cv.height = side
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const img = ctx.createImageData(side, side)
    const r = parseInt(color.slice(1, 3), 16)
    const g = parseInt(color.slice(3, 5), 16)
    const b = parseInt(color.slice(5, 7), 16)
    for (let i = 0; i < side * side; i++) {
      const v = edges.matrix[i] / 255
      const k = Math.pow(v, 0.62)
      img.data[i * 4] = 10 + (r * 1.45 - 10) * k
      img.data[i * 4 + 1] = 13 + (g * 1.45 - 13) * k
      img.data[i * 4 + 2] = 18 + (b * 1.45 - 18) * k
      img.data[i * 4 + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
  }, [edges, side, color])

  return (
    <div className="matrix" style={{ height: height }}>
      <canvas
        ref={canvasEl}
        style={{ width: '100%', height: '100%', display: 'block' }}
        role="img"
        aria-label="Connection matrix of the network: the row is the sending neuron, the column the receiving one."
      />
      <span className="matrix-axis matrix-y">sends →</span>
      <span className="matrix-axis matrix-x">receives →</span>
    </div>
  )
}
