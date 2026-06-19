// 前端驗證函數（與後端 shared/validation.ts 保持一致）

export function validateTwPhone(phone: string): boolean {
  const normalized = phone.replace(/-/g, "");
  if (/^09\d{8}$/.test(normalized)) return true;
  if (/^0[2-8]\d{6,8}$/.test(normalized)) return true;
  return false;
}

export function validateResidentPermit(id: string): boolean {
  return /^[A-Za-z][12]\d{8}$/.test(id);
}

export function validatePassport(id: string): boolean {
  return /^[A-Za-z0-9]{6,9}$/.test(id);
}

export function validateTaxId(taxId: string): boolean {
  if (!/^\d{8}$/.test(taxId)) return false;
  const weights = [1, 2, 1, 2, 1, 2, 4, 1];
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    const digit = parseInt(taxId[i], 10);
    const product = digit * weights[i];
    sum += Math.floor(product / 10) + (product % 10);
  }
  if (taxId[6] === "7") {
    return sum % 5 === 0 || (sum + 1) % 5 === 0;
  }
  return sum % 5 === 0;
}

export function validateNotFutureDate(dateStr: string): boolean {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return d <= today;
}
