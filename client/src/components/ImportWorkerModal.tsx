import { useState, useRef, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Upload, Download, CheckCircle2, XCircle, AlertTriangle, FileText, X } from "lucide-react";

// ─── CSV 欄位定義（與範本對應）────────────────────────────────────────────────
const CSV_HEADERS = [
  "姓名", "國籍", "證件類型", "證號", "生命週期狀態", "文件狀態",
  "負責人ID", "聯絡電話", "入境日期", "證件到期日", "連結", "備註",
];

const ID_TYPE_MAP: Record<string, "resident_permit" | "passport"> = {
  "居留證": "resident_permit",
  "resident_permit": "resident_permit",
  "護照": "passport",
  "passport": "passport",
};

const LIFECYCLE_MAP: Record<string, string> = {
  "招募中": "recruiting",
  "recruiting": "recruiting",
  "文件辦理": "document_processing",
  "document_processing": "document_processing",
  "在職": "employed",
  "employed": "employed",
  "待續聘": "pending_renewal",
  "pending_renewal": "pending_renewal",
  "已離境": "departed",
  "departed": "departed",
};

const DOCUMENT_MAP: Record<string, string> = {
  "未啟動": "not_started",
  "not_started": "not_started",
  "待補件": "pending_supplement",
  "pending_supplement": "pending_supplement",
  "即將到期": "expiring_soon",
  "expiring_soon": "expiring_soon",
  "完備": "complete",
  "complete": "complete",
};

// ─── 範本 CSV 內容 ─────────────────────────────────────────────────────────────
function generateTemplateCsv(): string {
  const header = CSV_HEADERS.join(",");
  const example1 = [
    "陳小明", "越南", "居留證", "A123456789", "在職", "完備",
    "1", "0912345678", "2023-01-15", "2025-12-31",
    "https://drive.google.com/...", "備註範例",
  ].join(",");
  const example2 = [
    "Nguyen Van A", "越南", "護照", "VN123456", "招募中", "未啟動",
    "2", "", "", "", "", "",
  ].join(",");
  const note = "# 說明：證件類型填「居留證」或「護照」；生命週期狀態填「招募中/文件辦理/在職/待續聘/已離境」；文件狀態填「未啟動/待補件/即將到期/完備」；負責人ID請參考設定頁";
  return `${note}\n${header}\n${example1}\n${example2}\n`;
}

// ─── CSV 解析 ──────────────────────────────────────────────────────────────────
interface ParsedRow {
  rowIndex: number;
  raw: string[];
  parsed?: {
    name: string;
    nationality?: string;
    idType: "resident_permit" | "passport";
    idNumber: string;
    lifecycleStatus: string;
    documentStatus: string;
    managerId: number;
    phone?: string;
    entryDate?: string;
    idExpiryDate?: string;
    externalLink?: string;
    notes?: string;
  };
  parseError?: string;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseRows(csvText: string): ParsedRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !l.startsWith("#"));

  if (lines.length === 0) return [];

  // Skip header row
  const dataLines = lines[0].startsWith("姓名") || lines[0].startsWith("name")
    ? lines.slice(1)
    : lines;

  return dataLines
    .filter(l => l.trim())
    .map((line, idx) => {
      const raw = parseCsvLine(line);
      const [
        name = "", nationality = "", idTypeRaw = "", idNumber = "",
        lifecycleRaw = "", documentRaw = "", managerIdRaw = "",
        phone = "", entryDate = "", idExpiryDate = "", externalLink = "", notes = "",
      ] = raw;

      const rowIndex = idx + 1;

      if (!name.trim()) {
        return { rowIndex, raw, parseError: "姓名為必填" };
      }
      const idType = ID_TYPE_MAP[idTypeRaw.trim()];
      if (!idType) {
        return { rowIndex, raw, parseError: `證件類型「${idTypeRaw}」無效，請填「居留證」或「護照」` };
      }
      if (!idNumber.trim()) {
        return { rowIndex, raw, parseError: "證號為必填" };
      }
      const lifecycleStatus = LIFECYCLE_MAP[lifecycleRaw.trim()];
      if (!lifecycleStatus) {
        return { rowIndex, raw, parseError: `生命週期狀態「${lifecycleRaw}」無效` };
      }
      const documentStatus = DOCUMENT_MAP[documentRaw.trim()];
      if (!documentStatus) {
        return { rowIndex, raw, parseError: `文件狀態「${documentRaw}」無效` };
      }
      const managerId = parseInt(managerIdRaw.trim());
      if (!managerId || isNaN(managerId)) {
        return { rowIndex, raw, parseError: "負責人ID 必須為有效數字（請參考設定頁）" };
      }

      return {
        rowIndex,
        raw,
        parsed: {
          name: name.trim(),
          nationality: nationality.trim() || undefined,
          idType,
          idNumber: idNumber.trim(),
          lifecycleStatus,
          documentStatus,
          managerId,
          phone: phone.trim() || undefined,
          entryDate: entryDate.trim() || undefined,
          idExpiryDate: idExpiryDate.trim() || undefined,
          externalLink: externalLink.trim() || undefined,
          notes: notes.trim() || undefined,
        },
      };
    });
}

