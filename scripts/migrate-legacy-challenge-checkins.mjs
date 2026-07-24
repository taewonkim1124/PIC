import fs from "node:fs";
import { Client } from "@notionhq/client";
import {
  legacyCheckinPageProperties,
  planLegacyChallengeMigration,
} from "./lib/checkin-migration-utils.mjs";

const writeMode = process.argv.includes("--write") && !process.argv.includes("--dry-run");
const dryRunMode = !writeMode;
const verboseMode = process.argv.includes("--verbose");
const timeZone = "America/New_York";

function loadEnv() {
  const path = ".env.local";
  if (!fs.existsSync(path)) return;

  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;

    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[match[1]] = value;
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

async function main() {
  loadEnv();

  const notion = new Client({ auth: requireEnv("NOTION_TOKEN") });
  const challengesDataSourceId = requireEnv("NOTION_CHECKINS_DATA_SOURCE_ID");
  const checkinsDataSourceId = requireEnv(
    "NOTION_CHALLENGE_CHECKINS_DATA_SOURCE_ID",
  );

  const plan = await planLegacyChallengeMigration({
    notion,
    challengesDataSourceId,
    checkinsDataSourceId,
  });

  console.log(
    `${dryRunMode ? "Dry run" : "Write mode"}: ${plan.challengeCount} challenges scanned, ${plan.totalRelationMemberCount} legacy relation members read, ${plan.creates.length} check-ins queued, ${plan.skipped} existing valid check-ins skipped, ${plan.missingDate} challenges skipped because Date is empty, ${plan.missingRelation} challenges missing legacy relation, ${plan.relationReadErrors} relation read errors.`,
  );

  for (const item of plan.creates) {
    if (verboseMode) {
      console.log(
        `${writeMode ? "CREATE" : "DRY RUN"} ${item.challengeName} ${item.checkinDate}`,
      );
    }

    if (!writeMode) continue;

    await notion.pages.create({
      parent: { data_source_id: checkinsDataSourceId },
      properties: legacyCheckinPageProperties(item),
    });
  }

  console.log(
    `${writeMode ? "Created" : "Would create"} ${plan.creates.length} check-ins. Skipped ${plan.skipped} existing valid check-ins. ${plan.missingDate} challenges had no date. ${plan.missingRelation} challenges had no legacy relation. ${plan.relationReadErrors} relation reads failed. Scanned ${plan.challengeCount} challenges. Time zone basis: ${timeZone}.`,
  );
}

main().catch((error) => {
  console.error(error.body || error.message || error);
  process.exit(1);
});
