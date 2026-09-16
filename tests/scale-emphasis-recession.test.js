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

function sharedRule(firstSelector, lastSelector) {
  const first = firstSelector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const last = lastSelector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${first}[\\s\\S]*?${last}\\s*\\{([^}]*)\\}`, "s"));
  assert.ok(match, `missing shared CSS rule: ${firstSelector} … ${lastSelector}`);
  return match[1];
}

test("scale emphasis keeps coordinate tracks full-strength and recedes resting marks by role", () => {
  const tracks = sharedRule("#hour-track,", "#year-track");
  assert.match(tracks, /--scale-surface-opacity:\s*1;/);
  assert.match(tracks, /--scale-structure-opacity:\s*1;/);
  assert.match(tracks, /--scale-context-opacity:\s*1;/);
  assert.match(tracks, /opacity:\s*1;/);
  assert.match(tracks, /filter:\s*none;/);

  const surfaces = sharedRule(
    "#hour-track .cycle-sector:not(.is-active),",
    "#zodiac-track .zodiac-sector:not(.is-active)"
  );
  assert.match(surfaces, /opacity:\s*var\(--scale-surface-opacity\);/);

  const structure = sharedRule("#hour-track .ring-tick,", "#solar-track .term-mark");
  assert.match(structure, /opacity:\s*var\(--scale-structure-opacity\);/);

  const context = sharedRule(
    "#hour-track .cycle-label:not(.active-cycle-label),",
    "#zodiac-track .zodiac-label:not(.active-cycle-label)"
  );
  assert.match(context, /opacity:\s*var\(--scale-context-opacity\);/);

  const active = sharedRule("#hour-track .cycle-sector.is-active,", "#zodiac-track .active-cycle-label");
  assert.match(active, /opacity:\s*1;/);
  assert.match(active, /filter:\s*none;/);

  assert.doesNotMatch(
    css,
    /data-scale-window="(?:day|year|cycle)"\]\s+#(?:hour|day|solar|zodiac|month|year)-track\s*\{[^}]*\bopacity\s*:/s,
    "scale presets must not dim whole rotating track groups"
  );
  assert.doesNotMatch(
    css,
    /data-scale-window="(?:day|year|cycle)"\]\s+#(?:hour|day|solar|zodiac|month|year)-track\s*\{[^}]*\bfilter\s*:/s,
    "scale presets must not apply brightness/saturation filters to whole tracks"
  );
});

test("48-hour recession is role-specific and preserves a full-strength active channel", () => {
  const solar = rule('#kinetic-instrument[data-scale-window="day"] #solar-track');
  assert.match(solar, /--scale-surface-opacity:\s*\.52;/);
  assert.match(solar, /--scale-structure-opacity:\s*\.62;/);
  assert.match(solar, /--scale-context-opacity:\s*\.70;/);

  const month = rule('#kinetic-instrument[data-scale-window="day"] #month-track');
  assert.match(month, /--scale-surface-opacity:\s*\.38;/);
  assert.match(month, /--scale-structure-opacity:\s*\.50;/);
  assert.match(month, /--scale-context-opacity:\s*\.58;/);

  const year = rule('#kinetic-instrument[data-scale-window="day"] #year-track');
  assert.match(year, /--scale-surface-opacity:\s*\.30;/);
  assert.match(year, /--scale-structure-opacity:\s*\.42;/);
  assert.match(year, /--scale-context-opacity:\s*\.50;/);

  // Hour / Day inherit the full-strength defaults instead of needing a special
  // group-level opacity rule. This keeps focus semantics separate from tracks.
  assert.doesNotMatch(css, /data-scale-window="day"\]\s+#day-track\s*\{[^}]*\bopacity\s*:/s);
  assert.doesNotMatch(css, /data-scale-window="day"\]\s+#hour-track\s*\{[^}]*\bopacity\s*:/s);
});

test("interaction restores resting mark roles without changing the already-full active channel", () => {
  const interaction = sharedRule(
    '#kinetic-wheel[data-hover-ring="hour"] #hour-track,',
    '#kinetic-wheel[data-active-ring="year"] #year-track'
  );
  assert.match(interaction, /--scale-surface-opacity:\s*1;/);
  assert.match(interaction, /--scale-structure-opacity:\s*1;/);
  assert.match(interaction, /--scale-context-opacity:\s*1;/);
  assert.doesNotMatch(interaction, /\bopacity\s*:/);
  assert.doesNotMatch(interaction, /\bfilter\s*:/);
});
