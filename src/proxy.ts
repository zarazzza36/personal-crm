import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth/auth";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (
    path === "/login" ||
    path.startsWith("/login/") ||
    path === "/health" ||
    path.startsWith("/api/auth/") ||
    path === "/opengraph-image.png"
  )
    return NextResponse.next();
  const result = await auth.api.getSession({ headers: request.headers, returnHeaders: true });
  if (!result.response) return NextResponse.redirect(new URL("/login", request.url));
  const response = NextResponse.next();
  for (const cookie of result.headers.getSetCookie()) response.headers.append("set-cookie", cookie);
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
