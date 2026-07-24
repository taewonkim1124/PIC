import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

type AuthRole = "owner" | "admin";
type AuthSession = {
  role: AuthRole;
  username: string;
  displayName: string;
};

const authCookieName = "pic_auth";

const publicPaths = [
  "/login",
  "/api/login",
  "/api/logout",
  "/api/google-form",
  "/favicon.ico",
  "/icon.svg",
  "/manifest.webmanifest",
];

const pageRules: Array<{ prefix: string; roles: AuthRole[] }> = [
  { prefix: "/admin", roles: ["admin"] },
  { prefix: "/account", roles: ["admin"] },
  { prefix: "/scan", roles: ["admin"] },
  { prefix: "/payment", roles: ["admin"] },
  { prefix: "/checkins", roles: ["admin"] },
  { prefix: "/", roles: ["admin"] },
];

const apiRules: Array<{ prefix: string; roles: AuthRole[] }> = [
  { prefix: "/api/participants", roles: ["admin"] },
  { prefix: "/api/account", roles: ["admin"] },
  { prefix: "/api/checkin", roles: ["admin"] },
  { prefix: "/api/checkins", roles: ["admin"] },
  { prefix: "/api/challenges", roles: ["admin"] },
  { prefix: "/api/payments", roles: ["admin"] },
];

function isPublicPath(pathname: string) {
  return publicPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

function hex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function decodeBase64Url(value: string) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  return atob(padded);
}

async function signPayload(payload: string) {
  const secret = process.env.APP_AUTH_SECRET || process.env.ADMIN_PASSWORD;
  if (!secret) return "";

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
}

async function verifySession(token: string | undefined): Promise<AuthSession | null> {
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = await signPayload(payload);
  if (!expected || signature !== expected) return null;

  try {
    const decoded = JSON.parse(decodeBase64Url(payload)) as Partial<AuthSession>;
    if (
      (decoded.role !== "owner" && decoded.role !== "admin") ||
      !decoded.username ||
      !decoded.displayName
    ) {
      return null;
    }

    return {
      role: decoded.role,
      username: decoded.username,
      displayName: decoded.displayName,
    };
  } catch {
    return null;
  }
}

function allowedRolesFor(pathname: string) {
  const rules = pathname.startsWith("/api/") ? apiRules : pageRules;
  return rules.find((rule) => pathname.startsWith(rule.prefix))?.roles ?? null;
}

function canAccess(role: AuthRole | null, allowedRoles: AuthRole[]) {
  return (
    role === "owner" ||
    (role !== null && allowedRoles.includes(role))
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname) || pathname.startsWith("/_next/")) {
    return NextResponse.next();
  }

  const allowedRoles = allowedRolesFor(pathname);
  if (!allowedRoles) return NextResponse.next();

  const session = await verifySession(request.cookies.get(authCookieName)?.value);
  if (canAccess(session?.role ?? null, allowedRoles)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/",
    "/admin/:path*",
    "/account/:path*",
    "/scan/:path*",
    "/payment/:path*",
    "/checkins/:path*",
    "/api/:path*",
  ],
};
