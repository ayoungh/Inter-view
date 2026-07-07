import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isInterviewerRequest } from "@/lib/auth";

function isProtectedRequest(req: NextRequest): boolean {
  const path = req.nextUrl.pathname;

  if (path === "/") return true;
  if (path.startsWith("/report/")) return true;
  if (path === "/api/sessions") return true;
  if (path.startsWith("/api/sessions/") && req.nextUrl.searchParams.has("key")) {
    return true;
  }

  return false;
}

export function proxy(req: NextRequest) {
  if (!isProtectedRequest(req)) {
    return NextResponse.next();
  }

  if (isInterviewerRequest(req)) {
    return NextResponse.next();
  }

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set(
    "next",
    `${req.nextUrl.pathname}${req.nextUrl.search}`,
  );
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/", "/report/:path*", "/api/sessions", "/api/sessions/:path*"],
};
