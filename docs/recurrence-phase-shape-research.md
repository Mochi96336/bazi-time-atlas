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

### The current 95.11 h value is shape-only

The existing Berger comparator anchors both years at solar longitude 0° (vernal equinox) and normalizes both years to 365.2422 days.

Therefore the current term residual is:

```
shape_i =
  (target term offset from target vernal equinox)
- (base term offset from base vernal equinox)
```

It deliberately removes the common seasonal translation relative to the Gregorian calendar.

At +24,000 years, the current maximum shape residual is about 95.11 h. This should **not** be described as “the solar terms are 95 h late relative to the calendar”.

Physically, in the current implementation the shape change is driven by the long-term change in orbital eccentricity and the longitude of perihelion relative to the seasonal frame. Obliquity is not presently used by the term-timing comparator.

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

- +24,000: discrete closure is exact, max shape residual ≈ 95.11 h.
- +792,000 (= 33 × 24,000): Berger-model search finds a much closer shape match, max residual ≈ 10.62 h.
- The latter is a model-range near-recurrence, not a newly proven “BaZi period”.

The near-recurrence search is therefore already doing the intended second-stage operation:

```
exact discrete lattice -> rank by astronomical shape residual
```

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
- Do not describe 95.11 h as a Gregorian calendar drift.
- Do not use the current shape-only month-boundary exposure as an absolute civil-calendar error rate.
- Do not promote discrete day closure to a day-pillar proof.
- Deep-time results near the Berger ±1 Myr model limit must be labelled as model results, not precise future ephemerides.
