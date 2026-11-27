# 研究頁交接（2026-11-28）

給接手的人或 agent。先讀這份，細節再查 `docs/research-scenes-plan.md`（§8 設計紀錄、§9 正式版計畫與第一段紀錄）。

## 這是什麼

研究頁是首頁輪盤的「捲動敘事」模式：同一頁、同一個輪盤，網址 `./?view=research`。讀者往下捲，輪盤照場景轉動，回答「同一組八字，多久會再出現一次？」。

原型（已定稿的設計）：`prototypes/research-scenes/scroll.html` + `scroll.js`。正式版是把原型移植到首頁輪盤上，並遵守效能規則。

## 目前進度

分支 `research-scroll`。

**第一段完成**：架構、開場、序、一 曆法（場景 open0, open1, split, merge, sun, c11–c15）＋暫時的結尾 `end`（「第一段到這裡 / 二 太陽、三 地球自轉，製作中。」）。

**第二段已移植**（原型順序，見 `scroll.js` 的 `ORDER`）：

```
c21, c22, c31, c23, c24, x1, x2, x3, c32, end
```

- c21–c24：二 太陽（節氣漂移、近日點、原因）。
- c31：「年柱和月柱」仍可判定（kicker 是 二 太陽）。
- x1–x3：往後找（延伸段，放在 二 太陽 裡，不要放到結論之後；使用者明確否決過）。
- c32：三 地球自轉（±1σ 誤差範圍）。
- end：結論（「整套曆法回到原點：曆法上 24,000 年，實際算不出」，括號帶出 1,980 與 180）。

正式版用輪盤顯示節氣差與誤差帶。軌道俯視圖由 `scroll-orbit.js` 繪製，41 個候選的最大節氣差沿用步數表面板。

**待辦（不在第二段內）**：舊的 `recurrence.html` 保留、不連結；優化好再從結尾接回去。

## 檔案

| 檔案 | 作用 |
|---|---|
| `src/research/scroll-scenes.js` | 純函式：場景 `scene(id, 長度vh, state(p))`、停點、文案、下一次同八字的掃描。可測試。 |
| `src/research/scroll-feel.js` | 捲動手感：馬達、吸附（前進偏好 AHEAD 1、回退 BEHIND .1）、鍵盤、手機點一下換幕。 |
| `src/research/scroll-overlay.js` | 畫在輪盤 SVG 上的標記（起點標記、公曆 400 年圈、欄名、太陽帶與自轉誤差帶）。 |
| `src/research/scroll-orbit.js` | 軌道俯視圖、近日點、放大偏心率與節氣定位。 |
| `src/research/research-mode.js` | 進出研究模式、`frame()`、文案、步數表、候選年份圖、手機鏡頭。 |
| `research-scroll.css` | 研究模式樣式，全部限定在 `body[data-view="research"]`。 |
| `src/kinetic-atlas.js` | 匯出 `researchHost`（`renderPose`、`dialTo`、`commit`、`setResearchView`…）。 |
| `src/wheel/responsive-camera-controller.js` | 接受 `instrument.dataset.cameraViewportWidth`（手機研究模式設 680）。 |

測試：`tests/research-scroll-scenes.test.js`、`tests/research-scroll-feel.test.js`。`npm run check` 目前 1,202 項測試全過，含語法檢查。

## 一定要守的規則

**效能（量測過，不要回退）**

