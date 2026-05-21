import { fabricToPixel, pxToWorld } from './CoordTransform.js';
import { worldToCell, cellToWorld } from './AStarRoute.js';
import { findConnectingStairs, stairToWorldPos } from './StairMap.js';
import { IMG_W, PLANE_W, PLANE_H } from './SceneSetup.js';

const INF = Infinity;
const CELL = 0.2;
const MIN_ROUTE_WIDTH_OFFSET_PX = 33;

/** @type {Record<string, { costGrid: Float32Array, cols: number, rows: number }>} */
const gridCache = {};

function fabricPointToBoothWorld(x, y) {
  const { px, py } = fabricToPixel(x, y);
  const w = pxToWorld(px, py);
  return { x: w.x, z: -w.z };
}

function routeClearanceWorld() {
  return (MIN_ROUTE_WIDTH_OFFSET_PX / 2) * (PLANE_W / IMG_W);
}

/** Clear the grid cache (call when floor data changes). */
export function clearGridCache() {
  for (const key of Object.keys(gridCache)) {
    delete gridCache[key];
  }
}

/** Build + cache cost grid for a floor using booth blocking + optional zone restriction. */
function cacheFloorGrid(floorName, data) {
  const halfW = PLANE_W / 2;
  const halfH = PLANE_H / 2;
  const c = Math.ceil(PLANE_W / CELL);
  const r = Math.ceil(PLANE_H / CELL);

  // Start with all cells walkable
  const costGrid = new Float32Array(r * c).fill(1.0);

  // Pass 1: Block booth cells using actual polygon geometry
  const blockedSet = new Set();
  for (const b of data.booths) {
    const geo = b.geometry;
    if (!geo || !geo.points || geo.points.length < 3) {
      continue;
    }

    const pts = geo.points.map((/** @type {number[]} */ fp) =>
      fabricPointToBoothWorld(fp[0], fp[1]),
    );

    const toCell = (x, z) => ({
      c: Math.floor((x + halfW) / CELL),
      r: Math.floor((halfH - z) / CELL),
    });
    const cellCenter = (rr, cc) => ({
      x: (cc + 0.5) * CELL - halfW,
      z: halfH - (rr + 0.5) * CELL,
    });

    let minR = r - 1,
      maxR = 0,
      minC = c - 1,
      maxC = 0;
    for (const p of pts) {
      const cell = toCell(p.x, p.z);
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
    maxR = Math.min(r - 1, maxR);
    minC = Math.max(0, minC);
    maxC = Math.min(c - 1, maxC);

    const n = pts.length;
    for (let rr = minR; rr <= maxR; rr++) {
      const y = cellCenter(rr, 0).z;
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
        const cLeft = toCell(left, y).c;
        const cRight = toCell(right, y).c;
        const c0 = Math.max(minC, Math.min(cLeft, cRight));
        const c1 = Math.min(maxC, Math.max(cLeft, cRight));
        for (let cc = c0; cc <= c1; cc++) {
          const key = `${rr},${cc}`;
          if (!blockedSet.has(key)) {
            blockedSet.add(key);
            costGrid[rr * c + cc] = INF;
          }
        }
      }
    }
  }

  // Inflate obstacles by half the minimum corridor width.
  const marginCells = Math.ceil(routeClearanceWorld() / CELL);
  const blockedCells = Array.from(blockedSet).map((k) => {
    const parts = k.split(',');
    return { r: Number(parts[0]), c: Number(parts[1]) };
  });
  for (const { r: rr, c: cc } of blockedCells) {
    for (let dr = -marginCells; dr <= marginCells; dr++) {
      for (let dc = -marginCells; dc <= marginCells; dc++) {
        const nr = rr + dr;
        const nc = cc + dc;
        if (nr >= 0 && nc >= 0 && nr < r && nc < c) {
          costGrid[nr * c + nc] = INF;
        }
      }
    }
  }

  // Pass 2: If walkable zones defined, restrict to zones only
  const zones = data.meta.walkableZones || [];
  if (zones.length > 0) {
    const zoneMask = new Uint8Array(r * c);
    for (const zone of zones) {
      if (zone.type === 'rect') {
        rasterizeRectZoneMask(zone, zoneMask, c, r, halfW, halfH);
      } else if (zone.type === 'polygon') {
        rasterizePolygonZoneMask(zone, zoneMask, c, r, halfW, halfH);
      }
    }
    for (let i = 0; i < costGrid.length; i++) {
      if (zoneMask[i] === 0) {
        costGrid[i] = INF;
      }
    }
  }

  // Debug count
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
    `[MultiFloorRoute] Grid for ${floorName}: ${r}x${c}, walkable=${walkable}, blocked=${blocked}`,
  );

  gridCache[floorName] = { costGrid, cols: c, rows: r };
}

