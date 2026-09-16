import { DAY_BOUNDARY, resolveBirthPillars } from "./calendar/tyme-adapter.js";
import { apparentSolarLongitude } from "./astronomy/solar-longitude.js";
import { hiddenStemsForBranch } from "./calendar/hidden-stems.js";
import {
  heavenlyStemMeta,
  tenGodForStem,
  tenGodDerivationForDayMaster
} from "./calendar/ten-gods.js";
import { visiblePillarPairRelations } from "./calendar/pillar-relations.js";
import { visiblePillarBranchGroups } from "./calendar/branch-groups.js";

const form = document.querySelector("#birth-form");
const yearInput = document.querySelector("#birth-year");
const monthInput = document.querySelector("#birth-month");
const dayInput = document.querySelector("#birth-day");
const hourInput = document.querySelector("#birth-hour");
const minuteInput = document.querySelector("#birth-minute");
const utcOffsetInput = document.querySelector("#birth-utc-offset");
const readout = document.querySelector("#birth-readout");
const badge = document.querySelector("#boundary-badge");
const errorBox = document.querySelector("#birth-error");
const sensitivity = document.querySelector("#boundary-sensitivity");
const comparison = document.querySelector("#boundary-comparison");
const conventionDay = document.querySelector("#convention-day");
const conventionTime = document.querySelector("#convention-time");
const pillarSummary = document.querySelector(".pillar-summary");
const tenGodPanel = document.querySelector("#ten-gods-panel");
const tenGodGrid = document.querySelector("#ten-gods-grid");
const tenGodDayMaster = document.querySelector("#ten-gods-day-master");
const query = new URLSearchParams(window.location.search);
const forceTenGodOpen = query.get("tenGod") === "1";
const forceRelationsOpen = query.get("relations") === "1";

const pillarTargets = {
  year: document.querySelector("#year-pillar"),
  month: document.querySelector("#month-pillar"),
  day: document.querySelector("#day-pillar"),
  hour: document.querySelector("#hour-pillar")
};

const summaryTargets = {
  year: document.querySelector("#summary-year"),
  month: document.querySelector("#summary-month"),
  day: document.querySelector("#summary-day"),
  hour: document.querySelector("#summary-hour")
};

const summaryLabels = {
  year: "年柱",
  month: "月柱",
  day: "日柱",
  hour: "時柱"
};

const shortPillarLabels = {
  year: "年",
  month: "月",
  day: "日",
  hour: "時"
};

const summaryCells = {};
let annualProjectionLink;
let annualProjectionMeta;
let tenGodDerivation;
let pillarRelationsPanel;
let pillarRelationsCount;
let pillarRelationsGraph;
let pillarRelationsList;
let pillarRelationsEmpty;
let pillarGroupsBody;
const dayRuleNote = document.querySelector("#day-rule-note");

function installCrossViewLinks() {
  for (const [key, node] of Object.entries(summaryTargets)) {
    const cell = node.parentElement;
    summaryCells[key] = cell;
    cell.tabIndex = 0;
    cell.setAttribute("role", "link");
    cell.style.cursor = "pointer";
    cell.querySelector("span").textContent = `${summaryLabels[key]} ↗`;

    const activate = () => {
      if (cell.dataset.href) window.location.href = cell.dataset.href;
    };
    cell.addEventListener("click", activate);
    cell.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate();
      }
    });
  }

  const row = document.createElement("div");
  row.className = "birth-projection-link";
  const label = document.createElement("span");
  label.className = "birth-projection-kicker";
  label.textContent = "出生瞬間 · 太陽黃經";
  annualProjectionLink = document.createElement("a");
  annualProjectionLink.textContent = "λ 270.00°　年度盤精確定位 →";
  annualProjectionMeta = document.createElement("span");
  annualProjectionMeta.className = "birth-projection-meta";
  annualProjectionMeta.textContent = "子月 · 年干乙 · UTC+08:00";
  row.append(label, annualProjectionLink, annualProjectionMeta);
  pillarSummary.insertAdjacentElement("afterend", row);
}

