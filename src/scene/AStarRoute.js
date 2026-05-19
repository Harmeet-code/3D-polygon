import * as THREE from 'three';
import { scene, PLANE_W, PLANE_H } from './SceneSetup.js';
import { boothMeshes } from './BoothBuilder.js';
import { fabricToPixel, pxToWorld } from './CoordTransform.js';
import { distSqToPolyline } from './PolylineCorridor.js';
import { flyTo } from '../ui/Sidebar.js';

const CELL = 1.2;
const MARGIN = 0.8;
export let cols = 0,
  rows = 0;
let halfW = 0,
  halfH = 0;
const idx = (r, c) => r * cols + c;
let costGrid = new Float32Array();

export function initGrid(pw, ph) {
  halfW = pw / 2;
  halfH = ph / 2;
  cols = Math.ceil(pw / CELL);
  rows = Math.ceil(ph / CELL);
  costGrid = new Float32Array(rows * cols);
}

const DEMO_BLOCKED_BOOTHS = /** @type {Set<string>} */ (new Set());

export function worldToCell(x, z) {
  const c = Math.floor((x + halfW) / CELL);
  const r = Math.floor((halfH - z) / CELL);
  return { r, c };
}

export function cellToWorld(r, c) {
  const x = (c + 0.5) * CELL - halfW;
  const z = halfH - (r + 0.5) * CELL;
  return { x, z };
}

let fbMinX = 0,
  fbMaxX = 0,
  fbMinY = 0,
  fbMaxY = 0;

const INF = Infinity;

export function rebuildCostGrid(data) {
  costGrid = new Float32Array(rows * cols).fill(INF);

  // Store fabric bounds for scale computation
  if (data?.meta?.fabricBounds) {
    fbMinX = data.meta.fabricBounds.minX;
    fbMaxX = data.meta.fabricBounds.maxX;
    fbMinY = data.meta.fabricBounds.minY;
    fbMaxY = data.meta.fabricBounds.maxY;
  }

  // Booth AABB cells → Infinity
  for (const m of boothMeshes) {
    const b = m.userData.booth;
    if (DEMO_BLOCKED_BOOTHS.has(/** @type {string} */ (b.boothNo))) continue;

    const box = new THREE.Box3().setFromObject(m);
    const minX = box.min.x - MARGIN;
    const maxX = box.max.x + MARGIN;
    const minZ = box.min.z - MARGIN;
    const maxZ = box.max.z + MARGIN;

    const a = worldToCell(minX, maxZ);
    const b2 = worldToCell(maxX, minZ);

    const r0 = Math.max(0, Math.min(a.r, b2.r));
    const r1 = Math.min(rows - 1, Math.max(a.r, b2.r));
    const c0 = Math.max(0, Math.min(a.c, b2.c));
    const c1 = Math.min(cols - 1, Math.max(a.c, b2.c));

    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        costGrid[idx(r, c)] = INF;
      }
    }
  }

  // Road corridor cells → 1.0
  const roads = data?.meta?.roads || [];
  for (const road of roads) {
    const radius = road.width || 200;
    // Convert road polyline to world coords for distance checks
    const worldPts = road.points.map((/** @type {number[]} */ pt) => {
      const { px, py } = fabricToPixel(pt[0], pt[1]);
      return pxToWorld(px, py);
    });
    // Compute approximate world-space half-width
    const fabricRangeX = fbMaxX - fbMinX;
    const fabricRangeY = fbMaxY - fbMinY;
    const scaleX = PLANE_W / fabricRangeX;
    const scaleY = PLANE_H / fabricRangeY;
    const worldRadius = radius * ((scaleX + scaleY) / 2);

    const polylineWp = worldPts.map((/** @type {{x:number,z:number}} */ wp) => [wp.x, wp.z]);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const ni = idx(r, c);
        if (costGrid[ni] === INF) {
          const { x, z } = cellToWorld(r, c);
          const dSq = distSqToPolyline([x, z], polylineWp);
          if (dSq <= worldRadius * worldRadius) {
            costGrid[ni] = 1.0;
          }
        }
      }
    }
  }

  // Stair cells → 1.0 (accessible even if overlapping booth)
  const stairs = data?.meta?.stairs || [];
  for (const s of stairs) {
    if (s.position) {
      const { px, py } = fabricToPixel(s.position.x, s.position.y);
      const { x, z } = pxToWorld(px, py);
      const cell = worldToCell(x, z);
      if (cell.r >= 0 && cell.r < rows && cell.c >= 0 && cell.c < cols) {
        const ni = idx(cell.r, cell.c);
        costGrid[ni] = 1.0;
        // Also mark 3x3 area around stair
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const rr = cell.r + dr,
              cc = cell.c + dc;
            if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) {
              costGrid[idx(rr, cc)] = 1.0;
            }
          }
        }
      }
    }
  }
}

