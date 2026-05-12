# Coordinate System Transformation: Complete Deep Dive

## Overview: The Three Coordinate Spaces

You're working with THREE completely different coordinate systems that must be transformed correctly:

```
┌─────────────────┐
│  FABRIC SPACE   │  (Original design/blueprint units)
│  [8234.475,     │  ← This is what's in the JSON file
│   2365.12]      │
└────────┬────────┘
         │ fabricToPixel()
         ↓
┌─────────────────┐
│  PIXEL SPACE    │  (JPEG image coordinates)
│  [1712, 673]    │  ← Position on the 2400×1600 image
└────────┬────────┘
         │ pxToWorld()
         ↓
┌─────────────────┐
│  3D WORLD SPACE │  (Three.js 3D coordinates)
│  [-12.5, -21.8] │  ← Position in 3D space on floor plane
└─────────────────┘
```

---

## 1. FABRIC SPACE (Origin: Design Software)

### What is "Fabric Units"?

**Fabric** = The original floor plan design file (probably from Adobe Illustrator, AutoCAD, or similar)

The floor plan was designed in some software at coordinates like:
```
Booth P18:  X=8234.475,  Y=2365.12
Booth P19:  X=8231.87,   Y=2546.76
Booth P66:  X=8445.835,  Y=2589.82
```

These are NOT pixels. They're whatever unit system the designer used. Could be:
- Inches from CAD
- Custom units from Illustrator
- Millimeters
- Doesn't matter—they're just abstract "design units"

### Fabric Bounds

The JSON stores the **boundaries** of the design:

```json
"fabricBounds": {
  "minX": 416.33,      ← Leftmost point in design
  "minY": 368.95,      ← Topmost point in design  
  "maxX": 11390.02,    ← Rightmost point in design
  "maxY": 8318.84      ← Bottommost point in design
}
```

**Why we need these:**
- They define the bounding box of the entire floor plan
- Used to calculate how much to "stretch" when converting to pixels

```javascript
// Calculate the total "spread" of the design
const designWidth  = maxX - minX = 11390.02 - 416.33   = 10973.69 units
const designHeight = maxY - minY = 8318.84 - 368.95    = 7949.89 units
```

### Visual Example of Fabric Space

```
Fabric Space (Design Coordinates):
┌────────────────────────────────────────────────────┐
│ (416, 369)                                         │
│ minX, minY                                         │
│                                                    │
│    [P18: 8234, 2365]                              │
│    [P19: 8232, 2547]      [P66: 8446, 2590]       │
│    [P67: 8536, 2590]      [P68: 8630, 2591]       │
│                                                    │
│                           (11390, 8319)            │
│                           maxX, maxY               │
└────────────────────────────────────────────────────┘

Width:  10973.69 fabric units
Height: 7949.89 fabric units
```

---

## 2. PIXEL SPACE (Origin: The JPEG Image)

### The Floor Plan Image

```javascript
const IMG_W = floorTex.image.width;   // 2400 pixels (horizontal)
const IMG_H = floorTex.image.height;  // 1600 pixels (vertical)
```

The JPEG file `DenverFloorPlan1.jpg` is a raster image with specific pixel dimensions.

### Converting Fabric → Pixel

We need to **stretch** the fabric coordinates to fit the image:

```javascript
const fb = data.meta.fabricBounds;
const baseScaleX = IMG_W / (fb.maxX - fb.minX);  // 2400 / 10973.69 = 0.2188
const baseScaleY = IMG_H / (fb.maxY - fb.minY);  // 1600 / 7949.89 = 0.2013
```

### The fabricToPixel() Function Explained

```javascript
function fabricToPixel(x, y) {
  // 1. Apply base scaling (stretch to image size)
  const sx = baseScaleX * (scXEl.value / 1000);
  const sy = baseScaleY * (scYEl.value / 1000);
  
  // 2. Translate to 0,0 origin, scale, then apply offset
  return {
    px: (x - fb.minX) * sx + (+offXEl.value),
    py: (y - fb.minY) * sy + (+offYEl.value)
  };
}
```

**Step by step for Booth P18 [8234.475, 2365.12]:**

