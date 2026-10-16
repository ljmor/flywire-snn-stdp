import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

import { IPI_COLOR, SPECIES } from '../data/constants'

/* ------------------------------------------------------------------ section */
export function Section({
  id,
  eyebrow,
  title,
  lead,
  children,
  wide,
}: {
  id?: string
  eyebrow?: string
  title?: ReactNode
  lead?: ReactNode
  children: ReactNode
  wide?: boolean
}) {
  return (
    <section id={id} className="section">
      <div className="frame" style={wide ? { maxWidth: 1420 } : undefined}>
        {(eyebrow || title || lead) && (
          <motion.header
            className="section-head"
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.55, ease: [0.22, 0.68, 0.24, 1] }}
          >
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            {title && <h2>{title}</h2>}
            {lead && <p className="lead">{lead}</p>}
          </motion.header>
        )}
        {children}
      </div>
    </section>
  )
}

export function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{
        duration: 0.6,
        delay: delay,
        ease: [0.22, 0.68, 0.24, 1],
      }}
    >
      {children}
    </motion.div>
  )
}

/** Chip of one song: the color comes from the ordinal ramp of the IPI. */
export function SongChip({
  ipi,
  active,
  onClick,
  compact,
}: {
  ipi: number
  active: boolean
  onClick: () => void
  compact?: boolean
}) {
  const species = SPECIES[ipi]
  return (
    <button
      type="button"
      className={`song-chip${active ? ' on' : ''}${compact ? ' compact' : ''}`}
      style={{ '--tone': IPI_COLOR[ipi] } as React.CSSProperties}
      onClick={onClick}
      aria-pressed={active}
      aria-label={`Song with an interval of ${ipi} milliseconds${
        species ? `, ${species.name}` : ''
      }`}
    >
      <i className="chip-dot" aria-hidden />
      <span className="chip-num num">{ipi}</span>
      <span className="chip-unit">ms</span>
      {species && !compact && <em className="chip-species">{species.name}</em>}
    </button>
  )
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="footnote">{children}</p>
}

/* -------------------------------------------------------------------- icons */
/** Stroke icons, a single line weight and a single base size (16). */
export function Icon({
  name,
  size = 16,
}: {
  name: 'sound' | 'mute' | 'restart' | 'fly'
  size?: number
}) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  if (name === 'sound')
    return (
      <svg {...common}>
        <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z" />
        <path d="M15.5 9a4 4 0 0 1 0 6" />
        <path d="M18 6.5a7.5 7.5 0 0 1 0 11" />
      </svg>
    )
  if (name === 'mute')
    return (
      <svg {...common}>
        <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z" />
        <path d="m16 10 4 4M20 10l-4 4" />
      </svg>
    )
  if (name === 'restart')
    return (
      <svg {...common}>
        <path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5" />
        <path d="M4 4v4h4" />
      </svg>
    )
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="none">
      <circle cx="12" cy="12" r="2.4" fill="currentColor" />
      <circle cx="5" cy="7" r="1.5" fill="currentColor" opacity=".75" />
      <circle cx="19" cy="7" r="1.5" fill="currentColor" opacity=".75" />
      <circle cx="5" cy="17" r="1.5" fill="currentColor" opacity=".75" />
      <circle cx="19" cy="17" r="1.5" fill="currentColor" opacity=".75" />
      <g stroke="currentColor" strokeWidth="1.3" opacity=".55">
        <path d="M6.3 7.9 10 11m8-3.1L14 11M6.3 16.1 10 13m8 3.1L14 13" />
      </g>
    </svg>
  )
}
