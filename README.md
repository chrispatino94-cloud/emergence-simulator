# Emergence

**Emergence** is a real-time **complex systems simulator**: three coupled agent-based models run together in a single dashboard, with live metrics, cross-system feedback, and replayable runs.

---

## What are complex systems?

**Complex systems** are made of many interacting parts that follow simple local rules. No central controller writes the “big picture”—instead, **macroscopic order** (trails, flocks, prices) **emerges** from microscopic interactions. Examples include ant colonies, neural activity, ecosystems, cities, and markets.

Emergence makes that idea tangible: you watch **entropy**, an **emergence index**, and a **complexity score** update as the coupled simulations evolve.

---

## The three simulations

### 1. Ant colony forager

Hundreds of ants explore a 2D arena. When they find food they reinforce **pheromone trails** that evaporate and diffuse; others bias movement along trail gradients. Food sources **deplete**. The trail field is shown as a **heatmap**. Optional **particles** highlight pickups.

### 2. Flocking / murmuration

Large numbers of **boids** follow classic rules—**separation**, **alignment**, **cohesion**—near a **predator** that herds and scatters the group. Murmur-like motion and clustering arise without scripting global choreography. You can view the flock in **2D (canvas)** or **3D (Three.js)**.

### 3. Market emergence

Many **buyers** and **sellers** each hold private thresholds. **Trades** occur when bids and asks overlap; a **mid-price** and dynamics emerge from decentralized matching—there is no fixed “true price” in the rules. A live **order-book-style** visualization and price sparkline show booms, busts, and shocks (including an optional **external shock**).

### Coupling (why three panels talk to each other)

- **Market stress** (normalized price) feeds back into **ant effort** (foraging intensity).
- **Ant throughput** pushes **supply pressure** into the market.
- **Flock cohesion** nudges **market sentiment** (buy-side bias).

The dashboard highlights these links and streams live coupling values.

---

## Screenshots

Add PNG or WebP captures under `docs/screenshots/` and reference them here after your first run.

| View | Preview |
|------|---------|
| Full dashboard (triangle layout + coupling graph) | ![Dashboard](docs/screenshots/dashboard.png) |
| Ant colony heatmap & trails | ![Ant colony](docs/screenshots/ants.png) |
| Flocking (2D or 3D) | ![Flocking](docs/screenshots/flock.png) |
| Market order book & price | ![Market](docs/screenshots/market.png) |
| Metrics strip & replay | ![Metrics](docs/screenshots/metrics.png) |

*Until images exist, GitHub may show broken image icons—replace files locally and commit.*

---

## Tech stack

| Layer | Technology |
|--------|------------|
| Backend | **Python 3**, **Flask**, **Flask-SocketIO** (real-time WebSocket broadcast) |
| Persistence | **SQLite** (saved runs for replay / shareable links) |
| Simulation core | **NumPy** (vectorized grids & agents where helpful) |
| Frontend | **React** (TypeScript), **Vite** |
| Visualization | **D3.js** (order book, scales), **Canvas 2D** (ants, flock 2D), **Three.js** (flock 3D) |
| Transport | **Socket.IO** (browser ↔ server state stream) |

---

## Prerequisites

- **Python** 3.10+ (3.11+ recommended)
- **Node.js** 18+ and npm (for building the React client)

---

## Installation

```bash
git clone https://github.com/YOUR_USERNAME/emergence-simulator.git
cd emergence-simulator

# Python dependencies
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Frontend build (outputs to static/)
cd client
npm install
npm run build
cd ..
```

The SQLite database file is created automatically under `data/` on first run (ignored by git).

---

## Running

**Production-style (Flask serves API + built static assets):**

```bash
source .venv/bin/activate
python app.py
```

Open **http://127.0.0.1:5055/**.

**Frontend development** (hot reload; proxies API/WebSocket to Flask):

```bash
# Terminal 1
source .venv/bin/activate
python app.py

# Terminal 2
cd client && npm run dev
```

Then open the URL Vite prints (e.g. **http://127.0.0.1:5173**).

---

## Controls & shortcuts

- **Space** — pause / resume all simulations  
- **R** — reset  
- **1 / 2 / 3** — focus ant / flock / market panel  
- **Esc** — clear focus  
- **Export link** — saves the current snapshot ring and copies a shareable URL (`?run=<id>`)  
- Optional **sound** toggle — short audio cues tied to volatility / emergence  

---

## Project layout

```
app.py                 # Flask + Socket.IO entrypoint
requirements.txt
models/                # SQLite persistence
simulations/           # Ant colony, flocking, market, metrics, engine
templates/             # index.html shell
static/                # Vite build output (after npm run build)
client/                # React + Vite source
data/                  # Local SQLite (gitignored)
```

---

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE).

---

## Publishing to GitHub

From this directory (after [creating an empty repository](https://github.com/new) named `emergence-simulator` under your account):

```bash
git remote add origin https://github.com/YOUR_USERNAME/emergence-simulator.git
git branch -M main
git push -u origin main
```

Replace `YOUR_USERNAME`. SSH remotes work too (`git@github.com:YOUR_USERNAME/emergence-simulator.git`).

With [GitHub CLI](https://cli.github.com/) (`brew install gh` on macOS):

```bash
gh auth login
gh repo create emergence-simulator --public --source=. --remote=origin --push
```

---

## Experiment lab (flock A/B)

Compare two **predator-speed** settings under identical initial conditions:

1. Open the app and click **Experiment lab** in the header (live sim pauses to save CPU).
2. Set **baseline** and **variant** predator speeds, optional **seed** and **steps**.
3. Click **Run comparison** — the server runs two isolated flock simulations (no ants/market coupling).
4. Use side-by-side flock views, metric charts, and the plain-language readout.

API: `POST /api/experiment/flock` with JSON body `{ "seed": 42, "steps": 240, "shared": { "population": 320 }, "baseline": { "predator_speed": 0.018 }, "variant": { "predator_speed": 0.034 } }`.

Tests: `pip install -r requirements-dev.txt && pytest`.

