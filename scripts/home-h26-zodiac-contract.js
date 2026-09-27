// H2.6 Zodiac substrate *evidence-only* experiment.
// The real project must never import this module from runtime.
export const H26_REFERENCE_SHA = "53128d67b502f740415bcd96b14b222f40e264f2";
export const H26_INSTANTS = Object.freeze([
  "2026-09-13T23:43:42.000Z",
  "2026-11-15T07:43:42.000Z"
]);
export const H26_VARIANTS = Object.freeze({
  V0: Object.freeze({label:"unchanged B2 background + production Zodiac", optIn:false}),
  V1: Object.freeze({label:"same Zodiac hue and shader; stronger existing substrate directional falloff", optIn:true})
});
export const H26_EXPECTED_TOKENS = Object.freeze({
  field:"#0a0d13",raised:"#0e121a",zodiac:"#424b59",
  solar:"#ac906e",hour:"#555d62",day:"#646c71",
  month:"#777f84",year:"#90989d",cursor:"#f4dda0"
});
export const H26_ZODIAC_STOP_OPACITY = Object.freeze({
  V0:Object.freeze({light:".25",mid:".19",dark:".18"}),
  V1:Object.freeze({light:".32",mid:".18",dark:".15"})
});
export function h26OverrideCss(variant) {
  if (!(variant in H26_VARIANTS)) throw Error("Invalid H2.6 case: "+variant);
  if (variant==="V0") return "";
  return `/* H2.6 reversible isolated Zodiac substrate study, never production */
#m2-zodiac-hard-surface .m2-zodiac-light { stop-opacity: .32; }
#m2-zodiac-hard-surface .m2-zodiac-mid { stop-opacity: .18; }
#m2-zodiac-hard-surface .m2-zodiac-dark { stop-opacity: .15; }`;
}
