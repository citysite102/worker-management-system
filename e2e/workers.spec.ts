/**
 * 移工管理頁的 E2E。
 *
 * 元素一律用 `data-testid` 選取，不用可見文字。文案是產品會反覆調整的東西，
 * 綁在文案上的測試會在改字時假性失敗 —— 那種失敗多了，大家就會開始無視 E2E。
 * 唯一的例外是「驗證訊息內容」這類斷言，那時文字本身就是被測的行為。
 */
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/workers");
  await expect(page.getByRole("heading", { name: "移工管理" })).toBeVisible();
  // 標題出現不代表資料到齊 —— 列表是非同步載入的。等到有資料列為止，
  // 讓每個測試都從「已載入」狀態開始，否則數列數時會抓到 0。
  await expect
    .poll(() => page.getByTestId("worker-row").count())
    .toBeGreaterThan(0);
});

test("移工列表載入後有資料", async ({ page }) => {
  await expect(page.getByTestId("worker-row").first()).toBeVisible();
});

test("搜尋會過濾移工列表", async ({ page }) => {
  const rows = page.getByTestId("worker-row");

  await page.getByTestId("workers-search").fill("不可能存在的移工姓名ZZZ");

  await expect.poll(() => rows.count()).toBe(0);
  // 篩到空的時候會換成空狀態列，而不是留一張空表格
  await expect(page.getByTestId("workers-empty")).toBeVisible();
});

test("清空搜尋後列表回復原狀", async ({ page }) => {
  const rows = page.getByTestId("worker-row");
  const before = await rows.count();

  const search = page.getByTestId("workers-search");
  await search.fill("不可能存在的移工姓名ZZZ");
  await expect.poll(() => rows.count()).toBe(0);

  await search.fill("");
  await expect.poll(() => rows.count()).toBe(before);
});

test("搜尋框的清除鈕可清空搜尋", async ({ page }) => {
  const rows = page.getByTestId("worker-row");
  const before = await rows.count();

  await page.getByTestId("workers-search").fill("不可能存在的移工姓名ZZZ");
  await expect.poll(() => rows.count()).toBe(0);

  // 清除鈕只在有輸入時才渲染
  await page.getByTestId("workers-search-clear").click();

  await expect(page.getByTestId("workers-search")).toHaveValue("");
  await expect.poll(() => rows.count()).toBe(before);
});

test("點統計卡會套用對應的快速篩選，再點一次取消", async ({ page }) => {
  const rows = page.getByTestId("worker-row");
  const before = await rows.count();

  const employedCard = page.locator(
    "[data-testid='workers-stat-card'][data-stat-type='employed']"
  );

  await employedCard.click();

  // 套用篩選後會出現「篩選中」提示列
  await expect(page.getByTestId("workers-filter-summary")).toBeVisible();
  // 篩選後只會剩在職中的列，狀態徽章一律是 employed
  const badges = page.locator(
    "[data-testid='worker-row'] [data-testid='status-badge'][data-status='employed']"
  );
  await expect.poll(() => rows.count()).toBe(await badges.count());

  await employedCard.click();

  await expect(page.getByTestId("workers-filter-summary")).not.toBeVisible();
  await expect.poll(() => rows.count()).toBe(before);
});

test("點「新增移工」會開啟表單", async ({ page }) => {
  await page.getByTestId("workers-create").click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("必填欄位未完成時，送出按鈕停用並用 tooltip 列出缺少的欄位", async ({
  page,
}) => {
  await page.getByTestId("workers-create").click();
  await expect(page.getByRole("dialog")).toBeVisible();

  // WorkerModal 與 CaseModal 同樣是「防呆而非事後報錯」：必填沒填完時送出鈕
  // 直接 disabled（還加了 pointer-events-none），並用 tooltip 說明缺什麼。
  await expect(page.getByTestId("worker-modal-submit")).toBeDisabled();

  // tooltip 掛在包住 disabled button 的 span 上（disabled button 不觸發 mouse event）
  await page.getByTestId("worker-modal-submit-wrap").hover();

  // Radix 會渲染兩份 tooltip 內容（一份給螢幕閱讀器），用 role 取可見的那份。
  // 這裡斷言文字是刻意的 —— 提示內容本身就是被測的行為。
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText("請先完成必填欄位：");
  await expect(tooltip).toContainText("中文或英文姓名");
});

test("填入姓名後送出鈕解除停用", async ({ page }) => {
  await page.getByTestId("workers-create").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByTestId("worker-modal-submit")).toBeDisabled();

  // 負責人在新增模式會自動帶入第一位，所以只差姓名
  await page.getByTestId("worker-modal-name-cn").fill("測試移工");

  await expect(page.getByTestId("worker-modal-submit")).toBeEnabled();
});

test("取消可關閉表單", async ({ page }) => {
  await page.getByTestId("workers-create").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  await page.getByTestId("worker-modal-cancel").click();

  await expect(dialog).not.toBeVisible();
});

test("點移工列可進入該移工的詳情頁", async ({ page }) => {
  const firstRow = page.getByTestId("worker-row").first();
  const workerId = await firstRow.getAttribute("data-worker-id");
  expect(workerId).toBeTruthy();

  await firstRow.click();

  // 驗證進的是「這一列對應的」移工，而不是隨便一個詳情頁
  await expect(page).toHaveURL(new RegExp(`/workers/${workerId}$`));
});

test("列上的編輯鈕開啟表單，且不會誤觸導頁", async ({ page }) => {
  await page.getByTestId("worker-row-edit").first().click();

  await expect(page.getByRole("dialog")).toBeVisible();
  // 編輯鈕有 stopPropagation，不該觸發整列的導頁行為
  await expect(page).toHaveURL(/\/workers$/);
});

test("列上的刪除鈕開啟確認框，且不會誤觸導頁", async ({ page }) => {
  await page.getByTestId("worker-row-delete").first().click();

  await expect(page.getByRole("alertdialog")).toBeVisible();
  await expect(page).toHaveURL(/\/workers$/);
});
