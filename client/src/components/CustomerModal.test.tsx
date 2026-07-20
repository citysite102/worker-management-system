/**
 * CustomerModal 的元件測試。
 *
 * 這個 Modal 的核心風險有兩塊：
 *
 * 1. `missingFields` —— 決定送出鈕停不停用、tooltip 列出哪些欄位。四個必填
 *    欄位（名稱／合約狀態／定價級距／負責人）的組合，E2E 只驗得到「按鈕停用」，
 *    驗不到「在什麼條件下缺哪幾項」。
 * 2. `buildPayload` 的欄位轉換 —— 空字串轉 undefined、managerId 字串轉數字。
 *    這種轉換錯了不會噴錯，只會靜靜地把空字串或 NaN 送進後端。
 *
 * 另外雇主類型（個人／公司）會換掉整組專屬欄位，切換後畫面上該有什麼、
 * 不該有什麼，也是這裡才驗得到。
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CustomerModal } from "./CustomerModal";
import {
  getMutation,
  resetTrpcMock,
  setMutationError,
  setQueryData,
} from "../__tests__/trpcMock";

vi.mock("@/lib/trpc", async () => {
  const { trpcMock } = await import("../__tests__/trpcMock");
  return { trpc: trpcMock };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const MANAGERS = [
  { id: 1, name: "陳專員", createdAt: new Date("2026-01-01") },
  { id: 2, name: "林專員", createdAt: new Date("2026-01-01") },
];

beforeEach(() => {
  resetTrpcMock();
  setQueryData("managers.list", MANAGERS);
});

function renderModal(props: Partial<Parameters<typeof CustomerModal>[0]> = {}) {
  return render(
    <CustomerModal open onClose={vi.fn()} onSuccess={vi.fn()} {...props} />
  );
}

/**
 * 從 Radix Select 選一個選項。
 * 觸發器是 testid，選項只能靠可見文字找，所以包成一個 helper 避免每次重寫。
 */
async function selectOption(
  user: ReturnType<typeof userEvent.setup>,
  testId: string,
  optionLabel: string
) {
  await user.click(screen.getByTestId(testId));
  await user.click(await screen.findByRole("option", { name: optionLabel }));
}

/** 把四個必填欄位一次填滿，讓送出鈕解除停用。 */
async function fillAllRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByTestId("customer-modal-name"), "台灣精密");
  await selectOption(user, "customer-modal-managerId", "陳專員");
  await selectOption(user, "customer-modal-contractStatus", "已簽約");
  await selectOption(user, "customer-modal-pricingTier", "標準");
}

