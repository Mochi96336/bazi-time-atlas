// Repair D5 (03): the proof-flow figure mirrors the four determinacy cards so
// the "why" diagram can never disagree with the verdict above it.
const panel = document.querySelector("#four-pillar-determinacy");
const flow = document.querySelector("#pillar-proof-flow");

function sync() {
  if (!panel || !flow) return;
  for (const result of flow.querySelectorAll(".ppf-result[data-pillar]")) {
    const card = panel.querySelector(`[data-determinacy-pillar="${result.dataset.pillar}"]`);
    if (!card) continue;
    const resolved = card.dataset.resolved === "true";
    const answer = card.querySelector(".determinacy-answer")?.textContent?.trim();
    const verdict = card.querySelector(".determinacy-verdict-label")?.textContent?.trim();
    result.dataset.resolved = card.dataset.status === "pending" ? "pending" : String(resolved);
    const strong = result.querySelector("strong");
    const text = resolved ? `${answer ?? "—"} ✓` : `？ ${verdict ?? "未定"}`;
    if (strong && strong.textContent !== text) strong.textContent = text;
  }
  flow.dataset.ready = String(panel.dataset.ready === "true");
}

if (panel && flow) {
  sync();
  new MutationObserver(sync).observe(panel, { subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:["data-resolved", "data-status", "data-ready"] });
}
