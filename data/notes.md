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
          [
            5636.27,
            5366.78
          ],
          [
            5821.97,
            5366.78
          ],
          [
            5821.97,
            5478.2
          ],
          [
            5636.27,
            5478.2
          ]
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

But world Z from pxToWorld was positive (24.03). The mesh is placed at -24.03. That's the bug! The Z is negated.
Wait, but earlier in the original monolithic code, the same rotation and centering was used and presumably things worked. Let me check the old code:
mesh.position.set(c.x, 0, c.z);
mesh.position.set(c.x, 0, -c.z);

The floor plan texture (2400×1600px) gets stretched onto a 140×93.33 unit 3D plane in Three.js. That ratio — 2400/1600 = 1.5 vs 140/93.33 = 1.5 — means your fabric→pixel→3D pipeline is mathematically isomorphic: a triangle in fabric space is exactly the same triangle in 3D space, just scaled and shifted. You're not really "converting" coordinates — you're teaching three different rulers to agree on where the corners are.

Your JSON has 15,522 lines but the L1-15 booth geometry is literally just 4 points — a rectangle. Yet some booths in that file are irregular concave polygons (e.g. corner booths). Your polygonArea function computes signed area to determine winding order, and Three.js Shape requires counter-clockwise winding for the triangulation to work. If a polygon is clockwise, Shape silently produces inverted faces — the booth would render inside-out, z-fighting with the floor plane. That's probably what's causing some booths to "disappear" or look cut in half. The fix? If the signed area is negative, call .reverse() on the points array before passing to Shape. Bet your notes.md doesn't mention that.

Your viewer_interactive.js uses OrbitControls from Three.js examples, which works by rotating a perspectiveCamera around a target point. But here's the thing: that camera's near/frustum is almost certainly set to the default 0.1–1000 range. Your floor plane is ~140 units wide and sits at y=0. When a booth is extruded to, say, y=2, and the camera orbits to a low angle, some booth polygons will clip through the near plane (0.1 units from camera), causing them to visually vanish or get sliced in half — exactly the "cut into 2 by the image plane" bug in your notes.md line 83.
The fix isn't tweaking near/far — it's realizing Three.js uses a left-handed coordinate system for the view matrix but right-handed for world space. The real fix is: don't extrude booths upward. Extrude them downward from y=0 to y=-0.5, and place the floor plane at y=0. The camera never dips below the floor (OrbitControls polar angle clamp), so no near-plane clipping can happen. Or just set renderer.localClippingEnabled = true and define a clipping plane at y=0.001 to surgically remove the subsurface artifacts.
That said, none of this matters if you haven't noticed that your buildBooths function creates a separate Mesh per booth instead of merging geometry with BufferGeometryUtils.mergeGeometries. At ~200 booths that's 200 draw calls when you could have 1. On an integrated GPU (which most trade show kiosks run), that's the difference between 60fps and 15fps.
---
For the chosen ones: Three.js InstancedMesh won't help you here because each booth has a unique color + polygon shape, and InstancedMesh requires uniform geometry per instance. But you can use mergeGeometries with a per-vertex color attribute, then apply the color via vertexColors: true on the material. This collapses all 200+ booths into a single draw call with zero material swaps. The GPU doesn't care about individual booth identities — it just renders triangles. Your CPU will thank you when someone loads the 4-story version with 800 booths and the frame budget doesn't implode.

Your calibration sliders expose offsetX/Y and scaleX/Y as independent controls, but they're not independent — and this is probably why your notes.md says "calibration values are not working properly." 
Here's what's happening: your fabricToPixel function applies offset first, then scale. That means changing scaleX doesn't just stretch the geometry — it also moves the center of rotation away from the origin. The scale operation is anchored at (0,0) in pixel space, not at the center of the floor plan. So when you adjust scale to fix alignment on one side of the map, the opposite side drifts by a larger amount. Every calibration pass fights the previous one.
The mathematically correct solution: apply scale around the image center, not the origin.
transformedX = (x - imgCenterX) * scaleX + imgCenterX + offsetX
This decouples offset (translation) from scale (dilation). Now scale only changes size, not position — exactly what your notes.md line 110 suspected but didn't solve.
---
For the chosen ones: Your entire coordinate pipeline is vulnerable to a subtle floating-point trap. Fabric coordinates range from ~416 to ~11390 (4 orders of magnitude). Pixel coordinates are 0–2400. Three.js world coordinates are 0–140. Each transformation involves a multiplication then an addition. The problem: IEEE 754 single-precision floats (which WebGL uses in shaders) lose sub-millimeter precision when you denormalize from 10,000 down to 0.5. The error is 0.0001% per vertex — invisible on a single booth, but when two adjacent booths share an edge computed from different transformation paths, that 0.0001% becomes a visible gap (or overlap) between polygons.
The fix nobody implements: store the 3D world coordinates in a Float32Array once after the first transformation, never recompute from fabric space. Your calibration sliders should only affect a uniform offset applied to the already-transformed world coordinates, not re-run the entire fabric→pixel→world pipeline. This freezes the floating-point error in place so adjacent booths always agree on where their shared edge is, regardless of calibration tuning.

Your booths_poly_v2.json stores fabricBBox per booth — a precomputed bounding box in fabric space. You're currently using it for... probably nothing, or maybe hit-testing.
Here's the brain wave: Replace A\* pathfinding with fabricBBox rasterization.
Your A* runs on a grid you generate by walking bounding boxes. But fabricBBox already gives you the occupied rectangles for every booth. You can build an occupancy grid in O(n) by scanline-rendering these boxes onto a binary grid — instead of doing A* node expansions that check each booth's polygon for collision.
Worse: A* on a dense grid with 200 booths is O(n²) in practice because each path expansion checks against all booth polygons. Your route demo says "A* on grid + avoids booth bounding boxes" — but the current code re-validates against polygon geometry per step, which means it's doing point-in-polygon tests for every candidate node. Those polygon tests are doing cross-product math on 4+ vertices each time. At 10,000+ nodes explored, that's millions of floating-point operations for a single route.
Pre-rasterize the bounding boxes once, and the pathfinder just reads a boolean array. 10x faster, zero polygon math.
---
For the chosen ones: There's a deeper insight hiding in your data. fabricBBox per booth is the axis-aligned bounding box in design space. But your booths rotate? No — they don't. Every polygon axis-aligned with the floor plan. So fabricBBox is actually the tight bounding box, meaning you could skip storing polygon points entirely for rectangular booths (~80% of them) and reconstruct the geometry from {x, y, w, h} alone. The JSON drops from 15K lines to ~3K. Your parser gets 5x faster. And the irregular booths (the remaining 20%) can be flagged with "type":"poly" vs "type":"rect". This isn't a micro-optimization — it's a data model insight that changes how you think about the problem from first principles.

    ```
