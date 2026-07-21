// ─── i18n 框架（WS5）──────────────────────────────────────────────────────────
// 介面多語：zh-TW（base）/ vi / id / en。目前套用於「公開站」；內部後台維持
// zh-TW（staff 為台灣人）。使用者填的內容（需求單/履歷）之機器翻譯為 P1+。
//
// 用法：元件內 `const { t } = useTranslation();` → `t("home.heroTitle")`。
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

export const SUPPORTED_LANGS = [
  { code: "zh-TW", label: "繁中" },
  { code: "en", label: "English" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "id", label: "Bahasa" },
] as const;

export type LangCode = (typeof SUPPORTED_LANGS)[number]["code"];

const LANG_KEY = "app-lang";

const resources = {
  "zh-TW": {
    common: {
      nav: {
        findJobs: "找工作",
        findWorkers: "找移工",
        employer: "雇主專區",
        login: "登入 / 註冊",
      },
      home: {
        heroTitle: "乾淨、值得信賴的移工媒合平台",
        heroSubtitle: "看得見的可信工作紀錄，成交前一切聯繫都由專人把關。",
        ctaFindJobs: "我要找工作",
        ctaPostJob: "我要找移工",
        trustVerified: "平台驗證的工作紀錄",
        trustAgency: "仲介居中，安心媒合",
        trustMultilang: "母語履歷 · 多語支援",
      },
      login: {
        title: "登入",
        registerTitle: "註冊",
        email: "電子郵件",
        password: "密碼",
        name: "姓名",
        asWorker: "我是移工（求職）",
        asEmployer: "我是雇主（找人）",
        loginBtn: "登入",
        registerBtn: "建立帳號",
        toRegister: "還沒有帳號？註冊",
        toLogin: "已有帳號？登入",
        staffLogin: "員工登入",
        errorGeneric: "帳號或密碼錯誤",
        successLogin: "登入成功",
        successRegister: "帳號已建立",
      },
    },
  },
  en: {
    common: {
      nav: {
        findJobs: "Find Jobs",
        findWorkers: "Find Workers",
        employer: "Employers",
        login: "Log in / Sign up",
      },
      home: {
        heroTitle: "A clean, trustworthy migrant-worker matching platform",
        heroSubtitle:
          "Verifiable work records, with every contact vetted before a deal.",
        ctaFindJobs: "Find a job",
        ctaPostJob: "Find workers",
        trustVerified: "Platform-verified work records",
        trustAgency: "Agency-mediated, worry-free matching",
        trustMultilang: "Native-language résumé · multilingual",
      },
      login: {
        title: "Log in",
        registerTitle: "Sign up",
        email: "Email",
        password: "Password",
        name: "Name",
        asWorker: "I'm a worker (job seeker)",
        asEmployer: "I'm an employer (hiring)",
        loginBtn: "Log in",
        registerBtn: "Create account",
        toRegister: "No account? Sign up",
        toLogin: "Have an account? Log in",
        staffLogin: "Staff login",
        errorGeneric: "Incorrect email or password",
        successLogin: "Logged in",
        successRegister: "Account created",
      },
    },
  },
  vi: {
    common: {
      nav: {
        findJobs: "Tìm việc",
        findWorkers: "Tìm lao động",
        employer: "Nhà tuyển dụng",
        login: "Đăng nhập / Đăng ký",
      },
      home: {
        heroTitle: "Nền tảng kết nối lao động di trú sạch sẽ, đáng tin cậy",
        heroSubtitle:
          "Hồ sơ công việc có thể xác minh; mọi liên hệ đều được kiểm duyệt trước khi ký kết.",
        ctaFindJobs: "Tôi muốn tìm việc",
        ctaPostJob: "Tìm lao động",
        trustVerified: "Hồ sơ công việc được nền tảng xác minh",
        trustAgency: "Môi giới trung gian, kết nối an tâm",
        trustMultilang: "Hồ sơ bằng tiếng mẹ đẻ · đa ngôn ngữ",
      },
      login: {
        title: "Đăng nhập",
        registerTitle: "Đăng ký",
        email: "Email",
        password: "Mật khẩu",
        name: "Họ tên",
        asWorker: "Tôi là lao động (tìm việc)",
        asEmployer: "Tôi là nhà tuyển dụng",
        loginBtn: "Đăng nhập",
        registerBtn: "Tạo tài khoản",
        toRegister: "Chưa có tài khoản? Đăng ký",
        toLogin: "Đã có tài khoản? Đăng nhập",
        staffLogin: "Đăng nhập nhân viên",
        errorGeneric: "Email hoặc mật khẩu không đúng",
        successLogin: "Đăng nhập thành công",
        successRegister: "Đã tạo tài khoản",
      },
    },
  },
  id: {
    common: {
      nav: {
        findJobs: "Cari Kerja",
        findWorkers: "Cari Pekerja",
        employer: "Pemberi Kerja",
        login: "Masuk / Daftar",
      },
      home: {
        heroTitle:
          "Platform pencocokan pekerja migran yang bersih dan tepercaya",
        heroSubtitle:
          "Rekam kerja terverifikasi; setiap kontak ditinjau sebelum kesepakatan.",
        ctaFindJobs: "Saya mau cari kerja",
        ctaPostJob: "Cari pekerja",
        trustVerified: "Rekam kerja terverifikasi platform",
        trustAgency: "Dimediasi agen, pencocokan tenang",
        trustMultilang: "Resume bahasa ibu · multibahasa",
      },
      login: {
        title: "Masuk",
        registerTitle: "Daftar",
        email: "Email",
        password: "Kata sandi",
        name: "Nama",
        asWorker: "Saya pekerja (pencari kerja)",
        asEmployer: "Saya pemberi kerja",
        loginBtn: "Masuk",
        registerBtn: "Buat akun",
        toRegister: "Belum punya akun? Daftar",
        toLogin: "Sudah punya akun? Masuk",
        staffLogin: "Masuk staf",
        errorGeneric: "Email atau kata sandi salah",
        successLogin: "Berhasil masuk",
        successRegister: "Akun dibuat",
      },
    },
  },
};

function initialLang(): LangCode {
  const saved =
    typeof localStorage !== "undefined" ? localStorage.getItem(LANG_KEY) : null;
  if (saved && SUPPORTED_LANGS.some(l => l.code === saved))
    return saved as LangCode;
  return "zh-TW";
}

i18n.use(initReactI18next).init({
  resources,
  lng: initialLang(),
  fallbackLng: "zh-TW",
  defaultNS: "common",
  interpolation: { escapeValue: false },
});

export function setLang(code: LangCode) {
  i18n.changeLanguage(code);
  if (typeof localStorage !== "undefined") localStorage.setItem(LANG_KEY, code);
}

export default i18n;
