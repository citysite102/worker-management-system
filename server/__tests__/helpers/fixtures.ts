/**
 * 整合測試用的資料建構工具。
 *
 * 一律走 tRPC procedure 建立資料（而非直接 INSERT），這樣前置資料本身
 * 也會經過真實的驗證邏輯，避免測試建出線上不可能存在的狀態。
 */
import { createCaller } from "./caller";

type Caller = ReturnType<typeof createCaller>;

export async function makeManager(
  caller: Caller,
  name = "測試負責人"
): Promise<number> {
  return (await caller.managers.create({ name })).id;
}

type CustomerInput = Parameters<Caller["customers"]["create"]>[0];

export async function makeCustomer(
  caller: Caller,
  managerId: number,
  overrides: Partial<CustomerInput> = {}
): Promise<number> {
  const result = await caller.customers.create({
    employerType: "company",
    name: "測試雇主股份有限公司",
    phone: "0223456789",
    contractStatus: "signed",
    pricingTier: "standard",
    managerId,
    ...overrides,
  } as CustomerInput);
  return result.id;
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
  const result = await caller.cases.create({
    customerId,
    managerId,
    name: "測試案件",
    status: "in_progress",
    ...overrides,
  } as CaseInput);
  return result.id;
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
