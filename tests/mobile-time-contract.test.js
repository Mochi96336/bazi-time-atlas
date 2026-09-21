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
  assert.match(html, /id="mobile-time-dock"[^>]*data-dirty="false"/);
  assert.match(html, /id="mobile-instant-input"/);
  assert.match(html, /id="mobile-time-apply"/);
  assert.match(html, /src="\.\/src\/mobile-time-control\.js"/);
  assert.match(html, /href="\.\/mobile-time\.css"/);
});

test("mobile visible exact-time format belongs to the mobile controller", () => {
  assert.match(mobileController, /input\.type\s*=\s*"text"/);
  assert.match(mobileController, /input\.removeAttribute\("step"\)/);
  assert.match(mobileController, /input\.placeholder\s*=\s*MOBILE_ATLAS_INPUT_DISPLAY_FORMAT/);
  assert.match(mobileController, /input\.dataset\.displayFormat\s*=\s*MOBILE_ATLAS_INPUT_DISPLAY_FORMAT/);
  assert.match(mobileController, /input\.dataset\.precision\s*=\s*"second"/);
  assert.match(mobileController, /24 小時制/);
  assert.match(mobileController, /function setDirty\(dirty\)/);
  assert.match(mobileController, /input\?\.addEventListener\("input",[\s\S]*?setDirty\(true\)/);
  assert.match(mobileController, /syncFromInstrument\(\);[\s\S]*?setDirty\(false\);[\s\S]*?已套用/);
});

test("desktop exact-time precision belongs to desktop markup, not the mobile controller", () => {
  assert.match(html, /id="instant-input"[^>]*type="datetime-local"[^>]*step="1"[^>]*data-precision="second"/);
  assert.doesNotMatch(mobileController, /desktopInput|#instant-input/);
});

test("mobile exact time commands the kinetic state owner without owning navigation or URL persistence", () => {
  assert.match(commandContract, /SELECTED_INSTANT_COMMAND\s*=\s*"atlas:set-selected-instant"/);
  assert.match(mobileController, /dispatchEvent\(new CustomEvent\(SELECTED_INSTANT_COMMAND/);
  assert.doesNotMatch(mobileController, /history\.replaceState|location\.assign|location\.replace|location\.reload/);
  assert.match(mobileController, /formatMobileAtlasInput\(selectedMs, context\)/);
  assert.match(mobileController, /parseMobileAtlasInput\(input\.value, context\)/);
  assert.match(kineticAtlas, /timeContext:\s*DEFAULT_ATLAS_TIME_CONTEXT/);
  assert.match(kineticAtlas, /atlasTimeContextFromSearch\(location\.search\)/);
  assert.match(kineticAtlas, /function setSelectedInstant\(instantMs, source = "command"\)/);
  assert.match(kineticAtlas, /selectedInstantUrl\(location\.href, instantMs, state\.timeContext\)/);
  assert.match(kineticAtlas, /clearLegacyProjectionUrl\(location\.href\)/);
  assert.match(kineticAtlas, /history\.replaceState\(history\.state,\s*"",\s*href\)/);
  assert.match(kineticAtlas, /instrument\.addEventListener\(SELECTED_INSTANT_COMMAND/);
  assert.match(kineticAtlas, /setSelectedInstant\(instant, "desktop-input"\)/);
  assert.match(kineticAtlas, /setSelectedInstant\(Date\.now\(\), "now"\)/);
});

test("mobile shell scrolls internally while preserving the instrument-first viewport", () => {
  assert.match(css, /@media \(max-width: 480px\)/);
  assert.match(css, /\.kinetic-shell\s*\{[^}]*overflow-y:\s*auto;/s);
  assert.match(css, /\.mobile-time-dock\s*\{[^}]*display:\s*grid;/s);
  assert.match(css, /\.timeline-dock,[\s\S]*\.sources-panel\s*\{\s*display:\s*none;/);
});
