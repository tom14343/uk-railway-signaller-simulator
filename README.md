# Adamfield — UK Railway Signaller Simulator

A browser-based UK railway signalling simulator. You take the role of a signaller
controlling the Adamfield signalling area: setting routes, operating points,
monitoring signal aspects and keeping trains moving safely.

This is an educational simulation based on British railway signalling principles.
It is not an operational signalling system and is not a substitute for railway
training.

## What is Adamfield?

Adamfield is the first (and currently only) signalling area in what is intended
to become a larger simulator. The area is a fictional but geographically coherent
stretch of four-aspect colour-light signalling territory containing:

- **Four running lines**: Up Fast, Up Slow, Down Slow and Down Fast.
- **Three stations**: Marshfield, Adamfield and Brackenhill, each with platforms
  on all four running lines.
- **Two boundary locations**: Norton (west) and Harrowgate (east), where trains
  enter and leave the controlled area.
- **Crossovers** at each station throat allowing moves between Fast and Slow
  lines in both Up and Down directions.
- **44 signals** and **12 point machines**.

## Signalling concepts represented

The simulator models real UK signalling behaviour rather than decorative
indicators:

- **Four-aspect colour-light signalling**: red, single yellow, double yellow and
  green, with the standard meaning — red is danger, single yellow means the next
  signal is at red, double yellow means the next signal is at single yellow, and
  green means proceed.
- **Block sections and track occupancy**: every section of line is a track
  circuit analogue; a signal cannot clear into an unsafe aspect while the block
  ahead is occupied.
- **Signal progression**: aspects are computed from the actual state of the
  railway — occupancy and the aspect of the signal ahead — producing the
  characteristic green → double yellow → single yellow → red cascade behind a
  train.
- **Route setting**: junction signals require a route to be set before they can
  clear. Routes are validated: occupied sections refuse the route, points locked
  by other routes conflict, and opposing movements across the same crossover are
  rejected.
- **Point operation**: points are set automatically by routes, and can also be
  operated manually when not locked by a route.
- **Station stops**: trains dwell at platforms for their scheduled times and
  cannot depart until the departure route is set and clear.
- **Train separation**: a train can never pass a signal at danger, regardless of
  what the timetable says.

## Current features

- Fully data-driven map and engine; Adamfield is one map definition among a
  registry that future maps will join.
- Working timetable of 20 trains (express and stopping services, both
  directions) with scheduled arrivals, departures and platform calls.
- Simulation clock with pause/resume and speed selection (1×–16×).
- Interactive track diagram: signal aspects, point positions, occupied
  sections, train positions, station and boundary labels.
- Route setting and cancellation with refusal reasons.
- Timetable panel; clicking a service highlights the train on the diagram.
- Selection panel for signals, points and trains.
- Event log of simulation activity.
- A reserved "Operational messages" panel for a future incident-messaging
  system (currently empty by design).

## Technology stack

- **React 19** + **TypeScript** — UI.
- **Vite 8** — build tool and dev server.
- No other runtime dependencies; the signalling engine is hand-written
  TypeScript in `src/engine/`.

## How the simulation works

The map is pure data (`src/maps/adamfield.ts`): nodes, track sections, points,
signals and precomputed routes. The engine (`src/engine/Simulation.ts`) consumes
any `MapDefinition`, so new areas can be added without touching the engine.

Each simulation step the engine:

1. Spawns trains whose scheduled entry time has arrived at a boundary.
2. Updates track-circuit occupancy from train positions.
3. Moves trains under kinematic control — they brake for red signals and
   scheduled station stops and can never violate a danger aspect.
4. Releases routes once their sections have cleared after a movement.
5. Recomputes every signal aspect from occupancy and the aspect ahead.

Trains follow fixed paths along their assigned line; crossovers are only used
when a signaller sets a diverging route.

## Installation

Requires Node.js 20.19+ (developed on Node 24).

```bash
git clone <repository-url>
cd railway-signaller
npm install
```

## Running locally

```bash
npm run dev
```

Then open the URL Vite prints (default `http://localhost:5173`).

## Building

```bash
npm run build
```

Produces a static `dist/` folder.

## Deploying to Vercel

The project is a standard Vite application and deploys to Vercel with no extra
configuration:

1. Push the repository to GitHub.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Vercel detects Vite automatically (build command `npm run build`, output
   directory `dist`). Accept the defaults and deploy.

Alternatively, with the Vercel CLI:

```bash
npm i -g vercel
vercel
```

No environment variables are required.

## Project structure

```
src/
  engine/
    types.ts          Core data model (map, signals, trains, timetable)
    Simulation.ts     Simulation engine: occupancy, aspects, routes, trains, clock
  maps/
    adamfield.ts      Adamfield map definition + timetable
  ui/
    App.tsx           Application shell and simulation loop
    TrackDiagram.tsx  SVG signalling diagram
    TopBar.tsx        Clock, status, speed and pause controls
    SidePanel.tsx     Timetable and selection panels
    BottomPanel.tsx   Operational messages (reserved) and event log
    geometry.ts       Train position → diagram coordinate mapping
    format.ts         Time formatting helpers
```

## Adding a future map

1. Create `src/maps/<name>.ts` exporting a `MapDefinition` (nodes, sections,
   points, signals, routes) and a `TrainSchedule[]` timetable. Reuse the
   generator approach in `adamfield.ts`.
2. Register it in a map registry (e.g. extend `src/maps/index.ts`) and let the
   UI select the active area.
3. The engine, diagram and panels require no changes — they are driven entirely
   by the map data.

## Testing

```bash
npm run lint      # oxlint
npm run build     # typecheck + production build
```

The signalling behaviour was verified headlessly during development: all 20
timetable trains complete their journeys, signals hold at danger without routes,
occupied sections refuse routes, opposing crossover movements conflict, and
points lock while routed.

## Contributing

Contributions are welcome. Please keep the code free of comments and
annotations, keep map data separate from the engine, and preserve the UK
signalling semantics described above. Open an issue or pull request on GitHub.

## Licence

MIT — see [LICENSE](LICENSE).

## References

Signalling principles implemented with reference to:

- **RSSB Rule Book** — train working and signalling rules.
- **Network Rail signalling principles** — four-aspect colour-light signalling,
  block sections and route setting.
- **SimSig Wiki** (simsig.co.uk) — community documentation of UK signal aspects
  and interlocking behaviour.
- **Wikipedia: UK railway signalling** — overview of aspect meanings and
  signalling practice.

This project is an educational simulation and is not affiliated with Network
Rail, the RSSB or any train operating company.
