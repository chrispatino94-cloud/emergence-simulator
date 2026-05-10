import { memo, useEffect, useRef } from "react"

type Props = {
  entropy: number
  emergence: number
  complexity: number
  phaseActive: boolean
  histEntropy: number[]
  histEmergence: number[]
}

export const MetricsStrip = memo(function MetricsStrip({
  entropy,
  emergence,
  complexity,
  phaseActive,
  histEntropy,
  histEmergence,
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
    ctx.strokeStyle = "rgba(0,229,255,0.35)"
    ctx.beginPath()
    const s1 = histEntropy.length ? histEntropy : [entropy]
    const max1 = Math.max(1e-6, ...s1.map(Math.abs))
    for (let i = 0; i < s1.length; i++) {
      const px = (i / Math.max(1, s1.length - 1)) * w
      const py = h - (s1[i] / max1) * (h * 0.45)
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.stroke()

    ctx.strokeStyle = "rgba(57,255,181,0.45)"
    ctx.beginPath()
    const s2 = histEmergence.length ? histEmergence : [emergence]
    const max2 = Math.max(1e-6, ...s2.map(Math.abs))
    for (let i = 0; i < s2.length; i++) {
      const px = (i / Math.max(1, s2.length - 1)) * w
      const py = h - (s2[i] / max2) * (h * 0.45) - 4
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.stroke()
  }, [entropy, emergence, histEntropy, histEmergence])

  return (
    <div className="metrics-strip">
      <div className="metric">
        <span className="label">Entropy</span>
        <span className="value">{entropy.toFixed(2)}</span>
      </div>
      <div className="metric">
        <span className="label">Emergence index</span>
        <span className="value">{emergence.toFixed(3)}</span>
      </div>
      <div className="metric">
        <span className="label">Complexity</span>
        <span className="value">{complexity.toFixed(3)}</span>
      </div>
      <div className={`metric phase ${phaseActive ? "hot" : ""}`}>
        <span className="label">Phase</span>
        <span className="value">{phaseActive ? "transition" : "stable"}</span>
      </div>
      <canvas ref={ref} width={220} height={36} className="mini-spark" />
    </div>
  )
})
