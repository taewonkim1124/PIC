import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export type AuthRole = "admin" | "scanner" | "payment";

export const authCookieName = "pic_auth";

const rolePasswords: Record<AuthRole, string> = {
  admin: "ADMIN_PASSWORD",
  scanner: "SCANNER_PASSWORD",
  payment: "PAYMENT_PASSWORD",
};

function authSecret() {
  const secret = process.env.APP_AUTH_SECRET || process.env.ADMIN_PASSWORD;
  if (!secret) {
    throw new Error("APP_AUTH_SECRET or ADMIN_PASSWORD is not configured.");
  }
  return secret;
}

function signRole(role: AuthRole) {
  return createHmac("sha256", authSecret()).update(role).digest("hex");
}

export function createAuthToken(role: AuthRole) {
  return `${role}.${signRole(role)}`;
}

export function verifyAuthToken(token: string | undefined) {
  if (!token) return null;

  const [role, signature] = token.split(".");
  if (
    role !== "admin" &&
    role !== "scanner" &&
    role !== "payment"
  ) {
    return null;
  }
  if (!signature) return null;

  const expected = signRole(role);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length) return null;

  return timingSafeEqual(expectedBuffer, actualBuffer) ? role : null;
}

export async function currentRole() {
  const cookieStore = await cookies();
  return verifyAuthToken(cookieStore.get(authCookieName)?.value);
}

export function roleCanAccess(role: AuthRole | null, allowedRoles: AuthRole[]) {
  return role === "admin" || (role !== null && allowedRoles.includes(role));
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
