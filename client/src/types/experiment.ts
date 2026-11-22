import type { FlockPayload } from "../types"

export type FlockMetricRow = {
  tick: number
  cohesion: number
  separation: number
  alignment: number
  spatial_entropy: number
  mean_speed: number
}

export type FlockArmResult = {
  params: Record<string, number>
  metrics: FlockMetricRow[]
  snapshots: FlockPayload[]
  summary: {
    mean_cohesion: number
    mean_separation: number
    mean_alignment: number
    mean_spatial_entropy: number
    mean_speed: number
  }
}

export type FlockExperimentResult = {
  seed: number
  steps: number
  sample_every: number
  shared: Record<string, number>
  baseline: FlockArmResult
  variant: FlockArmResult
  interpretation: {
    deltas: Record<string, number>
    bullets: string[]
    disclaimer: string
  }
}