function installTenGodDerivation() {
  tenGodDerivation = document.createElement("section");
  tenGodDerivation.id = "ten-gods-derivation";
  tenGodDerivation.className = "ten-gods-derivation";
  tenGodDerivation.setAttribute("aria-label", "十神由五行方向與陰陽同異推導");
  tenGodGrid.insertAdjacentElement("beforebegin", tenGodDerivation);
}

function installPillarRelations() {
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "./pillar-relations.css";
  stylesheet.dataset.pillarRelationsStyles = "1";
  document.head.append(stylesheet);

  pillarRelationsPanel = document.createElement("details");
  pillarRelationsPanel.id = "pillar-relations-panel";
  pillarRelationsPanel.className = "pillar-relations-panel";
  if (forceRelationsOpen) pillarRelationsPanel.open = true;

  const summary = document.createElement("summary");
  const summaryCopy = node("span", "pillar-relations-summary-copy");
  summaryCopy.append(
    node("small", null, "VISIBLE PILLARS · PAIRS + COMPLETE GROUPS"),
    node("strong", null, "四柱表面關係 · 五合 / 六合 / 六沖 / 三合 / 三會")
  );
  pillarRelationsCount = node("span", "pillar-relations-count", "0 對 · 0 組");
  summary.append(summaryCopy, pillarRelationsCount);

  const intro = node(
    "p",
    "pillar-relations-intro",
    "Pair layer 掃年、月、日、時四柱表面的 6 組柱對；三支 layer 只認四柱中完整出現的三合／三會。兩層都不把藏干交叉加入，也不把缺一支的情況自動當成半合或半會。"
  );

  const graphWrap = node("div", "pillar-relations-graph-wrap");
  pillarRelationsGraph = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  pillarRelationsGraph.classList.add("pillar-relations-graph");
  pillarRelationsGraph.setAttribute("viewBox", "0 0 640 230");
  pillarRelationsGraph.setAttribute("role", "img");
  pillarRelationsGraph.setAttribute("aria-label", "四柱明干明支 pair 關係圖");
  graphWrap.append(pillarRelationsGraph);

  pillarRelationsEmpty = node("span", "pillar-relations-empty");
  pillarRelationsList = node("div", "pillar-relations-list");

  const groupsBand = node("section", "pillar-groups-band");
  const groupsHead = node("div", "pillar-groups-head");
  groupsHead.append(
    node("small", null, "FULL 3-BRANCH SET"),
    node("span", null, "完整三支才顯示")
  );
  pillarGroupsBody = node("div", "pillar-groups-body");
  groupsBand.append(groupsHead, pillarGroupsBody);

  const footnote = node("p", "pillar-relations-footnote");
  footnote.append(
    document.createTextNode("這裡的關係只表示傳統固定成員 membership；不等於合化成立、五行已轉化、力量大小或吉凶判斷。三合完整成員可對照 "),
    sourceLink("https://zh.wikisource.org/zh-hant/%E4%B8%89%E5%91%BD%E9%80%9A%E6%9C%83/%E5%8D%B7%E4%BA%8C", "《三命通會》卷二"),
    document.createTextNode("；寅卯辰、巳午未、申酉戌、亥子丑的連續方位結構可對照 "),
    sourceLink("https://zh.wikisource.org/zh-hant/%E4%B8%89%E5%91%BD%E9%80%9A%E6%9C%83_%28%E5%9B%9B%E5%BA%AB%E5%85%A8%E6%9B%B8%E6%9C%AC%29/%E5%8D%B706", "《三命通會》卷六"),
    document.createTextNode("；今日常用「三會」名稱與完整度邊界另參 "),
    sourceLink("https://wiki.openfate.ai/zh-hant/bazi/classics-schools-cases/case-method-for-three-meeting-frames", "OpenFate 三會局方法"),
    document.createTextNode("。")
  );

  pillarRelationsPanel.append(
    summary,
    intro,
    graphWrap,
    pillarRelationsEmpty,
    pillarRelationsList,
    groupsBand,
    footnote
  );
  tenGodPanel.insertAdjacentElement("afterend", pillarRelationsPanel);

  const footer = document.querySelector(".footer-note");
  if (footer) {
    footer.textContent = "計算精確不代表命理解釋必然。本頁的十神、五合／六合／六沖與完整三合／三會只呈現結構關係，不據此推導性格、吉凶、強弱、喜用神或大運。";
  }
}

