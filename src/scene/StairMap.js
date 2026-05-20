import { fabricToPixel, pxToWorld } from './CoordTransform.js';
import { worldToCell } from './AStarRoute.js';

/** @type {Record<string, { label: string, type: string, floors: Record<string, { x: number, y: number }> }>} */
let stairMap =
  /** @type {Record<string, { label: string, type: string, floors: Record<string, { x: number, y: number }> }>} */ ({});

/** Fetch all floor JSONs and cross-reference stairs by shared `id`. */
export async function buildStairMap(floorNames) {
  /** @type {Record<string, { label: string, type: string, floors: Record<string, { x: number, y: number }> }>} */
  const map = {};
  for (const name of floorNames) {
    const res = await fetch(`./data/json/${name}.json`);
    const data = await res.json();
    const stairs = data.meta.stairs || [];
    for (const s of stairs) {
      const sid = s.id;
      if (!sid) {continue;}
      if (!map[sid]) {
        map[sid] = {
          label: s.label || sid,
          type: s.type || 'staircase',
          floors: {},
        };
      }
      if (s.position) {
        const entry = map[sid];
        if (entry) {
          entry.floors[name] = { x: s.position.x, y: s.position.y };
        }
      }
    }
  }
  stairMap = map;
  return map;
}

/** Get grid cell for a stair on a specific floor. Requires `initCalibration(data)` to have been called for that floor. */
export function stairToGridCell(stairId, floorName) {
  const stair = stairMap[stairId];
  if (!stair) {return null;}
  const pos = stair.floors[floorName];
  if (!pos) {return null;}
  const { px, py } = fabricToPixel(pos.x, pos.y);
  const { x, z } = pxToWorld(px, py);
  return worldToCell(x, z);
}

/** Get the world position (in scene coords) for a stair on a specific floor. */
export function stairToWorldPos(stairId, floorName) {
  const stair = stairMap[stairId];
  if (!stair) {return null;}
  const pos = stair.floors[floorName];
  if (!pos) {return null;}
  const { px, py } = fabricToPixel(pos.x, pos.y);
  return pxToWorld(px, py);
}

/** Find stair ids that connect two floor names. */
export function findConnectingStairs(floorA, floorB) {
  const result = [];
  for (const [id, stair] of Object.entries(stairMap)) {
    if (stair.floors[floorA] && stair.floors[floorB]) {
      result.push(id);
    }
  }
  return result;
}

export { stairMap };
