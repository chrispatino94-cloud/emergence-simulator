import { useEffect, useRef, useState, useCallback } from "react"
import { io, Socket } from "socket.io-client"
import type { EmergenceState } from "../types"

function defaultState(): EmergenceState {
  return {
    tick: 0,
    paused: false,
    ants: {
      nest: { x: 0.5, y: 0.92, r: 0.035 },
      grid: { w: 96, h: 72, trail: [] },
      ants: { x: [], y: [], carry: [] },
      food: [],
      total_foraged: 0,
      forage_velocity: 0,
      particles: [],
      params: {},
    },
    flock: {
      boids: { x: [], y: [] },
      predator: { x: 0.5, y: 0.5 },
      cohesion: 0,
      params: {},
    },
    market: {
      price: 100,
      volume: 0,
      volatility: 0.35,
      speculation_rate: 0.22,
      shock: false,
      order_book: { bins: 24, lo: 80, hi: 120, bids: [], asks: [], mid: 100 },
      params: {},
    },
    coupling: {
      strength: 0,
      market_to_ants: 1,
      ants_to_market_supply: 0,
      flock_to_market_bias: 0,
      price_norm: 0.5,
    },
    metrics: {
      entropy: { ants: 0, flock: 0, market: 0, aggregate: 0 },
      emergence_index: 0,
      complexity: 0,
      phase: { active: false, zscore: 0 },
      history: { entropy: [], emergence: [] },
    },
  }
}

export function useEmergenceSocket() {
  const socketRef = useRef<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [state, setState] = useState<EmergenceState>(() => defaultState())
  const [lastSavedRunId, setLastSavedRunId] = useState<string | null>(null)

  useEffect(() => {
    const socket = io({
      path: "/socket.io",
      transports: ["websocket", "polling"],
      autoConnect: true,
    })
    socketRef.current = socket
    socket.on("connect", () => setConnected(true))
    socket.on("disconnect", () => setConnected(false))
    socket.on("state", (payload: EmergenceState) => setState(payload))
    socket.on("run_saved", (p: { id: string }) => setLastSavedRunId(p.id))
    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  const sendControl = useCallback((payload: Record<string, unknown>) => {
    socketRef.current?.emit("control", payload)
  }, [])

  const saveRun = useCallback((label?: string, params?: Record<string, unknown>) => {
    socketRef.current?.emit("save_run", { label, params })
  }, [])

  return { state, connected, sendControl, saveRun, lastSavedRunId }
}
