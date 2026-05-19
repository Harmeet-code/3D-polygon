import { fabricToPixel, pxToWorld } from './CoordTransform.js';
import { worldToCell, cellToWorld } from './AStarRoute.js';
import { distSqToPolyline } from './PolylineCorridor.js';
import { findConnectingStairs, stairToWorldPos } from './StairMap.js';

const INF = Infinity;
const CELL = 1.2;
const MARGIN = 0.8;

/** @type {Record<string, { costGrid: Float32Array, cols: number, rows: number }>} */
const gridCache = {};

/** Build + cache cost grid for a floor from enriched data alone (no Three.js meshes). */
function cacheFloorGrid(floorName, data) {
  const { minX, minY, maxX, maxY } = data.meta.fabricBounds;
  const c = Math.ceil(80 / CELL);
  const r = Math.ceil(80 / CELL);
  const halfW = 40,
    halfH = 40;

  const costGrid = new Float32Array(r * c).fill(INF);

  // Booth AABBs from geometry data
  for (const b of data.booths) {
    const pts = b.geometry.points.map((/** @type {number[]} */ fp) => {
      const { px, py } = fabricToPixel(fp[0], fp[1]);
      return pxToWorld(px, py);
    });
    let bbMinX = INF,
      bbMaxX = -INF,
      bbMinZ = INF,
      bbMaxZ = -INF;
    for (const p of pts) {
      if (p.x < bbMinX) bbMinX = p.x;
      if (p.x > bbMaxX) bbMaxX = p.x;
      if (p.z < bbMinZ) bbMinZ = p.z;
      if (p.z > bbMaxZ) bbMaxZ = p.z;
    }
    const r0 = Math.max(0, Math.floor((bbMinX - MARGIN + halfW) / CELL));
    const r1 = Math.min(r - 1, Math.floor((bbMaxX + MARGIN + halfW) / CELL));
    const c0 = Math.max(0, Math.floor((halfH - (bbMaxZ + MARGIN)) / CELL));
    const c1 = Math.min(c - 1, Math.floor((halfH - (bbMinZ - MARGIN)) / CELL));

    for (let rr = r0; rr <= r1; rr++) {
      for (let cc = c0; cc <= c1; cc++) {
        costGrid[rr * c + cc] = INF;
      }
    }
  }

  // Road corridor cells → 1.0
  const roads = data.meta.roads || [];
  for (const road of roads) {
    const radius = road.width || 200;
    const worldPts = road.points.map((/** @type {number[]} */ pt) => {
      const { px, py } = fabricToPixel(pt[0], pt[1]);
      return pxToWorld(px, py);
    });
    const polylineWp = worldPts.map((/** @type {{x:number,z:number}} */ wp) => [wp.x, wp.z]);
    const fabricRangeX = maxX - minX;
    const fabricRangeY = maxY - minY;
    const wRadius = radius * ((80 / fabricRangeX + 80 / fabricRangeY) / 2);

    for (let rr = 0; rr < r; rr++) {
      for (let cc = 0; cc < c; cc++) {
        const ni = rr * c + cc;
        if (costGrid[ni] !== INF) continue;
        const x = (cc + 0.5) * CELL - halfW;
        const z = halfH - (rr + 0.5) * CELL;
        if (distSqToPolyline([x, z], polylineWp) <= wRadius * wRadius) {
          costGrid[ni] = 1.0;
        }
      }
    }
  }

  // Stair cells → 1.0 (3x3 area)
  const stairs = data.meta.stairs || [];
  for (const s of stairs) {
    if (s.position) {
      const { px, py } = fabricToPixel(s.position.x, s.position.y);
      const { x, z } = pxToWorld(px, py);
      const cell = worldToCell(x, z);
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const rr = cell.r + dr,
            cc = cell.c + dc;
          if (rr >= 0 && rr < r && cc >= 0 && cc < c) {
            costGrid[rr * c + cc] = 1.0;
          }
        }
      }
    }
  }

  gridCache[floorName] = { costGrid, cols: c, rows: r };
}

/** Inline A* that works on any cost grid. */
function aStarOnGrid(costGrid, cols, rows, start, goal) {
  const idx = (rr, cc) => rr * cols + cc;

  // Binary min-heap
  const heap = [];
  const push = (n) => {
    heap.push(n);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p].f <= heap[i].f) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1,
          r = l + 1;
        let m = i;
        if (l < heap.length && heap[l].f < heap[m].f) m = l;
        if (r < heap.length && heap[r].f < heap[m].f) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };

  const came = new Int32Array(rows * cols).fill(-1);
  const g = new Float32Array(rows * cols).fill(1e9);

  const sIdx = idx(start.r, start.c);
  const gIdx = idx(goal.r, goal.c);
  g[sIdx] = 0;
  push({
    r: start.r,
    c: start.c,
    f: Math.abs(start.r - goal.r) + Math.abs(start.c - goal.c),
    i: sIdx
  });

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

  const heuristic = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.c - b.c);

  while (heap.length) {
    const cur = /** @type {{ r: number; c: number; f: number; i: number }} */ (pop());
    if (cur.i === gIdx) {
      const path = [];
      let at = gIdx;
      while (at !== -1) {
        path.push({ r: Math.floor(at / cols), c: at % cols });
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
        push({ r: nr, c: nc, f: ng + heuristic({ r: nr, c: nc }, goal), i: ni });
      }
    }
  }
  return null;
}

