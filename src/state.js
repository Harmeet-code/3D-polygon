// Shared mutable state for cross-module references
/** @type {{ selected: import('three').Object3D | null, hovered: import('three').Object3D | null }} */
export const sel = { selected: null, hovered: null };
