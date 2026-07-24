import { NextResponse } from "next/server";

import {
  authCookieName,
  createAuthToken,
  type AuthRole,
  validLogin,
} from "@/lib/auth";

type LoginBody = {
  role?: unknown;
  password?: unknown;
};

function isRole(value: unknown): value is AuthRole {
  return value === "admin" || value === "scanner" || value === "payment";
}

export async function POST(request: Request) {
  let body: LoginBody;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const role = body.role;
  const password = typeof body.password === "string" ? body.password : "";

  if (!isRole(role) || !validLogin(role, password)) {
    return Response.json({ error: "Invalid role or password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, role });
  response.cookies.set(authCookieName, createAuthToken(role), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}
