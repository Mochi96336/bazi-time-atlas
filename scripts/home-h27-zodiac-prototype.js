// H2.7 evidence-only DOM material prototypes. Never import from production.
import { RADII, WHEEL_CENTER } from "../src/wheel/ring-model.js";

export const H27_REFERENCE_SHA = "6c594e37cb2dbf66027de7c67cdc466a773b1401";
export const H27_INSTANTS = Object.freeze([
  "2026-09-13T23:43:42.000Z",
  "2026-11-15T07:43:42.000Z"
]);
export const H27_VARIANTS = Object.freeze({
  C0: "unmodified production control",
  C1: "recessed neutral slate annulus with broad radial chamfer",
  C2: "C1 plus fixed-world broad brushed-satin directional response"
});
export const H27_TOKENS = Object.freeze({
  field:"#0a0d13",raised:"#0e121a",zodiac:"#424b59",solar:"#ac906e",
  hour:"#555d62",day:"#646c71",month:"#777f84",year:"#90989d",
  cursor:"#f4dda0"
});
const SVG = "http://www.w3.org/2000/svg";
const add = (parent,tag,attrs) => {
  const node=parent.ownerDocument.createElementNS(SVG,tag);
  for(const [key,value] of Object.entries(attrs))node.setAttribute(key,String(value));
  parent.append(node);
  return node;
};
const addStop = (gradient,offset,color,alpha) =>
  add(gradient,"stop",{"offset":offset,"stop-color":color,"stop-opacity":alpha});
const pct = relative => (RADII.solarTermOuter +
  (RADII.solarOuter-RADII.solarTermOuter)*relative)/RADII.solarOuter;

// Produce all appearance differences by inserting geometry-cloned *fixed*
// presentation paths into the authentic wheel's existing material base layer.
// The paths inherit the exact canonical Zodiac annulus without deriving a new
// phase, solar-longitude value or hand-authored ring projection.
export function applyH27Prototype(doc,variant) {
  if(!Object.hasOwn(H27_VARIANTS,variant))throw Error("unknown H2.7 variant "+variant);
  const svg=doc.querySelector("#kinetic-wheel");
  const original=svg?.querySelector(".m2-zodiac-hard-bed");
  const defs=svg?.querySelector("defs");
  if(!original||!defs||!original.getAttribute("d"))throw Error("canonical Zodiac material substrate unavailable");
  if(svg.querySelector("[data-h27-structural-probe]"))throw Error("duplicate H2.7 material injection");
  if(variant==="C0")return Object.freeze({inserted:0,gradients:0,canonicalPath:original.getAttribute("d")});
  const band=add(defs,"radialGradient",{
    id:"h27-zodiac-recessed-slate",gradientUnits:"userSpaceOnUse",
    cx:WHEEL_CENTER.x,cy:WHEEL_CENTER.y,r:RADII.solarOuter,
    fx:WHEEL_CENTER.x,fy:WHEEL_CENTER.y
  });
  // Six broad interval stops across the existing 60-svg-unit annual band.
  // Soft material gradient, NOT another fine pattern or bright ring outline.
  [
    [0.00,"#070c13",0.34],
    [0.13,"#53606c",0.24],
    [0.35,"#2f3b47",0.34],
    [0.66,"#27313d",0.38],
    [0.89,"#131d27",0.49],
    [1.00,"#080e16",0.55]
  ].forEach(([t,color,alpha])=>addStop(band,pct(t),color,alpha));
  const makeSurface=(id,gradient,after=original)=>{
    const path=doc.createElementNS(SVG,"path");
    path.setAttribute("d",original.getAttribute("d"));
    path.setAttribute("fill","url(#"+gradient+")");
    path.setAttribute("class","h27-zodiac-presentation");
    path.setAttribute("pointer-events","none");
    path.setAttribute("aria-hidden","true");
    path.dataset.h27StructuralProbe=id;
    after.after(path);
    return path;
  };
  const first=makeSurface("recess",band.id);
  if(variant==="C1")return Object.freeze({inserted:1,gradients:1,canonicalPath:first.getAttribute("d")});
  // C2 deliberately builds on exactly C1. Satin follows the existing fixed-
  // world upper-left lighting direction; it does NOT rotate with Zodiac signs.
  const satin=add(defs,"linearGradient",{
    id:"h27-zodiac-fixed-world-satin",gradientUnits:"userSpaceOnUse",
    x1:WHEEL_CENTER.x-700,y1:WHEEL_CENTER.y-760,
    x2:WHEEL_CENTER.x+700,y2:WHEEL_CENTER.y+760
  });
  [
    [0,"#9aa6b0",0.24],
    [0.29,"#84929e",0.18],
    [0.58,"#485866",0.09],
    [1,"#141e27",0.10]
  ].forEach(([offset,color,alpha])=>addStop(satin,offset,color,alpha));
  // Appending after the recessed surface makes the response read as a
  // material property, not a floating stroke or a separate rotating ring.
  const second=makeSurface("satin",satin.id,first);
  if(second.getAttribute("d")!==first.getAttribute("d"))throw Error("prototype geometry changed");
  return Object.freeze({inserted:2,gradients:2,canonicalPath:first.getAttribute("d")});
}
