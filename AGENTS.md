# AGENTS.md — SEMS 3D Floor Plan

Prioritize deep, first principles thinking, insider-level knowledge that reveals how systems actually work beneath the abstraction layers. Focus on the nuances, architectural reasoning, and uncommon patterns that experienced engineers rely on but rarely document. Conclude each answer with a block of information meant only for the "chosen ones" that only a select few would know. It should contain insights that puts me one step ahead of everyone.

## Entrypoints

- `src/index.html` → `src/main.js` (ES module, no bundler)
- **`index.html`** is the root file served by dev server.

## Commands

| Action     | Command                                                                |
| ---------- | ---------------------------------------------------------------------- |
| Dev server | `bun run dev` (serves `src/` on port 3000, no build step)              |
| Typecheck  | `bun typecheck` (`tsc --noEmit`, checks all `.js` via `checkJs: true`) |
| Lint       | `bun lint` (`oxlint`)                                                  |
| Format     | `bun format` (`oxfmt --write`)                                         |
| Full check | `bun check` (lint + format check + typecheck)                          |
| Install    | `bun install`                                                          |

**Always run `bun typecheck` before marking type-related work complete.**

## JS + checkJs Quirks

- All code is `.js` but type-checked with `strict: true`, `noUncheckedIndexedAccess: true`.
- No `!` assertions allowed in `.js`. Use JSDoc parenthesized casts:
  `const el = /** @type {HTMLElement} */ (document.getElementById('id'))`
- THREE types come from `@types/three@^0.184.1` (npm) but actual runtime imports are CDN via importmap in `index.html` (`unpkg.com/three@0.160.0`). Type vs runtime version mismatch is deliberate.
- Importmap in `index.html` is the source of truth for Three.js runtime: `three` → `unpkg.com/three@0.160.0/build/three.module.js`, `three/addons/` → `unpkg.com/three@0.160.0/examples/jsm/`.

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
  CoordDebug.js       — coordinate debug panel, debug overlay, reloadCoordDebug() for floor switch
src/data/
  enrichment.js       — enrichData() adds fallback status/company if missing
  floors.json         — manifest ["DenverFloorPlan1", "DenverFloorPlan2"]
  json/               — per-floor booth data JSON files
  floor plan/         — floor plan images
src/debug/
  ConsoleTools.js     — window.DEBUG / window.AUDIT console tools (never used in production logic)
```

## Architecture Must-Knows

**Coordinate pipeline (never bypass)**:

```
Fabric (JSON) → fabricToPixel() → Pixel (image) → pxToWorld() → 3D World (scene)
```

- `fabricToPixel` uses `baseScale = imageDim / fabricRange` × calibration scale + offset.
- `pxToWorld` maps pixel space to centered 3D plane: `x = (px/IMG_W - 0.5)*PLANE_W`, `z = (0.5 - py/IMG_H)*PLANE_H`.
- Calibration (offsetX/Y, scaleX/Y) persists in `localStorage` under key `sems_demo_cal_v2`.

**Multi-floor**:

- `floors.json` is manifest. Add floor name to array + create JSON in `json/` + image in `floor plan/`.
- `loadFloor(name)` fetches JSON, enriches, calls `swapFloor(imagePath)`, rebuilds booths, resets camera, reloads debug tools.
- `swapFloor()` replaces floor mesh + grid (geometry disposed, new one built). Texture load failure → solid `0x1a1a2e` fallback.
- Calibration slider values are global across floors. `fabricBounds` per floor via `initCalibration(data)`.

**Geometry centering rule** (all ExtrudeGeometry):

```js
geo.computeBoundingBox();
const c = geo.boundingBox.getCenter();
geo.translate(-c.x, -bb.min.y, -c.z);
mesh.position.set(c.x, 0, c.z);
```

**A\* route** — grid-based (CELL=1.2), `rebuildBlockedGrid` marks booth AABB + margin cells as blocked. Route rendered as TubeGeometry (dark base + blue glow + marching white Points).

## Code Style

- Single quotes, semicolons, no trailing commas, 100 char print width.
- Arrow functions for callbacks, for-of loops, template literals, optional chaining, nullish coalescing.
- No `class`/`this` except Three.js API calls.
- DOM lookups at module top level or inside event handlers, cast immediately: `const el = /** @type {HTMLInputElement} */ (document.getElementById('x'))`.
- THREE.Box3, THREE.Intersection, THREE.Fog all need JSDoc casts after they're guaranteed populated.
- `window.DEBUG` and `window.AUDIT` are console-only globals (never in production UI logic).

## Commit Convention

Conventional commits: `feat|fix|docs|style|issue|refactor|perf|test|build|ci|chore|revert`. Subject: sentence-case, max 72 chars, no trailing period. Enforced via husky + commitlint.

## CI / Pre-commit

`lint-staged` runs `oxfmt --write` + `oxlint --fix` on staged `*.{js,jsx,ts,tsx}`. Commit message validated by `commitlint`.

## Stale Docs Warning

`.github/copilot-instructions.md` and `README.md` reference `viewer_interactive.html` / `viewer_interactive.js` which no longer exist. The real entry is `src/index.html` → `src/main.js`. Some `docs/` files may also lag the modular structure.
