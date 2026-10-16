/* ---------------------------------------------------------------------------
   The lab: a song plays and the three networks listen to it at the same time.
   Everything that moves here is real spikes of the Brian2 simulation.
--------------------------------------------------------------------------- */

import { useMemo, useRef, useState } from 'react'

import { trainKey } from '../data/load'
import {
  IPI_COLOR,
  SPECIES,
  SERIES_ORDER,
  SERIES,
  WINDOWS_MS,
} from '../data/constants'
import type { ModelName, Bundle } from '../data/types'
import {
  useEngine,
  availableWindow,
  type Engine,
  type Clock,
} from '../core/engine'
import { useLoop, useSize, thousands, pct } from '../core/util'
import { Brain, initialCamera } from '../three/Brain'
import { FitCamera, Scene } from '../three/Scene'
import { Equalizer, SongTimeline, Raster, RhythmTrace } from './canvases'
import { FadeIn, SongChip, Icon, Note, Section } from './ui'

/* -------------------------------------------------------------- controls -- */
function Controls({
  engine,
  classes,
}: {
  engine: Engine
  classes: number[]
}) {
  const playback = useEngine(engine)
  return (
    <div className="lab-bar">
      <div className="lab-bar-group">
        <span className="eyebrow">Song</span>
        <div className="chips">
          {classes.map((c) => (
            <SongChip
              key={c}
              ipi={c}
              active={playback.ipiClass === c}
              onClick={() => engine.selectClass(c)}
            />
          ))}
        </div>
      </div>

      <div className="lab-bar-group right">
        <button
          type="button"
          className="btn primary"
          onClick={() => engine.toggle()}
        >
          {playback.playing ? (
            <>
              <svg width="13" height="14" viewBox="0 0 12 14" aria-hidden>
                <rect x="0" y="0" width="4" height="14" rx="1.2" fill="currentColor" />
                <rect x="8" y="0" width="4" height="14" rx="1.2" fill="currentColor" />
              </svg>
              Pause
            </>
          ) : (
            <>
              <svg width="13" height="14" viewBox="0 0 12 14" aria-hidden>
                <path d="M1 1.2 11 7 1 12.8Z" fill="currentColor" />
              </svg>
              Listen
            </>
          )}
        </button>

        <div className="seg" role="group" aria-label="Speed">
          {[1, 0.5, 0.25].map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={playback.speed === v}
              onClick={() => engine.setSpeed(v)}
            >
              {v === 1 ? '1×' : v === 0.5 ? '½×' : '¼×'}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="icon-btn"
          onClick={() => engine.setMuted(!playback.muted)}
          aria-pressed={playback.muted}
          aria-label={playback.muted ? 'Turn the sound on' : 'Mute'}
          title={playback.muted ? 'Turn the sound on' : 'Mute'}
        >
          <Icon name={playback.muted ? 'mute' : 'sound'} size={17} />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={() => engine.restart()}
          aria-label="Back to the start"
          title="Back to the start"
        >
          <Icon name="restart" size={17} />
        </button>
      </div>

      {playback.audioBlocked && (
        <p className="notice">
          The browser blocked the audio. The simulation keeps running in
          silence; press “Listen” again to turn the sound on.
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------- 3D --- */
function TrioScene({
  bundle,
  ipiClass,
  clock,
  singleView,
  highlighted,
}: {
  bundle: Bundle
  ipiClass: number
  clock: Clock
  singleView: boolean
  highlighted: ModelName
}) {
  const cameraState = useMemo(initialCamera, [])
  const shown = singleView ? [highlighted] : SERIES_ORDER
  const spacing = 2.45
  const scale = singleView ? 0.95 : 0.64
  const worldWidth = singleView ? 2.95 : spacing * 2 + 2.05

  return (
    <Scene cameraState={cameraState} height="100%" auto={0.085} fov={42}>
      <FitCamera width={worldWidth} height={2.25} />
      {shown.map((id, k) => {
        const s = SERIES[id]
        const train = bundle.trains.get(trainKey(id, ipiClass)) ?? null
        const x = singleView ? 0 : (k - 1) * spacing
        return (
          <Brain
            key={id}
            network={bundle.network}
            topology={s.id === 'er_stdp' ? 'er' : 'connectome'}
            train={train}
            clock={clock}
            cameraState={cameraState}
            color={s.color}
            light={s.light}
            position={[x, 0, 0]}
            scale={scale}
            edgeOpacity={singleView ? 0.075 : 0.05}
            pointSize={singleView ? 3.0 : 3.6}
          />
        )
      })}
    </Scene>
  )
}

/* ------------------------------------------------------------ clip clock */
/**
 * Position within the clip, in seconds of SIGNAL, and number of the repeat. The
 * clip always lasts the same (2 s); what changes with the speed is how long it
 * takes to play, and that is why the clock time is given too.
 */
function ClipClock({
  engine,
  duration,
}: {
  engine: Engine
  duration: number
}) {
  const t = useRef<HTMLSpanElement>(null)
  const lap = useRef<HTMLSpanElement>(null)
  useLoop(() => {
    if (t.current)
      t.current.textContent = engine.clock.t.toFixed(2)
    if (lap.current)
      lap.current.textContent = String(engine.clock.lap + 1)
  })
  return (
    <span className="clip-clock num" aria-hidden>
      <b ref={t}>0.00</b>
      <i>/ {duration.toFixed(2)} s</i>
      <em>
        loop <span ref={lap}>1</span>
      </em>
    </span>
  )
}

/* --------------------------------------------------------------- verdict */
function useDecisionWindow(clock: Clock, active: boolean) {
  const [v, setV] = useState<number | null>(null)
  const prev = useRef<number | null>(null)
  useLoop(() => {
    const w = availableWindow(clock.t, WINDOWS_MS)
    if (w !== prev.current) {
      prev.current = w
      setV(w)
    }
  }, active)
  return v
}

function Verdict({
  id,
  ipiClass,
  classes,
  windowMs,
  bundle,
}: {
  id: ModelName
  ipiClass: number
  classes: number[]
  windowMs: number | null
  bundle: Bundle
}) {
  const model = bundle.meta.models[id]
  const sil = model.silhouette
  const k = classes.indexOf(ipiClass)
  const trueClass = model.true_classes[k]
  const pred = windowMs ? model.window_predictions[String(windowMs)]?.[k] : null
  const isCorrect = pred != null && pred === trueClass

  return (
    <div className="verdict">
      <div className="verdict-row">
        <span className="verdict-label">
          <em className="panel-step">3</em> Its answer
        </span>
        <div
          className={`verdict-value${pred == null ? ' empty' : isCorrect ? ' ok' : ' bad'}`}
          aria-live="polite"
        >
          {pred == null ? (
            <span className="waiting">listening…</span>
          ) : (
            <>
              <i
                className="verdict-dot"
                style={{ background: IPI_COLOR[pred] }}
                aria-hidden
              />
              <span className="num">{pred}</span>
              <span className="unit">ms</span>
              <span className="verdict-icon">{isCorrect ? '✓' : '✗'}</span>
            </>
          )}
        </div>
      </div>
      <p className="panel-micro">
        Separation between the responses to different songs:{' '}
        <b style={{ color: 'var(--series-light)' }}>
          {sil > 0 ? '+' : '−'}
          {Math.abs(sil).toFixed(2)}
        </b>{' '}
        · hearing the rhythm is not enough; each song needs its own response.
      </p>
      <div className="window-chips">
        {WINDOWS_MS.map((w) => {
          const p = model.window_predictions[String(w)]?.[k]
          const correct = p === trueClass
          const reached = windowMs != null && w <= windowMs
          return (
            <span
              key={w}
              className={`window-chip${reached ? (correct ? ' ok' : ' bad') : ''}`}
              title={`With ${w} ms of song it answers ${p} ms (true: ${trueClass} ms)`}
            >
              {w < 1000 ? `${w}` : `${w / 1000} s`}
            </span>
          )
        })}
      </div>
    </div>
  )
}

/* --------------------------------------------------------- network panel */
function NetworkPanel({
  id,
  bundle,
  engine,
  ipiClass,
  windowMs,
  highlighted,
  onHighlight,
}: {
  id: ModelName
  bundle: Bundle
  engine: Engine
  ipiClass: number
  windowMs: number | null
  highlighted: boolean
  onHighlight: () => void
}) {
  const s = SERIES[id]
  const meta = bundle.meta
  const model = meta.models[id]
  const classData = model.classes[String(ipiClass)]
  const stimulus = meta.stimuli.find((e) => e.ipi_class === ipiClass)!
  const train = bundle.trains.get(trainKey(id, ipiClass)) ?? null

  return (
    <article
      className={`network-panel${highlighted ? ' highlighted' : ''}${s.learns ? '' : ' frozen'}`}
      style={{ '--series': s.color, '--series-light': s.light } as React.CSSProperties}
    >
      <header className="panel-head">
        <button type="button" className="panel-title" onClick={onHighlight}>
          <i className="dot" aria-hidden />
          <span>{s.name}</span>
        </button>
        <span className="panel-tag">{s.wiring}</span>
      </header>

      <div className="panel-body">
        <div className="panel-block">
          <div className="panel-label">
            <span>
              <em className="panel-step">1</em> Does it hear the rhythm of the song?
            </span>
            <b className="num">{pct(classData.locking, 0)}</b>
          </div>
          <RhythmTrace
            classData={classData}
            stimulus={stimulus}
            clock={engine.clock}
            duration={meta.duration}
            stepMs={meta.rate_step_ms}
            color={s.color}
          />
          <p className="panel-micro">
            of the {stimulus.song_pulses.length} pulses of the song produce a rise
            in activity
          </p>
        </div>

        <div className="panel-block">
          <div className="panel-label">
            <span>
              <em className="panel-step">2</em> Each dot is a spike of one neuron
            </span>
            <b className="num">
              {thousands(classData.n_spikes)} <span className="unit">spikes</span>
            </b>
          </div>
          <Raster
            train={train}
            clock={engine.clock}
            duration={meta.duration}
            nNeurons={meta.n_neurons}
            nInput={meta.n_input}
            color={s.color}
            stimulus={stimulus}
          />
          <p className="panel-micro">
            top band: the 123 input neurons, which receive the same input
            in the three networks
          </p>
        </div>

        <Verdict
          id={id}
          ipiClass={ipiClass}
          classes={meta.classes}
          windowMs={windowMs}
          bundle={bundle}
        />
      </div>
    </article>
  )
}

/* ------------------------------------------------------------ scoreboard -- */
function Scoreboard({ bundle, ipiClass }: { bundle: Bundle; ipiClass: number }) {
  const [w, setW] = useState(250)
  const meta = bundle.meta
  return (
    <div className="scoreboard">
      <div className="scoreboard-head">
        <div>
          <span className="eyebrow">Scoreboard</span>
          <h3>
            With only{' '}
            <span className="num highlight">
              {w < 1000 ? `${w} ms` : `${w / 1000} s`}
            </span>{' '}
            of song
          </h3>
        </div>
        <div className="seg" role="group" aria-label="Evidence available">
          {WINDOWS_MS.map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={w === v}
              onClick={() => setW(v)}
            >
              {v < 1000 ? `${v} ms` : `${v / 1000} s`}
            </button>
          ))}
        </div>
      </div>

      <div className="scoreboard-table scroll-x">
        <table>
          <caption className="sr">
            Whether each network gets each song right with {w} milliseconds of evidence
          </caption>
          <thead>
            <tr>
              <th scope="col">Network</th>
              {meta.classes.map((c) => (
                <th
                  key={c}
                  scope="col"
                  className={c === ipiClass ? 'col-active' : undefined}
                >
                  <span className="num" style={{ color: IPI_COLOR[c] }}>
                    {c}
                  </span>
                  <em>ms</em>
                  {SPECIES[c] && <i>{SPECIES[c].name.split(' ')[1]}</i>}
                </th>
              ))}
              <th scope="col">Correct</th>
            </tr>
          </thead>
          <tbody>
            {SERIES_ORDER.map((id) => {
              const m = meta.models[id]
              const pred = m.window_predictions[String(w)] ?? []
              const ok = pred.filter((p, i) => p === m.true_classes[i]).length
              return (
                <tr key={id}>
                  <th scope="row" style={{ color: SERIES[id].color }}>
                    <i className="dot" aria-hidden />
                    {SERIES[id].name}
                  </th>
                  {meta.classes.map((c, i) => {
                    const correct = pred[i] === m.true_classes[i]
                    return (
                      <td
                        key={c}
                        className={`${correct ? 'ok' : 'bad'}${
                          c === ipiClass ? ' col-active' : ''
                        }`}
                      >
                        <span aria-hidden>{correct ? '✓' : '✗'}</span>
                        <span className="sr">
                          {correct ? 'correct' : `wrong, answers ${pred[i]} ms`}
                        </span>
                        {!correct && <em className="num">{pred[i]}</em>}
                      </td>
                    )
                  })}
                  <td className="total num">{ok}/5</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Note>
        One simulation run, with one seed: one presentation per song, with the
        weights learned (where the network learns) and then frozen.
        The figures with statistics (15 independent seeds in the arms that learn,
        5 in the static ones) are further down, in “The numbers”.
      </Note>
    </div>
  )
}

/* --------------------------------------------------------------- section */
export function Lab({
  bundle,
  engine,
}: {
  bundle: Bundle
  engine: Engine
}) {
  const playback = useEngine(engine)
  const meta = bundle.meta
  const box = useRef<HTMLDivElement>(null)
  const { width } = useSize(box)
  const singleView = width > 0 && width < 820
  const [highlighted, setHighlighted] = useState<ModelName>('connectome_stdp')
  const windowMs = useDecisionWindow(engine.clock, true)
  const stimulus = meta.stimuli.find((e) => e.ipi_class === playback.ipiClass)!

  return (
    <Section
      id="lab"
      eyebrow="The experiment, live"
      title={
        <>
          Three brains listen to{' '}
          <span className="accent-amber">the same song</span>
        </>
      }
      lead={
        <>
          Pick a song and press Listen. The three networks receive exactly the
          same input, neuron by neuron. All that differs between them is how
          they are wired and whether they are allowed to learn (STDP plus
          winner-take-all inhibition).
        </>
      }
      wide
    >
      <div className="lab" ref={box}>
        <Controls engine={engine} classes={meta.classes} />

        <FadeIn className="lab-stimulus card">
          <div className="lab-stimulus-head">
            <div>
              <span className="eyebrow">What is playing</span>
              <h3>
                Song with a pulse every{' '}
                <span className="num" style={{ color: IPI_COLOR[playback.ipiClass] }}>
                  {playback.ipiClass} ms
                </span>
                {SPECIES[playback.ipiClass] && (
                  <em className="species"> · {SPECIES[playback.ipiClass].name}</em>
                )}
              </h3>
            </div>
            <ClipClock engine={engine} duration={meta.duration} />
          </div>

          <p className="footnote">
            A clip of <b>{meta.duration.toFixed(1)} s that repeats in a
            loop</b>. Every axis in this section measures the time of the signal,
            not clock time
            {playback.speed !== 1 && (
              <>
                {' '}
                (at {playback.speed === 0.5 ? '½×' : '¼×'} those{' '}
                {meta.duration.toFixed(1)} s of song take{' '}
                <b>
                  {(meta.duration / playback.speed).toFixed(1)} s
                </b>{' '}
                to play)
              </>
            )}
            . Below is the artificial ear: 32 filters between 80 and 380 Hz, a
            range we chose so that it covers the carrier of the song pulses.
          </p>

          <SongTimeline
            stimulus={stimulus}
            clock={engine.clock}
            duration={meta.duration}
            windows={WINDOWS_MS}
            height={76}
            onSeek={(t) => engine.seek(t)}
          />
          <Equalizer
            stimulus={stimulus}
            clock={engine.clock}
            duration={meta.duration}
            cf={meta.cf}
          />
        </FadeIn>

        <div className="lab-3d">
          <TrioScene
            bundle={bundle}
            ipiClass={playback.ipiClass}
            clock={engine.clock}
            singleView={singleView}
            highlighted={highlighted}
          />
          <div className="lab-labels" aria-hidden>
            {(singleView ? [highlighted] : SERIES_ORDER).map((id) => (
              <span key={id} style={{ color: SERIES[id].color }}>
                <i className="dot" />
                {SERIES[id].name}
              </span>
            ))}
          </div>
          <span className="lab-hint">drag to rotate</span>
        </div>

        {singleView && (
          <div className="seg centered" role="group" aria-label="Network shown in 3D">
            {SERIES_ORDER.map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={highlighted === id}
                onClick={() => setHighlighted(id)}
              >
                {SERIES[id].shortName}
              </button>
            ))}
          </div>
        )}

        <div className="lab-panels">
          {SERIES_ORDER.map((id) => (
            <NetworkPanel
              key={id}
              id={id}
              bundle={bundle}
              engine={engine}
              ipiClass={playback.ipiClass}
              windowMs={windowMs}
              highlighted={highlighted === id}
              onHighlight={() => setHighlighted(id)}
            />
          ))}
        </div>

        <FadeIn className="card">
          <Scoreboard bundle={bundle} ipiClass={playback.ipiClass} />
        </FadeIn>
      </div>
    </Section>
  )
}
