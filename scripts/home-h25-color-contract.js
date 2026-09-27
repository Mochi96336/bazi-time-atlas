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

// These are deliberately grouped *environment* changes, NOT a global tint of
// every ring. B1 retains the original reference field completely; B2 adds
// only a restrained shift. A1/A3 are preserved for valid earlier comparison.
export const H25_ENVIRONMENTS = Object.freeze({
  current: Object.freeze({
    field: "#090b0f", raised: "#0e1116", gradient: null
  }),
  full: Object.freeze({
    field: "#0b1019", raised: "#101824",
    gradient: "radial-gradient(circle at 50% -18%, rgba(126, 149, 181, .06), transparent 37rem), " +
      "linear-gradient(180deg, #101723 0%, var(--field) 68%, #080c14 100%)"
  }),
  ambient: Object.freeze({
    field: "#090b0f", raised: "#0e1116",
    gradient: "radial-gradient(circle at 50% -18%, rgba(123, 145, 171, .043), transparent 30rem), " +
      "linear-gradient(180deg, #0e121a 0%, var(--field) 68%, #070a0f 100%)"
  }),
  restrained: Object.freeze({
    field: "#0a0d13", raised: "#0e121a",
    gradient: "radial-gradient(circle at 50% -18%, rgba(121, 145, 173, .044), transparent 30rem), " +
      "linear-gradient(180deg, #0e141d 0%, var(--field) 68%, #080a10 100%)"
  })
});
export const H25_VARIANTS = Object.freeze({
  A0: Object.freeze({ label: "production baseline", background: false, zodiac: false, environment: "current" }),
  A1: Object.freeze({ label: "full cool field only", background: true, zodiac: false, environment: "full" }),
  A2: Object.freeze({ label: "Zodiac only", background: false, zodiac: true, environment: "current" }),
  A3: Object.freeze({ label: "full cool field + Zodiac", background: true, zodiac: true, environment: "full" }),
  B1: Object.freeze({ label: "original field + slightly cooler environmental light", background: true, zodiac: false, environment: "ambient" }),
  B2: Object.freeze({ label: "restrained cool field only", background: true, zodiac: false, environment: "restrained" }),
  B3: Object.freeze({ label: "restrained cool field + unchanged A2 Zodiac", background: true, zodiac: true, environment: "restrained" })
});
export function h25ExpectedColors(key) {
  const variant = H25_VARIANTS[key];
  if (!variant) throw new Error("Unknown H2.5 palette variant: " + key);
  const environment = H25_ENVIRONMENTS[variant.environment];
  return Object.freeze({
    field: environment.field, raised: environment.raised,
    zodiac: variant.zodiac ? H25_COLORS.candidate.zodiac : H25_COLORS.current.zodiac
  });
}

// The CSS is attached to the isolated same-origin capture iframe only. The
// resting Zodiac shader's separate hard-coded tints intentionally remain old
// in this phase, exposing parity work still needed in a separate trial.
export function h25OverrideCss(key) {
  const variant = H25_VARIANTS[key];
  if (!variant) throw new Error("Unknown H2.5 palette variant: " + key);
  if (key === "A0") return "";
  const env = H25_ENVIRONMENTS[variant.environment];
  const background = variant.background ? `
:root { --field: ${env.field}; --field-raised: ${env.raised}; }
html { background: var(--field); }
body { background: ${env.gradient}; }` : "";
  const zodiac = variant.zodiac ? `
:root { --zodiac: #47556c; }` : "";
  return "/* H2.5 isolated color-only experiment: " + key + " */\n" + background + zodiac;
}
