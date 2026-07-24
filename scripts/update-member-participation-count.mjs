import fs from "node:fs";
import { Client } from "@notionhq/client";

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

function isFullPage(page) {
  return page && page.object === "page" && "properties" in page;
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

async function main() {
  loadEnv();

  const membersDataSourceId = process.env.NOTION_MEMBERS_DATA_SOURCE_ID;
  const challengeCheckinsDataSourceId =
    process.env.NOTION_CHALLENGE_CHECKINS_DATA_SOURCE_ID;
  if (!process.env.NOTION_TOKEN) {
    throw new Error("NOTION_TOKEN is not configured.");
  }
  if (!membersDataSourceId) {
    throw new Error("NOTION_MEMBERS_DATA_SOURCE_ID is not configured.");
  }
  if (!challengeCheckinsDataSourceId) {
    throw new Error("NOTION_CHALLENGE_CHECKINS_DATA_SOURCE_ID is not configured.");
  }

  const notion = new Client({ auth: process.env.NOTION_TOKEN });
  const participationCountProperty = "Participation Count";
  const memberProperty = "Member";
  const statusProperty = "Status";

  const membersDataSource = await notion.dataSources.retrieve({
    data_source_id: membersDataSourceId,
  });

  if (!membersDataSource.properties[participationCountProperty]) {
    await notion.dataSources.update({
      data_source_id: membersDataSourceId,
      properties: {
        [participationCountProperty]: {
          number: { format: "number" },
        },
      },
    });
    console.log(`Created ${participationCountProperty}.`);
  } else {
    console.log(`${participationCountProperty} already exists.`);
  }

  const members = await collectPages(notion, membersDataSourceId);
  const checkins = [];
  let checkinCursor;

  do {
    const response = await notion.dataSources.query({
      data_source_id: challengeCheckinsDataSourceId,
      page_size: 100,
      start_cursor: checkinCursor,
      filter: {
        property: statusProperty,
        select: { equals: "Valid" },
      },
    });

    checkins.push(...response.results.filter(isFullPage));
    checkinCursor = response.next_cursor ?? undefined;
  } while (checkinCursor);

  const counts = new Map(members.map((member) => [member.id, 0]));

  for (const checkin of checkins) {
    const relation = checkin.properties[memberProperty];
    if (relation?.type !== "relation") continue;

    for (const member of relation.relation) {
      counts.set(member.id, (counts.get(member.id) ?? 0) + 1);
    }
  }

  for (const member of members) {
    await notion.pages.update({
      page_id: member.id,
      properties: {
        [participationCountProperty]: {
          number: counts.get(member.id) ?? 0,
        },
      },
    });
  }

  console.log(`Backfilled ${members.length} members.`);
}

main().catch((error) => {
  console.error(error.body || error.message || error);
  process.exit(1);
});
