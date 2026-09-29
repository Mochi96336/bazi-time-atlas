# 4K wheel flicker: bounded GPU/compositor investigation

Status: **diagnostic only**. Never infer that the 4K flicker is fixed from CI green or from a screenshot of a stationary disk. The user's actual Windows browser/GPU must produce comparative evidence.

## Known production facts verified at baseline

- Desktop instrument fills the viewport width and grows with viewport height. The entire instrument, not merely the visible fan, owns an absolutely positioned WebGL canvas.
- The canvas backing size is the SVG CSS bounding rectangle multiplied by `min(devicePixelRatio, 2)`. Its native memory, shader fill cost and compositor pressure can rise substantially at 4K. A half-scale 4K target draws roughly one quarter as many material fragments; **it is diagnostic only**, not an approved quality change.
- The default material mode is `roughness`. The main fragment shader evaluates Solar patina/scratches and Zodiac nebula separately from the SVG ring groups. The whole material canvas is re-rendered when the rendered ring pose flushes.
- SVG rotations flush through a microtask in `createKineticRenderer`, then immediately invoke the WebGL material draw. On larger/slower GPUs, SVG and canvas composition may still be observed at different presentation boundaries.
- The current WebGL2 context requests `powerPreference:"low-power"`, `preserveDrawingBuffer:false`, `premultipliedAlpha:true`, no antialias. These are browser **preferences/settings**; none is proved to be the cause of flashing.
- Historical wide-desktop PNG checks use 2047×1038, not a real 3840×2160 motion test. CI's software WebGL cannot validate an actual Windows GPU/compositor defect.

## Isolate first, change production later

At the **same 4K monitor resolution, Windows scaling, Chrome version and motion**, compare these direct URLs (all map to the same timeline; links omit unrelated user time/selection context):

| Order | Mode | URL query |
|---|---|---|
| A | Current default | `?material=roughness` |
| B | Pure SVG | `?material=svg` |
| C | Forced fallback SVG | `?material=roughness&materialWebgl=off` |
| D | High-performance adapter preference | `?material=roughness&renderAudit=1&materialGpu=high` |
| E | Preserve drawing buffer | `?material=roughness&renderAudit=1&materialBuffer=preserve` |
| F | 50% material backing dimensions | `?material=roughness&renderAudit=1&materialScale=0.5` |

A/B/C already exist before this PR. D/E/F only become active with `renderAudit=1`. All switches are inert on ordinary production URLs.

Use the full-width same-origin harness at `scripts/fixtures/4k-rotation-flicker.html` for each mode. It loads the **real** homepage in a 100%×100% iframe, clicks the existing Play control and samples 120 requestAnimationFrame intervals; it exports selected WebGL context attributes, actual canvas backing size, 240 latest CPU *submission* durations, gap durations, and context-loss count. **It does not detect visual flashes by itself**: make a short 4K screen recording and mark whether (1) the entire colored material vanishes, (2) only grain/scratches shimmer, or (3) text/ticks/other SVG geometry also flashes.

Read in the child frame's console: `window.__atlasRenderAudit.snapshot()`. The presence and contents of that global depend on the explicit diagnostic flag. The renderer string may be masked when browser privacy settings block `WEBGL_debug_renderer_info`.

## Interpretation, not verdict

| What the actual user GPU shows | Stronger next hypothesis |
|---|---|
| A flashes, B/C clean | Material WebGL path or canvas/SVG compositor boundary. Compare D, E, F. |
| A, B and C all flash | SVG paint/filters, frame timing, browser display pipeline, monitor refresh or GPU driver; do **not** tune material shader first. |
| E alone stabilizes with the same visual content | Drawing-buffer/compositor lifetime is implicated. Avoid shipping preserve=true blindly; measure VRAM/fps first. |
| D alone stabilizes | Adapter choice/power preference may matter. The browser may ignore this hint; inspect actual renderer string. |
| F stabilizes without changing the visual state/time | Resolution-dependent material fill cost becomes plausible. Need material-only render bound or adaptive target after quality review. |
| Material is steady but fine scratches/nebula sparkle as they rotate | Likely temporal undersampling or excessive high-frequency material; compare per-feature `materialProbe` values without reducing all layers. |
| `contextLost>0` or fallback=context-lost | GPU resource/context path implicated; recovery should be investigated independently. |

Do not combine D/E/F in one run: single-variable tests establish which intervention changes the symptom. Report Windows scaling, browser hardware acceleration on/off and whether the entire disk blanks versus material-only speckling. The driver/browser requires actual-device verification.

## Exit gates

1. At least two repeats per mode on actual 4K display, same starting instant and same motion, with screen recording.
2. Side-by-side A vs B vs C and only then D/E/F as relevant.
3. If a code repair is indicated, make a separate PR; preserve the original 4K materials except the smallest validated target.
4. 3840×2160 native screenshot and moving evidence plus 2047×1038 and 390px regressions. Chromium SwiftShader CI is *not* a substitute for the original hardware.
