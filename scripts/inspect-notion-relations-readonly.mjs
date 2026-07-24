import fs from "node:fs";
import { Client } from "@notionhq/client";

const inspectedDataSourceEnv = {
  Challenges: "NOTION_CHECKINS_DATA_SOURCE_ID",
  "Challenge Check-ins": "NOTION_CHALLENGE_CHECKINS_DATA_SOURCE_ID",
};
const knownDataSourceEnv = {
  Members: "NOTION_MEMBERS_DATA_SOURCE_ID",
  ...inspectedDataSourceEnv,
};

const appUsedRelationProperties = new Set([
  "Challenge Check-ins.Challenge",
  "Challenge Check-ins.Member",
]);

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

function normalizePropertyId(id) {
  if (!id) return "";

  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
}

async function collectPages(notion, dataSourceId) {
  const pages = [];
  let cursor;

  do {
    const response = await notion.dataSources.query({
      data_source_id: dataSourceId,
      page_size: 100,
      start_cursor: cursor,
    });

    pages.push(...response.results.filter((page) => page.object === "page"));
    cursor = response.next_cursor ?? undefined;
  } while (cursor);

  return pages;
}

async function countRelationLinks(notion, pages, propertyId) {
  let count = 0;

  for (const page of pages) {
    let cursor;

    do {
      const response = await notion.pages.properties.retrieve({
        page_id: page.id,
        property_id: propertyId,
        page_size: 100,
        start_cursor: cursor,
      });

      if (Array.isArray(response.results)) {
        count += response.results.filter((item) => item.type === "relation").length;
      } else if (response.type === "relation" && response.relation?.id) {
        count += 1;
      }

      cursor = response.next_cursor ?? undefined;
    } while (cursor);
  }

  return count;
}

function propertyNameById(dataSource, propertyId) {
  const normalized = normalizePropertyId(propertyId);

  return (
    Object.entries(dataSource.properties).find(
      ([, property]) => normalizePropertyId(property.id) === normalized,
    ) ?? null
  );
}

function dataSourceNameById(dataSourcesByName, dataSourceId) {
  return (
    Object.entries(dataSourcesByName).find(([, dataSource]) => dataSource.id === dataSourceId)
      ?.[0] ?? "Unknown"
  );
}

async function retrieveDataSource(notion, cache, dataSourceId) {
  if (cache.byId[dataSourceId]) return cache.byId[dataSourceId];

  try {
    const dataSource = await notion.dataSources.retrieve({
      data_source_id: dataSourceId,
    });
    cache.byId[dataSourceId] = dataSource;
    return dataSource;
  } catch {
    return null;
  }
}

async function main() {
  loadEnv();

  const notion = new Client({ auth: requireEnv("NOTION_TOKEN") });
  const knownDataSourcesByName = {};
  const inspectedDataSourcesByName = {};
  const cache = { byId: {} };

  for (const [name, envName] of Object.entries(knownDataSourceEnv)) {
    const dataSourceId = requireEnv(envName);
    const dataSource = await notion.dataSources.retrieve({
      data_source_id: dataSourceId,
    });
    knownDataSourcesByName[name] = dataSource;
    cache.byId[dataSourceId] = dataSource;

    if (name in inspectedDataSourceEnv) {
      inspectedDataSourcesByName[name] = dataSource;
    }
  }

  const pagesByDataSourceId = {};
  for (const dataSource of Object.values(inspectedDataSourcesByName)) {
    pagesByDataSourceId[dataSource.id] = await collectPages(notion, dataSource.id);
  }

  const rows = [];

  for (const [databaseName, dataSource] of Object.entries(inspectedDataSourcesByName)) {
    for (const [propertyName, property] of Object.entries(dataSource.properties)) {
      if (property.type !== "relation") continue;

      const targetDataSourceId = property.relation.data_source_id;
      const targetDataSource = await retrieveDataSource(notion, cache, targetDataSourceId);
      const syncedPropertyId = property.relation.dual_property?.synced_property_id ?? "";
      const counterpart = targetDataSource
        ? propertyNameById(targetDataSource, syncedPropertyId)
        : null;
      const linkCount = await countRelationLinks(
        notion,
        pagesByDataSourceId[dataSource.id],
        property.id,
      );

      rows.push({
        databaseName,
        propertyName,
        propertyId: property.id,
        target: dataSourceNameById(knownDataSourcesByName, targetDataSourceId),
        relationType: property.relation.type ?? "unknown",
        syncedPropertyId: syncedPropertyId || "-",
        counterpartName: counterpart?.[0] ?? "-",
        counterpartId: counterpart?.[1]?.id ?? "-",
        linkCount,
        usedByApp: appUsedRelationProperties.has(`${databaseName}.${propertyName}`)
          ? "yes"
          : "no",
      });
    }
  }

  console.table(rows);

  const challenges = inspectedDataSourcesByName.Challenges;
  const challengePages = pagesByDataSourceId[challenges.id] ?? [];
  const participantCountProperty = challenges.properties["Participant Count"];
  const participantCountValues = challengePages
    .map((page) => page.properties["Participant Count"])
    .filter((property) => property?.type === "number" && property.number !== null)
    .map((property) => property.number);

  console.log(
    JSON.stringify({
      participantCount: {
        exists: Boolean(participantCountProperty),
        type: participantCountProperty?.type ?? "missing",
        pagesWithNumberValue: participantCountValues.length,
        nonZeroValues: participantCountValues.filter((value) => value !== 0).length,
      },
    }),
  );
}

main().catch((error) => {
  console.error(error.body || error.message || error);
  process.exit(1);
});
