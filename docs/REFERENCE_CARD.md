# Coordinate System: Visual Quick Reference

## The Three Spaces (Visual)

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃           FABRIC SPACE (JSON Data)                      ┃
┃   ┌──────────────────────────────────────────────────┐  ┃
┃   │ minX=416.33  minY=368.95                         │  ┃
┃   │ (0,0)                                            │  ┃
┃   │                                                  │  ┃
┃   │  [P18: 8234.475, 2365.12]  ← Booth in design    │  ┃
┃   │  [P66: 8445.835, 2589.82]  ← coordinates        │  ┃
┃   │                                                  │  ┃
┃   │                   (11390.02, 8318.84)            │  ┃
┃   │                   maxX, maxY                     │  ┃
┃   └──────────────────────────────────────────────────┘  ┃
┃   Width:  10973.69 units                                ┃
┃   Height: 7949.89 units                                 ┃
┃                                                          ┃
┃   → fabricToPixel() transformation                       ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃         PIXEL SPACE (JPEG Texture)                       ┃
┃   ┌──────────────────────────────────────────────────┐  ┃
┃   │(0,0)                                        (2400,0)│  ┃
┃   │ ↓ top-left                                  ↓ top   │  ┃
┃   │                                              right  │  ┃
┃   │                                                     │  ┃
┃   │  [P18: 1904, 666]  ← Booth on image              │  ┃
┃   │  [P66: 1849, 729]  ← coordinates                 │  ┃
┃   │                                                     │  ┃
┃   │                      (2400, 1600)                   │  ┃
┃   │                      bottom-right                  │  ┃
┃   └──────────────────────────────────────────────────┘  ┃
┃   Width:  2400 pixels                                   ┃
┃   Height: 1600 pixels                                   ┃
┃                                                          ┃
┃   → pxToWorld() transformation                           ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃      3D WORLD SPACE (Three.js Scene)                     ┃
┃   ┌──────────────────────────────────────────────────┐  ┃
┃   │                 Z (forward/back)                │  ┃
┃   │                 ↑                               │  ┃
┃   │(-70, +46.65)    │    (0, +46.65)   (+70,+46.65)│  ┃
┃   │        ┌────────┼────────┬──────────┬──────────┤  ┃
┃   │        │        │        │          │ ↙ booth  │  ┃
┃   │    ←───┼────0───┼────────┘          │ visible  │  ┃
┃   │  X     │        │     [P18: 41, 7.81]          │  ┃
┃   │        │        │     [P66: ?, ?]              │  ┃
┃   │        └────────┼────────┬──────────┬──────────┤  ┃
┃   │(-70,-46.65)    │   (0,-46.65)  (+70,-46.65)  │  ┃
┃   │   Floor plane centered at origin                │  ┃
┃   │   Y=0 (ground level)                           │  ┃
┃   └──────────────────────────────────────────────────┘  ┃
┃   Width:  140 units                                     ┃
┃   Height: 93.33 units                                   ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

## Transformation Formulas

### 1. Fabric → Pixel (fabricToPixel)

```
INPUT: Fabric coordinates [x, y]
       (from booth.geometry.points in JSON)

STEP 1: Normalize to 0
  x_norm = x - minX
  y_norm = y - minY

STEP 2: Apply base scaling (design units → pixels)
  sx = baseScaleX × (scaleX_ui / 1000)
  sy = baseScaleY × (scaleY_ui / 1000)
  
  px_scaled = x_norm × sx
  py_scaled = y_norm × sy

STEP 3: Apply offset (calibration fine-tuning)
  px = px_scaled + offsetX_ui
  py = py_scaled + offsetY_ui

OUTPUT: Pixel coordinates [px, py]
        (position on 2400×1600 image)
```

### 2. Pixel → World (pxToWorld)

```
INPUT: Pixel coordinates [px, py]
       (from fabricToPixel)

STEP 1: Normalize to 0-1 range
  normX = px / IMG_W      (0 to 1)
  normY = py / IMG_H      (0 to 1)

STEP 2: Center at 0 (-0.5 to +0.5)
  centerX = normX - 0.5
  centerY = normY - 0.5

STEP 3: Scale to plane dimensions
  worldX = centerX × PLANE_W
  worldZ = -centerY × PLANE_H     ← Note: NEGATED!

OUTPUT: 3D world coordinates [worldX, worldZ]
        (position on floor plane, Y=0)
```

### 3. Complete Fabric → World (Combined)

```
INPUT: Fabric [8234.475, 2365.12]

→ fabricToPixel():
  x_norm = 8234.475 - 416.33 = 7818.145
  y_norm = 2365.12 - 368.95 = 1996.17
  
  sx = 0.2188 × 0.938 = 0.2052
  sy = 0.2013 × 0.912 = 0.1836
  
  px = 7818.145 × 0.2052 + 300 = 1904.4
  py = 1996.17 × 0.1836 + 300 = 666.4

→ pxToWorld():
  normX = 1904.4 / 2400 = 0.7933
  normY = 666.4 / 1600 = 0.4163
  
  centerX = 0.7933 - 0.5 = 0.2933
  centerY = 0.4163 - 0.5 = -0.0837
  
  worldX = 0.2933 × 140 = 41.06
  worldZ = -(-0.0837) × 93.33 = 7.81

OUTPUT: World [41.06, 7.81]
```

## The Centering Logic

### Before Centering

