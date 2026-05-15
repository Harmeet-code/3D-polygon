import * as THREE from 'three';
import { boothGroup, outlineGroup } from './SceneSetup.js';
import { fabricToPixel, pxToWorld } from './CoordTransform.js';

export const STATUS_COLORS = { AVAILABLE: 0x2ecc71, HOLD: 0xffb020, BOOKED: 0xff5c6a };

function boothColorFromData(b) {
  if (b.boothColor) return parseInt(b.boothColor.slice(1), 16);
  return STATUS_COLORS[b.status] ?? STATUS_COLORS.AVAILABLE;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function heatColor(t) {
  t = Math.max(0, Math.min(1, t));
  let r, g, b;
  if (t < 0.25) {
    const k = t / 0.25;
    r = 0;
    g = lerp(80, 220, k);
    b = 255;
  } else if (t < 0.5) {
    const k = (t - 0.25) / 0.25;
    r = 0;
    g = 255;
    b = lerp(255, 60, k);
  } else if (t < 0.75) {
    const k = (t - 0.5) / 0.25;
    r = lerp(0, 255, k);
    g = 255;
    b = 0;
  } else {
    const k = (t - 0.75) / 0.25;
    r = 255;
    g = lerp(255, 60, k);
    b = 0;
  }
  return (r << 16) | (g << 8) | b;
}

export const boothMeshes = [];
export const boothByNo = new Map();

export function polygonArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i],
      q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

function createSurfaceLabel(boothNo, size, _color) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 6;
  ctx.fillText(boothNo, canvas.width / 2, 34);

  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = 'bold 20px sans-serif';
  ctx.shadowBlur = 4;
  ctx.fillText(size || '', canvas.width / 2, 64);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 1.4), mat);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

export function clearGroup(g) {
  while (g.children.length) {
    const o = g.children.pop();
    if (o.children && o.children.length) clearGroup(o);
    o.geometry?.dispose?.();
    if (o.material) {
      if (o.material.map) o.material.map.dispose();
      o.material.dispose();
    }
  }
}

export function boothMaterialFor(b, heatEnabled) {
  let color = boothColorFromData(b);
  if (heatEnabled) {
    const t = ((+b.price || minPrice) - minPrice) / Math.max(1e-6, maxPrice - minPrice);
    color = heatColor(t);
  }
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.45,
    metalness: 0.12,
    emissive: new THREE.Color(color).multiplyScalar(0.05),
    transparent: true,
    opacity: 0.88
  });
  return mat;
}

export let minPrice, maxPrice;

export function buildBooths(data, heatEnabled) {
  if (minPrice === undefined) {
    minPrice = Math.min(...data.booths.map((b) => +b.price || 0));
    maxPrice = Math.max(...data.booths.map((b) => +b.price || 1));
  }

  boothMeshes.length = 0;
  boothByNo.clear();
  clearGroup(boothGroup);
  clearGroup(outlineGroup);

  for (const b of data.booths) {
    const ptsPix = b.geometry.points.map(([x, y]) => fabricToPixel(x, y));

    const pts2 = ptsPix.map((p) => {
      const w = pxToWorld(p.px, p.py);
      return new THREE.Vector2(w.x, w.z);
    });

    if (pts2.length < 3) continue;
    if (polygonArea(pts2) < 0) pts2.reverse();

    const shape = new THREE.Shape(pts2);
    const h = b.status === 'BOOKED' ? 2.0 : b.status === 'HOLD' ? 1.6 : 1.2;
    const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, steps: 1 });
    geo.rotateX(-Math.PI / 2);

    geo.computeBoundingBox();
    const bb = /** @type {THREE.Box3} */ (geo.boundingBox);
    const c = new THREE.Vector3();
    bb.getCenter(c);
    const minY = bb.min.y;
    geo.translate(-c.x, -minY, -c.z);

    const mesh = new THREE.Mesh(geo, boothMaterialFor(b, heatEnabled));
    mesh.position.set(c.x, 0, c.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.booth = b;
    mesh.userData.center = new THREE.Vector3(mesh.position.x, 0.1, mesh.position.z);

    let labelColor = boothColorFromData(b);
    if (heatEnabled) {
      const t = ((+b.price || minPrice) - minPrice) / Math.max(1e-6, maxPrice - minPrice);
      labelColor = heatColor(t);
    }
    const label = createSurfaceLabel(b.boothNo, b.size, labelColor);
    label.position.set(0, h + 0.01, 0);
    mesh.add(label);

    boothGroup.add(mesh);
    boothMeshes.push(mesh);
    boothByNo.set(b.boothNo, mesh);
  }
}
