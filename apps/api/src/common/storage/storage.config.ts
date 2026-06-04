import { promises as fs } from "node:fs";
import { isAbsolute, resolve } from "node:path";

/**
 * Nombre de la variable de entorno que controla la base path del storage local.
 * Si no está definida, se usa `./storage` resuelto contra `process.cwd()`.
 */
export const STORAGE_BASE_PATH_ENV = "STORAGE_BASE_PATH";

/**
 * Default relativo al cwd. La función `resolveStorageBasePath` se encarga de
 * convertirlo en absoluto antes de usarlo.
 */
export const DEFAULT_STORAGE_BASE_PATH = "./storage";

/**
 * Resuelve la base path del storage de documentos a partir de:
 *   - `process.env.STORAGE_BASE_PATH` (si está definido y no es vacío).
 *   - Default `./storage` relativo al cwd, resuelto a absoluto.
 *
 * NO toca el filesystem; sólo computa el path. Para crear/validar el directorio
 * usar `ensureStorageBasePath`.
 */
export function resolveStorageBasePath(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env[STORAGE_BASE_PATH_ENV]?.trim();
  const candidate = raw && raw.length > 0 ? raw : DEFAULT_STORAGE_BASE_PATH;
  return isAbsolute(candidate) ? candidate : resolve(process.cwd(), candidate);
}

/**
 * Asegura que el directorio de storage existe. Si no existe lo crea.
 * Lanza un error con mensaje en español si no se puede crear.
 *
 * Pensado para llamarse en bootstrap (`main.ts`) y/o en el provider del
 * módulo de liquidaciones cuando se cree (Batch 6).
 */
export async function ensureStorageBasePath(basePath: string): Promise<void> {
  try {
    await fs.mkdir(basePath, { recursive: true });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `No se pudo inicializar el directorio de almacenamiento de documentos en "${basePath}". ${reason}`
    );
  }
}

/**
 * R2 / S3-compatible storage config env vars.
 */
export const R2_ENDPOINT_ENV = "R2_ENDPOINT";
export const R2_BUCKET_ENV = "R2_BUCKET_NAME";
export const R2_REGION_ENV = "R2_REGION";
export const R2_ACCESS_KEY_ID_ENV = "R2_ACCESS_KEY_ID";
export const R2_SECRET_ACCESS_KEY_ENV = "R2_SECRET_ACCESS_KEY";

export const STORAGE_PROVIDER_ENV = "STORAGE_PROVIDER";

export interface R2StorageConfig {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/**
 * Validates that all required R2 environment variables are present and non-empty.
 * Throws with a descriptive message listing the missing variable(s).
 */
export function validateR2Config(env: NodeJS.ProcessEnv = process.env): R2StorageConfig {
  const missing: string[] = [];

  const endpoint = env[R2_ENDPOINT_ENV] ?? "";
  if (!endpoint) missing.push(R2_ENDPOINT_ENV);

  const bucket = env[R2_BUCKET_ENV] ?? "";
  if (!bucket) missing.push(R2_BUCKET_ENV);

  const region = env[R2_REGION_ENV] ?? "";
  if (!region) missing.push(R2_REGION_ENV);

  const accessKeyId = env[R2_ACCESS_KEY_ID_ENV] ?? "";
  if (!accessKeyId) missing.push(R2_ACCESS_KEY_ID_ENV);

  const secretAccessKey = env[R2_SECRET_ACCESS_KEY_ENV] ?? "";
  if (!secretAccessKey) missing.push(R2_SECRET_ACCESS_KEY_ENV);

  if (missing.length > 0) {
    throw new Error(
      `R2 storage configuration error: missing required env vars: ${missing.join(", ")}`,
    );
  }

  return { endpoint, bucket, region, accessKeyId, secretAccessKey };
}
