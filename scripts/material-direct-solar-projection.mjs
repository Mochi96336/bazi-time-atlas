// Direct-page rendering sanity gate. The SVG CTM marker proves geometry of
// the screenshot process, but not that the last WebGL draw used that geometry.
// The *authentic*, non-iframe material screenshots must preserve Solar's warm
// brass in its canonical SVG annulus before any Zodiac-material proof is valid.
export function solarRegionWarmth(png, mask) {
  if (!png || !Number.isInteger(png.width) || !Number.isInteger(png.height)
    || png.width < 1 || png.height < 1
    || !png.rgb || png.rgb.length !== png.width * png.height * 3
    || !mask || mask.length !== png.width * png.height) {
    throw new Error("Solar projection evidence geometry mismatch");
  }
  let samples = 0, red = 0, blue = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    red += png.rgb[i * 3];
    blue += png.rgb[i * 3 + 2];
    samples++;
  }
  if (samples < 1000) throw new Error("Solar material mask is implausibly small");
  return Object.freeze({
    pixels: samples,
    redMean: Number((red / samples).toFixed(4)),
    blueMean: Number((blue / samples).toFixed(4)),
    redMinusBlue: Number(((red - blue) / samples).toFixed(4))
  });
}

export function assertDirectPageSolarProjection(webgl, svg) {
  for (const value of [webgl, svg]) {
    if (!value || !Number.isInteger(value.pixels) || value.pixels < 1000
      || [value.redMean, value.blueMean, value.redMinusBlue].some(v => !Number.isFinite(v))) {
      throw new Error("Missing or invalid real-page Solar material evidence");
    }
  }
  if (webgl.pixels !== svg.pixels) {
    throw new Error("WebGL/SVG Solar masks differ; cannot infer material parity");
  }
  // Fixed thresholds are a fail-closed geometric sanity check under the
  // unchanged, explicitly warm Solar color authority; not material scores.
  const minimumWebglWarmth = Math.max(8, svg.redMinusBlue * 0.5);
  const minimumWebglRed = svg.redMean * 0.72;
  if (svg.redMinusBlue < 6 || svg.redMean <= svg.blueMean
    || webgl.redMinusBlue < minimumWebglWarmth
    || webgl.redMean < minimumWebglRed) {
    throw new Error(
      "Direct-page WebGL Solar lost its canonical warm annulus; possible stale canvas transform: "
      + JSON.stringify({ webgl, svg, minimumWebglWarmth, minimumWebglRed })
    );
  }
  return Object.freeze({
    passed: true,
    minimumWebglWarmth: Number(minimumWebglWarmth.toFixed(4)),
    minimumWebglRed: Number(minimumWebglRed.toFixed(4)),
    webgl, svg
  });
}
