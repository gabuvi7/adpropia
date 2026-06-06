import { cookies } from "next/headers";
import { DashboardSummary } from "../../components/dashboard/dashboard-summary";
import { AppShell } from "../../components/shared/app-shell";
import { fetchBootstrap } from "../../lib/bootstrap";
import { auth0 } from "../../lib/auth0";

export default async function DashboardPage() {
  const session = await auth0.getSession();
  const userName = session?.user?.name ?? session?.user?.email;

  const cookieStore = await cookies();
  const bootstrap = await fetchBootstrap(cookieStore.toString());

  const appShellProps: {
    tenantName: string;
    userName?: string;
    role?: string;
    logoutUrl?: string;
  } = {
    tenantName: bootstrap?.tenantName ?? "AdPropIA",
    logoutUrl: "/auth/logout",
  };
  if (userName) appShellProps.userName = userName;
  if (bootstrap?.role) appShellProps.role = bootstrap.role;

  return (
    <AppShell {...appShellProps}>
      <DashboardSummary />
    </AppShell>
  );
}
