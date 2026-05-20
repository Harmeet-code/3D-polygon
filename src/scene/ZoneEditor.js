import * as THREE from 'three';
import { camera, renderer, PLANE_W, PLANE_H } from './SceneSetup.js';
import { worldToPx, pixelToFabric } from './CoordTransform.js';
import { updateZoneOverlay, clearZoneOverlay } from './ZoneOverlay.js';

// ── State ────────────────────────────────────────────────────

/** @type {'add-rect'|'add-polygon'|'remove'|null} */
let mode = null;
/** @type {Array<{id:string,type:'rect',x:number,y:number,w:number,h:number}|{id:string,type:'polygon',points:Array<[number,number]>}>} */
let zones = [];
/** @type {{type:'rect',p1:{x:number,z:number},p2:{x:number,z:number}}|{type:'polygon',points:Array<{x:number,z:number}>}|null} */
let currentZone = null;
let currentDataFn = null;
let currentFloorFn = null;
let toastTimer = null;
let _idCounter = 0;

const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const raycaster = new THREE.Raycaster();
const mouseVec = new THREE.Vector2();

// ── Helpers ──────────────────────────────────────────────────

function getFloorPosition(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouseVec.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouseVec.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouseVec, camera);
  const pt = new THREE.Vector3();
  const hit = raycaster.ray.intersectPlane(floorPlane, pt);
  if (!hit) {
    return null;
  }
  const halfW = PLANE_W / 2;
  const halfH = PLANE_H / 2;
  if (pt.x < -halfW || pt.x > halfW || pt.z < -halfH || pt.z > halfH) {
    return null;
  }
  return pt;
}

function worldToFabric(wp) {
  const { px, py } = worldToPx(wp.x, wp.z);
  return pixelToFabric(px, py);
}

// ── Public API ───────────────────────────────────────────────

export function initZoneEditor(getData, getFloor) {
  currentDataFn = getData;
  currentFloorFn = getFloor;
}

export function setMode(newMode) {
  if (mode === newMode) {
    cancelZones();
    return false;
  }
  cancelZones();
  mode = newMode;
  currentZone = null;
  zones = [];
  _idCounter = 0;
  renderer.domElement.style.cursor = 'crosshair';
  updateUI();
  return true;
}

export function getMode() {
  return mode;
}

export function addPoint(wx, wz) {
  if (!mode) {
    return;
  }

  if (mode === 'add-rect') {
    const rect = /** @type {{type:'rect',p1:{x:number,z:number},p2:{x:number,z:number}}} */ (
      currentZone
    );
    if (!rect) {
      currentZone = { type: 'rect', p1: { x: wx, z: wz }, p2: { x: wx, z: wz } };
    } else {
      rect.p2 = { x: wx, z: wz };
      finishRect();
    }
  } else if (mode === 'add-polygon') {
    const poly = /** @type {{type:'polygon',points:Array<{x:number,z:number}>}} */ (currentZone);
    if (!poly) {
      currentZone = { type: 'polygon', points: [{ x: wx, z: wz }] };
    } else {
      poly.points.push({ x: wx, z: wz });
    }
  }

  updateZoneOverlay(zones, currentZone);
  updateUI();
}

export function finishRect() {
  if (!currentZone || currentZone.type !== 'rect') {
    return;
  }
  const { p1, p2 } = currentZone;
  const minX = Math.min(p1.x, p2.x);
  const maxX = Math.max(p1.x, p2.x);
  const minZ = Math.min(p1.z, p2.z);
  const maxZ = Math.max(p1.z, p2.z);

  // Check minimum size
  if (maxX - minX < 0.5 || maxZ - minZ < 0.5) {
    currentZone = null;
    updateZoneOverlay(zones, null);
    updateUI();
    return;
  }

  _idCounter++;
  zones.push({
    id: `zone-${_idCounter}`,
    type: 'rect',
    x: minX,
    y: minZ,
    w: maxX - minX,
    h: maxZ - minZ,
  });
  currentZone = null;
  updateZoneOverlay(zones, null);
  updateUI();
}

