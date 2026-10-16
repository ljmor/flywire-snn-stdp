/* ---------------------------------------------------------------------------
   Shared WebGL canvas: drag to rotate (it never captures the page scroll),
   inertia, automatic rotation and a full pause of the loop when the section is
   off screen.
--------------------------------------------------------------------------- */

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import * as THREE from 'three'

import { useOnScreen, useReducedMotion, clamp } from '../core/util'
import type { CameraState } from './Brain'

function AutoRotate({
  cameraState,
  auto,
  reducedMotion,
}: {
  cameraState: CameraState
  auto: number
  reducedMotion: boolean
}) {
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.06)
    if (cameraState.dragging) return
    cameraState.rotY += cameraState.velY * dt
    cameraState.velY *= Math.exp(-dt / 0.55)
    if (Math.abs(cameraState.velY) < 0.02) cameraState.velY = 0
    if (!reducedMotion) cameraState.rotY += auto * dt
  })
  return null
}

/** Moves the camera back just enough for the whole world to fit. */
export function FitCamera({
  width,
  height,
  margin = 1.08,
}: {
  width: number
  height: number
  margin?: number
}) {
  const { camera, size } = useThree()
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    if (!cam.isPerspectiveCamera) return
    const aspect = size.width / Math.max(size.height, 1)
    const halfTan = Math.tan((cam.fov * Math.PI) / 360)
    cam.position.z =
      Math.max(height / 2 / halfTan, width / 2 / (halfTan * aspect)) * margin
    cam.updateProjectionMatrix()
  }, [camera, size, width, height, margin])
  return null
}

export interface SceneProps {
  cameraState: CameraState
  children: ReactNode
  height: string
  /** rad/s of automatic rotation */
  auto?: number
  fov?: number
  distance?: number
  className?: string
  accessibleLabel?: string
}

export function Scene({
  cameraState,
  children,
  height,
  auto = 0.1,
  fov = 42,
  distance = 6.2,
  className,
  accessibleLabel = 'Three-dimensional view of the neural network. Drag to rotate it.',
}: SceneProps) {
  const box = useRef<HTMLDivElement>(null)
  const visible = useOnScreen(box, '340px')
  const reducedMotion = useReducedMotion()
  // the WebGL context is created once and then only the loop is frozen:
  // unmounting it off screen would mean rebuilding all the geometry
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    if (visible) setMounted(true)
  }, [visible])
  const prev = useRef({ x: 0, y: 0, t: 0 })

  useEffect(() => {
    const el = box.current
    if (!el) return

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return
      cameraState.dragging = true
      cameraState.velY = 0
      prev.current = { x: e.clientX, y: e.clientY, t: performance.now() }
      el.setPointerCapture(e.pointerId)
      el.style.cursor = 'grabbing'
    }
    const onMove = (e: PointerEvent) => {
      if (!cameraState.dragging) return
      const dx = e.clientX - prev.current.x
      const dy = e.clientY - prev.current.y
      const dt = Math.max((performance.now() - prev.current.t) / 1000, 1 / 120)
      prev.current = { x: e.clientX, y: e.clientY, t: performance.now() }
      cameraState.rotY += dx * 0.0062
      cameraState.rotX = clamp(cameraState.rotX + dy * 0.0038, -0.62, 0.62)
      cameraState.velY = clamp((dx * 0.0062) / dt, -7, 7)
      // the gesture is blocked only once a drag has started: the vertical
      // scroll of the page is left untouched
      e.preventDefault()
    }
    const onUp = (e: PointerEvent) => {
      if (!cameraState.dragging) return
      cameraState.dragging = false
      el.releasePointerCapture?.(e.pointerId)
      el.style.cursor = 'grab'
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.style.cursor = 'grab'
    el.style.touchAction = 'pan-y'
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
    }
  }, [cameraState])

  return (
    <div
      ref={box}
      className={className}
      style={{ height: height, position: 'relative', userSelect: 'none' }}
      role="img"
      aria-label={accessibleLabel}
    >
      {mounted && (
        <Canvas
          dpr={[1, 1.75]}
          frameloop={visible ? 'always' : 'never'}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
            stencil: false,
          }}
          camera={{ position: [0, 0, distance], fov, near: 0.1, far: 100 }}
        >
          <AutoRotate cameraState={cameraState} auto={auto} reducedMotion={reducedMotion} />
          {children}
        </Canvas>
      )}
    </div>
  )
}
