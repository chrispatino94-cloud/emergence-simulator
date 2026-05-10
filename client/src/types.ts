export type AntPayload = {
  nest: { x: number; y: number; r: number }
  grid: { w: number; h: number; trail: number[] }
  ants: { x: number[]; y: number[]; carry: number[] }
  food: { x: number; y: number; q: number }[]
  total_foraged: number
  forage_velocity: number
  particles: { x: number; y: number; kind: string }[]
  params: Record<string, number>
}

export type FlockPayload = {
  boids: { x: number[]; y: number[] }
  predator: { x: number; y: number }
  cohesion: number
  params: Record<string, number>
}

export type MarketPayload = {
  price: number
  volume: number
  volatility: number
  speculation_rate: number
  shock: boolean
  order_book: {
    bins: number
    lo: number
    hi: number
    bids: number[]
    asks: number[]
    mid: number
  }
  params: Record<string, number>
}

export type CouplingPayload = {
  strength: number
  market_to_ants: number
  ants_to_market_supply: number
  flock_to_market_bias: number
  price_norm: number
}

export type EmergenceState = {
  tick: number
  paused: boolean
  ants: AntPayload
  flock: FlockPayload
  market: MarketPayload
  coupling: CouplingPayload
  metrics: {
    entropy: {
      ants: number
      flock: number
      market: number
      aggregate: number
    }
    emergence_index: number
    complexity: number
    phase: { active: boolean; zscore: number; direction?: string }
    history: { entropy: number[]; emergence: number[] }
  }
}
