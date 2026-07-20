/**
 * 案件管理頁的 E2E。
 *
 * 元素一律用 `data-testid` 選取，不用可見文字。文案是產品會反覆調整的東西，
 * 綁在文案上的測試會在改字時假性失敗 —— 那種失敗多了，大家就會開始無視 E2E。
 * 唯一的例外是「驗證訊息內容」這類斷言，那時文字本身就是被測的行為。
 */
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/cases");
  await expect(page.getByRole("heading", { name: "案件管理" })).toBeVisible();
  // 標題出現不代表資料到齊 —— 列表是非同步載入的。等到有資料列為止，
  // 讓每個測試都從「已載入」狀態開始，否則數列數時會抓到 0。
  await expect
    .poll(() => page.getByTestId("case-row").count())
    .toBeGreaterThan(0);
});

test("案件列表載入後有資料", async ({ page }) => {
  await expect(page.getByTestId("case-row").first()).toBeVisible();
});

test("搜尋會過濾案件列表", async ({ page }) => {
  const rows = page.getByTestId("case-row");

  await page.getByTestId("cases-search").fill("不可能存在的案件名稱ZZZ");

  await expect.poll(() => rows.count()).toBe(0);
});

test("清空搜尋後列表回復原狀", async ({ page }) => {
  const rows = page.getByTestId("case-row");
  const before = await rows.count();

  const search = page.getByTestId("cases-search");
  await search.fill("不可能存在的案件名稱ZZZ");
  await expect.poll(() => rows.count()).toBe(0);

  await search.fill("");
  await expect.poll(() => rows.count()).toBe(before);
});

test("點「新增案件」會開啟表單", async ({ page }) => {
  await page.getByTestId("cases-create").click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("必填欄位未完成時，送出按鈕停用並用 tooltip 列出缺少的欄位", async ({
  page,
}) => {
  await page.getByTestId("cases-create").click();
  await expect(page.getByRole("dialog")).toBeVisible();

  // CaseModal 的設計是「防呆而非事後報錯」：必填欄位沒填完時送出鈕直接 disabled
  // （還加了 pointer-events-none），並用 tooltip 說明缺什麼。
  await expect(page.getByTestId("case-modal-submit")).toBeDisabled();

  // tooltip 掛在包住 disabled button 的 span 上（disabled button 不觸發 mouse event）
  await page.getByTestId("case-modal-submit-wrap").hover();

  // Radix 會渲染兩份 tooltip 內容（一份給螢幕閱讀器），用 role 取可見的那份。
  // 這裡斷言文字是刻意的 —— 提示內容本身就是被測的行為。
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText("請先完成必填欄位：");
  await expect(tooltip).toContainText("案件名稱");
  await expect(tooltip).toContainText("負責人");
  await expect(tooltip).toContainText("選擇雇主");
});

test("取消可關閉表單", async ({ page }) => {
  await page.getByTestId("cases-create").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  await page.getByTestId("case-modal-cancel").click();

  await expect(dialog).not.toBeVisible();
});

test("點案件列可進入該案件的詳情頁", async ({ page }) => {
  const firstRow = page.getByTestId("case-row").first();
  const caseId = await firstRow.getAttribute("data-case-id");
  expect(caseId).toBeTruthy();

  await firstRow.click();

  // 驗證進的是「這一列對應的」案件，而不是隨便一個詳情頁
  await expect(page).toHaveURL(new RegExp(`/cases/${caseId}$`));
});

test("列上的編輯鈕開啟表單，且不會誤觸導頁", async ({ page }) => {
  await page.getByTestId("case-row-edit").first().click();

  await expect(page.getByRole("dialog")).toBeVisible();
  // 編輯鈕有 stopPropagation，不該觸發整列的導頁行為
  await expect(page).toHaveURL(/\/cases$/);
});
