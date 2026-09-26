# H2.3 — Zodiac selected-label readability in the real wheel

This is a **small, reversible semantic typography experiment**, not a new Zodiac material or independent clock. Branch from current main `44885e4`, which contains merged H2.0 plus Research updates. Unmerged Solar trials #476/#479 and unmerged Zodiac hardcoat #480 are archived. No shader, WebGL, SVG geometry, phase/time calculations, CSS palette variables, new badges, panels or duplicate time controls.

## Problem demonstrated by native PNG

At the same fixed instant and true 1440/390 size, H2.0 Zodiac is a very dark derived band. The hardcoat PR #480 passed Quality and Visual but a stronger GPU highlight changed mean Zodiac RGB8 by only 1.01235/channel and still looked materially identical. The **active Zodiac read-head label** had the same low contrast and 10px size as static context labels; neither shader highlighting nor fine-grain texturing solves that reading problem.

## Single targeted change

- Improve static Zodiac context only slightly, preserving its intentionally subordinate treatment: `57% zodiac / 43% muted`, size 10.5px, weight 690 rather than `66% zodiac / 34% muted`, size 10px, weight 680.
- Give only the selected dynamic Zodiac label a stronger *neutral ink floor* (`42% zodiac / 58% ink`), size 11.25px and weight 780. It stays subordinate to Solar and the ivory Selected Instant stroke. No glow, bright blue, new stroke, active-sector brightness, or geometry change.
- Scope the active label rule to **non-Classification** so categorical color ownership is not accidentally replaced.
- Retain existing scale-context recession of the *other* eleven labels and full-strength active datum label at all three window presets.

## Acceptance gates

1. Exact-head Quality/Visual success. Compare new-head native `material-roughness`, native SVG, forced fallback on 1440/2047 and true 390 with same fixed-instant production H2.0 screenshot.
2. Look at actual **active and static Zodiac words**, not only image delta percentage. If 390 fixed label is still microscopic due wheel projection, do **not** falsely claim mobile readability. Avoid collision with Solar current-term word, the ivory cursor, Zodiac static labels or neighboring ring labels.
3. Verify normal, Tools, Classification and Find Time screenshots; especially confirm new neutral Zodiac active color **does not bleed into Classification** or overpower primary Solar/current time.
4. No material shader, ring geometry or reference-field changes permitted. Mobile must have one legible existing-rail classification caption, or close this PR unmerged. Do not add a second time control or extra panel.


## Mobile supplementary fix after native-image review

A real 390px screenshot of the initial CSS-only revision made the selected Zodiac label nominally larger/brighter but still **physically tiny** inside the projected SVG band. That does not meet mobile legibility. Rather than making the annual material brighter or moving wheel geometry, we now reuse the **existing flat mobile exact-time dock** as the only screen-space textual supplement. Its passive `#mobile-zodiac-readout` displays `黃道 · [selected sign]` at 12 physical CSS pixels alongside the time entry, not in a new card or a second clock. The value comes directly from the existing `instrument.dataset.zodiac` selected-instant authority; no independent longitude-to-Zodiac calculation or free-ring pose interpretation is introduced.

The caption only appears for an **applied** instant on the ordinary mobile reading surface. It is hidden when the time input is dirty (uncommitted), or when Classification/Analysis owns the view. Desktop retains the very small typographic adjustment to the active Zodiac SVG label.

Validation now includes an opt-in **real-browser 390px iframe** runtime probe, not just regex tests: it checks canonical label text and computed 12px size, hides the caption when input becomes dirty, applies the valid exact-time value again, then confirms the caption disappears for Classification and Analysis. The default fixture is not mutated by this diagnostic. Inspect native 390/1440 ordinary, Tools, Classification and Find Time PNGs for clipping and hierarchy; do not infer optical quality from passing tests alone.
