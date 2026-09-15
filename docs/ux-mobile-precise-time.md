# Mobile precise-time ownership

The phone atlas remains instrument-first, but it is no longer view-only.

- The first viewport is still owned by the kinetic disk.
- The main shell is vertically scrollable on phone widths.
- A dedicated mobile time dock sits immediately below the disk.
- The mobile dock accepts UTC+08:00 civil time to the second and resolves it to the same physical `Selected Instant` used by the disk.
- Ring scrubbing continues to update the mobile time field through `data-selected-instant-ms`.
- Applying a typed instant removes legacy longitude/month/year-stem projection parameters before navigation, so exact-time selection cannot silently inherit old projection state.
- The desktop timeline/slider remains a separate control surface; the mobile dock does not duplicate the desktop dashboard.

This intentionally keeps time selection in the primary mobile flow while Compare, Classification, layer visibility and reference-frame controls remain Analysis-only.
