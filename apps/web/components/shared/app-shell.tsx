import type { ReactNode } from "react";

type AppShellProps = Readonly<{
  tenantName: string;
  children: ReactNode;
  userName?: string;
  role?: string;
  logoutUrl?: string;
}>;

export function AppShell({ tenantName, children, userName, role, logoutUrl }: AppShellProps) {
  return (
    <main style={{ minHeight: "100vh", padding: "32px" }}>
      <header style={{ marginBottom: "32px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <strong>{tenantName}</strong>
          <p style={{ color: "var(--muted)", margin: "8px 0 0" }}>Espacio de trabajo con aislamiento por cliente</p>
        </div>
        {userName && (
          <div style={{ textAlign: "right", fontSize: "0.875rem" }}>
            <span>{userName}</span>
            {role && <span style={{ color: "var(--muted)", marginLeft: "8px" }}>({role})</span>}
            {logoutUrl && (
              <>
                {" — "}
                <a href={logoutUrl} style={{ color: "var(--muted)" }}>Salir</a>
              </>
            )}
          </div>
        )}
      </header>
      {children}
    </main>
  );
}