function heuristic(a, b) {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
}

class MinHeap {
  constructor() {
    this.a = [];
  }
  push(n) {
    this.a.push(n);
    this._up(this.a.length - 1);
  }
  pop() {
    const top = this.a[0];
    const last = this.a.pop();
    if (this.a.length) {
      this.a[0] = last;
      this._down(0);
    }
    return top;
  }
  get size() {
    return this.a.length;
  }
  _up(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.a[p].f <= this.a[i].f) break;
      [this.a[p], this.a[i]] = [this.a[i], this.a[p]];
      i = p;
    }
  }
  _down(i) {
    for (;;) {
      const l = i * 2 + 1,
        r = l + 1;
      let m = i;
      if (l < this.a.length && this.a[l].f < this.a[m].f) m = l;
      if (r < this.a.length && this.a[r].f < this.a[m].f) m = r;
      if (m === i) break;
      [this.a[m], this.a[i]] = [this.a[i], this.a[m]];
      i = m;
    }
  }
}

export function aStar(start, goal) {
  const open = new MinHeap();
  const came = new Int32Array(rows * cols).fill(-1);
  const g = new Float32Array(rows * cols).fill(1e9);

  const sIdx = idx(start.r, start.c);
  const gIdx = idx(goal.r, goal.c);
  g[sIdx] = 0;
  open.push({ r: start.r, c: start.c, f: heuristic(start, goal), i: sIdx });

  const dirs = [
    { dr: 1, dc: 0, cost: 1 },
    { dr: -1, dc: 0, cost: 1 },
    { dr: 0, dc: 1, cost: 1 },
    { dr: 0, dc: -1, cost: 1 },
    { dr: 1, dc: 1, cost: 1.4 },
    { dr: 1, dc: -1, cost: 1.4 },
    { dr: -1, dc: 1, cost: 1.4 },
    { dr: -1, dc: -1, cost: 1.4 }
  ];
  const closed = new Uint8Array(rows * cols);

  while (open.size) {
    const cur = /** @type {{ r: number; c: number; f: number; i: number }} */ (open.pop());
    if (cur.i === gIdx) {
      const path = [];
      let at = gIdx;
      while (at !== -1) {
        const rr = Math.floor(at / cols),
          cc = at % cols;
        path.push({ r: rr, c: cc });
        at = came[at];
      }
      path.reverse();
      return path;
    }
    if (closed[cur.i]) continue;
    closed[cur.i] = 1;

    for (const d of dirs) {
      const nr = cur.r + d.dr,
        nc = cur.c + d.dc;
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
      const ni = idx(nr, nc);
      if (costGrid[ni] === INF) continue;
      const ng = /** @type {number} */ (g[cur.i]) + d.cost;
      if (ng < /** @type {number} */ (g[ni])) {
        g[ni] = ng;
        came[ni] = cur.i;
        open.push({ r: nr, c: nc, f: ng + heuristic({ r: nr, c: nc }, goal), i: ni });
      }
    }
  }
  return null;
}

export function findNearestFree(cell) {
  const inBounds = (r, c) => r >= 0 && c >= 0 && r < rows && c < cols;
  if (inBounds(cell.r, cell.c) && costGrid[idx(cell.r, cell.c)] !== INF) return cell;
  for (let rad = 1; rad < 16; rad++) {
    for (let dr = -rad; dr <= rad; dr++) {
      for (let dc = -rad; dc <= rad; dc++) {
        const rr = cell.r + dr,
          cc = cell.c + dc;
        if (!inBounds(rr, cc)) continue;
        if (costGrid[idx(rr, cc)] !== INF) return { r: rr, c: cc };
      }
    }
  }
  return cell;
}

let routeBase = null,
  routeGlow = null,
  routeDots = null;
