import fs from "node:fs";
import { Client } from "@notionhq/client";

const writeMode = process.argv.includes("--write");
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

function isFullPage(page) {
  return page && page.object === "page" && "properties" in page;
}

function title(page, property) {
  const value = page.properties[property];
  return value?.type === "title"
    ? value.title.map((item) => item.plain_text).join("")
    : "";
}

function dateStart(page, property) {
  const value = page.properties[property];
  return value?.type === "date" ? value.date?.start ?? "" : "";
}

function relationIds(page, property) {
  const value = page.properties[property];
  return value?.type === "relation"
    ? value.relation.map((item) => item.id)
    : [];
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

    pages.push(...response.results.filter(isFullPage));
    cursor = response.next_cursor ?? undefined;
  } while (cursor);

  return pages;
}

async function hasValidCheckin(notion, dataSourceId, key) {
  const response = await notion.dataSources.query({
    data_source_id: dataSourceId,
    page_size: 1,
    filter: {
      and: [
        { property: "Check-in Key", rich_text: { equals: key } },
        { property: "Status", select: { equals: "Valid" } },
      ],
    },
  });

  return response.results.some(isFullPage);
}

async function main() {
  loadEnv();

  const notion = new Client({ auth: requireEnv("NOTION_TOKEN") });
  const challengesDataSourceId = requireEnv("NOTION_CHECKINS_DATA_SOURCE_ID");
  const checkinsDataSourceId = requireEnv(
    "NOTION_CHALLENGE_CHECKINS_DATA_SOURCE_ID",
  );

  const challenges = await collectPages(notion, challengesDataSourceId);
  let planned = 0;
  let skipped = 0;

  for (const challenge of challenges) {
    const challengeName = title(challenge, "Challenge Name") || "Challenge";
    const checkinDate = dateStart(challenge, "Date");
    const participantIds = relationIds(challenge, "참여명단");

    if (!checkinDate || participantIds.length === 0) continue;

    for (const memberId of participantIds) {
      const key = `${memberId}:${challenge.id}:${checkinDate}`;
      if (await hasValidCheckin(notion, checkinsDataSourceId, key)) {
        skipped += 1;
        continue;
      }

      planned += 1;
      console.log(`${writeMode ? "CREATE" : "DRY RUN"} ${key}`);

      if (!writeMode) continue;

      await notion.pages.create({
        parent: { data_source_id: checkinsDataSourceId },
        properties: {
          Name: {
            title: [
              {
                text: {
                  content: `${challengeName} - legacy - ${checkinDate}`,
                },
              },
            ],
          },
          Member: { relation: [{ id: memberId }] },
          Challenge: { relation: [{ id: challenge.id }] },
          "Check-in Date": { date: { start: checkinDate } },
          "Checked In At": { date: { start: `${checkinDate}T12:00:00-04:00` } },
          "Recorded By": { rich_text: [{ text: { content: "Legacy Migration" } }] },
          Status: { select: { name: "Valid" } },
          Method: { select: { name: "Manual" } },
          "Check-in Key": { rich_text: [{ text: { content: key } }] },
        },
      });
    }
  }

  console.log(
    `${writeMode ? "Created" : "Would create"} ${planned} check-ins. Skipped ${skipped} existing valid check-ins. Time zone basis: ${timeZone}.`,
  );
}

main().catch((error) => {
  console.error(error.body || error.message || error);
  process.exit(1);
});
