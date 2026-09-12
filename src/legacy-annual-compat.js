import { baziMonths } from "./data.js";
import { hiddenStemsForBranch } from "./calendar/hidden-stems.js";
import { monthPillarForYearStem } from "./calendar/five-tigers.js";

const STEMS = new Set(["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"]);
const params = new URLSearchParams(location.search);
const compat = document.querySelector("#legacy-annual-compat");
const centerValue = document.querySelector("#center-value");
const detailTitle = document.querySelector("#detail-title");
const panel = document.querySelector("#hidden-stems-panel");
const hiddenList = document.querySelector("#legacy-hidden-list");
const fiveTigers = document.querySelector("#legacy-five-tigers");

function normalize(value) {
  return ((value % 360) + 360) % 360;
}

function contains(month, longitude) {
  const angle = normalize(longitude);
  return month.end > month.start
    ? angle >= month.start && angle < month.end
    : angle >= month.start || angle < month.end;
}

function queryLongitude() {
  if (!params.has("lambda")) return Number.NaN;
  return Number(params.get("lambda"));
}

function monthFromQuery() {
  const requested = params.get("month");
  if (requested) {
    const exact = baziMonths.find(month => month.branch === requested);
    if (exact) return exact;
  }
  const longitude = queryLongitude();
  if (Number.isFinite(longitude)) return baziMonths.find(month => contains(month, longitude)) ?? null;
  return null;
}

if (compat) {
  const month = monthFromQuery();
  const rawLongitude = queryLongitude();
  const yearStem = params.get("yearStem");

  if (Number.isFinite(rawLongitude)) {
    compat.dataset.birthProjection = normalize(rawLongitude).toFixed(6);
  }

  if (month) {
    centerValue.textContent = `${month.branch}月`;
    detailTitle.textContent = `${month.branch}月`;
    panel.dataset.hiddenBranch = month.branch;
    panel.open = true;
    hiddenList.replaceChildren();

    hiddenStemsForBranch(month.branch).forEach(stem => {
      const row = document.createElement("span");
      row.dataset.hiddenStem = stem.name;
      row.dataset.hiddenRole = stem.role;
      row.textContent = `${month.branch} · ${stem.name} · ${stem.role}`;
      hiddenList.appendChild(row);
    });

    if (yearStem && STEMS.has(yearStem)) {
      const pillar = monthPillarForYearStem(yearStem, month.branch);
      compat.dataset.fiveTigers = yearStem;
      compat.dataset.monthStem = pillar[0];
      compat.dataset.monthBranch = month.branch;
      fiveTigers.textContent = `年干 ${yearStem} · 目前 ${pillar}月`;
    }
  }
}
