import { NextResponse } from "next/server";
import { accessRequestSchema } from "@adpropia/shared";
import { parseAccessRequestProxyEnv } from "@/lib/env";

export const runtime = "nodejs";
export const fetchCache = "force-no-store";

const defaultPublicAccessRequestModules = ["RENTALS_AND_CONTRACTS"] as const;

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = accessRequestSchema.safeParse(normalizePublicAccessRequestInput(json));

  if (!parsed.success) {
    return NextResponse.json({ error: "Los datos enviados no son válidos." }, { status: 400 });
  }

  let apiBaseUrl: string;
  try {
    apiBaseUrl = parseAccessRequestProxyEnv(process.env).ADPROPIA_API_BASE_URL;
  } catch {
    return NextResponse.json({ error: "El servidor no está configurado para recibir solicitudes." }, { status: 503 });
  }

  try {
    const backendResponse = await fetch(`${apiBaseUrl}/access-requests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.data)
    });

    const text = await backendResponse.text();
    return new Response(text, {
      status: backendResponse.status,
      headers: { "content-type": backendResponse.headers.get("content-type") ?? "application/json" }
    });
  } catch {
    return NextResponse.json({ error: "No pudimos conectar con el servidor." }, { status: 502 });
  }
}

function normalizePublicAccessRequestInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;

  return {
    ...input,
    selectedModules: defaultPublicAccessRequestModules
  };
}
