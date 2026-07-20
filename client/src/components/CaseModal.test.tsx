/**
 * CaseModal 的元件測試。
 *
 * 這個 Modal 有 988 行，但真正會咬人的邏輯集中在三處：
 *
 * 1. `missingFields` —— 決定送出鈕停不停用、tooltip 列出哪些欄位。三個必填
 *    欄位（案件名稱／負責人／選擇雇主）的組合，E2E 只驗得到「按鈕停用」，
 *    驗不到「在什麼條件下缺哪幾項」。
 * 2. `missingFields` 與 zod schema 的門檻不一致（見下方測試註解）—— 這種
 *    「按鈕可按但送不出去」的狀況只有元件測試抓得到。
 * 3. 「選定申請資格 → 自動帶入被照顧者」的 useEffect —— 跨兩個查詢結果的
 *    連動，錯了畫面不會噴錯，只是安靜地帶錯人。
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CaseModal from "./CaseModal";
import {
  getMutation,
  resetTrpcMock,
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
  { id: 1, name: "陳專員" },
  { id: 2, name: "林專員" },
];

const CUSTOMERS = [
  {
    id: 10,
    name: "台灣精密",
    employerNo: "00033",
    employerType: "company",
    phone: "02-1234-5678",
    address: "台北市中正區",
  },
  {
    id: 20,
    name: "王大明",
    employerNo: null,
    employerType: "individual",
    phone: "0912345678",
    address: "新北市板橋區",
  },
];

const WORKERS = [
  {
    id: 100,
    name: "白茵瑤",
    nameCn: "白茵瑤",
    nationality: "印尼",
    phone: "0900000000",
  },
];

beforeEach(() => {
  resetTrpcMock();
  setQueryData("managers.list", MANAGERS);
  setQueryData("customers.list", CUSTOMERS);
  setQueryData("workers.list", WORKERS);
});

function renderModal(props: Partial<Parameters<typeof CaseModal>[0]> = {}) {
  return render(
    <CaseModal open onClose={vi.fn()} onSuccess={vi.fn()} {...props} />
  );
}

/**
 * CaseModal 的下拉選單沒有 data-testid，label 也沒有跟 trigger 綁 htmlFor，
 * 所以只能靠 trigger 上的 placeholder／已選文字來認人。
 * 限定在 combobox 角色裡找，才不會抓到同文字的 <label>。
 */
function selectTrigger(text: string) {
  const hit = screen
    .getAllByRole("combobox")
    .find(el => el.textContent?.includes(text));
  if (!hit) throw new Error(`找不到文字含「${text}」的下拉選單`);
  return hit;
}

async function selectOption(
  user: ReturnType<typeof userEvent.setup>,
  triggerText: string,
  optionLabel: string | RegExp
) {
  await user.click(selectTrigger(triggerText));
  await user.click(await screen.findByRole("option", { name: optionLabel }));
}

/** 案件名稱欄位沒有 testid，只能用 placeholder 找。 */
function nameInput() {
  return screen.getByPlaceholderText("例：台灣精密科技 2025 批次");
}

