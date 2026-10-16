import { useEffect, useMemo, useRef, useState } from 'react'

import { Lab } from './components/Lab'
import { Hero } from './components/Hero'
import {
  Navigation,
  Footer,
  SongSection,
  FindingSection,
  DecisionMapSection,
  NumbersSection,
  NetworksSection,
} from './components/sections'
import { loadBundle, url } from './data/load'
import type { Bundle } from './data/types'
import { Engine } from './core/engine'

function Loading({ fraction, label }: { fraction: number; label: string }) {
  return (
    <div className="loading">
      <div className="loading-box">
        <div className="loading-pulse" aria-hidden>
          <i />
          <i />
          <i />
        </div>
        <p className="eyebrow">Loading {label}</p>
        <div className="loading-bar">
          <i style={{ width: `${Math.round(fraction * 100)}%` }} />
        </div>
        <p className="footnote">
          1,239 neurons, 20,059 connections and the spike trains of three
          networks.
        </p>
      </div>
    </div>
  )
}

function LoadError({ message }: { message: string }) {
  return (
    <div className="loading">
      <div className="loading-box">
        <p className="eyebrow" style={{ color: 'var(--c-er-light)' }}>
          The data could not be loaded
        </p>
        <p className="footnote">{message}</p>
        <p className="footnote">
          The page reads its files from <code>06-deployment/demo/public/</code>.
          Serve the folder over HTTP (<code>npm run dev</code>); opening the
          file with a double click does not let the browser read the binary
          files.
        </p>
      </div>
    </div>
  )
}

export default function App() {
  const [bundle, setBundle] = useState<Bundle | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState({ f: 0.04, e: 'metadata' })

  useEffect(() => {
    let alive = true
    loadBundle((f, e) => alive && setLoading({ f, e })).then(
      (p) => alive && setBundle(p),
      (e: unknown) => alive && setLoadError(e instanceof Error ? e.message : String(e)),
    )
    return () => {
      alive = false
    }
  }, [])

  const engine = useMemo(
    () =>
      bundle
        ? new Engine(bundle.meta.duration, (c) => url(`audio/song-${c}.wav`))
        : null,
    [bundle],
  )

  useEffect(() => () => engine?.destroy(), [engine])

  // The audio starts the first time the interactive zone comes into view,
  // never when the page opens, and it stops when the zone leaves the screen.
  const zone = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = zone.current
    if (!el || !engine || typeof IntersectionObserver === 'undefined') return
    let isFirst = true
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          if (isFirst) {
            isFirst = false
            engine.play()
          }
        } else {
          engine.pause()
        }
      },
      { threshold: 0.12 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [engine])

  // keyboard shortcut: space to play or pause
  useEffect(() => {
    if (!engine) return
    const onKey = (e: KeyboardEvent) => {
      const targetEl = e.target as HTMLElement | null
      if (
        e.code !== 'Space' ||
        (targetEl &&
          /^(INPUT|TEXTAREA|BUTTON|SELECT|A|SUMMARY)$/.test(targetEl.tagName))
      )
        return
      e.preventDefault()
      engine.toggle()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [engine])

  if (loadError) return <LoadError message={loadError} />
  if (!bundle || !engine) return <Loading fraction={loading.f} label={loading.e} />

  return (
    <>
      <a className="skip-link" href="#lab">
        Skip to the live experiment
      </a>
      <span id="top" />
      <Navigation />
      <Hero bundle={bundle} />
      <main>
        <SongSection bundle={bundle} engine={engine} />
        <NetworksSection bundle={bundle} />
        <div ref={zone}>
          <Lab bundle={bundle} engine={engine} />
          <DecisionMapSection bundle={bundle} engine={engine} />
        </div>
        <NumbersSection />
        <FindingSection />
      </main>
      <Footer />
    </>
  )
}
