# Wheel camera ownership

The kinetic wheel uses three separate coordinate responsibilities:

1. **World geometry** — `src/wheel/ring-model.js` and `polar-geometry.js` own the single SVG-world center, ring radii, fan angles, paths, and semantic ring boundaries.
2. **Camera** — `src/wheel/camera.js` owns viewBox geometry and `responsive-camera-controller.js` follows the rendered SVG box. Responsive framing is expressed only by viewBox crops (`desktop`, `compact`, `mobile`).
3. **CSS layout** — CSS owns only the physical `<svg>` box inside the instrument. It must not zoom the wheel, move the SVG camera, or define ring transform pivots.

All modes frame a radial depth of `1182 * .72 = 851.04` world units. The viewBox width follows the actual SVG width/height ratio. On a `374 × 732` mobile SVG:

- visible viewBox width: `851.04 * 374 / 732 = 434.821` world units
- centered `x`: `600 - 434.821 / 2 = 382.589`
- mobile `y`: `1360 - 1182 - 100 = 78`
- uniform screen scale follows the SVG height rather than a separate CSS zoom

Because `preserveAspectRatio` keeps SVG scaling uniform, pointer coordinates can continue to pass through `getScreenCTM().inverse()` into the same world geometry. Independent ring dragging therefore does not need viewport-specific math.

## Invariants

- Ring transforms are SVG `rotate(angle cx cy)` operations around the canonical world center.
- `.ring-track` must not receive CSS `transform` or `transform-origin`.
- `#kinetic-wheel` has one layout-only CSS rule: `inset:0; width:100%; height:100%`.
- Responsive zoom is represented in `data-geometry-camera-*` diagnostics and verified in the true-390px Chromium fixture.
- Changing camera mode must not mutate selected time, model rotation, or manual ring offsets.

## Startup and layout changes

The renderer installs the master fan and camera immediately after `renderStatic()`. There is no separate module polling deadline: slow module loading cannot permanently miss installation.

A zero or non-finite SVG dimension defers camera calculation and retains the last valid viewBox. The controller observes the SVG and instrument boxes, coalesces changes into one animation frame, and remeasures on window/visual-viewport resize, `pageshow`, and return to the foreground. Identical viewBoxes produce no attribute writes, preserving the material and gesture projection caches. The orbital background observes the source viewBox so observer delivery order cannot leave it on an older camera.

The earlier implementation used `1200 / 760` whenever the SVG measured zero, then listened only for window resize. That produced a landscape-shaped `1343.747 × 851.040` viewBox inside a tall phone viewport. SVG `meet` scaling shrank and vertically centered the wheel, while CSS identity labels stayed in their mobile positions. Using the supplied screenshot's approximate SVG bounds (`683 × 1117` image pixels, top `158`), that stale camera predicts the Year crown at `551` and inner crown at `898`; the screenshot shows approximately `547` and `892`. This supports the zero-size fallback diagnosis, although the precise iPhone event that produced the zero measurement has not been observed directly.

`check-mobile-camera-lifecycle.mjs` exercises the actual homepage with a delayed renderer and hidden initial instrument, element-only height changes, viewport height restoration, page restoration, and repeated stable resize notifications. It checks matching wheel/background cameras and unchanged selected time/ring pose, and captures the recovered portrait layout. Physical iPhone verification remains separate from Chromium regression coverage.
