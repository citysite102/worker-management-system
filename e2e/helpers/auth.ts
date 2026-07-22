/**
 * E2E 登入輔助。
 *
 * 自 P0 起後台移到 /admin 並套 RequireStaff 守衛，且 procedure 硬化為
 * staffProcedure；E2E 因此關掉 DEV_AUTH_BYPASS，改用真實 Email/密碼登入，
 * 讓測試真的走過「登入 → 守衛 → 後台」這條路。
 *
 * 帳號由 e2e/global-setup.ts 執行 seed-test-accounts.mjs 建立：
 *   staff@test.local / worker@test.local / employer@test.local，密碼一律 test1234。
 */
import { expect, type Page } from "@playwright/test";

export const E2E_PASSWORD = "test1234";

/** 填入登入表單並送出（假設已在 /login 頁，保留網址上的 next 參數）。 */
export async function fillLogin(page: Page, email: string) {
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(E2E_PASSWORD);
  await page.getByTestId("login-submit").click();
}

/** 前往登入頁並以 Email/密碼登入，等到離開登入頁為止。 */
export async function loginAs(page: Page, email: string) {
  await page.goto("/login");
  await fillLogin(page, email);
  await expect(page).not.toHaveURL(/\/login(\?|$)/);
}

/** 以 staff 帳號登入後台（登入後自動導向 /admin）。 */
export async function loginAsStaff(page: Page) {
  await loginAs(page, "staff@test.local");
  await expect(page).toHaveURL(/\/admin$/);
}
