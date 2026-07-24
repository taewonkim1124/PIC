import "server-only";

import { isFullPage } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

import { notion } from "@/lib/notion";

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
} as const;

const challengeProperties = {
  title: "Challenge Name",
  date: "Date",
} as const;

const checkinProperties = {
  title: "Check-in",
  member: "Member",
  challenge: "Challenge",
  checkinDate: "Check-in Date",
  checkedInAt: "Checked In At",
  recordedBy: "Recorded By",
  status: "Status",
  method: "Method",
  checkinKey: "Check-in Key",
} as const;

const validCheckinStatus = "Valid";
const cancelledCheckinStatus = "Cancelled";

const paymentProperties = {
  title: "Name",
  uniqueCode: "Code",
  item: "Item",
  amount: "Price",
  recordedBy: "Recorded By",
  recordedAt: "Recorded At",
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

function challengeCheckinsDataSourceId() {
  return requiredEnv("NOTION_CHALLENGE_CHECKINS_DATA_SOURCE_ID");
}

function paymentsDataSourceId() {
  return requiredEnv("NOTION_PAYMENTS_DATA_SOURCE_ID");
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

function number(page: PageObjectResponse, property: string) {
  const value = page.properties[property];
  return value?.type === "number" ? value.number : null;
}

function relationIds(page: PageObjectResponse, property: string) {
  const value = page.properties[property];
  return value?.type === "relation"
    ? value.relation.map((item) => item.id)
    : [];
}

function dateStart(page: PageObjectResponse, property: string) {
  const value = page.properties[property];
  return value?.type === "date" ? value.date?.start ?? "" : "";
}

function propertyText(page: PageObjectResponse, property: string) {
  const value = page.properties[property];
  if (!value) return "";

  if (value.type === "select") return value.select?.name ?? "";
  if (value.type === "status") return value.status?.name ?? "";
  if (value.type === "rich_text") {
    return value.rich_text.map((item) => item.plain_text).join("");
  }
  if (value.type === "title") {
    return value.title.map((item) => item.plain_text).join("");
  }

  return "";
}

function optionalRichText(value: string | null | undefined) {
  return value ? { rich_text: [{ text: { content: value } }] } : undefined;
}

function optionalSelect(value: string | null | undefined) {
  return value ? { select: { name: value } } : undefined;
}

function optionalDate(value: string | null | undefined) {
  return value ? { date: { start: value } } : undefined;
}

type ParticipantRegistrationInput = {
  name: string;
  email: string | null;
  uniqueCode: string;
  role?: string | null;
  team?: string | null;
  memo?: string | null;
  gender?: string | null;
  kakao?: string | null;
  phone?: string | null;
  instagram?: string | null;
  joinDate?: string | null;
  grade?: string | null;
  active?: boolean;
};

function registrationProperties(input: ParticipantRegistrationInput) {
  const extraProperties = {
    [memberProperties.role]: optionalSelect(input.role),
    [memberProperties.team]: optionalSelect(input.team),
    [memberProperties.memo]: optionalRichText(input.memo),
    [memberProperties.gender]: optionalSelect(input.gender),
    [memberProperties.kakao]: optionalRichText(input.kakao),
    [memberProperties.phone]: input.phone
      ? { phone_number: input.phone }
      : undefined,
    [memberProperties.instagram]: optionalRichText(input.instagram),
    [memberProperties.joinDate]: optionalDate(input.joinDate),
    [memberProperties.grade]: optionalSelect(input.grade),
    [memberProperties.active]: { checkbox: input.active ?? true },
  };

  return {
    [memberProperties.title]: {
      title: [{ text: { content: input.name } }],
    },
    [memberProperties.email]: {
      email: input.email,
    },
    [memberProperties.uniqueCode]: {
      rich_text: [{ text: { content: input.uniqueCode } }],
    },
    ...Object.fromEntries(
      Object.entries(extraProperties).filter((entry) => entry[1] !== undefined),
    ),
  };
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

  return participantFromPage(page);
}

function participantFromPage(page: PageObjectResponse) {
  return {
    id: page.id,
    name: title(page, memberProperties.title),
    email: email(page, memberProperties.email),
    unique_code: richText(page, memberProperties.uniqueCode),
    participation_count: number(page, memberProperties.participationCount),
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

  return (
    participants.find((participant) => {
      if (normalizedEmail) {
        return participant.email?.toLocaleLowerCase() === normalizedEmail;
      }

      return participant.name.trim().toLocaleLowerCase() === normalizedName;
    }) ?? null
  );
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

export async function createParticipant(input: ParticipantRegistrationInput) {
  const page = await notion.pages.create({
    parent: { data_source_id: membersDataSourceId() },
    properties: registrationProperties(input),
  });

  return {
    id: page.id,
    name: input.name,
    email: input.email,
    unique_code: input.uniqueCode,
  };
}

export async function updateParticipantRegistration(
  participantId: string,
  input: ParticipantRegistrationInput,
) {
  const page = requireFullPage(
    await notion.pages.update({
      page_id: participantId,
      properties: registrationProperties(input),
    }),
  );

  return participantFromPage(page);
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

async function ensureChallengePage(challenge: string, date: string) {
  const page = await findChallengePage(challenge, date);
  if (page) return page;

  return requireFullPage(
    await notion.pages.create({
      parent: { data_source_id: challengesDataSourceId() },
      properties: {
        [challengeProperties.title]: {
          title: [{ text: { content: challenge } }],
        },
        [challengeProperties.date]: {
          date: { start: date },
        },
      },
    }),
  );
}

export async function findCheckin(
  checkinKey: string,
) {
  const response = await notion.dataSources.query({
    data_source_id: challengeCheckinsDataSourceId(),
    page_size: 1,
    filter: {
      and: [
        {
          property: checkinProperties.checkinKey,
          rich_text: { equals: checkinKey },
        },
        { property: checkinProperties.status, select: { equals: validCheckinStatus } },
      ],
    },
  });

  return response.results.some(isFullPage);
}

async function countParticipationForParticipant(participantId: string) {
  let cursor: string | undefined;
  let count = 0;

  do {
    const response = await notion.dataSources.query({
      data_source_id: challengeCheckinsDataSourceId(),
      page_size: 100,
      start_cursor: cursor,
      filter: {
        and: [
          {
            property: checkinProperties.member,
            relation: { contains: participantId },
          },
          {
            property: checkinProperties.status,
            select: { equals: validCheckinStatus },
          },
        ],
      },
    });

    count += response.results.filter(isFullPage).length;
    cursor = response.next_cursor ?? undefined;
  } while (cursor);

  return count;
}

async function updateMemberParticipationCount(
  participantId: string,
  nextCount?: number | null,
) {
  const count = nextCount ?? (await countParticipationForParticipant(participantId));

  await notion.pages.update({
    page_id: participantId,
    properties: {
      [memberProperties.participationCount]: {
        number: count,
      },
    },
  });
}

export async function createCheckin(input: {
  participantId: string;
  participantName: string;
  challenge: string;
  date: string;
  method?: "QR" | "Manual";
  recordedBy: string;
  currentParticipationCount?: number | null;
}) {
  const challengePage = await ensureChallengePage(input.challenge, input.date);
  const checkinKey = `${input.participantId}:${challengePage.id}:${input.date}`;

  if (await findCheckin(checkinKey)) {
    return { alreadyCheckedIn: true };
  }

  const checkedInAt = new Date().toISOString();

  await notion.pages.create({
    parent: { data_source_id: challengeCheckinsDataSourceId() },
    properties: {
      [checkinProperties.title]: {
        title: [
          {
            text: {
              content: `${input.challenge} - ${input.participantName} - ${input.date}`,
            },
          },
        ],
      },
      [checkinProperties.member]: {
        relation: [{ id: input.participantId }],
      },
      [checkinProperties.challenge]: {
        relation: [{ id: challengePage.id }],
      },
      [checkinProperties.checkinDate]: {
        date: { start: input.date },
      },
      [checkinProperties.checkedInAt]: {
        date: { start: checkedInAt },
      },
      [checkinProperties.recordedBy]: {
        rich_text: [{ text: { content: input.recordedBy } }],
      },
      [checkinProperties.status]: {
        select: { name: validCheckinStatus },
      },
      [checkinProperties.method]: {
        select: { name: input.method ?? "QR" },
      },
      [checkinProperties.checkinKey]: {
        rich_text: [{ text: { content: checkinKey } }],
      },
    },
  });

  await updateMemberParticipationCount(input.participantId);

  return { alreadyCheckedIn: false };
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

    response.results.filter(isFullPage).forEach((page) => {
      const name = title(page, challengeProperties.title).trim();
      if (name) names.add(name);
    });

    cursor = response.next_cursor ?? undefined;
  } while (cursor);

  return [...names];
}

export async function getCheckins(challenge: string, date: string) {
  const challengePage = await findChallengePage(challenge, date);
  if (!challengePage) return [];

  const checkins = [];
  let cursor: string | undefined;

  do {
    const response = await notion.dataSources.query({
      data_source_id: challengeCheckinsDataSourceId(),
      page_size: 100,
      start_cursor: cursor,
      filter: {
        and: [
          {
            property: checkinProperties.challenge,
            relation: { contains: challengePage.id },
          },
          {
            property: checkinProperties.checkinDate,
            date: { equals: date },
          },
          {
            property: checkinProperties.status,
            select: { does_not_equal: cancelledCheckinStatus },
          },
        ],
      },
      sorts: [{ property: checkinProperties.checkedInAt, direction: "ascending" }],
    });

    checkins.push(...response.results.filter(isFullPage));
    cursor = response.next_cursor ?? undefined;
  } while (cursor);

  return Promise.all(
    checkins.map(async (checkin) => {
      const memberId = relationIds(checkin, checkinProperties.member)[0];
      const participant = memberId
        ? requireFullPage(await notion.pages.retrieve({ page_id: memberId }))
        : null;

      return {
        id: checkin.id,
        checked_in_at:
          dateStart(checkin, checkinProperties.checkedInAt) ||
          checkin.created_time,
        method: propertyText(checkin, checkinProperties.method) || "QR",
        recorded_by: richText(checkin, checkinProperties.recordedBy),
        status: propertyText(checkin, checkinProperties.status) || validCheckinStatus,
        participants: participant
          ? {
              name: title(participant, memberProperties.title),
              email: email(participant, memberProperties.email),
            }
          : null,
      };
    }),
  );
}

export async function createPayment(input: {
  participantId: string;
  participantName: string;
  uniqueCode: string;
  amount: number;
  item: string;
  recordedBy: string;
  recordedAt: string;
}) {
  return notion.pages.create({
    parent: { data_source_id: paymentsDataSourceId() },
    properties: {
      [paymentProperties.title]: {
        title: [{ text: { content: input.participantName } }],
      },
      [paymentProperties.uniqueCode]: {
        rich_text: [{ text: { content: input.uniqueCode } }],
      },
      [paymentProperties.item]: {
        rich_text: [{ text: { content: input.item } }],
      },
      [paymentProperties.amount]: {
        rich_text: [{ text: { content: String(input.amount) } }],
      },
      [paymentProperties.recordedBy]: {
        rich_text: [{ text: { content: input.recordedBy } }],
      },
      [paymentProperties.recordedAt]: {
        date: { start: input.recordedAt },
      },
    },
  });
}
