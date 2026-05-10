let ctx: AudioContext | null = null
let master: GainNode | null = null

export function ensureAudio(): AudioContext | null {
  if (typeof window === "undefined") return null
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  if (!ctx) {
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0.06
    master.connect(ctx.destination)
  }
  return ctx
}

export function playEmergenceTick(enabled: boolean, emergence: number, coupling: number, shock: boolean) {
  if (!enabled || !master) return
  const audio = ensureAudio()
  if (!audio) return
  if (audio.state === "suspended") void audio.resume()

  const osc = audio.createOscillator()
  osc.type = "triangle"
  osc.frequency.value = 110 + emergence * 260 + coupling * 140 + (shock ? 90 : 0)

  const g = audio.createGain()
  g.gain.value = 0.0001
  g.gain.exponentialRampToValueAtTime(0.08, audio.currentTime + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.09)

  osc.connect(g)
  g.connect(master!)
  osc.start()
  osc.stop(audio.currentTime + 0.1)
}
