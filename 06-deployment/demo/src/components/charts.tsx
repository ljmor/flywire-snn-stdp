/* ---------------------------------------------------------------------------
   Result charts, in SVG.
   Design rules: one axis per chart, color by entity and never by value range,
   the lead series in their own color and the rest in neutral ink, every value
   labeled directly, a discreet grid.
--------------------------------------------------------------------------- */

import { useRef, type ReactNode } from 'react'

import {
  CHANCE,
  EFFICIENCY,
  ACCURACY,
  GRADIENT,
  INTERACTION,
  LATENCY,
  LATENCY_MS,
  PAIRS,
  SERIES,
  INPUT_CEILING,
} from '../data/constants'
import type { ModelName } from '../data/types'
import { useSize, dec3, thousands, signed } from '../core/util'

const NEUTRAL = '#7c8794'
const GRID = 'rgba(154,167,182,.14)'
const INK_2 = '#9aa7b6'
const INK_3 = '#6c7987'

const colorOf = (id?: ModelName) => (id ? SERIES[id].color : NEUTRAL)


/**
 * Figure wrapper: it measures its own width and passes it to the drawing, so
 * that each chart picks its height and its compact mode from the room it
 * actually has, not from the size of the window.
 */
function Figure({
  title,
  subtitle,
  height,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  height: number | ((width: number) => number)
  children: (width: number, height: number) => ReactNode
  footer?: ReactNode
}) {
  const box = useRef<HTMLDivElement>(null)
  const { width } = useSize(box)
  const h = typeof height === 'function' ? height(width || 900) : height
  return (
    <figure className="chart card">
      <figcaption>
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </figcaption>
      <div ref={box} className="chart-canvas" style={{ height: h }}>
        {width > 40 && (
          <svg width={width} height={h} role="img" aria-label={title}>
            {children(width, h)}
          </svg>
        )}
      </div>
      {footer && <div className="chart-footer">{footer}</div>}
    </figure>
  )
}

const isCompact = (width: number) => width < 560

/**
 * Spreads the end-of-line labels vertically so that they do not overlap when
 * two series end at almost the same value.
 */
function spreadLabels(values: number[], minGap = 13): number[] {
  const order = values.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y)
  for (let k = 1; k < order.length; k++)
    if (order[k].y - order[k - 1].y < minGap) order[k].y = order[k - 1].y + minGap
  const out = new Array<number>(values.length)
  for (const o of order) out[o.i] = o.y
  return out
}

