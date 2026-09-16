import { resolveLegacySexagenaryReference } from "./sexagenary-legacy-route.js";

const requestedGanZhi = new URLSearchParams(window.location.search).get("ganzhi");
const reference = resolveLegacySexagenaryReference(requestedGanZhi);

const target = new URL("./", window.location.href);
target.search = "";
target.hash = "";
target.searchParams.set("reference", reference.name);
window.location.replace(target.href);
