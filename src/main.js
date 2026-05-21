import * as THREE from 'three';
import {
  initScene,
  swapFloor,
  scene,
  camera,
  controls,
  renderer,
  PLANE_W,
  PLANE_H,
} from './scene/SceneSetup.js';
import {
  initCalibration,
  persistCal,
  offXEl,
  offYEl,
  scXEl,
  scYEl,
  DEFAULT_CALIBRATION,
  storeKey,
} from './scene/CoordTransform.js';
import { buildBooths, boothByNo } from './scene/BoothBuilder.js';
import {
  fillDropdowns,
  boothCenterWorld,
  fromInput,
  toInput,
  applyFilters,
  initComboboxFloors,
} from './ui/Filters.js';
import { flyTo, focusMesh, highlight, updateSidebar } from './ui/Sidebar.js';
import { sel } from './state.js';
import { enrichData } from './data/enrichment.js';
import { initConsoleTools } from './debug/ConsoleTools.js';
import { initCoordDebug, clearOverlay } from './ui/CoordDebug.js';
import { buildStairMap, stairToWorldPos } from './scene/StairMap.js';
import { multiFloorAStar, clearGridCache } from './scene/MultiFloorRoute.js';
import { buildZoneOverlay, clearZoneOverlay } from './scene/ZoneOverlay.js';
import {
  buildPoiMarkers,
  clearPoiMarkers,
  highlightRouteStair,
  clearRouteStairHighlight,
  updateRouteStairPulse,
} from './scene/PoiMarkers.js';
import { positionMarker } from './ui/BoothMarker.js';
import { initInteraction } from './ui/Interaction.js';
import {
  initPoiEditor,
  setMode as poiSetMode,
  setRotation as poiSetRotation,
  applyPlacement as poiApply,
  cancelPlacement as poiCancel,
} from './scene/PoiEditor.js';
import {
  initZoneEditor,
  setMode as zoneSetMode,
  applyZones as zoneApply,
  cancelZones as zoneCancel,
  undoLastPoint as zoneUndo,
} from './scene/ZoneEditor.js';
import {
  aStar,
  findNearestFree,
  worldToCell,
  cellToWorld,
  drawRoute,
  clearRoute,
  followRoute,
  clearFollow,
  routeWorldPoints,
  rebuildCostGrid,
  updateRouteAnimation,
  initGrid,
  isCellBlocked,
} from './scene/AStarRoute.js';

// Boot
const stage = /** @type {HTMLElement} */ (document.getElementById('stage'));
const loader = /** @type {HTMLElement} */ (document.getElementById('loader'));
const floors = await fetch('./data/floors.json').then((r) => r.json());

let currentFloor = null;
let currentData = null;
/** @type {Record<string, any>} */
const floorDataMap = {};
/** @type {Record<string, string[]>} */
const boothToFloor = {};
/** @type {{ segments: Array<{floorName:string,worldPoints:Array<{x:number,z:number}>}>, stairUsed: string|null } | null} */
let multiFloorRouteSeg = null;

// Init one-time scene + UI
await initScene(stage, null);
initGrid(PLANE_W, PLANE_H);
initInteraction();
initPoiEditor(
  () => currentData,
  () => currentFloor,
);
initZoneEditor(
  () => currentData,
  () => currentFloor,
);

// Init combobox floors from floors.json
await initComboboxFloors();

// Create floor tabs
const floorTabs = /** @type {HTMLElement} */ (document.getElementById('floorTabs'));
floors.forEach((name) => {
  const btn = document.createElement('div');
  btn.className = 'hudBtn';
  btn.textContent = name.replace('DenverFloorPlan', 'Floor ');
  btn.dataset.floor = name;
  btn.addEventListener('click', () => {
    // If cross-floor route active, note transition stair
    if (multiFloorRouteSeg && currentFloor && multiFloorRouteSeg.stairUsed) {
      const curSeg = multiFloorRouteSeg.segments.find((s) => s.floorName === currentFloor);
      const nextSeg = multiFloorRouteSeg.segments.find((s) => s.floorName === name);
      if (curSeg && nextSeg) {
        loadFloor(name, multiFloorRouteSeg.stairUsed);
        return;
      }
    }
    loadFloor(name);
  });
  floorTabs.appendChild(btn);
});

