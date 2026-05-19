import * as THREE from 'three';
import {
  initScene,
  swapFloor,
  scene,
  camera,
  controls,
  renderer,
  PLANE_W,
  PLANE_H
} from './scene/SceneSetup.js';
import {
  initCalibration,
  persistCal,
  offXEl,
  offYEl,
  scXEl,
  scYEl,
  DEFAULT_CALIBRATION,
  storeKey
} from './scene/CoordTransform.js';
import { buildBooths, boothByNo } from './scene/BoothBuilder.js';
import {
  fillDropdowns,
  boothCenterWorld,
  fromSelect,
  toSelect,
  applyFilters
} from './ui/Filters.js';
import { flyTo, focusMesh, highlight, updateSidebar } from './ui/Sidebar.js';
import { sel } from './state.js';
import { enrichData } from './data/enrichment.js';
import { initConsoleTools } from './debug/ConsoleTools.js';
import { reloadCoordDebug, clearOverlay } from './ui/CoordDebug.js';
import { buildStairMap, stairToWorldPos } from './scene/StairMap.js';
import { multiFloorAStar } from './scene/MultiFloorRoute.js';
import { buildRoadOverlay, clearRoadOverlay } from './scene/RoadOverlay.js';
import {
  buildPoiMarkers,
  clearPoiMarkers,
  highlightRouteStair,
  clearRouteStairHighlight,
  updateRouteStairPulse
} from './scene/PoiMarkers.js';
import { positionMarker } from './ui/BoothMarker.js';
import { initInteraction } from './ui/Interaction.js';
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
  initGrid
} from './scene/AStarRoute.js';

// Boot
const stage = /** @type {HTMLElement} */ (document.getElementById('stage'));
const loader = /** @type {HTMLElement} */ (document.getElementById('loader'));
const floors = await fetch('./data/floors.json').then((r) => r.json());

let currentFloor = null;
let currentData = null;
/** @type {Record<string, any>} */
const floorDataMap = {};
/** @type {Record<string, string>} */
const boothToFloor = {};
/** @type {{ segments: Array<{floorName:string,worldPoints:Array<{x:number,z:number}>}>, stairUsed: string|null } | null} */
let multiFloorRouteSeg = null;

// Init one-time scene + UI
await initScene(stage, null);
initGrid(PLANE_W, PLANE_H);
initInteraction();

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
        boothToFloor[b.boothNo] = name;
      }
    } catch (e) {
      console.warn(`Failed to pre-fetch floor "${name}"`, e);
    }
  }
})();

// Load first floor
loadFloor(floors[0]);

// ── Core floor loader ──────────────────────────────────────────

