# Tree of Life museum POC

`/museum/` is a separate immersive portfolio entry. The band homepage remains unchanged. The museum keeps three project labels, native detail dialogs, wheel/touch/keyboard navigation, a six-unit wrapping camera, pause/reset and a compact theme selector. `?theme=prism|garden|horizon` overrides the saved selection; theme buttons update the shareable URL and support arrow keys, Home/End and ordinary button activation.

## The waveform is native feedback input

One persistent Butterchurn 2.6.7 visualizer renders the selected theme. `native-spine.ts` adapts trusted, locally vendored preset equations into the compiled callback form supported by that pinned release. It replaces the selected preset's visible basic/custom waves and shapes with one native custom wave. It retains authored initialization, frame equations, pixel equations and warp shader. The selected presets have no invisible megabuf-wave dependencies. Their original files remain unmodified; these are adapted variants rather than claims of identical original output.

The native render order is previous-feedback warp, blur preparation, shapes/custom waves, basic wave/borders, then final comp. Our custom-wave callback runs with Butterchurn's `targetFrameBuffer` bound, which is checked at each enabled deposit pass. Butterchurn rasterizes that line into `targetTexture`. On the next native frame its own feedback swap and authored warp transform those actual marks. No external feedback layer, RGB emission mask, synthetic trail overlay or independently drawn spine remains. The visible fresh line and its warped history are the native texture itself.

A single bounded virtual stereo synthesis produces a canonical mono byte window, `0.8 left + 0.2 right`, once per signal tick. Exactly those bytes are supplied unchanged in Butterchurn's mono/left/right audio arrays, and the native point callback reads the same window directly. This deliberately bypasses the engine's additional waveform smoothing/downsampling for geometry, while its normal audio/FFT processing still drives authored equations. Butterchurn caps custom waves at 512 control vertices: each vertex selects the nearest periodic sample from the 1024-byte window, with the last vertex wrapping to sample zero. Native line smoothing inserts additional raster vertices. Thus the control positions derive from the actual supplied samples, but this is not a claim that every input sample becomes its own raster vertex.

The native square buffer makes Butterchurn's inverse-aspect factors one. Its custom-wave y coordinate is top-down. Sample position spans the six-unit world, and x is the periodic curved trunk plus that sample's signed waveform displacement. Scroll gestures seed irregular bounded pulses that travel through the waveform. Pulse onset uses a 0.22-second exponential attack; signed samples receive 0.10/0.26-second temporal attack/release smoothing, and pulse envelopes 0.18/0.50 seconds. This smoothing precedes quantization, audio delivery and visible native geometry. Signed values are soft-limited and explicitly saturated before byte conversion. Pulse count is capped at ten, gesture energy at one, and old pulses expire after seven simulation seconds. Signal snapshots are retained/recycled for bounded CPU storage; visible trails now come exclusively from native feedback, not those snapshot arrays.

## Themes and presentation

| Theme | Native preset variant |
| --- | --- |
| Prism Temple | flexi + fishbrain - neon mindblob grafitti |
| Liquid Garden | Zylot - Paint Spill (Music Reactive Paint Mix) |
| Event Horizon | Geiss - Spiral Artifact |

Each theme uses its authored native warp to move the injected waveform history. Prism and Garden retain their authored final comp shaders; these may include procedural background or native color processing. Horizon uses an identity final comp because the original Spiral Artifact comp rotates the entire target, including freshly deposited strokes. Its authored warp still transforms history. Theme changes reuse the same visualizer and clear native targets; contexts do not accumulate.

The presentation pass uploads the resulting native canvas and samples it in the same world coordinates, applying only camera translation. It has no theme-specific UV folds, rotations or source emission. A narrow 2.5% strip at each vertical world edge crossfades the existing native output with its opposite edge to soften the finite native buffer's wrapping seam. A static exponential exposure curve, `0.65 × (0.18 + 0.82 × exp(-0.7 × distance))`, concentrates native RGB around the broadly curved spine while retaining a nonzero tail. Neither pass introduces periodic crest gates, bright/dark stripes or duplicate light. No medical safety certification is claimed.

