/**
 * 資料遷移腳本：將 customers 主表的舊欄位資料搬遷至 customer_qualifications 子表
 * 
 * 遷移邏輯：
 * - 若客戶有 careReceiverName 或 jobSeekerType 或 caseNo 或 employmentLetterType，
 *   則建立一筆 customer_qualifications 記錄
 * - employerType=individual → qualifierCategory='family'
 * - employerType=company → qualifierCategory='business'
 * - 同時若有 careReceiver 資料，也搬遷至 customer_care_receivers 子表（若尚未有）
 */

import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// 查詢有舊資料的客戶
const [customers] = await conn.execute(`
  SELECT id, name, employerType,
    careReceiverNo, careReceiverName, careReceiverBirthDate, careReceiverIdNo,
    careReceiverAddress, careReceiverQualification, careReceiverRelation,
    careReceiverIdFrontKey, careReceiverIdBackKey,
    caseNo, caseStatus, managerId,
    jobSeekerType, jobSeekerDate, jobSeekerFileKey,
    recruitmentLetterType, recruitmentLetterDate, recruitmentLetterFileKey,
    recruitmentPermitNote, recruitmentPermitDays, previousWorkerDepartureDate,
    employmentLetterType, employmentLetterDate, employmentLetterFileKey,
    approvedStartDate, approvedPeriod, approvedEndDate
  FROM customers
  WHERE careReceiverName IS NOT NULL 
     OR jobSeekerType IS NOT NULL 
     OR caseNo IS NOT NULL
     OR employmentLetterType IS NOT NULL
`);

console.log(`找到 ${customers.length} 筆需要遷移的客戶資料`);

let migratedCount = 0;
let skippedCount = 0;

for (const c of customers) {
  // 檢查此客戶是否已有 customer_qualifications 記錄
  const [existing] = await conn.execute(
    'SELECT id FROM customer_qualifications WHERE customerId = ? LIMIT 1',
    [c.id]
  );
  
  if (existing.length > 0) {
    console.log(`  客戶 ${c.id} (${c.name}) 已有資格記錄，跳過`);
    skippedCount++;
    continue;
  }

  // 決定資格類別
  const qualifierCategory = c.employerType === 'individual' ? 'family' : 'business';

  // 若是家庭類且有被照顧者資料，先確保 customer_care_receivers 有記錄
  let careReceiverId = null;
  if (qualifierCategory === 'family' && c.careReceiverName) {
    // 檢查是否已有被照顧者記錄
    const [existingCR] = await conn.execute(
      'SELECT id FROM customer_care_receivers WHERE customerId = ? LIMIT 1',
      [c.id]
    );
    
    if (existingCR.length > 0) {
      careReceiverId = existingCR[0].id;
      console.log(`  客戶 ${c.id} 已有被照顧者記錄 #${careReceiverId}`);
    } else {
      // 建立被照顧者記錄
      const [crResult] = await conn.execute(`
        INSERT INTO customer_care_receivers 
          (customerId, careReceiverNo, careReceiverName, careReceiverBirthDate, 
           careReceiverIdNo, careReceiverAddress, careReceiverQualification, 
           careReceiverRelation, careReceiverIdFrontKey, careReceiverIdBackKey,
           createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [
        c.id,
        c.careReceiverNo || null,
        c.careReceiverName || null,
        c.careReceiverBirthDate || null,
        c.careReceiverIdNo || null,
        c.careReceiverAddress || null,
        c.careReceiverQualification || null,
        c.careReceiverRelation || null,
        c.careReceiverIdFrontKey || null,
        c.careReceiverIdBackKey || null,
      ]);
      careReceiverId = crResult.insertId;
      console.log(`  客戶 ${c.id} 建立被照顧者記錄 #${careReceiverId} (${c.careReceiverName})`);
    }
  }

  // 建立 customer_qualifications 記錄
  const label = qualifierCategory === 'family'
    ? (c.careReceiverName ? `${c.careReceiverName} 看護申請` : '家庭類申請')
    : '事業類申請';

  await conn.execute(`
    INSERT INTO customer_qualifications
      (customerId, qualifierCategory, careReceiverId, label,
       caseNo, caseStatus, managerId,
       jobSeekerType, jobSeekerDate, jobSeekerFileKey,
       recruitmentLetterType, recruitmentLetterDate, recruitmentLetterFileKey,
       recruitmentPermitNote, recruitmentPermitDays, previousWorkerDepartureDate,
       employmentLetterType, employmentLetterDate, employmentLetterFileKey,
       approvedStartDate, approvedPeriod, approvedEndDate,
       createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `, [
    c.id,
    qualifierCategory,
    careReceiverId,
    label,
    c.caseNo || null,
    c.caseStatus || null,
    c.managerId || null,
    c.jobSeekerType || null,
    c.jobSeekerDate || null,
    c.jobSeekerFileKey || null,
    c.recruitmentLetterType || null,
    c.recruitmentLetterDate || null,
    c.recruitmentLetterFileKey || null,
    c.recruitmentPermitNote || null,
    c.recruitmentPermitDays || null,
    c.previousWorkerDepartureDate || null,
    c.employmentLetterType || null,
    c.employmentLetterDate || null,
    c.employmentLetterFileKey || null,
    c.approvedStartDate || null,
    c.approvedPeriod || null,
    c.approvedEndDate || null,
  ]);

  console.log(`  ✅ 客戶 ${c.id} (${c.name}) → ${qualifierCategory} 資格已建立`);
  migratedCount++;
}

console.log(`\n遷移完成：${migratedCount} 筆已遷移，${skippedCount} 筆已跳過`);
await conn.end();
