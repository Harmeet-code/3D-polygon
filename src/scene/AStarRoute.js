import * as THREE from 'three';
import { IMG_W, PLANE_W, scene } from './SceneSetup.js';
import { fabricToPixel, pxToWorld } from './CoordTransform.js';
import { flyTo } from '../ui/Sidebar.js';

const CELL = 0.2;
const MIN_ROUTE_WIDTH_OFFSET_PX = 33;
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

const INF = Infinity;

function routeClearanceWorld() {
  return (MIN_ROUTE_WIDTH_OFFSET_PX / 2) * (PLANE_W / IMG_W);
}

function routeGlowRadiusWorld() {
  return routeClearanceWorld() * 1.3;
}

function isFreeCell(r, c) {
  return r >= 0 && c >= 0 && r < rows && c < cols && costGrid[idx(r, c)] !== INF;
}

function fabricPointToBoothWorld(x, y) {
  const { px, py } = fabricToPixel(x, y);
  const w = pxToWorld(px, py);
  return { x: w.x, z: -w.z };
}

/** Rasterize all walkable zones into a mask (1 = covered, 0 = not covered). */
function rasterizeWalkableZonesMask(zones, mask) {
  for (const zone of zones) {
    if (zone.type === 'rect') {
      rasterizeRectZoneMask(zone, mask);
    } else if (zone.type === 'polygon') {
      rasterizePolygonZoneMask(zone, mask);
    }
  }
}

/** Mark all cells inside a rect zone as covered in mask. */
function rasterizeRectZoneMask(zone, mask) {
  const { x: fx, y: fy, w: fw, h: fh } = zone;
  const p1 = fabricToPixel(fx, fy);
  const p2 = fabricToPixel(fx + fw, fy + fh);
  const w1 = pxToWorld(p1.px, p1.py);
  const w2 = pxToWorld(p2.px, p2.py);

  const minX = Math.min(w1.x, w2.x);
  const maxX = Math.max(w1.x, w2.x);
  const minZ = Math.min(w1.z, w2.z);
  const maxZ = Math.max(w1.z, w2.z);

  const a = worldToCell(minX, maxZ);
  const b = worldToCell(maxX, minZ);

  const r0 = Math.max(0, Math.min(a.r, b.r));
  const r1 = Math.min(rows - 1, Math.max(a.r, b.r));
  const c0 = Math.max(0, Math.min(a.c, b.c));
  const c1 = Math.min(cols - 1, Math.max(a.c, b.c));

  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      mask[idx(r, c)] = 1;
    }
  }
}

/** Mark all cells inside a polygon zone as covered in mask using scanline fill. */
function rasterizePolygonZoneMask(zone, mask) {
  const pts = zone.points.map((/** @type {number[]} */ fp) => {
    const { px, py } = fabricToPixel(fp[0], fp[1]);
    return pxToWorld(px, py);
  });
  if (pts.length < 3) {
    return;
  }

  let minR = rows - 1,
    maxR = 0,
    minC = cols - 1,
    maxC = 0;
  for (const p of pts) {
    const cell = worldToCell(p.x, p.z);
    if (cell.r < minR) {
      minR = cell.r;
    }
    if (cell.r > maxR) {
      maxR = cell.r;
    }
    if (cell.c < minC) {
      minC = cell.c;
    }
    if (cell.c > maxC) {
      maxC = cell.c;
    }
  }
  minR = Math.max(0, minR);
  maxR = Math.min(rows - 1, maxR);
  minC = Math.max(0, minC);
  maxC = Math.min(cols - 1, maxC);

  const n = pts.length;
  for (let r = minR; r <= maxR; r++) {
    const y = cellToWorld(r, 0).z;
    const intersections = [];
    for (let i = 0; i < n; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % n];
      if (p1.z > y !== p2.z > y) {
        const t = (y - p1.z) / (p2.z - p1.z);
        intersections.push(p1.x + t * (p2.x - p1.x));
      }
    }
    intersections.sort((a, b) => a - b);
    for (let i = 0; i < intersections.length - 1; i += 2) {
      const left = intersections[i];
      const right = intersections[i + 1];
      const cLeft = worldToCell(left, y).c;
      const cRight = worldToCell(right, y).c;
      const c0 = Math.max(minC, Math.min(cLeft, cRight));
      const c1 = Math.min(maxC, Math.max(cLeft, cRight));
      for (let c = c0; c <= c1; c++) {
        mask[idx(r, c)] = 1;
      }
    }
  }
}

