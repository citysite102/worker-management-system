import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SUPPORTED_LANGS, setLang, type LangCode } from "@/i18n";

/** 公開站語言切換（下拉選單：zh-TW / en / vi / id）。 */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { i18n } = useTranslation();
  const current =
    SUPPORTED_LANGS.find(l => l.code === i18n.language)?.code ?? "zh-TW";

  return (
    <Select value={current} onValueChange={v => setLang(v as LangCode)}>
      <SelectTrigger
        className={`h-9 w-auto gap-1.5 ${className}`}
        aria-label="切換語言"
      >
        <Globe className="h-4 w-4 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {SUPPORTED_LANGS.map(l => (
          <SelectItem key={l.code} value={l.code}>
            {l.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
