import { NextResponse } from "next/server";

import {
  authCookieName,
  createAuthToken,
  findLoginSession,
} from "@/lib/auth";
import { findNotionAdminLogin } from "@/lib/adminStore";
import {
  clearLoginFailures,
  isLoginRateLimited,
  loginRateLimitKey,
  recordLoginFailure,
} from "@/lib/loginRateLimit";

type LoginBody = {
  username?: unknown;
  password?: unknown;
};

export async function POST(request: Request) {
  let body: LoginBody;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";
  const rateLimitKey = loginRateLimitKey(request, username);

  if (isLoginRateLimited(rateLimitKey)) {
    return Response.json(
      { error: "Too many failed attempts. Please try again later." },
      { status: 429 },
    );
  }

  const session =
    (await findNotionAdminLogin(username, password)) ||
    findLoginSession(username, password);

  if (!session) {
    recordLoginFailure(rateLimitKey);
    return Response.json({ error: "Invalid username or password." }, { status: 401 });
  }

  clearLoginFailures(rateLimitKey);

  const response = NextResponse.json({
    ok: true,
    role: session.role,
    displayName: session.displayName,
  });
  response.cookies.set(authCookieName, await createAuthToken(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}