/** Check if a world position is on a blocked cell. */
export function isCellBlocked(x, z) {
  const { r, c } = worldToCell(x, z);
  if (r < 0 || c < 0 || r >= rows || c >= cols) {
    return true;
  }
  return costGrid[idx(r, c)] === INF;
}

export function rebuildCostGrid(data) {
  // Start with all cells walkable
  costGrid = new Float32Array(rows * cols).fill(1.0);

  // Pass 1: Block booth cells
  const booths = data?.booths || [];
  console.log(`[AStarRoute] Grid init: ${rows}x${cols}=${rows * cols} cells, all walkable`);
  console.log(`[AStarRoute] Blocking ${booths.length} booths`);
  blockBoothCells(booths);

  // Debug: count walkable vs blocked cells
  let walkable = 0;
  let blocked = 0;
  for (let i = 0; i < costGrid.length; i++) {
    if (costGrid[i] === INF) {
      blocked++;
    } else {
      walkable++;
    }
  }
  console.log(
    `[AStarRoute] After blocking: walkable=${walkable}, blocked=${blocked} (${((blocked / costGrid.length) * 100).toFixed(1)}%)`,
  );

  // Pass 2: If walkable zones defined, restrict to zones only
  const zones = data?.meta?.walkableZones || [];
  if (zones.length > 0) {
    console.log(`[AStarRoute] Restricting to ${zones.length} walkable zones`);
    const zoneMask = new Uint8Array(rows * cols);
    rasterizeWalkableZonesMask(zones, zoneMask);
    for (let i = 0; i < costGrid.length; i++) {
      if (zoneMask[i] === 0) {
        costGrid[i] = INF;
      }
    }
    // Recount
    walkable = 0;
    blocked = 0;
    for (let i = 0; i < costGrid.length; i++) {
      if (costGrid[i] === INF) {
        blocked++;
      } else {
        walkable++;
      }
    }
    console.log(`[AStarRoute] After zones: walkable=${walkable}, blocked=${blocked}`);
  }
}

