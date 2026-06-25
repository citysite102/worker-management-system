/**
 * 品牌視覺預覽頁 — Phase 1 交付物
 *
 * 路由：/brand-preview（不需登入，僅供內部確認）
 * 用途：讓 Samuel 一眼確認 Logo、吉祥物、色票、套用範例的風格與配色
 *
 * 此頁面僅為視覺預覽，不影響任何功能程式。
 */

import React from "react";
import { Logo } from "@/components/brand/Logo";
import { Mascot, type MascotPose } from "@/components/brand/Mascot";
import { EmptyState } from "@/components/brand/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

// ── 品牌色票 ────────────────────────────────────────────
const TOKENS = [
  {
    name: "品牌主色",
    token: "--brand-primary",
    hex: "#1FA59B",
    usage: "Logo、互動主色、按鈕、連結",
    bg: "#1FA59B",
    text: "#FFFFFF",
  },
  {
    name: "吉祥物身體",
    token: "--brand-mascot",
    hex: "#5FBFA3",
    usage: "吉祥物大面積身體色",
    bg: "#5FBFA3",
    text: "#FFFFFF",
  },
  {
    name: "角色細節線",
    token: "--brand-dark",
    hex: "#103D38",
    usage: "表情線、深色文字、Logo 深色版",
    bg: "#103D38",
    text: "#FFFFFF",
  },
  {
    name: "點綴色",
    token: "--brand-accent",
    hex: "#F2A33C",
    usage: "道具、重點標示、慶祝元素（不大面積使用）",
    bg: "#F2A33C",
    text: "#FFFFFF",
  },
];

// ── 吉祥物姿態清單 ───────────────────────────────────────
const POSES: {
  pose: MascotPose;
  label: string;
  usage: string;
  isNew?: boolean;
}[] = [
  {
    pose: "thumbsup",
    label: "比讚",
    usage: "空狀態（無資料、初始化、資料已清空）",
  },
  {
    pose: "wave",
    label: "揮手",
    usage: "登入頁、歡迎畫面、onboarding 第一步",
  },
  {
    pose: "review",
    label: "文件審閱",
    usage: "Loading 處理中、等待 API 回應、資料同步中",
  },
  {
    pose: "celebrate",
    label: "慶祝",
    usage: "操作成功、案件完成、批次匯入完成",
  },
  {
    pose: "confused",
    label: "疑惑",
    usage: "404 找不到頁面、錯誤狀態、無存取權限",
    isNew: true,
  },
  {
    pose: "search",
    label: "搜尋",
    usage: "搜尋無結果、篩選後無符合資料",
    isNew: true,
  },
];

// ── Logo 尺寸展示 ────────────────────────────────────────
const LOGO_SIZES = [
  { size: "xs" as const, label: "XS (20px)", note: "favicon" },
  { size: "sm" as const, label: "SM (28px)", note: "側欄收合" },
  { size: "md" as const, label: "MD (36px)", note: "側欄展開" },
  { size: "lg" as const, label: "LG (48px)", note: "文件抬頭" },
  { size: "xl" as const, label: "XL (64px)", note: "登入頁" },
];

// ── Section 標題 ─────────────────────────────────────────
function SectionTitle({
  number,
  title,
  subtitle,
}: {
  number: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-1">
        <span
          className="text-xs font-mono px-2 py-0.5 rounded"
          style={{ background: "#1FA59B", color: "#FFFFFF" }}
        >
          {number}
        </span>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      </div>
      {subtitle && (
        <p className="text-sm text-muted-foreground ml-10">{subtitle}</p>
      )}
    </div>
  );
}

