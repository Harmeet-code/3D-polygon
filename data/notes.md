standard structure of JSON

```json
{
  "meta": {
    "image": "DenverFloorPlan1.jpg",
    "fabricBounds": {
      "minX": 416.33,
      "minY": 368.95,
      "maxX": 11390.02,
      "maxY": 8318.84
    },
    "mapping": {
      "offsetX": 0,
      "offsetY": 0,
      "scaleX": 1,
      "scaleY": 1
    }
  },
  "booths": [
    {
      "boothNo": "L1-15",
      "price": "1800.00",
      "size": "10x10",
      "boothType": "Yellow",
      "boothColor": "#ffef47",
      "gatePosition": "Top",
      "status": "AVAILABLE",
      "company": null,
      "geometry": {
        "type": "polygon",
        "points": [
          [5636.27, 5366.78],
          [5821.97, 5366.78],
          [5821.97, 5478.2],
          [5636.27, 5478.2]
        ]
      },
      "fabricBBox": {
        "x": 5636.27,
        "y": 5366.78,
        "w": 185.7,
        "h": 111.42
      }
    }
  ]
}
```

Three steps:

1. JSON → src/data/json/YourFloorName.json — booth geometry, meta.image: "YourFloorName.jpg", meta.fabricBounds, etc.
2. Image → src/data/floor plan/YourFloorName.jpg — the floor plan image
3. Manifest → add "YourFloorName" to the array in src/data/floors.json
   That's it. The tab system reads floors.json, creates a button labeled Floor N, and on click fetches the JSON + image automatically.

Phase 1 — Data Layer (just completed)
src/data/enrichment.js — Now handles meta.roads[], meta.stairs[], meta.entrances[]. If missing, defaults to []. Fills in sensible defaults (width, label, type).
src/scene/PolylineCorridor.js — polylineToCorridor(points, radius) takes a polyline centerline + half-width and returns a closed polygon with mitered corners. Used later to render road surfaces and mark grid cells as walkable.
src/scene/StairMap.js — Fetches all floor JSONs at boot, cross-references stairs by shared id. Exports:

- stairToGridCell(id, floorName) → grid cell for A\*
- stairToWorldPos(id, floorName) → 3D position for camera fly-to
- findConnectingStairs(floorA, floorB) → which stairs connect two floors
  How to define roads, stairs, entrances in your JSON
  Edit src/data/json/DenverFloorPlan1.json (and DenverFloorPlan2.json) inside meta:
  {
  "meta": {
  "image": "DenverFloorPlan1.jpg",
  "fabricBounds": { "minX": 416, "minY": 369, "maxX": 11390, "maxY": 8319 },
  "roads": [
  {
  "id": "main-aisle",
  "points": [[500, 4340], [5695, 4340], [11000, 4340]],
  "width": 250 // half-width per side (total corridor = 500 fabric units)
  },
  {
  "id": "cross-aisle",
  "points": [[3000, 500], [3000, 4340], [3000, 8000]],
  "width": 200
  }
  ],
  "stairs": [
  {
  "id": "stair-north", // SHARED across floors — same id in both JSONs
  "label": "North Staircase",
  "connects": ["DenverFloorPlan1", "DenverFloorPlan2"],
  "position": { "x": 5695, "y": 4340 },
  "type": "staircase" // or "elevator"
  }
  ],
  "entrances": [
  {
  "id": "main-entrance",
  "label": "Main Entrance",
  "position": { "x": 5695, "y": 300 },
  "description": "Main hall entrance from the convention center lobby."
  }
  ]
  }
  }
  Road placement tips
- Points are in fabric coordinates (the raw [x, y] units from your JSON booth data).
- Draw polylines along centerlines of actual aisles in your floor plan image.
- width is half-width — a road with width: 250 creates a corridor 500 units wide.
- For a cross/intersection, define two roads that cross at a shared point.
- Roads don't need to be pixel-perfect — the A\* treats the entire corridor as walkable.
  Stairs rules