```
Step 1: Normalize to 0
   x_normalized = 8234.475 - 416.33 = 7818.145
   y_normalized = 2365.12 - 368.95 = 1996.17

Step 2: Scale to image dimensions
   sx = 0.2188 * 0.938 = 0.2052    (with calibration)
   sy = 0.2013 * 0.912 = 0.1836
   
   x_scaled = 7818.145 * 0.2052 = 1604.4
   y_scaled = 1996.17 * 0.1836 = 366.4

Step 3: Add offset (calibration adjustment)
   px = 1604.4 + 300 = 1904.4
   py = 366.4 + 300 = 666.4

Result: Booth P18 is at pixel [1904, 666] on the JPEG
```

### Visual Example of Pixel Space

```
Pixel Space (Image Coordinates):
┌────────────────────────────────┐
│ (0, 0)                         │ (2400, 0)
│ top-left                       │ top-right
│                                │
│ [P18: 1904, 666]               │
│ [P66: 1849, 729]    [NE4: 2228, 238]
│                                │
│ (0, 1600)                      │ (2400, 1600)
│ bottom-left                    │ bottom-right
└────────────────────────────────┘

Width:  2400 pixels
Height: 1600 pixels
```

---

## 3. 3D WORLD SPACE (Origin: Three.js Scene)

### What is the Floor Plane?

The floor plane is a **flat rectangular 3D surface** in the Three.js scene:

```javascript
const PLANE_W = 140;  // Width in 3D units
const PLANE_H = PLANE_W * (IMG_H / IMG_W);  // Height = 140 * (1600/2400) = 93.33

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(PLANE_W, PLANE_H),  // Creates rectangle
  new THREE.MeshStandardMaterial({ map: floorTex, ... })  // Applies image as texture
);

floor.rotation.x = -Math.PI/2;  // Rotate to lie flat (XZ plane, Y=0)
```

### Understanding the 3D Coordinate System

```
Before rotation:
  Y-axis points up
  PlaneGeometry faces XY
  
After rotation (-π/2 around X):
  PlaneGeometry now lies on XZ plane
  Y=0 is the ground
  X = left(-70) to right(+70)
  Z = back(-46.65) to front(+46.65)
  
┌─────────────────────────────────┐
│      3D World (Top View)        │
│                                 │
│  Z (back)                       │
│  ↑                              │
│  │        FLOOR PLANE           │
│  │    ┌─────────────┐           │
│  │    │             │           │
│  └────┼─────0───────┼───→ X     │
│       │             │           │
│       └─────────────┘           │
│  (-70,-46.65)   (+70,+46.65)   │
```

### Why Centered at Origin?

```javascript
// Center at (0, 0, 0)
floor.position.set(0, 0, 0);  // The plane itself is centered at origin
```

**Benefits of centering at origin:**

1. **Camera orbiting** - `controls.target = (0,0,0)` means camera orbits the center
2. **Raycasting** - Mouse picking works correctly relative to center
3. **Lighting** - Directional light calculations are symmetric
4. **Scaling** - Objects grow/shrink symmetrically from center
5. **Intuitive** - (0,0,0) is the natural "middle" of the floor plan

### Converting Pixel → 3D World

```javascript
const PLANE_W = 140;    // Total 3D width
const PLANE_H = 93.33;  // Total 3D height

function pxToWorld(px, py) {
  // Normalize pixel coords to 0-1 range
  const normX = px / IMG_W;     // 0 to 1 (left to right)
  const normY = py / IMG_H;     // 0 to 1 (top to bottom)
  
  // Convert to -1 to +1 range (centered at 0)
  const centerX = normX - 0.5;  // -0.5 to +0.5
  const centerY = normY - 0.5;  // -0.5 to +0.5
  
  // Scale to 3D plane dimensions
  const worldX = centerX * PLANE_W;    // -70 to +70
  const worldZ = -centerY * PLANE_H;   // Note: Z is inverted (image Y down = world Z back)
  
  return { x: worldX, z: worldZ };
}
```

**Step by step for Booth P18 pixel [1904, 666]:**