export function finishPolygon() {
  const poly = /** @type {{type:'polygon',points:Array<{x:number,z:number}>}|null} */ (currentZone);
  if (!poly || poly.type !== 'polygon') {
    return;
  }
  if (poly.points.length < 3) {
    currentZone = null;
    updateZoneOverlay(zones, null);
    updateUI();
    return;
  }

  _idCounter++;
  const fabricPts = poly.points.map((wp) => {
    const { x, y } = worldToFabric(wp);
    return /** @type {[number, number]} */ ([Math.round(x), Math.round(y)]);
  });

  zones.push({
    id: `zone-${_idCounter}`,
    type: 'polygon',
    points: fabricPts,
  });
  currentZone = null;
  updateZoneOverlay(zones, null);
  updateUI();
}

export function undoLastPoint() {
  if (!currentZone) {
    return;
  }
  const poly = /** @type {{type:'polygon',points:Array<{x:number,z:number}>}} */ (currentZone);
  if (poly.type === 'polygon' && poly.points.length > 0) {
    poly.points.pop();
    if (poly.points.length === 0) {
      currentZone = null;
    }
    updateZoneOverlay(zones, currentZone);
    updateUI();
  }
}

export function removeZoneAt(wx, wz) {
  if (mode !== 'remove') {
    return false;
  }

  // Simple point-in-zone check for removal
  for (let i = zones.length - 1; i >= 0; i--) {
    const z = zones[i];
    if (!z) {
      continue;
    }
    if (z.type === 'rect') {
      if (wx >= z.x && wx <= z.x + z.w && wz >= z.y && wz <= z.y + z.h) {
        zones.splice(i, 1);
        updateZoneOverlay(zones, null);
        updateUI();
        return true;
      }
    } else if (z.type === 'polygon') {
      const pts = z.points;
      let inside = false;
      for (let j = 0, k = pts.length - 1; j < pts.length; k = j++) {
        const pj = pts[j];
        const pk = pts[k];
        if (!pj || !pk) {
          continue;
        }
        const yi = pj[1];
        const yk = pk[1];
        const xi = pj[0];
        const xk = pk[0];
        if (yi > wz !== yk > wz && wx < ((xk - xi) * (wz - yi)) / (yk - yi) + xi) {
          inside = !inside;
        }
      }
      if (inside) {
        zones.splice(i, 1);
        updateZoneOverlay(zones, null);
        updateUI();
        return true;
      }
    }
  }
  return false;
}

export function applyZones() {
  const data = currentDataFn ? currentDataFn() : null;
  const floorName = currentFloorFn ? currentFloorFn() : null;
  if (!data || !floorName) {
    return;
  }

  if (zones.length === 0) {
    showToast('Draw at least one zone first');
    return;
  }

  // Convert zones to fabric coords for JSON export
  const entries = zones.map((z) => {
    if (z.type === 'rect') {
      const p1 = worldToFabric({ x: z.x, z: z.y });
      const p2 = worldToFabric({ x: z.x + z.w, z: z.y + z.h });
      return {
        id: z.id,
        type: 'rect',
        x: Math.round(p1.x),
        y: Math.round(p1.y),
        w: Math.round(p2.x - p1.x),
        h: Math.round(p2.y - p1.y),
      };
    } else {
      return {
        id: z.id,
        type: 'polygon',
        points: z.points,
      };
    }
  });

  const jsonStr = `// Add these entries to meta.walkableZones[] in ${
    floorName
  }.json\n${JSON.stringify(entries, null, 2)}`;

  navigator.clipboard
    .writeText(jsonStr)
    .then(() => {
      showToast('Zone JSON copied. Paste into the floor file.');
    })
    .catch(() => {
      showToast('Failed to copy');
    });

  // Also update in-memory data for immediate grid rebuild
  if (data.meta) {
    data.meta.walkableZones = entries;
  }
}

