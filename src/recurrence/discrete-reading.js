// Reader-facing interpretation of the three *discrete* recurrence gauges.
// Not a BaZi four-pillar verdict: actual Jie boundaries and target clock
// authority belong to Research 02/03, never to this display helper.
export function explainDiscreteResult(state, localYears) {
  if (!state.targetValid) {
    return "比較日期在公曆中不存在；日序無法比較。請改選有效日期後再判斷閉合。";
  }
  if (state.deltaYears === 0) {
    return "基準點：三個離散相位都是 0；這是起點，不是跨年後的重遇。";
  }

  const { gregorian, yearSequence, day } = state.closed;
  if (gregorian && yearSequence && day) {
    return "三個離散相位同時歸零；只證明離散候選，還要在 02 檢查十二節界，不能直接當作四柱週期。";
  }
  if (state.deltaYears === localYears && yearSequence && day) {
    return "此起點 60 年序＋60 日序首次重遇；公曆結構仍未歸零，還缺季節位置的代理條件。";
  }
  if (gregorian && yearSequence) {
    return "公曆結構＋60 年序閉合；60 日序仍偏，因此還不是三圈同時歸零。";
  }
  if (gregorian && day) {
    return "公曆結構＋60 日序閉合；60 年序仍偏，因此還不是三圈同時歸零。";
  }
  if (yearSequence && day) {
    return "60 年序＋60 日序已歸零；公曆結構尚未回到基準，不能直接推成節界重合。";
  }
  if (gregorian) {
    return "公曆結構回原位；60 年序與 60 日序仍未歸零。這只是日曆結構對齊，不代表節界重現。";
  }
  if (yearSequence) {
    return "只有 60 年序歸零；公曆結構與 60 日序仍偏，三圈沒有同時重遇。";
  }
  if (day) {
    return "只有 60 日序歸零；公曆結構與 60 年序仍偏，三圈沒有同時重遇。";
  }
  return "三圈都未歸零；下方相位數字表示各圈離基準還差多少循環格。";
}