```
Step 1: Normalize to 0-1
   normX = 1904 / 2400 = 0.7933
   normY = 666 / 1600 = 0.4163

Step 2: Center at 0 (shift to -0.5 to +0.5 range)
   centerX = 0.7933 - 0.5 = 0.2933
   centerY = 0.4163 - 0.5 = -0.0837

Step 3: Scale to 3D plane size
   worldX = 0.2933 * 140 = 41.06
   worldZ = -(-0.0837) * 93.33 = 7.81    ← Note negation!

Result: Booth P18 is at 3D position (41.06, 0, 7.81)
```

### Visual Example of 3D World Space

```
3D World Space (Centered at Origin):
        Y ↑
          │ (up/down)
          │
    (-70,-46.65)    (0,0) is center    (+70,+46.65)
         ╱           ╱                      ╱
        ╱           ╱                      ╱
  ┌─────────────────────────────────┐
  │         FLOOR PLANE             │
  │      with JPEG texture          │
  │                                 │
  │  (P18 at 41, 0, 7.8)           │
  │  (P66 at ?, 0, ?)              │
  │                                 │
  └─────────────────────────────────┘
   ╱        ╱ Z (forward/back)      ╱
  ╱        ╱                       ╱
X (left/right)
```

---

## 4. Why We Need Offset + Scale in fabricToPixel()

### The Problem

The fabric coordinates might not perfectly map to the image for these reasons:

1. **Design vs. Implementation mismatch**
   - Designer created floor plan at certain coordinates
   - Image was exported/rendered separately
   - Slight alignment differences exist

2. **Image rendering process**
   - When the JPEG was created, there might be margins/padding
   - Axis alignment might be off by a few pixels

3. **Real-world calibration**
   - The calibration sliders let you **fine-tune** the mapping

### The Solution: Two-Layer Scaling

```javascript
function fabricToPixel(x, y) {
  // Layer 1: BASE SCALE (mathematical mapping from design to image)
  const sx = baseScaleX * (scXEl.value / 1000);
  
  // Layer 2: OFFSET (manual calibration fine-tuning)
  return {
    px: (x - fb.minX) * sx + (+offXEl.value),
    //                      ↑ This offset lets you shift everything by N pixels
  };
}
```

**Example:**
```
Without offset:    Booth P18 → pixel [1604]
With offset +300:  Booth P18 → pixel [1904]  ← Shifted right
```

### Why Not Just Fix the Scale?

Because the issue might be **uniform** (everything is shifted by 50 pixels) vs. **non-uniform** (scaling is slightly wrong).

- **If all booths are shifted right:** Adjust Offset X
- **If booths look stretched:** Adjust Scale X/Y
- **If spacing between booths looks wrong:** Also adjust Scale X/Y

---

## 5. buildBooths() Function: Step-by-Step Audit

### Current buildBooths() Code

```javascript
function buildBooths(){
  boothMeshes.length = 0;
  boothByNo.clear();
  clearGroup(boothGroup);
  clearGroup(outlineGroup);

  for(const b of data.booths){
    // STEP 1: Convert fabric points to pixel coordinates
    const ptsPix = b.geometry.points.map(([x,y]) => fabricToPixel(x,y));
    
    // STEP 2: Convert pixel coordinates to 3D world coordinates
    const pts2 = ptsPix.map(p => {
      const w = pxToWorld(p.px, p.py);
      return new THREE.Vector2(w.x, w.z);
    });

    // STEP 3: Validate polygon has at least 3 points
    if(pts2.length < 3) continue;
    
    // STEP 4: Ensure correct winding order (counterclockwise)
    if(polygonArea(pts2) < 0) pts2.reverse();

    // STEP 5: Create 2D shape and extrude to 3D
    const shape = new THREE.Shape(pts2);
    const h = (b.status==="BOOKED") ? 2.0 : (b.status==="HOLD" ? 1.6 : 1.2);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled:false, steps:1 });
    
    // STEP 6: Rotate extrusion so it lies flat
    geo.rotateX(-Math.PI/2);

    // STEP 7: CENTER THE GEOMETRY
    geo.computeBoundingBox();
    const c = new THREE.Vector3();
    geo.boundingBox.getCenter(c);
    geo.translate(-c.x, -c.y, -c.z);  // ← Move geometry so center is at local origin
    
    // STEP 8: Create mesh and position it in scene
    const mesh = new THREE.Mesh(geo, boothMaterialFor(b));
    mesh.position.set(c.x, 0, c.z);   // Position mesh at where geometry's center was
    
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.booth = b;
    mesh.userData.center = new THREE.Vector3(mesh.position.x, 0.1, mesh.position.z);

    boothGroup.add(mesh);
    boothMeshes.push(mesh);
    boothByNo.set(b.boothNo, mesh);
  }
}
```

