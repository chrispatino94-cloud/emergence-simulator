export function LoadingScreen({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <div className="loading-screen">
      <div className="loading-core">
        <div className="pulse" />
        <div className="ring" />
      </div>
      <p>Emergence initializing…</p>
    </div>
  )
}
