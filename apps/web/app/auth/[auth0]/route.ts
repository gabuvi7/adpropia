import { auth0 } from "../../../lib/auth0";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  if (request.nextUrl.pathname === "/auth/login") {
    const session = await auth0.getSession(request);

    if (session) {
      return NextResponse.redirect(new URL("/dashboard", request.nextUrl.origin));
    }
  }

  return auth0.middleware(request);
}

export async function POST(request: NextRequest) {
  return auth0.middleware(request);
}