/** Mark all cells inside a rect zone as covered in mask. */
function rasterizeRectZoneMask(zone, mask, cols, rows, halfW, halfH) {
  const { x: fx, y: fy, w: fw, h: fh } = zone;
  const p1 = fabricToPixel(fx, fy);
  const p2 = fabricToPixel(fx + fw, fy + fh);
  const w1 = pxToWorld(p1.px, p1.py);
  const w2 = pxToWorld(p2.px, p2.py);

  const minX = Math.min(w1.x, w2.x);
  const maxX = Math.max(w1.x, w2.x);
  const minZ = Math.min(w1.z, w2.z);
  const maxZ = Math.max(w1.z, w2.z);

  const toCell = (x, z) => ({
    c: Math.floor((x + halfW) / CELL),
    r: Math.floor((halfH - z) / CELL),
  });

  const a = toCell(minX, maxZ);
  const b = toCell(maxX, minZ);

  const r0 = Math.max(0, Math.min(a.r, b.r));
  const r1 = Math.min(rows - 1, Math.max(a.r, b.r));
  const c0 = Math.max(0, Math.min(a.c, b.c));
  const c1 = Math.min(cols - 1, Math.max(a.c, b.c));

  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      mask[r * cols + c] = 1;
    }
  }
}

/** Mark all cells inside a polygon zone as covered in mask using scanline fill. */
function rasterizePolygonZoneMask(zone, mask, cols, rows, halfW, halfH) {
  const pts = zone.points.map((/** @type {number[]} */ fp) => {
    const { px, py } = fabricToPixel(fp[0], fp[1]);
    return pxToWorld(px, py);
  });
  if (pts.length < 3) {
    return;
  }

  const toCell = (x, z) => ({
    c: Math.floor((x + halfW) / CELL),
    r: Math.floor((halfH - z) / CELL),
  });
  const cellCenter = (rr, cc) => ({
    x: (cc + 0.5) * CELL - halfW,
    z: halfH - (rr + 0.5) * CELL,
  });

  let minR = rows - 1,
    maxR = 0,
    minC = cols - 1,
    maxC = 0;
  for (const p of pts) {
    const cell = toCell(p.x, p.z);
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
    const y = cellCenter(r, 0).z;
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
      const cLeft = toCell(left, y).c;
      const cRight = toCell(right, y).c;
      const c0 = Math.max(minC, Math.min(cLeft, cRight));
      const c1 = Math.min(maxC, Math.max(cLeft, cRight));
      for (let c = c0; c <= c1; c++) {
        mask[r * cols + c] = 1;
      }
    }
  }
}

/** Inline A* that works on any cost grid. */
function aStarOnGrid(costGrid, cols, rows, start, goal) {
  const idx = (rr, cc) => rr * cols + cc;
  const isFreeCell = (rr, cc) =>
    rr >= 0 && cc >= 0 && rr < rows && cc < cols && costGrid[idx(rr, cc)] !== INF;

  // Binary min-heap
  const heap = [];
  const push = (n) => {
    heap.push(n);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p].f <= heap[i].f) {
        break;
      }
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
        if (l < heap.length && heap[l].f < heap[m].f) {
          m = l;
        }
        if (r < heap.length && heap[r].f < heap[m].f) {
          m = r;
        }
        if (m === i) {
          break;
        }
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
    i: sIdx,
  });

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
        push({ r: nr, c: nc, f: ng + heuristic({ r: nr, c: nc }, goal), i: ni });
      }
    }
  }
  return null;
}

