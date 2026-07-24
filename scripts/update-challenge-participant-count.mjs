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

async function main() {
  loadEnv();

  const dataSourceId = process.env.NOTION_CHECKINS_DATA_SOURCE_ID;
  const challengeCheckinsDataSourceId =
    process.env.NOTION_CHALLENGE_CHECKINS_DATA_SOURCE_ID;
  if (!process.env.NOTION_TOKEN) {
    throw new Error("NOTION_TOKEN is not configured.");
  }
  if (!dataSourceId) {
    throw new Error("NOTION_CHECKINS_DATA_SOURCE_ID is not configured.");
  }
  if (!challengeCheckinsDataSourceId) {
    throw new Error("NOTION_CHALLENGE_CHECKINS_DATA_SOURCE_ID is not configured.");
  }

  const notion = new Client({ auth: process.env.NOTION_TOKEN });
  const participantCountProperty = "Participant Count";
  const challengeProperty = "Challenge";

  const dataSource = await notion.dataSources.retrieve({
    data_source_id: dataSourceId,
  });

  if (!dataSource.properties[participantCountProperty]) {
    await notion.dataSources.update({
      data_source_id: dataSourceId,
      properties: {
        [participantCountProperty]: {
          number: { format: "number" },
        },
      },
    });
    console.log(`Created ${participantCountProperty}.`);
  } else {
    console.log(`${participantCountProperty} already exists.`);
  }

  let cursor;
  let updated = 0;

  do {
    const response = await notion.dataSources.query({
      data_source_id: dataSourceId,
      page_size: 100,
      start_cursor: cursor,
    });

    for (const page of response.results.filter(isFullPage)) {
      let checkinCursor;
      let count = 0;

      do {
        const checkins = await notion.dataSources.query({
          data_source_id: challengeCheckinsDataSourceId,
          page_size: 100,
          start_cursor: checkinCursor,
          filter: {
            property: challengeProperty,
            relation: { contains: page.id },
          },
        });

        count += checkins.results.filter(isFullPage).length;
        checkinCursor = checkins.next_cursor ?? undefined;
      } while (checkinCursor);

      await notion.pages.update({
        page_id: page.id,
        properties: {
          [participantCountProperty]: { number: count },
        },
      });
      updated += 1;
    }

    cursor = response.next_cursor ?? undefined;
  } while (cursor);

  console.log(`Backfilled ${updated} challenge rows.`);
}

main().catch((error) => {
  console.error(error.body || error.message || error);
  process.exit(1);
});
