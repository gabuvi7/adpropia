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
    <main className="min-h-screen p-8">
      <header className="mb-8 flex justify-between items-start">
        <div>
          <strong>{tenantName}</strong>
          <p className="text-muted-foreground mt-2">Espacio de trabajo con aislamiento por cliente</p>
        </div>
        {userName && (
          <div className="text-right text-sm">
            <span>{userName}</span>
            {role && <span className="text-muted-foreground ml-2">({role})</span>}
            {logoutUrl && (
              <>
                {" — "}
                <a href={logoutUrl} className="text-muted-foreground hover:text-foreground transition-colors">Salir</a>
              </>
            )}
          </div>
        )}
      </header>
      {children}
    </main>
  );
}
