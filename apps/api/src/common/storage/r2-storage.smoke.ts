import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { Readable } from "node:stream";
import { createDocumentStorageFromEnv } from "./document-storage.factory";

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;

  const content = readFileSync(path, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();
    if (!key || process.env[key] !== undefined) continue;

    process.env[key] = stripQuotes(rawValue);
  }
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

async function readableToString(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  loadEnvFile("../../.env");
  loadEnvFile(".env");

  process.env.STORAGE_PROVIDER = "r2";

  const storage = createDocumentStorageFromEnv(process.env);
  const key = `smoke-tests/r2-${randomUUID()}.txt`;
  const content = `AdPropIA R2 smoke ${new Date().toISOString()}`;

  let saved = false;
  let deleted = false;

  try {
    console.log(`R2 smoke: saving temporary object ${key}`);
    await storage.save(key, Buffer.from(content, "utf8"), { mimeType: "text/plain" });
    saved = true;

    const existsAfterSave = await storage.exists(key);
    if (!existsAfterSave) {
      throw new Error("R2 smoke failed: object was not found after save.");
    }

    const readContent = await readableToString(await storage.read(key));
    if (readContent !== content) {
      throw new Error("R2 smoke failed: read content does not match saved content.");
    }

    await storage.delete(key);
    deleted = true;

    const existsAfterDelete = await storage.exists(key);
    if (existsAfterDelete) {
      throw new Error("R2 smoke failed: object still exists after delete.");
    }
  } finally {
    if (saved && !deleted) {
      await storage.delete(key).catch(() => undefined);
    }
  }

  console.log("R2 smoke: save/read/delete passed.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`R2 smoke failed: ${message}`);
  process.exitCode = 1;
});