/* ---------------------------------------------------- 1. accuracy per arm -- */
export function AccuracyBars() {
  const rows = ACCURACY
  const row = (width: number) => (isCompact(width) ? 58 : 46)
  const height = (width: number) =>
    rows.length * row(width) + (isCompact(width) ? 58 : 34)

  return (
    <Figure
      title="Classification accuracy"
      subtitle="Five songs, chance 0.200. Mean and standard deviation across seeds."
      height={height}
      footer={
        <p className="footnote">
          The <b>input-only ceiling</b> (0.223) is what the input layer achieves
          by itself, with no network behind it. Everything above that line is
          computed by the network. Hollow bars are the networks that do not
          learn.
        </p>
      }
    >
      {(width, height) => {
        const compact = isCompact(width)
        const rowHeight = row(width)
        const padLeft = compact ? 0 : Math.min(268, Math.max(150, width * 0.34))
        const padRight = compact ? 60 : 62
        const w = width - padLeft - padRight
        const x = (v: number) => padLeft + v * w

        return (
          <>
            {[0, 0.25, 0.5, 0.75, 1].map((v) => (
              <g key={v}>
                <line
                  x1={x(v)}
                  x2={x(v)}
                  y1={0}
                  y2={height - 24}
                  stroke={GRID}
                />
                <text
                  x={x(v)}
                  y={height - 8}
                  fill={INK_3}
                  fontSize="10.5"
                  textAnchor={v === 0 ? 'start' : v === 1 ? 'end' : 'middle'}
                  className="mono"
                >
                  {v.toFixed(2)}
                </text>
              </g>
            ))}

            {[
              { v: CHANCE, t: 'chance', d: '3 3', y: 10, isEnd: true },
              {
                v: INPUT_CEILING,
                t: 'input-only ceiling',
                d: '',
                y: compact ? 24 : 10,
                isEnd: false,
              },
            ].map((r) => (
              <g key={r.t}>
                <line
                  x1={x(r.v)}
                  x2={x(r.v)}
                  y1={0}
                  y2={height - 24}
                  stroke="rgba(233,238,245,.42)"
                  strokeDasharray={r.d || undefined}
                />
                <text
                  x={x(r.v) + (r.isEnd ? -6 : 6)}
                  y={r.y}
                  textAnchor={r.isEnd ? 'end' : 'start'}
                  fill={INK_2}
                  fontSize="10"
                  className="mono"
                >
                  {r.t}
                </text>
              </g>
            ))}

            {rows.map((f, i) => {
              const y = i * rowHeight + (compact ? 56 : 20)
              const c = colorOf(f.id)
              const hero = f.id === 'connectome_stdp'
              return (
                <g key={f.label}>
                  <title>
                    {f.label}: {dec3(f.value)} ± {dec3(f.sd)} (n = {f.n})
                  </title>
                  <text
                    x={compact ? 0 : padLeft - 12}
                    y={compact ? y - 8 : y + 12}
                    textAnchor={compact ? 'start' : 'end'}
                    fill={f.id ? c : INK_2}
                    fontSize={compact ? 11.5 : 12.5}
                    fontWeight={hero ? 700 : 500}
                  >
                    {f.label}
                  </text>
                  <rect
                    x={padLeft}
                    y={y}
                    width={Math.max(f.value * w, 2)}
                    height={17}
                    rx={4}
                    fill={f.learns ? c : 'none'}
                    fillOpacity={f.learns ? (hero ? 1 : 0.82) : 0}
                    stroke={c}
                    strokeWidth={f.learns ? 0 : 1.4}
                    strokeDasharray={f.learns ? undefined : '3 2.5'}
                  />
                  {/* standard deviation across seeds */}
                  <g stroke="rgba(233,238,245,.82)" strokeWidth={1.3}>
                    <line
                      x1={x(Math.max(f.value - f.sd, 0))}
                      x2={x(Math.min(f.value + f.sd, 1))}
                      y1={y + 8.5}
                      y2={y + 8.5}
                    />
                    <line
                      x1={x(Math.max(f.value - f.sd, 0))}
                      x2={x(Math.max(f.value - f.sd, 0))}
                      y1={y + 4}
                      y2={y + 13}
                    />
                    <line
                      x1={x(Math.min(f.value + f.sd, 1))}
                      x2={x(Math.min(f.value + f.sd, 1))}
                      y1={y + 4}
                      y2={y + 13}
                    />
                  </g>
                  <text
                    x={compact ? width : x(Math.min(f.value + f.sd, 1)) + 9}
                    y={y + 13}
                    textAnchor={compact ? 'end' : 'start'}
                    fill={f.id ? c : INK_2}
                    fontSize={compact ? 11.5 : 12.5}
                    fontWeight={700}
                    className="mono"
                  >
                    {dec3(f.value)}
                  </text>
                </g>
              )
            })}
          </>
        )
      }}
    </Figure>
  )
}

