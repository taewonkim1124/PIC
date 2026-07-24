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

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

async function main() {
  loadEnv();

  const notion = new Client({ auth: requireEnv("NOTION_TOKEN") });
  const dataSourceId = requireEnv("NOTION_CHALLENGE_CHECKINS_DATA_SOURCE_ID");
  const dataSource = await notion.dataSources.retrieve({
    data_source_id: dataSourceId,
  });

  const properties = {};

  if (dataSource.properties.Name && !dataSource.properties["Check-in"]) {
    properties.Name = { name: "Check-in" };
  }

  if (dataSource.properties.Date && !dataSource.properties["Check-in Date"]) {
    properties.Date = { name: "Check-in Date" };
  } else if (!dataSource.properties["Check-in Date"]) {
    properties["Check-in Date"] = { date: {} };
  }

  if (dataSource.properties["Checked In By"] && !dataSource.properties["Recorded By"]) {
    properties["Checked In By"] = { name: "Recorded By" };
  } else if (!dataSource.properties["Recorded By"]) {
    properties["Recorded By"] = { rich_text: {} };
  }

  if (!dataSource.properties["Check-in Key"]) {
    properties["Check-in Key"] = { rich_text: {} };
  }

  if (!dataSource.properties.Status) {
    properties.Status = {
      select: {
        options: [
          { name: "Valid", color: "green" },
          { name: "Cancelled", color: "red" },
        ],
      },
    };
  } else {
    const status = dataSource.properties.Status;
    if (status.type === "select") {
      const options = status.select.options.map((option) => ({
        name: option.name,
        color: option.color,
      }));
      const optionNames = new Set(options.map((option) => option.name));

      if (!optionNames.has("Valid")) {
        options.push({ name: "Valid", color: "green" });
      }
      if (!optionNames.has("Cancelled")) {
        options.push({ name: "Cancelled", color: "red" });
      }

      properties.Status = { select: { options } };
    }
  }

  if (!dataSource.properties.Method) {
    properties.Method = {
      select: {
        options: [
          { name: "QR", color: "blue" },
          { name: "Manual", color: "gray" },
        ],
      },
    };
  }

  if (Object.keys(properties).length === 0) {
    console.log("Challenge Check-ins schema already matches.");
    return;
  }

  await notion.dataSources.update({
    data_source_id: dataSourceId,
    properties,
  });

  console.log("Updated Challenge Check-ins schema:");
  console.log(Object.keys(properties).join("\n"));
}

main().catch((error) => {
  console.error(error.body || error.message || error);
  process.exit(1);
});
