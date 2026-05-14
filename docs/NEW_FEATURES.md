1. createLabelSprite(boothNo, size) — Creates a canvas texture with a dark pill background, white booth number (bold 30px), and muted size text (20px). Returns a THREE.Sprite scaled to 3.5×1.4 world units.
2. roundRect(ctx, x, y, w, h, r) — Helper for rounded rectangle paths on canvas.
3. Label attached to each mesh — label.position.set(0, h + 0.9, 0) places it floating above the booth top. Since it's a child of the mesh, it moves with the booth and is hidden when filters hide the booth.
4. clearGroup now disposes textures — o.material.map?.dispose?.() ensures canvas textures are cleaned up when booths are rebuilt. Also recurses into child objects (if (o.children.length) clearGroup(o)) to handle label sprites attached to meshes.

