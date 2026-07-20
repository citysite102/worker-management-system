/**
 * 整合測試用的資料建構工具。
 *
 * 一律走 tRPC procedure 建立資料（而非直接 INSERT），這樣前置資料本身
 * 也會經過真實的驗證邏輯，避免測試建出線上不可能存在的狀態。
 *
 * 注意：目前 `customers.create` 與 `cases.create` 只回傳 `{ success: true }`，
 * 沒有回傳新建資料的 id，因此這裡建立後必須再回查一次拿 id。
 */
import { createCaller } from "./caller";
import { query } from "./testDb";

type Caller = ReturnType<typeof createCaller>;

/** 建立後回查最新一筆的 id。 */
async function latestId(table: string): Promise<number> {
  const rows = await query<{ id: number }>(
    `SELECT id FROM \`${table}\` ORDER BY id DESC LIMIT 1`
  );
  if (rows.length === 0) throw new Error(`fixture 建立失敗：${table} 無資料`);
  return rows[0].id;
}

export async function makeManager(
  caller: Caller,
  name = "測試負責人"
): Promise<number> {
  await caller.managers.create({ name });
  return latestId("managers");
}

type CustomerInput = Parameters<Caller["customers"]["create"]>[0];

export async function makeCustomer(
  caller: Caller,
  managerId: number,
  overrides: Partial<CustomerInput> = {}
): Promise<number> {
  await caller.customers.create({
    employerType: "company",
    name: "測試雇主股份有限公司",
    phone: "0223456789",
    contractStatus: "signed",
    pricingTier: "standard",
    managerId,
    ...overrides,
  } as CustomerInput);
  return latestId("customers");
}

type WorkerInput = Parameters<Caller["workers"]["create"]>[0];

export async function makeWorker(
  caller: Caller,
  managerId: number,
  overrides: Partial<WorkerInput> = {}
): Promise<number> {
  const result = await caller.workers.create({
    name: "測試移工",
    nameCn: "測試移工",
    lifecycleStatus: "idle_in_tw",
    documentStatus: "not_started",
    managerId,
    ...overrides,
  } as WorkerInput);
  return result.id;
}

type CaseInput = Parameters<Caller["cases"]["create"]>[0];

export async function makeCase(
  caller: Caller,
  customerId: number,
  managerId: number,
  overrides: Partial<CaseInput> = {}
): Promise<number> {
  await caller.cases.create({
    customerId,
    managerId,
    name: "測試案件",
    status: "in_progress",
    ...overrides,
  } as CaseInput);
  return latestId("cases");
}

/** case_demands 的最小合法輸入。 */
export function demandInput(overrides: Record<string, unknown> = {}) {
  return {
    label: "看護需求",
    qualType: "caregiver" as const,
    neededCount: 1,
    ...overrides,
  };
}

/** 一次建好 manager + customer + worker + case，回傳各自的 id。 */
export async function makeCaseWorld(caller: Caller) {
  const managerId = await makeManager(caller);
  const customerId = await makeCustomer(caller, managerId);
  const workerId = await makeWorker(caller, managerId);
  const caseId = await makeCase(caller, customerId, managerId);
  return { managerId, customerId, workerId, caseId };
}