describe("CaseModal 的必填判斷", () => {
  it("剛開啟時三項必填全缺，tooltip 逐項列出", async () => {
    const user = userEvent.setup();
    renderModal();

    expect(screen.getByTestId("case-modal-submit")).toBeDisabled();

    await user.hover(screen.getByTestId("case-modal-submit-wrap"));
    const tip = await screen.findByRole("tooltip");

    expect(tip).toHaveTextContent("案件名稱");
    expect(tip).toHaveTextContent("負責人");
    expect(tip).toHaveTextContent("選擇雇主");
  });

  it("填了名稱後，缺少清單只剩負責人與雇主", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(nameInput(), "台灣精密 2026 批次");
    await user.hover(screen.getByTestId("case-modal-submit-wrap"));
    const tip = await screen.findByRole("tooltip");

    expect(tip).not.toHaveTextContent("案件名稱");
    expect(tip).toHaveTextContent("負責人");
    expect(tip).toHaveTextContent("選擇雇主");
  });

  it("defaultCustomerId 會預先帶入雇主，所以雇主不在缺少清單裡", async () => {
    const user = userEvent.setup();
    renderModal({ defaultCustomerId: 10 });

    await user.hover(screen.getByTestId("case-modal-submit-wrap"));
    const tip = await screen.findByRole("tooltip");

    expect(tip).not.toHaveTextContent("選擇雇主");
    expect(tip).toHaveTextContent("案件名稱");
    expect(tip).toHaveTextContent("負責人");
  });

  it("只差負責人時，清單就只剩負責人", async () => {
    const user = userEvent.setup();
    renderModal({ defaultCustomerId: 10 });

    await user.type(nameInput(), "台灣精密 2026 批次");
    await user.hover(screen.getByTestId("case-modal-submit-wrap"));
    const tip = await screen.findByRole("tooltip");

    expect(tip).toHaveTextContent("負責人");
    expect(tip).not.toHaveTextContent("案件名稱");
    expect(tip).not.toHaveTextContent("選擇雇主");
  });

  it("三項都填了才解除停用", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(nameInput(), "台灣精密 2026 批次");
    await selectOption(user, "選擇負責人", "陳專員");
    await selectOption(user, "選擇雇主", /台灣精密/);

    expect(screen.getByTestId("case-modal-submit")).toBeEnabled();
    // 解除停用後整個 Tooltip 包裝都不再渲染
    expect(
      screen.queryByTestId("case-modal-submit-wrap")
    ).not.toBeInTheDocument();
  });

  it("把名稱清空後又變回停用", async () => {
    const user = userEvent.setup();
    renderModal({ defaultCustomerId: 10 });

    await user.type(nameInput(), "台灣精密 2026 批次");
    await selectOption(user, "選擇負責人", "陳專員");
    expect(screen.getByTestId("case-modal-submit")).toBeEnabled();

    await user.clear(nameInput());

    expect(screen.getByTestId("case-modal-submit")).toBeDisabled();
  });

  it("名稱只有 1 字時按鈕仍停用，門檻與 schema 的 min(2) 一致", async () => {
    const user = userEvent.setup();
    renderModal({ defaultCustomerId: 10 });

    await user.type(nameInput(), "王");
    await selectOption(user, "選擇負責人", "陳專員");

    // 曾經的 bug：missingFields 只判斷「是不是空的」，但 schema 要求至少 2 字。
    // 使用者打一個字時按鈕看起來可按，按下去卻只是靜靜地失敗 —— 錯誤訊息在
    // 基本資料 Tab 的欄位下方，當時若在其他 Tab 就完全看不到回饋。
    expect(screen.getByTestId("case-modal-submit")).toBeDisabled();
  });

  it("名稱只有 1 字時，tooltip 會說明至少要 2 字", async () => {
    const user = userEvent.setup();
    renderModal({ defaultCustomerId: 10 });

    await user.type(nameInput(), "王");
    await selectOption(user, "選擇負責人", "陳專員");
    await user.hover(screen.getByTestId("case-modal-submit-wrap"));

    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "案件名稱（至少 2 字）"
    );
  });

  it("只有空白字元不算填了名稱", async () => {
    const user = userEvent.setup();
    renderModal({ defaultCustomerId: 10 });

    await user.type(nameInput(), "  ");
    await selectOption(user, "選擇負責人", "陳專員");

    expect(screen.getByTestId("case-modal-submit")).toBeDisabled();
  });

  it("停用狀態下點送出鈕不會發出請求", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByTestId("case-modal-submit"));

    expect(getMutation("cases.create").mutate).not.toHaveBeenCalled();
  });

  it("取消會呼叫 onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal({ onClose });

    await user.click(screen.getByTestId("case-modal-cancel"));

    expect(onClose).toHaveBeenCalled();
  });
});

