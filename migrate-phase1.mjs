import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");

const conn = await mysql.createConnection(url);

const alters = [
  "ALTER TABLE `cases` ADD COLUMN `caseNo` varchar(30) NULL AFTER `name`",
  "ALTER TABLE `cases` ADD COLUMN `caseCondition` varchar(100) NULL AFTER `status`",
  "ALTER TABLE `cases` ADD COLUMN `primaryWorkerId` int NULL AFTER `caseCondition`",
  "ALTER TABLE `cases` ADD COLUMN `needsReview` int NOT NULL DEFAULT 0 AFTER `primaryWorkerId`",
  "ALTER TABLE `cases` ADD COLUMN `recruitmentPermitFileKey` varchar(300) NULL AFTER `needsReview`",
];

for (const sql of alters) {
  try {
    await conn.execute(sql);
    const col = sql.match(/ADD COLUMN `(\w+)`/)?.[1];
    console.log("✓ Added:", col);
  } catch (e) {
    if (e.code === "ER_DUP_FIELDNAME" || e.message?.includes("Duplicate column")) {
      const col = sql.match(/ADD COLUMN `(\w+)`/)?.[1];
      console.log("⚠ Already exists:", col);
    } else {
      console.error("✗ Error:", e.message);
    }
  }
}

// Verify
const [rows] = await conn.execute("DESCRIBE `cases`");
console.log("\nCases table columns:");
rows.forEach(r => console.log(" -", r.Field, r.Type));

await conn.end();
console.log("\nMigration done!");
