import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

// ─── 公開媒合平台角色中介層（P0 WS3 / P1）──────────────────────────────────────
// staff：內部人員（staff/admin），可存取內部後台與審核佇列。
// employer / worker：公開站自助帳號（依 users.accountType）。
// 皆先過 requireUser（未登入一律 UNAUTHORIZED），再檢查角色/帳號型別（FORBIDDEN）。

/** 內部後台與審核：需 role ∈ {staff, admin}。 */
export const staffProcedure = protectedProcedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    if (!ctx.user || (ctx.user.role !== "staff" && ctx.user.role !== "admin")) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "此功能限內部人員（staff/admin）使用",
      });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  })
);

/** 雇主自助：需 accountType = employer（admin/staff 亦可代操作）。 */
export const employerProcedure = protectedProcedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    const isStaff =
      ctx.user?.role === "staff" || ctx.user?.role === "admin";
    if (!ctx.user || (!isStaff && ctx.user.accountType !== "employer")) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "此功能限雇主帳號使用",
      });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  })
);

/** 移工自助：需 accountType = worker（admin/staff 亦可代操作）。 */
export const workerProcedure = protectedProcedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    const isStaff =
      ctx.user?.role === "staff" || ctx.user?.role === "admin";
    if (!ctx.user || (!isStaff && ctx.user.accountType !== "worker")) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "此功能限移工帳號使用",
      });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  })
);
