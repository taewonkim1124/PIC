export const legacyParticipantsProperty = "참여명단";

export const checkinProperties = {
  title: "Check-in",
  member: "Member",
  challenge: "Challenge",
  checkinDate: "Check-in Date",
  checkedInAt: "Checked In At",
  recordedBy: "Recorded By",
  status: "Status",
  method: "Method",
  checkinKey: "Check-in Key",
};

export const challengeProperties = {
  title: "Challenge Name",
  date: "Date",
  checkins: "Check-ins",
};

export function challengeRelationProperty(
  challengesDataSourceId,
  syncedPropertyId,
) {
  return {
    relation: {
      data_source_id: challengesDataSourceId,
      type: "dual_property",
      dual_property: syncedPropertyId
        ? { synced_property_id: syncedPropertyId }
        : { synced_property_name: challengeProperties.checkins },
    },
  };
}

export function checkinsRelationProperty(
  checkinsDataSourceId,
  syncedPropertyId,
) {
  return {
    relation: {
      data_source_id: checkinsDataSourceId,
      type: "dual_property",
      dual_property: syncedPropertyId
        ? { synced_property_id: syncedPropertyId }
        : { synced_property_name: checkinProperties.challenge },
    },
  };
}

function normalizePropertyId(id) {
  if (!id) return "";

  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
}

export function isDualRelationPair({
  sourceProperty,
  sourceTargetDataSourceId,
  sourceSyncedPropertyId,
  targetProperty,
  targetTargetDataSourceId,
  targetSyncedPropertyId,
}) {
  return (
    sourceProperty?.type === "relation" &&
    targetProperty?.type === "relation" &&
    sourceProperty.relation.data_source_id === sourceTargetDataSourceId &&
    targetProperty.relation.data_source_id === targetTargetDataSourceId &&
    sourceProperty.relation.type === "dual_property" &&
    targetProperty.relation.type === "dual_property" &&
    normalizePropertyId(sourceProperty.relation.dual_property?.synced_property_id) ===
      normalizePropertyId(sourceSyncedPropertyId) &&
    normalizePropertyId(targetProperty.relation.dual_property?.synced_property_id) ===
      normalizePropertyId(targetSyncedPropertyId)
  );
}

export function isFullPage(page) {
  return page && page.object === "page" && "properties" in page;
}

export function title(page, property) {
  const value = page.properties[property];
  return value?.type === "title"
    ? value.title.map((item) => item.plain_text).join("")
    : "";
}

export function richText(page, property) {
  const value = page.properties[property];
  return value?.type === "rich_text"
    ? value.rich_text.map((item) => item.plain_text).join("")
    : "";
}

export function dateStart(page, property) {
  const value = page.properties[property];
  return value?.type === "date" ? value.date?.start ?? "" : "";
}

export function relationIdsFromPageSnapshot(page, property) {
  const value = page.properties[property];
  return value?.type === "relation"
    ? value.relation.map((item) => item.id)
    : [];
}

export function checkinKey(memberId, challengeId, checkinDate) {
  return `${memberId}:${challengeId}:${checkinDate}`;
}

function dateTimePartsInZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  return Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
}

function formatOffset(minutes) {
  const sign = minutes >= 0 ? "+" : "-";
  const absolute = Math.abs(minutes);
  const hours = String(Math.floor(absolute / 60)).padStart(2, "0");
  const mins = String(absolute % 60).padStart(2, "0");

  return `${sign}${hours}:${mins}`;
}

export function zonedDateTimeIso(
  date,
  { timeZone = "America/New_York", hour = 12 } = {},
) {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) {
    throw new Error(`Invalid date: ${date}`);
  }

  const desiredUtc = Date.UTC(year, month - 1, day, hour, 0, 0);
  let instant = new Date(desiredUtc);

  for (let i = 0; i < 3; i += 1) {
    const parts = dateTimePartsInZone(instant, timeZone);
    const actualUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    instant = new Date(instant.getTime() + desiredUtc - actualUtc);
  }

  const offsetMinutes = Math.round((desiredUtc - instant.getTime()) / 60000);

  return `${date}T${String(hour).padStart(2, "0")}:00:00${formatOffset(
    offsetMinutes,
  )}`;
}

export async function collectPaginatedQuery(queryFn, baseArgs) {
  const results = [];
  let cursor;

  do {
    const response = await queryFn({
      ...baseArgs,
      page_size: baseArgs.page_size ?? 100,
      start_cursor: cursor,
    });

    results.push(...(response.results ?? []));
    cursor = response.next_cursor ?? undefined;
  } while (cursor);

  return results;
}