/** Mark booth cells as blocked (INF) using actual polygon geometry. */
function blockBoothCells(booths) {
  /** @type {Set<string>} */
  const boothBlockedSet = new Set();

  for (const b of booths) {
    if (DEMO_BLOCKED_BOOTHS.has(/** @type {string} */ (b.boothNo))) {
      continue;
    }
    const geo = b.geometry;
    if (!geo || !geo.points || geo.points.length < 3) {
      continue;
    }

    // Convert polygon points from fabric to world space
    const pts = geo.points.map((/** @type {number[]} */ fp) =>
      fabricPointToBoothWorld(fp[0], fp[1]),
    );

    // Debug: log NE booths
    if (b.boothNo && b.boothNo.startsWith('NE')) {
      console.log(
        `[AStarRoute] Booth ${b.boothNo} polygon bounds:`,
        pts.map((p) => `(${p.x.toFixed(1)},${p.z.toFixed(1)})`).join(' '),
      );
    }

    // Find bounding box in cell coords
    let minR = rows - 1,
      maxR = 0,
      minC = cols - 1,
      maxC = 0;
    for (const p of pts) {
      const cell = worldToCell(p.x, p.z);
      if (cell.r < minR) {
        minR = cell.r;
      }
      if (cell.r > maxR) {
        maxR = cell.r;
      }
      if (cell.c < minC) {
        minC = cell.c;
      }
      if (cell.c > maxC) {
        maxC = cell.c;
      }
    }
    minR = Math.max(0, minR);
    maxR = Math.min(rows - 1, maxR);
    minC = Math.max(0, minC);
    maxC = Math.min(cols - 1, maxC);

    // Debug: log NE booth cell ranges
    if (b.boothNo && b.boothNo.startsWith('NE')) {
      console.log(
        `[AStarRoute] Booth ${b.boothNo} cell range: r=${minR}-${maxR}, c=${minC}-${maxC}`,
      );
    }

    // Scanline fill to block all cells inside the polygon
    const n = pts.length;
    for (let r = minR; r <= maxR; r++) {
      const y = cellToWorld(r, 0).z;
      const intersections = [];
      for (let i = 0; i < n; i++) {
        const p1 = pts[i];
        const p2 = pts[(i + 1) % n];
        if (p1.z > y !== p2.z > y) {
          const t = (y - p1.z) / (p2.z - p1.z);
          intersections.push(p1.x + t * (p2.x - p1.x));
        }
      }
      intersections.sort((a, b) => a - b);
      for (let i = 0; i < intersections.length - 1; i += 2) {
        const left = intersections[i];
        const right = intersections[i + 1];
        const cLeft = worldToCell(left, y).c;
        const cRight = worldToCell(right, y).c;
        const c0 = Math.max(minC, Math.min(cLeft, cRight));
        const c1 = Math.min(maxC, Math.max(cLeft, cRight));
        for (let c = c0; c <= c1; c++) {
          const key = `${r},${c}`;
          if (!boothBlockedSet.has(key)) {
            boothBlockedSet.add(key);
            costGrid[idx(r, c)] = INF;
          }
        }
      }
    }

    // Debug: log blocked cell count for NE booths
    if (b.boothNo && b.boothNo.startsWith('NE')) {
      let count = 0;
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          if (costGrid[idx(r, c)] === INF) {
            count++;
          }
        }
      }
      console.log(`[AStarRoute] Booth ${b.boothNo} blocked ${count} cells in range`);
    }
  }

  // Inflate obstacles by half the minimum corridor width.
  const marginCells = Math.ceil(routeClearanceWorld() / CELL);
  const boothBlockedCells = /** @type {Array<{r: number, c: number}>} */ (
    Array.from(boothBlockedSet).map((k) => {
      const parts = k.split(',');
      return { r: Number(parts[0]), c: Number(parts[1]) };
    })
  );
  for (const { r, c } of boothBlockedCells) {
    for (let dr = -marginCells; dr <= marginCells; dr++) {
      for (let dc = -marginCells; dc <= marginCells; dc++) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nc >= 0 && nr < rows && nc < cols) {
          costGrid[idx(nr, nc)] = INF;
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
      if (this.a[p].f <= this.a[i].f) {
        break;
      }
      [this.a[p], this.a[i]] = [this.a[i], this.a[p]];
      i = p;
    }
  }
  _down(i) {
    for (;;) {
      const l = i * 2 + 1,
        r = l + 1;
      let m = i;
      if (l < this.a.length && this.a[l].f < this.a[m].f) {
        m = l;
      }
      if (r < this.a.length && this.a[r].f < this.a[m].f) {
        m = r;
      }
      if (m === i) {
        break;
      }
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
    { dr: -1, dc: -1, cost: 1.4 },
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
    if (closed[cur.i]) {
      continue;
    }
    closed[cur.i] = 1;

    for (const d of dirs) {
      const nr = cur.r + d.dr,
        nc = cur.c + d.dc;
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) {
        continue;
      }
      const ni = idx(nr, nc);
      if (costGrid[ni] === INF) {
        continue;
      }
      if (d.dr !== 0 && d.dc !== 0 && (!isFreeCell(cur.r, nc) || !isFreeCell(nr, cur.c))) {
        continue;
      }
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
  if (inBounds(cell.r, cell.c) && costGrid[idx(cell.r, cell.c)] !== INF) {
    return cell;
  }
  for (let rad = 1; rad < 16; rad++) {
    let best = null;
    let bestDist = Infinity;
    for (let dr = -rad; dr <= rad; dr++) {
      for (let dc = -rad; dc <= rad; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) {
          continue;
        }
        const rr = cell.r + dr,
          cc = cell.c + dc;
        if (!inBounds(rr, cc)) {
          continue;
        }
        if (costGrid[idx(rr, cc)] !== INF) {
          const dist = dr * dr + dc * dc;
          if (dist < bestDist) {
            best = { r: rr, c: cc };
            bestDist = dist;
          }
        }
      }
    }
    if (best) {
      return best;
    }
  }
  return cell;
}

let routeBase = null,
  routeGlow = null,
  routeDots = null,
  routeMarkers = null;
export let routeWorldPoints = null;
let followTimer = null;

function makePolylineCurve(pts) {
  const curve = /** @type {THREE.CurvePath<THREE.Vector3>} */ (new THREE.CurvePath());
  for (let i = 0; i < pts.length - 1; i++) {
    curve.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
  }
  return curve;
}

