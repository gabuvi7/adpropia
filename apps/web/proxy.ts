import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth0 } from "./lib/auth0";
import { requireSession } from "./lib/auth-guard";

export async function proxy(request: NextRequest) {
  const authRes = await auth0.middleware(request);
  const session = await auth0.getSession(request);
  const guardResult = requireSession(request, session);
  if (guardResult) return guardResult;
  return authRes;
}

export const config = {
  matcher: ["/dashboard/:path*", "/owners/:path*", "/renters/:path*", "/properties/:path*", "/contracts/:path*", "/payments/:path*"]
};