function sourceLink(href, text) {
  const link = document.createElement("a");
  link.href = href;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = text;
  return link;
}

function applyBirthQueryInputs() {
  let applied = false;
  const date = query.get("date");
  const dateMatch = date?.match(/^(\d{1,4})-(\d{1,2})-(\d{1,2})$/);
  if (dateMatch) {
    const [, year, month, day] = dateMatch;
    yearInput.value = String(Number(year));
    monthInput.value = String(Number(month));
    dayInput.value = String(Number(day));
    applied = true;
  }

  const time = query.get("time");
  const timeMatch = time?.match(/^(\d{1,2}):(\d{2})$/);
  if (timeMatch) {
    const [, hour, minute] = timeMatch;
    hourInput.value = String(Number(hour));
    minuteInput.value = String(Number(minute));
    applied = true;
  }

  const utc = query.get("utc");
  if (utc !== null && utc.trim() !== "" && Number.isFinite(Number(utc))) {
    utcOffsetInput.value = String(Number(utc));
    applied = true;
  }

  if (applied) form.dataset.queryPreset = "1";
}

function selectedBoundary() {
  return form.elements.namedItem("day-boundary").value;
}

function numberFrom(input) {
  if (input.value.trim() === "") throw new RangeError(`${input.getAttribute("aria-label")}不可空白`);
  const value = Number(input.value);
  if (!Number.isFinite(value)) throw new RangeError(`${input.getAttribute("aria-label")}格式錯誤`);
  return value;
}

function parseInput() {
  return {
    year: numberFrom(yearInput),
    month: numberFrom(monthInput),
    day: numberFrom(dayInput),
    hour: numberFrom(hourInput),
    minute: numberFrom(minuteInput),
    second: 0
  };
}

function parseUtcOffset() {
  const value = numberFrom(utcOffsetInput);
  if (value < -14 || value > 14) {
    throw new RangeError("出生當時 UTC offset 必須介於 -14 到 +14 小時");
  }
  return value;
}

function boundaryLabel(boundary) {
  return boundary === DAY_BOUNDARY.CIVIL_MIDNIGHT
    ? "00:00 午夜換日"
    : "23:00 子初換日";
}

function sameDayAndHour(a, b) {
  return a.pillars.day.name === b.pillars.day.name &&
    a.pillars.hour.name === b.pillars.hour.name;
}

function pad(value, width = 2) {
  return String(value).padStart(width, "0");
}

function formatUtcOffset(offset) {
  const totalMinutes = Math.round(Math.abs(offset) * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const sign = offset < 0 ? "−" : "+";
  return `UTC${sign}${pad(hours)}:${pad(minutes)}`;
}

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function svgNode(tag, attributes = {}, text) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, String(value));
  }
  if (text !== undefined) element.textContent = text;
  return element;
}

function relationMeta(relation) {
  return `${relation.groupLabel} · ${relation.samePolarity ? "同陰陽" : "異陰陽"}`;
}

function renderTenGodDerivation(dayMaster) {
  const dayMeta = heavenlyStemMeta(dayMaster);
  const heading = node("header", "ten-gods-derivation-head");
  const copy = node("div", null);
  copy.append(
    node("small", null, "WHY THIS NAME"),
    node("strong", null, `${dayMaster}日主 · ${dayMeta.yinYang}${dayMeta.element}`),
    node("span", null, "先決定五行方向，再用陰陽同異把每組拆成兩個名稱。")
  );
  heading.append(copy);

  const map = node("div", "ten-gods-relation-map");
  for (const group of tenGodDerivationForDayMaster(dayMaster)) {
    const card = node("article", "ten-gods-relation-group");
    card.dataset.tenGodGroup = group.group;
    card.dataset.targetElement = group.targetElement;

    const head = node("header", null);
    head.append(
      node("span", null, group.groupLabel),
      node("strong", null, group.targetElement)
    );

    const pair = node("div", "ten-gods-polarity-pair");
    for (const [polarity, relation] of [["same", group.same], ["opposite", group.opposite]]) {
      const row = node("div", "ten-gods-polarity-row");
      row.dataset.polarity = polarity;
      row.dataset.stem = relation.other.name;
      row.dataset.tenGod = relation.name;
      row.append(
        node("small", null, polarity === "same" ? "同陰陽" : "異陰陽"),
        node("b", null, relation.other.name),
        node("strong", null, relation.name)
      );
      pair.append(row);
    }

    card.append(head, pair);
    map.append(card);
  }

  tenGodDerivation.replaceChildren(heading, map);
}

