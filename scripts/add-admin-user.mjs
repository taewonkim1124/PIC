import { createHmac } from "node:crypto";
import fs from "node:fs";
import { Client } from "@notionhq/client";

for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
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

const [username, password, name] = process.argv.slice(2);
const secret = process.env.APP_AUTH_SECRET || process.env.ADMIN_PASSWORD;
const dataSourceId = process.env.NOTION_ADMINS_DATA_SOURCE_ID;

if (!username || !password || !name) {
  console.error("Usage: node scripts/add-admin-user.mjs <username> <password> <name>");
  process.exit(1);
}

if (!secret || !dataSourceId) {
  console.error("APP_AUTH_SECRET and NOTION_ADMINS_DATA_SOURCE_ID are required.");
  process.exit(1);
}

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const passwordHash = createHmac("sha256", secret).update(password).digest("hex");

await notion.pages.create({
  parent: { data_source_id: dataSourceId },
  properties: {
    Name: { title: [{ text: { content: name } }] },
    Username: {
      rich_text: [{ text: { content: username.trim().toLowerCase() } }],
    },
    "Password Hash": {
      rich_text: [{ text: { content: passwordHash } }],
    },
    Active: { checkbox: true },
  },
});

console.log(`Admin user added: ${username.trim().toLowerCase()} (${name})`);
