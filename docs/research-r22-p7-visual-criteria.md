# R22 P7｜視覺判準先於修形狀

## 為什麼需要這份判準
P5 的 160° 厚扇區雖有重量，卻擁擠且偏離主頁的低寬半圓；P6 的 180° 半橢圓幾何正確，卻把每個軌道減成 13px 的平面亮線，中央基準甚至像一根貫穿三層的儀表指針。功能與自動化測試皆通過，**但沒有證明 P6 的造型比 P5 好**。後續不再把測試通過當成美感驗收。

## 對作品有效的優先順序
1. **遠觀輪廓與視覺質量**：第一眼應是三層彼此相關、低寬而有重量的半圓，不是張開的扇子，也不是幾條無意義的細線。
2. **讀出接近共同零點的程度**：看主圖便能定位三層標記與同一個零點；明確的局部對齊比 40/60 個細分數字更重要。
3. **同一套材質語言**：沿用首頁 Graphite / Brass / Purple 質地與低彩度差別。視覺重量應來自柔和帶狀表面、明暗與適度分節，不是提高所有刻度的亮度。
4. **負空間有任務**：三層弧線之間保留足夠空氣，但「空」不能讓主圖消失；中央基準是幾何共用關係，不應長得像單一機械指針。
5. **數值忠實**：相位只展示摺疊後最短有號差值，不能用假連續旋轉表現每年超過六圈的日序。
6. **先比較後接受**：每輪至少比較同一 Δ 的 320、390 和 1440px 實際瀏覽器截圖；同時保留先前 P5/P6 作對照，區分「看起來清楚」與「可以讀出關係」。

## 參照知識與具體應用
- Nielsen Norman Group [5 Principles of Visual Design in UX](https://www.nngroup.com/articles/principles-visual-design/)：視覺層次必須安排視線的閱讀順序；R22 應先看到弧線及差值，不是刻度。
- Nielsen Norman Group [Proximity Principle in Visual Design](https://www.nngroup.com/articles/gestalt-proximity/)：空間距離暗示相關性；零點提示需要分別依附三個軌道，不能錯認為另一條輪。
- IBM Design Language [Data Visualization: Design Basics](https://www.ibm.com/design/language/data-visualization/design/basics/)：色彩、線重、紋理都應有視覺編碼目的；不只壓低線條重量。
- European Data Portal [Chart junk and data ink: origins](https://data.europa.eu/apps/data-visualisation-guide/chart-junk-and-data-ink-origins)：資訊簡化不是風格教條；須避免把有助理解的圖形體量一併削去。
- IBM Design Language [Data Visualization: Overview](https://www.ibm.com/design/language/data-visualization/overview/)：結構、節奏、比例與表達的訊息須一致，不能讓美化暗示不實數值。

## P7 有限度的改動
僅 R22 experimental opt-in（`?r22=1`）：
- 保留 P6 真 180°、0.66 橢圓壓縮和三層半徑；適度恢復約 26px 的有重量帶狀軌道，仍遠薄於 P5 的 90px 充滿式扇片。
- 低彩度材質層次與有限的主要刻度，不把每個細分格切出高對比網格。
- 把唯一的貫穿式基準直線換成三段附著於各軌道的短基準標記；三者共用同角度 −90°，不是三個獨立時間零點。
- 閉合時由金色標記呈現零點，避免再在同一點堆疊重複的 0 字。
- 原始 `#recurrence-wheel`、三個真正相位、唯一 `setDelta`、四柱及 R16 預設皆不動。

## 驗收規則
自動化驗證只能否決幾何誤差、來源混淆、位移、溢出、按鈕錯誤；不會自行宣布「較好看」。若實際截圖在遠觀輪廓、材質關聯或零點辨識任一面向劣於 P6，先撤回 P7 表現，保留其診斷資料；**PR 保持 Draft，不合併**。
