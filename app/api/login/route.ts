import { NextResponse } from "next/server";

import {
  authCookieName,
  createAuthToken,
  findLoginSession,
} from "@/lib/auth";

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
  const session = findLoginSession(username, password);

  if (!session) {
    return Response.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const response = NextResponse.json({
    ok: true,
    role: session.role,
    displayName: session.displayName,
  });
  response.cookies.set(authCookieName, createAuthToken(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}
