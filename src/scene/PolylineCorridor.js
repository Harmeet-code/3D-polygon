const EPS = 1e-8;

function normalize(v) {
  const vx = /** @type {number} */ (v[0]);
  const vy = /** @type {number} */ (v[1]);
  const len = Math.hypot(vx, vy);
  if (len < EPS) return [0, 0];
  return [vx / len, vy / len];
}

function perp(v) {
  const v0 = /** @type {number} */ (v[0]);
  const v1 = /** @type {number} */ (v[1]);
  return [-v1, v0];
}

function sub(a, b) {
  const a0 = /** @type {number} */ (a[0]);
  const a1 = /** @type {number} */ (a[1]);
  const b0 = /** @type {number} */ (b[0]);
  const b1 = /** @type {number} */ (b[1]);
  return [a0 - b0, a1 - b1];
}

function add(a, b) {
  const a0 = /** @type {number} */ (a[0]);
  const a1 = /** @type {number} */ (a[1]);
  const b0 = /** @type {number} */ (b[0]);
  const b1 = /** @type {number} */ (b[1]);
  return [a0 + b0, a1 + b1];
}

function dot(a, b) {
  const a0 = /** @type {number} */ (a[0]);
  const a1 = /** @type {number} */ (a[1]);
  const b0 = /** @type {number} */ (b[0]);
  const b1 = /** @type {number} */ (b[1]);
  return a0 * b0 + a1 * b1;
}

function lerp(a, b, t) {
  const a0 = /** @type {number} */ (a[0]);
  const a1 = /** @type {number} */ (a[1]);
  const b0 = /** @type {number} */ (b[0]);
  const b1 = /** @type {number} */ (b[1]);
  return [a0 + (b0 - a0) * t, a1 + (b1 - a1) * t];
}

function segDistSq(p, a, b) {
  const ab = sub(b, a);
  const ap = sub(p, a);
  const abDot = dot(ab, ab);
  const t = dot(ap, ab) / (abDot + EPS);
  const tClamped = Math.max(0, Math.min(1, t));
  const cp = lerp(a, b, tClamped);
  const dx = /** @type {number} */ (cp[0]) - /** @type {number} */ (p[0]);
  const dy = /** @type {number} */ (cp[1]) - /** @type {number} */ (p[1]);
  return dx * dx + dy * dy;
}

/** Offset polyline `points` (fabric coords) by `radius` per side, forming a closed corridor polygon with miter joints. Returns array of [x,y] vertices. */
export function polylineToCorridor(points, radius) {
  if (points.length < 2) return [];

  const n = points.length;
  const lefts = [];
  const rights = [];

  for (let i = 0; i < n; i++) {
    const p = /** @type {[number, number]} */ (points[i]);
    const prev = i > 0 ? normalize(sub(p, /** @type {[number, number]} */ (points[i - 1]))) : null;
    const next =
      i < n - 1 ? normalize(sub(/** @type {[number, number]} */ (points[i + 1]), p)) : null;

    let nml;
    if (prev && next) {
      const avgDir = normalize(add(prev, next));
      const ad0 = /** @type {number} */ (avgDir[0]);
      const ad1 = /** @type {number} */ (avgDir[1]);
      if (Math.hypot(ad0, ad1) < EPS) {
        nml = perp(prev);
      } else {
        const miter = perp(avgDir);
        const m0 = /** @type {number} */ (miter[0]);
        const m1 = /** @type {number} */ (miter[1]);
        const ml = radius / Math.max(EPS, dot(miter, perp(prev)));
        lefts.push([p[0] + m0 * ml, p[1] + m1 * ml]);
        rights.push([p[0] - m0 * ml, p[1] - m1 * ml]);
        continue;
      }
    } else {
      const dir = /** @type {number[]} */ (prev || next);
      nml = perp(dir);
    }

    const nml0 = /** @type {number} */ (nml[0]);
    const nml1 = /** @type {number} */ (nml[1]);
    lefts.push([p[0] + nml0 * radius, p[1] + nml1 * radius]);
    rights.push([p[0] - nml0 * radius, p[1] - nml1 * radius]);
  }

  return [...lefts, ...rights.reverse()];
}

/** Compute squared distance from point `p` to a polyline defined by `points`. */
export function distSqToPolyline(p, points) {
  let minSq = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const a = /** @type {[number, number]} */ (points[i]);
    const b = /** @type {[number, number]} */ (points[i + 1]);
    const d = segDistSq(p, a, b);
    if (d < minSq) minSq = d;
  }
  return minSq;
}
