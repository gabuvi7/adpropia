import { describe, expect, it } from "vitest";
import { createDocumentStorageFromEnv } from "./document-storage.factory";
import { LocalDocumentStorage } from "./local-document-storage";
import { R2DocumentStorage } from "./r2-document-storage";

describe("createDocumentStorageFromEnv", () => {
  it("returns LocalDocumentStorage when STORAGE_PROVIDER is unset", () => {
    const storage = createDocumentStorageFromEnv({});
    expect(storage).toBeInstanceOf(LocalDocumentStorage);
  });

  it("returns LocalDocumentStorage when STORAGE_PROVIDER is local", () => {
    const storage = createDocumentStorageFromEnv({ STORAGE_PROVIDER: "local" });
    expect(storage).toBeInstanceOf(LocalDocumentStorage);
  });

  it("throws when STORAGE_PROVIDER=r2 and R2_BUCKET_NAME is missing", () => {
    expect(() =>
      createDocumentStorageFromEnv({
        STORAGE_PROVIDER: "r2",
        R2_ENDPOINT: "https://example.com",
        R2_REGION: "auto",
        R2_ACCESS_KEY_ID: "key",
        R2_SECRET_ACCESS_KEY: "secret",
        R2_BUCKET_NAME: "",
      })
    ).toThrow("R2_BUCKET_NAME");
  });

  it("throws when STORAGE_PROVIDER=r2 and R2_ENDPOINT is missing", () => {
    expect(() =>
      createDocumentStorageFromEnv({
        STORAGE_PROVIDER: "r2",
        R2_ENDPOINT: "",
        R2_BUCKET_NAME: "bucket",
        R2_REGION: "auto",
        R2_ACCESS_KEY_ID: "key",
        R2_SECRET_ACCESS_KEY: "secret",
      })
    ).toThrow("R2_ENDPOINT");
  });

  it("throws when STORAGE_PROVIDER=r2 and R2_ACCESS_KEY_ID is missing", () => {
    expect(() =>
      createDocumentStorageFromEnv({
        STORAGE_PROVIDER: "r2",
        R2_ENDPOINT: "https://example.com",
        R2_BUCKET_NAME: "bucket",
        R2_REGION: "auto",
        R2_ACCESS_KEY_ID: "",
        R2_SECRET_ACCESS_KEY: "secret",
      })
    ).toThrow("R2_ACCESS_KEY_ID");
  });

  it("throws when STORAGE_PROVIDER=r2 and R2_SECRET_ACCESS_KEY is missing", () => {
    expect(() =>
      createDocumentStorageFromEnv({
        STORAGE_PROVIDER: "r2",
        R2_ENDPOINT: "https://example.com",
        R2_BUCKET_NAME: "bucket",
        R2_REGION: "auto",
        R2_ACCESS_KEY_ID: "key",
        R2_SECRET_ACCESS_KEY: "",
      })
    ).toThrow("R2_SECRET_ACCESS_KEY");
  });

  it("throws when STORAGE_PROVIDER=r2 and R2_REGION is missing", () => {
    expect(() =>
      createDocumentStorageFromEnv({
        STORAGE_PROVIDER: "r2",
        R2_ENDPOINT: "https://example.com",
        R2_BUCKET_NAME: "bucket",
        R2_REGION: "",
        R2_ACCESS_KEY_ID: "key",
        R2_SECRET_ACCESS_KEY: "secret",
      })
    ).toThrow("R2_REGION");
  });

  it("returns R2DocumentStorage when STORAGE_PROVIDER=r2 with all required env", () => {
    const storage = createDocumentStorageFromEnv({
      STORAGE_PROVIDER: "r2",
      R2_ENDPOINT: "https://example.com",
      R2_REGION: "auto",
      R2_ACCESS_KEY_ID: "key",
      R2_SECRET_ACCESS_KEY: "secret",
      R2_BUCKET_NAME: "bucket",
    });
    expect(storage).toBeInstanceOf(R2DocumentStorage);
  });
});