describe("CustomerModal 的必填判斷", () => {
  it("剛開啟時四項必填全缺，tooltip 逐項列出", async () => {
    const user = userEvent.setup();
    renderModal();

    expect(screen.getByTestId("customer-modal-submit")).toBeDisabled();

    await user.hover(screen.getByTestId("customer-modal-submit-wrap"));
    const tip = await screen.findByRole("tooltip");

    expect(tip).toHaveTextContent("雇主名稱");
    expect(tip).toHaveTextContent("合約狀態");
    expect(tip).toHaveTextContent("定價級距");
    expect(tip).toHaveTextContent("負責人");
  });

  it("名稱只有 1 字仍算缺少（門檻是 2 字，不是「有填就好」）", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByTestId("customer-modal-name"), "王");
    await user.hover(screen.getByTestId("customer-modal-submit-wrap"));

    expect(await screen.findByRole("tooltip")).toHaveTextContent("雇主名稱");
  });

  it("名稱只填空白字元不算填了（trim 後長度為 0）", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByTestId("customer-modal-name"), "   ");
    await user.hover(screen.getByTestId("customer-modal-submit-wrap"));

    expect(await screen.findByRole("tooltip")).toHaveTextContent("雇主名稱");
  });

  it("填滿名稱後，缺少清單只剩三個下拉欄位", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByTestId("customer-modal-name"), "台灣精密");
    await user.hover(screen.getByTestId("customer-modal-submit-wrap"));
    const tip = await screen.findByRole("tooltip");

    expect(tip).not.toHaveTextContent("雇主名稱");
    expect(tip).toHaveTextContent("合約狀態");
    expect(tip).toHaveTextContent("定價級距");
    expect(tip).toHaveTextContent("負責人");
  });

  it("負責人不會自動帶入，選了才會從缺少清單消失", async () => {
    const user = userEvent.setup();
    renderModal();

    await selectOption(user, "customer-modal-managerId", "陳專員");
    await user.hover(screen.getByTestId("customer-modal-submit-wrap"));
    const tip = await screen.findByRole("tooltip");

    // 與 WorkerModal 不同：這裡沒有「預設帶第一位負責人」的行為
    expect(tip).not.toHaveTextContent("負責人");
    expect(tip).toHaveTextContent("合約狀態");
  });

  it("只差最後一項時，清單就只剩那一項", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByTestId("customer-modal-name"), "台灣精密");
    await selectOption(user, "customer-modal-managerId", "陳專員");
    await selectOption(user, "customer-modal-contractStatus", "已簽約");

    await user.hover(screen.getByTestId("customer-modal-submit-wrap"));
    const tip = await screen.findByRole("tooltip");

    expect(tip).toHaveTextContent("定價級距");
    expect(tip).not.toHaveTextContent("合約狀態");
    expect(tip).not.toHaveTextContent("負責人");
    expect(tip).not.toHaveTextContent("雇主名稱");
  });

  it("四項都填了才解除停用", async () => {
    const user = userEvent.setup();
    renderModal();

    await fillAllRequired(user);

    expect(screen.getByTestId("customer-modal-submit")).toBeEnabled();
    // 解除停用後 tooltip 整個消失（改渲染沒有包 Tooltip 的按鈕）
    expect(
      screen.queryByTestId("customer-modal-submit-wrap")
    ).not.toBeInTheDocument();
  });

  it("把名稱清空後又變回停用", async () => {
    const user = userEvent.setup();
    renderModal();

    await fillAllRequired(user);
    expect(screen.getByTestId("customer-modal-submit")).toBeEnabled();

    await user.clear(screen.getByTestId("customer-modal-name"));

    expect(screen.getByTestId("customer-modal-submit")).toBeDisabled();
  });
});

describe("CustomerModal 的雇主類型切換", () => {
  it("預設是公司行號，顯示統一編號而非身分證字號", () => {
    renderModal();

    expect(screen.getByLabelText("統一編號")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("雇主國民身分證字號")
    ).not.toBeInTheDocument();
  });

  it("切到個人雇主後，公司專屬欄位換成個人專屬欄位", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("button", { name: "個人雇主" }));

    expect(screen.getByLabelText("雇主國民身分證字號")).toBeInTheDocument();
    expect(screen.getByLabelText("聘前講習證明序號")).toBeInTheDocument();
    expect(screen.queryByLabelText("統一編號")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("聯絡窗口姓名")).not.toBeInTheDocument();
  });

  it("名稱欄位的標籤與地址標籤會跟著雇主類型改寫", async () => {
    const user = userEvent.setup();
    renderModal();

    expect(screen.getByLabelText(/公司名稱/)).toBeInTheDocument();
    expect(screen.getByLabelText("登記地址")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "個人雇主" }));

    expect(screen.getByLabelText(/雇主姓名/)).toBeInTheDocument();
    expect(screen.getByLabelText("戶籍地址")).toBeInTheDocument();
  });

  it("切換類型不會清掉已填的共用欄位", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByTestId("customer-modal-name"), "台灣精密");
    await user.click(screen.getByRole("button", { name: "個人雇主" }));

    expect(screen.getByTestId("customer-modal-name")).toHaveValue("台灣精密");
  });

  it("切換類型不影響必填清單（統編／身分證都不是必填）", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("button", { name: "個人雇主" }));
    await fillAllRequired(user);

    // 個人雇主沒填身分證字號也能送出 —— missingFields 只看那四項，
    // 不因雇主類型而變。這裡把現況釘住。
    expect(screen.getByTestId("customer-modal-submit")).toBeEnabled();
  });
});

