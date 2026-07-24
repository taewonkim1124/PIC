import fs from "node:fs";
import { Client } from "@notionhq/client";
import {
  challengeProperties,
  challengeRelationProperty,
  checkinKey,
  checkinProperties,
  isDualRelationPair,
} from "./lib/checkin-migration-utils.mjs";

const memberProperties = {
  title: "이름",
  role: "직책",
  team: "팀",
  memo: "메모",
  gender: "젠더",
  email: "이메일",
  kakao: "카카오톡",
  phone: "번호",
  instagram: "인스타",
  joinDate: "입사일",
  grade: "학년",
  active: "활동중",
  uniqueCode: "유니크 코드",
  participationCount: "Participation Count",
};

const envUpdates = [
  "NOTION_MEMBERS_DATABASE_ID",
  "NOTION_MEMBERS_DATA_SOURCE_ID",
  "NOTION_CHECKINS_DATABASE_ID",
  "NOTION_CHECKINS_DATA_SOURCE_ID",
  "NOTION_CHALLENGE_CHECKINS_DATABASE_ID",
  "NOTION_CHALLENGE_CHECKINS_DATA_SOURCE_ID",
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

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function upsertEnv(updates) {
  const path = ".env.local";
  const existing = fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";
  const lines = existing.split(/\r?\n/);

  for (const [name, value] of Object.entries(updates)) {
    const nextLine = `${name}=${value}`;
    const index = lines.findIndex((line) => line.startsWith(`${name}=`));

    if (index >= 0) {
      lines[index] = nextLine;
    } else {
      if (lines.length && lines.at(-1) !== "") lines.push("");
      lines.push(nextLine);
    }
  }

  fs.writeFileSync(path, lines.join("\n").replace(/\n{3,}/g, "\n\n"));
}

function dataSourceId(database) {
  return database.data_sources?.[0]?.id ?? database.id;
}

function newYorkDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function relationIdsFromPropertyItem(response) {
  if (!Array.isArray(response.results)) return [];

  return response.results
    .filter((item) => item.type === "relation")
    .map((item) => item.relation.id);
}

function rollupShape(property, relationProperty, rollupProperty, fn) {
  return (
    property?.type === "rollup" &&
    property.rollup.relation_property_name === relationProperty &&
    property.rollup.rollup_property_name === rollupProperty &&
    property.rollup.function === fn
  );
}

async function waitFor(description, fn) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const result = await fn();
    if (result.ok) return result;
    await new Promise((resolve) => setTimeout(resolve, 750));
  }

  throw new Error(`${description} did not become ready.`);
}

