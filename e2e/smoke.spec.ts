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

// 這裡刻意不設任何「已知雜訊」白名單 —— 一旦開始容忍例外，真正的錯誤就會
// 混在裡面被忽略。console 有錯就該修掉源頭，而不是把它加進忽略清單。
for (const { path, heading } of PAGES) {
  test(`${path} 可正常載入且無 console error`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg: ConsoleMessage) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", err => errors.push(err.message));

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
