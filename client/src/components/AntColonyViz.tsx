import { useEffect, useRef, memo } from "react"
import type { AntPayload } from "../types"

type Props = { data: AntPayload; width: number; height: number }

export const AntColonyViz = memo(function AntColonyViz({ data, width, height }: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext("2d")
    if (!ctx) return
    const w = data.grid.w
    const h = data.grid.h
    const trail = data.grid.trail
    ctx.fillStyle = "#05070c"
    ctx.fillRect(0, 0, width, height)

    const img = ctx.createImageData(width, height)
    const buf = img.data
    let max = 1e-9
    for (let i = 0; i < trail.length; i++) max = Math.max(max, trail[i])
    for (let py = 0; py < height; py++) {
      const gy = Math.floor((py / height) * h)
      for (let px = 0; px < width; px++) {
        const gx = Math.floor((px / width) * w)
        const idx = gy * w + gx
        const v = trail[idx] || 0
        const t = Math.min(1, v / max)
        const base = (py * width + px) * 4
        buf[base] = Math.floor(6 + t * 210)
        buf[base + 1] = Math.floor(16 + t * 170)
        buf[base + 2] = Math.floor(40 + t * 180)
        buf[base + 3] = 240
      }
    }
    ctx.putImageData(img, 0, 0)

    // Nest
    ctx.strokeStyle = "#39ffb5"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(data.nest.x * width, data.nest.y * height, data.nest.r * width, 0, Math.PI * 2)
    ctx.stroke()

    // Food
    ctx.fillStyle = "rgba(255,181,71,0.85)"
    for (const f of data.food) {
      if (f.q <= 0.5) continue
      const r = 4 + Math.min(10, f.q / 25)
      ctx.beginPath()
      ctx.arc(f.x * width, f.y * height, r, 0, Math.PI * 2)
      ctx.fill()
    }

    // Ants
    const { x, y, carry } = data.ants
    for (let i = 0; i < x.length; i++) {
      ctx.fillStyle = carry[i] ? "#ffd07a" : "#9bd7ff"
      ctx.beginPath()
      ctx.arc(x[i] * width, y[i] * height, carry[i] ? 2.2 : 1.6, 0, Math.PI * 2)
      ctx.fill()
    }

    // Particles
    for (const p of data.particles.slice(-40)) {
      ctx.fillStyle = "rgba(255,230,120,0.75)"
      ctx.beginPath()
      ctx.arc(p.x * width, p.y * height, 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }, [data, width, height])

  return <canvas ref={ref} width={width} height={height} className="sim-canvas" />
})
