import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'

import { url } from '../data/load'
import {
  CHANCE,
  CONTRASTS,
  IPI_COLOR,
  CREDITS,
  SPECIES,
  REFERENCES,
  N_INPUT,
  N_NEURONS,
  N_CONNECTIONS,
  SERIES_ORDER,
  SERIES,
  SNAPSHOT,
  INPUT_CEILING,
} from '../data/constants'
import type { ModelName, Bundle } from '../data/types'
import { useEngine, type Engine } from '../core/engine'
import { dec3, thousands, pct, signed } from '../core/util'
import { Brain, initialCamera } from '../three/Brain'
import { FitCamera, Scene } from '../three/Scene'
import {
  EfficiencyBars,
  AccuracyBars,
  LatencyCurve,
  GradientChart,
  InteractionChart,
} from './charts'
import { SongTimeline, DecisionMap, ConnectionMatrix } from './canvases'
import { FadeIn, SongChip, Icon, Note, Section } from './ui'

/* ======================================================= 1 · THE SONG ===== */

function EarGame() {
  const ROUNDS = 6
  const OPTIONS = [35, 55]
  const clips = useRef<Record<number, HTMLAudioElement>>({})
  const [roundNum, setRoundNum] = useState(0)
  const [score, setScore] = useState(0)
  const [currentSong, setCurrentSong] = useState<number | null>(null)
  const [lastAnswer, setLastAnswer] = useState<{ chosen: number; correct: boolean } | null>(
    null,
  )

  useEffect(() => {
    for (const c of OPTIONS) {
      const a = new Audio(url(`audio/song-${c}.wav`))
      a.preload = 'auto'
      clips.current[c] = a
    }
    return () => {
      for (const a of Object.values(clips.current)) a.pause()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const playClip = (c: number) => {
    for (const a of Object.values(clips.current)) {
      a.pause()
      a.currentTime = 0
    }
    const a = clips.current[c]
    if (a) void a.play().catch(() => undefined)
  }

  const start = () => {
    setRoundNum(1)
    setScore(0)
    setLastAnswer(null)
    const c = OPTIONS[Math.random() < 0.5 ? 0 : 1]
    setCurrentSong(c)
    playClip(c)
  }

  const answer = (chosen: number) => {
    if (currentSong == null || lastAnswer) return
    const correct = chosen === currentSong
    setLastAnswer({ chosen, correct })
    if (correct) setScore((p) => p + 1)
  }

  const nextRound = () => {
    setLastAnswer(null)
    if (roundNum >= ROUNDS) {
      setRoundNum(ROUNDS + 1)
      setCurrentSong(null)
      return
    }
    setRoundNum((r) => r + 1)
    const c = OPTIONS[Math.random() < 0.5 ? 0 : 1]
    setCurrentSong(c)
    playClip(c)
  }

  const finished = roundNum > ROUNDS

  return (
    <div className="game card">
      <header>
        <span className="eyebrow">Test yourself</span>
        <h3>Can you tell the two species apart?</h3>
        <p className="footnote">
          One of the two songs plays at random. Only the time from one pulse to
          the next changes: 35 ms is typical of{' '}
          <i>D. melanogaster</i>, and 55 ms is in the range of <i>D. simulans</i>.
        </p>
      </header>

      <div className="game-refs">
        {OPTIONS.map((c) => (
          <button
            key={c}
            type="button"
            className="game-ref"
            style={{ '--tone': IPI_COLOR[c] } as React.CSSProperties}
            onClick={() => playClip(c)}
          >
            <i aria-hidden />
            <span>
              <b className="num">{c} ms</b>
              <em>{SPECIES[c].name}</em>
            </span>
            <span className="game-listen">play reference</span>
          </button>
        ))}
      </div>

      {roundNum === 0 && (
        <button type="button" className="btn primary wide" onClick={start}>
          Start the {ROUNDS} rounds
        </button>
      )}

      {roundNum > 0 && !finished && (
        <div className="game-round">
          <div className="game-progress">
            <span className="eyebrow">
              Round {roundNum} of {ROUNDS}
            </span>
            <div className="game-bar">
              <i style={{ width: `${((roundNum - 1) / ROUNDS) * 100}%` }} />
            </div>
            <span className="num">
              {score} right answer{score === 1 ? '' : 's'}
            </span>
          </div>

          <button
            type="button"
            className="btn ghost wide"
            onClick={() => currentSong != null && playClip(currentSong)}
          >
            Play it again
          </button>

          <div className="game-options">
            {OPTIONS.map((c) => {
              const mark =
                lastAnswer && (c === currentSong ? 'correct' : lastAnswer.chosen === c ? 'wrong' : '')
              return (
                <button
                  key={c}
                  type="button"
                  className={`game-option ${mark || ''}`}
                  style={{ '--tone': IPI_COLOR[c] } as React.CSSProperties}
                  onClick={() => answer(c)}
                  disabled={!!lastAnswer}
                >
                  <b className="num">{c} ms</b>
                  <em>{SPECIES[c].name}</em>
                </button>
              )
            })}
          </div>

          <AnimatePresence>
            {lastAnswer && (
              <motion.div
                className={`game-feedback ${lastAnswer.correct ? 'ok' : 'bad'}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <span>
                  {lastAnswer.correct ? '✓ It was ' : '✗ It was '}
                  <b className="num">{currentSong} ms</b>
                </span>
                <button type="button" className="btn ghost" onClick={nextRound}>
                  {roundNum >= ROUNDS ? 'See your score' : 'Next'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {finished && (
        <motion.div
          className="game-final"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="game-score">
            <div>
              <span className="eyebrow">Your score</span>
              <b className="num large">
                {score}/{ROUNDS}
              </b>
              <em>{pct(score / ROUNDS, 0)} correct</em>
            </div>
            <div className="game-vs">versus</div>
            <div className="winner">
              <span className="eyebrow">Connectome + STDP</span>
              <b className="num large">0.998</b>
              <em>on this same pair of songs</em>
            </div>
          </div>
          <p className="footnote">
            The figure of the network is its accuracy on the pair 35 vs 55 ms, in
            a test with only these two songs, where chance is 0.500. It comes
            from the difficulty gradient of the evaluation, with 15 seeds.
          </p>
          <button type="button" className="btn ghost wide" onClick={start}>
            Play again
          </button>
        </motion.div>
      )}
    </div>
  )
}

export function SongSection({
  bundle,
  engine,
}: {
  bundle: Bundle
  engine: Engine
}) {
  const playback = useEngine(engine)
  const meta = bundle.meta
  const stimulus = meta.stimuli.find((e) => e.ipi_class === playback.ipiClass)!

  return (
    <Section
      id="song"
      eyebrow="Step 1 · The problem"
      title={
        <>
          The whole difference lies in{' '}
          <span className="accent-amber">the time</span> between two
          pulses
        </>
      }
      lead={
        <>
          The male <i>Drosophila</i> courts by vibrating one wing. It does not
          sing a melody. It makes short, dry clicks, the song pulses, always
          alike. One of the main cues the female uses to recognize her own
          species is{' '}
          <b>how much time passes from one pulse to the next</b>. That
          interval is about 34 ms in <i>D. melanogaster</i>, and longer
          in <i>D. simulans</i>, whose range includes 55 ms.
        </>
      }
    >
      <div className="song-grid">
        <FadeIn className="card song-card">
          <div className="block-head">
            <div>
              <span className="eyebrow">The five songs of the experiment</span>
              <h3>
                Same pulse, different interval:{' '}
                <span className="num" style={{ color: IPI_COLOR[playback.ipiClass] }}>
                  {playback.ipiClass} ms
                </span>
              </h3>
            </div>
            <button
              type="button"
              className="btn primary"
              onClick={() => engine.toggle()}
            >
              {playback.playing ? 'Pause' : 'Listen'}
            </button>
          </div>

          <div className="chips">
            {meta.classes.map((c) => (
              <SongChip
                key={c}
                ipi={c}
                active={playback.ipiClass === c}
                onClick={() => engine.selectClass(c)}
              />
            ))}
          </div>

          <SongTimeline
            stimulus={stimulus}
            clock={engine.clock}
            duration={meta.duration}
            height={92}
            onSeek={(t) => engine.seek(t)}
          />

          <div className="block-notes">
            <p className="footnote">
              Each line is a song pulse. The five songs use exactly the same
              carrier of 250 Hz, and the input layer receives the same number of
              spikes per second on average, so <b>their spectra are very
              similar</b>. The only clue is the rhythm. That is why this task
              cannot be solved by “looking at” the sound; the network has to
              compute time.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <EarGame />
        </FadeIn>
      </div>
    </Section>
  )
}

/* =================================================== 2 · THE NETWORKS ===== */

function WiringView({
  bundle,
  topology,
  color,
  light,
}: {
  bundle: Bundle
  topology: 'connectome' | 'er'
  color: string
  light: string
}) {
  const cameraState = useMemo(initialCamera, [])
  return (
    <Scene cameraState={cameraState} height="300px" auto={0.14} fov={40}>
      <FitCamera width={3.05} height={2.35} />
      <Brain
        network={bundle.network}
        topology={topology}
        train={null}
        clock={{ t: 0, lap: 0 }}
        cameraState={cameraState}
        color={color}
        light={light}
        edgeOpacity={0.09}
        pointSize={3.1}
      />
    </Scene>
  )
}

export function NetworksSection({ bundle }: { bundle: Bundle }) {
  const totalConnectome = bundle.network.topologies.connectome.total
  const drawnEdges = bundle.network.topologies.connectome.a.length

  return (
    <Section
      id="networks"
      eyebrow="Step 2 · The trick of the experiment"
      title={
        <>
          We copied the brain and then{' '}
          <span className="accent-orange">threw its wires at random</span>
        </>
      }
      lead={
        <>
          To know whether the wiring matters, it has to be compared with
          something. So we built a twin network with the same{' '}
          {thousands(N_NEURONS)} neurons, the same number of connections,{' '}
          {thousands(N_CONNECTIONS)}, weights drawn from the same distribution
          and the same input, but with every connection placed at random. And a third one, with
          the good wiring and learning switched off.
        </>
      }
    >
      <div className="wirings-grid">
        {(
          [
            {
              topology: 'connectome' as const,
              title: 'Real wiring',
              detail: `Connectome ${SNAPSHOT} · auditory circuit of Johnston’s organ`,
              color: SERIES.connectome_stdp.color,
              light: SERIES.connectome_stdp.light,
              text:
                'Each thread is a connection that exists in a fly brain, reconstructed synapse by synapse from electron microscopy images.',
            },
            {
              topology: 'er' as const,
              title: 'Random wiring',
              detail: 'Erdős–Rényi · same number of connections',
              color: SERIES.er_stdp.color,
              light: SERIES.er_stdp.light,
              text:
                'The same number of connections, spread uniformly over all the neurons. No bundles, no layers, no specialization. A uniform tangle.',
            },
          ] as const
        ).map((v, i) => (
          <FadeIn key={v.topology} delay={i * 0.1} className="card wiring-card">
            <header>
              <h3 style={{ color: v.color }}>{v.title}</h3>
              <p className="footnote">{v.detail}</p>
            </header>
            <WiringView
              bundle={bundle}
              topology={v.topology}
              color={v.color}
              light={v.light}
            />
            <p className="footnote">{v.text}</p>

            <div className="matrix-block">
              <span className="eyebrow">Who connects to whom</span>
              <ConnectionMatrix
                edges={bundle.network.topologies[v.topology]}
                side={bundle.network.matrixSide}
                color={v.color}
              />
              <dl className="matrix-stats">
                <div>
                  <dt className="num" style={{ color: v.color }}>
                    {bundle.network.topologies[v.topology].clustering
                      .toFixed(3)}
                  </dt>
                  <dd>clustering: how often two neighbors of a neuron are also neighbors</dd>
                </div>
                <div>
                  <dt className="num" style={{ color: v.color }}>
                    {thousands(bundle.network.topologies[v.topology].reciprocalPairs)}
                  </dt>
                  <dd>pairs of neurons connected in both directions</dd>
                </div>
              </dl>
            </div>
          </FadeIn>
        ))}
      </div>

      <FadeIn delay={0.15}>
        <div className="equality card">
          <div className="equality-col">
            <span className="eyebrow">Identical in the three networks</span>
            <ul>
              <li>
                <b className="num">{thousands(N_NEURONS)}</b> neurons
              </li>
              <li>
                <b className="num">{thousands(N_CONNECTIONS)}</b> connections,
                with the same number of excitatory, inhibitory and modulatory
                ones
              </li>
              <li>
                <b className="num">{N_INPUT}</b> input neurons and the same
                artificial ear of 32 channels
              </li>
              <li>the same distribution of synaptic weights</li>
              <li>
                the same <b>operating point</b>: all three fire at 10 Hz on
                average before learning starts
              </li>
              <li>the same stimuli and the same output classifier</li>
            </ul>
          </div>
          <div className="equality-col different">
            <span className="eyebrow">The only thing that changes</span>
            <p className="equality-key">
              who is connected to whom
              <em>and whether learning is allowed</em>
            </p>
            <p className="footnote">
              Matching the operating point keeps the comparison from measuring
              excitability instead of structure. Without that step, a more
              “nervous” network would look smarter. Learning means STDP
              together with winner-take-all (WTA) inhibition, a pool of
              inhibitory neurons that lets a few neurons specialize. The
              networks without learning have neither.
            </p>
          </div>
        </div>
      </FadeIn>

      <div className="arms-grid">
        {SERIES_ORDER.map((id, i) => {
          const s = SERIES[id]
          return (
            <FadeIn key={id} delay={i * 0.08}>
              <article
                className="arm-card card"
                style={{ '--series': s.color } as React.CSSProperties}
              >
                <span className="arm-num num">{i + 1}</span>
                <h4 style={{ color: s.color }}>{s.name}</h4>
                <p>{s.summary}</p>
                <div className="arm-tags">
                  <span className="tag">{s.wiring}</span>
                  <span className={`tag ${s.learns ? 'yes' : 'no'}`}>
                    {s.learns ? 'learns (STDP)' : 'does not learn'}
                  </span>
                </div>
              </article>
            </FadeIn>
          )
        })}
      </div>

      <Note>
        The 3D view draws a sample of {thousands(drawnEdges)} of the{' '}
        {thousands(totalConnectome)} connections so that the wiring can be
        seen; the simulation uses all of them. The position of each neuron
        comes from a spectral embedding computed on the real wiring, with the
        input neurons anchored on the two arcs of the antennae and sorted by
        frequency.
      </Note>
    </Section>
  )
}

/* ================================================== 3 · DECISION MAP ==== */

export function DecisionMapSection({
  bundle,
  engine,
}: {
  bundle: Bundle
  engine: Engine
}) {
  const playback = useEngine(engine)
  const meta = bundle.meta

  return (
    <Section
      id="map"
      eyebrow="Step 4 · What the classifier sees"
      title={
        <>
          Learning is not firing more.{' '}
          <span className="accent">It is sorting</span>
        </>
      }
      lead={
        <>
          At the end of the network sits a very simple readout. It counts how
          many times each neuron fired, and then it decides. Here that count is
          compressed into two dimensions. Each dot is a test presentation, and
          its color is the song that was playing. If the network separates the
          songs, five clouds appear.
        </>
      }
      wide
    >
      <div className="maps-grid">
        {SERIES_ORDER.map((id, i) => {
          const s = SERIES[id]
          const m = meta.models[id]
          return (
            <FadeIn key={id} delay={i * 0.09}>
              <article
                className="map-card card"
                style={{ '--series': s.color } as React.CSSProperties}
              >
                <header>
                  <h3 style={{ color: s.color }}>
                    <i className="dot" aria-hidden />
                    {s.name}
                  </h3>
                  <div className="silhouette">
                    <span className="eyebrow">Separation</span>
                    <b className="num" style={{ color: s.color }}>
                      {m.silhouette > 0 ? '+' : '−'}
                      {Math.abs(m.silhouette).toFixed(2)}
                    </b>
                    <div className="silhouette-bar">
                      <i
                        style={{
                          left: `${((Math.max(Math.min(m.silhouette, 0.6), -0.3) + 0.3) / 0.9) * 100}%`,
                          background: s.color,
                        }}
                      />
                    </div>
                  </div>
                </header>
                <DecisionMap
                  model={m}
                  ipiClass={playback.ipiClass}
                  classes={meta.classes}
                  clock={engine.clock}
                  duration={meta.duration}
                  color={s.color}
                />
                <p className="footnote">
                  {id === 'connectome_stdp'
                    ? 'Five clean clouds. Each song has a place of its own.'
                    : id === 'connectome_static'
                      ? 'The good wiring follows the song, but each presentation lands somewhere else. A good microphone with a poor code.'
                      : 'All bunched together. The network fires a lot, but its response depends only weakly on the song.'}
                </p>
              </article>
            </FadeIn>
          )
        })}
      </div>

      <div className="legend-ipi">
        <span className="eyebrow">Dot color = song</span>
        {meta.classes.map((c) => (
          <span key={c} style={{ color: IPI_COLOR[c] }}>
            <i className="dot" aria-hidden />
            <b className="num">{c}</b> ms
          </span>
        ))}
        <span className="legend-trail">
          the trail follows the song that is playing now
        </span>
      </div>

      <Note>
        The “separation” figure is the mean silhouette of the five classes in
        the space of spike counts that the classifier reads (50 test
        presentations, frozen weights). It goes from −1 to +1. Above 0 the
        classes form groups; below 0 they are mixed.
      </Note>
    </Section>
  )
}

/* ===================================================== 4 · THE NUMBERS == */

export function NumbersSection() {
  return (
    <Section
      id="numbers"
      eyebrow="Step 5 · The numbers"
      title="Six networks, many seeds, one conclusion"
      lead={
        <>
          Everything above comes from one simulation run, with one seed. It shows
          the mechanism, but it does not prove anything. The proof is in these
          figures. Each of the 3 wirings was tested with and without
          plasticity (a factorial design of six arms), repeating every run with
          15 independent seeds in the arms that learn and 5 in the static ones.
        </>
      }
      wide
    >
      <div className="charts-grid">
        <FadeIn className="full-width">
          <AccuracyBars />
        </FadeIn>
        <FadeIn className="full-width">
          <InteractionChart />
        </FadeIn>
        <FadeIn>
          <LatencyCurve />
        </FadeIn>
        <FadeIn delay={0.08}>
          <GradientChart />
        </FadeIn>
        <FadeIn className="full-width">
          <EfficiencyBars />
        </FadeIn>
      </div>

      <FadeIn>
        <div className="contrasts card">
          <header>
            <span className="eyebrow">Contrasts paired by seed</span>
            <h3>The connectome with plasticity beats the other five arms</h3>
          </header>
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th scope="col">Against</th>
                  <th scope="col">Δ accuracy</th>
                  <th scope="col">p</th>
                  <th scope="col">Cohen’s d</th>
                </tr>
              </thead>
              <tbody>
                {CONTRASTS.map((c) => (
                  <tr key={c.against} className={c.decisive ? 'decisive' : undefined}>
                    <th scope="row">{c.against}</th>
                    <td className="num highlight">{signed(c.delta)}</td>
                    <td className="num">{c.p}</td>
                    <td className="num">{c.d.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="footnote">
            The last row is the one that matters most. The “configuration
            model” keeps, almost exactly, the degree sequence of the connectome (each neuron
            keeps its number of connections) and only rewires where they go. So
            the advantage is not explained by a few highly connected neurons
            alone. It also depends on{' '}
            <b>the fine pattern of who connects to whom</b>. The p-values are
            not corrected for multiple comparisons. With the strict Bonferroni
            correction this row would not reach significance; with the Holm
            correction it would.
          </p>
        </div>
      </FadeIn>

      <Note>
        Chance {dec3(CHANCE)} · input-only ceiling {dec3(INPUT_CEILING)} ·
        accuracy measured on presentations never seen before, with seeds
        disjoint from the training ones. Full detail in{' '}
        <code>05-evaluation/results.md</code>.
      </Note>
    </Section>
  )
}

/* ===================================================== 5 · THE FINDING == */

export function FindingSection() {
  return (
    <Section id="finding" eyebrow="The conclusion">
      <FadeIn>
        <blockquote className="quote">
          <p>
            The wiring produced by evolution{' '}
            <span className="accent">turns local plasticity into
            useful learning</span>. Random wiring wastes it.
          </p>
          <footer>
            On this task, the same learning rule, on networks of the same size
            and density, only pays off significantly on the biological wiring.
          </footer>
        </blockquote>
      </FadeIn>

      <div className="conclusion-grid">
        <FadeIn>
          <article className="card text-card">
            <span className="eyebrow">Why it matters</span>
            <h3>A design rule for hardware that already exists</h3>
            <p>
              Neuromorphic chips can learn on the chip itself. Loihi supports
              programmable learning rules, and SpiNNaker runs rules such as STDP
              in software. Networks for these chips are usually trained
              elsewhere, built by hand for one task, or connected at random. Our
              result suggests that this starting wiring is{' '}
              <b>not a neutral choice</b>: on this task it decided whether
              learning was of any use. Structured wirings taken from biological
              circuits of the matching sensory domain are a natural starting
              point.
            </p>
          </article>
        </FadeIn>

        <FadeIn delay={0.08}>
          <article className="card text-card">
            <span className="eyebrow">Where it could be used</span>
            <h3>Rhythm detectors for small sensors</h3>
            <p>
              The circuit works on intervals of tens of milliseconds. Other
              signals have the same shape, such as the impacts of a damaged
              bearing in a motor, or the calls of crickets, katydids and frogs,
              which repeat at a rate typical of each species. A detector of about
              1,200 neurons that decides with 250 ms of signal, whose plasticity
              needs no labels (only the final readout is trained with them),
              is a plausible template for sensors of that kind. We have not yet
              tested whether the advantage carries over to those rhythms.
            </p>
          </article>
        </FadeIn>

        <FadeIn delay={0.16} className="limits-slot">
          <article className="card text-card limits">
            <span className="eyebrow">What this work does not claim</span>
            <h3>The limits, stated up front</h3>
            <ul>
              <li>
                <b>There is no energy advantage over conventional networks.</b>{' '}
                We estimated it and ruled it out. On a five-class task, a linear
                classifier is cheaper. The energy efficiency of spiking networks
                is cited from the literature as motivation, not as a result of
                this work.
              </li>
              <li>
                <b>It does not process broadband audio.</b> The filterbank
                covers 80–380 Hz, and nothing is claimed outside that range.
              </li>
              <li>
                <b>The advantage may depend on the time scale.</b> The intervals
                we tested go from 25 to 65 ms, close to the time constants of the
                model. We expect the advantage to fade for rhythms of hundreds of
                milliseconds, such as a musical beat. That is a hypothesis we
                have not tested.
              </li>
              <li>
                <b>Its resolution has a limit we have not measured.</b> The
                hardest pair tested, 45 vs 55 ms, is still told apart (0.955 for
                the connectome with plasticity). Finer differences, such as the
                variation within one species, were not tested.
              </li>
              <li>
                <b>The task is a stand-in.</b> In the fly, the preference for
                the song interval appears further along the auditory pathway,
                not in this first circuit. We use the interval to test the
                wiring, not as a model of what the circuit does.
              </li>
              <li>
                <b>There is no device yet.</b> What exists is a principle, a
                method and a plan for the next steps.
              </li>
            </ul>
          </article>
        </FadeIn>
      </div>
    </Section>
  )
}

/* ============================================================ 6 · FOOTER == */

export function Footer() {
  return (
    <footer className="footer">
      <div className="frame">
        <div className="footer-grid">
          <div>
            <span className="eyebrow">Credits</span>
            <h3>{CREDITS.title}</h3>
            <p className="footnote">
              {CREDITS.authors} · Advisor: {CREDITS.advisor}
              <br />
              {CREDITS.institution}
            </p>
          </div>
          <div>
            <span className="eyebrow">Reproduce</span>
            <pre className="code-block">
              <code>{`pip install -r requirements-lock.txt
python 06-deployment/pipeline.py
cd 06-deployment/demo && npm ci && npm run build`}</code>
            </pre>
            <p className="footnote">
              The full pipeline also needs the FlyWire connection table, which
              is too large for the repository; 06-deployment/README.md explains
              how to download it. The spikes in the demo come from a Brian2
              simulation of three of
              the six networks, one presentation per song. The script that
              exported that simulation is not in the repository; prepare_assets.py
              documents the format of the files it produced.
            </p>
          </div>
        </div>

        <details className="references">
          <summary>Data and references</summary>
          <ul>
            {REFERENCES.map((f) => (
              <li key={f.text}>
                <span>{f.text}</span>
                <em>{f.note}</em>
              </li>
            ))}
          </ul>
          <p className="footnote">
            This work uses the connectome of <i>Drosophila melanogaster</i>{' '}
            built by FlyWire. FlyWire was created at Princeton University with
            support from the US BRAIN Initiative (grants MH117815, MH129268 and
            U24 NS126935 to Murthy and Seung), and its neurons were proofread and
            annotated by the FlyWire Consortium, a community of scientists around
            the world. The published FlyWire data are licensed under{' '}
            <a href="https://creativecommons.org/licenses/by-nc/4.0/">CC BY-NC 4.0</a>;
            this demo uses only data already released in snapshot {SNAPSHOT}.
          </p>
        </details>
      </div>
    </footer>
  )
}

/* ====================================================== fixed navigation === */

const NAV_ITEMS: { id: string; text: string }[] = [
  { id: 'song', text: 'The song' },
  { id: 'networks', text: 'The networks' },
  { id: 'lab', text: 'Live' },
  { id: 'map', text: 'The decision' },
  { id: 'numbers', text: 'The numbers' },
  { id: 'finding', text: 'The conclusion' },
]

export function Navigation() {
  const [active, setActive] = useState('song')
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const sections = NAV_ITEMS.map((a) => document.getElementById(a.id)).filter(
      Boolean,
    ) as HTMLElement[]
    const io = new IntersectionObserver(
      (observed) => {
        const mostVisible = observed
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (mostVisible) setActive(mostVisible.target.id)
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.2, 0.6] },
    )
    sections.forEach((s) => io.observe(s))
    const onScroll = () => setScrolled(window.scrollY > 240)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      io.disconnect()
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  return (
    <nav className={`nav${scrolled ? ' scrolled' : ''}`} aria-label="Sections">
      <div className="frame nav-frame">
        <a className="nav-logo" href="#top">
          <span className="nav-icon" aria-hidden>
            <Icon name="fly" size={19} />
          </span>
          <span>
            Connectome <em>+ STDP</em>
          </span>
        </a>
        <ul>
          {NAV_ITEMS.map((a) => (
            <li key={a.id}>
              <a
                href={`#${a.id}`}
                className={active === a.id ? 'on' : undefined}
                aria-current={active === a.id ? 'true' : undefined}
              >
                {a.text}
              </a>
            </li>
          ))}
        </ul>
        <a className="nav-cta" href="#lab">
          Listen
        </a>
      </div>
    </nav>
  )
}

/* -------------------------------------------------------- auxiliary types */
export type { ModelName }
