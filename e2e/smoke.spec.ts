/**
 * 冒煙測試：確認每個主要頁面都打得開、沒有白畫面、沒有 console error。
 *
 * 這是最便宜也最常擋下災難的一層 —— 任何 render 期例外、tRPC 破圖、
 * 路由設定打錯，都會在這裡先炸出來。
 *
 * P0 之後後台在 /admin（需 staff 登入），公開站在 /；因此拆成兩組：
 * 公開頁不需登入，後台頁先以 staff 登入再進。
 */
import { expect, test, type ConsoleMessage, type Page } from "@playwright/test";
import { loginAsStaff } from "./helpers/auth";

// 這裡刻意不設任何「已知雜訊」白名單 —— 一旦開始容忍例外，真正的錯誤就會
// 混在裡面被忽略。console 有錯就該修掉源頭，而不是把它加進忽略清單。
function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", err => errors.push(err.message));
  return errors;
}

// 公開站頁面（不需登入）
const PUBLIC_PAGES = [
  { path: "/", heading: /媒合平台/ },
  { path: "/login", heading: /登入/ },
] as const;

for (const { path, heading } of PUBLIC_PAGES) {
  test(`公開頁 ${path} 可正常載入且無 console error`, async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: heading }).first()
    ).toBeVisible();
    expect(errors, `${path} 出現 console error`).toEqual([]);
  });
}

// 後台頁面（需 staff 登入）
const ADMIN_PAGES = [
  { path: "/admin", heading: /儀表板/ },
  { path: "/admin/workers", heading: /移工/ },
  { path: "/admin/customers", heading: /雇主|客戶/ },
  { path: "/admin/cases", heading: /案件管理/ },
  { path: "/admin/moderation", heading: /審核佇列/ },
  { path: "/admin/match-requests", heading: /媒合意向/ },
  { path: "/admin/settings", heading: /設定/ },
] as const;

for (const { path, heading } of ADMIN_PAGES) {
  test(`後台頁 ${path} 可正常載入且無 console error`, async ({ page }) => {
    const errors = trackErrors(page);
    await loginAsStaff(page);
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
