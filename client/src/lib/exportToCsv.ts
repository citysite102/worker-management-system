/**
 * 共用 CSV 匯出工具
 * - 自動加入 UTF-8 BOM，確保 Excel 開啟中文不亂碼
 * - 欄位值含逗號、換行、引號時自動加引號跳脫
 */

/** 將任意值轉為 CSV 安全字串 */
function toCsvCell(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const str = String(value);
  // 含逗號、換行、引號時需加引號包裹，內部引號雙倍跳脫
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * 匯出 CSV 並觸發瀏覽器下載
 * @param filename  下載檔名（不含 .csv）
 * @param headers   欄標陣列（中文）
 * @param rows      資料列陣列，每列為欄標對應的值陣列
 */
export function exportToCsv(filename: string, headers: string[], rows: unknown[][]): void {
  const BOM = "\uFEFF"; // UTF-8 BOM，讓 Excel 正確識別中文
  const headerLine = headers.map(toCsvCell).join(",");
  const dataLines = rows.map(row => row.map(toCsvCell).join(","));
  const csvContent = BOM + [headerLine, ...dataLines].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
