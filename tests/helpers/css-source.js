// Repair E5: several stylesheets were merged in exact <link> order into a few
// files. Each original source survives as one marked section
// ("/* ==== name.css ==== */"); an @import that was inlined is its own
// "(was @import from …)" section. Tests keep asserting against the same
// source text they were written for.
import { readFileSync } from "node:fs";

const ROOT = new URL("../../", import.meta.url);

export const MERGED_STYLESHEETS = Object.freeze({
  "atlas-wheel.css": ["kinetic-atlas.css", "kinetic-boundaries.css", "discrete-phase.css", "radial-hierarchy.css", "scale-emphasis.css", "classification-overlay.css"],
  "atlas-chrome.css": ["ux-analysis.css", "main-action-hierarchy.css", "mobile-time.css", "mobile-legend.css", "ganzhi-inspector.css", "instrument-first.css"],
  "atlas-tools.css": ["atlas-guide.css", "ring-identity.css", "time-context-control.css", "analysis-first-screen.css", "atlas-solar-time-analysis.css", "inverse-time-search.css", "atlas-visible-ten-gods.css", "analysis-first-screen-polish.css", "analysis-tools-rail.css", "desktop-tools-workspace.css", "graphite-m2-material.css", "selected-instant-editor.css"],
  "research-layout.css": ["recurrence.css", "research-foundations.css", "research-tasks.css", "research-sexagenary-cycle.css", "astronomical-residuals.css", "four-pillar-determinacy.css", "near-recurrence.css", "research-cycle-comparison.css", "research-year-strip-interaction.css", "research-compact-surface.css"],
  "research-sections.css": ["research-color-calibration.css", "research-seasonal-drift-evidence.css", "research-absolute-boundary-consequence.css", "research-time-state.css", "research-entry.css", "research-evidence-reading.css", "research-drift-accumulation.css", "research-story-hierarchy.css", "research-reading.css", "research-evidence-drilldown.css", "research-astronomy-drilldown.css", "research-discrete-density.css", "recurrence-target-clock.css", "research-reading-v2.css"],
  "birth.css": ["birth.css", "birth-advanced.css", "cross-view.css", "ten-gods.css"],
  "birth-panels.css": ["pillar-relations.css", "relation-models.css", "mean-solar-time.css", "branch-punishments.css"]
});

const SOURCE_TO_MERGED = Object.freeze(Object.fromEntries(
  Object.entries(MERGED_STYLESHEETS).flatMap(([merged, sources]) => sources.map(source => [source, merged]))
));

const ANY_BANNER = /\/\* ==== [a-z0-9-]+\.css(?: \(was @import from [a-z0-9-]+\.css\))? ==== \*\/\n?/g;

function sections(text) {
  const found = [];
  for (const match of text.matchAll(ANY_BANNER)) {
    const [, name, from] = match[0].match(/==== ([a-z0-9-]+\.css)(?: \(was @import from ([a-z0-9-]+\.css)\))? ====/);
    found.push({ name, from: from ?? null, start: match.index, bodyStart: match.index + match[0].length });
  }
  for (let index = 0; index < found.length; index += 1) {
    found[index].end = index + 1 < found.length ? found[index + 1].start : text.length;
  }
  return found;
}

export function mergedStylesheetFor(name) {
  return SOURCE_TO_MERGED[name] ?? null;
}

export function cssSource(name) {
  const merged = SOURCE_TO_MERGED[name];
  if (!merged) return readFileSync(new URL(name, ROOT), "utf8");
  const text = readFileSync(new URL(merged, ROOT), "utf8");
  const all = sections(text);
  const own = all.filter(section => section.name === name);
  if (!own.length) throw new Error(`stylesheet section ${name} not found in ${merged}`);
  // A top-level source is its own section(s) without inlined imports; an
  // inlined import is exactly its "(was @import …)" section.
  return own.map(section => text.slice(section.bodyStart, section.end)).join("\n").replace(/^\s+/, "");
}

// Position of a stylesheet in a page's cascade: merged sources sort by the
// merged <link> first, then by their section order inside it.
export function linkPosition(html, name) {
  const merged = SOURCE_TO_MERGED[name];
  if (!merged) {
    const index = html.indexOf(`href="./${name}"`);
    return index < 0 ? -1 : index * 1000;
  }
  const index = html.indexOf(`href="./${merged}"`);
  if (index < 0) return -1;
  return index * 1000 + 1 + MERGED_STYLESHEETS[merged].indexOf(name);
}

export function isLinked(html, name) {
  return linkPosition(html, name) >= 0;
}
