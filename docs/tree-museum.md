# Tree of Life museum POC

`/museum/` is a separate Vite HTML entry. Its implementation lives in `src/experience/TreeMuseum/`; the band homepage remains at `/`. This route is a local portfolio exploration and is marked `noindex`. It has not been published as part of this assignment.

The composition borrows the branching canopy, central blue eddy, peach roots and discreet museum labels from the generated visual reference. The artwork is rendered live rather than displaying that image. Butterchurn 2.6.7 renders three persistent WebGL canvases, which become textures in an independent WebGL2 shader compositor. Procedural filaments supply a stable tree structure. The preset images are spatially warped and masked into that structure; the full original presets are not shown as three separate rectangles.

Presets (from Butterchurn favorites, provided by butterchurn-presets 2.4.7):

- **Flexi + Martin — astral projection**, source ID `80b9a123a5713128ca06c61c` (`presets/astral.json`)
- **Geiss — Spiral Artifact**, source ID `824c876b9cbaf604932cc9fa` (`presets/spiral.json`)
- **Flexi + Martin — cascading decay swing**, source ID `a78e4a1c46e08aaf9efe8635` (`presets/cascade.json`)

These JSON presets were copied from the BlackHole visualizer's local builtin preset catalogue. Author credits above are retained from that catalogue. MIT notices for Butterchurn and the preset package are kept beside the implementation and preset files. The build also includes `/museum/credits.txt` with the credits and MIT notice, referenced by the museum HTML license link. No historical OpenFlow implementation was vendored.

The same synthetic stereo samples drive all three presets. The page is silent and never creates an AudioContext or requests microphone permission. Motion proceeds independently of scroll. Scrolling eases the camera along a six-unit periodic vertical world; preset history is not rewound. Three stable label anchors follow the same coordinates, and the cycle repeats indefinitely in both directions. Detail dialogs pause the visual world, trap focus through the native dialog element and restore focus to the invoking label. Escape, the close button and the backdrop return to the world.

Wheel and touch drag support spatial navigation. Arrow keys move in small steps, Page keys and Space move by a layer, and Home resets the camera. Top-right controls pause/resume animation and reset the camera. Reduced motion starts paused; the user can deliberately resume. Background tabs stop render work. Resize updates the compositor drawing buffer, capped at DPR 1.5 and width 1920. Preset textures use 384-square buffers on desktop and 256-square on initial mobile layout. Persistent instances are never recreated during scroll.

Diagnostics are available without UI clutter at `window.__treeMuseum`: renderer name, selected presets, render-frame and MilkDrop-frame counts, world position, paused state and an error when available. WebGL2 is required. The project labels and detail links remain available if graphics initialization fails. Context loss displays an unavailable message; recovery requires a reload.

This is an intentionally small first slice, not an exact reconstruction of the generated reference. Actual device performance and visual quality vary with WebGL support. The composer uses three independent contexts to avoid unproven cross-instance GL state sharing. The compositor adds a fourth context. Real input audio, project-specific visual assets and a native Metal engine are outside this POC.

Run using the unified launcher only, with allocated preview and Storybook ports. No automated tests were added or run, as explicitly requested for this fast POC. Type/build validation and a quick Chromium visual smoke check were used; integrated interaction acceptance belongs to the coordinator.
