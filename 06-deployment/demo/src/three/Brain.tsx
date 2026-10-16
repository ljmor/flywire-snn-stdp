/* ---------------------------------------------------------------------------
   A network drawn in 3D: 1,239 neurons placed by a spectral embedding of the
   real wiring, plus a sample of its connections.

   Each neuron keeps a "glow" that jumps to 1 when it fires and decays
   exponentially. The drawing loop walks the spike train up to the current time
   of the clock, so what is on screen are the spikes produced by the Brian2
   simulation, not a decorative animation.
--------------------------------------------------------------------------- */

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import type { Network, SpikeTrain } from '../data/types'
import type { Clock } from '../core/engine'

export interface CameraState {
  rotY: number
  rotX: number
  velY: number
  dragging: boolean
}

export const initialCamera = (): CameraState => ({
  rotY: 0.35,
  rotX: -0.12,
  velY: 0,
  dragging: false,
})

const VERT = /* glsl */ `
  attribute float glow;
  attribute float nodeType;
  varying float vB;
  varying float vT;
  // diameter in device pixels at the reference distance
  uniform float sizePx;
  // distance from the camera to the center of the scene
  uniform float refDist;
  void main() {
    vB = glow;
    vT = nodeType;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float base = nodeType < 0.5 ? 1.5 : (nodeType < 1.5 ? 1.05 : 0.88);
    float perspective = refDist / max(-mv.z, 0.05);
    gl_PointSize = clamp(sizePx * base * (1.0 + 1.7 * vB) * perspective, 1.0, 26.0);
  }
`

const FRAG = /* glsl */ `
  precision mediump float;
  varying float vB;
  varying float vT;
  uniform vec3 base;
  uniform vec3 light;
  uniform vec3 inputColor;
  uniform float restAlpha;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d);
    if (r > 0.5) discard;
    float halo = pow(smoothstep(0.5, 0.0, r), 1.7);
    vec3 c = mix(base, light, clamp(vB * 1.3, 0.0, 1.0));
    if (vT < 0.5) c = mix(inputColor, light, clamp(vB * 1.15, 0.0, 1.0));
    float a = (restAlpha + 1.05 * vB) * halo;
    gl_FragColor = vec4(c, a);
  }
`

export interface BrainProps {
  network: Network
  topology: 'connectome' | 'er'
  /** null = no stimulus: the network twinkles at rest */
  train: SpikeTrain | null
  clock: Clock
  cameraState: CameraState
  color: string
  light: string
  position?: [number, number, number]
  scale?: number
  showEdges?: boolean
  edgeOpacity?: number
  /** 0 switches the activity off (wiring-only view) */
  gain?: number
  /** diameter of a neuron at rest, in CSS pixels */
  pointSize?: number
  /** receives the instantaneous rate (spikes per neuron per second) */
  onMeasure?: (rateHz: number) => void
}

