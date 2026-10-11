// npm run codes:issue -- --label "Jane @ Acme" --credits 45
import { parseArgs } from "node:util";
import { generateAccessCode, hashAccessCode } from "../src/lib/credits/access";
import { accessCodes } from "../src/lib/db/schema";
import { getDb } from "../src/lib/db/client";

const { values } = parseArgs({
  options: {
    label: { type: "string" },
    credits: { type: "string", default: "45" },
  },
});

if (!values.label) {
  console.error('Usage: npm run codes:issue -- --label "Jane @ Acme" --credits 45');
  process.exit(1);
}

async function main() {
  const code = generateAccessCode();
  const creditsBalance = Number(values.credits);

  await getDb().insert(accessCodes).values({
    codeHash: hashAccessCode(code),
    label: values.label!,
    creditsBalance,
  });

  console.log(`Access code for ${values.label}: ${code}`);
  console.log("This is shown once — store it securely and send it to the recipient.");
}

main();
