# Road Network & Multi-Floor Pathfinding — Design

## 1. Current A* Algorithm (How It Works Today)

### 1.1 Grid System

File: `src/scene/AStarRoute.js`

The floor plane is divided into a uniform grid. Every world coordinate maps to a cell.

```
CELL    = 1.2  world-units per cell side
cols    = ceil(PLANE_W / CELL)
rows    = ceil(PLANE_H / CELL)
blocked = Uint8Array(rows * cols)   // 1 = impassable, 0 = walkable
```

Two conversion functions bridge world and grid space:

| Function | Direction | Formula |
|---|---|---|
| `worldToCell(x, z)` | world → (r, c) | `c = floor((x + halfW) / CELL)`, `r = floor((halfH - z) / CELL)` |
| `cellToWorld(r, c)` | (r, c) → world | `x = (c + 0.5) * CELL - halfW`, `z = halfH - (r + 0.5) * CELL` |

The world origin `(0, 0)` falls at the center of the plane; grid indices are computed relative to the plane's bounds.

### 1.2 Obstacle Map (`rebuildBlockedGrid`)

Called after every booth rebuild. For each booth mesh:

1. Compute its world-space **axis-aligned bounding box** (AABB) via `THREE.Box3.setFromObject(mesh)`.
2. Expand the AABB by `MARGIN = 0.8` units on all sides (so the path doesn't clip booth walls).
3. Convert the expanded AABB corners to grid cells `(r0, c0)` → `(r1, c1)`.
4. Set `blocked[idx(r, c)] = 1` for every cell in that rectangle.

The result is a binary occupancy grid: walls/booths are blocked, everything else (aisles, empty space) is walkable.

```
┌─────────────────────────────────────────┐
│  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  · │
│  ·  ┌──────────┐  ·  ·  ┌──────┐  ·  · │
│  ·  │ BOOTH    │  ·  ·  │BOOTH │  ·  · │
│  ·  │ (blocked)│  ·  ·  │(blkd)│  ·  · │
│  ·  └──────────┘  ·  ·  └──────┘  ·  · │
│  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  · │
│  ·  ·  ┌──────────┐  ·  ·  ·  ·  ·  ·  │
│  ·  ·  │ BOOTH    │  ·  ·  ·  ·  ·  ·  │
│  ·  ·  └──────────┘  ·  ·  ·  ·  ·  ·  │
│  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  · │
└─────────────────────────────────────────┘
  · = walkable (0)    █ = blocked (1)
```

### 1.3 A* Search (`aStar(start, goal)`)

Standard A* with the following characteristics:

| Aspect | Implementation |
|---|---|
| **Heuristic** | Manhattan distance `|dr| + |dc|` |
| **Neighbors** | 8-directional (cardinal cost 1.0, diagonal cost 1.41) |
| **Open set** | Custom binary min-heap (fast push/pop) |
| **Closed set** | `Uint8Array` (one byte per cell) |
| **G cost** | `Float32Array` initialized to `1e9` |
| **Parent tracking** | `Int32Array` (cell index → parent cell index), -1 = no parent |
| **Early exit** | When the popped cell matches the goal index |
| **Path reconstruction** | Backtrack through `came[]` array from goal to start, then reverse |

The search explores ~8 neighbors per expanded cell, skipping:
- Cells outside grid bounds.
- Cells where `blocked[idx] === 1`.
- Cells already in the closed set.

### 1.4 Route Smoothing & Visualization (`drawRoute`)

The raw A* path is a jagged list of cell centers. `drawRoute` passes it to `THREE.CatmullRomCurve3` (tension 0.25) for smooth interpolation, then renders three visual layers:

| Layer | Geometry | Material | Purpose |
|---|---|---|---|
| **Base** | `TubeGeometry` (radius 0.5) | `MeshStandardMaterial` dark `0x07101f`, opacity 0.92 | Solid path body |
| **Glow** | `TubeGeometry` (radius 0.72) | `MeshBasicMaterial` blue `0x6aa9ff`, opacity 0.55 (pulsing) | Ambient glow |
| **Dots** | `Points` (80 samples along curve) | `PointsMaterial` white, size 0.55 | Marching animation |

All three sit just above the floor (`y = 0.14–0.18`).

---

## 2. Road Network — Permissible Paths

### 2.1 Data Format: Polylines in JSON

Each floor JSON gains a `meta.roads` array. Roads are defined as **polylines** (ordered point sequences) in fabric coordinates, each with an associated **width** (in fabric units) that the A* will use as the walkable corridor.

```json
{
  "meta": {
    "image": "DenverFloorPlan1.jpg",
    "fabricBounds": { "minX": 416, "minY": 369, "maxX": 11390, "maxY": 8319 },
    "roads": [
      {
        "id": "main-aisle-1",
        "points": [[500, 500], [6000, 500], [11000, 500]],
        "width": 300
      },
      {
        "id": "cross-aisle-a",
        "points": [[3000, 500], [3000, 4000], [3000, 8000]],
        "width": 250
      }
    ]
  }
}
```

Each road segment:
- `points`: ordered fabric-coordinate vertices forming a polyline centerline.
- `width`: half-width on each side of the centerline (so total corridor = `2 × width`).

### 2.2 Grid Cost Model (Road-Only Routing)

Change from binary blocked/unblocked to a **cost grid** (`Float32Array`):

| Cell type | Cost | Meaning |
|---        |---   |---      | 
| Inside booth AABB | `Infinity` | Impassable |
| Inside a road corridor | `1.0` | Preferred — only walkable cells |
| Outside both | `Infinity` | Impassable (no off-road walking) |

**Only road-corridor cells are walkable.** This enforces the constraint that the path must stay on designated roads.

### 2.3 Road → Grid Conversion

During `rebuildBlockedGrid` (renamed to `rebuildCostGrid`):

1. Initialize all cells to `Infinity` (everything blocked by default).
2. For each booth, mark its expanded AABB cells as `Infinity` (already blocked).
3. For each road polyline with width:
   - Convert each line segment to pixel/fabric space.
   - For every grid cell, compute the **minimum distance** from the cell center to the nearest road centerline segment.
   - If distance ≤ width, set cell cost to `1.0`.
4. Booth-over-road overlap: booth cells stay `Infinity` (booth wins).

This produces a cost grid where only road corridors are passable, and booths punch holes through them.

```
Legend:
  █ = booth (Infinity)
  ░ = road corridor (cost 1.0)
  · = outside road (Infinity — impassable)

┌─────────────────────────────────────────┐
│ · · · · · · · · · · · · · · · · · · · ·│
│ · · · ░░░░░░░░░░░░░░░
░░░░░░░░ · · · · ·│
│ · · · ░  ┌──────────┐  ░░░░░░░░░ · · · │
│ · · · ░  │ BOOTH A  │  ░ · · · · · · · │
│ · · · ░  │(blocked) │  ░ · · · · · · · │
│ · · · ░  └──────────┘  ░ · · · · · · · │
│ · · · ░░░░░░░░░░░░░░░░░░░ · · · · · · ·│
│ · · · · · · ░░░░░░░░░░░░░░░ · · · · · ·│
│ · · · · · · ░  ┌──────┐  ░ · · · · · · │
│ · · · · · · ░  │BOOTH │  ░ · · · · · · │
│ · · · · · · ░  │  B   │  ░ · · · · · · │
│ · · · · · · ░  └──────┘  ░ · · · · · · │
│ · · · · · · ░░░░░░░░░░░░░░░ · · · · · ·│
│ · · · · · · · · · · · · · · · · · · · ·│
└─────────────────────────────────────────┘
```

The A* naturally routes along the road corridors because only those cells have finite cost. If start or goal falls outside a road corridor, `findNearestFree` snaps them to the nearest road cell (within a search radius).

### 2.4 Path Smoothing

No change — the existing `CatmullRomCurve3` smoothing works on the resulting waypoint centers. Since all waypoints lie inside road corridors, the smoothed curve will naturally follow the road centerline.

---

## 3. Multi-Floor Pathfinding

### 3.1 Architecture Overview

Hierarchical approach (recommended over 3D grid):

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   FLOOR 1 GRID   │     │   FLOOR 2 GRID   │     │   FLOOR N GRID   │
│  (cols × rows)   │     │  (cols × rows)   │     │  (cols × rows)   │
│                  │     │                  │     │                  │
│  A* on Floor 1   │     │  A* on Floor 2   │     │  A* on Floor N   │
│  (road cells)    │     │  (road cells)    │     │  (road cells)    │
└───────┬──────────┘     └───────┬──────────┘     └───────┬──────────┘
        │                       │                       │
        └───────────┬───────────┴───────────┬───────────┘
                    │                       │
             ┌──────▼──────┐         ┌──────▼──────┐
             │  STAIR /    │         │  STAIR /    │
             │  ELEVATOR   │         │  ELEVATOR   │
             │  CONNECTION │         │  CONNECTION │
             │  (1↔2)      │         │  (2↔3)      │
             └─────────────┘         └─────────────┘
```

### 3.2 Stair/Elevator Data

In each floor's `meta`:

```json
{
  "meta": {
    "roads": [...],
    "stairs": [
      {
        "id": "stair-north",
        "label": "North Staircase",
        "connects": [1, 2],
        "position": { "x": 5000, "y": 4200 },
        "type": "staircase"
      },
      {
        "id": "elevator-main",
        "label": "Main Elevator",
        "connects": [1, 2, 3],
        "position": { "x": 8000, "y": 2000 },
        "type": "elevator"
      }
    ]
  }
}
```

Stairs are defined by their **fabric coordinates** on each floor they connect. If the same physical stair appears on multiple floors, it should have the **same `id`** in each floor's JSON so the system can match them.

Stair cells in the grid are **special**:
- They are always walkable (cost `1.0`), even if they overlap a booth.
- They are tagged with the stair ID so the A* knows they're a portal.

### 3.3 Cross-Floor Routing Algorithm

When a route spans multiple floors:

1. **Determine start and goal floors** from the user's dropdown selections.
2. If start and goal are on the same floor → run single-floor A* (current behavior, but constrained to roads).
3. If start and goal are on different floors:
   a. Find all stairs/elevators that connect the two floors (or form a chain: Floor 1 → stair → Floor 2 → stair → Floor 3).
   b. For each possible stair chain, compute:
      - Floor 1: A* from start cell → stair-on-Floor-1 cell.
      - Floor 2: A* from stair-on-Floor-2 cell → goal (or next stair cell).
      - Total cost = sum of floor costs + stair penalty (e.g., 5.0 per stair climb).
   c. Pick the lowest total-cost chain.
   d. Concatenate all waypoints across floors.

**Stair penalty** (5.0 in the example above) prevents the A* from taking a longer road + stair route when a shorter single-floor route exists. Tune empirically.

### 3.4 Data Structure for Stair Matching

```js
// Built from all floor JSONs at boot
const stairMap = {
  "stair-north": {
    label: "North Staircase",
    type: "staircase",
    floors: {
      1: { r: 42, c: 15 },
      2: { r: 43, c: 16 }
    }
  },
  "elevator-main": {
    label: "Main Elevator",
    type: "elevator",
    floors: {
      1: { r: 10, c: 80 },
      2: { r: 10, c: 80 },
      3: { r: 11, c: 81 }
    }
  }
};
```

### 3.5 Visualization: Stair Markers

Each stair on the current floor is rendered as a 3D marker:

- **Geometry**: A vertical cylinder (or a custom signpost mesh) at the stair's world position, at booth height.
- **Color/material**: Distinctive color (`0x44aaff`) with emissive glow.
- **Label**: "North Staircase" text on a flat plane (same label technique as booth labels).
- **Interaction**: Clickable — clicking a stair opens a POI info popup showing connected floors and the stair name.

### 3.6 Tab Switch Camera Animation

When the user switches floors (via tab click) while a multi-floor route is active:

1. Before switching, **note the stair** the path uses to transition between the current floor and the target floor.
2. Switch the floor (JSON load, rebuild, etc. — existing `loadFloor`).
3. On the new floor, **animate the camera** to fly toward the matching stair's world position.
4. Use the existing `flyTo(camPos, lookTarget, duration)` function with a duration of ~600ms, panning from the stair.

**Animation flow:**

```
User on Floor 1, viewing route
  │  clicks "Floor 2" tab
  ▼
Store stair ID that Floor 1 → Floor 2 uses
  │
  ▼
loadFloor("DenverFloorPlan2") runs
  │  (loader spinner visible)
  ▼
Scene rebuilt with Floor 2 data
  │
  ▼
Look up stair's world position on Floor 2
  │
  ▼
flyTo(camera 30 units above stair, look at stair, 600ms)
  │
  ▼
Loader hides, user sees Floor 2 from the stair's perspective
```

The effect: the camera "enters" the new floor through the staircase the route uses, giving spatial continuity.

### 3.7 Cross-Floor Route Highlight

On each floor, only the portion of the route that lies on that floor is rendered. The stair connection point is marked with a glowing vertical beam or a pulsing ring at the stair position.

---

## 4. Entrances — Visual Landmarks & Clickable POIs

### 4.1 Data Format

```json
{
  "meta": {
    "entrances": [
      {
        "id": "main-entrance",
        "label": "Main Entrance",
        "position": { "x": 6000, "y": 300 },
        "description": "Main hall entrance from the convention center lobby."
      }
    ]
  }
}
```

### 4.2 Visual Overlay

Each entrance renders as a **point marker** on the floor:

- **Position**: Converted from fabric coords to world coords.
- **Appearance**: Small glowing circle or pin icon on the floor plane.
- **Label**: Entrance name on a flat label (same technique as booth labels, but a different color — e.g., gold `#ffd700`).
- **Click interaction**: Clicking an entrance opens the POI info panel (reuse/extend the sidebar's booth info section, or use a tooltip popup).

### 4.3 Road Network Overlay (Visual Only)

Road corridors are rendered as a **translucent dark grey overlay** on the floor:

| Layer | Geometry | Material | Z-order |
|---|---|---|---|
| Road surface | `PlaneGeometry` per road segment (or a single merged geometry) | `MeshBasicMaterial` color `0x2a2a2a`, opacity 0.25, transparent | Just above floor (`y = 0.04`) |
| Road outline | `LineLoop` or `LineSegments` per road segment | `LineBasicMaterial` color `0x3a3a4a`, opacity 0.4 | On top of road surface (`y = 0.05`) |

The road polygons are generated from the polylines + width data at load time (not pre-baked in the JSON). Each polyline with width produces a rectangular corridor polygon by offsetting the centerline.

```
  (x1,y1)──────(x2,y2)
    │  corridor  │
    │  width/2   │
    │            │
    │  centerline│
    │            │
    │  width/2   │
    │            │
  (x4,y4)──────(x3,y3)
```

For polylines with more than 2 points, consecutive segments are joined with a miter joint to form a continuous ribbon.

### 4.4 POI Info Panel

Reuse the existing sidebar booth info section (or a new `#poiInfo` section) to show:

- **Name**: Entrance/stair name.
- **Type**: "Entrance", "Staircase", "Elevator".
- **Description**: From JSON.
- **Connected floors**: For stairs/elevators.
- **"Route to here" button**: Sets the POI as the route destination.

The POI panel replaces or supplements the booth info when a POI is selected.

---

## 5. Summary of Required Changes

| Component | Change |
|---|---|
| **JSON schema** | Add `meta.roads[]`, `meta.stairs[]`, `meta.entrances[]` to each floor file |
| **Grid cost model** | Change `Uint8Array blocked` → `Float32Array costGrid`. Default `Infinity`. Only road cells = `1.0`. Booth cells override to `Infinity`. |
| **`rebuildBlockedGrid`** | Rename to `rebuildCostGrid`. Add road-to-cell conversion logic. |
| **`aStar`** | Change `blocked[idx]` check to `costGrid[idx] === Infinity` check. Otherwise unchanged. |
| **`findNearestFree`** | Search radius for nearest road cell (currently searches nearest non-blocked cell). |
| **Stair matching** | Build `stairMap` cross-reference at boot. |
| **Cross-floor routing** | New function `multiFloorAStar(startFloor, startBooth, endFloor, endBooth)` that chains per-floor A* calls via stairs. |
| **Stair markers** | 3D cylinders + labels at stair positions, rebuilt on floor switch. |
| **Entrance markers** | Clickable floor-level POIs + info popup. |
| **Road overlay** | Translucent dark-grey mesh generated from road polylines, rendered on floor switch. |
| **Tab switch camera** | Before `loadFloor`, detect stair connection; after load, `flyTo` that stair. |
| **POI interaction** | Click handler on stair/entrance meshes to show info in sidebar/tooltip. |

---

## 6. Open Questions / Clarifications

1. **Road polylines:** Should each road segment be a straight line between two points, or can they have multiple vertices forming a curve? (Answer given: polylines — multi-vertex, like `[[x1,y1], [x2,y2], [x3,y3]]`.)

2. **Road width:** Constant per road, or can it vary per segment? (Assumption: constant per road entry in JSON.)

3. **Booths on top of roads:** If a booth polygon overlaps a road corridor, the booth wins (cell is blocked). Is that always correct, or are there cases where a "walk-through" booth exists (e.g., a concession stand)? (Assumption: booth always wins.)

4. **Stair-to-stair matching across floors:** Should stairs with the same `id` across floors always have the same pixel/fabric offset, or could a stair on Floor 1 be at `(5000, 4000)` and the matching stair on Floor 2 be at `(5200, 3800)`? (Assumption: arbitrary positions per floor, matched only by `id`.)

5. **Route display on non-current floors:** When viewing a multi-floor route, should the non-visible floor segments be hidden, or shown in a ghosted/faded state? (Assumption: hidden — only the current floor's segment is shown.)

6. **POI info panel:** Should it replace the booth info in the sidebar, or be a separate section (e.g., a tooltip popup like the booth marker)? (Recommendation: reuse the sidebar's info section with a new "POI Info" heading, and add a click-outside-to-dismiss behavior.)
