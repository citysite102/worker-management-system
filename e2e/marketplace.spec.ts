/**
 * 公開媒合平台 P1 的 E2E：需求單張貼 → 審核 → 轉 case → 找工作，
 * 以及「登入後導回原目的地」的迴歸（點『我要找工作』登入後不該被丟回首頁）。
 *
 * 登入帳號由 e2e/global-setup.ts 執行 seed-test-accounts.mjs 建立：
 *   worker@test.local / employer@test.local / staff@test.local，密碼一律 test1234。
 * 選取一律用 data-testid，不綁可見文案。
 */
import { expect, test } from "@playwright/test";
import { fillLogin, loginAs } from "./helpers/auth";

// 本檔用 fillLogin（假設已在登入頁）—— 迴歸測試需保留 /login?next= 的網址，
// 不能用會重新 goto("/login") 的 loginAs。

test.describe("登入導回（迴歸：登入後不回首頁）", () => {
  test("首頁點『我要找工作』→ 登入 → 導回 /jobs 而非首頁", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("cta-find-jobs").click();

    // 未登入 → 被導到登入頁，且帶 next=/jobs
    await expect(page).toHaveURL(/\/login\?next=%2Fjobs/);

    await fillLogin(page, "worker@test.local");

    // 登入後回到 /jobs（不是 /）
    await expect(page).toHaveURL(/\/jobs$/);
    await expect(
      page.getByTestId("jobs-list").or(page.getByTestId("jobs-empty"))
    ).toBeVisible();
  });
});

test.describe("雇主張貼需求單", () => {
  test("雇主可張貼需求單並在『我的需求單』看到審核中", async ({ page }) => {
    await page.goto("/login");
    await fillLogin(page, "employer@test.local");
    await expect(page).toHaveURL(/\/$/);

    await page.goto("/employer/post");
    await page.getByTestId("form-jobType").selectOption("caregiver");
    await page.getByTestId("form-city").selectOption("臺北市");
    await page.getByTestId("form-headcount").fill("1");
    await page.getByTestId("form-employmentType").selectOption("live_in");
    await page.getByTestId("form-description").fill("E2E 測試需求單");
    await page.getByTestId("form-submit").click();

    // 導回列表，出現一筆審核中
    await expect(page).toHaveURL(/\/employer$/);
    await expect(page.getByTestId("postings-list")).toBeVisible();
    await expect(
      page.getByTestId("posting-status-pending_review").first()
    ).toBeVisible();
  });
});

test.describe("審核 → 轉 case → 找工作上架", () => {
  test("staff 審核通過後，該職缺出現在找工作列表", async ({ page }) => {
    // 1) 雇主張貼一筆
    await loginAs(page, "employer@test.local"); // 等到離開 /login（session 已建立）
    await page.goto("/employer/post");
    await page.getByTestId("form-jobType").selectOption("domestic_helper");
    await page.getByTestId("form-city").selectOption("臺中市");
    await page.getByTestId("form-headcount").fill("2");
    await page.getByTestId("form-employmentType").selectOption("live_out");
    await page.getByTestId("form-description").fill("E2E 房務需求");
    await page.getByTestId("form-submit").click();
    await expect(page).toHaveURL(/\/employer$/);

    // 2) 換 staff 登入（loginAs 會以新 session 覆蓋雇主的 cookie，免另外登出），
    //    到審核佇列通過（指派負責人）
    await loginAs(page, "staff@test.local");
    await page.goto("/admin/moderation");
    await expect(page.getByTestId("moderation-list")).toBeVisible();

    // 鎖定剛張貼的「幫傭（房務）」那筆（佇列可能還有其它測試留下的待審單）
    const row = page
      .getByTestId("moderation-row")
      .filter({ hasText: "幫傭" })
      .first();
    await expect(row).toBeVisible();
    const managerSelect = row
      .locator('[data-testid^="approve-manager-"]')
      .first();
    await managerSelect.selectOption({ index: 1 });
    await row.locator('[data-testid^="approve-"]').last().click();
    // 等到通過成功（避免切換使用者時中斷 approve 的 mutation）
    await expect(page.getByText(/已通過並建立案件/)).toBeVisible();

    // 3) 換 worker 登入看找工作，房務類應可見
    await loginAs(page, "worker@test.local");
    await page.goto("/jobs");
    await page.getByTestId("filter-category-domestic_helper").click();
    await expect(page.getByTestId("job-card").first()).toBeVisible();
  });
});
