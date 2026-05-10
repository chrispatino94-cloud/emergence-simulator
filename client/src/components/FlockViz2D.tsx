import { useEffect, useRef, memo } from "react"
import type { FlockPayload } from "../types"

type Props = { data: FlockPayload; width: number; height: number }

export const FlockViz2D = memo(function FlockViz2D({ data, width, height }: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext("2d")
    if (!ctx) return
    ctx.fillStyle = "#060913"
    ctx.fillRect(0, 0, width, height)

    const xs = data.boids.x
    const ys = data.boids.y
    ctx.fillStyle = "rgba(120,200,255,0.55)"
    for (let i = 0; i < xs.length; i++) {
      ctx.fillRect(xs[i] * width - 1, ys[i] * height - 1, 2, 2)
    }

    ctx.fillStyle = "#ff6b6b"
    ctx.beginPath()
    ctx.arc(data.predator.x * width, data.predator.y * height, 6, 0, Math.PI * 2)
    ctx.fill()
  }, [data, width, height])
  return <canvas ref={ref} width={width} height={height} className="sim-canvas" />
})
