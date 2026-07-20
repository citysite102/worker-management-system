/**
 * tRPC 的測試替身。
 *
 * 專案裡沒有元件直接用 @tanstack/react-query，全部走 `@/lib/trpc`，
 * 所以整包換掉 trpc 物件就夠，不需要 QueryClientProvider 或 MSW。
 *
 * 用法（vi.mock 會被提升，所以要用非同步工廠）：
 *
 *   vi.mock("@/lib/trpc", async () => {
 *     const { trpcMock } = await import("@/__tests__/trpcMock");
 *     return { trpc: trpcMock };
 *   });
 *
 *   beforeEach(() => {
 *     resetTrpcMock();
 *     setQueryData("managers.list", [{ id: 1, name: "陳專員" }]);
 *   });
 *
 * ## 為什麼要保證回傳穩定的參考
 *
 * 幾個 Modal 的 useEffect 依賴陣列裡有查詢結果（例如 WorkerModal 的
 * `[open, isEdit, existingWorker, editId, managers, reset]`）。如果 mock 每次
 * render 都回傳新的陣列／物件，effect 會每次都認為依賴變了 → setState →
 * 再 render → 無限迴圈，測試會直接卡死而不是給出有用的錯誤。
 * 因此這裡把每個路徑的結果物件快取起來，同一份資料永遠回傳同一個參考。
 */
import { vi } from "vitest";

type QueryResult = {
  data: unknown;
  isLoading: boolean;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
};

type MutationResult = {
  mutate: ReturnType<typeof vi.fn>;
  mutateAsync: ReturnType<typeof vi.fn>;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  reset: () => void;
};

/** path → 該路徑 useQuery 要回傳的東西（同一份物件重複回傳，維持參考穩定）。 */
const queryResults = new Map<string, QueryResult>();
/** path → 該路徑 useMutation 要回傳的東西。 */
const mutationResults = new Map<string, MutationResult>();
/** path → 呼叫 mutate 時要觸發的 onSuccess 回傳值。 */
const mutationSuccessData = new Map<string, unknown>();
/** path → 設了就改走 onError（優先於 success）。 */
const mutationErrors = new Map<string, unknown>();

function makeQueryResult(data: unknown, isLoading: boolean): QueryResult {
  return {
    data,
    isLoading,
    isPending: isLoading,
    isError: false,
    error: null,
    refetch: vi.fn(),
  };
}

/** 設定某個 query 路徑的回傳資料。 */
export function setQueryData(path: string, data: unknown) {
  queryResults.set(path, makeQueryResult(data, false));
}

/** 讓某個 query 路徑停在載入中。 */
export function setQueryLoading(path: string) {
  queryResults.set(path, makeQueryResult(undefined, true));
}

/** 設定某個 mutation 成功時要傳給 onSuccess 的資料。 */
export function setMutationSuccess(path: string, data: unknown) {
  mutationSuccessData.set(path, data);
}

/**
 * 讓某個 mutation 改走失敗路徑。
 *
 * 有些元件把錯誤訊息當成控制流程用 —— 例如 CustomerModal 靠
 * `err.message.startsWith("DUPLICATE_NAME:")` 決定要不要跳出同名確認視窗。
 * 那是「重複建立雇主」的最後一道防線，沒有這個就完全測不到。
 *
 * 傳字串會自動包成 Error；要模擬 TRPCError 的形狀就自己傳物件。
 */
export function setMutationError(path: string, error: unknown) {
  mutationErrors.set(
    path,
    typeof error === "string" ? new Error(error) : error
  );
}

/** 取得某個 mutation 的 mutate 間諜，用來斷言送出的內容。 */
export function getMutation(path: string): MutationResult {
  const hit = mutationResults.get(path);
  if (!hit) {
    throw new Error(
      `mutation "${path}" 還沒有被元件呼叫過。` +
        `已知的路徑：${Array.from(mutationResults.keys()).join(", ") || "（無）"}`
    );
  }
  return hit;
}

/** 每個 test 前呼叫，清掉上一個 test 的設定與呼叫紀錄。 */
export function resetTrpcMock() {
  queryResults.clear();
  mutationResults.clear();
  mutationSuccessData.clear();
  mutationErrors.clear();
  mutationCallbacks.clear();
}

/** 元件會把 onSuccess 傳進 useMutation，這裡存起來供 mutate 觸發。 */
const mutationCallbacks = new Map<
  string,
  { onSuccess?: (data: unknown) => void; onError?: (e: unknown) => void }
>();

function useQueryImpl(
  path: string,
  _input?: unknown,
  opts?: { enabled?: boolean }
) {
  // enabled: false 時 tRPC 不會發查詢，data 維持 undefined
  if (opts && opts.enabled === false) {
    return makeQueryResult(undefined, false);
  }
  const existing = queryResults.get(path);
  if (existing) return existing;
  // 沒設定過的路徑一律當成「查完了，沒資料」，而不是無限載入中 ——
  // 否則忘了設定某個路徑時，元件會卡在 skeleton，錯誤訊息很難懂。
  const fallback = makeQueryResult(undefined, false);
  queryResults.set(path, fallback);
  return fallback;
}

function useMutationImpl(
  path: string,
  opts?: { onSuccess?: (data: unknown) => void; onError?: (e: unknown) => void }
) {
  if (opts) mutationCallbacks.set(path, opts);

  const existing = mutationResults.get(path);
  if (existing) return existing;

  const trigger = (variables: unknown) => {
    const cb = mutationCallbacks.get(path);
    if (mutationErrors.has(path)) {
      cb?.onError?.(mutationErrors.get(path));
      return variables;
    }
    cb?.onSuccess?.(mutationSuccessData.get(path) ?? { success: true });
    return variables;
  };

  const result: MutationResult = {
    // mutate 是 fire-and-forget，錯誤只走 onError，不會 throw
    mutate: vi.fn(trigger),
    // mutateAsync 回傳 promise，失敗時要 reject —— 元件常用 try/catch 接
    mutateAsync: vi.fn(async (variables: unknown) => {
      trigger(variables);
      if (mutationErrors.has(path)) throw mutationErrors.get(path);
      return variables;
    }),
    isPending: false,
    isError: false,
    error: null,
    reset: vi.fn(),
  };
  mutationResults.set(path, result);
  return result;
}

/** useUtils() 回傳的東西：任何路徑的 invalidate / refetch 都是 no-op。 */
const utilsProxy: unknown = new Proxy(function () {} as never, {
  get(_t, prop: string): unknown {
    if (prop === "then") return undefined; // 避免被誤當成 thenable
    return utilsProxy;
  },
  apply() {
    return Promise.resolve();
  },
});

/**
 * 依路徑遞迴代理，直到碰到 useQuery / useMutation 這類終端方法。
 * 這樣就不必逐一列出 `customers.careReceivers.listByCustomer` 這種深層路徑。
 */
function makeRouterProxy(path: string[]): unknown {
  return new Proxy(function () {} as never, {
    get(_t, prop: string): unknown {
      if (prop === "then") return undefined;
      const full = path.join(".");
      if (prop === "useQuery") {
        return (input?: unknown, opts?: { enabled?: boolean }) =>
          useQueryImpl(full, input, opts);
      }
      if (prop === "useMutation") {
        return (opts?: Parameters<typeof useMutationImpl>[1]) =>
          useMutationImpl(full, opts);
      }
      if (prop === "useUtils" || prop === "useContext") {
        return () => utilsProxy;
      }
      return makeRouterProxy([...path, prop]);
    },
  });
}

export const trpcMock = makeRouterProxy([]) as never;
