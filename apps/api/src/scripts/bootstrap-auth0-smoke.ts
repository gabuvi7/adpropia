import { PrismaClient } from "@adpropia/database";
import { pathToFileURL } from "node:url";
import { tenantAuthRoles, type AuthRole } from "../common/auth/auth-role";

type Env = Record<string, string | undefined>;

export type BootstrapAuth0SmokeInput = {
  auth0OrgId: string;
  auth0UserId: string;
  email: string;
  name?: string;
  tenantName: string;
  tenantSlug: string;
  role: Exclude<AuthRole, "SUPERADMIN">;
};

export type BootstrapAuth0SmokePlan = {
  tenant: {
    where: { auth0OrgId: string };
    create: { auth0OrgId: string; name: string; slug: string; status: "ACTIVE" };
    update: { name: string; slug: string; status: "ACTIVE" };
  };
  user: {
    where: { auth0UserId: string };
    create: { auth0UserId: string; email: string; name?: string; isActive: true };
    update: { email: string; name?: string; isActive: true };
  };
  membershipRole: Exclude<AuthRole, "SUPERADMIN">;
};

type BootstrapPrisma = Pick<PrismaClient, "tenant" | "user" | "tenantUser" | "$disconnect">;

function required(env: Env, key: string): string {
  const value = env[key]?.trim();
  if (!value) {
    throw new Error(`${key} is required for Auth0 smoke bootstrap.`);
  }

  return value;
}

function optionalTrimmed(env: Env, key: string): string | undefined {
  const value = env[key]?.trim();
  return value || undefined;
}

function validateEmail(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) {
    throw new Error("AUTH0_USER_EMAIL must be a valid email address.");
  }

  return normalized;
}

function validateRole(value: string): Exclude<AuthRole, "SUPERADMIN"> {
  const normalized = value.trim().toUpperCase();
  if (!tenantAuthRoles.includes(normalized as never)) {
    throw new Error(`TENANT_ROLE must be one of: ${tenantAuthRoles.join(", ")}.`);
  }

  return normalized as Exclude<AuthRole, "SUPERADMIN">;
}

export function parseBootstrapAuth0SmokeEnv(env: Env): BootstrapAuth0SmokeInput {
  if (env.NODE_ENV === "production") {
    throw new Error("Refusing to run Auth0 smoke bootstrap with NODE_ENV=production.");
  }

  required(env, "DATABASE_URL");

  const name = optionalTrimmed(env, "AUTH0_USER_NAME");
  return {
    auth0OrgId: required(env, "AUTH0_ORGANIZATION_ID"),
    auth0UserId: required(env, "AUTH0_USER_ID"),
    email: validateEmail(required(env, "AUTH0_USER_EMAIL")),
    tenantName: required(env, "TENANT_NAME"),
    tenantSlug: required(env, "TENANT_SLUG"),
    role: validateRole(env.TENANT_ROLE ?? "ADMIN"),
    ...(name ? { name } : {})
  };
}

export function buildBootstrapAuth0SmokePlan(input: BootstrapAuth0SmokeInput): BootstrapAuth0SmokePlan {
  const userCreate = { auth0UserId: input.auth0UserId, email: input.email, isActive: true as const, ...(input.name ? { name: input.name } : {}) };
  const userUpdate = { email: input.email, isActive: true as const, ...(input.name ? { name: input.name } : {}) };

  return {
    tenant: {
      where: { auth0OrgId: input.auth0OrgId },
      create: { auth0OrgId: input.auth0OrgId, name: input.tenantName, slug: input.tenantSlug, status: "ACTIVE" },
      update: { name: input.tenantName, slug: input.tenantSlug, status: "ACTIVE" }
    },
    user: {
      where: { auth0UserId: input.auth0UserId },
      create: userCreate,
      update: userUpdate
    },
    membershipRole: input.role
  };
}

export async function runBootstrapAuth0Smoke(options: {
  env?: Env;
  prisma?: BootstrapPrisma;
  log?: (message: string) => void;
} = {}): Promise<{ tenantId: string; tenantSlug: string; userId: string; role: string; membershipId: string }> {
  const input = parseBootstrapAuth0SmokeEnv(options.env ?? process.env);
  const plan = buildBootstrapAuth0SmokePlan(input);
  const prisma = options.prisma ?? new PrismaClient();
  const log = options.log ?? console.log;

  try {
    const tenant = await prisma.tenant.upsert(plan.tenant);
    const user = await prisma.user.upsert(plan.user);
    const now = new Date();
    const membership = await prisma.tenantUser.upsert({
      where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
      create: { tenantId: tenant.id, userId: user.id, role: plan.membershipRole, isActive: true, acceptedAt: now },
      update: { role: plan.membershipRole, isActive: true, acceptedAt: now }
    });

    const result = {
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      userId: user.id,
      role: membership.role,
      membershipId: membership.id
    };

    log(`Auth0 smoke bootstrap ready: tenant=${result.tenantId} slug=${result.tenantSlug} user=${result.userId} role=${result.role} membership=${result.membershipId}`);

    return result;
  } finally {
    if (!options.prisma) {
      await prisma.$disconnect();
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runBootstrapAuth0Smoke().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown Auth0 smoke bootstrap error.";
    console.error(`Auth0 smoke bootstrap failed: ${message}`);
    process.exitCode = 1;
  });
}
