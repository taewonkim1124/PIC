import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import {
  authCookieName,
  authSecret,
  createAuthToken,
  verifyAuthToken,
} from "@/lib/authToken";
import type { AuthRole, AuthSession } from "@/lib/authToken";

export { authCookieName, createAuthToken, verifyAuthToken };
export type { AuthRole, AuthSession };

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

function safeCompare(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
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

export function passwordHash(password: string) {
  return createHmac("sha256", authSecret()).update(password).digest("hex");
}

export function validLogin(role: AuthRole, password: string) {
  const envName = rolePasswords[role];
  const expected = process.env[envName];
  return Boolean(expected && password && safeCompare(expected, password));
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
  if (adminUser && safeCompare(adminUser.password, password)) {
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