- A stair on Floor 1 and the matching stair on Floor 2 must share the same id string.
- Positions can differ per floor (stairs aren't always in the same pixel location on every floor plan).
- connects tells the system which floors this stair links.
  What happens next in Phase 2
  The road data will be used to:

1. Replace the current Uint8Array blocked grid with a Float32Array costGrid
2. Mark road corridor cells as 1.0 (walkable), everything else as Infinity
3. Booth cells override roads (booth wins)
4. A\* will only route along road corridors

Your viewer_interactive.js uses OrbitControls from Three.js examples, which works by rotating a perspectiveCamera around a target point. But here's the thing: that camera's near/frustum is almost certainly set to the default 0.1–1000 range. Your floor plane is ~140 units wide and sits at y=0. When a booth is extruded to, say, y=2, and the camera orbits to a low angle, some booth polygons will clip through the near plane (0.1 units from camera), causing them to visually vanish or get sliced in half — exactly the "cut into 2 by the image plane" bug in your notes.md line 83.
The fix isn't tweaking near/far — it's realizing Three.js uses a left-handed coordinate system for the view matrix but right-handed for world space. The real fix is: don't extrude booths upward. Extrude them downward from y=0 to y=-0.5, and place the floor plane at y=0. The camera never dips below the floor (OrbitControls polar angle clamp), so no near-plane clipping can happen. Or just set renderer.localClippingEnabled = true and define a clipping plane at y=0.001 to surgically remove the subsurface artifacts.
That said, none of this matters if you haven't noticed that your buildBooths function creates a separate Mesh per booth instead of merging geometry with BufferGeometryUtils.mergeGeometries. At ~200 booths that's 200 draw calls when you could have 1. On an integrated GPU (which most trade show kiosks run), that's the difference between 60fps and 15fps.

---

For the chosen ones: Three.js InstancedMesh won't help you here because each booth has a unique color + polygon shape, and InstancedMesh requires uniform geometry per instance. But you can use mergeGeometries with a per-vertex color attribute, then apply the color via vertexColors: true on the material. This collapses all 200+ booths into a single draw call with zero material swaps. The GPU doesn't care about individual booth identities — it just renders triangles. Your CPU will thank you when someone loads the 4-story version with 800 booths and the frame budget doesn't implode.

Your calibration sliders expose offsetX/Y and scaleX/Y as independent controls, but they're not independent — and this is probably why your notes.md says "calibration values are not working properly."
Here's what's happening: your fabricToPixel function applies offset first, then scale. That means changing scaleX doesn't just stretch the geometry — it also moves the center of rotation away from the origin. The scale operation is anchored at (0,0) in pixel space, not at the center of the floor plan. So when you adjust scale to fix alignment on one side of the map, the opposite side drifts by a larger amount. Every calibration pass fights the previous one.
The mathematically correct solution: apply scale around the image center, not the origin.
transformedX = (x - imgCenterX) \* scaleX + imgCenterX + offsetX
This decouples offset (translation) from scale (dilation). Now scale only changes size, not position — exactly what your notes.md line 110 suspected but didn't solve.

---

For the chosen ones: Your entire coordinate pipeline is vulnerable to a subtle floating-point trap. Fabric coordinates range from ~416 to ~11390 (4 orders of magnitude). Pixel coordinates are 0–2400. Three.js world coordinates are 0–140. Each transformation involves a multiplication then an addition. The problem: IEEE 754 single-precision floats (which WebGL uses in shaders) lose sub-millimeter precision when you denormalize from 10,000 down to 0.5. The error is 0.0001% per vertex — invisible on a single booth, but when two adjacent booths share an edge computed from different transformation paths, that 0.0001% becomes a visible gap (or overlap) between polygons.
The fix nobody implements: store the 3D world coordinates in a Float32Array once after the first transformation, never recompute from fabric space. Your calibration sliders should only affect a uniform offset applied to the already-transformed world coordinates, not re-run the entire fabric→pixel→world pipeline. This freezes the floating-point error in place so adjacent booths always agree on where their shared edge is, regardless of calibration tuning.

---

For the chosen ones: There's a deeper insight hiding in your data. fabricBBox per booth is the axis-aligned bounding box in design space. But your booths rotate? No — they don't. Every polygon axis-aligned with the floor plan. So fabricBBox is actually the tight bounding box, meaning you could skip storing polygon points entirely for rectangular booths (~80% of them) and reconstruct the geometry from {x, y, w, h} alone. The JSON drops from 15K lines to ~3K. Your parser gets 5x faster. And the irregular booths (the remaining 20%) can be flagged with "type":"poly" vs "type":"rect". This isn't a micro-optimization — it's a data model insight that changes how you think about the problem from first principles.

    ```
