/**
 * 公開站「註冊流程」E2E：填表 → 送出 → 建立帳號並自動登入 → 導回站內。
 *
 * 涵蓋：
 *  1) 雇主註冊 happy path：切到註冊模式 → 選身分 → 填名字/Email/密碼 → 送出，
 *     成功後自動登入（導回首頁、右上出現帳號選單、且雇主入口可見）。
 *  2) 重複 Email：用 global-setup 已建立的 employer@test.local 註冊 → 後端回 CONFLICT，
 *     停在登入頁、右上仍是「登入」而非帳號選單。
 *
 * 帳號/資料由 e2e/global-setup.ts 重建；選取一律用 data-testid，不綁可見文案。
 * Email 每次執行帶時間戳 → 同一批次重跑（Playwright retry）也不會撞已註冊。
 */
import { expect, test } from "@playwright/test";
import { E2E_PASSWORD } from "./helpers/auth";

/** 產生本次執行專用、不會撞既有帳號的 Email。 */
function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.local`;
}

/** 前往登入頁並切換到「註冊」模式（露出身分/名字欄位）。 */
async function gotoRegister(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByTestId("login-toggle-mode").click();
  // 註冊模式限定的欄位出現，代表已切換成功
  await expect(page.getByTestId("login-name")).toBeVisible();
}

test.describe("公開站註冊流程", () => {
  test("雇主可註冊並在送出後自動登入、導回首頁", async ({ page }) => {
    await gotoRegister(page);

    // 選「我是雇主」身分
    await page.getByTestId("register-as-employer").click();
    await expect(page.getByTestId("register-as-employer")).toHaveClass(
      /border-primary/
    );

    await page.getByTestId("login-name").fill("E2E 註冊測試雇主");
    await page.getByTestId("login-email").fill(uniqueEmail("employer"));
    await page.getByTestId("login-password").fill(E2E_PASSWORD);
    await page.getByTestId("login-submit").click();

    // 註冊成功 → 後端已發 session → afterAuth 導回首頁（非 staff/admin）
    await expect(page).toHaveURL(/\/$/);
    // 右上角出現帳號選單（登入態），而非「登入」連結
    await expect(page.getByTestId("account-menu-trigger")).toBeVisible();
    await expect(page.getByTestId("login-link")).toHaveCount(0);

    // 帳號類型為雇主 → 帳號選單內可見雇主入口
    await page.getByTestId("account-menu-trigger").click();
    await expect(page.getByTestId("menu-employer")).toBeVisible();
  });

  test("工作者可註冊並自動登入（帳號選單出現工作者入口）", async ({ page }) => {
    await gotoRegister(page);

    await page.getByTestId("register-as-worker").click();
    await page.getByTestId("login-email").fill(uniqueEmail("worker"));
    await page.getByTestId("login-password").fill(E2E_PASSWORD);
    await page.getByTestId("login-submit").click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId("account-menu-trigger")).toBeVisible();

    await page.getByTestId("account-menu-trigger").click();
    await expect(page.getByTestId("menu-worker-profile")).toBeVisible();
  });

  test("以已註冊的 Email 註冊 → 被擋、停在登入頁", async ({ page }) => {
    await gotoRegister(page);

    await page.getByTestId("register-as-worker").click();
    // employer@test.local 由 global-setup 預先建立 → 後端回 CONFLICT
    await page.getByTestId("login-email").fill("employer@test.local");
    await page.getByTestId("login-password").fill(E2E_PASSWORD);
    await page.getByTestId("login-submit").click();

    // 未建立 session：仍停在登入頁、未導向首頁
    await expect(page).toHaveURL(/\/login(\?|$)/);
    await expect(page.getByTestId("login-submit")).toBeVisible();
  });
});
