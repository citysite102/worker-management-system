/**
 * CSV 匯出的單元測試。
 *
 * 這支函式直接操作 DOM 與 Blob 來觸發下載，測試的做法是攔截
 * URL.createObjectURL 拿到 Blob，再把內容讀回來驗證。
 *
 * 重點在跳脫規則 —— CSV 的引號/逗號/換行處理寫錯不會噴錯，
 * 只會在使用者用 Excel 打開時看到欄位錯位，是最容易漏掉的那種 bug。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { exportToCsv } from "./exportToCsv";

/** 執行匯出並取回實際產生的 CSV 內容。 */
async function captureCsv(
  headers: string[],
  rows: unknown[][]
): Promise<{ content: string; filename: string }> {
  let captured: Blob | undefined;
  let filename = "";

  const createObjectURL = vi.fn((blob: Blob) => {
    captured = blob;
    return "blob:mock";
  });
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL,
    revokeObjectURL: vi.fn(),
  });

  // 攔截 click，避免 jsdom 真的嘗試導航
  const clickSpy = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(function (this: HTMLAnchorElement) {
      filename = this.download;
    });

  exportToCsv("測試檔", headers, rows);
  clickSpy.mockRestore();

  if (!captured) throw new Error("沒有產生 Blob");
  // 注意：不能用 blob.text() —— 它內部的 TextDecoder 預設會把 BOM 吃掉，
  // 導致「有沒有輸出 BOM」這件事根本測不到。必須自己用 ignoreBOM 解碼。
  const bytes = await captured.arrayBuffer();
  const content = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);
  return { content, filename };
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("exportToCsv", () => {
  it("加入 UTF-8 BOM，讓 Excel 開中文不亂碼", async () => {
    const { content } = await captureCsv(["姓名"], [["王小明"]]);
    expect(content.startsWith("﻿")).toBe(true);
  });

  it("用 CRLF 換行（Excel 相容）", async () => {
    const { content } = await captureCsv(["姓名"], [["甲"], ["乙"]]);
    expect(content).toBe("﻿姓名\r\n甲\r\n乙");
  });

  it("空值一律輸出破折號而非空白", async () => {
    const { content } = await captureCsv(
      ["A", "B", "C"],
      [[null, undefined, ""]]
    );
    expect(content).toBe("﻿A,B,C\r\n—,—,—");
  });

  it("含逗號的值會被引號包住，不會造成欄位錯位", async () => {
    const { content } = await captureCsv(["地址"], [["台北市,信義區"]]);
    expect(content).toBe('﻿地址\r\n"台北市,信義區"');
  });

  it("含引號的值以雙引號跳脫", async () => {
    const { content } = await captureCsv(["備註"], [['他說"你好"']]);
    expect(content).toBe('﻿備註\r\n"他說""你好"""');
  });

  it("含換行的值會被引號包住", async () => {
    const { content } = await captureCsv(["備註"], [["第一行\n第二行"]]);
    expect(content).toBe('﻿備註\r\n"第一行\n第二行"');
  });

  it("數字與布林值正常轉字串", async () => {
    const { content } = await captureCsv(["數量", "啟用"], [[42, true]]);
    expect(content).toBe("﻿數量,啟用\r\n42,true");
  });

  it("零不會被當成空值（常見的 falsy 陷阱）", async () => {
    const { content } = await captureCsv(["數量"], [[0]]);
    expect(content).toBe("﻿數量\r\n0");
  });

  it("檔名帶上今天日期", async () => {
    const { filename } = await captureCsv(["A"], [["x"]]);
    expect(filename).toMatch(/^測試檔_\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it("沒有資料列時仍輸出表頭", async () => {
    const { content } = await captureCsv(["姓名", "電話"], []);
    expect(content).toBe("﻿姓名,電話");
  });
});
