/**
 * 冒煙測試：確認每個主要頁面都打得開、沒有白畫面、沒有 console error。
 *
 * 這是最便宜也最常擋下災難的一層 —— 任何 render 期例外、tRPC 破圖、
 * 路由設定打錯，都會在這裡先炸出來。
 */
import { expect, test, type ConsoleMessage } from "@playwright/test";

const PAGES = [
  { path: "/", heading: /儀表板|Dashboard/ },
  { path: "/workers", heading: /移工/ },
  { path: "/customers", heading: /雇主|客戶/ },
  { path: "/cases", heading: /案件管理/ },
  { path: "/settings", heading: /設定/ },
] as const;

/**
 * 已知且與功能無關的 console 雜訊。
 *
 * client/index.html 內嵌了 umami 分析標籤，src 是 `%VITE_ANALYTICS_ENDPOINT%/umami`。
 * 本地與 CI 都沒設這個環境變數，Vite 不會替換佔位符，瀏覽器就去請求字面上的
 * `/%VITE_ANALYTICS_ENDPOINT%/umami`，導致 400 + MIME 錯誤（express 那端還會噴
 * URIError）。這是設定問題不是程式缺陷，但值得修 —— 見 README.testing.md。
 */
const IGNORED_CONSOLE_PATTERNS = [
  /VITE_ANALYTICS_ENDPOINT/,
  /umami/,
  /Failed to load resource/,
];

function isBenign(text: string): boolean {
  return IGNORED_CONSOLE_PATTERNS.some(re => re.test(text));
}

for (const { path, heading } of PAGES) {
  test(`${path} 可正常載入且無 console error`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg: ConsoleMessage) => {
      if (msg.type() === "error" && !isBenign(msg.text()))
        errors.push(msg.text());
    });
    page.on("pageerror", err => {
      if (!isBenign(err.message)) errors.push(err.message);
    });

    await page.goto(path);

    await expect(
      page.getByRole("heading", { name: heading }).first()
    ).toBeVisible();
    expect(errors, `${path} 出現 console error`).toEqual([]);
  });
}

test("未知路由顯示 404 而非白畫面", async ({ page }) => {
  await page.goto("/this-route-does-not-exist");
  await expect(page.getByText(/404|找不到/).first()).toBeVisible();
});
