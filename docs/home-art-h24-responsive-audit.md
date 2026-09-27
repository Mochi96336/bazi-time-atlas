# H2.4 — Responsive hierarchy and selected-instant synchronization audit

**Evidence-only**. Branch from published H2.3 `67e8a1980d1a2a202f40abc450aed7c497a6867e`. This task does not modify production wheel layout, shader, SVG, time calculations, color tokens or the existing 390px screenshot fixture.

## Why

H2.3 made the canonical selected Zodiac visible in the existing mobile exact-time rail at 390px. However, the previous visual gate only tested one physical mobile width and mostly checked the *same* selected instant after reapplying the time field. The unresolved risks are smaller widths, the 480→481px media breakpoint, stale Zodiac after **a genuinely different Selected Instant**, and conflicts with Analysis/Classification controls.

## Exact-head browser matrix

Run the dedicated same-origin iframe at true `320`, `360`, `390`, `430`, `480` and `481` CSS pixels inside one 600px headless browser window. Fix the source instant at `2026-09-13T23:43:42Z`. The 481px case verifies the mobile dock is hidden and the desktop timestamp is visible.

At all **five mobile widths**, require these independently measured states:

- Caption displays exactly the canonical `instrument.dataset.zodiac`, not a date-derived guess, at 12 actual CSS pixels.
- Existing time input remains usable; the label is in the same row and neither overlaps its input nor extends beyond the true iframe's width or rail.
- The document does not develop a horizontal scrollbar.
- A dirty, unapplied exact-time input hides the derived caption; applying the valid value restores it.
- The canonical `atlas:set-selected-instant` event changes the selected instant to `2026-11-15T07:43:42Z`. Assert the **actual** Zodiac changed and the derived caption and time input match the new instrument state. Do not hardcode a sign from a second astronomical model.
- Classification and Analysis separately suppress the passive caption.

`scripts/check-home-h24-responsive.mjs` writes one diagnostic-only DOM proof and one non-mutated screenshot for every width. Its JSON evidence includes the true iframe dimensions, input/caption/rail geometry and screenshot SHA256s. It fails closed for UI overlap, unexpectedly stale labels, viewport mismatch or incorrect breakpoint behavior. The six screenshots and JSON enter the existing `tmp/visual-check` artifact.

## Manual visual acceptance

Open the unscaled native-width area (leftmost `width` pixels of each 600px screenshot wrapper) for `320, 360, 390, 430, 480` and `481`. Inspect top tools, annual label hierarchy, actual input and caption text, wheel clipping and selected-instant guide. Compare 390 baseline from the exact merge commit, including WebGL/SVG and Classification/Find Time previews. A structural browser pass is **not** proof that tiny SVG labels are naturally readable, nor that metal texture is fixed.

This PR should only add QA infrastructure. Any real layout defect found during review must be described with width, screenshot/coordinates, and fixed in a separate narrowly scoped PR (or a focused follow-up commit if tiny), with full exact-head Quality/Visual rerun. Do not combine with Research #469 or restart Solar/Zodiac material development.