describe("CaseModal 的送出", () => {
  it("送出時把下拉選到的 id 轉成數字，未填的選填欄位維持 null", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(nameInput(), "台灣精密 2026 批次");
    await selectOption(user, "選擇負責人", "林專員");
    await selectOption(user, "選擇雇主", /台灣精密/);
    await user.click(screen.getByTestId("case-modal-submit"));

    // CaseModal 用的是 mutate（不是 mutateAsync）
    const create = getMutation("cases.create");
    expect(create.mutate).toHaveBeenCalledTimes(1);

    const payload = create.mutate.mock.calls[0][0];
    expect(payload).toMatchObject({
      name: "台灣精密 2026 批次",
      managerId: 2,
      customerId: 10,
      status: "in_progress", // 預設值，沒動過也要送出去
      needsReview: false,
    });
    expect(payload.primaryWorkerId).toBeNull();
    expect(payload.careReceiverId).toBeNull();
    expect(payload.employmentPeriodMonths).toBeNull();
  });

  it("defaultWorkerId 會預先帶入外國人並一起送出", async () => {
    const user = userEvent.setup();
    renderModal({ defaultCustomerId: 10, defaultWorkerId: 100 });

    await user.type(nameInput(), "台灣精密 2026 批次");
    await selectOption(user, "選擇負責人", "陳專員");
    await user.click(screen.getByTestId("case-modal-submit"));

    expect(getMutation("cases.create").mutate.mock.calls[0][0]).toMatchObject({
      primaryWorkerId: 100,
    });
  });

  it("勾選「需檢查」後 needsReview 會是 true", async () => {
    const user = userEvent.setup();
    renderModal({ defaultCustomerId: 10 });

    await user.type(nameInput(), "台灣精密 2026 批次");
    await selectOption(user, "選擇負責人", "陳專員");
    await user.click(screen.getByLabelText(/需檢查/));
    await user.click(screen.getByTestId("case-modal-submit"));

    expect(getMutation("cases.create").mutate.mock.calls[0][0]).toMatchObject({
      needsReview: true,
    });
  });
});

describe("CaseModal 的雇主連動", () => {
  it("選定雇主後帶出唯讀的電話與地址", async () => {
    const user = userEvent.setup();
    renderModal();

    expect(screen.queryByText("自動帶入（唯讀）")).not.toBeInTheDocument();

    await selectOption(user, "選擇雇主", /台灣精密/);

    expect(screen.getByText("02-1234-5678")).toBeInTheDocument();
    expect(screen.getByText("台北市中正區")).toBeInTheDocument();
  });

  it("公司雇主不出現被照顧者選單，個人雇主才出現", async () => {
    const user = userEvent.setup();
    setQueryData("customers.careReceivers.listByCustomer", [
      { id: 500, careReceiverName: "王阿嬤", careReceiverRelation: "祖母" },
    ]);
    renderModal();

    await selectOption(user, "選擇雇主", /台灣精密/);
    expect(screen.queryByText("選擇被照顧者")).not.toBeInTheDocument();

    await selectOption(user, "台灣精密", /王大明/);
    expect(screen.getByText("選擇被照顧者")).toBeInTheDocument();
  });

  it("個人雇主但沒有被照顧者資料時顯示提示而非空選單", async () => {
    const user = userEvent.setup();
    setQueryData("customers.careReceivers.listByCustomer", []);
    renderModal();

    await selectOption(user, "選擇雇主", /王大明/);

    expect(screen.getByText("此客戶尚未建立被照顧者資料")).toBeInTheDocument();
  });

  it("選定申請資格後自動帶入該資格綁定的被照顧者", async () => {
    const user = userEvent.setup();
    setQueryData("customers.careReceivers.listByCustomer", [
      {
        id: 500,
        careReceiverName: "王阿嬤",
        careReceiverIdNo: "B222222222",
        careReceiverAddress: "新北市板橋區",
      },
    ]);
    setQueryData("customers.qualifications.listByCustomer", [
      {
        id: 900,
        qualifierCategory: "family",
        label: "家庭看護申請",
        careReceiverId: 500,
      },
    ]);
    renderModal({ defaultCustomerId: 20 });

    // 資格下拉預設選在「— 不連結資格 —」，trigger 顯示的是那一項的文字
    await selectOption(user, "不連結資格", /家庭看護申請/);

    // 「王阿嬤」會同時出現在唯讀區塊與被照顧者下拉的 trigger（因為
    // careReceiverId 也被一起設好了），所以限定在唯讀區塊內斷言。
    const block = screen.getByText("自動帶入被照顧者").parentElement!;
    expect(block).toHaveTextContent("王阿嬤");
    expect(block).toHaveTextContent("B222222222");
    expect(block).toHaveTextContent("新北市板橋區");
  });

  it("資格沒有綁被照顧者時不會顯示帶入區塊", async () => {
    const user = userEvent.setup();
    setQueryData("customers.careReceivers.listByCustomer", [
      { id: 500, careReceiverName: "王阿嬤" },
    ]);
    setQueryData("customers.qualifications.listByCustomer", [
      {
        id: 901,
        qualifierCategory: "business",
        label: "製造業申請",
        careReceiverId: null,
      },
    ]);
    renderModal({ defaultCustomerId: 20 });

    await selectOption(user, "不連結資格", /製造業申請/);

    expect(screen.queryByText("自動帶入被照顧者")).not.toBeInTheDocument();
  });
});

