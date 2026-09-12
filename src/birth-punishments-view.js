import "./birth-relation-model-overview.js";
import { resolveBirthPillars } from "./calendar/tyme-adapter.js";
import { visiblePillarPunishments } from "./calendar/branch-punishments.js";

const form = document.querySelector("#birth-form");
const panel = document.querySelector("#pillar-relations-panel");
const count = panel?.querySelector(".pillar-relations-count");
const intro = panel?.querySelector(".pillar-relations-intro");
const footnote = panel?.querySelector(".pillar-relations-footnote");

const shortLabels = {
  year: "年",
  month: "月",
  day: "日",
  hour: "時"
};

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function sourceLink(href, text) {
  const link = document.createElement("a");
  link.href = href;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = text;
  return link;
}

function numberFrom(id) {
  const input = document.querySelector(id);
  const value = Number(input?.value);
  if (!input || input.value.trim() === "" || !Number.isFinite(value)) {
    throw new RangeError(`invalid input: ${id}`);
  }
  return value;
}

function currentPillars() {
  const input = {
    year: numberFrom("#birth-year"),
    month: numberFrom("#birth-month"),
    day: numberFrom("#birth-day"),
    hour: numberFrom("#birth-hour"),
    minute: numberFrom("#birth-minute"),
    second: 0
  };
  const utcOffsetHours = numberFrom("#birth-utc-offset");
  const dayBoundary = form.elements.namedItem("day-boundary").value;
  return resolveBirthPillars(input, { dayBoundary, utcOffsetHours }).pillars;
}

let band;
let body;
let empty;

function install() {
  if (!form || !panel || !footnote) return false;

  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "./branch-punishments.css";
  stylesheet.dataset.branchPunishmentStyles = "1";
  document.head.append(stylesheet);

  const summaryTitle = panel.querySelector(".pillar-relations-summary-copy strong");
  if (summaryTitle) summaryTitle.textContent = "四柱表面關係 · 合 / 沖 / 害 / 刑";
  if (intro) {
    intro.textContent = "Pair layer 掃五合／六合／六沖／六害；三支 layer 只認完整三合／三會；刑另保留方向、互刑與重複自刑。全部只看四柱表面明干明支，不把藏干交叉加入。";
  }

  band = node("section", "pillar-punishments-band");
  band.id = "pillar-punishments-band";
  const head = node("div", "pillar-punishments-head");
  head.append(
    node("small", null, "PUNISHMENT STRUCTURE"),
    node("span", null, "方向 / 互刑 / 自刑")
  );
  body = node("div", "pillar-punishments-body");
  empty = node("span", "pillar-punishments-empty", "目前四柱沒有命中這三種刑結構。")
  const note = node("p", "pillar-punishments-note");
  note.append(
    document.createTextNode("本區只保留《三命通會》〈論三刑〉明列的方向、互刑與自刑結構；原文同時記錄部分刑名的另一套稱法，所以 Atlas 不把「無恩／恃勢」等名稱寫入核心。來源："),
    sourceLink("https://zh.wikisource.org/zh-hant/%E4%B8%89%E5%91%BD%E9%80%9A%E6%9C%83/%E5%8D%B7%E4%BA%8C", "《三命通會》卷二 · 論三刑"),
    document.createTextNode("。")
  );
  band.append(head, body, empty, note);
  footnote.insertAdjacentElement("beforebegin", band);

  const footer = document.querySelector(".footer-note");
  if (footer) {
    footer.textContent = "計算精確不代表命理解釋必然。本頁的十神、合沖害刑與完整三合／三會只呈現傳統結構關係，不據此推導性格、吉凶、強弱、喜用神或大運。";
  }
  return true;
}

function pillarNode(pillar, branch) {
  const item = node("span", "punishment-node");
  item.dataset.pillar = pillar;
  item.dataset.branch = branch;
  item.append(
    node("small", null, `${shortLabels[pillar]}支`),
    node("b", null, branch)
  );
  return item;
}

function renderDirected(event) {
  const card = node("article", "pillar-punishment-strip directed");
  card.dataset.punishmentKind = event.kind;
  card.dataset.sourceBranch = event.source.branch;
  card.dataset.targetBranch = event.target.branch;
  card.dataset.sourcePillar = event.source.pillar;
  card.dataset.targetPillar = event.target.pillar;

  const header = node("header", null);
  header.append(node("strong", null, "刑"), node("span", null, `${event.cycle} · 方向鏈`));
  const flow = node("div", "punishment-flow");
  flow.append(
    pillarNode(event.source.pillar, event.source.branch),
    node("i", "punishment-arrow", "→"),
    pillarNode(event.target.pillar, event.target.branch)
  );
  card.append(header, flow);
  return card;
}

function renderMutual(event) {
  const card = node("article", "pillar-punishment-strip mutual");
  card.dataset.punishmentKind = event.kind;
  card.dataset.leftBranch = event.left.branch;
  card.dataset.rightBranch = event.right.branch;
  card.dataset.leftPillar = event.left.pillar;
  card.dataset.rightPillar = event.right.pillar;

  const header = node("header", null);
  header.append(node("strong", null, "互刑"), node("span", null, "子 ↔ 卯"));
  const flow = node("div", "punishment-flow");
  flow.append(
    pillarNode(event.left.pillar, event.left.branch),
    node("i", "punishment-arrow", "↔"),
    pillarNode(event.right.pillar, event.right.branch)
  );
  card.append(header, flow);
  return card;
}

function renderSelf(event) {
  const card = node("article", "pillar-punishment-strip self");
  card.dataset.punishmentKind = event.kind;
  card.dataset.selfBranch = event.branch;
  card.dataset.supportPillars = event.supports.join(",");

  const header = node("header", null);
  header.append(node("strong", null, "自刑"), node("span", null, `${event.branch} × ${event.supports.length}`));
  const flow = node("div", "punishment-flow self-flow");
  event.supports.forEach((pillar, index) => {
    if (index > 0) flow.append(node("i", "punishment-arrow", "＋"));
    flow.append(pillarNode(pillar, event.branch));
  });
  card.append(header, flow);
  return card;
}

function updateSummary(events) {
  if (!count) return;
  const pairCount = Number(count.dataset.relationCount ?? 0);
  const groupCount = Number(count.dataset.groupCount ?? 0);
  count.dataset.punishmentCount = String(events.length);
  count.textContent = `${pairCount} 對 · ${groupCount} 組 · ${events.length} 刑`;
}

function update() {
  if (!band) return;
  try {
    const events = visiblePillarPunishments(currentPillars());
    body.replaceChildren();
    for (const event of events) {
      if (event.kind === "directed") body.append(renderDirected(event));
      else if (event.kind === "mutual") body.append(renderMutual(event));
      else body.append(renderSelf(event));
    }
    empty.hidden = events.length > 0;
    band.hidden = false;
    updateSummary(events);
  } catch {
    body.replaceChildren();
    band.hidden = true;
    updateSummary([]);
  }
}

if (install()) {
  form.addEventListener("input", update);
  form.addEventListener("change", update);
  update();
}
