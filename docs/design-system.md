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

## 5. 核心元件規範（對應 shadcn/radix）

| 元件               | 規範                                                                   |
| ------------------ | ---------------------------------------------------------------------- |
| Button / Primary   | 暖黑 `ink` 藥丸、白字、右側箭頭選用；hover 微亮+上浮                   |
| Button / Secondary | 透明底 + `line` 邊框 + `ink` 字；hover 底 `surface`                    |
| Button / Ghost     | 無邊框、hover `accent` 淡 moss 底                                      |
| Card               | `surface` 底、`line` 邊框、`lg` 圓角、預設無陰影，hover `sm` 陰影+上浮 |
| Bento 卡片         | 大小混排網格；圖片卡可疊暗漸層+白字（參考視覺）                        |
| Input / Select     | `surface` 底、`line` 邊框、`md` 圓角、focus `ring=moss`                |
| Badge / Status     | 用 §2.3 語義色（暖化 pill）                                            |
| Eyebrow 標籤       | 大寫、`letter-spacing:.08em`、`ink-muted`、常配 moss 小點/短線         |
| Divider            | 1px `line` 髮絲線，編輯感分區                                          |
| Nav                | 透明/紙底、細字、右上藥丸 CTA（參考視覺）                              |

---

## 6. 版面語彙（取自參考視覺）

- **Hero**：置中或左置大標（襯線+粗無襯線混排）、副標 `ink-muted`、黑藥丸 CTA。
- **Bento 特色區**：2–3 欄不規則卡片網格，圖片卡 + 純色大地色卡混排。
- **客戶/信任列**：細 logo 排、上下髮絲線。
- **服務/功能**：左窄標題 + 右多欄小項（FYLLA 式），配小幾何 icon。
- **節奏**：區塊之間用髮絲線或底色切換（`paper` ↔ `paper-dim`）。

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

## 9. 需你拍板的決策

| #    | 決策            | 建議                                                                                            |
| ---- | --------------- | ----------------------------------------------------------------------------------------------- |
| DS-1 | teal 品牌退役？ | **是**：以 Warm Editorial 取代 teal `#1FA59B`；吉祥物是否保留另議（建議精緻化或收斂為輔助角色） |
| DS-2 | 套用範圍        | **公開站全新採用；內部後台漸進換皮**（先換 token，元件多已用變數，風險低）                      |
| DS-3 | 品牌主色        | 採 **moss `#5F6B45`** 為品牌識別色（連結/選中），主按鈕用暖黑藥丸                               |
| DS-4 | 字體確認        | Fraunces（襯線）+ Hanken Grotesk（無襯線）+ Noto TC；如你有偏好可換                             |
| DS-5 | 深色模式        | P 幾做？建議公開站先只做亮色，後台深色另排                                                      |

> 你確認 DS-1~DS-4（或說「照建議走」），我就把 token 落進 `index.css`、換字體、刷新 `/brand-preview` 作為活樣式指南，並建立 `CLAUDE.md` 守門。
