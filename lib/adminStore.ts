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
  id: string;
  username: string;
  displayName: string;
  passwordHash: string;
  active: boolean;
};

function adminsDataSourceId() {
  const dataSourceId = process.env.NOTION_ADMINS_DATA_SOURCE_ID;
  if (!dataSourceId) {
    throw new Error("NOTION_ADMINS_DATA_SOURCE_ID is not configured.");
  }
  return dataSourceId;
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
  const displayName = title(page, adminProperties.title).trim();
  const username = richText(page, adminProperties.username).trim().toLowerCase();
  const storedHash = richText(page, adminProperties.passwordHash).trim();

  if (!displayName || !username || !storedHash) return null;

  return {
    id: page.id,
    displayName,
    username,
    passwordHash: storedHash,
    active: canAdminLogin(page),
  };
}

async function findAdminPageByUsername(username: string) {
  const normalizedUsername = username.trim().toLowerCase();
  if (!normalizedUsername) return null;

  const response = await notion.dataSources.query({
    data_source_id: adminsDataSourceId(),
    page_size: 1,
    filter: {
      property: adminProperties.username,
      rich_text: { equals: normalizedUsername },
    },
  });

  return response.results.find(isFullPage) ?? null;
}

export async function findNotionAdminLogin(username: string, password: string) {
  const normalizedUsername = username.trim().toLowerCase();
  if (!normalizedUsername || !password || !process.env.NOTION_ADMINS_DATA_SOURCE_ID) {
    return null;
  }

  const page = await findAdminPageByUsername(normalizedUsername);
  if (!page) return null;

  const admin = adminFromPage(page);
  if (!admin || !admin.active) return null;

  const attemptedHash = passwordHash(password);
  if (!safeCompare(admin.passwordHash, attemptedHash)) return null;

  return {
    role: "admin" as const,
    username: admin.username,
    displayName: admin.displayName,
  };
}

export async function changeAdminPassword(input: {
  username: string;
  currentPassword: string;
  nextPassword: string;
}) {
  const page = await findAdminPageByUsername(input.username);
  if (!page) {
    throw new Error("Admin account was not found.");
  }

  const admin = adminFromPage(page);
  if (!admin || !admin.active) {
    throw new Error("This admin account is not active.");
  }

  const currentHash = passwordHash(input.currentPassword);
  if (!safeCompare(admin.passwordHash, currentHash)) {
    throw new Error("Current password is incorrect.");
  }

  await notion.pages.update({
    page_id: admin.id,
    properties: {
      [adminProperties.passwordHash]: {
        rich_text: [{ text: { content: passwordHash(input.nextPassword) } }],
      },
    },
  });
}
