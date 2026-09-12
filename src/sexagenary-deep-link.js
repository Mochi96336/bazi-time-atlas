import "./sexagenary.js";
import { sexagenaryCycle } from "./sexagenary-data.js";

const requestedGanZhi = new URLSearchParams(window.location.search).get("ganzhi");
const index = sexagenaryCycle.findIndex(item => item.name === requestedGanZhi);

if (index >= 0) {
  document.querySelector(`[data-cycle-index="${index}"]`)?.click();
}
