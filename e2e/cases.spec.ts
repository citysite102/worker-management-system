/**
 * 案件管理頁的 E2E。
 *
 * 目前專案沒有任何 data-testid，因此這裡一律用使用者看得到的東西
 * （role、可見文字）來選取元素。這種選法比較貼近真實使用，但也表示
 * 改文案會弄壞測試 —— 若之後要讓 E2E 更穩，建議在關鍵元素補上
 * data-testid（見 README.testing.md 的建議清單）。
 */
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/cases");
  await expect(page.getByRole("heading", { name: "案件管理" })).toBeVisible();
});

test("案件列表載入後有資料", async ({ page }) => {
  const rows = page.getByRole("row");
  // 表頭 1 列 + 至少 1 筆資料
  await expect.poll(() => rows.count()).toBeGreaterThan(1);
});

test("搜尋會過濾案件列表", async ({ page }) => {
  const search = page.getByPlaceholder("搜尋案件名稱、客戶名稱...");
  const rowsBefore = await page.getByRole("row").count();

  await search.fill("不可能存在的案件名稱ZZZ");

  await expect
    .poll(() => page.getByRole("row").count())
    .toBeLessThan(rowsBefore);
});

test("點「新增案件」會開啟表單", async ({ page }) => {
  await page.getByRole("button", { name: /新增案件/ }).click();

  await expect(page.getByRole("dialog")).toBeVisible();
});

test("必填欄位未完成時，送出按鈕停用並用 tooltip 列出缺少的欄位", async ({
  page,
}) => {
  await page.getByRole("button", { name: /新增案件/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // CaseModal 的設計是「防呆而非事後報錯」：必填欄位沒填完時送出鈕直接 disabled
  // （還加了 pointer-events-none），並用 tooltip 說明缺什麼，所以這裡驗的是
  // 按鈕停用 + tooltip 內容，而不是點下去看錯誤訊息。
  const submit = dialog.getByRole("button", { name: /建立案件/ });
  await expect(submit).toBeDisabled();

  // tooltip 掛在包住 disabled button 的 span 上（disabled button 不觸發 mouse event）
  await submit.locator("xpath=ancestor::span[@tabindex='0']").hover();

  // Radix 會渲染兩份 tooltip 內容（一份給螢幕閱讀器朗讀），
  // 所以用 role="tooltip" 精確選取可見的那一份，避免 strict mode 衝突。
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText("請先完成必填欄位：");
  await expect(tooltip).toContainText("案件名稱");
  await expect(tooltip).toContainText("負責人");
  await expect(tooltip).toContainText("選擇雇主");
});

test("點案件可進入詳情頁", async ({ page }) => {
  const firstRow = page.getByRole("row").nth(1);
  await firstRow.click();

  await expect(page).toHaveURL(/\/cases\/\d+/);
});