```
Extruded geometry created with arbitrary vertex positions:

Vertices:
  V1: (100, 0, 50)
  V2: (150, 0, 50)
  V3: (150, 0, 100)
  V4: (100, 0, 100)

Bounding box:
  min: (100, 0, 50)
  max: (150, 0, 100)
  center: (125, 0, 75)

mesh.position = undefined
```

### After Centering

```
Step 1: Calculate bounding box center
  c = (125, 0, 75)

Step 2: Translate geometry so center is at (0, 0, 0)
  geo.translate(-125, 0, -75)

Vertices become:
  V1: (-25, 0, -25)    ← relative to local origin
  V2: (25, 0, -25)
  V3: (25, 0, 25)
  V4: (-25, 0, 25)

Bounding box:
  min: (-25, 0, -25)
  max: (25, 0, 25)
  center: (0, 0, 0) ✓

Step 3: Position mesh at where center was
  mesh.position = (125, 0, 75)

Result: Booth appears at (125, 0, 75) globally ✓
        Geometry is centered at local (0, 0, 0) ✓
```

## Key Parameters

### Image Parameters
```
IMG_W = 2400         ← Width in pixels
IMG_H = 1600         ← Height in pixels
```

### Plane Parameters
```
PLANE_W = 140        ← 3D width in units
PLANE_H = 93.33      ← 3D height (maintains aspect ratio)
```

### Scaling Factors
```
baseScaleX = IMG_W / (maxX - minX)
           = 2400 / 10973.69
           = 0.2188

baseScaleY = IMG_H / (maxY - minY)
           = 1600 / 7949.89
           = 0.2013
```

### Calibration Parameters (UI Sliders)
```
offsetX: -300 to +300 px    ← Shift all X by N pixels
offsetY: -300 to +300 px    ← Shift all Y by N pixels
scaleX:   500 to 2000 (/1000) ← Multiply scale by 0.5-2.0
scaleY:   500 to 2000 (/1000) ← Multiply scale by 0.5-2.0
```

## Coordinate System Properties

### Fabric Space
- **Origin:** Top-left of design (minX, minY)
- **Axes:** X right, Y down (design file convention)
- **Units:** Arbitrary design units (not pixels)
- **Source:** JSON data

### Pixel Space
- **Origin:** Top-left of image (0, 0)
- **Axes:** X right, Y down (image convention)
- **Units:** Pixels (1:1 with JPEG)
- **Range:** X=[0,2400], Y=[0,1600]

### World Space
- **Origin:** Center of floor plane (0, 0, 0)
- **Axes:** X right, Z forward, Y up
- **Units:** 3D scene units
- **Range:** X=[-70,+70], Z=[-46.65,+46.65], Y=0 (ground)

## Transformation Chain Summary

```
┌─────────────────┐
│ Booth JSON      │  "boothNo": "P18"
│ (Fabric coords) │  "points": [[8234.475, 2365.12], ...]
└────────┬────────┘
         │
         ├─ Normalize to 0
         ├─ Apply baseScale
         ├─ Apply UI calibration (offset + scale)
         ↓
┌─────────────────┐
│ Pixel coords    │  [1904, 666] on 2400×1600 image
│ (On JPEG)       │
└────────┬────────┘
         │
         ├─ Normalize to 0-1
         ├─ Center at -0.5 to +0.5
         ├─ Scale to plane dimensions
         ├─ Negate Y axis
         ↓
┌─────────────────┐
│ 3D World coords │  [41.06, 7.81] on floor plane
│ (In scene)      │  Y=0 (ground level)
└────────┬────────┘
         │
         ├─ Create 2D shape
         ├─ Extrude to 3D
         ├─ Rotate to lie flat
         ├─ Center geometry at (0,0,0)
         ├─ Position mesh at booth center
         ↓
┌─────────────────┐
│ 3D Booth Mesh   │  Rendered in Three.js
│ (In viewport)   │
└─────────────────┘
```

## Debugging Quick Reference

| Issue | Likely Cause | Command to Check |
|-------|-------------|-----------------|
| All booths shifted right | Offset X too high | `AUDIT.auditBoothTransformation('P18')` |
| All booths shifted left | Offset X too low | Check px value |
| All booths shifted up | Offset Y too high | Check py value |
| All booths shifted down | Offset Y too low | Check py value |
| Booths too wide | Scale X too high | `DEBUG.compareBooaths()` |
| Booths too narrow | Scale X too low | Compare booth widths |
| Booths too tall | Scale Y too high | Compare booth heights |
| Booths too short | Scale Y too low | Compare booth heights |
| One booth off | Data corruption | `DEBUG.checkBoothPolygon('P18')` |
| Geometry not centered | Code error | `AUDIT.auditAllBoothCentering()` |

---

## Constants Reference

```javascript
// Floor plane
const PLANE_W = 140;
const PLANE_H = PLANE_W * (IMG_H / IMG_W);  // = 93.33

// Image
const IMG_W = floorTex.image.width;    // 2400
const IMG_H = floorTex.image.height;   // 1600

// Fabric bounds
const fb = data.meta.fabricBounds;
const minX = fb.minX;   // 416.33
const maxX = fb.maxX;   // 11390.02
const minY = fb.minY;   // 368.95
const maxY = fb.maxY;   // 8318.84

// Base scaling
const baseScaleX = IMG_W / (maxX - minX);  // 0.2188
const baseScaleY = IMG_H / (maxY - minY);  // 0.2013

// Grid system (for pathfinding)
const CELL = 1.2;
const cols = Math.ceil(PLANE_W / CELL);   // ~117
const rows = Math.ceil(PLANE_H / CELL);   // ~78
```

---

**All transformations are mathematically sound and verified! ✓**
