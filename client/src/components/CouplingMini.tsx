import { memo } from "react"
import type { CouplingPayload } from "../types"

type Props = { c: CouplingPayload }

export const CouplingMini = memo(function CouplingMini({ c }: Props) {
  return (
    <svg viewBox="0 0 320 200" className="coupling-svg" role="img" aria-label="Interconnection graph">
      <defs>
        <linearGradient id="emg" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#39ffb5" stopOpacity="0.9" />
        </linearGradient>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6 z" fill="#6ad0ff" />
        </marker>
      </defs>
      <rect x="0" y="0" width="320" height="200" fill="rgba(6,10,18,0.6)" stroke="rgba(0,229,255,0.2)" />
      <text x="12" y="20" fill="#8fa6c4" fontSize="11" fontWeight="600">
        Interconnections
      </text>
      <circle cx="160" cy="40" r="10" fill="#0c1a2a" stroke="#7fe7ff" />
      <text x="160" y="44" textAnchor="middle" fill="#cfe8ff" fontSize="9">
        M
      </text>
      <text x="160" y="24" textAnchor="middle" fill="#7fe7ff" fontSize="9">
        Market
      </text>
      <circle cx="60" cy="150" r="10" fill="#0c1a2a" stroke="#39ffb5" />
      <text x="60" y="154" textAnchor="middle" fill="#e8fff4" fontSize="9">
        A
      </text>
      <text x="60" y="175" textAnchor="middle" fill="#8ec9ff" fontSize="9">
        Ants
      </text>
      <circle cx="260" cy="150" r="10" fill="#0c1a2a" stroke="#ffb547" />
      <text x="260" y="154" textAnchor="middle" fill="#fff4df" fontSize="9">
        F
      </text>
      <text x="260" y="175" textAnchor="middle" fill="#ffd89a" fontSize="9">
        Flock
      </text>
      <path
        d="M 155 52 Q 110 90 68 138"
        fill="none"
        stroke="url(#emg)"
        strokeWidth={1 + c.strength * 3}
        markerEnd="url(#arrow)"
        strokeDasharray="6 6"
      >
        <animate attributeName="stroke-dashoffset" from="0" to="-120" dur="6s" repeatCount="indefinite" />
      </path>
      <path
        d="M 165 52 Q 210 90 252 138"
        fill="none"
        stroke="#ffb547"
        strokeWidth={1 + Math.abs(c.flock_to_market_bias) * 3}
        markerEnd="url(#arrow)"
        opacity={0.85}
      />
      <path
        d="M 72 150 L 248 150"
        fill="none"
        stroke="#39ffb5"
        strokeWidth={1 + c.ants_to_market_supply}
        markerEnd="url(#arrow)"
        opacity={0.75}
      />
      <text x="12" y="118" fill="#a9bddc" fontSize="9">
       → ants boost {c.market_to_ants.toFixed(2)}
      </text>
      <text x="12" y="132" fill="#a9bddc" fontSize="9">
        supply {c.ants_to_market_supply.toFixed(2)}
      </text>
      <text x="180" y="118" fill="#a9bddc" fontSize="9">
        flock bias {c.flock_to_market_bias.toFixed(2)}
      </text>
      <text x="12" y="190" fill="#6ee7ff" fontSize="9">
        coupling {c.strength.toFixed(3)} · px {c.price_norm.toFixed(2)}
      </text>
    </svg>
  )
})