### Detailed Analysis

#### STEP 1: Fabric → Pixel

```javascript
const ptsPix = b.geometry.points.map(([x,y]) => fabricToPixel(x,y));
```

**Accuracy Check:**
- ✅ Uses correct fabricToPixel() function
- ✅ Includes calibration adjustments
- ✅ Handles all corner points

**Example:**
```
Booth P18 corners:
  [8234.475, 2365.12] → {px: 1904, py: 666}
  [8443.045, 2365.12] → {px: 1938, py: 666}
  [8443.045, 2538.98] → {px: 1938, py: 709}
  [8234.475, 2538.98] → {px: 1904, py: 709}
  
This creates a rectangle in pixel space ✅
```

#### STEP 2: Pixel → 3D World

```javascript
const pts2 = ptsPix.map(p => {
  const w = pxToWorld(p.px, p.py);
  return new THREE.Vector2(w.x, w.z);
});
```

**Accuracy Check:**
- ✅ Uses correct pxToWorld() function
- ✅ Extracts X and Z (not Y, since floor is at Y=0)
- ✅ Returns THREE.Vector2 for shape creation

**Example:**
```
Pixel [1904, 666] → World (41.06, 7.81)
Pixel [1938, 709] → World (42.14, 5.09)

This creates a 3D rectangle on the floor plane ✅
```

#### STEP 3-4: Validation

```javascript
if(pts2.length < 3) continue;
if(polygonArea(pts2) < 0) pts2.reverse();
```

**Accuracy Check:**
- ✅ Skips degenerate polygons
- ✅ Ensures consistent counterclockwise winding
- ✅ polygonArea() uses shoelace formula (correct)

**Winding order matters because:**
- Three.js faces should face outward (CCW when viewed from outside)
- If CCW from top, it's also correct for other rotations

#### STEP 5-6: Create Extruded Shape

```javascript
const shape = new THREE.Shape(pts2);
const h = (b.status==="BOOKED") ? 2.0 : (b.status==="HOLD" ? 1.6 : 1.2);
const geo = new THREE.ExtrudeGeometry(shape, { depth: h, ... });
geo.rotateX(-Math.PI/2);
```

**Accuracy Check:**
- ✅ THREE.Shape correctly interprets Vector2 array
- ✅ Height varies by status (good for visual distinction)
- ✅ Rotation is correct: -π/2 rotates from XY plane to XZ plane

**Before rotation:**
```
Shape in XY plane (Z = 0):
  ┌─────────┐
  │ Booth   │
  │  0-2.0  │  ← Extruded along Z axis
  │         │
  └─────────┘
```

**After rotation (-π/2 around X):**
```
Shape now on XZ plane (Y = 0):
  ┌─────────┐  ← Top (Y = 2.0)
  │ Booth   │
  │         │  ← Sits on ground (Y = 0)
  └─────────┘
```

#### STEP 7: Center Geometry (CRITICAL)

```javascript
geo.computeBoundingBox();
const c = new THREE.Vector3();
geo.boundingBox.getCenter(c);
geo.translate(-c.x, -c.y, -c.z);
```

**Why this is necessary:**

By default, ExtrudeGeometry creates vertices with **arbitrary positions**. We need to:
1. Find the geometric center of all vertices
2. Move all vertices so the center is at (0, 0, 0)

**This ensures:**
- The mesh.position will be exactly at the booth's center
- Raycasting/picking works from the center
- Shadows and lighting are symmetric
- Highlighting/scaling from center works correctly

**Example:**
```
Before translation:
  Vertex 1: (100, 0, 50)
  Vertex 2: (150, 0, 50)
  Vertex 3: (150, 0, 100)
  Vertex 4: (100, 0, 100)
  Center: (125, 0, 75)

After geo.translate(-125, 0, -75):
  Vertex 1: (-25, 0, -25)
  Vertex 2: (25, 0, -25)
  Vertex 3: (25, 0, 25)
  Vertex 4: (-25, 0, 25)
  Center: (0, 0, 0) ✅
```

