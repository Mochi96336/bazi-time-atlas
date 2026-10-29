// Research R22 P6 geometric contract: complete, low-wide semicircular arcs.
// This is an affine y-projection, not a reinterpretation of calendar phases.
export const R22_SEMICIRCLE=Object.freeze({
 fanStart:-180,
 fanEnd:0,
 centerAngle:-90,
 verticalScale:0.66,
 railHalfWidth:6.5,
 cursorHalfLength:17,
 // Original ring radii / order; only their drawn width changes in R22.
 radii:Object.freeze({day:315,year:405,gregorian:505}),
 viewBox:"0 404 1200 446"
});

export function r22EllipsePoint(radius,angleDegrees,cx=600,cy=820){
 if(!Number.isFinite(radius)||radius<0||!Number.isFinite(angleDegrees)){
  throw new RangeError("r22 ellipse radius and angle must be finite nonnegative radius");
 }
 const angle=angleDegrees*Math.PI/180;
 return Object.freeze({
  x:cx+Math.cos(angle)*radius,
  y:cy+Math.sin(angle)*radius*R22_SEMICIRCLE.verticalScale
 });
}

export function r22EllipseSweep(radius,start=-180,end=0){
 if(!(Number.isFinite(radius)&&radius>0&&end>start&&end-start<=180)){
  throw new RangeError("r22 sweep must span a positive arc of 180 degrees or less");
 }
 const startPoint=r22EllipsePoint(radius,start);
 const endPoint=r22EllipsePoint(radius,end);
 const n=v=>Number(v.toFixed(3));
 return `M ${n(startPoint.x)} ${n(startPoint.y)} A ${n(radius)} ${n(radius*R22_SEMICIRCLE.verticalScale)} 0 0 1 ${n(endPoint.x)} ${n(endPoint.y)}`;
}
