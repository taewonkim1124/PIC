import "server-only";

import { isFullPage } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

import { notion } from "@/lib/notion";

const memberProperties = {
  title: "이름",
  email: "이메일",
  uniqueCode: "유니크 코드",
} as const;

const challengeProperties = {
  title: "Challenge Name",
  date: "Date",
  participants: "참여명단",
} as const;

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!process.env.NOTION_TOKEN || !value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

function membersDataSourceId() {
  return requiredEnv("NOTION_MEMBERS_DATA_SOURCE_ID");
}

function challengesDataSourceId() {
  return requiredEnv("NOTION_CHECKINS_DATA_SOURCE_ID");
}

function requireFullPage(result: unknown): PageObjectResponse {
  if (!isFullPage(result as Parameters<typeof isFullPage>[0])) {
    throw new Error("Notion returned an incomplete page.");
  }
  return result as PageObjectResponse;
}

function richText(page: PageObjectResponse, property: string) {
  const value = page.properties[property];
  return value?.type === "rich_text"
    ? value.rich_text.map((item) => item.plain_text).join("")
    : "";
}

function title(page: PageObjectResponse, property: string) {
  const value = page.properties[property];
  return value?.type === "title"
    ? value.title.map((item) => item.plain_text).join("")
    : "";
}

function email(page: PageObjectResponse, property: string) {
  const value = page.properties[property];
  return value?.type === "email" ? value.email : null;
}

function relationIds(page: PageObjectResponse, property: string) {
  const value = page.properties[property];
  return value?.type === "relation"
    ? value.relation.map((item) => item.id)
    : [];
}

export async function findParticipantByCode(uniqueCode: string) {
  const response = await notion.dataSources.query({
    data_source_id: membersDataSourceId(),
    page_size: 1,
    filter: {
      property: memberProperties.uniqueCode,
      rich_text: { equals: uniqueCode },
    },
  });

  const result = response.results[0];
  if (!result) return null;
  const page = requireFullPage(result);

  return {
    id: page.id,
    name: title(page, memberProperties.title),
    email: email(page, memberProperties.email),
    unique_code: richText(page, memberProperties.uniqueCode),
  };
}

function participantFromPage(page: PageObjectResponse) {
  return {
    id: page.id,
    name: title(page, memberProperties.title),
    email: email(page, memberProperties.email),
    unique_code: richText(page, memberProperties.uniqueCode),
  };
}

export async function getParticipants() {
  const participants = [];
  let cursor: string | undefined;

  do {
    const response = await notion.dataSources.query({
      data_source_id: membersDataSourceId(),
      page_size: 100,
      start_cursor: cursor,
      sorts: [{ property: memberProperties.title, direction: "ascending" }],
    });

    participants.push(
      ...response.results.filter(isFullPage).map((page) => participantFromPage(page)),
    );

    cursor = response.next_cursor ?? undefined;
  } while (cursor);

  return participants;
}

export async function findParticipantDuplicate(input: {
  name: string;
  email: string | null;
}) {
  const participants = await getParticipants();
  const normalizedName = input.name.trim().toLocaleLowerCase();
  const normalizedEmail = input.email?.trim().toLocaleLowerCase();

  return participants.find((participant) => {
    if (normalizedEmail && participant.email?.toLocaleLowerCase() === normalizedEmail) {
      return true;
    }

    return participant.name.trim().toLocaleLowerCase() === normalizedName;
  }) ?? null;
}

export async function updateParticipantCode(
  participantId: string,
  uniqueCode: string,
) {
  const page = requireFullPage(
    await notion.pages.update({
      page_id: participantId,
      properties: {
        [memberProperties.uniqueCode]: {
          rich_text: [{ text: { content: uniqueCode } }],
        },
      },
    }),
  );

  return participantFromPage(page);
}

export async function getParticipantById(participantId: string) {
  const page = requireFullPage(await notion.pages.retrieve({ page_id: participantId }));
  return participantFromPage(page);
}

export async function createParticipant(input: {
  name: string;
  email: string | null;
  uniqueCode: string;
}) {
  const page = await notion.pages.create({
    parent: { data_source_id: membersDataSourceId() },
    properties: {
      [memberProperties.title]: {
        title: [{ text: { content: input.name } }],
      },
      [memberProperties.email]: {
        email: input.email,
      },
      [memberProperties.uniqueCode]: {
        rich_text: [{ text: { content: input.uniqueCode } }],
      },
    },
  });

  return {
    id: page.id,
    name: input.name,
    email: input.email,
    unique_code: input.uniqueCode,
  };
}

async function findChallengePage(challenge: string, date: string) {
  const response = await notion.dataSources.query({
    data_source_id: challengesDataSourceId(),
    page_size: 1,
    filter: {
      and: [
        { property: challengeProperties.title, title: { equals: challenge } },
        { property: challengeProperties.date, date: { equals: date } },
      ],
    },
  });

  return response.results[0] ? requireFullPage(response.results[0]) : null;
}

export async function findCheckin(
  participantId: string,
  challenge: string,
  date: string,
) {
  const page = await findChallengePage(challenge, date);
  if (!page) return false;

  return relationIds(page, challengeProperties.participants).includes(participantId);
}

export async function createCheckin(input: {
  participantId: string;
  challenge: string;
  date: string;
}) {
  const page = await findChallengePage(input.challenge, input.date);

  if (!page) {
    return notion.pages.create({
      parent: { data_source_id: challengesDataSourceId() },
      properties: {
        [challengeProperties.title]: {
          title: [{ text: { content: input.challenge } }],
        },
        [challengeProperties.date]: {
          date: { start: input.date },
        },
        [challengeProperties.participants]: {
          relation: [{ id: input.participantId }],
        },
      },
    });
  }

  const participantIds = relationIds(page, challengeProperties.participants);

  return notion.pages.update({
    page_id: page.id,
    properties: {
      [challengeProperties.participants]: {
        relation: [...participantIds, input.participantId].map((id) => ({ id })),
      },
    },
  });
}

export async function getChallengeNames() {
  const names = new Set<string>();
  let cursor: string | undefined;

  do {
    const response = await notion.dataSources.query({
      data_source_id: challengesDataSourceId(),
      page_size: 100,
      start_cursor: cursor,
      sorts: [{ timestamp: "created_time", direction: "descending" }],
    });

    response.results
      .filter(isFullPage)
      .forEach((page) => {
        const name = title(page, challengeProperties.title).trim();
        if (name) names.add(name);
      });

    cursor = response.next_cursor ?? undefined;
  } while (cursor);

  return [...names];
}

export async function getCheckins(challenge: string, date: string) {
  const page = await findChallengePage(challenge, date);
  if (!page) return [];

  const participantIds = relationIds(page, challengeProperties.participants);
  const participants = await Promise.all(
    participantIds.map(async (id) => requireFullPage(await notion.pages.retrieve({ page_id: id }))),
  );

  return participants.map((participant) => ({
      id: participant.id,
      checked_in_at: page.last_edited_time,
      method: "qr",
      participants: {
        name: title(participant, memberProperties.title),
        email: email(participant, memberProperties.email),
      },
    }));
}
