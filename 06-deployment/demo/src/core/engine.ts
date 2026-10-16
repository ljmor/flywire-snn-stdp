/* ---------------------------------------------------------------------------
   Playback engine: a single time source for the audio, the raster, the 3D views
   and the verdicts.

   `engine.clock` is a MUTABLE object that the drawing loops read 60 times per
   second without going through React. Discrete changes (chosen song, play /
   pause, speed) are React state, through `useSyncExternalStore`.
--------------------------------------------------------------------------- */

import { useEffect, useRef, useSyncExternalStore } from 'react'

export interface Clock {
  /** seconds within the clip */
  t: number
  /** increases on every repeat: the drawing accumulators reset with it */
  lap: number
}

export interface EngineState {
  ipiClass: number
  playing: boolean
  speed: number
  /** the browser blocked audio autoplay */
  audioBlocked: boolean
  /** muted by the user */
  muted: boolean
}

export class Engine {
  readonly clock: Clock = { t: 0, lap: 0 }
  private state: EngineState = {
    ipiClass: 35,
    playing: false,
    speed: 1,
    audioBlocked: false,
    muted: false,
  }
  private listeners = new Set<() => void>()
  private audio: HTMLAudioElement | null = null
  private rafId = 0
  private lastTick = 0
  private tPrev = 0

  constructor(
    private readonly duration: number,
    private readonly audioSource: (ipiClass: number) => string,
  ) {}

  // -- React subscription --------------------------------------------------
  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  getSnapshot = (): EngineState => this.state

  private emit(partial: Partial<EngineState>) {
    this.state = { ...this.state, ...partial }
    this.listeners.forEach((f) => f())
  }

  // -- audio ---------------------------------------------------------------
  private ensureAudio(): HTMLAudioElement {
    if (!this.audio) {
      const a = new Audio()
      a.loop = true
      a.preload = 'auto'
      a.crossOrigin = 'anonymous'
      a.src = this.audioSource(this.state.ipiClass)
      this.audio = a
    }
    return this.audio
  }

  get audioElement(): HTMLAudioElement | null {
    return this.audio
  }

  // -- controls ------------------------------------------------------------
  selectClass(ipiClass: number) {
    if (ipiClass === this.state.ipiClass) return
    const wasPlaying = this.state.playing
    this.clock.t = 0
    this.clock.lap++
    this.tPrev = 0
    this.emit({ ipiClass })
    if (this.audio) {
      this.audio.src = this.audioSource(ipiClass)
      this.audio.currentTime = 0
      if (wasPlaying) void this.audio.play().catch(() => this.fallBackToSilence())
    }
  }

  play() {
    if (this.state.playing) return
    const a = this.ensureAudio()
    a.playbackRate = this.state.speed
    a.muted = this.state.muted
    this.emit({ playing: true })
    this.lastTick = performance.now()
    this.tick()
    void a.play().then(
      () => this.emit({ audioBlocked: false }),
      () => this.fallBackToSilence(),
    )
  }

  pause() {
    if (!this.state.playing) return
    this.audio?.pause()
    cancelAnimationFrame(this.rafId)
    this.rafId = 0
    this.emit({ playing: false })
  }

  toggle() {
    this.state.playing ? this.pause() : this.play()
  }

  setSpeed(v: number) {
    this.emit({ speed: v })
    if (this.audio) this.audio.playbackRate = v
  }

  setMuted(m: boolean) {
    this.emit({ muted: m })
    if (this.audio) this.audio.muted = m
  }

  restart() {
    this.clock.t = 0
    this.clock.lap++
    this.tPrev = 0
    if (this.audio) this.audio.currentTime = 0
    this.listeners.forEach((f) => f())
  }

  seek(t: number) {
    const newT = Math.min(Math.max(t, 0), this.duration - 1e-3)
    if (newT < this.clock.t) this.clock.lap++
    this.clock.t = newT
    this.tPrev = newT
    if (this.audio) this.audio.currentTime = newT
    this.listeners.forEach((f) => f())
  }

  destroy() {
    cancelAnimationFrame(this.rafId)
    this.audio?.pause()
    this.audio = null
    this.listeners.clear()
  }

  // -- clock ---------------------------------------------------------------
  private fallBackToSilence() {
    // Autoplay blocked or WAV unavailable: the demo keeps running against its
    // own clock, only in silence.
    this.emit({ audioBlocked: true })
  }

  private tick = () => {
    if (!this.state.playing) return
    const now = performance.now()
    const dt = Math.min((now - this.lastTick) / 1000, 0.1)
    this.lastTick = now

    const a = this.audio
    let t: number
    if (a && !a.paused && a.readyState >= 2 && Number.isFinite(a.currentTime)) {
      t = a.currentTime
    } else {
      t = this.clock.t + dt * this.state.speed
      if (t >= this.duration) t -= this.duration
    }
    if (t < this.tPrev - 1e-4) this.clock.lap++
    this.tPrev = t
    this.clock.t = t
    this.rafId = requestAnimationFrame(this.tick)
  }
}

export function useEngine(engine: Engine): EngineState {
  return useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot)
}

/** Integration window available with `t` seconds of evidence. */
export function availableWindow(t: number, windows: number[]): number | null {
  let best: number | null = null
  for (const v of windows) if (t * 1000 >= v) best = v
  return best
}

/** Own clock of a decorative scene (hero), independent of the audio. */
export function useLocalClock(duration: number, active: boolean): Clock {
  const clock = useRef<Clock>({ t: 0, lap: 0 }).current
  useEffect(() => {
    if (!active) return
    let id = 0
    let prev = performance.now()
    const step = (now: number) => {
      const dt = Math.min((now - prev) / 1000, 0.06)
      prev = now
      clock.t += dt
      if (clock.t >= duration) {
        clock.t -= duration
        clock.lap++
      }
      id = requestAnimationFrame(step)
    }
    id = requestAnimationFrame(step)
    return () => cancelAnimationFrame(id)
  }, [duration, active, clock])
  return clock
}
