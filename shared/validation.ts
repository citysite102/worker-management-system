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
// 台灣外籍人士居留證（ARC）統一格式：共 10 碼
// 格式一（舊式/新式均適用）：1 個英文字母 + 9 個數字（例：F901260600、A901070683）
// 格式二（新式 2021 後）：2 個英文字母 + 8 個數字（例：AB12345678）
// 注意：第二碼數字不限於 1 或 2，可為任意數字 0-9
export function validateResidentPermit(id: string): boolean {
  // 字母 + 9 碼數字（最常見格式）
  const style1 = /^[A-Za-z]\d{9}$/.test(id);
  // 2 字母 + 8 碼數字（新式格式）
  const style2 = /^[A-Za-z]{2}\d{8}$/.test(id);
  return style1 || style2;
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
