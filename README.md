# SEMS • 3D Interactive Floor Plan

An interactive **3D exhibition floor plan viewer** built with [Three.js](https://threejs.org/). Visualizes trade show booths as extruded 3D polygons over a textured floor plan, with filtering, search, routing, heatmaps, and calibration controls.

## Features

- **3D Booth Visualization** — Booth polygons extruded from JSON geometry data, rendered on a textured floor plan in 3D space
- **Search & Filter** — Filter booths by availability (Available / Hold / Booked) or search by booth number / company name
- **Booth Information** — Click any booth to see its number, company, size, price, and status
- **Camera Controls** — Orbit (drag rotate), zoom (wheel), pan (Shift+drag), plus isometric / top / reset presets
- **Auto Tour** — Automated camera flythrough across the floor plan
- **Route Finder** — A\* pathfinding between two booths with animated glow and walking dots
- **Heatmap** — Color-coded price overlay on booths
- **Night Lighting** — Toggle ambient/night lighting mode
- **YouTube Integration** — Embedded video per booth
- **Calibration UI** — Fine-tune offset (X/Y) and scale (X/Y) to align the 3D geometry with the floor plan texture. Values persist in browser local storage.

## How It Works

The floor plan data lives in a JSON file (`src/booths_poly_v2.json`) containing booth polygon geometries in **fabric (CAD) coordinates**. At runtime, a coordinate transformation pipeline converts these through three spaces:

1. **Fabric space** — raw design coordinates from the source file
2. **Pixel space** — mapped onto the floor plan JPEG
3. **3D world space** — Three.js scene coordinates

A calibration panel allows adjusting offset and scale multipliers for precise alignment when the floor plan texture or source data changes.

## Tech Stack

| Tool                                       | Purpose                                        |
| ------------------------------------------ | ---------------------------------------------- |
| [Three.js](https://threejs.org/)           | 3D rendering                                   |
| [Bun](https://bun.sh/)                     | JavaScript runtime & package manager (≥1.3.13) |
| [Oxlint](https://oxc.rs/)                  | Linting                                        |
| [Oxfmt](https://oxc.rs/)                   | Formatting                                     |
| [Husky](https://typicode.github.io/husky/) | Git hooks                                      |
| [commitlint](https://commitlint.js.org/)   | Conventional commit enforcement                |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) ≥ 1.3.13

### Install

```bash
bun install
```

### Lint & Format

```bash
bun run lint       # lint
bun run lint:fix   # lint + auto-fix
bun run format     # format
bun run check      # lint + format check
```

## Project Structure

```
├── data/                          # (reserved for data files)
├── docs/                          # Coordinate system docs, audit guides
│   ├── COORDINATE_SYSTEM_EXPLAINED.md
│   ├── GUIDE_AUDIT_TOOLS.md
│   ├── README_COORDINATE_SYSTEM.md
│   └── REFERENCE_CARD.md
├── src/
│   ├── app/                       # Application entry point (Bun server)
│   ├── booths_poly_v2.json        # Booth geometry data (15522 lines)
│   ├── DenverFloorPlan1.jpg       # Floor plan texture image
│   ├── styles.css                 # Viewer CSS
│   ├── viewer_interactive.html    # Main viewer HTML
│   └── viewer_interactive.js      # Three.js viewer logic
├── .github/                       # GitHub agents, hooks, instructions
├── .husky/                        # Git hooks configuration
├── package.json
├── tsconfig.json
└── bunfig.toml
```

## Configuration

### Booth Data Format

Booths are defined in `src/booths_poly_v2.json` with polygon geometry in fabric coordinates:

| Field          | Type     | Description                               |
| -------------- | -------- | ----------------------------------------- |
| `boothNo`      | `string` | Booth identifier (e.g. `L1-15`)           |
| `price`        | `string` | Rental price                              |
| `size`         | `string` | Dimensions (e.g. `10x10`)                 |
| `boothType`    | `string` | Color category                            |
| `boothColor`   | `string` | Hex color                                 |
| `gatePosition` | `string` | Entrance position                         |
| `status`       | `string` | `AVAILABLE`, `HOLD`, or `BOOKED`          |
| `geometry`     | `object` | Polygon with `points[][]` in fabric units |
| `fabricBBox`   | `object` | Bounding box (`x, y, w, h`)               |

### Calibration

Use the calibration panel in the sidebar to adjust:

- **Offset X / Y** — translate the geometry overlay
- **Scale X / Y** — stretch/shrink the geometry overlay

Values are saved to `localStorage` and persist across sessions.
