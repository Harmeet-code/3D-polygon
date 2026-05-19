# Multi-Floor Tab System — Technical Architecture

## Overview

The tab system allows the user to switch between multiple floor plans at runtime. Each floor is a separate JSON file + floor-plan image. Tabs appear in the top-right HUD bar. Switching floors triggers a full scene rebuild: new JSON fetched, new texture loaded, booths rebuilt, camera reset.

---

## 1. File Layout

```
src/
  data/
    floors.json              ← manifest: list of floor names
    json/
      DenverFloorPlan1.json  ← booth data + meta for floor 1
      DenverFloorPlan2.json  ← booth data + meta for floor 2
    floor plan/
      DenverFloorPlan1.jpg   ← floor plan image for floor 1
      DenverFloorPlan2.jpg   ← floor plan image for floor 2
```

### `floors.json`

```json
["DenverFloorPlan1", "DenverFloorPlan2"]
```

Simple flat array of floor identifiers. Each identifier maps to:
- JSON: `./data/json/{name}.json`
- Image: `./data/floor plan/{name}.jpg` (from `meta.image` field in JSON)

To add a new floor, append to this array + create the corresponding JSON + JPG.

---

## 2. Tab Generation in `main.js`

```js
// Boot: fetch manifest
const floors = await fetch('./data/floors.json').then((r) => r.json());

let currentFloor = null;
let currentData = null;

// One-time scene setup (no texture yet — first loadFloor handles it)
await initScene(stage, null);

// Build tab buttons
const floorTabs = document.getElementById('floorTabs');
floors.forEach((name) => {
  const btn = document.createElement('div');
  btn.className = 'hudBtn';
  btn.textContent = name.replace('DenverFloorPlan', 'Floor ');
  btn.dataset.floor = name;
  btn.addEventListener('click', () => loadFloor(name));
  floorTabs.appendChild(btn);
});

// Load first floor on startup
loadFloor(floors[0]);
```

Each tab is a `.hudBtn` div. The tab label is the name with `DenverFloorPlan` stripped for readability (e.g. "Floor 1", "Floor 2"). The original name is stored in `dataset.floor` for the fetch path lookup.

---

## 3. `loadFloor(name)` — Full Flow

```js
async function loadFloor(name) {
  if (name === currentFloor) return;
  loader.classList.add('visible');              // show spinner

  // Update tab active state
  floorTabs.querySelectorAll('.hudBtn').forEach(t => t.classList.remove('active'));
  const activeTab = floorTabs.querySelector(`[data-floor="${name}"]`);
  if (activeTab) activeTab.classList.add('active');

  try {
    // 1. Fetch JSON
    const res = await fetch(`./data/json/${name}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // 2. Enrich (adds fallback status/company if missing)
    enrichData(data);
    currentFloor = name;
    currentData = data;

    // 3. Swap floor texture (meta.image → ./data/floor plan/{meta.image})
    const imgPath = data.meta?.image
      ? `./data/floor plan/${data.meta.image}`
      : null;
    await swapFloor(imgPath);

    // 4. Re-init calibration (fabric bounds change per floor)
    initCalibration(data);
    initGrid(PLANE_W, PLANE_H);

    // 5. Clear debug overlay from previous floor
    clearOverlay();

    // 6. Rebuild all booth meshes
    const heatEnabled = document.getElementById('heatmap').checked;
    buildBooths(data, heatEnabled);
    rebuildBlockedGrid();
    fillDropdowns(data);

    // 7. Reset UI state
    if (sel.selected) {
      highlight(sel.selected, false);
      sel.selected = null;
    }
    updateSidebar(null);
    clearRoute();
    clearFollow();

    // 8. Reset camera to default view with smooth animation
    flyTo(new THREE.Vector3(70, 70, 90), new THREE.Vector3(0, 0, 0), 600);

    // 9. Refresh debug tools with new data
    reloadCoordDebug(data);
    initConsoleTools(data);
  } catch (err) {
    console.error(`Failed to load floor "${name}":`, err);
    if (activeTab) activeTab.classList.remove('active');
  } finally {
    loader.classList.remove('visible');         // hide spinner
  }
}
```

### Error handling

| Failure point | Behavior |
|---|---|
| `fetch` fails (network error) | `catch` block → active tab removed, loader hidden, current floor unchanged |
| `res.ok` is false (HTTP 404/500) | `throw Error` → same catch path |
| JSON parse fails | `catch` → same path |
| Image load fails | Internal to `swapFloor` → fallback to solid dark color (`0x1a1a2e`) + `console.warn` |
| Any step after fetch throws | `catch` catches everything, loader hidden, error logged |

---

## 4. `SceneSetup.js` — `swapFloor(imagePath)`

```js
export async function swapFloor(imagePath) {
  const floorTex = await loadTexture(imagePath);  // returns THREE.Texture or null
  calcPlaneSize(floorTex);                         // updates IMG_W, IMG_H, PLANE_W, PLANE_H

  // Replace floor mesh
  const newFloor = buildFloorMesh(floorTex);
  scene.remove(floor);
  floor.geometry?.dispose();
  floor.material?.dispose();
  floor = newFloor;
  scene.add(floor);

  // Replace grid (size changes with new aspect ratio)
  scene.remove(grid);
  grid.geometry?.dispose();
  grid.material?.dispose();
  grid = buildGrid();
  scene.add(grid);
}
```

`loadTexture` handles failures gracefully:

```js
function loadTexture(url) {
  return new Promise((res) => {
    if (!url) { res(null); return; }
    new THREE.TextureLoader().load(
      encodeURI(url),
      (tex) => { tex.colorSpace = THREE.SRGBColorSpace; res(tex); },
      undefined,
      () => { console.warn('Floor texture failed, loading fallback'); res(null); }
    );
  });
}
```

On failure: `floorTex` is `null` → `calcPlaneSize(null)` sets fallback `1400×900` → `buildFloorMesh(null)` creates a solid `0x1a1a2e` colored plane with no texture.

---

## 5. HUD Layout (HTML + CSS)

```html
<div id="hud">
  <div id="hudLeft">
    <div class="hudBtn" id="camIso">Isometric</div>
    <div class="hudBtn" id="camTop">Top</div>
    <div class="hudBtn" id="camReset">Reset</div>
    <div class="hudBtn" id="tour">Auto Tour</div>
  </div>
  <div id="floorTabs"></div>
