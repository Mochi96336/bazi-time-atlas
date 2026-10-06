# Recurrence research: discrete lattice, seasonal phase, and shape

## Current research position

The Research page should keep its three-layer structure. The layers are not three independent experiments; each layer adds a stricter condition to the previous one.

1. **Discrete recurrence** — establish when the sexagenary year/day sequences and the proleptic-Gregorian date structure align.
2. **Astronomical refinement** — test how close the real seasonal geometry remains after the discrete structures align.
3. **Four-pillar consequence** — determine whether the remaining astronomical differences actually move year/month boundaries or can support day/hour claims.

## Fixed interpretation

### 24,000 years is the discrete search lattice

For the current model, every integer multiple of 24,000 years closes all three discrete phases:

- nominal 60-year sequence,
- elapsed-day mod-60 sequence,
- Gregorian 400-year phase.

Therefore `n × 24,000` is the natural coarse search lattice for long recurrence. It is **not** itself a proven astronomical or four-pillar period.

The local +1,980-year result remains important: for the current 2026-09-13 base date it is the first year-sequence + day-sequence recurrence, but it does not restore the Gregorian 400-year phase. It demonstrates why a less constrained recurrence can happen earlier.

### The current 94.80 h value is shape-only

The existing Berger comparator anchors both years at solar longitude 0° (vernal equinox) and normalizes both years to 365.2422 days.

Therefore the current term residual is:

```
shape_i =
  (target term offset from target vernal equinox)
- (base term offset from base vernal equinox)
```

It deliberately removes the common seasonal translation relative to the Gregorian calendar.

At +24,000 years, the corrected maximum shape residual is about 94.80 h. This should **not** be described as “the solar terms are about 95 h late relative to the calendar”.

Physically, in the current implementation the shape change is driven by the long-term change in orbital eccentricity and the longitude of perihelion relative to the seasonal frame. Obliquity is not presently used by the term-timing comparator.

### Berger longitude-convention correction

The first implementation of the seasonal-shape comparator applied an extra 180° opposition: it converted the requested apparent-Sun longitude to an Earth heliocentric longitude and then subtracted Berger's `OMEGVP / varpi`. Berger's parameter is already used in the moving-equinox apparent-Sun longitude convention for the insolation/time-of-season calculation, so that conversion reversed the seasonal timing shape.

The corrected comparator uses:

```
true anomaly for timing = solar longitude - Berger varpi
```

The correction is externally checked against the repository's year-4006 DE441 seasonal-event evidence. Across all 24 canonical 15° crossings, after cancelling the common seasonal phase, the corrected Berger shape differs from the 2026→4006 DE441 shape by:

- maximum absolute error ≈ 0.1745 h,
- RMS error ≈ 0.0847 h,
- full error spread ≈ 0.2332 h.

This is now a permanent regression gate. A future refactor must not reintroduce the extra 180° conversion.

### Missing layer: absolute seasonal phase

To test the intuition that the Gregorian calendar remains strongly related to the seasonal/zodiac frame, Research 02 still needs a separate quantity:

```
phase =
  target vernal-equinox position in the target Gregorian frame
- base vernal-equinox position in the base Gregorian frame
```

Then the actual boundary displacement in a Gregorian comparison frame can be treated conceptually as:

```
boundary_i = phase + shape_i
```

The existing month-boundary exposure is currently based on `shape_i` only and must continue to be labelled as such until absolute seasonal phase is implemented.

### Existing absolute-epoch work and its hard coverage limit

The repository already contains a separate absolute seasonal-epoch authority / civil-projection chain. It must be reused rather than replaced, but it does **not** currently reach the +24,000-year target:

- year 2026: bounded ShouXing direct seasonal event model resolves an astronomical TT epoch;
- year 4006: reviewed DE441 direct-event runtime resolves the seasonal event;
- year 10026: DE441 source coverage exists and Research has pinned source-derived evidence, but canonical production runtime / independent target-year truth remain intentionally unpromoted;
- year 26026: the authority returns `absolute-source-unavailable` with blocker `ephemeris-source-coverage`; the nearest qualified DE441 boundary is year 17191.

Therefore Research 02 must not manufacture an exact Gregorian-frame phase for +24,000 from the current absolute-epoch stack. The next long-term phase layer needs an explicitly qualified long-range approximation or another source, with uncertainty / claim boundaries kept separate from the existing absolute authority.

## Useful evidence already present

For base year 2026:

- +24,000: discrete closure is exact, max shape residual ≈ 94.80 h.
- +792,000 (= 33 × 24,000): Berger-model search finds a much closer shape match, max residual ≈ 10.39 h.
- The latter is a model-range near-recurrence, not a newly proven “BaZi period”.

The near-recurrence search is therefore already doing the intended second-stage operation:

```
exact discrete lattice -> rank by astronomical shape residual
```

A first research-only phase proxy was also calibrated after the Berger correction. It advances the known 2026 TT event by a fixed 365.2422-day skeleton and adds the corrected Berger within-year shape change. Against absolute evidence:

- year 4006: observed seasonal phase offset ≈ +12.20 h at Li Chun; across all 24 terms it is almost a pure common offset (≈ +12.10 h mean, ≈ 0.23 h spread);
- year 10026: observed Li Chun seasonal phase offset ≈ +33.12 h against the pinned DE441-derived Research crossing;
- year 26026: no absolute ephemeris truth is available, so the proxy remains unvalidated and must not be shown as an absolute seasonal date.

This demonstrates the intended decomposition: corrected Berger geometry can explain the **within-year shape**, while the missing quantity is the **common seasonal phase**. The common phase is not safely represented by a linear drift extrapolation.

## Implementation order

1. Keep 01 intact as the derivation of discrete alignment; improve hierarchy rather than replacing the content.
2. In 02, rename/clarify all existing astronomical residual copy as **seasonal shape** / **spring-equinox-normalized shape**.
3. Add an explicit **absolute seasonal phase** model and tests before combining it with month-boundary exposure.
4. Once phase is validated, expose:
   - seasonal phase,
   - seasonal shape,
   - combined Gregorian-frame boundary displacement.
5. Only then update 03 boundary consequences to use the combined displacement.
6. Day/hour remain unresolved until absolute civil-day phase, rollover convention, local clock/longitude/solar-time convention, and resolved day stem are modeled.

## Guardrails

- Do not promote +24,000 to “the BaZi period”.
- Do not demote +1,980 to an irrelevant footnote; it is the important lower-constraint counterexample.
- Do not describe the ≈94.80 h shape residual as a Gregorian calendar drift.
- Do not use the current shape-only month-boundary exposure as an absolute civil-calendar error rate.
- Do not promote discrete day closure to a day-pillar proof.
- Deep-time results near the Berger ±1 Myr model limit must be labelled as model results, not precise future ephemerides.
