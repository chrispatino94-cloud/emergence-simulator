import { memo, useEffect, useRef } from "react"

type Series = { label: string; color: string; values: number[] }

type Props = {
  series: Series[]
  height?: number
}

export const ExperimentCompareChart = memo(function ExperimentCompareChart({
  series,
  height = 140,
}: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext("2d")
    if (!ctx) return
    const w = c.width
    const h = c.height
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = "rgba(8,12,20,0.65)"
    ctx.fillRect(0, 0, w, h)

    const allVals = series.flatMap((s) => s.values)
    if (!allVals.length) return
    const minV = Math.min(...allVals)
    const maxV = Math.max(...allVals, minV + 1e-6)
    const span = maxV - minV || 1

    for (const s of series) {
      if (!s.values.length) continue
      ctx.strokeStyle = s.color
      ctx.lineWidth = 1.5
      ctx.beginPath()
      for (let i = 0; i < s.values.length; i++) {
        const px = (i / Math.max(1, s.values.length - 1)) * (w - 8) + 4
        const py = h - 10 - ((s.values[i] - minV) / span) * (h - 20)
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()
    }
  }, [series])

  return (
    <div className="exp-chart-wrap">
      <div className="exp-chart-legend">
        {series.map((s) => (
          <span key={s.label} style={{ color: s.color }}>
            {s.label}
          </span>
        ))}
      </div>
      <canvas ref={ref} width={640} height={height} className="exp-chart-canvas" />
    </div>
  )
})