function makeMarkerTexture(label, sublabel, fill, accent) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = fill;
  roundRect(ctx, 54, 42, 404, 126, 24);
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.lineWidth = 5;
  roundRect(ctx, 64, 52, 384, 106, 18);
  ctx.stroke();

  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(86, 78);
  ctx.lineTo(132, 100);
  ctx.lineTo(86, 122);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 42px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 278, 94);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
  ctx.font = '700 22px Arial, sans-serif';
  ctx.fillText(sublabel, 278, 130);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function disposeMaterial(material) {
  if (Array.isArray(material)) {
    for (const mat of material) {
      disposeMaterial(mat);
    }
    return;
  }
  material.map?.dispose?.();
  material.dispose();
}

function makeEndpointMarker(kind, point, boothNo) {
  const isStart = kind === 'start';
  const group = new THREE.Group();
  const color = isStart ? 0x19c37d : 0xffc247;
  const fill = isStart ? '#087f5b' : '#b7791f';
  const accent = isStart ? '#7cf7c5' : '#fff3bf';

  const poleMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.38,
    metalness: 0.45,
  });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.2, 14), poleMat);
  pole.position.set(0, 1.6, 0);
  group.add(pole);

  const orbMat = new THREE.MeshBasicMaterial({ color });
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 12), orbMat);
  orb.position.set(0, 3.32, 0);
  group.add(orb);

  const texture = makeMarkerTexture(isStart ? 'START' : 'REACHED', boothNo, fill, accent);
  const plaqueMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const plaque = new THREE.Sprite(plaqueMat);
  plaque.position.set(0, 3.55, 0);
  plaque.scale.set(5.2, 2.6, 1);
  plaque.renderOrder = 40;
  group.add(plaque);

  const ringMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.36,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.65, 1.05, 40), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.08;
  group.add(ring);

  group.position.set(point.x, 0.24, point.z);
  group.renderOrder = 30;
  return group;
}

export function clearFollow() {
  if (followTimer) {
    clearTimeout(followTimer);
    followTimer = null;
  }
}

export function clearRoute() {
  clearFollow();
  routeWorldPoints = null;
  if (routeMarkers) {
    scene.remove(routeMarkers);
    routeMarkers.traverse((/** @type {THREE.Object3D} */ child) => {
      const mesh = /** @type {THREE.Mesh | THREE.Sprite} */ (child);
      mesh.geometry?.dispose?.();
      if (mesh.material) {
        disposeMaterial(mesh.material);
      }
    });
    routeMarkers = null;
  }
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

export function drawRoute(worldPoints, endpoints) {
  clearRoute();
  routeWorldPoints = worldPoints;

  const pts = worldPoints.map((p) => new THREE.Vector3(p.x, 0.14, p.z));
  const curve = makePolylineCurve(pts);

  const routeRadius = routeClearanceWorld();
  const baseGeom = new THREE.TubeGeometry(curve, 220, routeRadius, 10, false);
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x07101f,
    roughness: 0.6,
    metalness: 0.2,
    transparent: true,
    opacity: 0.92,
  });
  routeBase = new THREE.Mesh(baseGeom, baseMat);
  routeBase.renderOrder = 10;
  scene.add(routeBase);

  const glowGeom = new THREE.TubeGeometry(curve, 220, routeGlowRadiusWorld(), 10, false);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0x6aa9ff,
    transparent: true,
    opacity: 0.55,
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
    size: Math.max(0.22, routeRadius * 1.35),
    transparent: true,
    opacity: 0.85,
  });
  routeDots = new THREE.Points(dotsGeom, dotsMat);
  routeDots.userData.curve = curve;
  routeDots.userData.dotCount = dotCount;
  scene.add(routeDots);

  if (endpoints) {
    routeMarkers = new THREE.Group();
    routeMarkers.add(makeEndpointMarker('start', endpoints.start, endpoints.startLabel));
    routeMarkers.add(makeEndpointMarker('end', endpoints.end, endpoints.endLabel));
    scene.add(routeMarkers);
  }
}

export function followRoute(points) {
  clearFollow();
  if (
    !(/** @type {HTMLInputElement} */ (document.getElementById('followCam')).checked) ||
    !points ||
    points.length < 3
  ) {
    return;
  }

  const step = Math.max(2, Math.floor(points.length / 14));
  const sampled = [];
  for (let i = 0; i < points.length; i += step) {
    sampled.push(points[i]);
  }
  if (sampled[sampled.length - 1] !== points[points.length - 1]) {
    sampled.push(points[points.length - 1]);
  }

  let i = 0;
  const moveNext = () => {
    if (i >= sampled.length) {
      return;
    }
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
