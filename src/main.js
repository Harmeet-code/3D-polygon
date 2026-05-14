import * as THREE from 'three';
import {
  initScene,
  renderer,
  scene,
  camera,
  controls,
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
  rebuildBlockedGrid,
  updateRouteAnimation,
  initGrid
} from './scene/AStarRoute.js';

// Boot
const data = await fetch('./data/booths_poly_v2.json').then((r) => r.json());
enrichData(data);

const stage = /** @type {HTMLElement} */ (document.getElementById('stage'));
await initScene(stage);
initGrid(PLANE_W, PLANE_H);
initCalibration(data);
initInteraction();

buildBooths(data, false);
fillDropdowns(data);
rebuildBlockedGrid();

initConsoleTools(data);

// Calibration hooks
function onCalChange() {
  persistCal();
  buildBooths(data, /** @type {HTMLInputElement} */ (document.getElementById('heatmap')).checked);
  rebuildBlockedGrid();
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

// Reset button
/** @type {HTMLElement} */ (document.getElementById('resetBtn')).addEventListener('click', () => {
  clearRoute();
  flyTo(new THREE.Vector3(70, 70, 90), new THREE.Vector3(0, 0, 0), 900);
});

// Routing
/** @type {HTMLElement} */ (document.getElementById('routeBtn')).addEventListener('click', () => {
  const from = boothCenterWorld(fromSelect.value);
  const to = boothCenterWorld(toSelect.value);

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

  const start = new THREE.Vector3(from.x, 0.1, from.z);
  flyTo(start.clone().add(new THREE.Vector3(30, 30, 34)), start.clone(), 900);
  followRoute(wp);
});

/** @type {HTMLElement} */ (document.getElementById('clearRouteBtn')).addEventListener(
  'click',
  clearRoute
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
  clearRoute();
  let i = 0;
  tourTimer = setInterval(() => {
    const b = data.booths[i % data.booths.length];
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
