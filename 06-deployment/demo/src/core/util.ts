import { useEffect, useRef, useState, type RefObject } from 'react'

/** Is the element on screen (or about to be)? */
export function useOnScreen(
  ref: RefObject<Element | null>,
  margin = '260px',
): boolean {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const io = new IntersectionObserver(
      ([e]) => setVisible(e.isIntersecting),
      { rootMargin: margin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [ref, margin])
  return visible
}

/** Size of the element in CSS pixels. */
export function useSize(ref: RefObject<Element | null>) {
  const [dims, setDims] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const r = e.contentRect
      setDims((m) =>
        Math.abs(m.width - r.width) < 0.5 && Math.abs(m.height - r.height) < 0.5
          ? m
          : { width: r.width, height: r.height },
      )
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return dims
}

export function useMediaQuery(query: string): boolean {
  const [v, setV] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia(query).matches,
  )
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return
    const mm = matchMedia(query)
    const fn = () => setV(mm.matches)
    fn()
    mm.addEventListener('change', fn)
    return () => mm.removeEventListener('change', fn)
  }, [query])
  return v
}

export const useReducedMotion = () =>
  useMediaQuery('(prefers-reduced-motion: reduce)')

/** Drawing loop owned by the component, running only while `active`. */
export function useLoop(fn: (dt: number, now: number) => void, active = true) {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => {
    if (!active) return
    let id = 0
    let prev = performance.now()
    const step = (now: number) => {
      const dt = Math.min((now - prev) / 1000, 0.1)
      prev = now
      ref.current(dt, now)
      id = requestAnimationFrame(step)
    }
    id = requestAnimationFrame(step)
    return () => cancelAnimationFrame(id)
  }, [active])
}

/* ----------------------------------------------------------------- formatters */
export const pct = (v: number, dec = 1) => `${(v * 100).toFixed(dec)} %`

export const dec3 = (v: number) => v.toFixed(3)

export const thousands = (v: number) =>
  Math.round(v)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',')

export const signed = (v: number, dec = 3) =>
  `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(dec)}`

export const clamp = (v: number, a: number, b: number) =>
  v < a ? a : v > b ? b : v
