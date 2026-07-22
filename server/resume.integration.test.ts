import { describe, expect, it } from "vitest";
import {
  createCaller,
  createAnonymousCaller,
  ADMIN_USER,
} from "./__tests__/helpers/caller";
import { query } from "./__tests__/helpers/testDb";

const workerCaller = (id: number) =>
  createCaller({
    ...ADMIN_USER,
    id,
    role: "user",
    accountType: "worker",
    workerId: null,
    customerId: null,
  });

describe("履歷擴增：期望工作地區 preferredCities（real db）", () => {
  it("upsertProfile 存陣列 → myProfile 回陣列", async () => {
    const worker = workerCaller(700);
    await worker.worker.upsertProfile({
      alias: "阿May",
      jobTypes: ["caregiver"],
      preferredCities: ["臺北市", "新北市"],
    });
    const mine = await worker.worker.myProfile();
    expect(mine?.preferredCities).toEqual(["臺北市", "新北市"]);
  });

  it("發布 + 審核通過後，findWorkers.get 對外帶出期望地區", async () => {
    const worker = workerCaller(701);
    await worker.worker.upsertProfile({
      alias: "阿明",
      jobTypes: ["manufacturing"],
      preferredCities: ["臺中市"],
      submit: true, // publishStatus → published
    });
    const rows = await query<{ id: number }>(
      "SELECT id FROM `worker_public_profiles` WHERE userId = ?",
      [701]
    );
    const pid = rows[0].id;
    // 模擬客服審核通過
    await query(
      "UPDATE `worker_public_profiles` SET moderationStatus = 'approved' WHERE id = ?",
      [pid]
    );

    const pub = await createAnonymousCaller().findWorkers.get({ id: pid });
    expect(pub.preferredCities).toEqual(["臺中市"]);
  });

  it("未填時回空陣列（不會 crash）", async () => {
    const worker = workerCaller(702);
    await worker.worker.upsertProfile({ alias: "無地區" });
    const mine = await worker.worker.myProfile();
    expect(mine?.preferredCities).toEqual([]);
  });
});
