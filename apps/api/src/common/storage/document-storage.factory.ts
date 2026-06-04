import { S3Client } from "@aws-sdk/client-s3";
import type { DocumentStorage } from "./document-storage.interface";
import { LocalDocumentStorage, createLocalDocumentStorage } from "./local-document-storage";
import { R2DocumentStorage } from "./r2-document-storage";
import { resolveStorageBasePath, validateR2Config } from "./storage.config";

export function createDocumentStorageFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): DocumentStorage {
  const provider = env.STORAGE_PROVIDER ?? "local";

  if (provider === "r2") {
    const config = validateR2Config(env);

    const client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true,
    });

    return new R2DocumentStorage(client, config.bucket);
  }

  return createLocalDocumentStorage(resolveStorageBasePath(env));
}