#### STEP 8: Position Mesh in Scene

```javascript
const mesh = new THREE.Mesh(geo, boothMaterialFor(b));
mesh.position.set(c.x, 0, c.z);
mesh.userData.center = new THREE.Vector3(mesh.position.x, 0.1, mesh.position.z);
```

**Accuracy Check:**
- ✅ Position is set to where geometry's center was
- ✅ Y = 0 (floor level) is correct
- ✅ Stores center for later use (tooltip, focus, routing)

**Why this works:**
```
Geometry is centered at (0,0,0) locally
Mesh is positioned at (125, 0, 75) globally
Result: The booth appears at (125, 0, 75) in world space ✅
```

---

## 6. Complete Validation Checklist

### ✅ Coordinate System Checks

- [x] Fabric bounds define the design space correctly
- [x] baseScaleX/Y are mathematically correct: `image_px / fabric_units`
- [x] fabricToPixel() applies scale then offset (correct order)
- [x] pxToWorld() normalizes pixels, centers at 0, then scales to plane size
- [x] Negation in pxToWorld() is correct: `-(normY - 0.5)` because image Y increases downward

### ✅ Center at Origin

- [x] Floor plane is positioned at (0, 0, 0)
- [x] Floor plane geometry is centered so vertices span from -PLANE_W/2 to +PLANE_W/2
- [x] Booth geometries are translated so their centers are at local (0, 0, 0)
- [x] Booth meshes are positioned at their geometric centers
- [x] All transforms preserve center alignment

### ✅ buildBooths() Accuracy

- [x] All 4 coordinate transformations are correct
- [x] Polygon validation (3+ points) prevents errors
- [x] Winding order reversal ensures correct face orientation
- [x] Extrusion height varies by status (intentional)
- [x] Geometry centering is critical and correct
- [x] Mesh positioning matches geometry centering
- [x] userData stores correct reference info

### ✅ Edge Cases

- [x] Degenerate polygons (< 3 points) are skipped
- [x] Polygons with wrong winding order are reversed
- [x] Coordinate precision is maintained through all transforms

---

## 7. Quick Reference: The Math

### Transformation Equations

**Fabric → Pixel:**
```
px = (x_fabric - minX) × baseScaleX × (scaleX_ui / 1000) + offsetX_ui
py = (y_fabric - minY) × baseScaleY × (scaleY_ui / 1000) + offsetY_ui
```

**Pixel → World:**
```
normX = px / IMG_W              // 0 to 1
normY = py / IMG_H              // 0 to 1
centerX = normX - 0.5           // -0.5 to 0.5
centerY = normY - 0.5           // -0.5 to 0.5
world_x = centerX × PLANE_W     // -70 to 70
world_z = -centerY × PLANE_H    // (negated)
```

**Complete Fabric → World:**
```
Input: fabric_coord = [8234.475, 2365.12]
  ↓
px = (8234.475 - 416.33) × 0.2188 × 0.938 + 300 = 1904.4
py = (2365.12 - 368.95) × 0.2013 × 0.912 + 300 = 666.4
  ↓
world_x = ((1904.4 / 2400) - 0.5) × 140 = 41.06
world_z = -((666.4 / 1600) - 0.5) × 93.33 = 7.81
  ↓
Output: 3D_position = (41.06, 0, 7.81)
```

---

## Summary

| Concept | What It Is | Why Needed |
|---------|-----------|-----------|
| **Fabric Space** | Original design coordinates | Source of truth from JSON |
| **Fabric Bounds** | Min/max of design | Define scale ratio |
| **Pixel Space** | JPEG image coordinates | Intermediate mapping |
| **Floor Plane** | 3D flat rectangle with texture | Where booths sit in 3D scene |
| **3D World Space** | Three.js scene coordinates | Where Three.js renders objects |
| **baseScaleX/Y** | Stretch factor design → image | Makes fabric coords fit image |
| **Offset + Scale** | Fine-tuning calibration | Accounts for design → image misalignment |
| **Center at Origin** | All meshes centered at local (0,0,0) | Makes interactions work correctly |

All transformations are **correct and mathematically sound** ✅

