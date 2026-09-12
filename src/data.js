export const solarTerms = [
  ["春分", 0, "zhongqi"], ["清明", 15, "jie"], ["穀雨", 30, "zhongqi"],
  ["立夏", 45, "jie"], ["小滿", 60, "zhongqi"], ["芒種", 75, "jie"],
  ["夏至", 90, "zhongqi"], ["小暑", 105, "jie"], ["大暑", 120, "zhongqi"],
  ["立秋", 135, "jie"], ["處暑", 150, "zhongqi"], ["白露", 165, "jie"],
  ["秋分", 180, "zhongqi"], ["寒露", 195, "jie"], ["霜降", 210, "zhongqi"],
  ["立冬", 225, "jie"], ["小雪", 240, "zhongqi"], ["大雪", 255, "jie"],
  ["冬至", 270, "zhongqi"], ["小寒", 285, "jie"], ["大寒", 300, "zhongqi"],
  ["立春", 315, "jie"], ["雨水", 330, "zhongqi"], ["驚蟄", 345, "jie"]
].map(([name, longitude, kind]) => ({ name, longitude, kind }));

export const baziMonths = [
  ["寅", "木", 315, 345, "立春", "驚蟄"], ["卯", "木", 345, 15, "驚蟄", "清明"],
  ["辰", "土", 15, 45, "清明", "立夏"], ["巳", "火", 45, 75, "立夏", "芒種"],
  ["午", "火", 75, 105, "芒種", "小暑"], ["未", "土", 105, 135, "小暑", "立秋"],
  ["申", "金", 135, 165, "立秋", "白露"], ["酉", "金", 165, 195, "白露", "寒露"],
  ["戌", "土", 195, 225, "寒露", "立冬"], ["亥", "水", 225, 255, "立冬", "大雪"],
  ["子", "水", 255, 285, "大雪", "小寒"], ["丑", "土", 285, 315, "小寒", "立春"]
].map(([branch, element, start, end, startTerm, endTerm]) => ({ branch, element, start, end, startTerm, endTerm }));

export const seasons = [
  { name: "春", start: 315, end: 45, startTerm: "立春", endTerm: "立夏" },
  { name: "夏", start: 45, end: 135, startTerm: "立夏", endTerm: "立秋" },
  { name: "秋", start: 135, end: 225, startTerm: "立秋", endTerm: "立冬" },
  { name: "冬", start: 225, end: 315, startTerm: "立冬", endTerm: "立春" }
];

export const zodiacSigns = [
  ["白羊", 0, 30, "火", "基本"], ["金牛", 30, 60, "土", "固定"],
  ["雙子", 60, 90, "風", "變動"], ["巨蟹", 90, 120, "水", "基本"],
  ["獅子", 120, 150, "火", "固定"], ["處女", 150, 180, "土", "變動"],
  ["天秤", 180, 210, "風", "基本"], ["天蠍", 210, 240, "水", "固定"],
  ["射手", 240, 270, "火", "變動"], ["摩羯", 270, 300, "土", "基本"],
  ["水瓶", 300, 330, "風", "固定"], ["雙魚", 330, 360, "水", "變動"]
].map(([name, start, end, element, modality]) => ({ name, start, end, element, modality }));
