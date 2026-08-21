import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, createAuthToken } from "./lib/auth-token";

const PUBLIC_PATH_PREFIXES = [
  "/_next",
  "/favicon",
  "/robots.txt",
  "/sitemap.xml",
  "/api/auth/login",
  "/api/auth/logout",
];

function isPublicPath(pathname) {
  return (
    pathname === "/login" ||
    PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const appPassword = process.env.APP_PASSWORD;
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);

  if (!appPassword) {
    return NextResponse.redirect(loginUrl);
  }

  const expectedToken = await createAuthToken(appPassword);
  const currentToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (currentToken !== expectedToken) {
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};
