# Product Guidelines

## UX Principles

1. **Spatial Continuity:** The 3D scene should feel like a coherent physical space. Camera transitions should be smooth (animated flyTo, never instant teleportation).
2. **Progressive Disclosure:** Booth details, debug tools, and calibration controls are hidden until needed. The sidebar reveals information on click, not on hover.
3. **Direct Manipulation:** Click a booth to select it. Drag to orbit. Scroll to zoom. The 3D scene responds immediately with no loading states for these interactions.
4. **Forgiving Input:** OrbitControls damping (0.06) prevents jarring stops. Camera bounds prevent flipping below the floor plane. Tooltips clamp within viewport.
5. **Feedback on Interaction:** Hover highlights booths (cursor change + glow). Click persists the selected state. Route animations provide clear progress indication.

## Visual Style

1. **Dark Theme:** Deep navy/space background (`#0b0f14`) with subtle radial gradient. Panel backgrounds at ~92% opacity with backdrop blur.
2. **Color Semantics:** AVAILABLE = green (`#2ecc71`), HOLD = amber (`#ffb020`), BOOKED = red (`#ff5c6a`). Accent blue (`#6aa9ff`) for interactive elements.
3. **Consistent Radius:** 12-16px border radius throughout UI. Buttons, chips, panels, and tooltips all share rounded corners.
4. **Glassmorphism:** Sidebar and HUD elements use semi-transparent backgrounds with backdrop-filter blur for depth.
5. **Typography:** System font stack (ui-sans-serif), 12-14px body text, bold for headings and labels.
6. **3D Aesthetics:** Booth colors sourced from data (`boothColor` field), not hardcoded. Floor texture is the actual floor plan image. Lighting is hemispheric + directional with shadows.

## Content Guidelines

1. **Booth Data:** All booth information comes from JSON files. The enrichment layer (`enrichment.js`) only adds fallback data — never override existing values.
2. **Labels:** Booth labels are flat canvas-textured planes on the polygon surface. Bold booth number + size text with text-shadow for readability. No background pill.
3. **Route Visualization:** Dark base tube + blue glow tube + marching white points. The glow pulses to indicate active routing.
4. **Coordinate System:** Always display coordinates in all three spaces (Fabric, Pixel, World) when debugging. The debug table must show the full pipeline.

## Accessibility

1. **Keyboard:** All buttons and controls should be keyboard-accessible.
2. **Contrast:** Text on dark backgrounds must maintain WCAG AA contrast ratios.
3. **Color Independence:** Booth status is indicated by both color and the status text label — never color alone.
