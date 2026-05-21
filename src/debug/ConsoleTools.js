// import * as THREE from 'three';
import { renderer, floor, IMG_W, IMG_H, PLANE_W, PLANE_H } from '../scene/SceneSetup.js';
import {
  fabricToPixel,
  pxToWorld,
  readCal,
  fb,
  baseScaleX,
  baseScaleY,
} from '../scene/CoordTransform.js';
import { boothMeshes, boothByNo } from '../scene/BoothBuilder.js';

export function initConsoleTools(data) {
  /** @type {any} */
  window.DEBUG = {
    checkBoothPolygon(boothNo) {
      const b = data.booths.find((x) => x.boothNo === boothNo);
      if (!b) {
        console.error('Booth not found:', boothNo);
        return;
      }
      const bbox = b.fabricBBox;
      const pts = b.geometry.points;
      // console.group(`Booth ${boothNo} Polygon Check`);
      // console.log('Points:', pts);
      // console.log('BBox from JSON:', bbox);
      let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity;
      pts.forEach((p) => {
        minX = Math.min(minX, p[0]);
        maxX = Math.max(maxX, p[0]);
        minY = Math.min(minY, p[1]);
        maxY = Math.max(maxY, p[1]);
      });
      const calcW = maxX - minX,
        calcH = maxY - minY;
      console.log('Calculated:', { minX, minY, maxX, maxY, w: calcW, h: calcH });
      if (Math.abs(calcW - bbox.w) < 0.1 && Math.abs(calcH - bbox.h) < 0.1) {
        // console.log('BBox matches! Polygon is valid.');
      } else {
        console.warn('BBox mismatch! Polygon data may be corrupted.');
      }
      console.groupEnd();
    },

    traceTransform(boothNo) {
      const b = data.booths.find((x) => x.boothNo === boothNo);
      if (!b) {
        console.error('Booth not found:', boothNo);
        return;
      }
      const pt = b.geometry.points[0];
      // console.group(`Transform Pipeline: ${boothNo} [${pt[0]}, ${pt[1]}]`);
      // console.log('Fabric Coords (from JSON):', pt);
      const pixPt = fabricToPixel(pt[0], pt[1]);
      // console.log(`Pixel Coords:`, pixPt, `(image is ${IMG_W}x${IMG_H})`);
      const worldPt = pxToWorld(pixPt.px, pixPt.py);
      console.log(
        `World Coords:`,
        worldPt,
        `(plane is ${PLANE_W.toFixed(1)}x${PLANE_H.toFixed(1)})`,
      );
      console.log('Calibration values:', readCal());
      console.groupEnd();
    },

    compareBooths(boothNos = ['P18', 'P19', 'P66', 'NE4']) {
      console.group('Multi-Booth Comparison');
      boothNos.forEach((no) => {
        const b = data.booths.find((x) => x.boothNo === no);
        if (!b) {
          return;
        }
        const pt = b.geometry.points[0];
        const pix = fabricToPixel(pt[0], pt[1]);
        const world = pxToWorld(pix.px, pix.py);
        console.log(
          `${no}: fabric[${pt[0]},${pt[1]}] pixel[${pix.px.toFixed(0)},${pix.py.toFixed(0)}] world[${world.x.toFixed(2)},${world.z.toFixed(2)}]`,
        );
      });
      console.groupEnd();
    },

    compareBooaths(boothNos = ['P18', 'P19', 'P66', 'NE4']) {
      return this.compareBooths(boothNos);
    },

    showImageInfo() {
      // console.group('Image Info');
      const floorTex = /** @type {import('three').MeshStandardMaterial} */ (floor.material).map;
      const image = /** @type {HTMLImageElement|undefined} */ (floorTex?.image);
      const cal = readCal();
      const info = {
        imageFile: data.meta.image,
        textureWidth: IMG_W,
        textureHeight: IMG_H,
        naturalWidth: image?.naturalWidth ?? image?.width ?? null,
        naturalHeight: image?.naturalHeight ?? image?.height ?? null,
        planeWidth: PLANE_W,
        planeHeight: PLANE_H,
        imageAspect: IMG_W / IMG_H,
        planeAspect: PLANE_W / PLANE_H,
        fabricBounds: {
          minX: fb.minX,
          maxX: fb.maxX,
          minY: fb.minY,
          maxY: fb.maxY,
          width: fb.maxX - fb.minX,
          height: fb.maxY - fb.minY,
        },
        baseScale: { x: baseScaleX, y: baseScaleY },
        calibration: cal,
        effectiveScale: { x: baseScaleX * cal.scaleX, y: baseScaleY * cal.scaleY },
        rendererCanvas: {
          width: renderer.domElement.width,
          height: renderer.domElement.height,
          cssWidth: renderer.domElement.clientWidth,
          cssHeight: renderer.domElement.clientHeight,
          devicePixelRatio: renderer.getPixelRatio(),
        },
      };
      console.table({
        texture: `${info.textureWidth} x ${info.textureHeight}`,
        natural: `${info.naturalWidth} x ${info.naturalHeight}`,
        plane: `${info.planeWidth.toFixed(2)} x ${info.planeHeight.toFixed(2)}`,
        fabric: `${info.fabricBounds.width.toFixed(2)} x ${info.fabricBounds.height.toFixed(2)}`,
        baseScale: `${info.baseScale.x.toFixed(6)}, ${info.baseScale.y.toFixed(6)}`,
        calibration: `offset ${cal.offsetX}, ${cal.offsetY}; scale ${cal.scaleX.toFixed(3)}, ${cal.scaleY.toFixed(3)}`,
        effectiveScale: `${info.effectiveScale.x.toFixed(6)}, ${info.effectiveScale.y.toFixed(6)}`,
      });
      console.log('Raw info object:', info);
      // console.log('IMG_W / IMG_H from code:', { IMG_W, IMG_H });
      console.groupEnd();
      return info;
    },

    getImageInfo() {
      return this.showImageInfo();
    },

    getBoothBox(boothNo) {
      const b = data.booths.find((x) => x.boothNo === boothNo);
      if (!b) {
        console.error('Booth not found:', boothNo);
        return null;
      }
      const pixels = b.geometry.points.map(([x, y]) => fabricToPixel(x, y));
      const worlds = pixels.map((p) => pxToWorld(p.px, p.py));
      const box = {
        boothNo,
        pixel: {
          minX: Math.min(...pixels.map((p) => p.px)),
          maxX: Math.max(...pixels.map((p) => p.px)),
          minY: Math.min(...pixels.map((p) => p.py)),
          maxY: Math.max(...pixels.map((p) => p.py)),
        },
        world: {
          minX: Math.min(...worlds.map((p) => p.x)),
          maxX: Math.max(...worlds.map((p) => p.x)),
          minZ: Math.min(...worlds.map((p) => p.z)),
          maxZ: Math.max(...worlds.map((p) => p.z)),
        },
        calibration: readCal(),
      };
      // console.log(`Booth ${boothNo} projected box:`, box);
      return box;
    },

    checkImageBounds(boothNos = ['T1', 'T2', 'P18', 'NE4']) {
      const rows = boothNos
        .map((no) => {
          const box = this.getBoothBox(no);
          if (!box) {
            return null;
          }
          return {
            booth: no,
            pxMinX: box.pixel.minX.toFixed(1),
            pxMaxX: box.pixel.maxX.toFixed(1),
            pxMinY: box.pixel.minY.toFixed(1),
            pxMaxY: box.pixel.maxY.toFixed(1),
            insideImage:
              box.pixel.minX >= 0 &&
              box.pixel.maxX <= IMG_W &&
              box.pixel.minY >= 0 &&
              box.pixel.maxY <= IMG_H,
          };
        })
        .filter(Boolean);
      // console.table(rows);
      return rows;
    },

    showFabricImageMapping() {
      const cal = readCal();
      const mapping = {
        image: { width: IMG_W, height: IMG_H },
        mappedFabricRect: {
          left: cal.offsetX,
          right: (fb.maxX - fb.minX) * baseScaleX * cal.scaleX + cal.offsetX,
          top: cal.offsetY,
          bottom: (fb.maxY - fb.minY) * baseScaleY * cal.scaleY + cal.offsetY,
        },
        calibration: cal,
      };
      mapping.mappedFabricRect.width =
        mapping.mappedFabricRect.right - mapping.mappedFabricRect.left;
      mapping.mappedFabricRect.height =
        mapping.mappedFabricRect.bottom - mapping.mappedFabricRect.top;
      if (!mapping.mappedFabricRect.marginsPx) {
        mapping.mappedFabricRect.marginsPx = {};
      }
      // console.log('Fabric bounds mapped into image pixels:', mapping);
      return mapping;
    },

    logConsoleHelp() {
      // console.log(
      //   `Use these in DevTools Console:\n${window.DEBUG.showImageInfo()}`,
      //   `\n${window.DEBUG.getBoothBox('T2')}`,
      //   `\n${window.DEBUG.checkImageBounds(['T1', 'T2', 'P18'])}`,
      //   `\n${window.DEBUG.traceTransform('T2')}`,
      //   `\n${window.AUDIT.runAll()}`,
      //   `\n${window.AUDIT.auditBoothTransformation('T2')}`,
      // );
    },

    suggestCalibration() {
      // console.group('Calibration Suggestions');
      // console.log('Current calibration:', readCal());
      // console.log(
      //   [
      //     'To adjust:',
      //     '- If 3D blocks are shifted RIGHT, decrease Offset X',
      //     '- If 3D blocks are shifted LEFT, increase Offset X',
      //     '- If 3D blocks are shifted DOWN, decrease Offset Y',
      //     '- If 3D blocks are shifted UP, increase Offset Y',
      //     '- If 3D blocks are too wide, decrease Scale X',
      //     '- If 3D blocks are too narrow, increase Scale X',
      //     '- If 3D blocks are too tall, decrease Scale Y',
      //     '- If 3D blocks are too short, increase Scale Y',
      //     "\nTry: DEBUG.traceTransform('P18') to see exact values",
      //   ].join('\n'),
      // );
      console.groupEnd();
    },
  };

  /** @type {any} */
  window.AUDIT = {
    auditFloorPlane() {
      // console.group('Floor Plane Audit');
      // console.log('Plane dimensions:', {
      //   width: PLANE_W,
      //   height: PLANE_H,
      //   aspectRatio: (PLANE_W / PLANE_H).toFixed(3),
      // });
      // console.log('Image info:', { width: IMG_W, height: IMG_H });
      // console.log('Position:', { x: floor.position.x, y: floor.position.y, z: floor.position.z });
      // console.log('Geometry extent (from vertices):');

      const geo = floor.geometry;
      geo.computeBoundingBox();
      const box = /** @type {THREE.Box3} */ (geo.boundingBox);
      console.log('  min:', {
        x: box.min.x.toFixed(2),
        y: box.min.y.toFixed(2),
        z: box.min.z.toFixed(2),
      });
      console.log('  max:', {
        x: box.max.x.toFixed(2),
        y: box.max.y.toFixed(2),
        z: box.max.z.toFixed(2),
      });
      console.log('  center:', {
        x: ((box.max.x + box.min.x) / 2).toFixed(4),
        y: ((box.max.y + box.min.y) / 2).toFixed(4),
        z: ((box.max.z + box.min.z) / 2).toFixed(4),
      });
      console.log('Floor plane is centered at origin');
      console.groupEnd();
    },

    auditCoordinateTransforms() {
      console.group('Coordinate Transform Audit');
      console.log('Scaling factors:', {
        baseScaleX: baseScaleX.toFixed(6),
        baseScaleY: baseScaleY.toFixed(6),
      });
      console.log('Fabric bounds:', {
        minX: fb.minX,
        maxX: fb.maxX,
        minY: fb.minY,
        maxY: fb.maxY,
        width: (fb.maxX - fb.minX).toFixed(2),
        height: (fb.maxY - fb.minY).toFixed(2),
      });
      // console.log('Image dimensions:', { width: IMG_W, height: IMG_H });
      // console.log('Scale calculation verify:');
      // console.log(
      //   `  ${IMG_W} / ${(fb.maxX - fb.minX).toFixed(2)} = ${(IMG_W / (fb.maxX - fb.minX)).toFixed(6)}`,
      // );
      // console.log(
      //   `  ${IMG_H} / ${(fb.maxY - fb.minY).toFixed(2)} = ${(IMG_H / (fb.maxY - fb.minY)).toFixed(6)}`,
      // );
      console.groupEnd();
    },

    auditBoothTransformation(boothNo) {
      const b = data.booths.find((x) => x.boothNo === boothNo);
      if (!b) {
        console.error('Booth not found:', boothNo);
        return;
      }
      // console.group(`Booth Transformation Audit: ${boothNo}`);

      b.geometry.points.forEach((pt, i) => {
        const pixPt = fabricToPixel(pt[0], pt[1]);
        const worldPt = pxToWorld(pixPt.px, pixPt.py);
        console.group(`  Corner ${i + 1}`);
        console.log(`Fabric:  [${pt[0].toFixed(2)}, ${pt[1].toFixed(2)}]`);
        console.log(`Pixel:   [${pixPt.px.toFixed(1)}, ${pixPt.py.toFixed(1)}]`);
        console.log(`World:   [${worldPt.x.toFixed(3)}, ${worldPt.z.toFixed(3)}]`);
        console.groupEnd();
      });

      const mesh = boothByNo.get(boothNo);
      if (mesh) {
        // console.log('Mesh in scene:');
        // console.log(
        //   `  Position: [${mesh.position.x.toFixed(3)}, ${mesh.position.y.toFixed(3)}, ${mesh.position.z.toFixed(3)}]`,
        // );
        if (mesh.userData.center) {
          // console.log(
          //   `  Stored center: [${mesh.userData.center.x.toFixed(3)}, ${mesh.userData.center.y.toFixed(3)}, ${mesh.userData.center.z.toFixed(3)}]`,
          // );
        }
        mesh.geometry.computeBoundingBox();
        const bb = /** @type {THREE.Box3} */ (mesh.geometry.boundingBox);
        console.log(
          `  Geometry X/Z center: [${((bb.max.x + bb.min.x) / 2).toFixed(4)}, ${((bb.max.z + bb.min.z) / 2).toFixed(4)}]`,
        );
        console.log(`  Geometry Y extent: [${bb.min.y.toFixed(4)}, ${bb.max.y.toFixed(4)}]`);
      }
      console.groupEnd();
    },

    auditAllBoothCentering() {
      console.group('All Booth Centering Audit');
      let centersCorrect = true;
      boothMeshes.forEach((mesh) => {
        mesh.geometry.computeBoundingBox();
        const bb = /** @type {THREE.Box3} */ (mesh.geometry.boundingBox);
        const cx = (bb.max.x + bb.min.x) / 2;
        const cz = (bb.max.z + bb.min.z) / 2;
        if (Math.abs(cx) > 0.001 || Math.abs(cz) > 0.001 || bb.min.y < -0.001) {
          console.warn(
            `${mesh.userData.booth.boothNo}: geometry not placed correctly! centerXZ=[${cx.toFixed(4)}, ${cz.toFixed(4)}], yMin=${bb.min.y.toFixed(4)}`,
          );
          centersCorrect = false;
        }
      });
      if (centersCorrect) {
        console.log(
          `All ${boothMeshes.length} booths are centered on X/Z and sit above the floor plane`,
        );
      }
      console.groupEnd();
    },

    auditWindingOrder() {
      console.group('Winding Order Audit');
      let windingIssues = 0;
      data.booths.forEach((b) => {
        const pts = b.geometry.points;
        if (pts.length < 3) {
          return;
        }
        let area = 0;
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i],
            q = pts[(i + 1) % pts.length];
          area += p[0] * q[1] - q[0] * p[1];
        }
        area /= 2;
        const pix = pts.map((pt) => fabricToPixel(pt[0], pt[1]));
        const world = pix.map((p) => pxToWorld(p.px, p.py));
        let area3d = 0;
        for (let i = 0; i < world.length; i++) {
          const p = world[i],
            q = world[(i + 1) % world.length];
          area3d += p.x * q.z - q.x * p.z;
        }
        area3d /= 2;
        if (Math.sign(area) === Math.sign(area3d)) {
          // console.warn(
          //   `${b.boothNo}: winding sign did not flip as expected during image-to-world transform`,
          // );
          windingIssues++;
        }
      });
      if (windingIssues === 0) {
        console.log(`All ${data.booths.length} booths maintain consistent winding order`);
      } else {
        console.warn(`${windingIssues} booths have winding order issues`);
      }
      console.groupEnd();
    },

    runAll() {
      // console.log('COMPLETE COORDINATE SYSTEM AUDIT');
      this.auditFloorPlane();
      this.auditCoordinateTransforms();
      this.auditAllBoothCentering();
      this.auditWindingOrder();
      // console.log('All systems nominal!');
      // console.log("Try: AUDIT.auditBoothTransformation('P18')");
    },
  };

  // console.log(
  //   `DEBUG UTILITIES\n${window.DEBUG.showImageInfo()}\n${window.DEBUG.traceTransform(
  //     'P18',
  //   )}\n${window.DEBUG.checkBoothPolygon('P18')}\n${window.DEBUG.compareBooths()}\n` +
  //     `AUDIT UTILITIES\n${window.AUDIT.runAll()}\n${window.AUDIT.auditBoothTransformation('P18')}`,
  // );
}
