import fs from "node:fs";
import { Client } from "@notionhq/client";

const requiredEnv = [
  "NOTION_TOKEN",
  "NOTION_CHECKINS_DATA_SOURCE_ID",
  "NOTION_CHALLENGE_CHECKINS_DATA_SOURCE_ID",
  "NOTION_MEMBERS_DATA_SOURCE_ID",
];

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

function envReport() {
  return Object.fromEntries(
    requiredEnv.map((name) => [name, process.env[name] ? "set" : "missing"]),
  );
}

function normalizePropertyId(id) {
  if (!id) return "";

  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
}

function propertyNameById(dataSource, propertyId) {
  const normalized = normalizePropertyId(propertyId);

  return (
    Object.entries(dataSource.properties).find(
      ([, property]) => normalizePropertyId(property.id) === normalized,
    )?.[0] ?? null
  );
}

function relationReport(label, property, targetDataSourceId, counterpart, targetDataSource) {
  const exists = Boolean(property);
  const isRelation = property?.type === "relation";
  const isDual = isRelation && property.relation.type === "dual_property";
  const syncedPropertyId = property?.relation?.dual_property?.synced_property_id;

  return {
    label,
    exists,
    type: property?.type ?? "missing",
    relationType: isRelation ? property.relation.type ?? "unknown" : "n/a",
    targetMatches: Boolean(
      isRelation && property.relation.data_source_id === targetDataSourceId,
    ),
    syncedPropertyIdMatches: Boolean(
      isDual &&
        counterpart &&
        normalizePropertyId(syncedPropertyId) ===
          normalizePropertyId(counterpart.id),
    ),
    syncedPropertyNameResolved:
      isDual && syncedPropertyId
        ? propertyNameById(targetDataSource, syncedPropertyId) ?? "not found"
        : "n/a",
  };
}

function rollupReport(label, property, relationName, propertyName) {
  if (!property) {
    return { label, exists: false };
  }

  const rollup = property.type === "rollup" ? property.rollup : null;

  return {
    label,
    exists: true,
    type: property.type,
    relationMatches: rollup?.relation_property_name === relationName,
    propertyMatches: rollup?.rollup_property_name === propertyName,
    calculate: rollup?.function ?? "unknown",
  };
}

async function main() {
  loadEnv();

  console.log(JSON.stringify({ env: envReport() }));

  if (requiredEnv.some((name) => !process.env[name])) {
    throw new Error("Required environment variables are missing.");
  }

  const notion = new Client({ auth: process.env.NOTION_TOKEN });
  const [challenges, checkins] = await Promise.all([
    notion.dataSources.retrieve({
      data_source_id: process.env.NOTION_CHECKINS_DATA_SOURCE_ID,
    }),
    notion.dataSources.retrieve({
      data_source_id: process.env.NOTION_CHALLENGE_CHECKINS_DATA_SOURCE_ID,
    }),
  ]);

  const challengeProperty = checkins.properties.Challenge;
  const checkinsProperty = challenges.properties["Check-ins"];

  console.log(
    JSON.stringify(
      relationReport(
        "Challenge Check-ins.Challenge",
        challengeProperty,
        process.env.NOTION_CHECKINS_DATA_SOURCE_ID,
        checkinsProperty,
        challenges,
      ),
    ),
  );
  console.log(
    JSON.stringify(
      relationReport(
        "Challenges.Check-ins",
        checkinsProperty,
        process.env.NOTION_CHALLENGE_CHECKINS_DATA_SOURCE_ID,
        challengeProperty,
        checkins,
      ),
    ),
  );
  console.log(
    JSON.stringify(
      rollupReport(
        "Participant Count",
        challenges.properties["Participant Count"],
        "Check-ins",
        "Member",
      ),
    ),
  );
  console.log(
    JSON.stringify(
      rollupReport(
        "Participants",
        challenges.properties.Participants,
        "Check-ins",
        "Member",
      ),
    ),
  );
}

main().catch((error) => {
  console.error(error.body || error.message || error);
  process.exit(1);
});
