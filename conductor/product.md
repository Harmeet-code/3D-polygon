# Initial Concept

An interactive 3D exhibition floor plan viewer built with Three.js. Visualizes trade show booths as extruded 3D polygons over a textured floor plan, with pathfinding, filtering, heatmaps, calibration controls, and multi-floor support.

# Product Guide

## Product Vision

A web-based interactive 3D floor plan viewer that enables event organizers, exhibitors, and attendees to explore exhibition halls virtually. The application transforms CAD-style booth geometry data into an immersive 3D experience with real-time navigation, search, routing, and data visualization capabilities.

## Target Users

- **Event Organizers:** Manage booth assignments, visualize floor layouts, and make data-driven decisions about space allocation.
- **Exhibitors:** Preview booth locations, understand sightlines, and plan logistics.
- **Attendees:** Navigate the exhibition hall, find specific exhibitors, and plan their visit route.

## Core Features

1. **3D Booth Visualization:** Booth polygons extruded from JSON geometry data, rendered on a textured floor plan in 3D space with realistic lighting and shadows.
2. **Multi-Floor Support:** Tab-based switching between multiple floor plans, each with its own JSON data file and floor plan image.
3. **Search & Filter:** Filter booths by availability status (Available / Hold / Booked) or search by booth number or company name.
4. **Interactive Selection:** Click any booth to see its number, company, size, price, and status in the sidebar.
5. **Camera Controls:** Orbit (drag rotate), zoom (wheel), pan (Shift+drag), plus isometric / top / reset presets and auto tour.
6. **Route Finder:** A* pathfinding between two booths with animated glow and marching walking dots visualization.
7. **Heatmap:** Color-coded price overlay on booths to identify cost patterns across the floor.
8. **Night Lighting:** Toggle ambient/night lighting mode for presentation variety.
9. **YouTube Integration:** Embedded video player per booth for virtual booth previews.
10. **Calibration UI:** Fine-tune offset (X/Y) and scale (X/Y) to align 3D geometry with the floor plan texture, persisted in browser localStorage.
11. **Coordinate Debug Tool:** Inspector for examining the Fabric → Pixel → World coordinate transformation pipeline per booth.

## Key Differentiators

- **Precision Coordinate Pipeline:** Fabric (CAD) → Pixel (image) → World (3D scene) transformation with user-adjustable calibration.
- **Data-Driven:** All booth geometry and metadata lives in JSON files — no hardcoded layout.
- **No Build Step:** Vanilla ES modules served directly via HTTP server — instant iteration.
- **Extensible Multi-Floor Architecture:** Adding a new floor is a 3-step data operation (JSON + image + manifest entry).
