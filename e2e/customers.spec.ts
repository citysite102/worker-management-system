/**
 * 客戶（雇主）管理頁的 E2E。
 *
 * 元素一律用 `data-testid` 選取，不用可見文字。文案是產品會反覆調整的東西，
 * 綁在文案上的測試會在改字時假性失敗 —— 那種失敗多了，大家就會開始無視 E2E。
 * 唯一的例外是「驗證訊息內容」這類斷言，那時文字本身就是被測的行為。
 */
import { expect, test } from "@playwright/test";
import { loginAsStaff } from "./helpers/auth";

test.beforeEach(async ({ page }) => {
  await loginAsStaff(page);
  await page.goto("/admin/customers");
  await expect(page.getByRole("heading", { name: "客戶管理" })).toBeVisible();
  // 標題出現不代表資料到齊 —— 列表是非同步載入的。等到有資料列為止，
  // 讓每個測試都從「已載入」狀態開始，否則數列數時會抓到 0。
  await expect
    .poll(() => page.getByTestId("customer-row").count())
    .toBeGreaterThan(0);
});

test("客戶列表載入後有資料", async ({ page }) => {
  await expect(page.getByTestId("customer-row").first()).toBeVisible();
});

test("搜尋會過濾客戶列表", async ({ page }) => {
  const rows = page.getByTestId("customer-row");

  await page.getByTestId("customers-search").fill("不可能存在的雇主名稱ZZZ");

  await expect.poll(() => rows.count()).toBe(0);
  // 篩到空的時候會換成空狀態列，而不是留一張空表格
  await expect(page.getByTestId("customers-empty")).toBeVisible();
});

test("清空搜尋後列表回復原狀", async ({ page }) => {
  const rows = page.getByTestId("customer-row");
  const before = await rows.count();

  const search = page.getByTestId("customers-search");
  await search.fill("不可能存在的雇主名稱ZZZ");
  await expect.poll(() => rows.count()).toBe(0);

  await search.fill("");
  await expect.poll(() => rows.count()).toBe(before);
});

test("搜尋框的清除鈕可清空搜尋", async ({ page }) => {
  const rows = page.getByTestId("customer-row");
  const before = await rows.count();

  await page.getByTestId("customers-search").fill("不可能存在的雇主名稱ZZZ");
  await expect.poll(() => rows.count()).toBe(0);

  // 清除鈕只在有輸入時才渲染
  await page.getByTestId("customers-search-clear").click();

  await expect(page.getByTestId("customers-search")).toHaveValue("");
  await expect.poll(() => rows.count()).toBe(before);
});

test("點「個人雇主」統計卡會套用類型篩選，再點一次取消", async ({ page }) => {
  const rows = page.getByTestId("customer-row");
  const before = await rows.count();

  const individualCard = page.locator(
    "[data-testid='customers-stat-card'][data-stat-type='individual']"
  );

  await individualCard.click();

  // 套用篩選後會出現「篩選中」提示列，且列數會少於未篩選時
  await expect(page.getByTestId("customers-filter-summary")).toBeVisible();
  await expect.poll(() => rows.count()).toBeLessThan(before);

  await individualCard.click();

  await expect(page.getByTestId("customers-filter-summary")).not.toBeVisible();
  await expect.poll(() => rows.count()).toBe(before);
});

test("點「新增雇主」會開啟表單", async ({ page }) => {
  await page.getByTestId("customers-create").click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("必填欄位未完成時，送出按鈕停用並用 tooltip 列出缺少的欄位", async ({
  page,
}) => {
  await page.getByTestId("customers-create").click();
  await expect(page.getByRole("dialog")).toBeVisible();

  // CustomerModal 與 CaseModal 同樣是「防呆而非事後報錯」：必填沒填完時送出鈕
  // 直接 disabled（還加了 pointer-events-none），並用 tooltip 說明缺什麼。
  await expect(page.getByTestId("customer-modal-submit")).toBeDisabled();

  // tooltip 掛在包住 disabled button 的 span 上（disabled button 不觸發 mouse event）
  await page.getByTestId("customer-modal-submit-wrap").hover();

  // Radix 會渲染兩份 tooltip 內容（一份給螢幕閱讀器），用 role 取可見的那份。
  // 這裡斷言文字是刻意的 —— 提示內容本身就是被測的行為。
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText("請先完成必填欄位：");
  await expect(tooltip).toContainText("客戶名稱（至少 2 字）");
  await expect(tooltip).toContainText("合約狀態");
  await expect(tooltip).toContainText("定價級距");
  await expect(tooltip).toContainText("負責人");
});

test("填入名稱後，tooltip 就不再列出名稱這一項", async ({ page }) => {
  await page.getByTestId("customers-create").click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.getByTestId("customer-modal-name").fill("測試雇主股份有限公司");

  // 其餘三個必填還沒填，所以送出鈕仍停用，但缺少清單應該少一項
  await expect(page.getByTestId("customer-modal-submit")).toBeDisabled();
  await page.getByTestId("customer-modal-submit-wrap").hover();

  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip).not.toContainText("客戶名稱");
  await expect(tooltip).toContainText("合約狀態");
});

test("切換雇主類型會換掉專屬欄位", async ({ page }) => {
  await page.getByTestId("customers-create").click();
  await expect(page.getByRole("dialog")).toBeVisible();

  // 預設是公司行號，有統一編號欄位
  await expect(page.locator("#c-taxId")).toBeVisible();

  await page
    .locator(
      "[data-testid='customer-modal-employer-type'][data-employer-type='individual']"
    )
    .click();

  // 切成個人雇主後改成身分證字號欄位
  await expect(page.locator("#c-taxId")).toHaveCount(0);
  await expect(page.locator("#c-idNo")).toBeVisible();
});

test("取消可關閉表單", async ({ page }) => {
  await page.getByTestId("customers-create").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  await page.getByTestId("customer-modal-cancel").click();

  await expect(dialog).not.toBeVisible();
});

test("點客戶列可進入該客戶的詳情頁", async ({ page }) => {
  const firstRow = page.getByTestId("customer-row").first();
  const customerId = await firstRow.getAttribute("data-customer-id");
  expect(customerId).toBeTruthy();

  await firstRow.click();

  // 驗證進的是「這一列對應的」客戶，而不是隨便一個詳情頁
  await expect(page).toHaveURL(new RegExp(`/customers/${customerId}$`));
});

test("列上的編輯鈕開啟表單，且不會誤觸導頁", async ({ page }) => {
  await page.getByTestId("customer-row-edit").first().click();

  await expect(page.getByRole("dialog")).toBeVisible();
  // 編輯鈕有 stopPropagation，不該觸發整列的導頁行為
  await expect(page).toHaveURL(/\/customers$/);
});

test("列上的刪除鈕開啟確認框，且不會誤觸導頁", async ({ page }) => {
  await page.getByTestId("customer-row-delete").first().click();

  await expect(page.getByRole("alertdialog")).toBeVisible();
  await expect(page).toHaveURL(/\/customers$/);
});