function findNearestFreeOnGrid(costGrid, cols, rows, cell) {
  const inBounds = (r, c) => r >= 0 && c >= 0 && r < rows && c < cols;
  if (inBounds(cell.r, cell.c) && costGrid[cell.r * cols + cell.c] !== INF) return cell;
  for (let rad = 1; rad < 16; rad++) {
    for (let dr = -rad; dr <= rad; dr++) {
      for (let dc = -rad; dc <= rad; dc++) {
        const rr = cell.r + dr,
          cc = cell.c + dc;
        if (!inBounds(rr, cc)) continue;
        if (costGrid[rr * cols + cc] !== INF) return { r: rr, c: cc };
      }
    }
  }
  return cell;
}

/**
 * Multi-floor route: compute path across floors via stair connections.
 * @param {string} startFloor
 * @param {string} startBoothNo
 * @param {string} endFloor
 * @param {string} endBoothNo
 * @param {Record<string, any>} floorDataMap
 * @returns {{segments:Array<{floorName:string,worldPoints:Array<{x:number,z:number}>}>,stairUsed:string|null}|null}
 */
export function multiFloorAStar(startFloor, startBoothNo, endFloor, endBoothNo, floorDataMap) {
  // Ensure grids cached
  for (const [name, data] of Object.entries(floorDataMap)) {
    if (!gridCache[name]) {
      cacheFloorGrid(name, data);
    }
  }

  const startData = floorDataMap[startFloor];
  const endData = floorDataMap[endFloor];
  if (!startData || !endData) return null;

  const startBooth = startData.booths.find(
    (/** @type {{boothNo:string}} */ b) => b.boothNo === startBoothNo
  );
  const endBooth = endData.booths.find(
    (/** @type {{boothNo:string}} */ b) => b.boothNo === endBoothNo
  );
  if (!startBooth || !endBooth) return null;

  const toCell = (fx, fy) => {
    const { px, py } = fabricToPixel(fx, fy);
    const { x, z } = pxToWorld(px, py);
    return worldToCell(x, z);
  };

  const startCell = toCell(startBooth.fabricBBox.x, startBooth.fabricBBox.y);
  const endCell = toCell(endBooth.fabricBBox.x, endBooth.fabricBBox.y);

  if (startFloor === endFloor) {
    const cached = gridCache[startFloor];
    if (!cached) return null;
    const s = findNearestFreeOnGrid(cached.costGrid, cached.cols, cached.rows, startCell);
    const t = findNearestFreeOnGrid(cached.costGrid, cached.cols, cached.rows, endCell);
    const path = aStarOnGrid(cached.costGrid, cached.cols, cached.rows, s, t);
    if (!path) return null;
    const wp = path.map((p) => {
      const w = cellToWorld(p.r, p.c);
      return { x: w.x, z: w.z };
    });
    return { segments: [{ floorName: startFloor, worldPoints: wp }], stairUsed: null };
  }

  // Cross-floor: find connecting stairs
  const stairIds = findConnectingStairs(startFloor, endFloor);
  if (stairIds.length === 0) return null;

  let best = null;
  let bestCost = INF;
  let bestStair = null;

  for (const stairId of stairIds) {
    const stairPos = stairToWorldPos(stairId, startFloor);
    if (!stairPos) continue;
    const stairCell = worldToCell(stairPos.x, stairPos.z);

    const sg = gridCache[startFloor];
    const eg = gridCache[endFloor];
    if (!sg || !eg) continue;

    const s = findNearestFreeOnGrid(sg.costGrid, sg.cols, sg.rows, startCell);
    const sp = findNearestFreeOnGrid(sg.costGrid, sg.cols, sg.rows, stairCell);
    const seg1 = aStarOnGrid(sg.costGrid, sg.cols, sg.rows, s, sp);
    if (!seg1) continue;

    const ep = findNearestFreeOnGrid(eg.costGrid, eg.cols, eg.rows, endCell);
    const es = findNearestFreeOnGrid(eg.costGrid, eg.cols, eg.rows, stairCell);
    const seg2 = aStarOnGrid(eg.costGrid, eg.cols, eg.rows, es, ep);
    if (!seg2) continue;

    const cost = seg1.length + seg2.length + 5;
    if (cost < bestCost) {
      bestCost = cost;
      best = { seg1, seg2 };
      bestStair = stairId;
    }
  }

  if (!best || !bestStair) return null;

  const seg1Wp = best.seg1.map((p) => {
    const w = cellToWorld(p.r, p.c);
    return { x: w.x, z: w.z };
  });
  const seg2Wp = best.seg2.map((p) => {
    const w = cellToWorld(p.r, p.c);
    return { x: w.x, z: w.z };
  });

  return {
    segments: [
      { floorName: startFloor, worldPoints: seg1Wp },
      { floorName: endFloor, worldPoints: seg2Wp }
    ],
    stairUsed: bestStair
  };
}
