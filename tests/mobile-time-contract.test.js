import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, css, mobileController, kineticAtlas, commandContract] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../mobile-time.css", import.meta.url), "utf8"),
  readFile(new URL("../src/mobile-time-control.js", import.meta.url), "utf8"),
  readFile(new URL("../src/kinetic-atlas.js", import.meta.url), "utf8"),
  readFile(new URL("../src/interaction/selected-instant-command.js", import.meta.url), "utf8")
]);

test("mobile atlas exposes a dedicated second-level exact-time dock", () => {
  assert.match(html, /id="mobile-time-dock"/);
  assert.match(html, /id="mobile-instant-input"[^>]*step="1"/);
  assert.match(html, /id="mobile-time-apply"/);
  assert.match(html, /src="\.\/src\/mobile-time-control\.js"/);
  assert.match(html, /href="\.\/mobile-time\.css"/);
});

test("desktop exact-time precision belongs to desktop markup, not the mobile controller", () => {
  assert.match(html, /id="instant-input"[^>]*step="1"[^>]*data-precision="second"/);
  assert.doesNotMatch(mobileController, /desktopInput|#instant-input/);
});

test("mobile exact time commands the kinetic state owner without reloading the document", () => {
  assert.match(commandContract, /SELECTED_INSTANT_COMMAND\s*=\s*"atlas:set-selected-instant"/);
  assert.match(mobileController, /dispatchEvent\(new CustomEvent\(SELECTED_INSTANT_COMMAND/);
  assert.match(mobileController, /history\.replaceState\(history\.state,\s*"",\s*href\)/);
  assert.doesNotMatch(mobileController, /location\.assign|location\.replace|location\.reload/);
  assert.match(kineticAtlas, /function setSelectedInstant\(instantMs, source = "command"\)/);
  assert.match(kineticAtlas, /instrument\.addEventListener\(SELECTED_INSTANT_COMMAND/);
  assert.match(kineticAtlas, /setSelectedInstant\(instant, "desktop-input"\)/);
});

test("mobile shell scrolls internally while preserving the instrument-first viewport", () => {
  assert.match(css, /@media \(max-width: 480px\)/);
  assert.match(css, /\.kinetic-shell\s*\{[^}]*overflow-y:\s*auto;/s);
  assert.match(css, /\.mobile-time-dock\s*\{[^}]*display:\s*grid;/s);
  assert.match(css, /\.timeline-dock,[\s\S]*\.sources-panel\s*\{\s*display:\s*none;/);
});
