// Fixed-world wheel content is drawn outside the rotating #kinetic-wheel so a
// ring drag re-rasterises only what actually rotates:
//
//   #kinetic-wheel-under  material beds, fixed reflection, guide arcs
//   #kinetic-wheel        rings, read-heads, motion traces (rotating)
//   #kinetic-wheel-over   lacquer light/shade, then the cursor, in the same
//                         fan clip as the rings
//
// Both static SVGs are their own compositor layers, rasterised once.
// Why: with everything in one SVG, every drag frame re-rasterised the beds,
// reflection and lacquer shading as well (~50% of 4K raster time). Letting
// Chrome split the rings into many overlap layers instead (multiply blend,
// kinetic will-change) exhausted GPU tile memory at 4K and flashed black
// frames. Keeping these two static layers inside the 4K tile budget also
// needs the reading-view legend not to be a full-instrument layer (it is
// display: contents, see atlas-chrome.css).
//
// Paint order is unchanged: beds < reflection < guides < rings < motion <
// light < cursor.
import { SVG_NS } from "./svg-renderer.js";

export const STATIC_UNDER_ID = "kinetic-wheel-under";
export const STATIC_OVER_ID = "kinetic-wheel-over";
export const STATIC_FAN_ID = "kinetic-static-fan";
const FAN_CLIP_ID = "kinetic-master-fan-clip";
const UNDER_GROUP_IDS = ["material-base-layer", "material-reflection-layer", "guide-layer"];
// Order matters: the cursor stays above the lacquer light.
const OVER_GROUP_IDS = ["look-light-layer", "cursor-layer"];
const cameraObservers = new WeakMap();

function staticSvg(doc, wheel, id) {
  let layer = doc.getElementById(id);
  if (layer) return layer;
  layer = doc.createElementNS(SVG_NS, "svg");
  layer.id = id;
  layer.setAttribute("class", `wheel-static-layer ${id}`);
  layer.setAttribute("aria-hidden", "true");
  layer.setAttribute("focusable", "false");
  for (const name of ["viewBox", "preserveAspectRatio"]) {
    const value = wheel.getAttribute(name);
    if (value !== null) layer.setAttribute(name, value);
  }
  return layer;
}

function staticFan(doc, over) {
  let fan = doc.getElementById(STATIC_FAN_ID);
  if (!fan) {
    fan = doc.createElementNS(SVG_NS, "g");
    fan.id = STATIC_FAN_ID;
    // The clip is defined in the wheel's defs; same-document url() references
    // resolve across sibling SVGs.
    fan.setAttribute("clip-path", `url(#${FAN_CLIP_ID})`);
  }
  if (fan.parentNode !== over) over.append(fan);
  return fan;
}

/**
 * Install (idempotently) the static sibling SVGs and move the fixed-world
 * groups into them. Groups created later (wheel-finish.js's lacquer light)
 * place themselves just beneath #cursor-layer, wherever it lives.
 */
export function installStaticWheelLayers(wheel, doc = globalThis.document) {
  if (!wheel?.parentNode || !doc) return null;
  const under = staticSvg(doc, wheel, STATIC_UNDER_ID);
  const over = staticSvg(doc, wheel, STATIC_OVER_ID);
  if (under.nextSibling !== wheel) wheel.parentNode.insertBefore(under, wheel);
  if (wheel.nextSibling !== over) wheel.parentNode.insertBefore(over, wheel.nextSibling);
  const fan = staticFan(doc, over);

  for (const id of UNDER_GROUP_IDS) {
    const group = doc.getElementById(id);
    if (group && group.parentNode !== under) under.append(group);
  }
  for (const id of OVER_GROUP_IDS) {
    const group = doc.getElementById(id);
    if (!group) continue;
    fan.append(group);
    if (group.dataset.fanClipped === "true") group.dataset.fanClipOwner = STATIC_FAN_ID;
  }

  if (!cameraObservers.has(wheel) && typeof MutationObserver === "function") {
    // The responsive camera owns the wheel viewBox; the static layers follow.
    const observer = new MutationObserver(() => {
      for (const layer of [under, over]) {
        for (const name of ["viewBox", "preserveAspectRatio"]) {
          const value = wheel.getAttribute(name);
          if (value === null) layer.removeAttribute(name);
          else if (layer.getAttribute(name) !== value) layer.setAttribute(name, value);
        }
      }
    });
    observer.observe(wheel, { attributes:true, attributeFilter:["viewBox", "preserveAspectRatio"] });
    cameraObservers.set(wheel, observer);
  }
  return { under, over, fan };
}
