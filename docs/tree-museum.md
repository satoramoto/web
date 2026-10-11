# Tree of Life museum POC

`/museum/` is a separate immersive portfolio entry. The band homepage remains unchanged. The museum keeps three project labels, native detail dialogs, wheel/touch/keyboard navigation, pause/reset, theme quickpicks and a searchable MilkDrop collection.

## Native waveform feedback

One persistent Butterchurn 2.6.7 visualizer renders the chosen preset. `native-spine.ts` adapts trusted, locally vendored equations into the compiled callback form supported by that pinned release. All authored initialization, frame and pixel equations remain, along with all four original custom-wave slots and shape callbacks. Original custom waves run their native `generateWaveform` path, including per-point shared-buffer/register writes and persisted state, without issuing their raster draws. Original shape instance equations and persistence run with their GPU setup/draw methods suppressed. This preserves invisible dependencies such as alien fish pond's `gmegabuf` wave, rather than deleting a slot to make room for the spine.

A small version-pinned hook replaces `basicWaveform.drawBasicWaveform`, after the authored custom-wave stages and before final comp. It asserts that Butterchurn's `targetFrameBuffer` is bound and draws the canonical waveform there with its own native-context line buffers: a steady pale crisp core and restrained colored halo. Original basic-wave, motion-vector, border and darken-center emissions are disabled. The dedicated hook restores VAO/program/buffer and blend state afterward. It does not run during `renderToScreen` or resize rerendering, so those paths cannot double-deposit.

These marks enter Butterchurn's real `targetTexture`. On the next native frame the engine swaps feedback targets and the authored warp moves those deposited marks. No separate compositor feedback, source-emission mask or artificial historical traces remain. The native waveform still produces all trails.

The shared bounded synthesis produces a canonical 1024-byte mono window, `0.8 left + 0.2 right`. Exactly those bytes are supplied unchanged in Butterchurn's mono/left/right audio arrays. The dedicated native line reads the same bytes directly, while normal native audio/FFT processing still drives authored equations. It uses 1025 vertices: 1024 canonical sample positions plus the periodic closing point. When scroll places a vertex between world samples, it linearly interpolates the two adjacent actual supplied bytes. This hook avoids the native custom-wave limit of 512 control vertices and its extra input smoothing.

Pulse onset uses a 0.22-second exponential attack; signed samples receive 0.10/0.26-second temporal attack/release smoothing, and pulse envelopes 0.18/0.50 seconds. Smoothing precedes quantization, audio delivery and native drawing. Signed values are soft-limited and explicitly saturated before byte conversion. Pulse count is capped at ten, gesture energy at one, and pulses expire after seven simulation seconds. CPU snapshots are retained/recycled for bounded storage; they are not the source of visible trails.

## Scroll moves the input through the engine

Native feedback output stays fixed at screen UV. Scroll does **not** translate or wrap the rendered video. Instead, each native input vertex at screen-y `s` samples world-y `wrap(s × 6 + position)`. Its x coordinate is that world's periodic curved trunk plus the signed canonical waveform displacement. Project labels follow the same looping world position. Content and the new waveform therefore move through the stationary native engine while already deposited history keeps moving under the preset's own warp. The six-unit modulo belongs to content/input sampling; there is no output-edge seam crossfade or wrapped video.

Pause, hidden-page state and reduced-motion startup freeze synthesis and native history. Gestures cannot accumulate a burst while paused. Content navigation can still move labels; the new source position is delivered when native rendering resumes. Dialogs pause the world and restore invoking-label focus. Reset clears signal/pulses, both native feedback targets, the comp target and all six blur targets. It retains the injection toggle. A procedural authored comp/background can remain after reset with injection off; deposited strokes are cleared. The page is silent, creates no AudioContext and requests no microphone permission.

## Spine visibility, falloff and preset character

Authored warp and comp shaders are preserved for library selections. Some comp shaders invert, rotate, distort or obscure the freshly deposited line; retaining them matters to preset character. The known Event Horizon quickpick alone uses an identity final comp to avoid its original final rotation; its original warp still shapes history. The three quickpicks are adapted neon mindblob grafitti, Paint Spill and Spiral Artifact.

To keep the current source line readable across original comps, presentation includes a thin pale **reference core** from the exact last-delivered canonical byte texture, native feed time and native feed position. This draws no halo, creates no feedback, and is not the source of trails. The native core/halo deposit remains present beneath the original comp. Both native deposition and the reference core turn off together with the diagnostic injection control. A static exponential presentation exposure, `0.90 × (0.10 + 0.90 × exp(-0.85 × distance))`, follows the same delivered sample-displaced spine. It concentrates native RGB at the source with a nonzero edge tail, without moving the image, altering native history or adding repeated bright/dark gates. Native/preset movement remains authored. Collection presets vary in intensity and behavior; no medical safety certification is claimed.

