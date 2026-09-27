// H2.5 evidence-only palette experiment. Never import this file into production.
export const H25_REFERENCE_SHA = "d40f2c1ee05f9269b384a8d0a7bcf9c9dfdc443c";
export const H25_INSTANTS = Object.freeze([
  "2026-09-13T23:43:42.000Z",
  "2026-11-15T07:43:42.000Z"
]);
export const H25_COLORS = Object.freeze({
  current: Object.freeze({ field: "#090b0f", raised: "#0e1116", zodiac: "#424b59" }),
  candidate: Object.freeze({ field: "#0b1019", raised: "#101824", zodiac: "#47556c" })
});
export const H25_VARIANTS = Object.freeze({
  A0: Object.freeze({ label: "production baseline", background: false, zodiac: false }),
  A1: Object.freeze({ label: "background only", background: true, zodiac: false }),
  A2: Object.freeze({ label: "Zodiac only", background: false, zodiac: true }),
  A3: Object.freeze({ label: "background + Zodiac", background: true, zodiac: true })
});

// The background condition changes one *environment group* (reference field,
// raised field, top/bottom gradient, subdued radial ambient). It does not touch
// wheel material, light direction, state fills or selected-instant color.
export function h25OverrideCss(key) {
  const variant = H25_VARIANTS[key];
  if (!variant) throw new Error("Unknown H2.5 palette variant: " + key);
  if (key === "A0") return "";
  const background = variant.background ? `
:root { --field: #0b1019; --field-raised: #101824; }
html { background: var(--field); }
body {
  background:
    radial-gradient(circle at 50% -18%, rgba(126, 149, 181, .06), transparent 37rem),
    linear-gradient(180deg, #101723 0%, var(--field) 68%, #080c14 100%);
}` : "";
  const zodiac = variant.zodiac ? `
:root { --zodiac: #47556c; }` : "";
  return "/* H2.5 isolated color-only experiment: " + key + " */\n" + background + zodiac;
}
