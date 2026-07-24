import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export type AuthRole = "owner" | "admin";
export type AuthSession = {
  role: AuthRole;
  username: string;
  displayName: string;
};

export const authCookieName = "pic_auth";

const rolePasswords: Record<AuthRole, string> = {
  owner: "OWNER_PASSWORD",
  admin: "ADMIN_PASSWORD",
};

const roleUsernames: Record<AuthRole, { envName: string; fallback: string }> = {
  owner: { envName: "OWNER_USERNAME", fallback: "owner" },
  admin: { envName: "ADMIN_USERNAME", fallback: "admin" },
};

type AdminUser = {
  username: string;
  password: string;
  name: string;
};

function authSecret() {
  const secret = process.env.APP_AUTH_SECRET || process.env.ADMIN_PASSWORD;
  if (!secret) {
    throw new Error("APP_AUTH_SECRET or ADMIN_PASSWORD is not configured.");
  }
  return secret;
}

function isRole(value: string): value is AuthRole {
  return value === "owner" || value === "admin";
}

function signPayload(payload: string) {
  return createHmac("sha256", authSecret()).update(payload).digest("hex");
}

function encodePayload(session: AuthSession) {
  return Buffer.from(JSON.stringify(session)).toString("base64url");
}

function decodePayload(payload: string): AuthSession | null {
  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Partial<AuthSession>;

    if (
      !session.role ||
      !isRole(session.role) ||
      !session.username ||
      !session.displayName
    ) {
      return null;
    }

    return {
      role: session.role,
      username: session.username,
      displayName: session.displayName,
    };
  } catch {
    return null;
  }
}

export function createAuthToken(session: AuthSession) {
  const payload = encodePayload(session);
  return `${payload}.${signPayload(payload)}`;
}

export function verifyAuthToken(token: string | undefined): AuthSession | null {
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!signature) return null;

  const expected = signPayload(payload);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length) return null;

  return timingSafeEqual(expectedBuffer, actualBuffer)
    ? decodePayload(payload)
    : null;
}

export async function currentSession() {
  const cookieStore = await cookies();
  return verifyAuthToken(cookieStore.get(authCookieName)?.value);
}

export async function currentRole() {
  return (await currentSession())?.role ?? null;
}

export function roleCanAccess(role: AuthRole | null, allowedRoles: AuthRole[]) {
  return (
    role === "owner" ||
    (role !== null && allowedRoles.includes(role))
  );
}

export async function requireRole(allowedRoles: AuthRole[]) {
  const role = await currentRole();
  if (!roleCanAccess(role, allowedRoles)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export function validLogin(role: AuthRole, password: string) {
  const envName = rolePasswords[role];
  const expected = process.env[envName];
  return Boolean(expected && password && expected === password);
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function parseAdminUsers() {
  const raw = process.env.ADMIN_USERS;
  if (!raw) return [];

  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return [];

    return value.flatMap((item): AdminUser[] => {
      if (
        !item ||
        typeof item !== "object" ||
        !("username" in item) ||
        !("password" in item)
      ) {
        return [];
      }

      const username = String(item.username).trim();
      const password = String(item.password);
      const name =
        "name" in item && typeof item.name === "string" && item.name.trim()
          ? item.name.trim()
          : username;

      return username && password ? [{ username, password, name }] : [];
    });
  } catch {
    return [];
  }
}

export function roleForUsername(username: string) {
  const normalized = normalizeUsername(username);

  for (const role of Object.keys(roleUsernames) as AuthRole[]) {
    const { envName, fallback } = roleUsernames[role];
    const expected = (process.env[envName] || fallback).trim().toLowerCase();
    if (normalized && normalized === expected) {
      return role;
    }
  }

  return null;
}

export function findLoginSession(username: string, password: string) {
  const normalized = normalizeUsername(username);
  const role = roleForUsername(username);

  if (role === "owner" && validLogin(role, password)) {
    return {
      role,
      username: normalized,
      displayName: process.env.OWNER_DISPLAY_NAME || username.trim(),
    };
  }

  const adminUser = parseAdminUsers().find(
    (user) => normalizeUsername(user.username) === normalized,
  );
  if (adminUser && adminUser.password === password) {
    return {
      role: "admin",
      username: normalizeUsername(adminUser.username),
      displayName: adminUser.name,
    } satisfies AuthSession;
  }

  if (role === "admin" && validLogin(role, password)) {
    return {
      role,
      username: normalized,
      displayName: process.env.ADMIN_DISPLAY_NAME || username.trim(),
    } satisfies AuthSession;
  }

  return null;
}
