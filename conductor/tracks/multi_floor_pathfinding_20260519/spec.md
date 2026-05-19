# Specification: Multi-Floor Pathfinding with Road Network

## Overview

Extend the existing A* pathfinding system to support road-network-only routing, multi-floor pathfinding with stair/elevator connections, and visual road overlay rendering. The current system routes across any unblocked grid cell; this track constrains routing to designated road corridors and adds cross-floor awareness.

## Goals

1. **Road Network Data Model:** Add `meta.roads` (polylines with width), `meta.stairs`, and `meta.entrances` to floor JSON schemas.
2. **Road-Only Grid Routing:** Switch from binary blocked/unblocked to a cost grid where only road corridor cells are walkable.
3. **Stair Connection Matching:** Build cross-floor stair map so paths can transition between floors.
4. **Multi-Floor Routing Engine:** `multiFloorAStar()` that chains per-floor A* calls via stair nodes.
5. **Visual Road Overlay:** Translucent dark-grey road surface rendered on the floor.
6. **Stair & Entrance Markers:** Clickable 3D POI markers at stair/entrance positions.
7. **Tab-Switch Camera Animation:** Camera flies to the connecting stair when switching floors on an active route.

## Non-Goals

- No off-road walking (all paths must stay on road corridors).
- No automatic road generation from image analysis — roads are manually defined in JSON.
- No automatic stair detection — stairs are defined in JSON metadata only.

## Success Criteria

- A* only returns paths that stay within road corridor cells.
- A path spanning two floors correctly uses a stair connection.
- Switching floors during an active route animates camera to the stair on the new floor.
- Road overlay and POI markers render correctly and update on floor switch.
