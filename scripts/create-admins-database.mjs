import fs from "node:fs";
import { Client } from "@notionhq/client";

const envPath = ".env.local";

function loadEnv() {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
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
  const content = fs.readFileSync(envPath, "utf8");
  const line = `${name}=${value}`;
  const pattern = new RegExp(`^${name}=.*$`, "m");
  const nextContent = pattern.test(content)
    ? content.replace(pattern, line)
    : `${content.replace(/\s*$/, "")}\n${line}\n`;
  fs.writeFileSync(envPath, nextContent);
}

loadEnv();

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const membersDatabaseId = process.env.NOTION_MEMBERS_DATABASE_ID;

if (!membersDatabaseId) {
  throw new Error("NOTION_MEMBERS_DATABASE_ID missing in .env.local");
}

const membersDatabase = await notion.databases.retrieve({
  database_id: membersDatabaseId,
});

if (!membersDatabase.parent || membersDatabase.parent.type !== "page_id") {
  throw new Error("Members database parent is not a page.");
}

const adminsDatabase = await notion.databases.create({
  parent: { type: "page_id", page_id: membersDatabase.parent.page_id },
  title: [{ type: "text", text: { content: "Admins" } }],
  initial_data_source: {
    properties: {
      Name: { title: {} },
      Username: { rich_text: {} },
      "Password Hash": { rich_text: {} },
      Active: { checkbox: {} },
    },
  },
});

const dataSourceId = adminsDatabase.data_sources?.[0]?.id;
if (!dataSourceId) {
  throw new Error("Could not find created Admins data source ID.");
}

upsertEnv("NOTION_ADMINS_DATABASE_ID", adminsDatabase.id);
upsertEnv("NOTION_ADMINS_DATA_SOURCE_ID", dataSourceId);

console.log(`NOTION_ADMINS_DATABASE_ID=${adminsDatabase.id}`);
console.log(`NOTION_ADMINS_DATA_SOURCE_ID=${dataSourceId}`);