function relationIdFromPropertyItem(item) {
  if (item?.type === "relation") {
    return item.relation?.id ?? null;
  }

  if (item?.object === "property_item" && item.relation?.id) {
    return item.relation.id;
  }

  return null;
}

export async function collectRelationPropertyIds(
  notion,
  pageId,
  propertyId,
  fallbackIds = [],
) {
  if (!propertyId) return fallbackIds;

  const ids = [];
  let cursor;

  do {
    const response = await notion.pages.properties.retrieve({
      page_id: pageId,
      property_id: propertyId,
      page_size: 100,
      start_cursor: cursor,
    });

    if (Array.isArray(response.results)) {
      for (const item of response.results) {
        const id = relationIdFromPropertyItem(item);
        if (id) ids.push(id);
      }
    } else {
      const id = relationIdFromPropertyItem(response);
      if (id) ids.push(id);
    }

    cursor = response.next_cursor ?? undefined;
  } while (cursor);

  return ids.length ? Array.from(new Set(ids)) : fallbackIds;
}

export async function collectExistingValidCheckinKeys(notion, checkinsDataSourceId) {
  const pages = await collectPaginatedQuery(notion.dataSources.query.bind(notion.dataSources), {
    data_source_id: checkinsDataSourceId,
    filter: {
      property: checkinProperties.status,
      select: { equals: "Valid" },
    },
  });

  return new Set(
    pages
      .filter(isFullPage)
      .map((page) => richText(page, checkinProperties.checkinKey).trim())
      .filter(Boolean),
  );
}

export async function planLegacyChallengeMigration({
  notion,
  challengesDataSourceId,
  checkinsDataSourceId,
}) {
  const challenges = await collectPaginatedQuery(
    notion.dataSources.query.bind(notion.dataSources),
    { data_source_id: challengesDataSourceId },
  );
  const existingValidKeys = await collectExistingValidCheckinKeys(
    notion,
    checkinsDataSourceId,
  );
  const creates = [];
  let skipped = 0;
  let missingDate = 0;
  let missingRelation = 0;
  let relationReadErrors = 0;
  let totalRelationMemberCount = 0;

  for (const challenge of challenges.filter(isFullPage)) {
    const challengeName = title(challenge, challengeProperties.title) || "Challenge";
    const date = dateStart(challenge, challengeProperties.date);
    const relationProperty = challenge.properties[legacyParticipantsProperty];

    if (!date) {
      missingDate += 1;
      continue;
    }

    if (!relationProperty || relationProperty.type !== "relation") {
      missingRelation += 1;
      continue;
    }

    const fallbackIds = relationIdsFromPageSnapshot(
      challenge,
      legacyParticipantsProperty,
    );
    let memberIds;

    try {
      memberIds = await collectRelationPropertyIds(
        notion,
        challenge.id,
        relationProperty.id,
        fallbackIds,
      );
    } catch {
      relationReadErrors += 1;
      continue;
    }

    totalRelationMemberCount += memberIds.length;

    for (const memberId of memberIds) {
      const key = checkinKey(memberId, challenge.id, date);
      if (existingValidKeys.has(key)) {
        skipped += 1;
        continue;
      }

      creates.push({
        key,
        memberId,
        challengeId: challenge.id,
        challengeName,
        checkinDate: date,
      });
      existingValidKeys.add(key);
    }
  }

  return {
    creates,
    skipped,
    missingDate,
    missingRelation,
    relationReadErrors,
    totalRelationMemberCount,
    challengeCount: challenges.filter(isFullPage).length,
  };
}

export function legacyCheckinPageProperties(planItem) {
  return {
    [checkinProperties.title]: {
      title: [
        {
          text: {
            content: `${planItem.challengeName} - legacy - ${planItem.checkinDate}`,
          },
        },
      ],
    },
    [checkinProperties.member]: { relation: [{ id: planItem.memberId }] },
    [checkinProperties.challenge]: { relation: [{ id: planItem.challengeId }] },
    [checkinProperties.checkinDate]: { date: { start: planItem.checkinDate } },
    [checkinProperties.checkedInAt]: {
      date: { start: zonedDateTimeIso(planItem.checkinDate) },
    },
    [checkinProperties.recordedBy]: {
      rich_text: [{ text: { content: "Legacy Migration" } }],
    },
    [checkinProperties.status]: { select: { name: "Valid" } },
    [checkinProperties.method]: { select: { name: "Manual" } },
    [checkinProperties.checkinKey]: {
      rich_text: [{ text: { content: planItem.key } }],
    },
  };
}
