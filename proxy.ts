import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { authCookieName, verifyAuthToken } from "@/lib/authToken";
import type { AuthRole } from "@/lib/authToken";

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

  const session = await verifyAuthToken(request.cookies.get(authCookieName)?.value);
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
