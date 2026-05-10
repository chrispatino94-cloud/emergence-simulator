import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import type { FlockPayload } from "../types"

type Props = { data: FlockPayload; width: number; height: number }

export function FlockViz3D({ data, width, height }: Props) {
  if (!data.boids.x.length) {
    return <div className="three-mount muted">Awaiting flock…</div>
  }

  const mount = useRef<HTMLDivElement | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const pointsRef = useRef<THREE.Points | null>(null)
  const predRef = useRef<THREE.Mesh | null>(null)

  const geom = useMemo(() => new THREE.BufferGeometry(), [])

  useEffect(() => {
    const el = mount.current
    if (!el) return
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x05070c)
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100)
    camera.position.set(0, 0, 9)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    el.innerHTML = ""
    el.appendChild(renderer.domElement)

    const amb = new THREE.AmbientLight(0xffffff, 0.65)
    scene.add(amb)

    const positions = new Float32Array(data.boids.x.length * 3)
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3))

    const mat = new THREE.PointsMaterial({
      color: 0x7fc8ff,
      size: 0.07,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    })
    const points = new THREE.Points(geom, mat)
    scene.add(points)

    const predGeo = new THREE.SphereGeometry(0.18, 14, 14)
    const predMat = new THREE.MeshStandardMaterial({ color: 0xff6b6b, emissive: 0x440000 })
    const pred = new THREE.Mesh(predGeo, predMat)
    scene.add(pred)

    rendererRef.current = renderer
    sceneRef.current = scene
    pointsRef.current = points
    predRef.current = pred

    let frame = 0
    const animate = () => {
      frame = requestAnimationFrame(animate)
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(frame)
      geom.dispose()
      mat.dispose()
      predGeo.dispose()
      predMat.dispose()
      renderer.dispose()
      el.innerHTML = ""
    }
  }, [geom, width, height, data.boids.x.length])

  useEffect(() => {
    const geom = pointsRef.current?.geometry as THREE.BufferGeometry | undefined
    const pred = predRef.current
    const scene = sceneRef.current
    if (!geom || !pred || !scene) return

    const pos = geom.getAttribute("position") as THREE.BufferAttribute
    const xs = data.boids.x
    const ys = data.boids.y
    const zShift = (data.cohesion || 0) * 0.05
    for (let i = 0; i < xs.length; i++) {
      const x = (xs[i] - 0.5) * 12
      const y = (0.5 - ys[i]) * 12
      const z = Math.sin(xs[i] * 15 + ys[i] * 12) * 0.25 + zShift
      pos.setXYZ(i, x, y, z)
    }
    pos.needsUpdate = true

    pred.position.set((data.predator.x - 0.5) * 12, (0.5 - data.predator.y) * 12, 0.4)
  }, [data])

  return <div ref={mount} className="three-mount" />
}