// ─── 元件 ──────────────────────────────────────────────────────────────────────
interface ImportWorkerModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = "upload" | "preview" | "result";

export function ImportWorkerModal({ open, onClose, onSuccess }: ImportWorkerModalProps) {
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importResult, setImportResult] = useState<{
    successCount: number;
    failCount: number;
    results: { index: number; name: string; success: boolean; error?: string }[];
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const importMutation = trpc.workers.import.useMutation({
    onSuccess: (data) => {
      setImportResult(data);
      setStep("result");
      utils.workers.list.invalidate();
      if (data.failCount === 0) {
        toast.success(`成功匯入 ${data.successCount} 筆移工資料`);
      } else {
        toast.warning(`匯入完成：${data.successCount} 筆成功，${data.failCount} 筆失敗`);
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast.error("請上傳 .csv 格式的檔案");
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseRows(text);
      if (rows.length === 0) {
        toast.error("CSV 檔案沒有可解析的資料列");
        return;
      }
      setParsedRows(rows);
      setStep("preview");
    };
    reader.readAsText(file, "UTF-8");
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleConfirmImport = () => {
    const validRows = parsedRows.filter(r => r.parsed).map(r => r.parsed!);
    if (validRows.length === 0) {
      toast.error("沒有可匯入的有效資料");
      return;
    }
    importMutation.mutate({ rows: validRows as any });
  };

  const handleDownloadTemplate = () => {
    const csv = generateTemplateCsv();
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "移工資料匯入範本.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    setStep("upload");
    setFileName("");
    setParsedRows([]);
    setImportResult(null);
    if (step === "result" && importResult && importResult.successCount > 0) {
      onSuccess();
    }
    onClose();
  };

  const validCount = parsedRows.filter(r => r.parsed).length;
  const errorCount = parsedRows.filter(r => r.parseError).length;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            {step === "upload" && "匯入移工資料"}
            {step === "preview" && `預覽解析結果（${parsedRows.length} 列）`}
            {step === "result" && "匯入結果"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">

          {/* ── Step 1: Upload ── */}
          {step === "upload" && (
            <div className="space-y-5 py-2">
              {/* 拖放區域 */}
              <div
                className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
                  isDragging ? "border-blue-400 bg-blue-50" : "border-border hover:border-muted-foreground/50 hover:bg-muted/30"
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground mb-1">點擊或拖放 CSV 檔案至此</p>
                <p className="text-xs text-muted-foreground">僅支援 .csv 格式，建議使用 UTF-8 編碼儲存</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {/* 格式說明 */}
              <div className="rounded-md border border-border bg-muted/30 p-4 text-xs text-muted-foreground space-y-1.5">
                <p className="font-medium text-foreground mb-2">CSV 欄位順序（依序）</p>
                <div className="grid grid-cols-3 gap-x-4 gap-y-1">
                  {CSV_HEADERS.map((h, i) => (
                    <span key={h} className="font-mono">
                      <span className="text-muted-foreground/60 mr-1">{i + 1}.</span>{h}
                    </span>
                  ))}
                </div>
                <p className="mt-2 pt-2 border-t border-border">
                  <span className="font-medium text-foreground">負責人ID</span> 請至設定頁查詢各負責人的 ID 編號。
                </p>
              </div>

              {/* 下載範本 */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                下載 CSV 範本（含範例資料）
              </Button>
            </div>
          )}

          {/* ── Step 2: Preview ── */}
          {step === "preview" && (
            <div className="space-y-4 py-2">
              {/* 統計摘要 */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 text-sm">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{fileName}</span>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 border border-green-200 px-2 py-1 rounded">
                    <CheckCircle2 className="w-3 h-3" />
                    {validCount} 筆可匯入
                  </span>
                  {errorCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-500 bg-red-50 border border-red-200 px-2 py-1 rounded">
                      <XCircle className="w-3 h-3" />
                      {errorCount} 筆格式錯誤
                    </span>
                  )}
                </div>
              </div>

              {/* 預覽表格 */}
              <div className="border border-border rounded-md overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground w-8">#</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">狀態</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">姓名</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">證件類型</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">證號</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">生命週期</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">說明</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {parsedRows.map((row) => (
                      <tr
                        key={row.rowIndex}
                        className={row.parseError ? "bg-red-50" : "bg-background hover:bg-muted/20"}
                      >
                        <td className="px-3 py-2 text-muted-foreground">{row.rowIndex}</td>
                        <td className="px-3 py-2">
                          {row.parseError ? (
                            <XCircle className="w-4 h-4 text-red-500" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          )}
                        </td>
                        <td className="px-3 py-2 font-medium">{row.raw[0] || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.raw[2] || "—"}</td>
                        <td className="px-3 py-2 font-mono">{row.raw[3] || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.raw[4] || "—"}</td>
                        <td className="px-3 py-2 text-red-500">{row.parseError || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {errorCount > 0 && (
                <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2.5">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>格式錯誤的列將被跳過，僅匯入 {validCount} 筆有效資料。如需修正，請重新上傳 CSV 檔案。</span>
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Result ── */}
          {step === "result" && importResult && (
            <div className="space-y-4 py-2">
              {/* 結果摘要 */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-green-600 bg-green-50 border border-green-200 px-3 py-1.5 rounded-md">
                    <CheckCircle2 className="w-4 h-4" />
                    成功 {importResult.successCount} 筆
                  </span>
                  {importResult.failCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-red-500 bg-red-50 border border-red-200 px-3 py-1.5 rounded-md">
                      <XCircle className="w-4 h-4" />
                      失敗 {importResult.failCount} 筆
                    </span>
                  )}
                </div>
              </div>

              {/* 失敗明細 */}
              {importResult.failCount > 0 && (
                <div className="border border-border rounded-md overflow-hidden">
                  <div className="bg-muted/50 border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
                    失敗明細
                  </div>
                  <div className="divide-y divide-border">
                    {importResult.results
                      .filter(r => !r.success)
                      .map((r) => (
                        <div key={r.index} className="px-3 py-2.5 flex items-start gap-2 text-xs">
                          <XCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                          <div>
                            <span className="font-medium">{r.name}</span>
                            <span className="text-muted-foreground ml-2">— {r.error}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="pt-4 gap-2 border-t border-border mt-2">
          {step === "upload" && (
            <Button type="button" variant="outline" onClick={handleClose}>取消</Button>
          )}
          {step === "preview" && (
            <>
              <Button type="button" variant="outline" onClick={() => setStep("upload")}>
                重新上傳
              </Button>
              <Button
                type="button"
                onClick={handleConfirmImport}
                disabled={validCount === 0 || importMutation.isPending}
                className="gap-2"
              >
                <Upload className="w-4 h-4" />
                {importMutation.isPending ? "匯入中..." : `確認匯入 ${validCount} 筆`}
              </Button>
            </>
          )}
          {step === "result" && (
            <Button type="button" onClick={handleClose}>完成</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
