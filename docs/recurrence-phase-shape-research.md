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

### Fixed orbit-clock experiment: useful rejection

A second proxy tested whether the missing phase could be recovered from Berger's event mean anomaly plus one calibrated anomalistic/orbit-clock period.

- 2026→4006, fitting all 24 reviewed DE441 seasonal crossings gives **365.259606774 d per orbit turn**.
- The 24 independently fitted values agree to a full spread of only **0.420 s** (RMS spread ≈ **0.122 s**), so this is an excellent local/common-clock description over that interval.
- Freezing that clock and predicting the pinned DE441-derived year-10026 Li Chun misses by about **−24.017 h**.

Therefore a single fixed anomalistic/orbit-clock period is **rejected** as the missing deep-time phase model. The failure is consistent with long-term perturbations of absolute orbital phase / mean motion that are intentionally absent from Berger's seasonal-shape approximation.

Source audit also rules out a trivial replacement with the public Laskar tables:

- official La2010 `a,l,k,h,q,p` files do contain mean longitude `l`, but the published La2010 series runs from the past to J2000, not into the +24 kyr future;
- official La2004 future files reach +21 Myr but the public insolation tables contain only `e`, obliquity and moving-equinox longitude of perihelion, not absolute mean longitude.

The next justified experiment is therefore a reproducible long-range numerical orbital-phase integration, calibrated inside DE441 coverage before any +24,000-year value is surfaced.

### First N-body state baseline

A research-only REBOUND baseline now tests that path directly. It starts from official DE441 J2000 ICRF/TDB states, integrates the Sun, major-planet barycentres plus separate Earth/Moon, and compares Earth/Sun states back to DE441 while DE441 truth still exists.

The first intentionally incomplete model (WHFast, 2-day convergence run; no asteroids, general relativity, or solar mass loss) gives approximately:

- year 4006: geocentric-Sun direction error ≈ 169–177 arcsec, roughly 1.1 h of solar-longitude timing;
- year 10026: ≈ 648–672 arcsec, roughly 4.3–4.5 h;
- maximum geocentric Earth–Sun position error by year 10026 ≈ 489,000 km.

The 4-day and 2-day integrations stay much closer to each other than either stays to DE441, so the dominant remaining error is already **physical-model incompleteness**, not simply the WHFast timestep. The year-26026 integrated state remains unvalidated and must not be promoted to an absolute seasonal phase.

### Relativity A/B

The same 2-day WHFast baseline was then rerun with REBOUNDx `gr`. This force is used rather than `gr_potential` because the research target is orbital phase: the central-star `gr` treatment preserves the relevant first-order mean-motion and perihelion-precession correction, while the faster potential approximation is not suitable for a phase comparison.

Against the same DE441 checkpoints:

- year 4006 mean geocentric-Sun direction error: **172.150 → 29.973 arcsec** (**−82.59%**);
  - Li Chun window: 176.921 → 23.068 arcsec;
  - March equinox window: 170.953 → 40.101 arcsec;
  - September equinox window: 168.575 → 26.751 arcsec.
- year 10026 mean direction error: **662.297 → 547.988 arcsec** (**−17.26%**);
  - Li Chun window: 671.695 → 546.420 arcsec;
  - March equinox window: 666.970 → 557.271 arcsec;
  - September equinox window: 648.228 → 540.272 arcsec.

General relativity is therefore a **necessary and strongly supported correction**, especially by year 4006, but it does not explain the dominant year-10026 drift. The next experiment should isolate longer-period perturbing physics (especially the massive small-body/asteroid terms present in the JPL dynamical solution) before any +24,000-year seasonal phase is surfaced.

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
