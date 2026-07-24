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

export function challengeRelationProperty(challengesDataSourceId) {
  return {
    relation: {
      data_source_id: challengesDataSourceId,
      type: "dual_property",
      dual_property: {
        synced_property_name: challengeProperties.checkins,
      },
    },
  };
}

export function checkinsRelationProperty(checkinsDataSourceId) {
  return {
    relation: {
      data_source_id: checkinsDataSourceId,
      type: "dual_property",
      dual_property: {
        synced_property_name: checkinProperties.challenge,
      },
    },
  };
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

  for (const challenge of challenges.filter(isFullPage)) {
    const challengeName = title(challenge, challengeProperties.title) || "Challenge";
    const date = dateStart(challenge, challengeProperties.date);
    const relationProperty = challenge.properties[legacyParticipantsProperty];

    if (!date) {
      missingDate += 1;
      continue;
    }

    const fallbackIds = relationIdsFromPageSnapshot(
      challenge,
      legacyParticipantsProperty,
    );
    const memberIds = await collectRelationPropertyIds(
      notion,
      challenge.id,
      relationProperty?.id,
      fallbackIds,
    );

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
      date: { start: `${planItem.checkinDate}T12:00:00-04:00` },
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
