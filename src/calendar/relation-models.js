function freezeFamily(family) {
  return Object.freeze({
    ...family,
    labels: Object.freeze([...family.labels]),
    ...(family.modes ? { modes: Object.freeze(family.modes.map(mode => Object.freeze({ ...mode }))) } : {})
  });
}

export const RELATION_MODEL_FAMILIES = Object.freeze([
  freezeFamily({
    id: "pair",
    topology: "unordered-pair",
    memberCount: 2,
    kicker: "2-MEMBER",
    title: "對稱 pair",
    summary: "只問兩個可見干支是否屬於固定配對；順序不改變 membership。",
    labels: ["五合", "六合", "六沖", "六害"]
  }),
  freezeFamily({
    id: "complete-group",
    topology: "complete-set",
    memberCount: 3,
    kicker: "3-MEMBER",
    title: "完整三支",
    summary: "三個指定地支必須全部出現才成立；V1 不把兩支自動升格成半合或半會。",
    labels: ["三合", "三會"]
  }),
  freezeFamily({
    id: "punishment",
    topology: "directed-reciprocal-self",
    memberCount: null,
    kicker: "STRUCTURE",
    title: "刑的拓撲",
    summary: "刑保留方向、互相與重複自刑三種不同結構，因此不能降成普通無方向 pair。",
    labels: ["方向刑", "互刑", "自刑"],
    modes: [
      { id: "directed", glyph: "→", label: "方向" },
      { id: "mutual", glyph: "↔", label: "互刑" },
      { id: "self", glyph: "×2", label: "重複" }
    ]
  })
]);

export function relationModelFamily(id) {
  const family = RELATION_MODEL_FAMILIES.find(item => item.id === id);
  if (!family) throw new RangeError(`unknown relation model family: ${id}`);
  return family;
}
