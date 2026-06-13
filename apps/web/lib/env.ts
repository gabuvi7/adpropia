import { z } from "zod";

const serverEnvSchema = z.object({
  AUTH0_SECRET: z.string().min(1, "AUTH0_SECRET is required"),
  APP_BASE_URL: z.string().url("APP_BASE_URL must be a valid URL"),
  AUTH0_DOMAIN: z.string().min(1, "AUTH0_DOMAIN is required"),
  AUTH0_CLIENT_ID: z.string().min(1, "AUTH0_CLIENT_ID is required"),
  AUTH0_CLIENT_SECRET: z.string().min(1, "AUTH0_CLIENT_SECRET is required"),
  AUTH0_AUDIENCE: z.string().url("AUTH0_AUDIENCE must be a valid URL"),
  AUTH0_ORGANIZATION_ID: z.preprocess(
    (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined),
    z.string().optional(),
  ),
  ADPROPIA_API_BASE_URL: z.string().url("ADPROPIA_API_BASE_URL must be a valid URL"),
});

const accessRequestProxyEnvSchema = z.object({
  ADPROPIA_API_BASE_URL: z.string().url("ADPROPIA_API_BASE_URL must be a valid URL"),
});

const clientEnvSchema = z.object({
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1, "NEXT_PUBLIC_TURNSTILE_SITE_KEY is required"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(
  env: Record<string, string | undefined>,
): ServerEnv {
  return serverEnvSchema.parse(env);
}

export type AccessRequestProxyEnv = z.infer<typeof accessRequestProxyEnvSchema>;

export function parseAccessRequestProxyEnv(
  env: Record<string, string | undefined>,
): AccessRequestProxyEnv {
  return accessRequestProxyEnvSchema.parse(env);
}

export type ClientEnv = z.infer<typeof clientEnvSchema>;

export function parseClientEnv(env: Record<string, string | undefined>): ClientEnv {
  return clientEnvSchema.parse(env);
}