// ── 主頁面 ───────────────────────────────────────────────
export default function BrandPreview() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div
        className="border-b px-8 py-5 flex items-center justify-between"
        style={{ borderColor: "#1FA59B22" }}
      >
        <div className="flex items-center gap-4">
          <Logo variant="color" size="md" showText />
          <Separator orientation="vertical" className="h-6" />
          <div>
            <p className="text-xs text-muted-foreground">品牌視覺導入</p>
            <p className="text-sm font-medium">Phase 1 — 風格預覽</p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="text-xs"
          style={{ borderColor: "#1FA59B", color: "#1FA59B" }}
        >
          僅供確認，不影響功能
        </Badge>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-10 space-y-14">
        {/* ── 1. 色票 ── */}
        <section>
          <SectionTitle
            number="01"
            title="Design Token — 品牌色票"
            subtitle="全站只能使用以下四個品牌色，中性色沿用既有 shadcn token"
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {TOKENS.map((t) => (
              <div
                key={t.hex}
                className="rounded-xl overflow-hidden border border-border"
              >
                <div
                  className="h-20 flex items-end p-3"
                  style={{ background: t.bg }}
                >
                  <span
                    className="text-xs font-mono font-bold"
                    style={{ color: t.text }}
                  >
                    {t.hex}
                  </span>
                </div>
                <div className="p-3 bg-card">
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t.usage}
                  </p>
                  <p
                    className="text-xs font-mono mt-1"
                    style={{ color: "#1FA59B" }}
                  >
                    {t.token}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 2. Logo ── */}
        <section>
          <SectionTitle
            number="02"
            title="Logo — 燕子剪影"
            subtitle="極簡幾何燕子，可縮至 20px favicon 仍清晰可辨"
          />
          <Card>
            <CardContent className="pt-6">
              {/* 尺寸展示 */}
              <div className="mb-6">
                <p className="text-xs text-muted-foreground mb-4 font-medium uppercase tracking-wider">
                  尺寸系列
                </p>
                <div className="flex items-end gap-8 flex-wrap">
                  {LOGO_SIZES.map(({ size, label, note }) => (
                    <div key={size} className="flex flex-col items-center gap-2">
                      <Logo variant="color" size={size} />
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-xs font-medium" style={{ color: "#1FA59B" }}>
                        {note}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <Separator className="my-6" />

              {/* 三種變體 */}
              <div className="mb-6">
                <p className="text-xs text-muted-foreground mb-4 font-medium uppercase tracking-wider">
                  三種 Variant
                </p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg p-5 flex flex-col items-center gap-3 border border-border">
                    <Logo variant="color" size="lg" showText />
                    <p className="text-xs text-muted-foreground">
                      color（預設）
                    </p>
                  </div>
                  <div
                    className="rounded-lg p-5 flex flex-col items-center gap-3"
                    style={{ background: "#103D38" }}
                  >
                    <Logo variant="white" size="lg" showText />
                    <p className="text-xs" style={{ color: "#FFFFFF88" }}>
                      white（深色背景用）
                    </p>
                  </div>
                  <div className="rounded-lg p-5 flex flex-col items-center gap-3 border border-border bg-muted/30">
                    <Logo variant="dark" size="lg" showText />
                    <p className="text-xs text-muted-foreground">
                      dark（淺色背景）
                    </p>
                  </div>
                </div>
              </div>

              <Separator className="my-6" />

              {/* 側欄套用範例 */}
              <div>
                <p className="text-xs text-muted-foreground mb-4 font-medium uppercase tracking-wider">
                  側欄抬頭套用範例
                </p>
                <div
                  className="rounded-lg p-4 flex items-center gap-3 w-56"
                  style={{ background: "#0F1117" }}
                >
                  <Logo variant="white" size="sm" />
                  <div>
                    <p
                      className="text-sm font-semibold"
                      style={{ color: "#FFFFFF" }}
                    >
                      移工管理後台
                    </p>
                    <p className="text-xs" style={{ color: "#FFFFFF55" }}>
                      GVC 系統
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── 3. 吉祥物 ── */}
        <section>
          <SectionTitle
            number="03"
            title="吉祥物 — 六種姿態"
            subtitle="扁平向量、sage teal 身體、深墨綠表情、麵條手腳。橘底標籤為 Phase 1 新增的缺漏姿態。"
          />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {POSES.map(({ pose, label, usage, isNew }) => (
              <Card key={pose} className={isNew ? "ring-2 ring-[#F2A33C]" : ""}>
                <CardContent className="pt-6 flex flex-col items-center text-center">
                  {isNew && (
                    <Badge
                      className="mb-2 text-xs"
                      style={{ background: "#F2A33C", color: "#FFFFFF" }}
                    >
                      新增姿態
                    </Badge>
                  )}
                  <Mascot pose={pose} size="lg" />
                  <p className="text-base font-semibold mt-3">{label}</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[180px]">
                    {usage}
                  </p>
                  <p
                    className="text-xs font-mono mt-2"
                    style={{ color: "#1FA59B" }}
                  >
                    pose="{pose}"
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* ── 4. EmptyState 套用範例 ── */}
        <section>
          <SectionTitle
            number="04"
            title="EmptyState 套用範例"
            subtitle="三個典型場景：移工列表空狀態、搜尋無結果、404 頁面"
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 範例 1：移工列表空狀態 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  移工列表 — 無資料
                </CardTitle>
              </CardHeader>
              <CardContent>
                <EmptyState
                  illustration="thumbsup"
                  title="還沒有移工資料"
                  description="點擊右上角「新增移工」開始建立第一筆資料"
                  action={
                    <Button
                      size="sm"
                      style={{ background: "#1FA59B", color: "#FFFFFF" }}
                    >
                      + 新增移工
                    </Button>
                  }
                />
              </CardContent>
            </Card>

            {/* 範例 2：搜尋無結果 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  搜尋 — 無符合結果
                </CardTitle>
              </CardHeader>
              <CardContent>
                <EmptyState
                  illustration="search"
                  title="找不到符合的資料"
                  description="試試調整搜尋關鍵字或清除篩選條件"
                  action={
                    <Button variant="outline" size="sm">
                      清除篩選
                    </Button>
                  }
                />
              </CardContent>
            </Card>

            {/* 範例 3：404 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  404 — 找不到頁面
                </CardTitle>
              </CardHeader>
              <CardContent>
                <EmptyState
                  illustration="confused"
                  title="這個頁面不存在"
                  description="連結可能已失效，或你沒有存取權限"
                  action={
                    <Button variant="outline" size="sm">
                      回到首頁
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ── 5. 元件 API 速覽 ── */}
        <section>
          <SectionTitle
            number="05"
            title="元件 API 速覽"
            subtitle="Phase 2 實作時的元件介面規格"
          />
          <div className="space-y-4">
            {/* Logo API */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-mono" style={{ color: "#1FA59B" }}>
                  &lt;Logo /&gt;
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Prop</th>
                        <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Type</th>
                        <th className="text-left py-2 pr-4 font-medium text-muted-foreground">預設</th>
                        <th className="text-left py-2 font-medium text-muted-foreground">說明</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono text-xs">
                      <tr className="border-b">
                        <td className="py-2 pr-4">variant</td>
                        <td className="py-2 pr-4 text-muted-foreground">"color" | "white" | "dark"</td>
                        <td className="py-2 pr-4">"color"</td>
                        <td className="py-2 font-sans text-muted-foreground">配色版本</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 pr-4">size</td>
                        <td className="py-2 pr-4 text-muted-foreground">"xs" | "sm" | "md" | "lg" | "xl"</td>
                        <td className="py-2 pr-4">"md"</td>
                        <td className="py-2 font-sans text-muted-foreground">20 / 28 / 36 / 48 / 64 px</td>
                      </tr>
                      <tr>
                        <td className="py-2 pr-4">showText</td>
                        <td className="py-2 pr-4 text-muted-foreground">boolean</td>
                        <td className="py-2 pr-4">false</td>
                        <td className="py-2 font-sans text-muted-foreground">是否顯示文字「移工管理後台」</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Mascot API */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-mono" style={{ color: "#1FA59B" }}>
                  &lt;Mascot /&gt;
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Prop</th>
                        <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Type</th>
                        <th className="text-left py-2 pr-4 font-medium text-muted-foreground">預設</th>
                        <th className="text-left py-2 font-medium text-muted-foreground">說明</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono text-xs">
                      <tr className="border-b">
                        <td className="py-2 pr-4">pose</td>
                        <td className="py-2 pr-4 text-muted-foreground">"thumbsup" | "wave" | "review" | "celebrate" | "confused" | "search"</td>
                        <td className="py-2 pr-4">"wave"</td>
                        <td className="py-2 font-sans text-muted-foreground">姿態</td>
                      </tr>
                      <tr>
                        <td className="py-2 pr-4">size</td>
                        <td className="py-2 pr-4 text-muted-foreground">"xs" | "sm" | "md" | "lg" | "xl"</td>
                        <td className="py-2 pr-4">"md"</td>
                        <td className="py-2 font-sans text-muted-foreground">40 / 64 / 96 / 128 / 192 px</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* EmptyState API */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-mono" style={{ color: "#1FA59B" }}>
                  &lt;EmptyState /&gt;
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Prop</th>
                        <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Type</th>
                        <th className="text-left py-2 pr-4 font-medium text-muted-foreground">必填</th>
                        <th className="text-left py-2 font-medium text-muted-foreground">說明</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono text-xs">
                      <tr className="border-b">
                        <td className="py-2 pr-4">illustration</td>
                        <td className="py-2 pr-4 text-muted-foreground">MascotPose</td>
                        <td className="py-2 pr-4">—</td>
                        <td className="py-2 font-sans text-muted-foreground">吉祥物姿態，預設 "thumbsup"</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 pr-4">title</td>
                        <td className="py-2 pr-4 text-muted-foreground">string</td>
                        <td className="py-2 pr-4 text-red-500">必填</td>
                        <td className="py-2 font-sans text-muted-foreground">主標題</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 pr-4">description</td>
                        <td className="py-2 pr-4 text-muted-foreground">string</td>
                        <td className="py-2 pr-4">—</td>
                        <td className="py-2 font-sans text-muted-foreground">說明文字（選填）</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 pr-4">action</td>
                        <td className="py-2 pr-4 text-muted-foreground">ReactNode</td>
                        <td className="py-2 pr-4">—</td>
                        <td className="py-2 font-sans text-muted-foreground">行動按鈕（選填）</td>
                      </tr>
                      <tr>
                        <td className="py-2 pr-4">size</td>
                        <td className="py-2 pr-4 text-muted-foreground">"sm" | "md" | "lg"</td>
                        <td className="py-2 pr-4">—</td>
                        <td className="py-2 font-sans text-muted-foreground">整體尺寸，預設 "md"</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ── 6. 全站落點盤點表 ── */}
        <section>
          <SectionTitle
            number="06"
            title="全站視覺落點盤點表"
            subtitle="Phase 2 實作時的接入清單，每個落點對應資產與姿態"
          />
          <Card>
            <CardContent className="pt-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium">位置</th>
                    <th className="text-left py-2 pr-4 font-medium">頁面/元件</th>
                    <th className="text-left py-2 pr-4 font-medium">資產</th>
                    <th className="text-left py-2 pr-4 font-medium">姿態/變體</th>
                    <th className="text-left py-2 font-medium">優先級</th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                  {[
                    ["側欄抬頭", "DashboardLayout.tsx", "Logo", "white / color（依主題）", "P0"],
                    ["Favicon / App Icon", "client/index.html", "Logo SVG → ICO", "color", "P0"],
                    ["登入頁 Hero", "OAuth 登入頁", "Mascot", "wave（揮手）", "P1"],
                    ["移工列表空狀態", "Workers.tsx", "EmptyState", "thumbsup（比讚）", "P1"],
                    ["客戶列表空狀態", "Customers.tsx", "EmptyState", "thumbsup（比讚）", "P1"],
                    ["案件列表空狀態", "Cases.tsx", "EmptyState", "review（文件審閱）", "P1"],
                    ["搜尋無結果", "Workers / Customers / Cases", "EmptyState", "search（搜尋）", "P1"],
                    ["Loading 狀態", "LoadingStates.tsx", "Mascot", "review（文件審閱）", "P2"],
                    ["操作成功 Toast", "全站 toast", "Mascot（小尺寸）", "celebrate（慶祝）", "P2"],
                    ["案件完成狀態", "CaseDetail.tsx", "EmptyState / Banner", "celebrate（慶祝）", "P2"],
                    ["404 頁面", "NotFound.tsx", "EmptyState", "confused（疑惑）", "P1"],
                    ["無存取權限", "App.tsx 守衛", "EmptyState", "confused（疑惑）", "P2"],
                    ["通知空狀態", "NotificationBell.tsx", "Mascot（小）", "thumbsup（比讚）", "P2"],
                    ["Dashboard 歡迎區", "Home.tsx", "Logo + Mascot", "wave（揮手）", "P2"],
                  ].map(([location, page, asset, pose, priority]) => (
                    <tr key={location} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{location}</td>
                      <td className="py-2 pr-4 text-muted-foreground font-mono">{page}</td>
                      <td className="py-2 pr-4">{asset}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{pose}</td>
                      <td className="py-2">
                        <Badge
                          variant={priority === "P0" ? "default" : "outline"}
                          className="text-xs"
                          style={
                            priority === "P0"
                              ? { background: "#1FA59B", color: "#FFF" }
                              : priority === "P1"
                                ? { borderColor: "#F2A33C", color: "#F2A33C" }
                                : {}
                          }
                        >
                          {priority}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </section>

        {/* ── 7. 缺漏姿態清單 ── */}
        <section>
          <SectionTitle
            number="07"
            title="缺漏姿態清單"
            subtitle="附件四姿態以外，Phase 1 已補充的新姿態，以及尚待確認是否需要的姿態"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Badge style={{ background: "#1FA59B", color: "#FFF" }}>
                    已繪製
                  </Badge>
                  Phase 1 新增姿態
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <Mascot pose="confused" size="sm" />
                  <div>
                    <p className="text-sm font-medium">疑惑（confused）</p>
                    <p className="text-xs text-muted-foreground">
                      用於 404、錯誤頁、無存取權限。角色摸頭、問號浮現、汗水點綴。
                    </p>
                  </div>
                </div>
                <Separator />
                <div className="flex items-start gap-3">
                  <Mascot pose="search" size="sm" />
                  <div>
                    <p className="text-sm font-medium">搜尋（search）</p>
                    <p className="text-xs text-muted-foreground">
                      用於搜尋無結果、篩選後無符合資料。角色舉著放大鏡。
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Badge
                    variant="outline"
                    style={{ borderColor: "#F2A33C", color: "#F2A33C" }}
                  >
                    待確認
                  </Badge>
                  可能需要的額外姿態
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground mt-0.5">•</span>
                  <div>
                    <p className="font-medium">提行李 / 出發</p>
                    <p className="text-xs text-muted-foreground">
                      移工出境、案件開始、新旅程。如需要請提供 SVG 或由我依風格繪製。
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground mt-0.5">•</span>
                  <div>
                    <p className="font-medium">路標引導</p>
                    <p className="text-xs text-muted-foreground">
                      onboarding 引導步驟、功能說明。角色指向路標。
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground mt-0.5">•</span>
                  <div>
                    <p className="font-medium">等待 / 沙漏</p>
                    <p className="text-xs text-muted-foreground">
                      長時間處理中（如批次匯入大量資料）。與「文件審閱」有別，更強調等待感。
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground mt-0.5">•</span>
                  <div>
                    <p className="font-medium">警示 / 注意</p>
                    <p className="text-xs text-muted-foreground">
                      到期文件提醒、重要警告。與「疑惑」有別，更強調緊急感。
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Footer */}
        <div className="border-t pt-8 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Logo variant="color" size="xs" />
            <span>品牌視覺導入 Phase 1 — 僅供確認，不影響任何功能</span>
          </div>
          <span>確認後進入 Phase 2 實作</span>
        </div>
      </div>
    </div>
  );
}
