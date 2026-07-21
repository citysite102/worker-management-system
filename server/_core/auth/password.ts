// ─── 密碼雜湊（scrypt，Node 內建，不引外部相依）────────────────────────────
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);
const KEYLEN = 64;

/** 產生 `scrypt$<salt>$<hash>` 格式字串。 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, KEYLEN)) as Buffer;
  return `scrypt$${salt}$${buf.toString("hex")}`;
}

/** 以常數時間比對密碼與雜湊；格式不符或不符皆回 false。 */
export async function verifyPassword(
  password: string,
  stored: string | null | undefined
): Promise<boolean> {
  if (!stored) return false;
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = (await scryptAsync(password, salt, KEYLEN)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
