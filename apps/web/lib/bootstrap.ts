export type BootstrapPayload = {
  userId: string;
  tenantId: string;
  tenantName: string;
  role: string;
};

export async function fetchBootstrap(cookieString: string): Promise<BootstrapPayload | null> {
  const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";

  try {
    const response = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { cookie: cookieString },
      cache: "no-store",
    });

    if (!response.ok) return null;

    return response.json();
  } catch {
    return null;
  }
}
