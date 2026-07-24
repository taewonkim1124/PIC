import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export type AuthRole = "owner" | "admin";
export type AuthSession = {
  role: AuthRole;
  username: string;
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

function safeUsername(username: string) {
  return username.trim().toLowerCase().replaceAll(".", "_");
}

export function createAuthToken(role: AuthRole, username: string) {
  const safeName = safeUsername(username);
  const payload = `${role}.${safeName}`;
  return `${payload}.${signPayload(payload)}`;
}

export function verifyAuthToken(token: string | undefined): AuthSession | null {
  if (!token) return null;

  const [role, username, signature] = token.split(".");
  if (!isRole(role) || !username) {
    return null;
  }
  if (!signature) return null;

  const expected = signPayload(`${role}.${username}`);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length) return null;

  return timingSafeEqual(expectedBuffer, actualBuffer) ? { role, username } : null;
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

export function roleForUsername(username: string) {
  const normalized = username.trim().toLowerCase();

  for (const role of Object.keys(roleUsernames) as AuthRole[]) {
    const { envName, fallback } = roleUsernames[role];
    const expected = (process.env[envName] || fallback).trim().toLowerCase();
    if (normalized && normalized === expected) {
      return role;
    }
  }

  return null;
}
