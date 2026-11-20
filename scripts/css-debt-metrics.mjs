// Repair C5: CSS debt metrics shared by the ratchet test and the baseline
// writer. Counts per stylesheet: !important declarations, distinct hex colors
// and HTML font-size declarations below 12 px (SVG text rules excluded).
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const SVG_SELECTOR = /(^|[\s>+~,(])(svg|text|tspan|textPath)([\s.#:[,>+~)]|$)/;

export function cssFiles(root) {
  return readdirSync(root).filter(name => name.endsWith(".css")).sort();
}

export function smallFontDeclarations(css) {
  const stack = [];
  let count = 0;
  const token = /[{}]|font-size\s*:\s*([0-9]*\.?[0-9]+)(px|rem)/g;
  let match;
  while ((match = token.exec(css))) {
    if (match[0] === "{") {
      const before = css.slice(0, match.index);
      const start = Math.max(before.lastIndexOf("{"), before.lastIndexOf("}"), before.lastIndexOf(";"));
      stack.push(before.slice(start + 1).trim());
    } else if (match[0] === "}") {
      stack.pop();
    } else {
      const px = Number(match[1]) * (match[2] === "rem" ? 16 : 1);
      const selector = stack.at(-1) ?? "";
      if (px < 12 && !SVG_SELECTOR.test(selector) && !selector.startsWith("@")) count += 1;
    }
  }
  return count;
}

export function cssDebtMetrics(root) {
  const metrics = {};
  for (const file of cssFiles(root)) {
    const css = readFileSync(path.join(root, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    metrics[file] = {
      important: (css.match(/!important/g) ?? []).length,
      hexColors: new Set((css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).map(hex => hex.toLowerCase())).size,
      smallFonts: smallFontDeclarations(css)
    };
  }
  return metrics;
}

// node scripts/css-debt-metrics.mjs --write  → refresh the committed baseline
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"))) {
  const root = path.resolve(".");
  const metrics = cssDebtMetrics(root);
  const totals = Object.values(metrics).reduce((sum, item) => ({
    important: sum.important + item.important,
    hexColors: sum.hexColors + item.hexColors,
    smallFonts: sum.smallFonts + item.smallFonts
  }), { important:0, hexColors:0, smallFonts:0 });
  if (process.argv.includes("--write")) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync("tests/fixtures/css-debt-baseline.json", JSON.stringify(metrics, null, 2) + "\n");
    console.log("[css-debt] baseline written", totals);
  } else {
    console.log("[css-debt]", totals);
  }
}