/* ------------------------------------------ 2. the interaction (the finding) */
export function InteractionChart() {
  const row = (width: number) => (isCompact(width) ? 96 : 74)
  const height = (width: number) =>
    INTERACTION.length * row(width) + (isCompact(width) ? 66 : 40)

  return (
    <Figure
      title="How much does learning add on each wiring?"
      subtitle="The same STDP rule and parameters, on networks of the same size and density."
      height={height}
      footer={
        <p className="footnote">
          Plasticity brings a significant improvement only on the biological
          wiring. On the control that keeps the degree sequence there is a gain,
          but it is not significant. On the random graph there is no gain at
          all.
        </p>
      }
    >
      {(width, height) => {
        const compact = isCompact(width)
        const rowHeight = row(width)
        const padLeft = compact ? 8 : Math.min(210, Math.max(112, width * 0.26))
        const padRight = compact ? 78 : 128
        const w = width - padLeft - padRight
        const x = (v: number) => padLeft + ((v - 0.35) / (0.95 - 0.35)) * w

        return (
          <>
            {[0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map((v) => (
              <g key={v}>
                <line x1={x(v)} x2={x(v)} y1={14} y2={height - 24} stroke={GRID} />
                <text
                  x={x(v)}
                  y={height - 8}
                  fill={INK_3}
                  fontSize="10.5"
                  textAnchor="middle"
                  className="mono"
                >
                  {v.toFixed(1)}
                </text>
              </g>
            ))}

            {INTERACTION.map((f, i) => {
              const y = i * rowHeight + (compact ? 70 : 44)
              const hero = f.topology === 'Connectome'
              const c = hero ? SERIES.connectome_stdp.color : NEUTRAL
              return (
                <g key={f.topology}>
                  <title>
                    {f.topology}: {dec3(f.staticAcc)} without learning →{' '}
                    {dec3(f.plasticAcc)} with STDP ({signed(f.delta)}, p = {f.p})
                  </title>
                  <text
                    x={compact ? 0 : padLeft - 14}
                    y={compact ? y - 34 : y + 4}
                    textAnchor={compact ? 'start' : 'end'}
                    fill={hero ? c : INK_2}
                    fontSize={compact ? 12 : 13}
                    fontWeight={hero ? 700 : 500}
                  >
                    {f.topology}
                  </text>

                  <line
                    x1={x(f.staticAcc)}
                    x2={x(f.plasticAcc)}
                    y1={y}
                    y2={y}
                    stroke={c}
                    strokeWidth={hero ? 4 : 2.5}
                    strokeOpacity={f.significant ? 0.85 : 0.35}
                    strokeLinecap="round"
                  />
                  <circle
                    cx={x(f.staticAcc)}
                    cy={y}
                    r={6}
                    fill="#0e1116"
                    stroke={c}
                    strokeWidth={2}
                  />
                  <circle cx={x(f.plasticAcc)} cy={y} r={7} fill={c} />

                  <text
                    x={x(f.staticAcc)}
                    y={Math.abs(x(f.plasticAcc) - x(f.staticAcc)) < 46 ? y + 20 : y - 15}
                    fill={INK_2}
                    fontSize="11"
                    textAnchor="middle"
                    className="mono"
                  >
                    {dec3(f.staticAcc)}
                  </text>
                  <text
                    x={x(f.plasticAcc)}
                    y={y - 16}
                    fill={hero ? c : INK_2}
                    fontSize="12"
                    fontWeight={700}
                    textAnchor="middle"
                    className="mono"
                  >
                    {dec3(f.plasticAcc)}
                  </text>

                  <text
                    x={width - 8}
                    y={y - 2}
                    textAnchor="end"
                    fill={f.significant ? c : INK_3}
                    fontSize="14"
                    fontWeight={700}
                    className="mono"
                  >
                    {signed(f.delta)}
                  </text>
                  <text
                    x={width - 8}
                    y={y + 14}
                    textAnchor="end"
                    fill={INK_3}
                    fontSize="10.5"
                    className="mono"
                  >
                    p = {f.p}
                    {f.significant ? ' ✓' : ''}
                  </text>
                </g>
              )
            })}

            <text x={padLeft} y={16} fill={INK_3} fontSize="10.5" className="mono">
              ○ without learning → ● with STDP
            </text>
          </>
        )
      }}
    </Figure>
  )
}

/* ----------------------------------------------------------- 3. latency ---- */
export function LatencyCurve() {
  const height = 300
  return (
    <Figure
      title="How much song it needs to get it right"
      subtitle="Accuracy against the milliseconds of response that the classifier sees."
      height={height}
      footer={
        <div className="legend">
          {LATENCY.map((s) => (
            <span
              key={s.label}
              style={{ color: s.id ? SERIES[s.id].color : INK_2 }}
            >
              <i className="dot" aria-hidden />
              {s.label}
            </span>
          ))}
        </div>
      }
    >
      {(width) => {
        const m = { i: 42, d: 86, s: 18, b: 34 }
        const w = width - m.i - m.d
        const h = height - m.s - m.b
        const x = (i: number) => m.i + (i / (LATENCY_MS.length - 1)) * w
        const y = (v: number) => m.s + (1 - (v - 0.25) / (0.95 - 0.25)) * h
        const yLabel = spreadLabels(LATENCY.map((s2) => y(s2.v[s2.v.length - 1])))

        return (
          <>
            {[0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map((v) => (
              <g key={v}>
                <line x1={m.i} x2={m.i + w} y1={y(v)} y2={y(v)} stroke={GRID} />
                <text
                  x={m.i - 8}
                  y={y(v) + 3.5}
                  textAnchor="end"
                  fill={INK_3}
                  fontSize="10.5"
                  className="mono"
                >
                  {v.toFixed(1)}
                </text>
              </g>
            ))}
            <line
              x1={m.i}
              x2={m.i + w}
              y1={y(INPUT_CEILING + 0.05)}
              y2={y(INPUT_CEILING + 0.05)}
              stroke="transparent"
            />
            {LATENCY_MS.map((ms, i) => (
              <text
                key={ms}
                x={x(i)}
                y={height - 12}
                textAnchor="middle"
                fill={INK_3}
                fontSize="11"
                className="mono"
              >
                {ms} ms
              </text>
            ))}

            {LATENCY.map((s, k) => {
              const c = colorOf(s.id)
              const hero = s.id === 'connectome_stdp'
              const d = s.v.map((v, i) => `${i ? 'L' : 'M'}${x(i)} ${y(v)}`).join(' ')
              return (
                <g key={s.label} opacity={s.id ? 1 : 0.5}>
                  <title>{s.label}</title>
                  <path
                    d={d}
                    fill="none"
                    stroke={c}
                    strokeWidth={hero ? 2.8 : 1.8}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {s.v.map((v, i) => (
                    <circle
                      key={i}
                      cx={x(i)}
                      cy={y(v)}
                      r={hero ? 4 : 2.6}
                      fill={c}
                      stroke="#0e1116"
                      strokeWidth={hero ? 1.6 : 1}
                    />
                  ))}
                  <text
                    x={m.i + w + 8}
                    y={yLabel[k] + 4}
                    fill={s.id ? c : INK_3}
                    fontSize="11"
                    fontWeight={hero ? 700 : 500}
                    className="mono"
                  >
                    {dec3(s.v[s.v.length - 1])}
                  </text>
                </g>
              )
            })}

            <g>
              <line
                x1={x(3)}
                x2={x(3)}
                y1={m.s}
                y2={m.s + h}
                stroke="rgba(233,238,245,.35)"
                strokeDasharray="3 3"
              />
              <text
                x={x(3) - 7}
                y={m.s + 12}
                textAnchor="end"
                fill={INK_2}
                fontSize="10.5"
                className="mono"
              >
                4 to 10 song pulses
              </text>
            </g>
          </>
        )
      }}
    </Figure>
  )
}

/* ------------------------------------------------------- 4. efficiency ---- */
export function EfficiencyBars() {
  const row = (width: number) => (isCompact(width) ? 54 : 40)
  const height = (width: number) => EFFICIENCY.length * row(width) + 16
  const maxVal = Math.max(...EFFICIENCY.map((f) => f.v))

  return (
    <Figure
      title="Spikes spent per correct answer"
      subtitle="On event-driven neuromorphic chips, energy is spent only when spikes occur. Fewer is better."
      height={height}
      footer={
        <p className="footnote">
          Among the networks that learn, the connectome needs{' '}
          <b>four times fewer spikes</b> than the random one and is right twice
          as often. The static connectome and the static configuration model
          spend fewer spikes, but they are much less accurate.
        </p>
      }
    >
      {(width) => {
        const compact = isCompact(width)
        const rowHeight = row(width)
        const padLeft = compact ? 0 : Math.min(232, Math.max(140, width * 0.32))
        const padRight = compact ? 68 : 78
        const w = width - padLeft - padRight
        return (
          <>
            {EFFICIENCY.map((f, i) => {
              const y = i * rowHeight + (compact ? 26 : 12)
              const c = colorOf(f.id)
              return (
                <g key={f.label}>
                  <title>
                    {f.label}: {thousands(f.v)} spikes per correct answer
                  </title>
                  <text
                    x={compact ? 0 : padLeft - 12}
                    y={compact ? y - 8 : y + 12}
                    textAnchor={compact ? 'start' : 'end'}
                    fill={f.id ? c : INK_2}
                    fontSize={compact ? 11.5 : 12.5}
                    fontWeight={f.id === 'connectome_stdp' ? 700 : 500}
                  >
                    {f.label}
                  </text>
                  <rect
                    x={padLeft}
                    y={y}
                    width={Math.max((f.v / maxVal) * w, 2)}
                    height={17}
                    rx={4}
                    fill={c}
                    fillOpacity={f.id ? 0.92 : 0.4}
                  />
                  <text
                    x={compact ? width : padLeft + (f.v / maxVal) * w + 9}
                    y={y + 13}
                    textAnchor={compact ? 'end' : 'start'}
                    fill={f.id ? c : INK_2}
                    fontSize={compact ? 11.5 : 12.5}
                    fontWeight={700}
                    className="mono"
                  >
                    {thousands(f.v)}
                  </text>
                </g>
              )
            })}
          </>
        )
      }}
    </Figure>
  )
}

/* --------------------------------------------------------- 5. gradient ---- */
export function GradientChart() {
  const height = 268
  return (
    <Figure
      title="The more alike the two songs, the more the wiring shows"
      subtitle="Only two songs per test, so chance here is 0.500, not 0.200 as everywhere else."
      height={height}
      footer={
        <div className="legend">
          {GRADIENT.map((s) => (
            <span
              key={s.label}
              style={{ color: s.id ? SERIES[s.id].color : INK_2 }}
            >
              <i className="dot" aria-hidden />
              {s.label}
            </span>
          ))}
        </div>
      }
    >
      {(width) => {
        const m = { i: 42, d: 72, s: 34, b: 40 }
        const w = width - m.i - m.d
        const h = height - m.s - m.b
        const x = (i: number) => m.i + (i / (PAIRS.length - 1)) * w
        const y = (v: number) => m.s + (1 - (v - 0.46) / (1.02 - 0.46)) * h
        const yLabel = spreadLabels(GRADIENT.map((s2) => y(s2.v[s2.v.length - 1])))

        return (
          <>
            {[0.5, 0.6, 0.7, 0.8, 0.9, 1].map((v) => (
              <g key={v}>
                <line x1={m.i} x2={m.i + w} y1={y(v)} y2={y(v)} stroke={GRID} />
                <text
                  x={m.i - 8}
                  y={y(v) + 3.5}
                  textAnchor="end"
                  fill={INK_3}
                  fontSize="10.5"
                  className="mono"
                >
                  {v.toFixed(1)}
                </text>
              </g>
            ))}
            <g>
              <line
                x1={m.i}
                x2={m.i + w}
                y1={y(0.5)}
                y2={y(0.5)}
                stroke={INK_3}
                strokeDasharray="3 3"
              />
              <text
                x={m.i + w}
                y={y(0.5) - 6}
                textAnchor="end"
                fill={INK_3}
                fontSize="10.5"
              >
                chance with two songs
              </text>
            </g>

            {PAIRS.map((p, i) => (
              <text
                key={p}
                x={x(i)}
                y={height - 16}
                textAnchor="middle"
                fill={INK_3}
                fontSize={isCompact(width) ? 9 : 11}
                className="mono"
              >
                {p}
              </text>
            ))}

            <g>
              <rect
                x={x(2) - 34}
                y={m.s - 26}
                width={68}
                height={19}
                rx={5}
                fill="rgba(239,162,43,.16)"
              />
              <text
                x={x(2)}
                y={m.s - 12}
                textAnchor="middle"
                fill="#efa22b"
                fontSize="10.5"
                fontWeight={700}
              >
                species
              </text>
              <line
                x1={x(2)}
                x2={x(2)}
                y1={m.s - 6}
                y2={m.s + h}
                stroke="rgba(239,162,43,.3)"
                strokeDasharray="3 3"
              />
            </g>

            {GRADIENT.map((s, k) => {
              const c = colorOf(s.id)
              const hero = s.id === 'connectome_stdp'
              const d = s.v.map((v, i) => `${i ? 'L' : 'M'}${x(i)} ${y(v)}`).join(' ')
              return (
                <g key={s.label} opacity={s.id ? 1 : 0.55}>
                  <title>{s.label}</title>
                  <path
                    d={d}
                    fill="none"
                    stroke={c}
                    strokeWidth={hero ? 2.8 : 1.8}
                    strokeLinejoin="round"
                  />
                  {s.v.map((v, i) => (
                    <circle
                      key={i}
                      cx={x(i)}
                      cy={y(v)}
                      r={hero ? 3.8 : 2.5}
                      fill={c}
                      stroke="#0e1116"
                      strokeWidth={1.2}
                    />
                  ))}
                  <text
                    x={m.i + w + 8}
                    y={yLabel[k] + 4}
                    fill={s.id ? c : INK_3}
                    fontSize="11"
                    fontWeight={hero ? 700 : 500}
                    className="mono"
                  >
                    {dec3(s.v[s.v.length - 1])}
                  </text>
                </g>
              )
            })}
          </>
        )
      }}
    </Figure>
  )
}
