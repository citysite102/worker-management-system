/**
 * WorkerModal 的元件測試。
 *
 * 這個 Modal 有 715 行，核心是 `missingFields` —— 它決定送出鈕停不停用、
 * 以及 tooltip 要列出哪些欄位。這段邏輯錯了不會噴任何錯誤：要嘛使用者被
 * 永遠停用的按鈕擋住（不知道還缺什麼），要嘛送出了不完整的資料。
 *
 * E2E 只能驗到「按鈕是停用的」，驗不到「在什麼條件下、缺哪幾項」的組合。
 * 那些分支要靠元件測試逐一走過。
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkerModal } from "./WorkerModal";
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
  { id: 1, name: "陳專員", createdAt: new Date("2026-01-01") },
  { id: 2, name: "林專員", createdAt: new Date("2026-01-01") },
];

beforeEach(() => {
  resetTrpcMock();
  setQueryData("managers.list", MANAGERS);
});

function renderModal(props: Partial<Parameters<typeof WorkerModal>[0]> = {}) {
  return render(
    <WorkerModal open onClose={vi.fn()} onSuccess={vi.fn()} {...props} />
  );
}

describe("WorkerModal 的必填判斷", () => {
  it("剛開啟時缺姓名，送出鈕停用", async () => {
    renderModal();

    expect(await screen.findByTestId("worker-modal-submit")).toBeDisabled();
  });

  it("tooltip 列出缺少的欄位", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.hover(screen.getByTestId("worker-modal-submit-wrap"));

    const tip = await screen.findByRole("tooltip");
    expect(tip).toHaveTextContent("中文或英文姓名");
  });

  it("只填中文姓名就足以解除停用", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByTestId("worker-modal-name-cn"), "白茵瑤");

    expect(screen.getByTestId("worker-modal-submit")).toBeEnabled();
  });

  it("只填英文姓名也足以解除停用（兩者擇一）", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByTestId("worker-modal-name-en"), "INTAN SUSELA");

    expect(screen.getByTestId("worker-modal-submit")).toBeEnabled();
  });

  it("只填空白字元不算填了姓名", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByTestId("worker-modal-name-cn"), "   ");

    expect(screen.getByTestId("worker-modal-submit")).toBeDisabled();
  });

  it("把姓名清空後又變回停用", async () => {
    const user = userEvent.setup();
    renderModal();
    const nameCn = screen.getByTestId("worker-modal-name-cn");

    await user.type(nameCn, "白茵瑤");
    expect(screen.getByTestId("worker-modal-submit")).toBeEnabled();

    await user.clear(nameCn);
    expect(screen.getByTestId("worker-modal-submit")).toBeDisabled();
  });

  it("負責人會自動帶入第一位，所以不會出現在缺少清單裡", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.hover(screen.getByTestId("worker-modal-submit-wrap"));
    const tip = await screen.findByRole("tooltip");

    // 這其實是個設計問題：負責人標示為必填（*），但新增時一定會自動帶入
    // managers[0]，所以這個必填提示只有在「系統完全沒有負責人」時才會出現。
    // 這裡把現況釘住 —— 見 README.testing.md 的待處理清單。
    expect(tip).not.toHaveTextContent("負責人");
  });

  it("系統完全沒有負責人時，缺少清單才會列出負責人", async () => {
    const user = userEvent.setup();
    setQueryData("managers.list", []);
    renderModal();

    await user.type(screen.getByTestId("worker-modal-name-cn"), "白茵瑤");
    await user.hover(screen.getByTestId("worker-modal-submit-wrap"));

    const tip = await screen.findByRole("tooltip");
    expect(tip).toHaveTextContent("負責人");
    expect(screen.getByTestId("worker-modal-submit")).toBeDisabled();
  });
});

describe("WorkerModal 的編輯模式", () => {
  it("編輯既有資料時不做必填擋關（missingFields 只在新增時計算）", async () => {
    setQueryData("workers.getById", {
      id: 7,
      name: "白茵瑤",
      nameCn: "白茵瑤",
      nameEn: "",
      lifecycleStatus: "employed",
      documentStatus: "complete",
      managerId: 1,
    });
    renderModal({ editId: 7 });

    expect(await screen.findByTestId("worker-modal-submit")).toBeEnabled();
  });

  it("標題會依模式切換", async () => {
    renderModal();
    // Radix 會渲染兩份標題（一份給螢幕閱讀器朗讀），用 role 取可見的那份
    expect(
      await screen.findByRole("heading", { name: "新增移工" })
    ).toBeInTheDocument();
  });
});

describe("WorkerModal 的送出", () => {
  it("送出後會呼叫 workers.create，且帶上填入的姓名", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByTestId("worker-modal-name-cn"), "白茵瑤");
    await user.click(screen.getByTestId("worker-modal-submit"));

    // 注意 WorkerModal 用的是 mutateAsync 而非 mutate
    const create = getMutation("workers.create");
    expect(create.mutateAsync).toHaveBeenCalled();
    expect(create.mutateAsync.mock.calls[0][0]).toMatchObject({
      nameCn: "白茵瑤",
      name: "白茵瑤", // name 會由 nameCn 或 nameEn 推導
    });
  });

  it("停用狀態下點送出鈕不會發出請求", async () => {
    const user = userEvent.setup();
    renderModal();

    // 按鈕是 disabled + pointer-events-none，點下去應該完全沒反應
    await user.click(screen.getByTestId("worker-modal-submit"));

    expect(getMutation("workers.create").mutateAsync).not.toHaveBeenCalled();
  });

  it("取消會呼叫 onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal({ onClose });

    await user.click(screen.getByTestId("worker-modal-cancel"));

    expect(onClose).toHaveBeenCalled();
  });
});
