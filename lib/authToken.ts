// Session token signing/verification, shared between Node route handlers
// (lib/auth.ts) and the Edge-compatible proxy.ts middleware. Only Web Crypto
// (crypto.subtle, atob/btoa, TextEncoder) is used here so this module works
// unmodified in both runtimes.

export type AuthRole = "owner" | "admin";
export type AuthSession = {
  role: AuthRole;
  username: string;
  displayName: string;
};

export const authCookieName = "pic_auth";

export function authSecret() {
  const secret = process.env.APP_AUTH_SECRET || process.env.ADMIN_PASSWORD;
  if (!secret) {
    throw new Error("APP_AUTH_SECRET or ADMIN_PASSWORD is not configured.");
  }
  return secret;
}

function isRole(value: string): value is AuthRole {
  return value === "owner" || value === "admin";
}

function toHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function encodeBase64Url(payload: string) {
  const bytes = new TextEncoder().encode(payload);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decodeBase64Url(value: string) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  return atob(padded);
}

async function hmacSha256Hex(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
}

function timingSafeStringEqual(a: string, b: string) {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;

  let diff = 0;
  for (let index = 0; index < aBytes.length; index += 1) {
    diff |= aBytes[index] ^ bBytes[index];
  }
  return diff === 0;
}

function encodePayload(session: AuthSession) {
  return encodeBase64Url(JSON.stringify(session));
}

function decodePayload(payload: string): AuthSession | null {
  try {
    const session = JSON.parse(decodeBase64Url(payload)) as Partial<AuthSession>;

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

export async function createAuthToken(session: AuthSession) {
  const payload = encodePayload(session);
  return `${payload}.${await hmacSha256Hex(authSecret(), payload)}`;
}

export async function verifyAuthToken(
  token: string | undefined,
): Promise<AuthSession | null> {
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  // Fail closed (unauthenticated) rather than throw when the secret is
  // missing, since this runs on every request in both the proxy and route
  // handlers.
  const secret = process.env.APP_AUTH_SECRET || process.env.ADMIN_PASSWORD;
  if (!secret) return null;

  const expected = await hmacSha256Hex(secret, payload);
  if (!timingSafeStringEqual(expected, signature)) return null;

  return decodePayload(payload);
}
