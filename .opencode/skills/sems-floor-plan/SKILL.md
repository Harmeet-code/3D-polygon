---
name: sems-floor-plan
description: SEMS 3D Floor Plan project knowledge — architecture, coordinate pipeline, multi-floor system, A* routing, code style, and commands. Use when working on this project, adding floors, debugging coordinates, or modifying the 3D viewer.
---

# SEMS 3D Floor Plan — Project Skill

## Project Structure

- Entry: `src/index.html` → `src/main.js` (ES module, no bundler)
- Dev: `bun run dev` (serves `src/` on port 3000)
- Typecheck: `bun typecheck` (tsc --noEmit, strict checkJs)
- Lint/Format: `bun lint` (oxlint), `bun format` (oxfmt)
- Full check: `bun check` (lint + format check + typecheck)

## Module Map

```
src/main.js          — boot, loadFloor(), calibration hooks, routing handlers, render loop
src/state.js          — shared { sel: { selected, hovered } }
src/scene/
  SceneSetup.js       — initScene(), swapFloor(), exports scene/camera/renderer/controls/boothGroup/outlineGroup
  BoothBuilder.js     — buildBooths(data, heatEnabled), exports boothMeshes[], boothByNo Map
  CoordTransform.js   — fabricToPixel(), pxToWorld(), readCal(), initCalibration(), calibration sliders
  AStarRoute.js       — A* grid pathfinding, drawRoute(), clearRoute(), route animation
src/ui/
  Sidebar.js          — flyTo(), focusMesh(), highlight(), updateSidebar()
  Filters.js          — fillDropdowns(), applyFilters()
  Interaction.js      — hover/click raycasting on boothMeshes[]
  BoothMarker.js      — YouTube iframe marker per booth
  CoordDebug.js       — coordinate debug panel
src/data/
  enrichment.js       — enrichData() adds fallback status/company if missing
  floors.json         — manifest ["DenverFloorPlan1", "DenverFloorPlan2"]
  json/               — per-floor booth data JSON files
  floor plan/         — floor plan images
```

## Coordinate Pipeline (NEVER bypass)

```
Fabric (JSON) → fabricToPixel() → Pixel (image) → pxToWorld() → 3D World (scene)
```

- `fabricToPixel` uses `baseScale = imageDim / fabricRange` × calibration scale + offset
- `pxToWorld`: `x = (px/IMG_W - 0.5)*PLANE_W`, `z = (0.5 - py/IMG_H)*PLANE_H`
- Calibration persists in `localStorage` under key `sems_demo_cal_v2`
- Calibration slider values are global across floors

## Multi-Floor System

- `floors.json` is manifest. Add floor: push name to array + create JSON in `json/` + image in `floor plan/`
- `loadFloor(name)` fetches JSON, enriches, calls `swapFloor(imagePath)`, rebuilds booths, resets camera
- `swapFloor()` replaces floor mesh + grid (old geometry disposed, new one built)
- Texture load failure → solid `0x1a1a2e` fallback

## Geometry Centering Rule (all ExtrudeGeometry)

```js
geo.computeBoundingBox();
const c = geo.boundingBox.getCenter();
geo.translate(-c.x, -bb.min.y, -c.z);
mesh.position.set(c.x, 0, c.z);
```

## A\* Route

- Grid-based (CELL=1.2), `rebuildBlockedGrid` marks booth AABB + margin cells as blocked
- Route: TubeGeometry (dark base + blue glow + marching white Points)

## Code Style

- Single quotes, semicolons, no trailing commas, 100 char print width
- Arrow functions for callbacks, for-of loops, template literals, optional chaining, nullish coalescing
- No `class`/`this` except Three.js API calls
- DOM lookups at module top level or inside event handlers, cast immediately with JSDoc
- THREE types need JSDoc casts after guaranteed populated
- `window.DEBUG` and `window.AUDIT` are console-only globals

## JSDoc Casting (no `!` in .js)

```js
const el = /** @type {HTMLElement} */ (document.getElementById('id'));
```

## Importmap

`src/index.html` is source of truth for Three.js runtime:

- `three` → `unpkg.com/three@0.160.0/build/three.module.js`
- `three/addons/` → `unpkg.com/three@0.160.0/examples/jsm/`
- Types from `@types/three@^0.184.1` (npm) — version mismatch with runtime is deliberate

## Commit Convention

Conventional commits: `feat|fix|docs|style|issue|refactor|perf|test|build|ci|chore|revert`
Sentence-case, max 72 chars, no trailing period. Enforced via husky + commitlint.
