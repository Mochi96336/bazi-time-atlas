import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const hierarchy = readFileSync(new URL("../radial-hierarchy.css", import.meta.url), "utf8");
const atlas = readFileSync(new URL("../kinetic-atlas.css", import.meta.url), "utf8");
const boundaries = readFileSync(new URL("../kinetic-boundaries.css", import.meta.url), "utf8");
const classification = readFileSync(new URL("../classification-overlay.css", import.meta.url), "utf8");

const TEMPORAL_TOKEN_DEFINITION = /--(?:hour|day|month|year|solar|zodiac)\s*:/g;

test("base stylesheet is the single owner of the graphite temporal palette", () => {
  assert.match(atlas, /--hour:\s*#52585b;/);
  assert.match(atlas, /--day:\s*#62696c;/);
  assert.match(atlas, /--month:\s*#777e81;/);
  assert.match(atlas, /--year:\s*#93999b;/);
  assert.match(atlas, /--solar:\s*#bc9257;/);
  assert.match(atlas, /--zodiac:\s*#42495c;/);

  const atlasDefinitions = atlas.match(TEMPORAL_TOKEN_DEFINITION) ?? [];
  assert.equal(atlasDefinitions.length, 6, "kinetic-atlas.css must define each temporal token exactly once");
  assert.doesNotMatch(hierarchy, TEMPORAL_TOKEN_DEFINITION, "radial hierarchy must consume, not redefine, temporal tokens");
  assert.doesNotMatch(boundaries, TEMPORAL_TOKEN_DEFINITION, "boundary presentation must consume, not redefine, temporal tokens");

  for (const ring of ["hour", "day", "month", "year"]) {
    assert.match(hierarchy, new RegExp(`#${ring}-track \\.${ring}-sector \\{ fill: color-mix\\(in srgb, var\\(--${ring}\\)`));
  }
});

test("resting graphite palette does not regress to the former green clock family", () => {
  for (const legacy of ["#6f8983", "#78928b", "#859e96", "#96aaa2", "#c7d9cd"]) {
    assert.doesNotMatch(atlas, new RegExp(legacy, "i"));
  }
  assert.match(atlas, /--bg:\s*#090a0b;/);
  assert.match(atlas, /--accent:\s*#c5c9c7;/);
  assert.match(hierarchy, /achromatic\s+graphite family/);
});

test("annual coordinate colors are token-owned and do not reintroduce literal legacy orange or violet", () => {
  assert.match(hierarchy, /#solar-track \.term-sector \{[\s\S]*?var\(--solar\)/);
  assert.match(hierarchy, /#zodiac-track \.zodiac-sector \{[\s\S]*?var\(--zodiac\)/);
  assert.match(hierarchy, /#solar-track \.term-label[\s\S]*?var\(--solar\)/);
  assert.match(hierarchy, /#zodiac-track \.zodiac-label[\s\S]*?var\(--zodiac\)/);
  assert.doesNotMatch(hierarchy, /rgba\(213,163,109/);
  assert.doesNotMatch(hierarchy, /rgba\(153,139,180/);
});

test("Material I keeps material beds below semantic sectors and luminosity channels", () => {
  assert.match(hierarchy, /Material I keeps the explicit surface stack/);
  assert.match(hierarchy, /m2-solar-brass-bed/);
  assert.match(hierarchy, /m2-zodiac-hard-bed/);
  assert.match(hierarchy, /#m2-solar-brass-surface[\s\S]*?var\(--solar\)/);
  assert.match(hierarchy, /#m2-zodiac-hard-surface[\s\S]*?var\(--zodiac\)/);
  assert.match(hierarchy, /\.m2-ring-material-face \{[\s\S]*?fill:\s*none;[\s\S]*?opacity:\s*0;/);
  assert.doesNotMatch(hierarchy, /background-image:\s*url\(/);
  for (const ring of ["hour", "day", "month", "year"]) {
    assert.doesNotMatch(
      hierarchy,
      new RegExp(`#${ring}-track \\.${ring}-sector \\{[^}]*(?:drop-shadow|filter:\\s*url|fill:\\s*url)`)
    );
  }
  assert.match(hierarchy, /#cursor-layer \.cursor-line \{[\s\S]*?drop-shadow/);
  assert.match(hierarchy, /No resting ring, Solar sector, or Zodiac sector receives glow/);
});

test("year hierarchy no longer borrows the warm Solar or Selected-Instant channel", () => {
  assert.doesNotMatch(hierarchy, /#fff2c9/);
  assert.doesNotMatch(hierarchy, /rgba\(244,236,207/);
  assert.match(hierarchy, /#year-track \.active-cycle-label \{[\s\S]*?fill:\s*#f2f3f2;/);
  assert.match(
    hierarchy,
    /#hour-track \.ring-tick\.major,[\s\S]*?#year-track \.ring-tick\.major \{[\s\S]*?stroke:\s*rgba\(0,0,0,\.50\);/
  );
  assert.match(hierarchy, /#year-track \.ring-tick\.major \{ stroke-width: 1\.35; \}/);
  assert.doesNotMatch(
    hierarchy,
    /#(?:hour|day|month|year)-track \.ring-tick\.major \{[^}]*opacity:/,
    "M2 major-tick styling must not steal scale-emphasis opacity ownership"
  );
  assert.match(atlas, /--cursor:\s*#f4dda0;/);
});

test("categorical multicolor remains opt-in analysis rather than resting clock identity", () => {
  assert.match(classification, /data-classification-overlay="on"\] \.cycle-sector\[data-stem-element=/);
  assert.match(classification, /data-classification-overlay="on"\] \.zodiac-sector\[data-zodiac-element=/);
  assert.match(classification, /--five-wood:/);
  assert.match(classification, /--five-fire:/);
  assert.match(classification, /--five-earth:/);
  assert.match(classification, /--five-metal:/);
  assert.match(classification, /--five-water:/);
});
