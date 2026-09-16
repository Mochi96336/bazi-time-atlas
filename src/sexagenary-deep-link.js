import "./sexagenary.js";
import { sexagenaryReferenceByName } from "./ganzhi-inspector-model.js";

const requestedGanZhi = new URLSearchParams(window.location.search).get("ganzhi");
const reference = sexagenaryReferenceByName(requestedGanZhi);

if (reference) {
  const target = new URL("./", window.location.href);
  target.search = "";
  target.hash = "";
  target.searchParams.set("reference", reference.name);
  window.location.replace(target.href);
}