The page is silent, uses no AudioContext and requests no microphone permission. Scroll eases the camera rather than rewinding preset history. Pause, hidden-page state and reduced-motion startup freeze synthesis and native history; gestures cannot accumulate a burst while paused. Dialogs pause the world and restore invoking-label focus when closed. Reset clears signal/pulses and both native feedback targets, the native comp target and all six native blur targets. It retains the injection toggle. With injection off, reset removes deposited strokes; a preset's procedural comp/background may still be visible. Context loss displays an unavailable message; reload is required. Project navigation remains accessible when graphics initialization fails.

## Performance and diagnostics

Both WebGL2 contexts request `high-performance`; this preference does not guarantee hardware acceleration. One context belongs to Butterchurn and one to the simple presentation pass. Native warp equations use a 24 × 18 mesh (475 vertices versus the library default's 1,813). Uniform locations are cached; canvas upload storage is allocated only at initialization/quality changes and updated with `texSubImage2D`. No `gl.finish` or `readPixels` is used.

| Tier | Native square buffer / cadence | Display scale / width cap |
| --- | --- | --- |
| high | 1024 × 1024 / 60 Hz | 1 / 1440 px |
| balanced | 512 × 512 / 30 Hz | 0.85 / 1152 px |
| low | 256 × 256 / 20 Hz | 0.65 / 900 px |

The signal advances independently at up to 60 Hz; lower native tiers consume the latest snapshot at their own cadence. Adaptive quality uses unclamped active RAF intervals, a four-second warmup, sustained slow windows, separate recovery thresholds and cooldowns. Pause, hidden/background state, theme changes and resize restart observation. Slower tiers reduce native detail/history cadence while camera presentation stays at display cadence. `?quality=high|balanced|low` pins a tier for inspection. Automatic transitions on weaker devices require device evidence and are not established by a production build.

`?perf=1` enables the DOM-visible HUD: rolling RAF fps/interval p95, CPU submission mean/p95, actual native/display dimensions, quality reason/transitions, renderer string, requested power preference and native frame/deposit counters. CPU includes synthesis, native render submission, uploads and presentation. Asynchronous disjoint-safe GPU timing covers only the presentation context, excluding the native preset context; unavailable timing stays explicit. `window.__treeMuseum` additionally records selected preset, current world position, pulse/signal state, canonical feed time and native target-binding observation.

The HUD's **Stop waveform injection** control disables native wave alpha/deposit callbacks while native audio, warp, comp and frame advancement keep running. Existing strokes should continue transforming and decaying without fresh line drawing. **Resume waveform injection** deposits new marks again. This diagnostic is the intended browser demonstration of native history causality, rather than evidence based only on final appearance. A full pause is a separate control. Native deposit counts represent enabled custom-wave stage passes, and target binding is the last observed enabled deposit stage; they are not a count of completed GPU fragments.

## Credits, validation and deployment

Preset JSON comes from the BlackHole visualizer's builtin catalogue; new native-wave examples are `f0adec683c530fa4e16d88e6` and `a72077a384546786efaeb01d`. Earlier unused presets remain available with their credits. Original author names and Butterchurn/preset-package MIT notices are retained in `/museum/credits.txt` and beside the implementation. No OpenFlow engine code was vendored.

`npm run build:museum` performs TypeScript and destination-specific production validation. No automated tests were added or run per the user's instruction. Browser visual/performance verification is owned by the coordinator and reported separately from build success.

The build outputs only the museum into `dist-museum/`, promotes its HTML to the artifact root, bundles its font with `/web/` asset URLs, and retains `credits.txt`. The destination-specific `museum-pages.yml` workflow publishes the coordinator branch to GitHub Pages in `satoramoto/web`. The original band deployment remains restricted to its original repository. This implementation assignment authorizes local edits and commits only; no remote push or deployment was performed.
