import { useEffect } from "react";
import { X, Download, FileText, Image as ImageIcon, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AttachmentPreviewModalProps {
  open: boolean;
  onClose: () => void;
  label: string;
  fileKey: string;
}

/**
 * AttachmentPreviewModal
 * - 圖片（jpg/png/webp/gif）：全螢幕 Lightbox，點擊背景關閉
 * - PDF：iframe inline 預覽，附下載與新分頁開啟按鈕
 * - 支援 Esc 鍵關閉
 */
export function AttachmentPreviewModal({ open, onClose, label, fileKey }: AttachmentPreviewModalProps) {
  const url = `/manus-storage/${fileKey.split("/").pop()}`;
  const ext = fileKey.split(".").pop()?.toLowerCase() ?? "";
  const isPdf = ext === "pdf";
  const isImage = ["jpg", "jpeg", "png", "webp", "gif", "bmp", "svg"].includes(ext);

  // Esc 關閉
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // 鎖定 body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.82)" }}
      onClick={onClose}
    >
      {/* 內容容器：阻止點擊冒泡 */}
      <div
        className="relative flex flex-col w-full max-w-4xl mx-4"
        style={{ maxHeight: "90vh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── 頂部工具列 ── */}
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-t-xl bg-zinc-900/95 border-b border-white/10">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {isPdf
              ? <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
              : <ImageIcon className="w-4 h-4 text-zinc-400 shrink-0" />}
            <span className="text-sm text-zinc-200 font-medium truncate">{label}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href={url}
              download
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
              onClick={e => e.stopPropagation()}
            >
              <Download className="w-3.5 h-3.5" />
              下載
            </a>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
              onClick={e => e.stopPropagation()}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              新分頁
            </a>
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="關閉預覽"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── 預覽內容 ── */}
        <div
          className="rounded-b-xl overflow-hidden bg-zinc-950 flex items-center justify-center"
          style={{ minHeight: "300px", maxHeight: "calc(90vh - 52px)" }}
        >
          {isImage && (
            <img
              src={url}
              alt={label}
              className="max-w-full max-h-full object-contain"
              style={{ maxHeight: "calc(90vh - 52px)" }}
              draggable={false}
            />
          )}
          {isPdf && (
            <iframe
              src={`${url}#toolbar=1&navpanes=0`}
              title={label}
              className="w-full border-0"
              style={{ height: "calc(90vh - 52px)" }}
            />
          )}
          {!isImage && !isPdf && (
            <div className="flex flex-col items-center gap-4 py-16 text-zinc-400">
              <FileText className="w-12 h-12" />
              <p className="text-sm">此格式不支援預覽</p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary text-sm underline"
                onClick={e => e.stopPropagation()}
              >
                點此開啟檔案
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
