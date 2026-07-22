/**
 * 儀表板的 E2E。
 *
 * 儀表板是唯讀頁，沒有新增／編輯／刪除，所以測的是「資料真的渲染出來了」：
 * 統計卡有數字（而不是永遠停在 skeleton）、狀態分布區塊在、到期提醒清單有內容。
 *
 * 元素一律用 `data-testid` 選取，不用可見文字。文案是產品會反覆調整的東西，
 * 綁在文案上的測試會在改字時假性失敗。
 */
import { expect, test } from "@playwright/test";
import { loginAsStaff } from "./helpers/auth";

test.beforeEach(async ({ page }) => {
  await loginAsStaff(page);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "儀表板" })).toBeVisible();
  // 標題出現不代表資料到齊 —— 統計卡在載入中是 skeleton，數字還沒進 DOM。
  // 等到數字出現為止，否則後面的斷言會抓到 0 個元素而假性通過／失敗。
  await expect
    .poll(() => page.getByTestId("dashboard-stat-value").count())
    .toBeGreaterThan(0);
});

test("六張統計卡都渲染出數字", async ({ page }) => {
  const cards = page.getByTestId("dashboard-stat-card");
  await expect(cards).toHaveCount(6);

  const values = page.getByTestId("dashboard-stat-value");
  await expect(values).toHaveCount(6);

  for (const text of await values.allTextContents()) {
    // 值一律是整數；抓到空字串或非數字就代表資料沒接上
    expect(text.trim()).toMatch(/^\d+$/);
  }
});

test("移工總數與在職移工的關係合理", async ({ page }) => {
  const read = async (key: string) => {
    const text = await page
      .locator(
        `[data-testid='dashboard-stat-card'][data-stat-key='${key}'] [data-testid='dashboard-stat-value']`
      )
      .textContent();
    return Number(text?.trim());
  };

  const workers = await read("workers");
  const employed = await read("employed");

  expect(workers).toBeGreaterThan(0);
  // 在職移工是移工的子集合，超過總數就代表兩邊的口徑對不起來
  expect(employed).toBeLessThanOrEqual(workers);
});

test("三個狀態分布區塊都在，且有畫出長條", async ({ page }) => {
  const panels = page.getByTestId("dashboard-distribution");
  await expect(panels).toHaveCount(3);

  // 假資料一定會讓三個分布都有資料；全部空掉代表 summary 查詢壞了
  await expect
    .poll(() => page.getByTestId("dashboard-distribution-bar").count())
    .toBeGreaterThan(0);
  await expect(page.getByTestId("dashboard-distribution-empty")).toHaveCount(0);
});

test("證件到期提醒區塊有渲染", async ({ page }) => {
  const section = page.getByTestId("dashboard-expiring");
  await expect(section).toBeVisible();

  // 到期與否取決於「今天」與假資料的日期，兩種結果都算正常，
  // 但一定要是其中之一 —— 兩邊都沒有就表示卡在載入中或渲染爆掉了。
  const rows = page.getByTestId("dashboard-expiring-row");
  const empty = page.getByTestId("dashboard-expiring-empty");
  await expect
    .poll(async () => (await rows.count()) + (await empty.count()))
    .toBeGreaterThan(0);
});

test("點到期提醒的項目會進入該移工的詳情頁", async ({ page }) => {
  const rows = page.getByTestId("dashboard-expiring-row");
  // 沒有到期資料時這個互動不存在，跳過而不是硬造資料
  test.skip(
    (await rows.count()) === 0,
    "目前的假資料沒有即將到期或已過期的證件"
  );

  const firstRow = rows.first();
  const workerId = await firstRow.getAttribute("data-worker-id");
  expect(workerId).toBeTruthy();

  await firstRow.click();

  await expect(page).toHaveURL(new RegExp(`/workers/${workerId}$`));
});

test("/admin/dashboard 與 /admin 導向同一個頁面", async ({ page }) => {
  await page.goto("/admin/dashboard");
  await expect(page.getByRole("heading", { name: "儀表板" })).toBeVisible();
  await expect
    .poll(() => page.getByTestId("dashboard-stat-card").count())
    .toBe(6);
});

test("生命週期分布用移工領域的標籤，不會顯示配對階段的說法", async ({
  page,
}) => {
  // `employed` 在移工生命週期是「在職中」、在配對階段是「聘僱中」。
  // ALL_LABELS 是把所有選項清單合併起來的，後合併者勝，所以沒有指定 domain
  // 的呼叫點會拿到「聘僱中」。這個 bug 修過一次，Workers 頁修了但 Dashboard
  // 漏掉，是實際打開畫面才看到的 —— 用 E2E 把兩個頁面都釘住。
  const lifecycle = page.getByTestId("dashboard-distribution").filter({
    hasText: "移工生命週期分布",
  });

  await expect(lifecycle).toContainText("在職中");
  await expect(lifecycle).not.toContainText("聘僱中");
});
