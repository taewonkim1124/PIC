import "server-only";

import { timingSafeEqual } from "node:crypto";
import { isFullPage } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

import { notion } from "@/lib/notion";
import { passwordHash } from "@/lib/auth";

const adminProperties = {
  title: "Name",
  username: "Username",
  passwordHash: "Password Hash",
  active: "Active",
} as const;

const activeStatusProperties = ["활동중", "Status", "상태", "Active"] as const;
const allowedActiveStatuses = new Set([
  "활동중",
  "재직",
  "현직",
  "active",
  "current",
  "employed",
]);

type NotionAdminUser = {
  username: string;
  displayName: string;
  passwordHash: string;
};

function adminsDataSourceId() {
  return process.env.NOTION_ADMINS_DATA_SOURCE_ID;
}

function title(page: PageObjectResponse, property: string) {
  const value = page.properties[property];
  return value?.type === "title"
    ? value.title.map((item) => item.plain_text).join("")
    : "";
}

function richText(page: PageObjectResponse, property: string) {
  const value = page.properties[property];
  return value?.type === "rich_text"
    ? value.rich_text.map((item) => item.plain_text).join("")
    : "";
}

function checkbox(page: PageObjectResponse, property: string) {
  const value = page.properties[property];
  return value?.type === "checkbox" ? value.checkbox : false;
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

function isAllowedActiveStatus(status: string) {
  return allowedActiveStatuses.has(status.trim().toLowerCase());
}

function canAdminLogin(page: PageObjectResponse) {
  if (checkbox(page, adminProperties.active)) return true;

  return activeStatusProperties.some((property) =>
    isAllowedActiveStatus(propertyText(page, property)),
  );
}

function safeCompare(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
}

function adminFromPage(page: PageObjectResponse): NotionAdminUser | null {
  if (!canAdminLogin(page)) return null;

  const displayName = title(page, adminProperties.title).trim();
  const username = richText(page, adminProperties.username).trim().toLowerCase();
  const storedHash = richText(page, adminProperties.passwordHash).trim();

  if (!displayName || !username || !storedHash) return null;

  return {
    displayName,
    username,
    passwordHash: storedHash,
  };
}

export async function findNotionAdminLogin(username: string, password: string) {
  const dataSourceId = adminsDataSourceId();
  const normalizedUsername = username.trim().toLowerCase();
  if (!dataSourceId || !normalizedUsername || !password) return null;

  const response = await notion.dataSources.query({
    data_source_id: dataSourceId,
    page_size: 1,
    filter: {
      property: adminProperties.username,
      rich_text: { equals: normalizedUsername },
    },
  });

  const page = response.results.find(isFullPage);
  if (!page) return null;

  const admin = adminFromPage(page);
  if (!admin) return null;

  const attemptedHash = passwordHash(password);
  if (!safeCompare(admin.passwordHash, attemptedHash)) return null;

  return {
    role: "admin" as const,
    username: admin.username,
    displayName: admin.displayName,
  };
}
