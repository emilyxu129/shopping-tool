import { AUTH_COOKIE_NAME, createAuthToken } from "../../../../lib/auth-token";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request) {
  const appPassword = process.env.APP_PASSWORD;

  if (!appPassword) {
    return NextResponse.json(
      { error: "APP_PASSWORD is not configured." },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => ({}));

  if (body.password !== appPassword) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const token = await createAuthToken(appPassword);
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
