import { NextResponse } from "next/server";
import { auth0 } from "../../../../lib/auth0";

export const dynamic = "force-dynamic";

type TokenDiagnostics = {
  format: "jwt" | "opaque";
  alg?: string;
  kid?: string;
  iss?: string;
  aud?: string | string[];
};

function decodeBase64UrlJson(value: string): unknown {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

function getTokenDiagnostics(token: string): TokenDiagnostics {
  const [headerPart, payloadPart] = token.split(".");

  if (!headerPart || !payloadPart) {
    return { format: "opaque" };
  }

  try {
    const header = decodeBase64UrlJson(headerPart) as { alg?: unknown; kid?: unknown };
    const payload = decodeBase64UrlJson(payloadPart) as { iss?: unknown; aud?: unknown };
    const diagnostics: TokenDiagnostics = { format: "jwt" };

    if (typeof header.alg === "string") {
      diagnostics.alg = header.alg;
    }

    if (typeof header.kid === "string") {
      diagnostics.kid = header.kid;
    }

    if (typeof payload.iss === "string") {
      diagnostics.iss = payload.iss;
    }

    if (typeof payload.aud === "string" || Array.isArray(payload.aud)) {
      diagnostics.aud = payload.aud as string | string[];
    }

    return diagnostics;
  } catch {
    return { format: "opaque" };
  }
}

function safeBackendTarget(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.origin;
  } catch {
    return "invalid-url";
  }
}

export async function GET() {
  const session = await auth0.getSession();

  if (!session) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401 },
    );
  }

  try {
    const { token } = await auth0.getAccessToken();

    if (!token) {
      return NextResponse.json(
        { error: "No se pudo obtener el token de acceso." },
        { status: 401 },
      );
    }

    const backendUrl = process.env.ADPROPIA_API_BASE_URL;
    if (!backendUrl) {
      return NextResponse.json(
        { error: "Configuracion del servidor incompleta." },
        { status: 500 },
      );
    }

    const diagnostics = getTokenDiagnostics(token);
    console.info(
      `auth_me_bridge_request backend_target="${safeBackendTarget(backendUrl)}" token_format="${diagnostics.format}" token_alg="${diagnostics.alg ?? "unknown"}" token_kid="${diagnostics.kid ?? "unknown"}" token_iss="${diagnostics.iss ?? "unknown"}" token_aud="${JSON.stringify(diagnostics.aud ?? "unknown")}"`
    );

    const response = await fetch(`${backendUrl}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.warn(
        `auth_me_bridge_backend_error backend_target="${safeBackendTarget(backendUrl)}" status="${response.status}" token_format="${diagnostics.format}" token_alg="${diagnostics.alg ?? "unknown"}" token_kid="${diagnostics.kid ?? "unknown"}" token_iss="${diagnostics.iss ?? "unknown"}" token_aud="${JSON.stringify(diagnostics.aud ?? "unknown")}"`
      );
      return NextResponse.json(
        { error: "Error del servidor." },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Error de conexion con el servidor." },
      { status: 502 },
    );
  }
}
