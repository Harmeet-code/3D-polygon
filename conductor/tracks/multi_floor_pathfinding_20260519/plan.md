# Implementation Plan: Multi-Floor Pathfinding with Road Network

## Phase 1: JSON Schema & Data Layer

- [~] Task: Define road, stair, and entrance JSON schemas
    - [~] Write tests for schema validation (skipped per user)
    - [x] Add `meta.roads[]` (polylines + width), `meta.stairs[]`, `meta.entrances[]` to floor JSON format
    - [x] Update `enrichment.js` to handle new meta fields
- [ ] Task: Build road polygon generator from polylines
    - [ ] Write tests for polyline-to-polygon offset math (miter joints, corridor generation)
    - [ ] Implement `polylineToCorridor(points, width)` utility returning corner vertices
- [ ] Task: Build stair matching cross-reference
    - [ ] Write tests for stair map construction
    - [ ] Implement cross-floor stair map built from all floor JSONs at boot
- [ ] Task: Conductor - User Manual Verification 'Phase 1: JSON Schema & Data Layer' (Protocol in workflow.md)

## Phase 2: Road Network Grid Integration

- [ ] Task: Replace binary blocked grid with cost grid
    - [ ] Write tests for cost grid initialization and road cell marking
    - [ ] Change `Uint8Array blocked` → `Float32Array costGrid` in `AStarRoute.js`
    - [ ] Default all cells to `Infinity`; mark road corridor cells as `1.0`
- [ ] Task: Update `rebuildBlockedGrid` → `rebuildCostGrid`
    - [ ] Write tests for booth-road overlap resolution (booth wins)
    - [ ] Convert booth AABB cells to `Infinity`
    - [ ] Convert road polyline corridor cells to `1.0`
    - [ ] Tag stair cells as walkable `1.0`
- [ ] Task: Update `aStar` and `findNearestFree` for cost grid
    - [ ] Write tests for road-only A* (no off-road paths)
    - [ ] Modify `aStar` to check `costGrid[idx] === Infinity` instead of `blocked[idx]`
    - [ ] Modify `findNearestFree` to search for nearest road cell within radius
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Road Network Grid Integration' (Protocol in workflow.md)

## Phase 3: Multi-Floor Routing Engine

- [ ] Task: Build `multiFloorAStar()` function
    - [ ] Write tests for cross-floor route discovery
    - [ ] Implement stair chain search across floors
    - [ ] Compute per-floor A* segments via existing `aStar()`
    - [ ] Concatenate waypoints with stair penalty cost
- [ ] Task: Wire multi-floor routing into UI
    - [ ] Write tests for correct route segment selection when switching floors
    - [ ] Update route button handler to detect cross-floor routing
    - [ ] Store the full multi-floor route per floor in a lookup
- [ ] Task: Tab-switch camera animation
    - [ ] Write tests for stair world position lookup
    - [ ] Before `loadFloor`, detect the stair used for transition
    - [ ] After `loadFloor`, call `flyTo` targeting the stair's world position
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
