import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../scale-emphasis.css", import.meta.url), "utf8");

function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "s"));
  assert.ok(match, `missing CSS rule: ${selector}`);
  return match[1];
}

test("48-hour focus keeps Hour and Day unfiltered while outer shells progressively recede", () => {
  const focus = rule('#kinetic-instrument[data-scale-window="day"] #day-track');
  assert.match(focus, /opacity:\s*1;/);
  assert.match(focus, /filter:\s*none;/);

  const solar = rule('#kinetic-instrument[data-scale-window="day"] #zodiac-track');
  assert.match(solar, /opacity:\s*\.40;/);
  assert.match(solar, /saturate\(\.72\)\s+brightness\(\.78\)/);

  const month = rule('#kinetic-instrument[data-scale-window="day"] #month-track');
  assert.match(month, /opacity:\s*\.22;/);
  assert.match(month, /saturate\(\.56\)\s+brightness\(\.62\)/);

  const year = rule('#kinetic-instrument[data-scale-window="day"] #year-track');
  assert.match(year, /opacity:\s*\.14;/);
  assert.match(year, /saturate\(\.48\)\s+brightness\(\.55\)/);
});

test("interaction restores a receded ring to full contrast", () => {
  const interaction = css.match(/#kinetic-wheel\[data-hover-ring="hour"\][\s\S]*?#kinetic-wheel\[data-active-ring="year"\] #year-track\s*\{([^}]*)\}/);
  assert.ok(interaction, "shared ring interaction override must exist");
  assert.match(interaction[1], /opacity:\s*1;/);
  assert.match(interaction[1], /filter:\s*none;/);
});
