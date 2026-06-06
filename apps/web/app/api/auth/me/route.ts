import { NextResponse } from "next/server";
import { auth0 } from "../../../../lib/auth0";

export const dynamic = "force-dynamic";

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

    const response = await fetch(`${backendUrl}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "Unknown error");
      return NextResponse.json(
        { error: "Error del servidor.", detail },
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