async function main() {
  loadEnv();

  const notion = new Client({ auth: requireEnv("NOTION_TOKEN") });
  const parentDatabase = await notion.databases.retrieve({
    database_id: requireEnv("NOTION_CHECKINS_DATABASE_ID"),
  });

  if (parentDatabase.parent.type !== "page_id") {
    throw new Error("Existing challenge database parent is not a Notion page.");
  }

  const suffix = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const parent = { type: "page_id", page_id: parentDatabase.parent.page_id };

  const membersDatabase = await notion.databases.create({
    parent,
    title: [{ text: { content: `PIC Test Members ${suffix}` } }],
    initial_data_source: {
      properties: {
        [memberProperties.title]: { title: {} },
        [memberProperties.role]: { select: {} },
        [memberProperties.team]: { select: {} },
        [memberProperties.memo]: { rich_text: {} },
        [memberProperties.gender]: { select: {} },
        [memberProperties.email]: { email: {} },
        [memberProperties.kakao]: { rich_text: {} },
        [memberProperties.phone]: { phone_number: {} },
        [memberProperties.instagram]: { rich_text: {} },
        [memberProperties.joinDate]: { date: {} },
        [memberProperties.grade]: { select: {} },
        [memberProperties.active]: { checkbox: {} },
        [memberProperties.uniqueCode]: { rich_text: {} },
        [memberProperties.participationCount]: { number: {} },
      },
    },
  });
  const membersDataSourceId = dataSourceId(membersDatabase);

  const challengesDatabase = await notion.databases.create({
    parent,
    title: [{ text: { content: `PIC Test Challenges ${suffix}` } }],
    initial_data_source: {
      properties: {
        [challengeProperties.title]: { title: {} },
        [challengeProperties.date]: { date: {} },
      },
    },
  });
  const challengesDataSourceId = dataSourceId(challengesDatabase);

  const checkinsDatabase = await notion.databases.create({
    parent,
    title: [{ text: { content: `PIC Test Challenge Check-ins ${suffix}` } }],
    initial_data_source: {
      properties: {
        [checkinProperties.title]: { title: {} },
        [checkinProperties.member]: {
          relation: {
            data_source_id: membersDataSourceId,
            type: "single_property",
            single_property: {},
          },
        },
        [checkinProperties.challenge]: challengeRelationProperty(challengesDataSourceId),
        [checkinProperties.checkinDate]: { date: {} },
        [checkinProperties.checkedInAt]: { date: {} },
        [checkinProperties.recordedBy]: { rich_text: {} },
        [checkinProperties.status]: {
          select: {
            options: [
              { name: "Valid", color: "green" },
              { name: "Cancelled", color: "red" },
            ],
          },
        },
        [checkinProperties.method]: {
          select: {
            options: [
              { name: "QR", color: "blue" },
              { name: "Manual", color: "gray" },
            ],
          },
        },
        [checkinProperties.checkinKey]: { rich_text: {} },
      },
    },
  });
  const checkinsDataSourceId = dataSourceId(checkinsDatabase);

  await waitFor("reciprocal Check-ins relation", async () => {
    const challenges = await notion.dataSources.retrieve({
      data_source_id: challengesDataSourceId,
    });
    return {
      ok: Boolean(challenges.properties[challengeProperties.checkins]),
      challenges,
    };
  });

  await notion.dataSources.update({
    data_source_id: challengesDataSourceId,
    properties: {
      "Participant Count": {
        rollup: {
          relation_property_name: challengeProperties.checkins,
          rollup_property_name: checkinProperties.member,
          function: "unique",
        },
      },
      Participants: {
        rollup: {
          relation_property_name: challengeProperties.checkins,
          rollup_property_name: checkinProperties.member,
          function: "show_unique",
        },
      },
    },
  });

  upsertEnv({
    NOTION_MEMBERS_DATABASE_ID: membersDatabase.id,
    NOTION_MEMBERS_DATA_SOURCE_ID: membersDataSourceId,
    NOTION_CHECKINS_DATABASE_ID: challengesDatabase.id,
    NOTION_CHECKINS_DATA_SOURCE_ID: challengesDataSourceId,
    NOTION_CHALLENGE_CHECKINS_DATABASE_ID: checkinsDatabase.id,
    NOTION_CHALLENGE_CHECKINS_DATA_SOURCE_ID: checkinsDataSourceId,
  });

  const refreshedChallenges = await notion.dataSources.retrieve({
    data_source_id: challengesDataSourceId,
  });
  const refreshedCheckins = await notion.dataSources.retrieve({
    data_source_id: checkinsDataSourceId,
  });
  const challengeRelation = refreshedCheckins.properties[checkinProperties.challenge];
  const checkinsRelation = refreshedChallenges.properties[challengeProperties.checkins];
  const relationPairOk = isDualRelationPair({
    sourceProperty: challengeRelation,
    sourceTargetDataSourceId: challengesDataSourceId,
    sourceSyncedPropertyId: checkinsRelation?.id,
    targetProperty: checkinsRelation,
    targetTargetDataSourceId: checkinsDataSourceId,
    targetSyncedPropertyId: challengeRelation?.id,
  });

  const participantCountOk = rollupShape(
    refreshedChallenges.properties["Participant Count"],
    challengeProperties.checkins,
    checkinProperties.member,
    "unique",
  );
  const participantsOk = rollupShape(
    refreshedChallenges.properties.Participants,
    challengeProperties.checkins,
    checkinProperties.member,
    "show_unique",
  );

  const today = newYorkDate();
  const uniqueCode = `TEST-${crypto.randomUUID()}`;
  const member = await notion.pages.create({
    parent: { data_source_id: membersDataSourceId },
    properties: {
      [memberProperties.title]: { title: [{ text: { content: "Test Member" } }] },
      [memberProperties.email]: { email: "test@example.com" },
      [memberProperties.uniqueCode]: {
        rich_text: [{ text: { content: uniqueCode } }],
      },
      [memberProperties.active]: { checkbox: true },
    },
  });
  const challenge = await notion.pages.create({
    parent: { data_source_id: challengesDataSourceId },
    properties: {
      [challengeProperties.title]: {
        title: [{ text: { content: "Test Challenge" } }],
      },
      [challengeProperties.date]: { date: { start: today } },
    },
  });
  const key = checkinKey(member.id, challenge.id, today);

  const checkin = await notion.pages.create({
    parent: { data_source_id: checkinsDataSourceId },
    properties: {
      [checkinProperties.title]: {
        title: [{ text: { content: `Test Challenge - Test Member - ${today}` } }],
      },
      [checkinProperties.member]: { relation: [{ id: member.id }] },
      [checkinProperties.challenge]: { relation: [{ id: challenge.id }] },
      [checkinProperties.checkinDate]: { date: { start: today } },
      [checkinProperties.checkedInAt]: { date: { start: new Date().toISOString() } },
      [checkinProperties.recordedBy]: {
        rich_text: [{ text: { content: "Setup Verification" } }],
      },
      [checkinProperties.status]: { select: { name: "Valid" } },
      [checkinProperties.method]: { select: { name: "QR" } },
      [checkinProperties.checkinKey]: {
        rich_text: [{ text: { content: key } }],
      },
    },
  });

  const reciprocalResult = await waitFor("challenge reciprocal relation", async () => {
    const response = await notion.pages.properties.retrieve({
      page_id: challenge.id,
      property_id: checkinsRelation.id,
      page_size: 100,
    });
    const ids = relationIdsFromPropertyItem(response);
    return { ok: ids.includes(checkin.id), ids };
  });

  const rollupResult = await waitFor("challenge rollups", async () => {
    const page = await notion.pages.retrieve({ page_id: challenge.id });
    const count = page.properties["Participant Count"];
    const participants = page.properties.Participants;
    const countOk =
      count?.type === "rollup" &&
      count.rollup.type === "number" &&
      count.rollup.number === 1;
    const participantsOk =
      participants?.type === "rollup" &&
      participants.rollup.type === "array" &&
      participants.rollup.array.length >= 1;

    return { ok: countOk && participantsOk, count, participants };
  });

  const duplicateResponse = await notion.dataSources.query({
    data_source_id: checkinsDataSourceId,
    page_size: 1,
    filter: {
      and: [
        { property: checkinProperties.checkinKey, rich_text: { equals: key } },
        { property: checkinProperties.status, select: { equals: "Valid" } },
      ],
    },
  });

  const duplicateBlocked = duplicateResponse.results.length > 0;

  console.table([
    { check: "relation pair", result: relationPairOk ? "pass" : "fail" },
    { check: "Participant Count rollup", result: participantCountOk ? "pass" : "fail" },
    { check: "Participants rollup", result: participantsOk ? "pass" : "fail" },
    {
      check: "reciprocal relation updated",
      result: reciprocalResult.ok ? "pass" : "fail",
    },
    { check: "rollups updated", result: rollupResult.ok ? "pass" : "fail" },
    { check: "duplicate prevented", result: duplicateBlocked ? "pass" : "fail" },
  ]);

  console.log(
    `Updated local .env.local for ${envUpdates.length} Notion database/data source variables.`,
  );
}

main().catch((error) => {
  console.error(error.body || error.message || error);
  process.exit(1);
});
