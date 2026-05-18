import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session";

export async function proxy(req: NextRequest) {
  const res = NextResponse.next();
  const session = await getIronSession<SessionData>(req, res, sessionOptions);

  const { pathname } = req.nextUrl;
  const isLoginPath = pathname === "/login";
  const isApiAuth = pathname.startsWith("/api/auth");

  if (isLoginPath || isApiAuth) {
    if (isLoginPath && session.isLoggedIn) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return res;
  }

  if (!session.isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|login).*)"],
};
