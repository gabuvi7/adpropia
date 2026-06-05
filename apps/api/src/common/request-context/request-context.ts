import type { AuthRole } from "../auth/auth-role";

export type RequestContext = Readonly<{
  requestId: string;
  userId: string;
  tenantId: string;
  role: AuthRole;
}>;
