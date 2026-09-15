# Horizons ecliptic-of-date frame research (do not merge)

This branch is temporary network research scaffolding.

## Cross-target result already observed

Using paired Horizons quantity #45 (apparent ICRF RA/DEC) and quantity #31
(apparent Earth ecliptic-of-date lon/lat), a right-handed orthogonal rotation is
built independently at each epoch from the Sun and Moon directions. Applying
that same rotation to withheld 2026 Mars/Jupiter/Saturn/Pluto directions gives a
maximum angular residual of about 0.00079 arcsec across the four sampled epochs.
The fitted matrices have determinant +1 to double precision and orthogonality
residuals around 1e-15.

This demonstrates that #31↔#45 is target-independent at the captured precision;
apparent light-time, solar deflection, and stellar aberration are shared by the
paired quantities rather than being hidden in the frame transform.

## Dense 4006 experiment

The workflow additionally captures Sun+Moon quantity #31/#45 on two independent
grids across year 4006:

- daily 00:00 TT knots
- daily 12:00 TT withheld truth

The follow-up clean proof may retain only bounded numeric evidence and an offline
frame-window interpolation adapter. No Swiss Ephemeris / Owen implementation or
third-party coefficient table is copied into main.
