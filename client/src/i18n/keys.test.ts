/**
 * i18n 四語言 key 一致性守門。
 *
 * 四棵語言樹（zh-TW / en / vi / id）靠人工維持同構，漂移只在 runtime 才發現
 * （缺 key 會靜默 fallback 到 zh-TW）。這支測試把「key 集合不一致」變成會亮紅燈
 * 的 pnpm verify 失敗：以 zh-TW 為基準，任一語言缺 key 或多 key 即失敗。
 */
import { describe, it, expect } from "vitest";
import { resources } from "./index";

type Tree = Record<string, unknown>;

/** 把巢狀物件攤平成點路徑 key 集合（只收葉節點路徑）。 */
function flattenKeys(obj: Tree, prefix = "", acc: Set<string> = new Set()) {
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      flattenKeys(v as Tree, path, acc);
    } else {
      acc.add(path);
    }
  }
  return acc;
}

const BASE_LANG = "zh-TW";
const langs = Object.keys(resources) as (keyof typeof resources)[];
const keysOf = (lang: keyof typeof resources) =>
  flattenKeys((resources[lang] as { common: Tree }).common);

const baseKeys = keysOf(BASE_LANG);

describe("i18n key 一致性（以 zh-TW 為基準）", () => {
  it("四種語言都存在", () => {
    expect(langs.sort()).toEqual(["en", "id", "vi", "zh-TW"]);
  });

  for (const lang of langs) {
    if (lang === BASE_LANG) continue;

    it(`${lang}：無缺漏 key（相對 zh-TW）`, () => {
      const keys = keysOf(lang);
      const missing = Array.from(baseKeys)
        .filter(k => !keys.has(k))
        .sort();
      expect(missing, `${lang} 缺少這些 key：\n${missing.join("\n")}`).toEqual(
        []
      );
    });

    it(`${lang}：無多餘 key（zh-TW 沒有的）`, () => {
      const keys = keysOf(lang);
      const extra = Array.from(keys)
        .filter(k => !baseKeys.has(k))
        .sort();
      expect(
        extra,
        `${lang} 多出這些 key（zh-TW 無）：\n${extra.join("\n")}`
      ).toEqual([]);
    });
  }
});
