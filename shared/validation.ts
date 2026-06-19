// ─── 台灣電話格式驗證 ─────────────────────────────────────────────────────────
// 手機：09 開頭共 10 碼（允許含 -）
// 市話：02-XXXX-XXXX 或 03-XXX-XXXX 等格式
export function validateTwPhone(phone: string): boolean {
  const normalized = phone.replace(/-/g, "");
  // 手機：09xxxxxxxx（10 碼）
  if (/^09\d{8}$/.test(normalized)) return true;
  // 市話：0x（2-4 碼區碼）+ 6-8 碼號碼，總共 8-10 碼
  if (/^0[2-8]\d{6,8}$/.test(normalized)) return true;
  return false;
}

export function normalizePhone(phone: string): string {
  return phone.replace(/-/g, "");
}

// ─── 居留證號格式驗證 ─────────────────────────────────────────────────────────
// 格式：1 個英文字母 + 1 個數字（1 或 2）+ 8 個數字，共 10 碼
// 例：A123456789
export function validateResidentPermit(id: string): boolean {
  return /^[A-Za-z][12]\d{8}$/.test(id);
}

// ─── 護照號碼格式驗證 ─────────────────────────────────────────────────────────
// 6 到 9 碼英數字
export function validatePassport(id: string): boolean {
  return /^[A-Za-z0-9]{6,9}$/.test(id);
}

// ─── 台灣統一編號驗證 ─────────────────────────────────────────────────────────
// 8 碼數字 + 檢查碼驗證
export function validateTaxId(taxId: string): boolean {
  if (!/^\d{8}$/.test(taxId)) return false;
  const weights = [1, 2, 1, 2, 1, 2, 4, 1];
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    const digit = parseInt(taxId[i], 10);
    const product = digit * weights[i];
    // 兩位數則各位相加
    sum += Math.floor(product / 10) + (product % 10);
  }
  // 第 7 碼為 7 時，sum 或 sum+1 能被 5 整除均可
  if (taxId[6] === "7") {
    return sum % 5 === 0 || (sum + 1) % 5 === 0;
  }
  return sum % 5 === 0;
}

// ─── 日期不可晚於今天 ─────────────────────────────────────────────────────────
export function validateNotFutureDate(dateStr: string): boolean {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return d <= today;
}
