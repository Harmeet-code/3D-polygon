# Hybrid Walkable Zone Design — 2026-05-20

## Problem

The current road/walkable system has two major issues:

1. **Performance**: `rebuildCostGrid` iterates O(rows × cols × roads), doing `distSqToPolyline` checks per cell per road. For a 70×70 grid with 5 roads, that's ~25,000 distance checks per road = ~125K operations. MultiFloorRoute duplicates this with a hardcoded 80×80 grid.

2. **UX**: Roads are defined as polylines with width, requiring manual JSON editing. The RoadEditor copies JSON to clipboard instead of applying directly. The From/To dropdowns have no floor filtering or search.

## Solution

Replace `meta.roads` with `meta.walkableZones` and use pure grid rasterization (Approach 1). Booths block via `fabricBBox`, zones enable walkable cells. A* reads a boolean grid — zero polygon math during pathfinding.

---

## Section 1: Data Model

### Current
```json
"meta": {
  "roads": [
    { "id": "...", "points": [[x,y],...], "width": 180 }
  ]
}
```

### New
```json
"meta": {
  "walkableZones": [
    {
      "id": "zone-1",
      "type": "rect",
      "x": 500, "y": 8000, "w": 11000, "h": 400
    },
    {
      "id": "zone-2",
      "type": "polygon",
      "points": [[x1,y1], [x2,y2], [x3,y3], ...]
    }
  ]
}
```

- `meta.roads` removed entirely
- Zone types: `rect` (x, y, w, h in fabric coords) or `polygon` (array of [x,y] points)
- Existing floor JSONs need one-time migration: roads → zone rectangles (centerline + width → rect bounds)
- Zone IDs are stable strings for editor reference

---

## Section 2: Grid Rasterization

### Algorithm

`rebuildCostGrid` becomes two O(n) passes:

**Pass 1: Block all cells**
```js
costGrid.fill(INF) // Everything blocked by default
```

**Pass 2: Unblock walkable zones**
For each zone, rasterize onto the grid:
- `rect` zones → compute fabric→pixel→world bounds, mark cells as `1.0`
- `polygon` zones → scanline-fill: for each row, find edge intersections, fill between pairs

**Pass 3: Re-block booths**
Use `fabricBBox` (already on every booth) instead of `THREE.Box3`:
```js
for (const b of data.booths) {
  const { x, y, w, h } = b.fabricBBox
  // fabric → pixel → world → cell range
  // mark cells as INF
}
```

**Result:** `costGrid[r,c]` is `1.0` for walkable, `INF` for blocked. A* reads it directly.

### Performance

O(zones + booths) instead of O(cells × roads). For 400 booths + 5 zones on a 70×70 grid: ~400 ops vs ~2M ops. ~10x faster.

### MultiFloorRoute

Remove hardcoded 80×80 grid. Use the same `rebuildCostGrid` via `initGrid(PLANE_W, PLANE_H)` for consistency.

---

## Section 3: Zone Editor UI

Replaces `RoadEditor.js` with `ZoneEditor.js`.

### Modes

- **+ Rect** — Click two points: first corner, drag to opposite corner, click to place. Shows translucent preview while dragging.
- **+ Polygon** — Click to place points, double-click or right-click to close. Shows translucent fill preview.
- **Remove** — Click an existing zone to delete it.

### Visual Feedback

- Final walkable zones: grey translucent (`0x888888`, opacity 0.15) with solid border
- Zone being drawn: blue translucent (`0x44aaff`, opacity 0.25)
- Zone points shown as small spheres

### Apply Behavior

- Zones added to `data.meta.walkableZones` in memory
- Grid rebuilds immediately, visual overlay updates
- "Copy JSON" button exports updated zones for saving to floor file

### Files Changed

- Delete: `src/scene/RoadEditor.js`, `src/scene/RoadOverlay.js`, `src/scene/PolylineCorridor.js`
- Create: `src/scene/ZoneEditor.js`, `src/scene/ZoneOverlay.js`
- Modify: `src/scene/AStarRoute.js`, `src/scene/MultiFloorRoute.js`, `src/main.js`, `src/index.html`

---

## Section 4: Sidebar — Floor Selectors + Combobox Search

Replaces `fromSelect` / `toSelect` `<select>` elements.

### Structure

```
Directions (Booth → Booth)

From Floor: [Dropdown ▾]     ← filters From combobox to this floor's booths
From:       [Combobox input ▾] ← type to filter, click to select

To Floor:   [Dropdown ▾]     ← filters To combobox to this floor's booths
To:         [Combobox input ▾] ← type to filter, click to select

[Show Route] [Clear]
```

### Combobox Behavior

- Input field with dropdown arrow
- Typing filters booth list by `boothNo` or `company`
- Arrow keys navigate, Enter selects, Escape closes
- Clicking outside closes
- Shows `boothNo — company` in dropdown: `P18 — Acme Corp`
- If no floor selected, shows all booths grouped by floor

### Files Changed

- Modify: `src/ui/Filters.js`, `src/index.html`, `src/main.js`

---

## Section 5: A* Pathfinding Changes

The A* algorithm itself stays the same. What changes is how the grid is built.

### Bottlenecks Removed

- No more `distSqToPolyline` per cell per road
- No more `THREE.Box3` computation from meshes
- `MultiFloorRoute.js` hardcoded 80×80 grid removed

### New `rebuildCostGrid`

```js
export function rebuildCostGrid(data) {
  costGrid.fill(INF)
  rasterizeWalkableZones(data.meta.walkableZones)
  blockBoothCells(data.booths)
}
```

### Routing Logic

Single-floor routing uses the grid directly. Cross-floor routing uses the same grid build via `cacheFloorGrid` but now with zone rasterization instead of road distance checks.

---

## Migration Plan

1. Create `ZoneEditor.js` + `ZoneOverlay.js`
2. Update `AStarRoute.js` rasterization (remove road distance checks, add zone + fabricBBox)
3. Update `MultiFloorRoute.js` to use new grid build
4. Build sidebar comboboxes with floor selectors
5. Update `main.js` wiring
6. Update `index.html` UI
7. Migrate existing floor JSONs: roads → walkableZones
8. Delete old files: `RoadEditor.js`, `RoadOverlay.js`, `PolylineCorridor.js`
