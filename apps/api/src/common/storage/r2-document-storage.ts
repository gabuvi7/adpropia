import { dirname, isAbsolute, normalize, sep } from "node:path";
import { Readable } from "node:stream";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Injectable } from "@nestjs/common";
import type { DocumentStorage, DocumentStorageSaveMetadata } from "./document-storage.interface";

@Injectable()
export class R2DocumentStorage implements DocumentStorage {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
  ) {}

  async save(key: string, content: Readable | Buffer, metadata?: DocumentStorageSaveMetadata): Promise<void> {
    this.assertValidKey(key);

    const input: PutObjectCommand["input"] = {
      Bucket: this.bucket,
      Key: key,
      Body: content,
    };

    if (metadata?.mimeType) {
      input.ContentType = metadata.mimeType;
    }

    await this.client.send(new PutObjectCommand(input));
  }

  async read(key: string): Promise<Readable> {
    this.assertValidKey(key);

    try {
      const output = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return output.Body as Readable;
    } catch (error) {
      if (this.isNotFoundError(error)) {
        throw new Error("El documento solicitado no existe.");
      }
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    this.assertValidKey(key);

    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return true;
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return false;
      }
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    this.assertValidKey(key);

    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (error) {
      if (!this.isNotFoundError(error)) {
        throw error;
      }
    }
  }

  private isNotFoundError(error: unknown): boolean {
    if (error instanceof Error) {
      const name = error.name;
      return name === "NotFound" || name === "NoSuchKey";
    }
    return false;
  }

  private assertValidKey(key: string): void {
    if (typeof key !== "string" || key.length === 0) {
      throw new Error("La ruta del documento no es válida.");
    }

    if (isAbsolute(key)) {
      throw new Error("La ruta del documento no es válida.");
    }

    const segments = key.split(/[\\/]/);
    if (segments.some((segment) => segment === "..")) {
      throw new Error("La ruta del documento no es válida.");
    }

    const normalized = normalize(key);
    if (normalized.startsWith("..") || normalized.startsWith(`..${sep}`)) {
      throw new Error("La ruta del documento no es válida.");
    }
  }
}
