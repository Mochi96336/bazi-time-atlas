import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const source = path.resolve("node_modules/tyme4ts/dist/lib/index.mjs");
const targetDir = path.resolve("vendor");
const target = path.join(targetDir, "tyme4ts-1.5.2.mjs");

await mkdir(targetDir, { recursive: true });
await copyFile(source, target);
console.log(`[vendor] ${source} -> ${target}`);

// Repair C3: self-hosted Noto Sans TC (weights 400 and 700), split by
// unicode-range so each page downloads only the glyph chunks it renders.
// Only woff2 sources are staged; every evergreen browser supports woff2.
const FONT_WEIGHTS = [400, 700];
const fontSourceDir = path.resolve("node_modules/@fontsource/noto-sans-tc");
const fontTargetDir = path.join(targetDir, "fonts", "noto-sans-tc");
await mkdir(path.join(fontTargetDir, "files"), { recursive: true });

const cssParts = [];
let fileCount = 0;
for (const weight of FONT_WEIGHTS) {
  const css = await readFile(path.join(fontSourceDir, `${weight}.css`), "utf8");
  const woff2Only = css.replace(/,\s*url\([^)]*\.woff\)\s*format\('woff'\)/g, "");
  const files = [...woff2Only.matchAll(/url\(\.\/files\/([^)]+\.woff2)\)/g)].map(match => match[1]);
  for (const file of files) {
    await copyFile(path.join(fontSourceDir, "files", file), path.join(fontTargetDir, "files", file));
    fileCount += 1;
  }
  cssParts.push(woff2Only);
}
await writeFile(path.join(fontTargetDir, "noto-sans-tc.css"), cssParts.join("\n"));
console.log(`[vendor] Noto Sans TC ${FONT_WEIGHTS.join("/")} -> ${fontTargetDir} (${fileCount} woff2 files)`);
