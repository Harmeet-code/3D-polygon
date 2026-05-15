# Coordinate Debug Tool — Design Spec

## Overview

A sidebar panel + 3D visual overlay that displays all three coordinate systems (Fabric/JSON, Pixel, World 3D) for a selected booth, helping verify correct placement inside the floor plan image.

## Motivation

The existing calibration panel requires blind tweaks of offset/scale values. The debug tool exposes the full transformation pipeline visually and in tabular form, so users can quickly see whether a booth's geometry lands correctly within the image bounds and identify calibration errors.

## Coordinate Systems

| System | Range | Source / Transform |
|--------|-------|--------------------|
| **Fabric/JSON** | Large numbers (e.g. `[10165, 853]`) | `booths_poly_v2.json` → `geometry.points` |
| **Pixel** | `0..IMG_W` × `0..IMG_H` | `fabricToPixel(x, y)` in CoordTransform.js |
| **World 3D** | World units on Three.js plane | `pxToWorld(px, py)` in CoordTransform.js |

Pipeline: `JSON → fabricToPixel() → Pixel → pxToWorld() → World 3D`

## 1. UI Layout (Sidebar)

A new section "Coordinate Debug" placed after the Calibration section in the sidebar.

```
┌─ Coordinate Debug ──────────────────────┐
│  [Booth ▼]          [   Show Overlay]   │
│  ┌────────────────────────────────────┐ │
│  │ ✅ All corners inside image bounds│  │
│  ├──────────┬──────┬──────┬──────────┤  │
│  │ Corner   │ Fab  │ Pxl  │ World    │  │
│  ├──────────┼──────┼──────┼──────────┤  │
│  │ 1        │ …    │ …    │ …        │  │
│  │ 2        │ …    │ …    │ …        │  │
│  │ …        │ …    │ …    │ …        │  │
│  └──────────┴──────┴──────┴──────────┘  │
└──────────────────────────────────────────┘
```

### Elements

- **Booth selector**: `<select>` populated with all booth numbers from JSON
- **Overlay toggle**: Checkbox `[✅ Show Overlay]` to show/hide the 3D visual overlay
- **Status banner**: Green "All corners inside image bounds" or red "N corners extend outside image"
- **Data table**: One row per vertex, columns:
  - Corner (1-based index)
  - Fabric X, Y (from JSON, 2 decimal places)
  - Pixel X, Y (computed, 1 decimal place)
  - World X, Z (computed, 3 decimal places)
  - Status icon: ✅ or ❌ indicating whether pixel coords are inside `[0,IMG_W] × [0,IMG_H]`

### Styling

Matches existing sidebar section patterns (`.section`, `.kv`-style table, `.pill` for toggle, `.tiny` for hints). Table uses a compact CSS grid or plain div layout consistent with the app's dark theme.

## 2. Data Flow

1. User selects a booth number from the dropdown
2. `CoordDebug.js` reads `geometry.points` from the booth data
3. For each corner `[fx, fy]`:
   - `pixel = fabricToPixel(fx, fy)` → `{px, py}`
   - `world = pxToWorld(pixel.px, pixel.py)` → `{x, z}`
   - Validate: `0 ≤ pixel.px ≤ IMG_W` and `0 ≤ pixel.py ≤ IMG_H`
4. Render table rows + update status banner
5. If overlay toggle is on, create/update 3D overlay

Recomputes on every selection change. The table reads the current calibration from `readCal()` at compute time, so it always reflects the latest calibration values. After tweaking calibration sliders, the user re-selects the booth to refresh the table (the existing `buildBooths` rebuild clears the overlay group anyway).

## 3. 3D Visual Overlay

A dedicated `debugOverlayGroup` (separate `THREE.Group` added to `scene`) that is cleared and rebuilt on each selection.

### Elements

| Element | Implementation | Color |
|---------|---------------|-------|
| **Polygon outline** | `THREE.LineLoop` using the booth's world-space vertices at `y = height + 0.02` | Cyan `#00ffff` |
| **Corner markers** | Small `THREE.Mesh` (SphereGeometry, r=0.15) at each vertex | Yellow `#ffff00` |

### Position Calculation

- Use the booth's `geometry.points` from JSON
- Transform all corners through `fabricToPixel` → `pxToWorld` to get X/Z in world space
- The booth's extrusion height `h` is determined by status (BOOKED=2.0, HOLD=1.6, AVAILABLE=1.2)
- Y position of overlay = booth's world Y (`mesh.position.y`) + `h` + 0.02

### Lifecycle

- **Create/update**: When booth selection changes and overlay is enabled
- **Remove**: When overlay toggle is turned off, or when a new booth is selected
- **Calibration changes**: Not live — user refreshes by selecting the booth again (or the existing `buildBooths` rebuild triggers a full scene rebuild which clears the overlay)

## 4. File Changes

| File | Action | Details |
|------|--------|---------|
| `src/index.html` | Edit | Add "Coordinate Debug" section after Calibration section |
| `src/ui/CoordDebug.js` | **Create** | Main module: dropdown population, coordinate computation, table rendering, 3D overlay management |
| `src/main.js` | Edit | Import `initCoordDebug(data)`, call it after `initConsoleTools(data)` |

No changes to `SceneSetup.js`, `BoothBuilder.js`, `CoordTransform.js`, or `styles.css`.

## 5. Exports & Dependencies

### `src/ui/CoordDebug.js` exports
- `initCoordDebug(data)` — populates dropdown, sets up event listeners, creates `debugOverlayGroup` and adds to scene

### Imports required
- `fabricToPixel`, `pxToWorld`, `readCal`, `fb`, `baseScaleX`, `baseScaleY` from `../scene/CoordTransform.js`
- `IMG_W`, `IMG_H`, `PLANE_W`, `PLANE_H`, `scene` from `../scene/SceneSetup.js`
- `STATUS_COLORS` from `../scene/BoothBuilder.js` (for height lookup)
- `* as THREE` from `three`

## 6. Edge Cases & Error Handling

- **Booth with < 3 points**: Skip overlay rendering, show warning in table
- **Booth data missing `geometry.points`**: Handle gracefully with "No geometry data" message
- **Calibration values produce NaN/Infinity**: Guard with `Number.isFinite` checks in display
- **Booth number not found**: `find` returns undefined → clear table and overlay
- **Overlay toggle off during active selection**: Remove overlay group children, keep table data visible

## 7. Success Criteria

- Selecting a booth shows all 3 coordinate systems for each corner
- Status banner correctly indicates whether all corners are within image bounds
- Toggling overlay checkbox shows/hides the cyan wireframe + yellow dots in the 3D view
- Table and overlay update instantly when a different booth is selected
- No console errors or broken layouts