function renderTenGodRelationships(pillars) {
  const dayMaster = pillars.day.stem;
  const dayMeta = heavenlyStemMeta(dayMaster);
  tenGodDayMaster.textContent = `${dayMaster} · ${dayMeta.yinYang}${dayMeta.element}`;
  tenGodPanel.hidden = false;
  if (forceTenGodOpen) tenGodPanel.open = true;
  renderTenGodDerivation(dayMaster);
  tenGodGrid.replaceChildren();

  for (const key of ["year", "month", "day", "hour"]) {
    const pillar = pillars[key];
    const card = node("article", "ten-gods-pillar");
    card.dataset.tenGodPillar = key;

    const header = node("header", "ten-gods-pillar-head");
    header.append(
      node("span", null, summaryLabels[key]),
      node("strong", null, pillar.name)
    );

    const visible = node("div", "ten-god-visible");
    visible.dataset.stem = pillar.stem;
    visible.append(node("small", null, key === "day" ? "基準" : "明干"));
    visible.append(node("b", null, pillar.stem));

    if (key === "day") {
      visible.dataset.tenGod = "日主";
      visible.append(node("strong", null, "日主"));
      visible.append(node("span", null, `${dayMeta.yinYang}${dayMeta.element} · reference`));
    } else {
      const relation = tenGodForStem(dayMaster, pillar.stem);
      visible.dataset.tenGod = relation.name;
      visible.append(node("strong", null, relation.name));
      visible.append(node("span", null, relationMeta(relation)));
    }

    const hidden = node("div", "ten-god-hidden");
    hidden.append(node("small", null, `${pillar.branch}藏干`));
    const chips = node("div", "ten-god-chips");

    for (const hiddenStem of hiddenStemsForBranch(pillar.branch)) {
      const relation = tenGodForStem(dayMaster, hiddenStem.name);
      const chip = node("span", "ten-god-chip");
      chip.dataset.hiddenStem = hiddenStem.name;
      chip.dataset.tenGod = relation.name;
      chip.dataset.hiddenRole = hiddenStem.role;
      chip.title = `${hiddenStem.role}藏 ${hiddenStem.name}：${relation.name} · ${relationMeta(relation)}`;
      chip.append(
        node("i", null, hiddenStem.role),
        node("b", null, hiddenStem.name),
        node("strong", null, relation.name)
      );
      chips.append(chip);
    }

    hidden.append(chips);
    card.append(header, visible, hidden);
    tenGodGrid.append(card);
  }
}

function pillarIndex(key) {
  return ["year", "month", "day", "hour"].indexOf(key);
}

function renderCompleteBranchGroups(groups) {
  pillarGroupsBody.replaceChildren();

  if (groups.length === 0) {
    const empty = node(
      "span",
      "pillar-group-empty",
      "目前四柱沒有完整三合／三會。V1 不把只出現兩個成員的情況標成半合或半會。"
    );
    pillarGroupsBody.append(empty);
    return;
  }

  for (const group of groups) {
    const strip = node("article", "pillar-group-strip");
    strip.dataset.groupKind = group.kind;
    strip.dataset.groupElement = group.element;
    strip.dataset.groupMembers = group.members.join("");

    const head = document.createElement("header");
    head.append(
      node("strong", null, group.label),
      node("b", null, group.element),
      node(
        "span",
        null,
        group.kind === "three-meeting"
          ? `${group.season} · ${group.direction}方 · 完整三支`
          : "完整三支"
      )
    );

    const members = node("div", "pillar-group-members");
    for (const support of group.support) {
      const member = node("div", "pillar-group-member");
      member.dataset.groupMember = support.value;
      member.dataset.supportPillars = support.pillars.join(",");
      member.append(
        node("b", null, support.value),
        node("span", null, support.pillars.map(key => `${shortPillarLabels[key]}支`).join(" / ")),
        node("small", null, "member")
      );
      members.append(member);
    }

    strip.append(head, members);
    pillarGroupsBody.append(strip);
  }
}

