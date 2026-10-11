import { getDb } from "./src/lib/db/client";
import { accessCodes, reports } from "./src/lib/db/schema";
import { desc } from "drizzle-orm";

async function main() {
  const codes = await getDb().select().from(accessCodes).orderBy(desc(accessCodes.createdAt));
  console.log(
    "access codes (label, balance):",
    codes.map((c) => `${c.label}=${c.creditsBalance}`),
  );
  const recentReports = await getDb().select().from(reports).orderBy(desc(reports.createdAt)).limit(3);
  console.log(
    "recent reports:",
    recentReports.map((r) => `${r.id.slice(0, 8)} ${r.status} cost=${r.costUsd}`),
  );
}

main();