function findNearestFreeOnGrid(costGrid, cols, rows, cell) {
  const inBounds = (r, c) => r >= 0 && c >= 0 && r < rows && c < cols;
  if (inBounds(cell.r, cell.c) && costGrid[cell.r * cols + cell.c] !== INF) {
    return cell;
  }
  for (let rad = 1; rad < 16; rad++) {
    for (let dr = -rad; dr <= rad; dr++) {
      for (let dc = -rad; dc <= rad; dc++) {
        const rr = cell.r + dr,
          cc = cell.c + dc;
        if (!inBounds(rr, cc)) {
          continue;
        }
        if (costGrid[rr * cols + cc] !== INF) {
          return { r: rr, c: cc };
        }
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
  if (!startData || !endData) {
    return null;
  }

  const startBooth = startData.booths.find(
    (/** @type {{boothNo:string}} */ b) => b.boothNo === startBoothNo,
  );
  const endBooth = endData.booths.find(
    (/** @type {{boothNo:string}} */ b) => b.boothNo === endBoothNo,
  );
  if (!startBooth || !endBooth) {
    return null;
  }

  const toCell = (fx, fy) => {
    const { x, z } = fabricPointToBoothWorld(fx, fy);
    return worldToCell(x, z);
  };

  const startCell = toCell(startBooth.fabricBBox.x, startBooth.fabricBBox.y);
  const endCell = toCell(endBooth.fabricBBox.x, endBooth.fabricBBox.y);

  if (startFloor === endFloor) {
    const cached = gridCache[startFloor];
    if (!cached) {
      return null;
    }
    const s = findNearestFreeOnGrid(cached.costGrid, cached.cols, cached.rows, startCell);
    const t = findNearestFreeOnGrid(cached.costGrid, cached.cols, cached.rows, endCell);
    const path = aStarOnGrid(cached.costGrid, cached.cols, cached.rows, s, t);
    if (!path) {
      return null;
    }
    const wp = path.map((p) => {
      const w = cellToWorld(p.r, p.c);
      return { x: w.x, z: w.z };
    });
    return { segments: [{ floorName: startFloor, worldPoints: wp }], stairUsed: null };
  }

  // Cross-floor: find connecting stairs
  const stairIds = findConnectingStairs(startFloor, endFloor);
  if (stairIds.length === 0) {
    return null;
  }

  let best = null;
  let bestCost = INF;
  let bestStair = null;

  for (const stairId of stairIds) {
    const stairPos = stairToWorldPos(stairId, startFloor);
    if (!stairPos) {
      continue;
    }
    const stairCell = worldToCell(stairPos.x, stairPos.z);

    const sg = gridCache[startFloor];
    const eg = gridCache[endFloor];
    if (!sg || !eg) {
      continue;
    }

    const s = findNearestFreeOnGrid(sg.costGrid, sg.cols, sg.rows, startCell);
    const sp = findNearestFreeOnGrid(sg.costGrid, sg.cols, sg.rows, stairCell);
    const seg1 = aStarOnGrid(sg.costGrid, sg.cols, sg.rows, s, sp);
    if (!seg1) {
      continue;
    }

    const ep = findNearestFreeOnGrid(eg.costGrid, eg.cols, eg.rows, endCell);
    const es = findNearestFreeOnGrid(eg.costGrid, eg.cols, eg.rows, stairCell);
    const seg2 = aStarOnGrid(eg.costGrid, eg.cols, eg.rows, es, ep);
    if (!seg2) {
      continue;
    }

    const cost = seg1.length + seg2.length + 5;
    if (cost < bestCost) {
      bestCost = cost;
      best = { seg1, seg2 };
      bestStair = stairId;
    }
  }

  if (!best || !bestStair) {
    return null;
  }

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
      { floorName: endFloor, worldPoints: seg2Wp },
    ],
    stairUsed: bestStair,
  };
}
