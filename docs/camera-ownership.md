# Wheel camera ownership

The kinetic wheel uses three separate coordinate responsibilities:

1. **World geometry** — `src/wheel/ring-model.js` and `polar-geometry.js` own the single SVG-world center, ring radii, fan angles, paths, and semantic ring boundaries.
2. **Camera** — `src/wheel/camera.js` owns the viewBox. Responsive framing is expressed only by viewBox crops (`desktop`, `compact`, `mobile`).
3. **CSS layout** — CSS owns only the physical `<svg>` box inside the instrument. It must not zoom the wheel, move the SVG camera, or define ring transform pivots.

The mobile camera deliberately reproduces the previous 230% visual scale without resizing the DOM element:

- world width: `1200`
- mobile zoom: `2.3`
- visible viewBox width: `1200 / 2.3 = 521.739...`
- centered `x`: `(1200 - 521.739...) / 2 = 339.130...`
- `y` and world height remain the canonical instrument camera (`58`, `760`).

Because `preserveAspectRatio` keeps SVG scaling uniform, pointer coordinates can continue to pass through `getScreenCTM().inverse()` into the same world geometry. Independent ring dragging therefore does not need viewport-specific math.

## Invariants

- Ring transforms are SVG `rotate(angle cx cy)` operations around the canonical world center.
- `.ring-track` must not receive CSS `transform` or `transform-origin`.
- `#kinetic-wheel` has one layout-only CSS rule: `inset:0; width:100%; height:100%`.
- Responsive zoom is represented in `data-geometry-camera-*` diagnostics and verified in the true-390px Chromium fixture.
- Changing camera mode must not mutate selected time, model rotation, or manual ring offsets.
