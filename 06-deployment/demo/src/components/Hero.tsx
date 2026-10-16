import { motion } from 'framer-motion'
import { useMemo } from 'react'

import { trainKey } from '../data/load'
import {
  N_CONNECTIONS,
  N_CONTACTS,
  N_NEURONS,
  SNAPSHOT,
} from '../data/constants'
import { thousands } from '../core/util'
import type { Bundle } from '../data/types'
import { useLocalClock } from '../core/engine'
import { Brain, initialCamera } from '../three/Brain'
import { FitCamera, Scene } from '../three/Scene'

const riseIn = {
  hidden: { opacity: 0, y: 26 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay: 0.12 * i, ease: [0.22, 0.68, 0.24, 1] },
  }),
}

export function Hero({ bundle }: { bundle: Bundle }) {
  const cameraState = useMemo(initialCamera, [])
  const clock = useLocalClock(bundle.meta.duration, true)
  const train = bundle.trains.get(trainKey('connectome_stdp', 35)) ?? null

  return (
    <header className="hero">
      <div className="frame hero-frame">
        <div className="hero-text">
          <motion.span
            className="eyebrow"
            variants={riseIn}
            initial="hidden"
            animate="visible"
            custom={0}
          >
            Universidad Técnica Particular de Loja · 2026
          </motion.span>

          <motion.h1
            variants={riseIn}
            initial="hidden"
            animate="visible"
            custom={1}
          >
            A fly’s brain,
            <br />
            <span className="accent">wire by wire</span>,
            <br />
            listening to a song.
          </motion.h1>

          <motion.p
            className="lead"
            variants={riseIn}
            initial="hidden"
            animate="visible"
            custom={2}
          >
            We took {thousands(N_NEURONS)} neurons of the real auditory circuit of{' '}
            <i>Drosophila</i>, with their {thousands(N_CONNECTIONS)} mapped
            connections ({thousands(N_CONTACTS)} synaptic contacts), and set them
            to tell courtship songs apart. They learn with STDP, a local rule
            that strengthens a connection when one neuron fires just before the
            next. Then we built the same network with
            its connections placed at random. Between the two, only{' '}
            <b>the wiring</b> changes. The result changes with it.
          </motion.p>

          <motion.div
            className="hero-actions"
            variants={riseIn}
            initial="hidden"
            animate="visible"
            custom={3}
          >
            <a className="btn primary" href="#lab">
              Listen to the experiment
            </a>
            <a className="btn ghost" href="#song">
              What is a fly song?
            </a>
          </motion.div>

          <motion.dl
            className="hero-stats"
            variants={riseIn}
            initial="hidden"
            animate="visible"
            custom={4}
          >
            {[
              [thousands(N_NEURONS), 'real neurons'],
              [thousands(N_CONNECTIONS), 'mapped connections'],
              ['0.875', 'accuracy, connectome + STDP'],
              ['0.443', 'accuracy, random wiring + STDP'],
            ].map(([v, e]) => (
              <div key={e}>
                <dt className="num">{v}</dt>
                <dd>{e}</dd>
              </div>
            ))}
          </motion.dl>

          <p className="hero-source">
            Connectome {SNAPSHOT} · the 3D view draws real spikes of the simulation
          </p>
        </div>

        <div className="hero-3d">
          <Scene
            cameraState={cameraState}
            height="100%"
            auto={0.11}
            fov={40}
            accessibleLabel="The auditory circuit of Drosophila in three dimensions, firing in response to a courtship song. Drag to rotate it."
          >
            <FitCamera width={3.05} height={2.35} margin={1.1} />
            <Brain
              network={bundle.network}
              topology="connectome"
              train={train}
              clock={clock}
              cameraState={cameraState}
              color="#199e70"
              light="#35d89c"
              scale={1}
              pointSize={2.9}
              edgeOpacity={0.075}
            />
          </Scene>
          <span className="hero-hint">drag to rotate the brain</span>
        </div>
      </div>

      <a className="hero-down" href="#song" aria-label="Go down to the first section">
        <span />
      </a>
    </header>
  )
}