// Build cross-floor stair map + pre-fetch all floor data
buildStairMap(floors);
(async () => {
  for (const name of floors) {
    try {
      const res = await fetch(`./data/json/${name}.json`);
      const data = await res.json();
      enrichData(data);
      floorDataMap[name] = data;
      for (const b of data.booths) {
        let floors = boothToFloor[b.boothNo];
        if (!floors) {
          floors = [];
          boothToFloor[b.boothNo] = floors;
        }
        if (!floors.includes(name)) {
          floors.push(name);
        }
      }
    } catch (e) {
      console.warn(`Failed to pre-fetch floor "${name}"`, e);
    }
  }
  console.log(
    `[BoothMap] Pre-fetch complete: ${Object.keys(boothToFloor).length} booths mapped across ${floors.length} floors`,
  );
})();

/** @type {{ fromNo: string; toNo: string } | null} */
let pendingRoute = null;

/**
 * Resolve the best floor for a booth number.
 * Prefers currentFloor if the booth exists there, otherwise first mapped floor.
 * @param {string} boothNo
 * @returns {string | null}
 */
function resolveBoothFloor(boothNo) {
  const floors = boothToFloor[boothNo];
  if (!floors || floors.length === 0) {
    return null;
  }
  if (currentFloor && floors.includes(currentFloor)) {
    return currentFloor;
  }
  return floors[0] ?? null;
}

// Load first floor
loadFloor(floors[0]);

// ── Core floor loader ──────────────────────────────────────────

