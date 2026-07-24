import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

type AuthRole = "owner" | "super_admin" | "admin";

const authCookieName = "pic_auth";

const publicPaths = [
  "/",
  "/login",
  "/api/login",
  "/api/logout",
  "/api/google-form",
  "/favicon.ico",
  "/icon.svg",
  "/manifest.webmanifest",
];

const pageRules: Array<{ prefix: string; roles: AuthRole[] }> = [
  { prefix: "/admin", roles: ["owner", "super_admin"] },
  { prefix: "/scan", roles: ["admin"] },
  { prefix: "/payment", roles: ["admin"] },
  { prefix: "/checkins", roles: ["admin"] },
];

const apiRules: Array<{ prefix: string; roles: AuthRole[] }> = [
  { prefix: "/api/participants", roles: ["owner", "super_admin"] },
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

async function signRole(role: AuthRole) {
  const secret = process.env.APP_AUTH_SECRET || process.env.ADMIN_PASSWORD;
  if (!secret) return "";

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(role)));
}

async function verifyRole(token: string | undefined) {
  if (!token) return null;

  const [role, signature] = token.split(".");
  if (role !== "owner" && role !== "super_admin" && role !== "admin") {
    return null;
  }

  const expected = await signRole(role);
  return expected && signature === expected ? role : null;
}

function allowedRolesFor(pathname: string) {
  const rules = pathname.startsWith("/api/") ? apiRules : pageRules;
  return rules.find((rule) => pathname.startsWith(rule.prefix))?.roles ?? null;
}

function canAccess(role: AuthRole | null, allowedRoles: AuthRole[]) {
  return (
    role === "owner" ||
    role === "super_admin" ||
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

  const role = await verifyRole(request.cookies.get(authCookieName)?.value);
  if (canAccess(role, allowedRoles)) {
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
    "/admin/:path*",
    "/scan/:path*",
    "/payment/:path*",
    "/checkins/:path*",
    "/api/:path*",
  ],
};
