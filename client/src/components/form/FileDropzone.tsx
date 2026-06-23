/**
 * FileDropzone — 檔案上傳元件
 * 永遠獨佔整行（col-span-full），不可與其他欄位並排
 * 使用 /api/upload 端點（與 CaseModal 的 handleFileUpload 邏輯一致）
 */
import { useRef } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Upload, X, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface FileDropzoneProps {
  /** 欄位標籤 */
  label: string;
  /** 目前已上傳的 S3 key（watch 取得） */
  fileKey?: string | null;
  /** 是否正在上傳 */
  uploading: boolean;
  /** 設定上傳狀態 */
  setUploading: (v: boolean) => void;
  /** S3 folder 路徑 */
  folder: string;
  /** 上傳成功後的回調（傳入 S3 key） */
  onUploaded: (key: string) => void;
  /** 移除檔案的回調 */
  onRemove: () => void;
  /** 上傳成功 toast 訊息 */
  successMsg?: string;
  /** 接受的檔案類型，預設 PDF + 圖片 */
  accept?: string;
  /** 額外 className（預設已含 col-span-full） */
  className?: string;
}

export function FileDropzone({
  label,
  fileKey,
  uploading,
  setUploading,
  folder,
  onUploaded,
  onRemove,
  successMsg,
  accept = ".pdf,.jpg,.jpeg,.png",
  className,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", folder);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json() as { key: string };
      onUploaded(data.key);
      toast.success(successMsg ?? `${label}已上傳`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "未知錯誤";
      toast.error("上傳失敗：" + msg);
    } finally {
      setUploading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const fileName = fileKey ? fileKey.split("/").pop() : null;

  return (
    <div className={`col-span-full space-y-1.5 ${className ?? ""}`}>
      <Label className="text-sm font-medium text-foreground flex items-center gap-1.5">
        <Upload className="w-3.5 h-3.5 text-muted-foreground" />
        {label}
      </Label>

      {fileKey ? (
        /* 已上傳：顯示檔名 + 移除按鈕 */
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          <FileText className="w-4 h-4 text-primary shrink-0" />
          <span className="flex-1 truncate text-foreground text-xs">{fileName}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      ) : (
        /* 未上傳：拖放區域 */
        <div
          className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-border bg-muted/20 px-4 py-4 text-sm text-muted-foreground transition-colors hover:bg-muted/40"
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>上傳中...</span>
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              <span>點擊上傳 PDF 或圖片</span>
            </>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
        disabled={uploading}
      />
    </div>
  );
}
