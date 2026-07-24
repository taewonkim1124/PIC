import fs from "node:fs";
import { Client } from "@notionhq/client";
import {
  challengeProperties,
  challengeRelationProperty,
  checkinProperties,
  checkinsRelationProperty,
} from "./lib/checkin-migration-utils.mjs";

const writeMode = process.argv.includes("--write") && !process.argv.includes("--dry-run");

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

function relationSummary(property) {
  if (!property || property.type !== "relation") return "missing or not relation";

  const target = property.relation.data_source_id ?? "unknown target";
  const type = property.relation.type ?? "unknown type";
  const syncedName =
    property.relation.dual_property?.synced_property_name ??
    property.relation.dual_property?.synced_property_id ??
    "none";

  return `${type}, target=${target}, synced=${syncedName}`;
}

function isDualRelationTo(property, targetDataSourceId, syncedPropertyName) {
  if (!property || property.type !== "relation") return false;
  if (property.relation.data_source_id !== targetDataSourceId) return false;
  if (property.relation.type !== "dual_property") return false;

  const synced = property.relation.dual_property;
  return (
    synced?.synced_property_name === syncedPropertyName ||
    Boolean(synced?.synced_property_id)
  );
}

async function tryUpdate(label, updateFn) {
  try {
    await updateFn();
    console.log(`${label}: updated.`);
    return true;
  } catch (error) {
    console.warn(`${label}: Notion API did not allow automatic repair.`);
    console.warn(error.body || error.message || error);
    return false;
  }
}

async function main() {
  loadEnv();

  const notion = new Client({ auth: requireEnv("NOTION_TOKEN") });
  const challengesDataSourceId = requireEnv("NOTION_CHECKINS_DATA_SOURCE_ID");
  const checkinsDataSourceId = requireEnv(
    "NOTION_CHALLENGE_CHECKINS_DATA_SOURCE_ID",
  );

  const [challengesDataSource, checkinsDataSource] = await Promise.all([
    notion.dataSources.retrieve({ data_source_id: challengesDataSourceId }),
    notion.dataSources.retrieve({ data_source_id: checkinsDataSourceId }),
  ]);

  const challengeRelation = checkinsDataSource.properties[checkinProperties.challenge];
  const checkinsRelation = challengesDataSource.properties[challengeProperties.checkins];

  const challengeOk = isDualRelationTo(
    challengeRelation,
    challengesDataSourceId,
    challengeProperties.checkins,
  );
  const checkinsOk = isDualRelationTo(
    checkinsRelation,
    checkinsDataSourceId,
    checkinProperties.challenge,
  );

  console.log(`Challenge Check-ins.${checkinProperties.challenge}: ${relationSummary(challengeRelation)}`);
  console.log(`Challenges.${challengeProperties.checkins}: ${relationSummary(checkinsRelation)}`);

  if (challengeOk && checkinsOk) {
    console.log("The relation already looks bidirectional.");
    return;
  }

  if (!writeMode) {
    console.log("Dry run only. Re-run with --write to attempt a safe schema repair.");
    console.log(
      `If Notion rejects the repair, use the UI to connect ${checkinProperties.challenge} to ${challengeProperties.checkins} as the reciprocal relation.`,
    );
    return;
  }

  if (!challengeOk) {
    await tryUpdate(`Challenge Check-ins.${checkinProperties.challenge}`, () =>
      notion.dataSources.update({
        data_source_id: checkinsDataSourceId,
        properties: {
          [checkinProperties.challenge]: challengeRelationProperty(challengesDataSourceId),
        },
      }),
    );
  }

  const refreshedChallengesDataSource = await notion.dataSources.retrieve({
    data_source_id: challengesDataSourceId,
  });
  const refreshedCheckinsRelation =
    refreshedChallengesDataSource.properties[challengeProperties.checkins];

  if (
    !isDualRelationTo(
      refreshedCheckinsRelation,
      checkinsDataSourceId,
      checkinProperties.challenge,
    )
  ) {
    await tryUpdate(`Challenges.${challengeProperties.checkins}`, () =>
      notion.dataSources.update({
        data_source_id: challengesDataSourceId,
        properties: {
          [challengeProperties.checkins]: checkinsRelationProperty(checkinsDataSourceId),
        },
      }),
    );
  }

  console.log("Repair attempt finished. Run this script again without --write to verify.");
}

main().catch((error) => {
  console.error(error.body || error.message || error);
  process.exit(1);
});
