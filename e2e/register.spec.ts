/**
 * 公開站「註冊流程」E2E：填資料 → 寄信箱驗證碼 → 驗碼建帳號並自動登入 → 導回站內。
 *
 * 涵蓋：
 *  1) 雇主註冊 happy path：填資料 → OTP 步驟 → 驗碼 → 自動登入、雇主入口可見。
 *  2) 工作者註冊（不填姓名）：同樣走完兩步驟並自動登入。
 *  3) 兩次密碼不一致：擋在填資料步驟、不寄碼。
 *  4) 已註冊 Email：寄碼步驟即被擋（CONFLICT），不進 OTP 步驟。
 *
 * 驗證碼在非正式環境固定為 E2E_FIXED_OTP（見 playwright.config.ts / auth/emailOtp.ts），
 * 免去真的收信。帳號/資料由 e2e/global-setup.ts 重建；選取一律用 data-testid。
 */
import { expect, test, type Page } from "@playwright/test";
import { E2E_PASSWORD } from "./helpers/auth";

const OTP = "123456"; // 對應 playwright.config.ts 的 E2E_FIXED_OTP

/** 產生本次執行專用、不會撞既有帳號的 Email。 */
function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.local`;
}

/** 前往登入頁並切到「註冊」模式（露出身分/姓名欄）。 */
async function gotoRegister(page: Page) {
  await page.goto("/login");
  await page.getByTestId("login-toggle-mode").click();
  await expect(page.getByTestId("login-name")).toBeVisible();
}

/** 填註冊表單並送出（兩次密碼一致）；停在「寄出驗證碼」之後。 */
async function submitRegisterForm(
  page: Page,
  opts: { type: "worker" | "employer"; email: string; name?: string }
) {
  await page.getByTestId(`register-as-${opts.type}`).click();
  if (opts.name) await page.getByTestId("login-name").fill(opts.name);
  await page.getByTestId("login-email").fill(opts.email);
  await page.getByTestId("login-password").fill(E2E_PASSWORD);
  await page.getByTestId("login-password-confirm").fill(E2E_PASSWORD);
  await page.getByTestId("login-submit").click();
}

test.describe("公開站註冊流程（信箱 OTP 兩步驟）", () => {
  test("雇主可註冊：填資料 → 驗碼 → 自動登入、導回首頁", async ({ page }) => {
    await gotoRegister(page);
    await page.getByTestId("register-as-employer").click();
    await expect(page.getByTestId("register-as-employer")).toHaveClass(
      /border-primary/
    );
    await submitRegisterForm(page, {
      type: "employer",
      email: uniqueEmail("employer"),
      name: "E2E 註冊測試雇主",
    });

    // 進到 OTP 步驟 → 輸入固定驗證碼 → 驗證
    await expect(page.getByTestId("register-otp-stage")).toBeVisible();
    await page.getByTestId("register-otp-code").fill(OTP);
    await page.getByTestId("register-otp-verify").click();

    // 建帳號成功 → 自動登入 → 導回首頁，帳號選單出現雇主入口
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId("account-menu-trigger")).toBeVisible();
    await expect(page.getByTestId("login-link")).toHaveCount(0);
    await page.getByTestId("account-menu-trigger").click();
    await expect(page.getByTestId("menu-employer")).toBeVisible();
  });

  test("工作者可註冊（不填姓名）：驗碼後自動登入", async ({ page }) => {
    await gotoRegister(page);
    await submitRegisterForm(page, {
      type: "worker",
      email: uniqueEmail("worker"),
    });

    await expect(page.getByTestId("register-otp-stage")).toBeVisible();
    await page.getByTestId("register-otp-code").fill(OTP);
    await page.getByTestId("register-otp-verify").click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId("account-menu-trigger")).toBeVisible();
    await page.getByTestId("account-menu-trigger").click();
    await expect(page.getByTestId("menu-worker-profile")).toBeVisible();
  });

  test("兩次密碼不一致 → 擋在填資料步驟、不寄碼", async ({ page }) => {
    await gotoRegister(page);
    await page.getByTestId("register-as-worker").click();
    await page.getByTestId("login-email").fill(uniqueEmail("mismatch"));
    await page.getByTestId("login-password").fill(E2E_PASSWORD);
    await page.getByTestId("login-password-confirm").fill("different-pw-999");
    await page.getByTestId("login-submit").click();

    // 未進到 OTP 步驟，仍停在填資料步驟
    await expect(page.getByTestId("register-otp-stage")).toHaveCount(0);
    await expect(page.getByTestId("login-email")).toBeVisible();
  });

  test("以已註冊的 Email 註冊 → 寄碼步驟被擋、不進 OTP", async ({ page }) => {
    await gotoRegister(page);
    // employer@test.local 由 global-setup 預先建立 → requestEmailOtp 直接 CONFLICT
    await submitRegisterForm(page, {
      type: "worker",
      email: "employer@test.local",
    });

    await expect(page.getByTestId("register-otp-stage")).toHaveCount(0);
    await expect(page.getByTestId("login-email")).toBeVisible();
  });
});