function renderPillarRelations(pillars) {
  const relations = visiblePillarPairRelations(pillars);
  const groups = visiblePillarBranchGroups(pillars);
  const centers = [80, 240, 400, 560];
  const cardY = 70;
  const cardHeight = 104;
  const cardWidth = 82;
  const stemAnchorY = cardY;
  const branchAnchorY = cardY + cardHeight;

  pillarRelationsPanel.hidden = false;
  if (forceRelationsOpen) pillarRelationsPanel.open = true;
  pillarRelationsCount.textContent = `${relations.length} 對 · ${groups.length} 組`;
  pillarRelationsCount.dataset.relationCount = String(relations.length);
  pillarRelationsCount.dataset.groupCount = String(groups.length);
  pillarRelationsGraph.replaceChildren();
  pillarRelationsList.replaceChildren();

  pillarRelationsGraph.append(
    svgNode("text", { x: 18, y: 112, class: "relation-axis-label" }, "天干"),
    svgNode("text", { x: 18, y: 155, class: "relation-axis-label" }, "地支")
  );

  relations.forEach((relation, relationIndex) => {
    const leftIndex = pillarIndex(relation.left.pillar);
    const rightIndex = pillarIndex(relation.right.pillar);
    const x1 = centers[leftIndex];
    const x2 = centers[rightIndex];
    const span = Math.max(1, rightIndex - leftIndex);
    const isStem = relation.domain === "stem";
    const y = isStem ? stemAnchorY : branchAnchorY;
    const controlY = isStem
      ? Math.max(8, 50 - span * 10 - relationIndex * 2)
      : Math.min(226, 198 + span * 7 + relationIndex * 2);
    const midX = (x1 + x2) / 2;
    const midY = (y + controlY) / 2;
    const group = svgNode("g", {
      "data-relation-domain": relation.domain,
      "data-relation-kind": relation.kind,
      "data-left-pillar": relation.left.pillar,
      "data-right-pillar": relation.right.pillar
    });
    group.append(
      svgNode("path", {
        d: `M ${x1} ${y} Q ${midX} ${controlY} ${x2} ${y}`,
        class: `relation-path ${relation.kind}`
      }),
      svgNode("rect", {
        x: midX - 22,
        y: midY - 8,
        width: 44,
        height: 16,
        rx: 8,
        class: "relation-label-bg"
      }),
      svgNode("text", {
        x: midX,
        y: midY + 0.5,
        class: `relation-label ${relation.kind}`
      }, relation.label)
    );
    pillarRelationsGraph.append(group);
  });

  for (const [index, key] of ["year", "month", "day", "hour"].entries()) {
    const center = centers[index];
    const pillar = pillars[key];
    const group = svgNode("g", { "data-pillar-node": key });
    group.append(
      svgNode("rect", {
        x: center - cardWidth / 2,
        y: cardY,
        width: cardWidth,
        height: cardHeight,
        rx: 13,
        class: `pillar-card${key === "day" ? " day" : ""}`
      }),
      svgNode("text", { x: center, y: 89, class: "pillar-name" }, `${shortPillarLabels[key]}柱`),
      svgNode("text", { x: center, y: 119, class: "stem-value" }, pillar.stem),
      svgNode("line", {
        x1: center - 25,
        y1: 137,
        x2: center + 25,
        y2: 137,
        class: "pillar-divider"
      }),
      svgNode("text", { x: center, y: 157, class: "branch-value" }, pillar.branch)
    );
    pillarRelationsGraph.append(group);
  }

  if (relations.length === 0) {
    pillarRelationsEmpty.hidden = false;
    pillarRelationsEmpty.textContent = "目前四柱在五合／六合／六沖中沒有 pair 命中；完整三支組另見下方。";
  } else {
    pillarRelationsEmpty.hidden = true;
    pillarRelationsEmpty.textContent = "";
  }

  for (const relation of relations) {
    const chip = node("span", "pillar-relation-chip");
    chip.dataset.relationDomain = relation.domain;
    chip.dataset.relationKind = relation.kind;
    const domainLabel = relation.domain === "stem" ? "干" : "支";
    chip.append(
      node("span", null, `${shortPillarLabels[relation.left.pillar]}${domainLabel}`),
      node("b", null, relation.left.value),
      node("i", null, "—"),
      node("strong", null, relation.label),
      node("i", null, "—"),
      node("span", null, `${shortPillarLabels[relation.right.pillar]}${domainLabel}`),
      node("b", null, relation.right.value)
    );
    pillarRelationsList.append(chip);
  }

  renderCompleteBranchGroups(groups);
}

