# 設計系統 — Clean SaaS v1.0

| 項目 | 內容                                                                    |
| ---- | ----------------------------------------------------------------------- |
| 版本 | v1.0（已落地 `client/src/index.css`）                                   |
| 日期 | 2026-07-21                                                              |
| 定位 | **乾淨、簡單的 SaaS 求職平台**：白 / 淺灰為主，單一品牌深藍只出現在重點 |
| 參考 | Cake（乾淨白底）＋ Jobster（深藍主色）：白/淺灰面、深藍主色，重點才上色 |
| 落地 | Tailwind v4 `@theme`（`client/src/index.css`）＋ shadcn/radix 元件      |

> 沿革：一度採用「Warm Editorial」暖奶油/大地色方向，實測後認為**不適合後台/SaaS 產品**，已改為本 Clean SaaS。舊 teal `#1FA59B`＋吉祥物、以及 Warm Editorial 暖色皆**退役**。

---

## 1. 設計原則

1. **白為底、藍為點**：畫布白/淺灰，卡片純白；品牌深藍**只**用在按鈕、連結、選中、focus，其餘一律中性——藍不整片鋪。
2. **克制**：靠留白、1px 淺灰分隔線與底色深淺分層；陰影淺而少。
3. **清晰易掃**：資訊密集的後台以掃描為主——摘要在前、狀態用 pill/顏色一眼可辨。
4. **語義色獨立於品牌色**：成功/警示/錯誤（綠/琥珀/紅）是狀態色，與品牌深藍分開判讀。
5. **一致優先**：所有頁面共用同一組 token 與元件；新頁面**必須**取用 token（見 §8 落地守則）。

---

## 2. 色彩（Clean SaaS 調色盤）

### 2.1 中性（白 + 冷調淺灰）

| Token              | Hex       | 用途                 |
| ------------------ | --------- | -------------------- |
| `background`       | `#F7F8FA` | 頁面畫布（極淺灰）   |
| `card`             | `#FFFFFF` | 卡片、面板（純白）   |
| `foreground`       | `#17181B` | 主文字（近黑，中性） |
| `muted-foreground` | `#6B7280` | 次要文字（gray-500） |
| `muted/secondary`  | `#F1F3F5` | 淡填色、次要區塊     |
| `border/input`     | `#E7E9ED` | 邊框、分隔線（淺灰） |

### 2.2 品牌深藍（唯一重點色）

| Token               | Hex       | 用途                             |
| ------------------- | --------- | -------------------------------- |
| `primary`／`brand`  | `#1D4ED8` | 主按鈕、連結、品牌識別（＝主色） |
| `accent`            | `#EEF2FF` | 藍淡底（選中/hover 背景）        |
| `accent-foreground` | `#1E40AF` | 藍字（選中態文字/圖示）          |
| `ring`              | `#1D4ED8` | focus ring                       |

> 主按鈕＝**品牌深藍**（白字）；連結/選中/作用中導覽項用藍；其餘介面保持中性。深藍只點在重點。
> **語義色與品牌色分離**：成功/在職仍用綠（§2.3），不用品牌藍表達成功。

### 2.3 語義色（乾淨 SaaS，對齊既有 status class）

| 狀態        | 前景              | 底        | 對應現有 class  |
| ----------- | ----------------- | --------- | --------------- |
| 正常/成功   | `#15803D`（綠）   | `#E9F7EF` | `.status-green` |
| 警示        | `#B45309`（琥珀） | `#FEF3C7` | `.status-amber` |
| 需行動/錯誤 | `#DC2626`（紅）   | `#FDECEC` | `.status-red`   |
| 退場/中性   | `#6B7280`（灰）   | `#F1F3F5` | `.status-gray`  |

### 2.4 `@theme`（已套用於 `client/src/index.css`）

```css
@theme inline {
  --color-background: #f7f8fa; /* 畫布淺灰 */
  --color-foreground: #17181b;
  --color-card: #ffffff; /* 卡片＝白 */
  --color-card-foreground: #17181b;
  --color-secondary: #f1f3f5;
  --color-muted: #f1f3f5;
  --color-muted-foreground: #6b7280;
  --color-border: #e7e9ed;
  --color-input: #e7e9ed;
  --color-primary: #1d4ed8; /* 品牌深藍＝主按鈕 */
  --color-primary-foreground: #ffffff;
  --color-brand: #1d4ed8;
  --color-accent: #eef2ff; /* 藍淡底（選中/hover） */
  --color-accent-foreground: #1e40af;
  --color-ring: #1d4ed8;
  --color-destructive: #dc2626;
}
```

側欄為淺色（白底、灰字、藍色作用中）；圓角：控制項 8px、卡片 10px。語系切換為下拉選單。

---

## 3. 字體

| 角色            | Latin                          | 繁中/CJK      | 用途                     |
| --------------- | ------------------------------ | ------------- | ------------------------ |
| Display（襯線） | **Fraunces**（variable, opsz） | Noto Serif TC | 行銷大標、Hero、氣質時刻 |
| Sans（主力/UI） | **Hanken Grotesk**             | Noto Sans TC  | 標題、內文、UI、按鈕     |
| Mono            | Geist Mono / ui-monospace      | —             | 編號、數據、程式         |

