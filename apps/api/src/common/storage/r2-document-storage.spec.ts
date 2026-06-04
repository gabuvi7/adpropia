import { Readable } from "node:stream";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { R2DocumentStorage } from "./r2-document-storage";
import type { DocumentStorageSaveMetadata } from "./document-storage.interface";

function createMockS3() {
  const send = vi.fn();
  const client = { send } as unknown as S3Client;
  return { client, send };
}

function firstArg<T>(send: ReturnType<typeof vi.fn>): T {
  return send.mock.calls[0]![0] as T;
}

describe("R2DocumentStorage", () => {
  const BUCKET = "adpropia-r2-bucket";
  let mock: ReturnType<typeof createMockS3>;
  let storage: R2DocumentStorage;

  beforeEach(() => {
    mock = createMockS3();
    storage = new R2DocumentStorage(mock.client, BUCKET);
  });

  describe("save", () => {
    it("sends PutObjectCommand with body and ContentType when mimeType is provided", async () => {
      mock.send.mockResolvedValue({});
      const key = "tenant-1/liquidations/liq-1/doc.pdf";
      const content = Buffer.from("pdf content");
      const metadata: DocumentStorageSaveMetadata = { mimeType: "application/pdf" };

      await storage.save(key, content, metadata);

      expect(mock.send).toHaveBeenCalledTimes(1);
      const cmd = firstArg<PutObjectCommand>(mock.send);
      expect(cmd.input).toMatchObject({
        Bucket: BUCKET,
        Key: key,
        Body: content,
        ContentType: "application/pdf",
      });
    });

    it("sends PutObjectCommand without ContentType when metadata is absent", async () => {
      mock.send.mockResolvedValue({});
      const key = "tenant-1/liquidations/liq-2/report.pdf";
      const content = Buffer.from("report");

      await storage.save(key, content);

      expect(mock.send).toHaveBeenCalledTimes(1);
      const cmd = firstArg<PutObjectCommand>(mock.send);
      expect(cmd.input).toMatchObject({
        Bucket: BUCKET,
        Key: key,
        Body: content,
      });
      expect(cmd.input.ContentType).toBeUndefined();
    });

    it("rejects keys with path traversal", async () => {
      await expect(
        storage.save("../escape.pdf", Buffer.from("x"))
      ).rejects.toThrow("La ruta del documento no es válida.");

      expect(mock.send).not.toHaveBeenCalled();
    });

    it("rejects absolute keys", async () => {
      await expect(
        storage.save("/etc/passwd", Buffer.from("x"))
      ).rejects.toThrow("La ruta del documento no es válida.");

      expect(mock.send).not.toHaveBeenCalled();
    });
  });

  describe("read", () => {
    it("returns a Readable from GetObjectCommand body", async () => {
      const body = Readable.from([Buffer.from("file content")]);
      mock.send.mockResolvedValue({ Body: body });
      const key = "tenant-1/liquidations/liq-1/doc.pdf";

      const result = await storage.read(key);

      expect(mock.send).toHaveBeenCalledTimes(1);
      const cmd = firstArg<GetObjectCommand>(mock.send);
      expect(cmd.input).toMatchObject({ Bucket: BUCKET, Key: key });
      expect(result).toBe(body);
    });

    it("throws missing document error when object does not exist", async () => {
      const err = Object.assign(new Error("Not Found"), { name: "NotFound" });
      mock.send.mockRejectedValue(err);
      const key = "tenant-1/missing/doc.pdf";

      await expect(storage.read(key)).rejects.toThrow(
        "El documento solicitado no existe."
      );
    });

    it("rethrows non-NotFound errors", async () => {
      const err = new Error("Network failure");
      mock.send.mockRejectedValue(err);

      await expect(storage.read("tenant-1/ok/doc.pdf")).rejects.toThrow(
        "Network failure"
      );
    });
  });

  describe("exists", () => {
    it("returns true when HeadObject succeeds", async () => {
      mock.send.mockResolvedValue({});
      const key = "tenant-1/liquidations/liq-1/doc.pdf";

      const result = await storage.exists(key);

      expect(result).toBe(true);
      expect(mock.send).toHaveBeenCalledTimes(1);
      const cmd = firstArg<HeadObjectCommand>(mock.send);
      expect(cmd.input).toMatchObject({ Bucket: BUCKET, Key: key });
    });

    it("returns false when HeadObject reports not found", async () => {
      const err = Object.assign(new Error("Not Found"), { name: "NotFound" });
      mock.send.mockRejectedValue(err);

      const result = await storage.exists("tenant-1/missing.pdf");

      expect(result).toBe(false);
    });

    it("rethrows unexpected errors", async () => {
      const err = new Error("Service unavailable");
      mock.send.mockRejectedValue(err);

      await expect(storage.exists("tenant-1/ok/doc.pdf")).rejects.toThrow(
        "Service unavailable"
      );
    });
  });

  describe("delete", () => {
    it("sends DeleteObjectCommand and resolves", async () => {
      mock.send.mockResolvedValue({});
      const key = "tenant-1/liquidations/liq-1/doc.pdf";

      await storage.delete(key);

      expect(mock.send).toHaveBeenCalledTimes(1);
      const cmd = firstArg<DeleteObjectCommand>(mock.send);
      expect(cmd.input).toMatchObject({ Bucket: BUCKET, Key: key });
    });

    it("is idempotent when object does not exist", async () => {
      const err = Object.assign(new Error("Not Found"), { name: "NotFound" });
      mock.send.mockRejectedValue(err);

      await expect(
        storage.delete("tenant-1/missing.pdf")
      ).resolves.toBeUndefined();
    });

    it("rethrows unexpected errors on delete", async () => {
      const err = new Error("Network failure");
      mock.send.mockRejectedValue(err);

      await expect(
        storage.delete("tenant-1/ok/doc.pdf")
      ).rejects.toThrow("Network failure");
    });
  });
});