async function loadFloor(name, transitionStair) {
  if (name === currentFloor) return;
  loader.classList.add('visible');

  const tabs = floorTabs.querySelectorAll('.hudBtn');
  tabs.forEach((t) => t.classList.remove('active'));
  const activeTab = floorTabs.querySelector(`[data-floor="${name}"]`);
  if (activeTab) activeTab.classList.add('active');

  try {
    // Fetch JSON
    const res = await fetch(`./data/json/${name}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
    clearRoadOverlay();
    clearPoiMarkers();
    clearRouteStairHighlight();

    // Rebuild booths
    const heatEnabled = /** @type {HTMLInputElement} */ (
      document.getElementById('heatmap')
    ).checked;
    buildBooths(data, heatEnabled);
    rebuildCostGrid(data);
    buildRoadOverlay(data);
    buildPoiMarkers(data);
    fillDropdowns(data);

    // Reset selection
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
    reloadCoordDebug(data);
    initConsoleTools(data);

    console.log(`Switched to ${name} (${data.booths.length} booths)`);
  } catch (err) {
    console.error(`Failed to load floor "${name}":`, err);
    if (activeTab) activeTab.classList.remove('active');
  } finally {
    loader.classList.remove('visible');
  }
}

// ── Calibration hooks ──────────────────────────────────────────

function onCalChange() {
  persistCal();
  if (!currentData) return;
  buildBooths(
    currentData,
    /** @type {HTMLInputElement} */ (document.getElementById('heatmap')).checked
  );
  if (currentData) rebuildCostGrid(currentData);
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
    if (!currentData) return;
    buildBooths(
      currentData,
      /** @type {HTMLInputElement} */ (document.getElementById('heatmap')).checked
    );
    rebuildCostGrid(currentData);
    applyFilters();
  }
);

// Reset button
/** @type {HTMLElement} */ (document.getElementById('resetBtn')).addEventListener('click', () => {
  clearRoute();
  clearRouteStairHighlight();
  multiFloorRouteSeg = null;
  flyTo(new THREE.Vector3(70, 70, 90), new THREE.Vector3(0, 0, 0), 900);
});

// Routing
/** @type {HTMLElement} */ (document.getElementById('routeBtn')).addEventListener('click', () => {
  clearRoute();
  clearRouteStairHighlight();
  multiFloorRouteSeg = null;
  const fromNo = fromSelect.value;
  const toNo = toSelect.value;
  if (!fromNo || !toNo) return;

  const fromFloor = boothToFloor[fromNo];
  const toFloor = boothToFloor[toNo];
  if (!fromFloor || !toFloor) {
    alert('Booth not found on any floor.');
    return;
  }

  if (fromFloor === currentFloor && toFloor === currentFloor) {
    // Single-floor route (existing behavior)
    const from = boothCenterWorld(fromNo);
    const to = boothCenterWorld(toNo);
    let s = findNearestFree(worldToCell(from.x, from.z));
    let t = findNearestFree(worldToCell(to.x, to.z));
    const path = aStar(s, t);
    if (!path) {
      alert('No route found. Try other booths or increase CELL size.');
      return;
    }
    const wp = [
      { x: from.x, z: from.z },
      ...path.map((p) => cellToWorld(p.r, p.c)),
      { x: to.x, z: to.z }
    ];
    drawRoute(wp);
    multiFloorRouteSeg = null;
    const start = new THREE.Vector3(from.x, 0.1, from.z);
    flyTo(start.clone().add(new THREE.Vector3(30, 30, 34)), start.clone(), 900);
    followRoute(wp);
    return;
  }

  // Cross-floor route
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
        900
      );
    }
  } else {
    // Switch to start floor
    loadFloor(fromFloor);
  }
});

/** @type {HTMLElement} */ (document.getElementById('clearRouteBtn')).addEventListener(
  'click',
  () => {
    clearRoute();
    clearRouteStairHighlight();
    multiFloorRouteSeg = null;
  }
);
/** @type {HTMLInputElement} */ (document.getElementById('followCam')).addEventListener(
  'change',
  () => {
    if (
      /** @type {HTMLInputElement} */ (document.getElementById('followCam')).checked &&
      routeWorldPoints
    )
      followRoute(routeWorldPoints);
    else clearFollow();
  }
);

// Camera HUD
/** @type {HTMLElement} */ (document.getElementById('camIso')).addEventListener('click', () =>
  flyTo(new THREE.Vector3(75, 70, 75), new THREE.Vector3(0, 0, 0), 850)
);
/** @type {HTMLElement} */ (document.getElementById('camTop')).addEventListener('click', () =>
  flyTo(new THREE.Vector3(0, 160, 0.01), new THREE.Vector3(0, 0, 0), 850)
);
/** @type {HTMLElement} */ (document.getElementById('camReset')).addEventListener('click', () =>
  flyTo(new THREE.Vector3(70, 70, 90), new THREE.Vector3(0, 0, 0), 850)
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
  if (!currentData) return;
  clearRoute();
  let i = 0;
  tourTimer = setInterval(() => {
    const b = currentData.booths[i % currentData.booths.length];
    const m = boothByNo.get(b.boothNo);
    if (m && m.visible) {
      if (sel.selected && sel.selected !== m) highlight(sel.selected, false);
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
  if (!dragging) return;
  const w = Math.max(240, Math.min(800, e.clientX));
  sidebar.style.width = `${w}px`;
});

document.addEventListener('mouseup', () => {
  if (!dragging) return;
  dragging = false;
  handle.classList.remove('active');
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
});