function renderResult(result, longitude, utcOffsetHours) {
  const { input, pillars, convention } = result;
  readout.textContent = `${pad(input.year, 4)}-${pad(input.month)}-${pad(input.day)} · ${pad(input.hour)}:${pad(input.minute)}`;
  badge.textContent = boundaryLabel(convention.dayBoundary);
  conventionDay.textContent = convention.dayBoundary === DAY_BOUNDARY.CIVIL_MIDNIGHT ? "00:00 換日" : "23:00 換日";
  conventionTime.textContent = `${formatUtcOffset(utcOffsetHours)} · 當地民用`;
  dayRuleNote.textContent = convention.dayBoundary === DAY_BOUNDARY.CIVIL_MIDNIGHT
    ? "00:00 才進入下一干支日"
    : "23:00 起計下一干支日";

  for (const key of Object.keys(pillarTargets)) {
    pillarTargets[key].textContent = pillars[key].name;
    summaryTargets[key].textContent = pillars[key].name;
  }

  renderTenGodRelationships(pillars);
  renderPillarRelations(pillars);

  annualProjectionLink.textContent = `λ ${longitude.toFixed(2)}°　年度盤精確定位 →`;
  annualProjectionMeta.textContent = `${pillars.month.branch}月 · 年干${pillars.year.stem} · ${formatUtcOffset(utcOffsetHours)}`;
}

function renderSensitivity(input, currentBoundary, utcOffsetHours) {
  const alternativeBoundary = currentBoundary === DAY_BOUNDARY.CIVIL_MIDNIGHT
    ? DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY
    : DAY_BOUNDARY.CIVIL_MIDNIGHT;
  const current = resolveBirthPillars(input, {
    dayBoundary: currentBoundary,
    utcOffsetHours
  });
  const alternative = resolveBirthPillars(input, {
    dayBoundary: alternativeBoundary,
    utcOffsetHours
  });

  if (sameDayAndHour(current, alternative)) {
    sensitivity.hidden = true;
    comparison.textContent = "";
    return;
  }

  sensitivity.hidden = false;
  comparison.textContent = `${boundaryLabel(currentBoundary)}：${current.pillars.day.name}日・${current.pillars.hour.name}時；${boundaryLabel(alternativeBoundary)}：${alternative.pillars.day.name}日・${alternative.pillars.hour.name}時。`;
}

function update() {
  errorBox.hidden = true;
  try {
    const input = parseInput();
    const utcOffsetHours = parseUtcOffset();
    const boundary = selectedBoundary();
    const result = resolveBirthPillars(input, {
      dayBoundary: boundary,
      utcOffsetHours
    });
    const longitude = apparentSolarLongitude(input, utcOffsetHours);
    renderResult(result, longitude, utcOffsetHours);
    renderSensitivity(input, boundary, utcOffsetHours);
  } catch (error) {
    sensitivity.hidden = true;
    tenGodPanel.hidden = true;
    pillarRelationsPanel.hidden = true;
    errorBox.hidden = false;
    errorBox.textContent = `無法計算：${error.message}`;
  }
}

installCrossViewLinks();
installTenGodDerivation();
installPillarRelations();
applyBirthQueryInputs();
form.addEventListener("input", update);
form.addEventListener("change", update);
update();