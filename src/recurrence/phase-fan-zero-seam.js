/**
 * Group only exactly-zero phase bands that are radially adjacent.
 * This is reusable with ANY valid Gregorian base date and year offset:
 * it does not assume Δ is a multiple of 400, or that the 2026 baseline
 * used in the isolated R16 research prototype is selected.
 *
 * The input bands MUST be ordered inner-to-outer and must represent
 * distinct annuli. A nonzero / unavailable band splits the zero seam.
 */
export function zeroPhaseRadialRuns(bands, phases) {
  const result=[];
  let pending=null;
  for(const band of bands){
    if(!Number.isFinite(band.inner)||!Number.isFinite(band.outer)||
        !(band.inner<band.outer))throw new RangeError("invalid radial band");
    const isZero=phases[band.key]===0;
    if(!isZero){
      if(pending)result.push(pending);
      pending=null;
      continue;
    }
    if(pending && Math.abs(pending.outer-band.inner)<1e-8){
      pending.outer=band.outer;
      pending.keys.push(band.key);
    } else {
      if(pending)result.push(pending);
      pending={inner:band.inner,outer:band.outer,keys:[band.key]};
    }
  }
  if(pending)result.push(pending);
  return Object.freeze(result.map(run=>Object.freeze({
    inner:run.inner,outer:run.outer,
    keys:Object.freeze([...run.keys])
  })));
}