export let routeWorldPoints = null;
let followTimer = null;

export function clearFollow() {
  if (followTimer) {
    clearTimeout(followTimer);
    followTimer = null;
  }
}

export function clearRoute() {
  clearFollow();
  routeWorldPoints = null;
  if (routeBase) {
    scene.remove(routeBase);
    routeBase.geometry.dispose();
    routeBase.material.dispose();
    routeBase = null;
  }
  if (routeGlow) {
    scene.remove(routeGlow);
    routeGlow.geometry.dispose();
    routeGlow.material.dispose();
    routeGlow = null;
  }
  if (routeDots) {
    scene.remove(routeDots);
    routeDots.geometry.dispose();
    routeDots.material.dispose();
    routeDots = null;
  }
}

export function drawRoute(worldPoints) {
  clearRoute();
  routeWorldPoints = worldPoints;

  const pts = worldPoints.map((p) => new THREE.Vector3(p.x, 0.14, p.z));
  const curve = new THREE.CatmullRomCurve3(pts);
  curve.curveType = 'catmullrom';
  curve.tension = 0.25;

  const baseGeom = new THREE.TubeGeometry(curve, 220, 0.5, 10, false);
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x07101f,
    roughness: 0.6,
    metalness: 0.2,
    transparent: true,
    opacity: 0.92
  });
  routeBase = new THREE.Mesh(baseGeom, baseMat);
  routeBase.renderOrder = 10;
  scene.add(routeBase);

  const glowGeom = new THREE.TubeGeometry(curve, 220, 0.72, 10, false);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0x6aa9ff,
    transparent: true,
    opacity: 0.55
  });
  routeGlow = new THREE.Mesh(glowGeom, glowMat);
  routeGlow.position.y = 0.02;
  routeGlow.renderOrder = 11;
  scene.add(routeGlow);

  const dotCount = 80;
  const dotPos = new Float32Array(dotCount * 3);
  for (let i = 0; i < dotCount; i++) {
    const t = i / (dotCount - 1);
    const p = curve.getPoint(t);
    dotPos[i * 3 + 0] = p.x;
    dotPos[i * 3 + 1] = 0.18;
    dotPos[i * 3 + 2] = p.z;
  }
  const dotsGeom = new THREE.BufferGeometry();
  dotsGeom.setAttribute('position', new THREE.BufferAttribute(dotPos, 3));
  const dotsMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.55,
    transparent: true,
    opacity: 0.85
  });
  routeDots = new THREE.Points(dotsGeom, dotsMat);
  routeDots.userData.curve = curve;
  routeDots.userData.dotCount = dotCount;
  scene.add(routeDots);
}

export function followRoute(points) {
  clearFollow();
  if (
    !(/** @type {HTMLInputElement} */ (document.getElementById('followCam')).checked) ||
    !points ||
    points.length < 3
  )
    return;

  const step = Math.max(2, Math.floor(points.length / 14));
  const sampled = [];
  for (let i = 0; i < points.length; i += step) sampled.push(points[i]);
  if (sampled[sampled.length - 1] !== points[points.length - 1])
    sampled.push(points[points.length - 1]);

  let i = 0;
  const moveNext = () => {
    if (i >= sampled.length) return;
    const p = sampled[i];
    const look = new THREE.Vector3(p.x, 0.1, p.z);
    const camPos = look.clone().add(new THREE.Vector3(26, 26, 30));
    flyTo(camPos, look, 520);
    i++;
    followTimer = setTimeout(moveNext, 560);
  };
  moveNext();
}

export function updateRouteAnimation() {
  if (routeGlow) {
    const t = performance.now() * 0.004;
    routeGlow.material.opacity = 0.2 + 0.55 * (0.5 + 0.5 * Math.sin(t));
  }
  if (routeDots) {
    const curve = routeDots.userData.curve;
    const dotCount = routeDots.userData.dotCount;
    const posAttr = routeDots.geometry.getAttribute('position');
    const t0 = (performance.now() * 0.00015) % 1;
    for (let i = 0; i < dotCount; i++) {
      const tt = (t0 + i / (dotCount - 1)) % 1;
      const p = curve.getPoint(tt);
      posAttr.setXYZ(i, p.x, 0.18, p.z);
    }
    posAttr.needsUpdate = true;
  }
}
