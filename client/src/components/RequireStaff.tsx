import { Redirect } from "wouter";
import { trpc } from "@/lib/trpc";

/**
 * 後台守衛：只有 staff / admin 能進 /admin。
 * 未登入 → 導向登入；已登入但非員工 → 顯示無權限。
 * （後端每支 procedure 的授權由 WS3 權限硬化補上，本元件只是前端第一道。）
 */
export function RequireStaff({ children }: { children: React.ReactNode }) {
  const { data: me, isLoading } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        載入中…
      </div>
    );
  }

  if (!me) return <Redirect to="~/login" />;

  if (me.role !== "staff" && me.role !== "admin") {
    return (
      <div className="min-h-screen grid place-items-center px-6 text-center bg-background">
        <div>
          <p className="text-lg font-semibold">無存取權限</p>
          <p className="mt-1 text-sm text-muted-foreground">
            此區為內部後台，需員工權限。
          </p>
          <a
            href="/"
            className="mt-4 inline-block text-sm text-primary hover:underline"
          >
            返回首頁
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