export function Brain({
  network,
  topology,
  train,
  clock,
  cameraState,
  color,
  light,
  position = [0, 0, 0],
  scale = 1,
  showEdges = true,
  edgeOpacity = 0.1,
  gain = 1,
  pointSize = 2.7,
  onMeasure,
}: BrainProps) {
  const rotator = useRef<THREE.Group>(null)
  const { gl } = useThree()

  // -- neuron geometry ----------------------------------------------------
  const { pointGeometry, glow, glowAttr } = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(network.pos, 3))
    const b = new Float32Array(network.n)
    const ab = new THREE.BufferAttribute(b, 1)
    ab.setUsage(THREE.DynamicDrawUsage)
    g.setAttribute('glow', ab)
    const t = new Float32Array(network.n)
    for (let i = 0; i < network.n; i++) t[i] = network.nodeType[i]
    g.setAttribute('nodeType', new THREE.BufferAttribute(t, 1))
    g.computeBoundingSphere()
    return { pointGeometry: g, glow: b, glowAttr: ab }
  }, [network])

  const material = useMemo(() => {
    const c = new THREE.Color(color)
    const l = new THREE.Color(light)
    const e = new THREE.Color('#ffd88a') // the input layer takes the amber of the song
    return new THREE.ShaderMaterial({
      uniforms: {
        sizePx: { value: 2.6 },
        refDist: { value: 4 },
        base: { value: c },
        light: { value: l },
        inputColor: { value: e },
        restAlpha: { value: 0.13 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  }, [color, light])

  // -- connection geometry ------------------------------------------------
  const { lineGeometry, lineMaterial } = useMemo(() => {
    const edgeSet = network.topologies[topology]
    const n = edgeSet.a.length
    const pos = new Float32Array(n * 6)
    const col = new Float32Array(n * 6)
    const c = new THREE.Color(color)
    for (let k = 0; k < n; k++) {
      const a = edgeSet.a[k]
      const b = edgeSet.b[k]
      pos[k * 6] = network.pos[a * 3]
      pos[k * 6 + 1] = network.pos[a * 3 + 1]
      pos[k * 6 + 2] = network.pos[a * 3 + 2]
      pos[k * 6 + 3] = network.pos[b * 3]
      pos[k * 6 + 4] = network.pos[b * 3 + 1]
      pos[k * 6 + 5] = network.pos[b * 3 + 2]
      // polarity only changes the brightness of the line, never its hue: the
      // color still identifies the network, not the connection
      const f = edgeSet.pol[k] === 0 ? 1.0 : edgeSet.pol[k] === 1 ? 0.52 : 1.35
      for (const [j, v] of [
        [0, 0.35],
        [3, 1],
      ] as const) {
        col[k * 6 + j] = c.r * f * v
        col[k * 6 + j + 1] = c.g * f * v
        col[k * 6 + j + 2] = c.b * f * v
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    const m = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: edgeOpacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    return { lineGeometry: g, lineMaterial: m }
    // edgeOpacity is adjusted later in the loop; we do not rebuild for it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network, topology, color])

  useEffect(
    () => () => {
      pointGeometry.dispose()
      lineGeometry.dispose()
      material.dispose()
      lineMaterial.dispose()
    },
    [pointGeometry, lineGeometry, material, lineMaterial],
  )

  // -- loop ---------------------------------------------------------------
  const cursor = useRef({ k: 0, lap: -1, train: null as SpikeTrain | null, rate: 0 })
  const restRef = useRef(0)

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.06)

    // the point keeps its size on screen and grows when the camera comes closer
    const cam = state.camera as THREE.PerspectiveCamera
    material.uniforms.sizePx.value = pointSize * scale * gl.getPixelRatio()
    material.uniforms.refDist.value = Math.max(Math.abs(cam.position.z), 0.5)

    if (rotator.current) {
      rotator.current.rotation.y = cameraState.rotY
      rotator.current.rotation.x = cameraState.rotX
    }

    // decay of the glow
    const k = Math.exp(-dt / 0.085)
    for (let i = 0; i < glow.length; i++) glow[i] *= k

    let newSpikes = 0
    const c = cursor.current
    if (train && gain > 0) {
      if (c.train !== train || c.lap !== clock.lap) {
        c.train = train
        c.lap = clock.lap
        c.k = 0
        glow.fill(0)
      }
      const limit = clock.t * 10_000 // tenths of a ms
      // if the user goes back, rewind and walk the train again
      if (c.k > 0 && train.t[c.k - 1] > limit) {
        c.k = 0
        glow.fill(0)
      }
      while (c.k < train.n && train.t[c.k] <= limit) {
        glow[train.i[c.k]] = 1
        c.k++
        newSpikes++
      }
    } else {
      // rest: a faint twinkle so that the network does not look like a dead object
      const n = Math.max(1, Math.round(network.n * 0.012))
      for (let j = 0; j < n; j++)
        glow[(Math.random() * network.n) | 0] = 0.45 + Math.random() * 0.3
    }

    glowAttr.needsUpdate = true

    // the instantaneous rate modulates the overall brightness of the wiring
    const rate = dt > 0 ? newSpikes / dt / network.n : 0
    c.rate = c.rate + (rate - c.rate) * (1 - Math.exp(-dt / 0.12))
    onMeasure?.(c.rate)
    const goal = train
      ? edgeOpacity * (0.55 + Math.min(c.rate / 30, 1.6))
      : edgeOpacity
    lineMaterial.opacity += (goal - lineMaterial.opacity) * Math.min(dt * 6, 1)

    restRef.current += (0.13 - restRef.current) * Math.min(dt * 4, 1)
    material.uniforms.restAlpha.value = restRef.current
  })

  return (
    <group position={position} scale={scale}>
      <group ref={rotator}>
        {showEdges && (
          <lineSegments geometry={lineGeometry} material={lineMaterial} />
        )}
        <points geometry={pointGeometry} material={material} />
      </group>
    </group>
  )
}
