import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  challengeRelationProperty,
  checkinKey,
  checkinProperties,
  checkinsRelationProperty,
  collectPaginatedQuery,
  collectRelationPropertyIds,
  planLegacyChallengeMigration,
} from "../scripts/lib/checkin-migration-utils.mjs";

function page(id, properties) {
  return {
    object: "page",
    id,
    properties,
  };
}

function titleProperty(id, text) {
  return {
    id,
    type: "title",
    title: [{ plain_text: text }],
  };
}

function dateProperty(id, start) {
  return {
    id,
    type: "date",
    date: { start },
  };
}

function relationProperty(id, ids = []) {
  return {
    id,
    type: "relation",
    relation: ids.map((relationId) => ({ id: relationId })),
  };
}

function richTextProperty(id, text) {
  return {
    id,
    type: "rich_text",
    rich_text: [{ plain_text: text }],
  };
}

describe("check-in migration utilities", () => {
  it("creates a dual Challenge relation that syncs back to Check-ins", () => {
    assert.deepEqual(challengeRelationProperty("challenges-ds"), {
      relation: {
        data_source_id: "challenges-ds",
        type: "dual_property",
        dual_property: {
          synced_property_name: "Check-ins",
        },
      },
    });
  });

  it("creates the reciprocal Check-ins relation configuration", () => {
    assert.deepEqual(checkinsRelationProperty("checkins-ds"), {
      relation: {
        data_source_id: "checkins-ds",
        type: "dual_property",
        dual_property: {
          synced_property_name: checkinProperties.challenge,
        },
      },
    });
  });

  it("follows data source pagination until the cursor ends", async () => {
    const cursors = [];
    const results = await collectPaginatedQuery(async (args) => {
      cursors.push(args.start_cursor);
      if (!args.start_cursor) {
        return { results: ["a"], next_cursor: "cursor-1" };
      }
      if (args.start_cursor === "cursor-1") {
        return { results: ["b"], next_cursor: "cursor-2" };
      }
      return { results: ["c"], next_cursor: null };
    }, {});

    assert.deepEqual(results, ["a", "b", "c"]);
    assert.deepEqual(cursors, [undefined, "cursor-1", "cursor-2"]);
  });

  it("reads every relation item through property pagination", async () => {
    const firstBatch = Array.from({ length: 100 }, (_, index) => ({
      type: "relation",
      relation: { id: `member-${index}` },
    }));
    const secondBatch = Array.from({ length: 50 }, (_, index) => ({
      type: "relation",
      relation: { id: `member-${index + 100}` },
    }));
    const calls = [];
    const notion = {
      pages: {
        properties: {
          retrieve: async (args) => {
            calls.push(args.start_cursor);
            if (!args.start_cursor) {
              return { results: firstBatch, next_cursor: "next" };
            }
            return { results: secondBatch, next_cursor: null };
          },
        },
      },
    };

    const ids = await collectRelationPropertyIds(notion, "challenge-page", "prop-id");

    assert.equal(ids.length, 150);
    assert.equal(ids.at(0), "member-0");
    assert.equal(ids.at(-1), "member-149");
    assert.deepEqual(calls, [undefined, "next"]);
  });

  it("plans an idempotent migration and skips existing valid check-ins", async () => {
    const date = "2026-07-24";
    const existingKey = checkinKey("member-1", "challenge-1", date);
    const challengePage = page("challenge-1", {
      "Challenge Name": titleProperty("title-id", "QR 자동 테스트"),
      Date: dateProperty("date-id", date),
      참여명단: relationProperty("participants-prop"),
    });
    const relationIds = [
      "member-0",
      "member-1",
      ...Array.from({ length: 101 }, (_, index) => `member-extra-${index}`),
      "member-0",
    ];
    const checkinPage = page("checkin-1", {
      "Check-in Key": richTextProperty("key-id", existingKey),
    });
    let queryCount = 0;
    const notion = {
      dataSources: {
        query: async (args) => {
          queryCount += 1;
          if (args.data_source_id === "challenges-ds") {
            return { results: [challengePage], next_cursor: null };
          }
          assert.equal(args.filter.property, "Status");
          assert.deepEqual(args.filter.select, { equals: "Valid" });
          return { results: [checkinPage], next_cursor: null };
        },
      },
      pages: {
        properties: {
          retrieve: async () => ({
            results: relationIds.map((id) => ({
              type: "relation",
              relation: { id },
            })),
            next_cursor: null,
          }),
        },
      },
    };

    const plan = await planLegacyChallengeMigration({
      notion,
      challengesDataSourceId: "challenges-ds",
      checkinsDataSourceId: "checkins-ds",
    });

    assert.equal(queryCount, 2);
    assert.equal(plan.skipped, 1);
    assert.equal(plan.creates.length, 102);
    assert.equal(new Set(plan.creates.map((item) => item.key)).size, 102);
    assert.ok(!plan.creates.some((item) => item.key === existingKey));
  });

  it("does not let Cancelled records block migration duplicates", async () => {
    const date = "2026-07-24";
    const challengePage = page("challenge-1", {
      "Challenge Name": titleProperty("title-id", "QR 자동 테스트"),
      Date: dateProperty("date-id", date),
      참여명단: relationProperty("participants-prop", ["member-1"]),
    });
    const notion = {
      dataSources: {
        query: async (args) => {
          if (args.data_source_id === "challenges-ds") {
            return { results: [challengePage], next_cursor: null };
          }
          assert.equal(args.filter.property, "Status");
          assert.deepEqual(args.filter.select, { equals: "Valid" });
          return { results: [], next_cursor: null };
        },
      },
      pages: {
        properties: {
          retrieve: async () => ({
            results: [{ type: "relation", relation: { id: "member-1" } }],
            next_cursor: null,
          }),
        },
      },
    };

    const plan = await planLegacyChallengeMigration({
      notion,
      challengesDataSourceId: "challenges-ds",
      checkinsDataSourceId: "checkins-ds",
    });

    assert.equal(plan.skipped, 0);
    assert.equal(plan.creates.length, 1);
  });
});