- 選字理由：Fraunces 溫暖、有對比、編輯感強且**支援越南文變音**；Hanken Grotesk 清爽中性、字重齊全、同樣涵蓋越南文——刻意**避開泛用的 Inter/Roboto**。
- **雙語策略**：Latin 大標可用 Fraunces 襯線；中文大標建議用 Noto Sans TC 粗體（黑體較利 UI 閱讀），Fraunces 保留給 Latin 行銷時刻。
- 載入：Google Fonts（取代現行 Inter link）。

### 字級（rem，行高）

| 名稱         | 大小  | 行高 | 字體                                     |
| ------------ | ----- | ---- | ---------------------------------------- |
| display-xl   | 3.75  | 1.02 | Fraunces / Noto Serif TC                 |
| display      | 3.0   | 1.05 | Fraunces                                 |
| h1           | 2.25  | 1.1  | Hanken 700                               |
| h2           | 1.75  | 1.15 | Hanken 700                               |
| h3           | 1.375 | 1.25 | Hanken 600                               |
| h4           | 1.125 | 1.35 | Hanken 600                               |
| body         | 1.0   | 1.6  | Hanken 400                               |
| sm           | 0.875 | 1.55 | Hanken 400                               |
| xs / eyebrow | 0.75  | 1.4  | Hanken 500，`letter-spacing:.08em`，大寫 |

---

## 4. 間距、圓角、陰影、動態

- **間距**：沿用 Tailwind 4px 基準；行銷區塊上下留白慷慨（`py-24`~`py-32`），資訊密集後台維持緊湊。
- **圓角**：`sm 8 / md 12 / lg 16 / xl 20 / pill 9999`。卡片用 `lg`，按鈕用 `pill`，輸入框 `md`。
- **陰影（暖、極輕）**：
  ```
  xs 0 1px 2px rgba(30,27,22,.04)
  sm 0 2px 8px rgba(30,27,22,.05)
  md 0 8px 24px rgba(30,27,22,.06)
  lg 0 20px 48px rgba(30,27,22,.08)
  ```
- **動態**：緩動 `cubic-bezier(0.22,1,0.36,1)`；micro 150ms、預設 250ms、載入揭示 400ms（staggered）。hover 輕微上浮 + 邊框加深，不誇張。

---

## 5. 核心元件規範（Clean SaaS，對應 shadcn/radix）

| 元件                | 規範                                                                                                |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| Button / Primary    | `bg-primary`（深藍）白字、`md` 圓角；hover `opacity-90`。用於主要 CTA                               |
| Button / Secondary  | `bg-card` + `border`（淺灰）+ 中性字；hover `bg-muted`                                              |
| Button / Ghost      | 無邊框、hover `bg-muted`；圖示鈕用 ghost                                                            |
| Card（SurfaceCard） | `bg-card`（白）、`border`（淺灰 1px）、`lg` 圓角（10px）、預設無陰影；可點卡 hover 邊框轉 `primary` |
| Input / Select      | `bg-card`、`border`、`md` 圓角（8px）、focus `ring`（藍）                                           |
| Badge / StatusPill  | pill（`rounded-full px-2 py-0.5 text-xs font-medium`）+ §2.3 語義色（`.status-*`）                  |
| CategoryChip        | pill、藍淡底 `bg-accent` + `accent-foreground`（職類/分類籤，屬重點色）                             |
| Divider             | 1px `border` 髮絲線                                                                                 |
| Nav / Sidebar       | 白/紙底、中性細字、作用中項用 `accent`（藍淡底）＋藍字；右上 CTA 為深藍主按鈕                       |

### 5.1 共用元件庫（單一真相，優先取用）

公開媒合平台的介面**一律取用** `client/src/components/marketplace/` 這組元件，不再各頁 inline 拼卡片/徽章/頁首：

| 元件                                                 | 檔案                      | 用途                                                                   |
| ---------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------- |
| `PageHeader`                                         | `marketplace/ui.tsx`      | 頁首：標題 + 副標 + 右側動作，統一標題節奏                             |
| `SurfaceCard`                                        | `marketplace/ui.tsx`      | 標準表面卡片（白底/淺灰邊/10px 圓角）；`interactive` 時 hover 邊框轉藍 |
| `StatusPill` + `postingStatusTone`/`matchStatusTone` | `marketplace/ui.tsx`      | 語義狀態徽章，狀態值 → 綠/琥珀/紅/灰色調                               |
| `CategoryChip`                                       | `marketplace/ui.tsx`      | 職類分類籤（藍淡底重點色）                                             |
| `FilterChip`                                         | `marketplace/ui.tsx`      | 篩選膠囊鈕（選中＝藍淡底＋藍框）                                       |
| `MetaItem` / `MetaRow`                               | `marketplace/ui.tsx`      | icon + 文字的次要資訊列（地點/人數/聯絡…）                             |
| `JobCard`                                            | `marketplace/JobCard.tsx` | 找工作卡片（職類籤＋職種＋地點/人數＋薪資；既有需求標徽章）            |