describe("CustomerModal 的送出", () => {
  it("送出時把空欄位轉成 undefined、managerId 轉成數字", async () => {
    const user = userEvent.setup();
    renderModal();

    await fillAllRequired(user);
    await user.click(screen.getByTestId("customer-modal-submit"));

    // CustomerModal 用的是 mutate（不是 mutateAsync）
    const create = getMutation("customers.create");
    expect(create.mutate).toHaveBeenCalledTimes(1);

    const payload = create.mutate.mock.calls[0][0];
    expect(payload).toMatchObject({
      employerType: "company",
      name: "台灣精密",
      managerId: 1,
      contractStatus: "signed",
      pricingTier: "standard",
      forceCreate: false,
    });
    // 沒填的欄位不能送空字串過去，否則後端會存下一堆 ""
    expect(payload.phone).toBeUndefined();
    expect(payload.taxId).toBeUndefined();
    expect(payload.notes).toBeUndefined();
    expect(payload.idFrontKey).toBeUndefined();
  });

  it("名稱前後空白會被 trim 掉才送出", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByTestId("customer-modal-name"), "  台灣精密  ");
    await selectOption(user, "customer-modal-managerId", "林專員");
    await selectOption(user, "customer-modal-contractStatus", "服務中");
    await selectOption(user, "customer-modal-pricingTier", "客製");
    await user.click(screen.getByTestId("customer-modal-submit"));

    expect(
      getMutation("customers.create").mutate.mock.calls[0][0]
    ).toMatchObject({ name: "台灣精密", managerId: 2 });
  });

  it("統編格式不對就擋下不送出，並顯示錯誤訊息", async () => {
    const user = userEvent.setup();
    renderModal();

    await fillAllRequired(user);
    await user.type(screen.getByLabelText("統一編號"), "12345678");
    await user.click(screen.getByTestId("customer-modal-submit"));

    expect(await screen.findByText("統一編號格式不正確")).toBeInTheDocument();
    expect(getMutation("customers.create").mutate).not.toHaveBeenCalled();
  });

  it("電話格式不對就擋下不送出", async () => {
    const user = userEvent.setup();
    renderModal();

    await fillAllRequired(user);
    await user.type(screen.getByLabelText("行動電話"), "123");
    await user.click(screen.getByTestId("customer-modal-submit"));

    expect(await screen.findByText("電話格式不正確")).toBeInTheDocument();
    expect(getMutation("customers.create").mutate).not.toHaveBeenCalled();
  });

  it("停用狀態下點送出鈕不會發出請求", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByTestId("customer-modal-submit"));

    expect(getMutation("customers.create").mutate).not.toHaveBeenCalled();
  });

  it("取消會呼叫 onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal({ onClose });

    await user.click(screen.getByTestId("customer-modal-cancel"));

    expect(onClose).toHaveBeenCalled();
  });
});

describe("CustomerModal 的編輯模式", () => {
  const EXISTING = {
    id: 9,
    employerType: "individual",
    name: "王大明",
    employerNo: "00033",
    phone: "0912345678",
    landline: "",
    address: "台北市中正區",
    registeredAddress: "",
    referrer: "",
    idNo: "A123456789",
    preCourseNo: "",
    taxId: "",
    industry: "",
    contactName: "",
    contactPhone: "",
    contractStatus: "in_service",
    pricingTier: "custom",
    managerId: 2,
    notes: "",
  };

  it("載入既有資料後表單帶值，且雇主類型跟著切成個人", async () => {
    setQueryData("customers.getById", EXISTING);
    renderModal({ editId: 9 });

    expect(await screen.findByTestId("customer-modal-name")).toHaveValue(
      "王大明"
    );
    // employerType 是 individual，所以出現的是個人專屬欄位
    expect(screen.getByLabelText("雇主國民身分證字號")).toHaveValue(
      "A123456789"
    );
    expect(screen.getByLabelText("行動電話")).toHaveValue("0912345678");
  });

  it("編輯模式不做必填擋關（missingFields 只在新增時計算）", async () => {
    setQueryData("customers.getById", { ...EXISTING, name: "" });
    renderModal({ editId: 9 });

    // 名稱是空的，換成新增模式一定會被擋，編輯模式卻是可按的
    expect(await screen.findByTestId("customer-modal-submit")).toBeEnabled();
    expect(
      screen.queryByTestId("customer-modal-submit-wrap")
    ).not.toBeInTheDocument();
  });

  it("標題會依模式切換", async () => {
    setQueryData("customers.getById", EXISTING);
    renderModal({ editId: 9 });

    // Radix 會渲染兩份標題（一份給螢幕閱讀器朗讀），用 role 取可見的那份
    expect(
      await screen.findByRole("heading", { name: "編輯雇主資料" })
    ).toBeInTheDocument();
  });

  it("送出時走 update 並帶上 id", async () => {
    const user = userEvent.setup();
    setQueryData("customers.getById", EXISTING);
    renderModal({ editId: 9 });

    await user.click(await screen.findByTestId("customer-modal-submit"));

    expect(
      getMutation("customers.update").mutate.mock.calls[0][0]
    ).toMatchObject({
      id: 9,
      name: "王大明",
      managerId: 2,
      employerType: "individual",
    });
  });
});