export function cancelZones() {
  clearZoneOverlay();
  currentZone = null;
  zones = [];
  _idCounter = 0;
  mode = null;
  renderer.domElement.style.cursor = '';
  updateUI();
}

export function handleMouseMove(event) {
  if (!mode || !currentZone) {
    return;
  }

  const pt = getFloorPosition(event);
  if (!pt) {
    return;
  }

  if (mode === 'add-rect' && currentZone.type === 'rect') {
    const rect = /** @type {{type:'rect',p1:{x:number,z:number},p2:{x:number,z:number}}} */ (
      currentZone
    );
    rect.p2 = { x: pt.x, z: pt.z };
    updateZoneOverlay(zones, currentZone);
  } else if (mode === 'add-polygon' && currentZone.type === 'polygon') {
    const poly = /** @type {{type:'polygon',points:Array<{x:number,z:number}>}} */ (currentZone);
    const pts = poly.points;
    if (pts.length > 0) {
      pts[pts.length - 1] = { x: pt.x, z: pt.z };
      updateZoneOverlay(zones, currentZone);
    }
  }
}

export function handleClick(event) {
  if (!mode) {
    return false;
  }

  if (mode === 'remove') {
    const pt = getFloorPosition(event);
    if (!pt) {
      return false;
    }
    return removeZoneAt(pt.x, pt.z);
  }

  const pt = getFloorPosition(event);
  if (!pt) {
    return false;
  }

  addPoint(pt.x, pt.z);
  return true;
}

export function handleRightClick(event) {
  if (!mode) {
    return false;
  }

  if (mode === 'add-polygon') {
    event.preventDefault();
    finishPolygon();
    return true;
  }

  if (mode === 'add-rect') {
    event.preventDefault();
    finishRect();
    return true;
  }

  return false;
}

export function handleDoubleClick(event) {
  if (mode === 'add-polygon') {
    event.preventDefault();
    finishPolygon();
    return true;
  }
  return false;
}

function updateUI() {
  const statusEl = document.getElementById('zoneEditorStatus');
  if (!statusEl) {
    return;
  }

  if (mode === 'add-rect') {
    const n = zones.length;
    statusEl.textContent = `${n} zone(s) drawn. Click corner 1, then corner 2 to place rect zone.`;
    statusEl.style.color = 'var(--accent)';
  } else if (mode === 'add-polygon') {
    const n = zones.length;
    const pts = currentZone?.type === 'polygon' ? currentZone.points.length : 0;
    statusEl.textContent = `${n} zone(s) drawn, ${
      pts
    } point(s) current. Click to add points, double-click/right-click to close.`;
    statusEl.style.color = 'var(--accent)';
  } else if (mode === 'remove') {
    statusEl.textContent = 'Click a zone to remove it.';
    statusEl.style.color = 'var(--bad)';
  } else {
    statusEl.textContent = '';
  }

  const applyBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById('zoneApplyBtn'));
  const cancelBtn = /** @type {HTMLButtonElement|null} */ (
    document.getElementById('zoneCancelBtn')
  );
  const undoBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById('zoneUndoBtn'));

  if (applyBtn) {
    applyBtn.disabled = !mode || zones.length === 0;
  }
  if (cancelBtn) {
    cancelBtn.disabled = !mode;
  }
  if (undoBtn) {
    const poly = /** @type {{type:'polygon',points:Array<{x:number,z:number}>}|null} */ (
      currentZone
    );
    undoBtn.disabled = !mode || (poly?.type === 'polygon' ? poly.points.length === 0 : true);
  }
}

function showToast(msg) {
  let toast = document.getElementById('zoneToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'zoneToast';
    toast.style.cssText =
      'position:fixed;bottom:60px;left:50%;transform:translateX(-50%);padding:10px 20px;border-radius:12px;background:rgba(0,0,0,.82);color:#fff;font-size:13px;z-index:999;backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.12);transition:opacity .3s;pointer-events:none';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  if (toastTimer) {
    clearTimeout(toastTimer);
  }
  toastTimer = setTimeout(() => {
    toast.style.opacity = '0';
  }, 3000);
}
