import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export type AuthSession = { user: { sub: string } } | null;

export function requireSession(
  request: NextRequest,
  session: AuthSession,
): NextResponse<unknown> | null {
  if (!session) {
    return NextResponse.redirect(new URL("/auth/login", request.nextUrl.origin));
  }
  return null;
}