describe("CustomerModal 的同名警告流程", () => {
  // 後端在偵測到同名雇主時，會回一個訊息以 "DUPLICATE_NAME:" 開頭的錯誤，
  // 前端據此跳出確認視窗。這是「重複建立雇主」的最後一道防線 ——
  // 它把錯誤訊息當成控制流程用，所以只有能模擬 mutation 失敗才測得到。

  it("後端回 DUPLICATE_NAME 時跳出同名確認視窗", async () => {
    const user = userEvent.setup();
    setMutationError("customers.create", "DUPLICATE_NAME:台灣精密");
    renderModal();

    await fillAllRequired(user);
    await user.click(screen.getByTestId("customer-modal-submit"));

    expect(
      await screen.findByRole("heading", { name: "同名雇主警告" })
    ).toBeInTheDocument();
  });

  it("其他錯誤不會跳同名視窗，而是走一般錯誤提示", async () => {
    const user = userEvent.setup();
    setMutationError("customers.create", "資料庫連線失敗");
    renderModal();

    await fillAllRequired(user);
    await user.click(screen.getByTestId("customer-modal-submit"));

    expect(
      screen.queryByRole("heading", { name: "同名雇主警告" })
    ).not.toBeInTheDocument();
  });

  it("按「確定建立」會重送並帶上 forceCreate: true", async () => {
    const user = userEvent.setup();
    setMutationError("customers.create", "DUPLICATE_NAME:台灣精密");
    renderModal();

    await fillAllRequired(user);
    await user.click(screen.getByTestId("customer-modal-submit"));
    await screen.findByRole("heading", { name: "同名雇主警告" });

    await user.click(screen.getByRole("button", { name: "確定建立" }));

    const create = getMutation("customers.create");
    // 第一次送出 forceCreate: false，確認後那次才是 true
    expect(create.mutate).toHaveBeenCalledTimes(2);
    expect(create.mutate.mock.calls[0][0]).toMatchObject({
      forceCreate: false,
    });
    expect(create.mutate.mock.calls[1][0]).toMatchObject({
      forceCreate: true,
      name: "台灣精密",
    });
  });

  it("按「取消」會關掉警告視窗且不重送", async () => {
    const user = userEvent.setup();
    setMutationError("customers.create", "DUPLICATE_NAME:台灣精密");
    renderModal();

    await fillAllRequired(user);
    await user.click(screen.getByTestId("customer-modal-submit"));
    const warning = await screen.findByRole("heading", {
      name: "同名雇主警告",
    });
    expect(warning).toBeInTheDocument();

    const cancelButtons = screen.getAllByRole("button", { name: "取消" });
    await user.click(cancelButtons[cancelButtons.length - 1]);

    expect(
      screen.queryByRole("heading", { name: "同名雇主警告" })
    ).not.toBeInTheDocument();
    expect(getMutation("customers.create").mutate).toHaveBeenCalledTimes(1);
  });
});
