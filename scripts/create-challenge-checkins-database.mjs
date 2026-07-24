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

function upsertEnv(name, value) {
  const path = ".env.local";
  const existing = fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";
  const lines = existing.split(/\r?\n/);
  const nextLine = `${name}=${value}`;
  const index = lines.findIndex((line) => line.startsWith(`${name}=`));

  if (index >= 0) {
    lines[index] = nextLine;
  } else {
    if (lines.length && lines.at(-1) !== "") lines.push("");
    lines.push(nextLine);
  }

  fs.writeFileSync(path, lines.join("\n").replace(/\n{3,}/g, "\n\n"));
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

async function main() {
  loadEnv();

  const notion = new Client({ auth: requireEnv("NOTION_TOKEN") });
  const challengesDatabaseId = requireEnv("NOTION_CHECKINS_DATABASE_ID");
  const membersDataSourceId = requireEnv("NOTION_MEMBERS_DATA_SOURCE_ID");
  const challengesDataSourceId = requireEnv("NOTION_CHECKINS_DATA_SOURCE_ID");

  const challengeDatabase = await notion.databases.retrieve({
    database_id: challengesDatabaseId,
  });

  if (challengeDatabase.parent.type !== "page_id") {
    throw new Error("Challenge database parent is not a Notion page.");
  }

  const database = await notion.databases.create({
    parent: { type: "page_id", page_id: challengeDatabase.parent.page_id },
    title: [{ text: { content: "Challenge Check-ins" } }],
    initial_data_source: {
      properties: {
        Name: { title: {} },
        Member: {
          relation: {
            data_source_id: membersDataSourceId,
            type: "single_property",
            single_property: {},
          },
        },
        Challenge: {
          relation: {
            data_source_id: challengesDataSourceId,
            type: "single_property",
            single_property: {},
          },
        },
        Date: { date: {} },
        "Checked In At": { date: {} },
        "Checked In By": { rich_text: {} },
        Status: { select: { options: [{ name: "Checked In", color: "green" }] } },
        Method: { select: { options: [{ name: "QR", color: "blue" }] } },
      },
    },
  });

  const dataSourceId =
    database.data_sources?.[0]?.id ?? database.id;

  await notion.dataSources.update({
    data_source_id: challengesDataSourceId,
    properties: {
      "Check-ins": {
        relation: {
          data_source_id: dataSourceId,
          type: "single_property",
          single_property: {},
        },
      },
    },
  }).catch(() => undefined);

  upsertEnv("NOTION_CHALLENGE_CHECKINS_DATABASE_ID", database.id);
  upsertEnv("NOTION_CHALLENGE_CHECKINS_DATA_SOURCE_ID", dataSourceId);

  console.log("Created Challenge Check-ins database.");
  console.log(`NOTION_CHALLENGE_CHECKINS_DATABASE_ID=${database.id}`);
  console.log(`NOTION_CHALLENGE_CHECKINS_DATA_SOURCE_ID=${dataSourceId}`);
}

main().catch((error) => {
  console.error(error.body || error.message || error);
  process.exit(1);
});