</div>
<div id="loader">
  <div class="spinner"></div>
  <span>Loading floor…</span>
</div>
```

```css
#hud {
  position: absolute;
  top: 14px;
  left: 14px;
  right: 14px;
  display: flex;
  justify-content: space-between;   /* camera buttons left, floor tabs right */
  gap: 10px;
  z-index: 5;
}
#floorTabs { display: flex; gap: 10px; align-items: center; }

/* Active tab highlight */
.hudBtn.active {
  border-color: rgba(106,169,255,.55);
  background: rgba(106,169,255,.16);
  color: #fff;
}

/* Centered loader overlay */
#loader {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  z-index: 20;
  display: none;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  background: rgba(0,0,0,.6);
  padding: 24px 32px;
  border-radius: 16px;
  backdrop-filter: blur(8px);
}
#loader.visible { display: flex; }
.spinner {
  width: 28px; height: 28px;
  border: 3px solid rgba(255,255,255,.15);
  border-top: 3px solid var(--accent);
  border-radius: 50%;
  animation: spin .7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
```

The `#hud` uses `justify-content: space-between` so:
- `#hudLeft` (Isometric, Top, Reset, Tour) stays on the **left**.
- `#floorTabs` (Floor 1, Floor 2, …) is pushed to the **right**.

---

## 6. `CoordDebug.js` — Per-Floor Reset

On floor switch, `reloadCoordDebug(data)` clears old state and repopulates:

```js
let _initDone = false;   // register event listeners only once

export function initCoordDebug(data) {
  scene.add(debugOverlayGroup);
  reloadCoordDebug(data);            // populate with initial data

  if (_initDone) return;
  _initDone = true;

  // Register all event listeners (one-time)
  debugSelect.addEventListener('change', onBoothSelect);
  // ... more listeners
}

export function reloadCoordDebug(data) {
  _data = data;
  _refBooth = null;
  debugSelect.value = '';
  debugStatus.textContent = 'Select a booth';
  debugTable.innerHTML = '';
  clearOverlay();

  // Rebuild datalist options
  const dl = document.getElementById('debugBoothList');
  dl.innerHTML = '';
  data.booths.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b.boothNo;
    dl.appendChild(opt);
  });

  updateAspectInfo();   // recalculates img vs fabric aspect ratio
}
```

---

## 7. Key Details

### `initScene` is called once

Only the first boot calls `initScene(stage, null)` — this creates the scene, camera, renderer, lights, and an initial fallback floor. All subsequent floor switches use `swapFloor()` to replace only the floor mesh + grid, not the entire scene.

### Calibration is per-floor aware

`initCalibration(data)` recalculates `fb` (fabric bounds), `baseScaleX`, and `baseScaleY` from the new JSON's `meta.fabricBounds`. The calibration slider values (OffsetX/Y, ScaleX/Y) are **global** — same values apply to all floors until the user adjusts them.

### Booth prices recalculated per floor

`buildBooths` in `BoothBuilder.js` now recalculates `minPrice`/`maxPrice` on every call (previously cached after first call). This ensures heatmap colors are correct per floor.

### Demo fallback for second floor

`DenverFloorPlan2.json` is currently a copy of `DenverFloorPlan1.json` with its `meta.image` changed to `DenverFloorPlan2.jpg`. Both images are the same JPG. This is a placeholder — replace with actual floor-specific data.

---

## 8. Adding a New Floor — Checklist

| Step | File | Action |
|---|---|---|
| 1 | `src/data/json/{Name}.json` | Create with `booths[]`, `meta.image`, `meta.fabricBounds` |
| 2 | `src/data/floor plan/{Name}.jpg` | Place the floor plan image |
| 3 | `src/data/floors.json` | Append `"{Name}"` to the array |

No code changes needed — the tab system is fully data-driven via `floors.json`.
