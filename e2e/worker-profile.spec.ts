/**
 * P2 E2E：移工建立公開履歷 → 客服審核通過 → 雇主（需通過的需求單）於找移工
 * 看到匿名履歷並送出媒合意向。含 §15-1 找移工 gating。
 *
 * 帳號由 global-setup 的 seed-test-accounts 建立（worker/employer/staff / test1234）。
 */
import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.describe("移工履歷 → 審核 → 找移工 → 媒合意向", () => {
  test("完整 P2 流程", async ({ page }) => {
    // 1) 雇主張貼一張需求單（供稍後解鎖找移工 gating）
    await loginAs(page, "employer@test.local");
    await page.goto("/employer/post");
    await page.getByTestId("form-jobType").selectOption("caregiver");
    await page.getByTestId("form-city").selectOption("臺北市");
    await page.getByTestId("form-headcount").fill("1");
    await page.getByTestId("form-employmentType").selectOption("live_in");
    await page.getByTestId("form-submit").click();
    await expect(page).toHaveURL(/\/employer$/);

    // 2) 移工建立公開履歷並送審
    await loginAs(page, "worker@test.local");
    await page.goto("/worker/profile");
    await page.getByTestId("profile-alias").fill("E2E阿明");
    await page.getByTestId("profile-nationality").fill("印尼");
    await page.getByTestId("profile-year").fill("1996");
    await page.getByTestId("profile-jobType").selectOption("caregiver");
    await page.getByTestId("profile-skills").fill("翻身, 備餐");
    await page.getByTestId("profile-languages").fill("中文, 印尼文");
    await page.getByTestId("profile-availability").fill("即刻");
    await page.getByTestId("profile-selfIntro").fill("細心可靠");
    await page.getByTestId("profile-submit").click();
    // 送審後狀態徽章轉為審核中
    await expect(page.getByTestId("profile-moderation")).toContainText(
      "審核中"
    );

    // 3) staff 審核：通過需求單 + 通過履歷
    await loginAs(page, "staff@test.local");
    await page.goto("/admin/moderation");
    // 3a) 需求單 tab（預設）：指派負責人後通過（解鎖雇主找移工）
    const postingRow = page
      .getByTestId("moderation-row")
      .filter({ hasText: "看護" })
      .first();
    await postingRow
      .locator('[data-testid^="approve-manager-"]')
      .first()
      .selectOption({ index: 1 });
    await postingRow.locator('[data-testid^="approve-"]').last().click();
    await expect(page.getByText(/已通過並建立案件/)).toBeVisible();
    // 3b) 履歷 tab：通過該履歷
    await page.getByTestId("mod-tab-profiles").click();
    await expect(page.getByTestId("mod-profiles-list")).toBeVisible();
    await page.locator('[data-testid^="mod-profile-approve-"]').first().click();
    await expect(page.getByText(/已通過/)).toBeVisible();

    // 4) 雇主到找移工：應可見該匿名履歷，進詳情送出意向
    await loginAs(page, "employer@test.local");
    await page.goto("/find-workers");
    await expect(page.getByTestId("find-workers-list")).toBeVisible();
    const card = page
      .getByTestId("worker-card")
      .filter({ hasText: "E2E阿明" })
      .first();
    await expect(card).toBeVisible();
    await card.click();
    await expect(page.getByTestId("worker-detail")).toBeVisible();
    // 匿名：不得出現真實姓名（seed 帳號名「測試移工」不應外露）
    await expect(page.getByTestId("worker-detail")).not.toContainText(
      "測試移工"
    );
    await page.getByTestId("fw-express-interest").click();
    await expect(page.getByTestId("fw-express-interest")).toBeDisabled();
  });
});