async function loadFloor(name, transitionStair) {
  if (name === currentFloor) {
    return;
  }
  loader.classList.add('visible');

  const tabs = floorTabs.querySelectorAll('.hudBtn');
  tabs.forEach((t) => t.classList.remove('active'));
  const activeTab = floorTabs.querySelector(`[data-floor="${name}"]`);
  if (activeTab) {
    activeTab.classList.add('active');
  }

  try {
    // Fetch JSON
    const res = await fetch(`./data/json/${name}.json`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();

    enrichData(data);
    currentFloor = name;
    currentData = data;

    // Swap floor texture
    const imgPath = data.meta?.image ? `./data/floor plan/${data.meta.image}` : null;
    await swapFloor(imgPath);

    // Re-init calibration with new fabric bounds
    initCalibration(data);
    initGrid(PLANE_W, PLANE_H);

    // Clear overlays
    clearOverlay();
    clearZoneOverlay();
    clearPoiMarkers();
    clearRouteStairHighlight();

    // Rebuild booths
    const heatEnabled = /** @type {HTMLInputElement} */ (
      document.getElementById('heatmap')
    ).checked;
    buildBooths(data, heatEnabled);
    clearGridCache();
    rebuildCostGrid(data);
    buildZoneOverlay(data);
    buildPoiMarkers(data);
    fillDropdowns(data);

    // Reset selection + cancel editors
    poiCancel();
    document.querySelectorAll('[data-poi-mode]').forEach((c) => c.classList.remove('active'));
    document.querySelectorAll('[data-zone-mode]').forEach((c) => c.classList.remove('active'));
    if (sel.selected) {
      highlight(sel.selected, false);
      sel.selected = null;
    }
    updateSidebar(null);

    // Reset route
    clearRoute();
    clearFollow();

    // Draw multi-floor route segment for this floor
    if (multiFloorRouteSeg) {
      const seg = multiFloorRouteSeg.segments.find((s) => s.floorName === name);
      if (seg) {
        drawRoute(seg.worldPoints);
        followRoute(seg.worldPoints);
      }
    }

    // Animate to stair if transitioning
    if (transitionStair) {
      highlightRouteStair(transitionStair, data);
      const wp = stairToWorldPos(transitionStair, name);
      if (wp) {
        flyTo(new THREE.Vector3(wp.x + 30, 30, wp.z + 34), new THREE.Vector3(wp.x, 0.1, wp.z), 600);
      } else {
        flyTo(new THREE.Vector3(70, 70, 90), new THREE.Vector3(0, 0, 0), 600);
      }
    } else {
      flyTo(new THREE.Vector3(70, 70, 90), new THREE.Vector3(0, 0, 0), 600);
    }

    // Reload debug tools
    initCoordDebug(data);
    initConsoleTools(data);

    console.log(`Switched to ${name} (${data.booths.length} booths)`);

    // Execute pending route request
    if (pendingRoute) {
      const { fromNo, toNo } = pendingRoute;
      pendingRoute = null;
      console.log(`[Routing] executing pending route: ${fromNo} → ${toNo} on ${name}`);
      computeRoute(fromNo, toNo);
    }
  } catch (err) {
    console.error(`Failed to load floor "${name}":`, err);
    if (activeTab) {
      activeTab.classList.remove('active');
    }
  } finally {
    loader.classList.remove('visible');
  }
}

// ── Calibration hooks ──────────────────────────────────────────

function onCalChange() {
  persistCal();
  if (!currentData) {
    return;
  }
  buildBooths(
    currentData,
    /** @type {HTMLInputElement} */ (document.getElementById('heatmap')).checked,
  );
  if (currentData) {
    rebuildCostGrid(currentData);
  }
  applyFilters();
}
[offXEl, offYEl, scXEl, scYEl].forEach((el) => el.addEventListener('input', onCalChange));

/** @type {HTMLElement} */ (document.getElementById('resetCal')).addEventListener('click', () => {
  localStorage.removeItem(storeKey);
  offXEl.value = DEFAULT_CALIBRATION.offsetX.toString();
  offYEl.value = DEFAULT_CALIBRATION.offsetY.toString();
  scXEl.value = DEFAULT_CALIBRATION.scaleX.toFixed(3);
  scYEl.value = DEFAULT_CALIBRATION.scaleY.toFixed(3);
  onCalChange();
});

// ── Heatmap toggle ─────────────────────────────────────────────

/** @type {HTMLInputElement} */ (document.getElementById('heatmap')).addEventListener(
  'change',
  () => {
    if (!currentData) {
      return;
    }
    buildBooths(
      currentData,
      /** @type {HTMLInputElement} */ (document.getElementById('heatmap')).checked,
    );
    rebuildCostGrid(currentData);
    applyFilters();
  },
);

// Reset button
/** @type {HTMLElement} */ (document.getElementById('resetBtn')).addEventListener('click', () => {
  clearRoute();
  clearRouteStairHighlight();
  multiFloorRouteSeg = null;
  flyTo(new THREE.Vector3(70, 70, 90), new THREE.Vector3(0, 0, 0), 900);
});

// Routing
function computeRoute(fromNo, toNo) {
  clearRoute();
  clearRouteStairHighlight();
  multiFloorRouteSeg = null;
  const fromFloor = resolveBoothFloor(fromNo);
  const toFloor = resolveBoothFloor(toNo);
  console.log(`[computeRoute] fromNo=${fromNo} → floor="${fromFloor}"`);
  console.log(`[computeRoute] toNo=${toNo} → floor="${toFloor}"`);
  console.log(`[computeRoute] currentFloor="${currentFloor}"`);
  if (!fromFloor || !toFloor) {
    alert('Booth not found on any floor.');
    return;
  }

  if (fromFloor === toFloor) {
    // Single-floor route — ensure we're on the right floor
    if (fromFloor !== currentFloor) {
      console.log('[computeRoute] switching to floor', fromFloor, 'for single-floor route');
      pendingRoute = { fromNo, toNo };
      loadFloor(fromFloor);
      return;
    }
    console.log('[computeRoute] single-floor route on', fromFloor);
    const from = boothCenterWorld(fromNo);
    const to = boothCenterWorld(toNo);
    console.log(`[computeRoute] from world=(${from.x.toFixed(1)}, ${from.z.toFixed(1)})`);
    console.log(`[computeRoute] to world=(${to.x.toFixed(1)}, ${to.z.toFixed(1)})`);
    const fromCell = worldToCell(from.x, from.z);
    const toCell = worldToCell(to.x, to.z);
    console.log(
      `[computeRoute] from cell (${fromCell.r},${fromCell.c}), to cell (${toCell.r},${toCell.c})`,
    );
    console.log(
      `[computeRoute] from cell blocked=${isCellBlocked(from.x, from.z)}, to cell blocked=${isCellBlocked(to.x, to.z)}`,
    );
    const s = findNearestFree(fromCell);
    const t = findNearestFree(toCell);
    console.log(`[computeRoute] start cell (${s.r},${s.c}), goal cell (${t.r},${t.c})`);
    console.log(
      `[computeRoute] start cell blocked=${isCellBlocked(cellToWorld(s.r, s.c).x, cellToWorld(s.r, s.c).z)}, goal cell blocked=${isCellBlocked(cellToWorld(t.r, t.c).x, cellToWorld(t.r, t.c).z)}`,
    );
    const path = aStar(s, t);
    if (!path) {
      console.log('[computeRoute] no path found — grid may have no walkable connection');
      alert('No route found. Check that walkable zones connect these booths.');
      return;
    }
    console.log(`[computeRoute] path found: ${path.length} cells`);

    // Validate path doesn't go through blocked cells
    let blockedCount = 0;
    const blockedCells = [];
    for (const p of path) {
      const w = cellToWorld(p.r, p.c);
      if (isCellBlocked(w.x, w.z)) {
        blockedCount++;
        blockedCells.push(`(${p.r},${p.c})`);
      }
    }
    if (blockedCount > 0) {
      console.warn(
        `[computeRoute] WARNING: ${blockedCount}/${path.length} path cells are blocked!`,
      );
      console.warn(
        `[computeRoute] Blocked cells: ${blockedCells.slice(0, 20).join(', ')}${blockedCells.length > 20 ? '...' : ''}`,
      );
    } else {
      console.log(`[computeRoute] Path validation: all ${path.length} cells are walkable`);
    }

    const wp = path.map((p) => cellToWorld(p.r, p.c));
    drawRoute(wp, {
      start: from,
      end: to,
      startLabel: fromNo,
      endLabel: toNo,
    });
    multiFloorRouteSeg = null;
    const start = new THREE.Vector3(from.x, 0.1, from.z);
    flyTo(start.clone().add(new THREE.Vector3(30, 30, 34)), start.clone(), 900);
    followRoute(wp);
    return;
  }

  // Cross-floor route
  console.log('[computeRoute] cross-floor route:', fromFloor, '→', toFloor);
  clearRoute();
  const result = multiFloorAStar(fromFloor, fromNo, toFloor, toNo, floorDataMap);
  if (!result) {
    alert('No cross-floor route found. Ensure stairs connect these floors.');
    return;
  }

  multiFloorRouteSeg = result;

  // Draw current floor's segment
  const curSeg = result.segments.find((s) => s.floorName === currentFloor);
  if (curSeg) {
    drawRoute(curSeg.worldPoints);
    followRoute(curSeg.worldPoints);
    const start = curSeg.worldPoints[0];
    if (start) {
      flyTo(
        new THREE.Vector3(start.x + 30, 30, start.z + 34),
        new THREE.Vector3(start.x, 0.1, start.z),
        900,
      );
    }
  } else {
    // Switch to start floor
    loadFloor(fromFloor);
  }
}

/** @type {HTMLElement} */ (document.getElementById('routeBtn')).addEventListener('click', () => {
  const fromNo = fromInput.value;
  const toNo = toInput.value;
  if (!fromNo || !toNo) {
    return;
  }
  computeRoute(fromNo, toNo);
});

/** @type {HTMLElement} */ (document.getElementById('clearRouteBtn')).addEventListener(
  'click',
  () => {
    clearRoute();
    clearRouteStairHighlight();
    multiFloorRouteSeg = null;
  },
);
/** @type {HTMLInputElement} */ (document.getElementById('followCam')).addEventListener(
  'change',
  () => {
    if (
      /** @type {HTMLInputElement} */ (document.getElementById('followCam')).checked &&
      routeWorldPoints
    ) {
      followRoute(routeWorldPoints);
    } else {
      clearFollow();
    }
  },
);

// Camera HUD
/** @type {HTMLElement} */ (document.getElementById('camIso')).addEventListener('click', () =>
  flyTo(new THREE.Vector3(75, 70, 75), new THREE.Vector3(0, 0, 0), 850),
);
/** @type {HTMLElement} */ (document.getElementById('camTop')).addEventListener('click', () =>
  flyTo(new THREE.Vector3(0, 160, 0.01), new THREE.Vector3(0, 0, 0), 850),
);
/** @type {HTMLElement} */ (document.getElementById('camReset')).addEventListener('click', () =>
  flyTo(new THREE.Vector3(70, 70, 90), new THREE.Vector3(0, 0, 0), 850),
);

// Auto Tour
let touring = false,
  tourTimer = null;
/** @type {HTMLElement} */ (document.getElementById('tour')).addEventListener('click', () => {
  touring = !touring;
  /** @type {HTMLElement} */ (document.getElementById('tour')).textContent = touring
    ? 'Stop Tour'
    : 'Auto Tour';
  if (!touring) {
    clearInterval(tourTimer);
    tourTimer = null;
    return;
  }
  if (!currentData) {
    return;
  }
  clearRoute();
  let i = 0;
  tourTimer = setInterval(() => {
    const b = currentData.booths[i % currentData.booths.length];
    const m = boothByNo.get(b.boothNo);
    if (m && m.visible) {
      if (sel.selected && sel.selected !== m) {
        highlight(sel.selected, false);
      }
      sel.selected = m;
      highlight(sel.selected, true);
      updateSidebar(b);
      focusMesh(m);
    }
    i++;
  }, 1200);
});

// Render loop
function tick() {
  controls.update();
  positionMarker();
  updateRouteAnimation();
  updateRouteStairPulse();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

// Resize
window.addEventListener('resize', () => {
  camera.aspect = stage.clientWidth / stage.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(stage.clientWidth, stage.clientHeight);
});

// ── POI Editor ───────────────────────────────────────────────

document.querySelectorAll('[data-poi-mode]').forEach((el) => {
  const chip = /** @type {HTMLElement} */ (el);
  chip.addEventListener('click', () => {
    const mode = /** @type {string} */ (chip.dataset.poiMode);
    document.querySelectorAll('[data-poi-mode]').forEach((c) => c.classList.remove('active'));
    const entered = poiSetMode(mode);
    if (!entered) {
      return;
    }
    chip.classList.add('active');
  });
});

/** @type {HTMLInputElement} */ (document.getElementById('poiRotSlider')).addEventListener(
  'input',
  () => {
    const val = Number(
      /** @type {HTMLInputElement} */ (document.getElementById('poiRotSlider')).value,
    );
    poiSetRotation(val);
  },
);

/** @type {HTMLElement} */ (document.getElementById('poiApplyBtn')).addEventListener(
  'click',
  () => {
    poiApply();
    document.querySelectorAll('[data-poi-mode]').forEach((c) => c.classList.remove('active'));
  },
);

/** @type {HTMLElement} */ (document.getElementById('poiCancelBtn')).addEventListener(
  'click',
  () => {
    poiCancel();
    document.querySelectorAll('[data-poi-mode]').forEach((c) => c.classList.remove('active'));
  },
);

// ── Zone Editor ──────────────────────────────────────────────

document.querySelectorAll('[data-zone-mode]').forEach((el) => {
  const chip = /** @type {HTMLElement} */ (el);
  chip.addEventListener('click', () => {
    const mode = /** @type {string} */ (chip.dataset.zoneMode);
    document.querySelectorAll('[data-zone-mode]').forEach((c) => c.classList.remove('active'));
    const entered = zoneSetMode(mode);
    if (!entered) {
      return;
    }
    chip.classList.add('active');
  });
});

/** @type {HTMLElement} */ (document.getElementById('zoneApplyBtn')).addEventListener(
  'click',
  () => {
    zoneApply();
    zoneCancel();
    document.querySelectorAll('[data-zone-mode]').forEach((c) => c.classList.remove('active'));
  },
);

/** @type {HTMLElement} */ (document.getElementById('zoneUndoBtn')).addEventListener(
  'click',
  () => {
    zoneUndo();
  },
);

/** @type {HTMLElement} */ (document.getElementById('zoneCancelBtn')).addEventListener(
  'click',
  () => {
    zoneCancel();
    document.querySelectorAll('[data-zone-mode]').forEach((c) => c.classList.remove('active'));
  },
);

// Sidebar resize
const sidebar = /** @type {HTMLElement} */ (document.getElementById('sidebar'));
const handle = /** @type {HTMLElement} */ (document.getElementById('resizeHandle'));
let dragging = false;

handle.addEventListener('mousedown', (e) => {
  dragging = true;
  handle.classList.add('active');
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
  if (!dragging) {
    return;
  }
  const w = Math.max(240, Math.min(800, e.clientX));
  sidebar.style.width = `${w}px`;
});

document.addEventListener('mouseup', () => {
  if (!dragging) {
    return;
  }
  dragging = false;
  handle.classList.remove('active');
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
});
