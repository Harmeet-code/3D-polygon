# Implementation Plan: Multi-Floor Pathfinding with Road Network

## Phase 1: JSON Schema & Data Layer

- [x] Task: Define road, stair, and entrance JSON schemas `c5ef2c6`
    - [~] Write tests for schema validation (skipped per user)
    - [x] Add `meta.roads[]` (polylines + width), `meta.stairs[]`, `meta.entrances[]` to floor JSON format
    - [x] Update `enrichment.js` to handle new meta fields
- [x] Task: Build road polygon generator from polylines `e902ab6`
    - [~] Write tests for polyline-to-polygon offset math (miter joints, corridor generation) (skipped per user)
    - [x] Implement `polylineToCorridor(points, width)` utility returning corner vertices
- [x] Task: Build stair matching cross-reference `ccc3227`
    - [~] Write tests for stair map construction (skipped per user)
    - [x] Implement cross-floor stair map built from all floor JSONs at boot
- [ ] Task: Conductor - User Manual Verification 'Phase 1: JSON Schema & Data Layer' (Protocol in workflow.md)

## Phase 2: Road Network Grid Integration

- [x] Task: Replace binary blocked grid with cost grid `a7d32d3`
    - [~] Write tests for cost grid initialization and road cell marking (skipped per user)
    - [x] Change `Uint8Array blocked` → `Float32Array costGrid` in `AStarRoute.js`
    - [x] Default all cells to `Infinity`; mark road corridor cells as `1.0`
- [x] Task: Update `rebuildBlockedGrid` → `rebuildCostGrid` `a7d32d3`
    - [~] Write tests for booth-road overlap resolution (booth wins) (skipped per user)
    - [x] Convert booth AABB cells to `Infinity`
    - [x] Convert road polyline corridor cells to `1.0`
    - [x] Tag stair cells as walkable `1.0`
- [x] Task: Update `aStar` and `findNearestFree` for cost grid `a7d32d3`
    - [~] Write tests for road-only A* (no off-road paths) (skipped per user)
    - [x] Modify `aStar` to check `costGrid[idx] === Infinity` instead of `blocked[idx]`
    - [x] Modify `findNearestFree` to search for nearest road cell within radius
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Road Network Grid Integration' (Protocol in workflow.md)

## Phase 3: Multi-Floor Routing Engine

- [x] Task: Build `multiFloorAStar()` function
    - [~] Write tests for cross-floor route discovery (skipped per user)
    - [x] Implement stair chain search across floors
    - [x] Compute per-floor A* segments via inline A* on cached grids
    - [x] Concatenate waypoints with stair penalty cost
- [x] Task: Wire multi-floor routing into UI
    - [~] Write tests for correct route segment selection when switching floors (skipped per user)
    - [x] Update route button handler to detect cross-floor routing
    - [x] Store the full multi-floor route per floor in a lookup
- [x] Task: Tab-switch camera animation
    - [~] Write tests for stair world position lookup (skipped per user)
    - [x] Before `loadFloor`, detect the stair used for transition
    - [x] After `loadFloor`, call `flyTo` targeting the stair's world position
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Multi-Floor Routing Engine' (Protocol in workflow.md)

## Phase 4: Visualization & UI

- [ ] Task: Render road overlay mesh
    - [ ] Write tests for road mesh generation from corridor polygons
    - [ ] Build translucent dark-grey `MeshBasicMaterial` surface (`0x2a2a2a`, opacity 0.25)
    - [ ] Render road outline with `LineLoop` segments
    - [ ] Integrate into `BoothBuilder.js` floor-switch rebuild cycle
- [ ] Task: Build stair and entrance POI markers
    - [ ] Write tests for POI click interaction
    - [ ] Create 3D cylinder markers at stair positions
    - [ ] Add click handler to show info in sidebar/tooltip
    - [ ] Add entrance point markers (glowing circle + label)
- [ ] Task: Update route rendering for multi-floor display
    - [ ] Write tests for per-floor route segment extraction
    - [ ] Show only current floor's route segment
    - [ ] Highlight stair connection point with pulsing ring/beam
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Visualization & UI' (Protocol in workflow.md)