- 圈的轉動只走 `researchHost.renderPose(pose)`（renderer 的 `setCyclePose` / `setSolarRingPose`），不要自己改 SVG transform。
- 跟著圈轉的標記放進該圈的群組（`#year-track`、`#day-track`…）裡，每幕建一次，靠圈本身轉動。
- 畫面固定的疊加層只在便宜的內容鍵改變時重建，不要每幀重建。
- 不要每幀切換大量 class，也不要每幀改會被繼承的 CSS 變數（會讓整圈重算樣式）。例：`--research-month` 只寫在 `#month-track` 上。
- `frame()` 先讀版面（`scrollY`），再寫；幾何（`getBoundingClientRect`、`getScreenCTM`）只在版面改變時量（`measureLayout`）。
- **4K**：不要加全螢幕大小的圖層，也不要對輪盤做 scale（桌機原型的「放大到差距」已拿掉，4K 會缺塊閃黑）。`will-change` 只在手機寬版用。
- 太陽帶標記放進 `#solar-track`，太陽圈經 renderer 驅動。遮罩、軌道圖與候選圖重用節點，捲動時更新變動的屬性。量測紀錄見 `research-scenes-plan.md` §9。

**手機**

- 首頁在 ≤480px 會鎖住 `html` 和 `body` 的捲動；研究模式兩個都要解開（已做）。用 `scrollTo` 測不出這個問題，要用真的觸控事件測。
- 研究模式下外框和輪盤高度都固定為 `100svh` 系列，不用首頁的 `100dvh`，否則網址列伸縮時輪盤會被重新取景、縮放。
- 研究頁上方列要和首頁同高（logo 在 y=19，輪盤從 y=48 開始，390 寬）。
- 從首頁進研究時，短暗場遮住換版和重新取景。置中後，輪盤在亮回來時開始撥動，減速時開場文字和提示一起淡入。直接開研究網址或啟用減少動態效果時，直接定位到開場。
- iOS：`<svg>` 上的 `border-radius` 會裁掉 SVG 內容，不要用。
- 研究文案與圖表標註用自帶的 Noto Sans TC，含 PingFang TC 備援。研究模式指定 `text-size-adjust: 100%`。結論在手機版用四欄摘要呈現柱位，短螢幕的自轉誤差標註移到輪盤上方空間。

**文案**

- 三層不要混：任何日期、同一組八字 → 180 年（2206-09-30）；同一天同一刻、同八字 → 1,980 年；整套曆法回到原點（週期）→ 24,000 年。
- 句子只在標點換行（`setCopy` 會加零寬空格）。
- 字級 ≥ 12px，不用 `!important`（CSS 檢查會擋）。

**專案**

- 檔案是 LF；用 Python 寫檔要 `newline=''`。
- 使用者沒說之前，不要 commit 或 push。

## 怎麼測

腳本在 `scripts/research-checks/`（Chrome 路徑可用 `CHROMIUM_BIN` 指定，輸出到 `tmp/research-checks/`，已 git-ignore）。

- 本機伺服器：`node scripts/research-checks/serve.mjs`；手機測試用 `node scripts/research-checks/serve.mjs 0.0.0.0`，手機連 `http://<電腦區網 IP>:4173/?view=research`（`python http.server` 在這台機器上 .mjs 的 MIME 會錯）。
- 手機三項：`node scripts/research-checks/phone.mjs`。上方列、logo、輪盤位置和首頁一致；進場亮起後讀針不動；真的手指拖動會捲動（只用 `scrollTo` 測不出捲動鎖）。
- 截圖：`node scripts/research-checks/shots.mjs 390x844,1280x720 c22:.38,end:.9`。改過的每一幕都要看手機和桌機。
- 4K：`node scripts/research-checks/k4.mjs c13 .5 9`。用真 GPU 捲動、錄畫面，數亮度低於中位數 0.6 倍的幀（應該是 0），並報幀間隔。
- 跳到某一幕：主控台 `__research.jump("c21", .5)`；`__research.ready` 表示已進場。
- 手機效能：Chrome 加 `--enable-gpu`，CDP `Emulation.setCPUThrottlingRate 4`，390×844@3x，量 rAF 幀間隔或 2 秒內的幀數。
- 測不到的：iPhone 放開手指後的慣性、網址列伸縮，要實機看。

## 下一步

第二段已通過 Chrome 窄版觸控、鍵盤、結尾重播與 4K 擷取檢查。待手機實機驗收，特別是 iOS Safari 的捲動手感與軌道圖。
