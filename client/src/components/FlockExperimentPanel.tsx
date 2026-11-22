import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ExperimentCompareChart } from "./ExperimentCompareChart"
import { FlockViz2D } from "./FlockViz2D"
import type { FlockExperimentResult } from "../types/experiment"

type Props = {
  onPauseLive?: () => void
}

const METRIC_OPTIONS = [
  { id: "cohesion", label: "Cohesion (neighbor density)" },
  { id: "separation", label: "Mean nearest-neighbor distance" },
  { id: "alignment", label: "Velocity alignment" },
  { id: "spatial_entropy", label: "Spatial entropy" },
] as const

type MetricId = (typeof METRIC_OPTIONS)[number]["id"]

export function FlockExperimentPanel({ onPauseLive }: Props) {
  const [baselineSpeed, setBaselineSpeed] = useState(0.018)
  const [variantSpeed, setVariantSpeed] = useState(0.034)
  const [seed, setSeed] = useState(42)
  const [steps, setSteps] = useState(240)
  const [population, setPopulation] = useState(320)
  const [metric, setMetric] = useState<MetricId>("cohesion")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<FlockExperimentResult | null>(null)
  const [frame, setFrame] = useState(0)
  const [playing, setPlaying] = useState(false)

  const runExperiment = useCallback(async () => {
    setLoading(true)
    setError(null)
    setPlaying(false)
    setFrame(0)
    onPauseLive?.()
    try {
      const res = await fetch("/api/experiment/flock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seed,
          steps,
          sample_every: 4,
          shared: { population },
          baseline: { predator_speed: baselineSpeed },
          variant: { predator_speed: variantSpeed },
        }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { detail?: string } | null
        throw new Error(j?.detail ?? `Request failed (${res.status})`)
      }
      const data = (await res.json()) as FlockExperimentResult
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Experiment failed")
    } finally {
      setLoading(false)
    }
  }, [baselineSpeed, variantSpeed, seed, steps, population, onPauseLive])

  const maxFrames = useMemo(() => {
    if (!result) return 0
    return Math.max(
      result.baseline.snapshots.length,
      result.variant.snapshots.length,
    )
  }, [result])

  useEffect(() => {
    if (!playing || !result || maxFrames < 2) return
    const id = window.setInterval(() => {
      setFrame((f) => (f + 1 >= maxFrames ? 0 : f + 1))
    }, 120)
    return () => window.clearInterval(id)
  }, [playing, result, maxFrames])

  const chartSeries = useMemo(() => {
    if (!result) return []
    const key = metric
    return [
      {
        label: `Baseline (pred ${baselineSpeed.toFixed(3)})`,
        color: "rgba(0,229,255,0.85)",
        values: result.baseline.metrics.map((m) => m[key]),
      },
      {
        label: `Variant (pred ${variantSpeed.toFixed(3)})`,
        color: "rgba(255,181,71,0.9)",
        values: result.variant.metrics.map((m) => m[key]),
      },
    ]
  }, [result, metric, baselineSpeed, variantSpeed])

  const vizBody = useRef<HTMLDivElement | null>(null)
  const [vizW, setVizW] = useState(320)
  useEffect(() => {
    const el = vizBody.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      setVizW(Math.max(160, Math.floor(r.width)))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const baseSnap = result?.baseline.snapshots[frame]
  const varSnap = result?.variant.snapshots[frame]

  return (
    <section className="experiment-panel">
      <header className="experiment-header">
        <div>
          <strong>Experiment lab · flock vs predator</strong>
          <p>Run two predator-speed arms with the same seed and shared flock settings. Compare metrics over time.</p>
        </div>
        <div className="experiment-actions">
          <button type="button" className="primary" disabled={loading} onClick={() => void runExperiment()}>
            {loading ? "Running…" : "Run comparison"}
          </button>
          {result && (
            <button type="button" disabled={loading} onClick={() => void runExperiment()}>
              Repeat
            </button>
          )}
        </div>
      </header>

      <div className="experiment-controls">
        <label>
          Baseline predator speed
          <input
            type="range"
            min={0.01}
            max={0.045}
            step={0.001}
            value={baselineSpeed}
            onChange={(e) => setBaselineSpeed(Number(e.target.value))}
          />
          <span className="mono">{baselineSpeed.toFixed(3)}</span>
        </label>
        <label>
          Variant predator speed
          <input
            type="range"
            min={0.01}
            max={0.045}
            step={0.001}
            value={variantSpeed}
            onChange={(e) => setVariantSpeed(Number(e.target.value))}
          />
          <span className="mono">{variantSpeed.toFixed(3)}</span>
        </label>
        <label>
          Random seed
          <input
            type="number"
            min={0}
            max={2147483647}
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
          />
        </label>
        <label>
          Simulation steps
          <input type="range" min={80} max={600} step={10} value={steps} onChange={(e) => setSteps(Number(e.target.value))} />
          <span className="mono">{steps}</span>
        </label>
        <label>
          Flock population
          <input
            type="range"
            min={80}
            max={520}
            value={population}
            onChange={(e) => setPopulation(Number(e.target.value))}
          />
          <span className="mono">{population}</span>
        </label>
        <label>
          Chart metric
          <select value={metric} onChange={(e) => setMetric(e.target.value as MetricId)}>
            {METRIC_OPTIONS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="experiment-error">{error}</p>}

      {result && (
        <>
          <div className="experiment-viz-row" ref={vizBody}>
            <div className="experiment-viz-card">
              <span className="exp-viz-title">Baseline</span>
              {baseSnap ? <FlockViz2D data={baseSnap} width={vizW} height={220} /> : null}
            </div>
            <div className="experiment-viz-card">
              <span className="exp-viz-title">Variant</span>
              {varSnap ? <FlockViz2D data={varSnap} width={vizW} height={220} /> : null}
            </div>
          </div>

          <div className="experiment-playback">
            <button type="button" onClick={() => setPlaying((p) => !p)}>
              {playing ? "Pause playback" : "Animate snapshots"}
            </button>
            <input
              type="range"
              min={0}
              max={Math.max(0, maxFrames - 1)}
              value={frame}
              onChange={(e) => {
                setFrame(Number(e.target.value))
                setPlaying(false)
              }}
            />
          </div>

          <ExperimentCompareChart series={chartSeries} />

          <div className="experiment-summary-grid">
            <MotionSummary title="Baseline" s={result.baseline.summary} />
            <MotionSummary title="Variant" s={result.variant.summary} />
          </div>

          <div className="experiment-readout">
            <h3>What this run shows</h3>
            <ul>
              {result.interpretation.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <p className="exp-disclaimer">{result.interpretation.disclaimer}</p>
          </div>
        </>
      )}
    </section>
  )
}

function MotionSummary({
  title,
  s,
}: {
  title: string
  s: FlockExperimentResult["baseline"]["summary"]
}) {
  return (
    <div className="exp-summary-card">
      <strong>{title}</strong>
      <div className="exp-summary-metrics">
        <span>cohesion {s.mean_cohesion.toFixed(3)}</span>
        <span>separation {s.mean_separation.toFixed(4)}</span>
        <span>alignment {s.mean_alignment.toFixed(3)}</span>
        <span>entropy {s.mean_spatial_entropy.toFixed(2)}</span>
      </div>
    </div>
  )
}