> 內部後台（`/admin`，zh-TW）也共用同一組 `PageHeader` / `SurfaceCard` / `StatusPill` / `MetaItem`，讓公開站與後台視覺一致。新增/調整任何一個，**同步更新 `/brand-preview`（§00 Marketplace 共用元件）**。

---

## 6. 版面語彙（Clean SaaS）

- **Hero**：置中大標（中文粗黑體；Latin 可用 `.font-display` 襯線）、副標 `muted-foreground`、**深藍主按鈕** CTA + 次要外框鈕。
- **列表/卡片區**：規則網格（`sm:grid-cols-2 lg:grid-cols-3`）的 `SurfaceCard`；掃描優先，摘要在前、狀態用 `StatusPill` 一眼可辨。
- **信任列**：三欄 icon + 短句（首頁），白卡 + 淺灰邊。
- **後台**：`PageHeader` 標題列 + 篩選鈕 + 卡片列表；資訊密集、緊湊留白。
- **節奏**：區塊之間用底色（`background` 畫布 ↔ `card` 白）與 1px `border` 髮絲線分層；陰影淺而少。

---

## 7. 多語系與設計

- 版面須容納**越南文/印尼文較長字串**與**中文較高字身**：避免固定寬度按鈕、預留換行、行高從寬。
- Fraunces/Hanken/Noto 皆涵蓋越南文變音；印尼文/英文為拉丁子集。
- 圖示優先於純文字，降低跨語言閱讀門檻（呼應規格書無障礙訴求）。

---

## 8. 落地守則（確保「每個前端頁面都考量設計系統」）

1. **單一真相**：所有顏色/字級/圓角/陰影**一律取 token**（Tailwind theme 變數），禁止頁面內硬編色碼。
2. **元件優先**：新 UI 先用既有 shadcn 元件 + 本系統樣式；缺元件才新增，且新增即補進 BrandPreview。
3. **活的樣式指南**：以 `/brand-preview` 頁作為活文件，任何 token/元件變更同步更新該頁。
4. **CLAUDE.md 守門**：於 repo 根 `CLAUDE.md` 記載「前端一律遵循本設計系統」，讓後續開發（含 AI 協作）自動載入此約束。
5. **審查點**：PR/變更檢視時確認未硬編色、字體、圓角；必要時納入規約檢查。

---

## 9. 決策（已定案）

| #    | 決策     | 定案                                                                                                               |
| ---- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| DS-1 | 品牌方向 | **Clean SaaS**：白/淺灰為主 + 單一品牌深藍 `#1D4ED8`。舊 teal `#1FA59B`＋吉祥物、Warm Editorial 暖色**全數退役**。 |
| DS-2 | 套用範圍 | 公開站與內部後台**共用同一組 token 與元件**；後台已換 token。                                                      |
| DS-3 | 品牌主色 | 深藍 `#1D4ED8`（＝主按鈕、連結、選中、focus）；語義色（綠/琥珀/紅/灰）獨立。                                       |
| DS-4 | 字體     | Hanken Grotesk + Noto Sans TC（UI/內文）；Fraunces + Noto Serif TC 僅行銷大標（`.font-display`）。                 |
| DS-5 | 深色模式 | 暫緩：公開站先只做亮色，後台深色另排。                                                                             |

> 以上已落地 `client/src/index.css`（token）、`client/src/components/marketplace/`（共用元件）與 `/brand-preview`（活樣式指南）。`CLAUDE.md` 已載入「前端一律遵循本設計系統」守門。

## 圖片與照片（B4，photo-ready）

editorial 版型很吃圖，但目前**沒有內建照片素材**。版面已做成「照片就緒」：

- 共用元件 `Figure`（`components/marketplace/ui.tsx`）：有 `src` 顯示真圖（`object-cover`、`loading="lazy"`、404 自動退回），沒有就顯示**品牌漸層底**——空的時候也像刻意色塊，不是破圖。
- **放圖方式**：把檔案放 `client/public/`（如 `client/public/trust.jpg`），把對應 `<Figure>` 的 `src` 設成 `/trust.jpg` 即顯示。首頁「為什麼選我們」帶已預留一格。
- **外籍工作者真實照片**：後端只在**登入後**才下傳 `photoUrl`（`worker_public_profiles.photoKey` → `/manus-storage/...`）；找移工詳情頁登入後自動以真照取代匿名頭像。卡片與未登入一律匿名頭像，維持去識別。
- **素材規範（務必遵守）**：真人照片必須①取得肖像同意、②具合法授權、③尊嚴取向、不獵奇不刻板；外籍工作者照片還需符合去識別/個資規範（§11、§15-14/15）。不確定授權就不要放——`Figure` 的品牌色塊 fallback 本身就是可上線的樣子。
