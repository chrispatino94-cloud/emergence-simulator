type Props = { open: boolean; onClose: () => void }

export function TutorialOverlay({ open, onClose }: Props) {
  if (!open) return null
  return (
    <div className="tutorial">
      <div className="tutorial-card">
        <header>
          <h2>What is emergence here?</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <section>
          <h3>Ant colony</h3>
          <p>
            Simple ants leave trails when they find food. No central planner — yet efficient routes and
            adaptive logistics appear from local rules + chemistry.
          </p>
        </section>
        <section>
          <h3>Flocking</h3>
          <p>
            Each boid only sees neighbors. Order is not programmed — V-like shapes and murmuration arise from
            separation, alignment, and cohesion interacting with a predator.
          </p>
        </section>
        <section>
          <h3>Market</h3>
          <p>
            Buyers and sellers carry private thresholds. Price is nowhere in the code as a rule — it emerges from
            bid/ask encounters, speculation, and volatility.
          </p>
        </section>
        <section>
          <h3>Coupling</h3>
          <p>
            The three panels exchange pressures: market stress increases ant effort, flock cohesion nudges
            sentiment, and ant supply feeds back into pricing.
          </p>
        </section>
        <footer>
          <button type="button" className="primary" onClick={onClose}>
            Enter the lab
          </button>
        </footer>
      </div>
    </div>
  )
}
