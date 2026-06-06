import { z } from "zod";

const serverEnvSchema = z.object({
  AUTH0_SECRET: z.string().min(1, "AUTH0_SECRET is required"),
  APP_BASE_URL: z.string().url("APP_BASE_URL must be a valid URL"),
  AUTH0_DOMAIN: z.string().min(1, "AUTH0_DOMAIN is required"),
  AUTH0_CLIENT_ID: z.string().min(1, "AUTH0_CLIENT_ID is required"),
  AUTH0_CLIENT_SECRET: z.string().min(1, "AUTH0_CLIENT_SECRET is required"),
  AUTH0_AUDIENCE: z.string().url("AUTH0_AUDIENCE must be a valid URL"),
  ADPROPIA_API_BASE_URL: z.string().url("ADPROPIA_API_BASE_URL must be a valid URL"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(
  env: Record<string, string | undefined>,
): ServerEnv {
  return serverEnvSchema.parse(env);
}
