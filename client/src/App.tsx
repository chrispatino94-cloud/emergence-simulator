import { useCallback, useEffect, useRef, useState } from "react"
import { playEmergenceTick } from "./audio/emergenceAudio"
import { AntColonyViz } from "./components/AntColonyViz"
import { CouplingMini } from "./components/CouplingMini"
import { FlockViz2D } from "./components/FlockViz2D"
import { FlockViz3D } from "./components/FlockViz3D"
import { LoadingScreen } from "./components/LoadingScreen"
import { MarketViz } from "./components/MarketViz"
import { MetricsStrip } from "./components/MetricsStrip"
import { TutorialOverlay } from "./components/TutorialOverlay"
import { useEmergenceSocket } from "./hooks/useEmergenceSocket"
import type { EmergenceState } from "./types"

function useBox(ref: React.RefObject<HTMLElement | null>) {
  const [dim, setDim] = useState({ w: 320, h: 240 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      setDim({
        w: Math.max(120, Math.floor(r.width)),
        h: Math.max(120, Math.floor(r.height)),
      })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return dim
}

export default function App() {
  const { state: liveState, connected, sendControl, saveRun, lastSavedRunId } = useEmergenceSocket()
  const [mode, setMode] = useState<"live" | "replay">("live")
  const [replay, setReplay] = useState<{
    snapshots: EmergenceState[]
    idx: number
    playing: boolean
  }>({ snapshots: [], idx: 0, playing: false })

  const display = mode === "replay" && replay.snapshots.length ? replay.snapshots[replay.idx]! : liveState

  const antBody = useRef<HTMLDivElement | null>(null)
  const flockBody = useRef<HTMLDivElement | null>(null)
  const marketBody = useRef<HTMLDivElement | null>(null)
  const antDim = useBox(antBody)
  const flockDim = useBox(flockBody)
  const marketDim = useBox(marketBody)

  const [focus, setFocus] = useState<"ants" | "flock" | "market" | null>(null)
  const [audioOn, setAudioOn] = useState(false)
  const [tutorial, setTutorial] = useState(
    () => localStorage.getItem("emergence.tutorial_seen") !== "1",
  )
  const [loading, setLoading] = useState(true)
  const [priceSeries, setPriceSeries] = useState<number[]>([])
  const [flock3d, setFlock3d] = useState(false)

  useEffect(() => {
    if (mode === "live" && liveState.tick > 0) setLoading(false)
  }, [liveState.tick, mode])

  useEffect(() => {
    setPriceSeries((s) => [...s, display.market.price].slice(-420))
  }, [display.market.price])

  useEffect(() => {
    if (!audioOn) return
    const id = window.setInterval(() => {
      playEmergenceTick(
        true,
        display.metrics.emergence_index,
        display.coupling.strength,
        display.market.shock,
      )
    }, 520)
    return () => window.clearInterval(id)
  }, [audioOn, display.metrics.emergence_index, display.coupling.strength, display.market.shock])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return
      if (e.code === "Space") {
        e.preventDefault()
        sendControl({ action: "toggle_pause" })
      }
      if (e.key === "r" || e.key === "R") sendControl({ action: "reset" })
      if (e.key === "1") setFocus("ants")
      if (e.key === "2") setFocus("flock")
      if (e.key === "3") setFocus("market")
      if (e.key === "Escape") setFocus(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [sendControl])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const runId = params.get("run")
    if (!runId) return
    fetch(`/api/run/${runId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((row) => {
        if (!row?.snapshots?.length) return
        setReplay({ snapshots: row.snapshots as EmergenceState[], idx: 0, playing: false })
        setMode("replay")
        sendControl({ action: "pause" })
        setLoading(false)
      })
      .catch(() => undefined)
  }, [sendControl])

  useEffect(() => {
    if (!replay.playing || mode !== "replay") return
    const id = window.setInterval(() => {
      setReplay((r) => {
        if (!r.snapshots.length) return r
        const next = Math.min(r.snapshots.length - 1, r.idx + 1)
        return { ...r, idx: next }
      })
    }, 135)
    return () => window.clearInterval(id)
  }, [replay.playing, mode, replay.snapshots.length])

  const emitParams = useCallback(
    (partial: Record<string, Record<string, number>>) => {
      sendControl({ action: "set_params", params: partial })
    },
    [sendControl],
  )

  const tutorialDone = () => {
    localStorage.setItem("emergence.tutorial_seen", "1")
    setTutorial(false)
  }

  useEffect(() => {
    if (!lastSavedRunId) return
    const url = `${window.location.origin}${window.location.pathname}?run=${lastSavedRunId}`
    void navigator.clipboard.writeText(url).catch(() => undefined)
  }, [lastSavedRunId])

  const exportShare = () => {
    saveRun("Emergence capture", {
      tick: liveState.tick,
      ants: liveState.ants.params,
      flock: liveState.flock.params,
      market: liveState.market.params,
    })
  }

  return (
    <div className="app-shell">
      <LoadingScreen visible={loading} />
      <TutorialOverlay open={tutorial} onClose={tutorialDone} />

      <header className="top-bar">
        <div className="brand">
          <strong>EMERGENCE</strong>
          <span>Complex systems laboratory · Flask · Socket.IO · React · D3 · Three</span>
        </div>
        <div className="controls">
          <span className={`pill ${connected ? "ok" : "bad"}`}>
            {connected ? "LIVE SOCKET" : "OFFLINE"}
          </span>
          <span className="pill">{mode === "replay" ? "REPLAY" : "SIM"} tick {display.tick}</span>
          <button type="button" onClick={() => sendControl({ action: "toggle_pause" })}>
            Pause / Resume (Space)
          </button>
          <button type="button" onClick={() => sendControl({ action: "reset" })}>
            Reset (R)
          </button>
          <button type="button" className="warn" onClick={() => sendControl({ action: "shock" })}>
            Shock market
          </button>
          <button type="button" onClick={() => setTutorial(true)}>
            Tutorial
          </button>
          <button type="button" className={audioOn ? "primary" : undefined} onClick={() => setAudioOn((a) => !a)}>
            Sound {audioOn ? "on" : "off"}
          </button>
          <button type="button" onClick={exportShare}>
            Export link
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("live")
              setReplay({ snapshots: [], idx: 0, playing: false })
              sendControl({ action: "resume" })
            }}
          >
            Resume live
          </button>
        </div>
      </header>

      <div className="stage-wrap">
        <div className="coupling-wrap">
          <CouplingMini c={display.coupling} />
        </div>

        <div className="stage">
          <section className={`panel panel-ant ${focus === "ants" ? "focus" : ""}`}>
            <header>
              <span>Ant colony forager</span>
              <span style={{ color: "#8ec9ff", fontSize: 11 }}>
                pheromone heat · food · {display.ants.ants.x.length} agents
              </span>
            </header>
            <div className="body" ref={antBody}>
              <AntColonyViz data={display.ants} width={antDim.w} height={antDim.h} />
            </div>
            <div className="sliders">
              <label>
                Population
                <input
                  type="range"
                  min={40}
                  max={420}
                  value={Math.round(display.ants.params.population ?? 220)}
                  onChange={(e) => emitParams({ ants: { population: Number(e.target.value) } })}
                />
              </label>
              <label>
                Evaporation
                <input
                  type="range"
                  min={0.005}
                  max={0.08}
                  step={0.001}
                  value={display.ants.params.evaporation_rate ?? 0.02}
                  onChange={(e) => emitParams({ ants: { evaporation_rate: Number(e.target.value) } })}
                />
              </label>
              <label>
                Diffusion
                <input
                  type="range"
                  min={0}
                  max={0.45}
                  step={0.01}
                  value={display.ants.params.diffusion_rate ?? 0.15}
                  onChange={(e) => emitParams({ ants: { diffusion_rate: Number(e.target.value) } })}
                />
              </label>
              <label>
                Food sources
                <input
                  type="range"
                  min={1}
                  max={12}
                  value={Math.round(display.ants.params.food_sources ?? 4)}
                  onChange={(e) => emitParams({ ants: { food_sources: Number(e.target.value) } })}
                />
              </label>
            </div>
          </section>

          <section className={`panel panel-flock ${focus === "flock" ? "focus" : ""}`}>
            <header>
              <span>Flocking / murmuration</span>
              <span style={{ color: "#ffd89a", fontSize: 11 }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <input type="checkbox" checked={flock3d} onChange={(e) => setFlock3d(e.target.checked)} />
                  3D (Three.js)
                </label>
              </span>
            </header>
            <div className="body" ref={flockBody}>
              {flock3d ? (
                <FlockViz3D key={display.flock.boids.x.length} data={display.flock} width={flockDim.w} height={flockDim.h} />
              ) : (
                <FlockViz2D data={display.flock} width={flockDim.w} height={flockDim.h} />
              )}
            </div>
            <div className="sliders">
              <label>
                Population
                <input
                  type="range"
                  min={80}
                  max={520}
                  value={Math.round(display.flock.params.population ?? 320)}
                  onChange={(e) => emitParams({ flock: { population: Number(e.target.value) } })}
                />
              </label>
              <label>
                Vision radius
                <input
                  type="range"
                  min={0.04}
                  max={0.18}
                  step={0.005}
                  value={display.flock.params.vision_radius ?? 0.09}
                  onChange={(e) => emitParams({ flock: { vision_radius: Number(e.target.value) } })}
                />
              </label>
              <label>
                Separation wt
                <input
                  type="range"
                  min={0.4}
                  max={2.6}
                  step={0.05}
                  value={display.flock.params.separation_weight ?? 1.35}
                  onChange={(e) => emitParams({ flock: { separation_weight: Number(e.target.value) } })}
                />
              </label>
              <label>
                Cohesion wt
                <input
                  type="range"
                  min={0.4}
                  max={2.6}
                  step={0.05}
                  value={display.flock.params.cohesion_weight ?? 1.05}
                  onChange={(e) => emitParams({ flock: { cohesion_weight: Number(e.target.value) } })}
                />
              </label>
              <label>
                Predator speed
                <input
                  type="range"
                  min={0.01}
                  max={0.045}
                  step={0.001}
                  value={display.flock.params.predator_speed ?? 0.022}
                  onChange={(e) => emitParams({ flock: { predator_speed: Number(e.target.value) } })}
                />
              </label>
            </div>
          </section>

          <section className={`panel panel-market ${focus === "market" ? "focus" : ""}`}>
            <header>
              <span>Market emergence</span>
              <span style={{ color: "#7fe7ff", fontSize: 11 }}>order book · emergent price</span>
            </header>
            <div className="body" ref={marketBody}>
              <MarketViz data={display.market} width={marketDim.w} height={marketDim.h} priceHistory={priceSeries} />
            </div>
            <div className="sliders">
              <label>
                Buyers
                <input
                  type="range"
                  min={120}
                  max={720}
                  step={10}
                  value={Math.round(display.market.params.num_buyers ?? 520)}
                  onChange={(e) => emitParams({ market: { num_buyers: Number(e.target.value) } })}
                />
              </label>
              <label>
                Sellers
                <input
                  type="range"
                  min={120}
                  max={720}
                  step={10}
                  value={Math.round(display.market.params.num_sellers ?? 520)}
                  onChange={(e) => emitParams({ market: { num_sellers: Number(e.target.value) } })}
                />
              </label>
              <label>
                Volatility
                <input
                  type="range"
                  min={0.08}
                  max={0.85}
                  step={0.01}
                  value={display.market.params.volatility ?? 0.35}
                  onChange={(e) => emitParams({ market: { volatility: Number(e.target.value) } })}
                />
              </label>
              <label>
                Speculation
                <input
                  type="range"
                  min={0.05}
                  max={0.55}
                  step={0.01}
                  value={display.market.params.speculation_rate ?? 0.22}
                  onChange={(e) => emitParams({ market: { speculation_rate: Number(e.target.value) } })}
                />
              </label>
            </div>
          </section>
        </div>
      </div>

      <MetricsStrip
        entropy={display.metrics.entropy.aggregate}
        emergence={display.metrics.emergence_index}
        complexity={display.metrics.complexity}
        phaseActive={display.metrics.phase.active}
        histEntropy={display.metrics.history.entropy}
        histEmergence={display.metrics.history.emergence}
      />

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <span className="pill">Keyboard: Space pause · R reset · 1/2/3 focus panels · Esc clear</span>
        {mode === "replay" && (
          <>
            <button type="button" onClick={() => setReplay((r) => ({ ...r, playing: !r.playing }))}>
              {replay.playing ? "Pause replay" : "Play replay"}
            </button>
            <input
              type="range"
              min={0}
              max={Math.max(0, replay.snapshots.length - 1)}
              value={replay.idx}
              onChange={(e) =>
                setReplay((r) => ({ ...r, idx: Number(e.target.value), playing: false }))
              }
              style={{ flex: 1, minWidth: 140 }}
            />
          </>
        )}
      </div>
    </div>
  )
}