describe("CaseModal 的編輯模式", () => {
  // 定義成模組層級常數：物件參考若每次 render 都變，載入資料的 useEffect
  // 會無限重跑。
  const EDITING_CASE = {
    id: 55,
    caseNo: "C-2026-0001",
    name: "台灣精密 2025 批次",
    customerId: 10,
    managerId: 2,
    status: "paused",
    needsReview: 1,
    caseCondition: "需先辦居留證展延申請",
    notes: "備註內容",
    employmentPeriodMonths: 24,
  };

  it("載入既有案件後表單帶值", async () => {
    renderModal({ editingCase: EDITING_CASE });

    expect(nameInput()).toHaveValue("台灣精密 2025 批次");
    expect(
      screen.getByDisplayValue("需先辦居留證展延申請")
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/需檢查/)).toBeChecked();
    // status/managerId 是下拉，驗 trigger 顯示的文字
    expect(selectTrigger("暫停")).toBeInTheDocument();
    expect(selectTrigger("林專員")).toBeInTheDocument();
  });

  it("needsReview 由 1/0 轉成 boolean（後端存的是數字）", () => {
    renderModal({ editingCase: { ...EDITING_CASE, needsReview: 0 } });

    expect(screen.getByLabelText(/需檢查/)).not.toBeChecked();
  });

  it("編輯模式不做必填擋關（missingFields 只在新增時計算）", () => {
    renderModal({ editingCase: { ...EDITING_CASE, name: "" } });

    // 名稱是空的，換成新增模式一定會被擋，編輯模式卻是可按的
    expect(screen.getByTestId("case-modal-submit")).toBeEnabled();
    expect(
      screen.queryByTestId("case-modal-submit-wrap")
    ).not.toBeInTheDocument();
  });

  it("標題顯示編輯字樣與案件編號", () => {
    renderModal({ editingCase: EDITING_CASE });

    // Radix 會渲染兩份標題（一份給螢幕閱讀器朗讀），用 role 取可見的那份
    const heading = screen.getByRole("heading", { name: /編輯案件/ });
    expect(heading).toHaveTextContent("C-2026-0001");
  });

  it("送出時走 update 並帶上 id", async () => {
    const user = userEvent.setup();
    renderModal({ editingCase: EDITING_CASE });

    await user.click(screen.getByTestId("case-modal-submit"));

    expect(getMutation("cases.update").mutate.mock.calls[0][0]).toMatchObject({
      id: 55,
      name: "台灣精密 2025 批次",
      managerId: 2,
      customerId: 10,
      status: "paused",
      needsReview: true,
    });
  });
});