## Full local collection browser

The collection contains all **1,754 JSON presets** in the installed butterchurn-presets 2.4.7 `presets/converted` directory (approximately 8.8 MB). This extends beyond BlackHole's 100 favorites. `src/content/museum-presets.json` holds original names and stable IDs derived from source filenames. Independent files in `public/preset-library/` load on demand with `fetch`; the main bundle contains the name catalogue and three quickpicks, not all preset equation/shader data. The production build copies the same lazy files into its destination.

The compact trigger opens a native modal with author/name search, previous/next, shuffle and a list initially capped at 60 rows. Show more expands the results; arrow/Home/End keys navigate visible result buttons, and ordinary Tab/Enter/Space work. Wheel/touch/keyboard events inside the library stay with its controls instead of moving the museum. Escape/close returns focus to the trigger. Quickpicks are unpressed during a library selection.

`?preset=<id>` shares a selection; the last successful library selection is also saved locally. An explicit theme URL without a preset starts its quickpick. Theme quickpicks remove the preset query/save. Loading is abortable and serial guarded; rapid selections are latest-wins. A candidate is accepted only after its native shaders link and its first native frame returns successfully. Load/link/first-frame failures restore the previously accepted preset, leave the picker available, and expose retry/other-selection actions. Later authored equation failures stop native advancement but still leave the picker available for a new selection; this is not a promise that every arbitrary preset recovers automatically. Context loss requires reload. Device-specific shader support, missing external image assets and authored equations may prevent particular presets from rendering correctly; access to the full collection does not claim exhaustive runtime verification.

## Performance and diagnostics

Both WebGL2 contexts request `high-performance`; this is a preference, not proof of hardware acceleration. One context belongs to Butterchurn and one to presentation. Native warp equations use a 24 × 18 mesh (475 vertices versus the default 1,813). Uniforms are cached, textures use preallocated storage and `texSubImage2D`, and replaced native warp/comp program handles are released during browsing. No `gl.finish` or `readPixels` is used.

| Tier | Native square buffer / cadence | Display scale / width cap |
| --- | --- | --- |
| high | 1024 × 1024 / 60 Hz | 1 / 1440 px |
| balanced | 512 × 512 / 30 Hz | 0.85 / 1152 px |
| low | 256 × 256 / 20 Hz | 0.65 / 900 px |

Signal generation remains up to 60 Hz; native tiers consume the latest snapshot at their cadence. Adaptive quality uses unclamped active RAF intervals, four-second warmup, sustained slow windows, separate recovery thresholds and cooldowns. Pause, background/hidden state, theme/preset changes and resize restart observation. `?quality=high|balanced|low` pins a tier. Weaker-device automatic transitions require device evidence and are not established by a production build.

`?perf=1` enables a DOM HUD with RAF fps/interval p95, CPU submission mean/p95, actual dimensions, quality reason/transitions, context preference, renderer string and native frame/deposit counters. Asynchronous disjoint-safe GPU timing measures presentation only, excluding the native preset context. `window.__treeMuseum` also records the actual delivered native world position, canonical feed time and target-binding observation.

**Stop waveform injection** disables native deposits and the display reference core while native audio/warp/comp/frame advancement keep running. Existing marks should continue transforming and decaying; **Resume waveform injection** deposits again. This is the intended browser demonstration of native history causality. Deposit counters count enabled native draw-stage passes, not completed GPU fragments. Target binding is the last observed enabled deposit stage. Full pause is separate.

## Credits, validation and deployment

Original author names are retained in the catalogue, also shipped as `preset-library/catalogue.json`. The full package MIT notice ships at `preset-library/LICENSE.txt`; `/museum/credits.txt` references it and retains earlier credits. The three quickpick originals and prior files remain beside their notices. No OpenFlow engine code was vendored.

`npm run build:museum` performs TypeScript and museum production validation. No automated tests were added or run per the user's instruction. Browser visual/performance verification belongs to the coordinator and is reported separately; selected successful presets do not establish all 1,754 work on every GPU.

The build outputs only the museum into `dist-museum/`, promotes HTML to the artifact root, bundles its font with `/web/` URLs, and retains credits plus the lazy library. The destination workflow publishes the coordinator branch to GitHub Pages in `satoramoto/web`; the original band deployment stays restricted to its original repository. This implementation assignment authorizes local edits/commits only; no push or deployment was performed.
