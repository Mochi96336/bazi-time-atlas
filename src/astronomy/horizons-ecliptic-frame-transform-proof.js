import { MEAN_ECLIPTIC_OF_DATE_FRAME_SEMANTICS } from "./absolute-state-seasonal-solver.js";
import { createHorizonsEclipticFrameWindowProofAdapter } from "./horizons-ecliptic-frame-window-proof.js";

/**
 * Thin proof-only adapter that exposes the pinned Horizons frame windows through
 * the mean-ecliptic-of-date transform contract consumed by the absolute-state
 * seasonal solver. It delegates all interpolation to the existing frame-window
 * proof adapter and does not broaden its evidence coverage.
 */
export function createHorizonsEclipticFrameWindowProofTransform(options) {
  const adapter = createHorizonsEclipticFrameWindowProofAdapter(options);
  return Object.freeze({
    ...adapter,
    frameSemantics:MEAN_ECLIPTIC_OF_DATE_FRAME_SEMANTICS,
    icrfDirectionToMeanEclipticOfDate({ ttJulianDay, directionIcrf }) {
      return adapter.icrfApparentToEclipticOfDate(ttJulianDay, directionIcrf);
    }
  });
}
