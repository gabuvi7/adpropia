import { BadRequestException } from "@nestjs/common";
import { z } from "zod";

export function parseRequestBody<T extends z.ZodTypeAny>(schema: T, body: unknown): z.output<T> {
  const result = schema.safeParse(body);

  if (!result.success) {
    throw new BadRequestException({
      message: "Los datos enviados no son válidos.",
      errors: result.error.issues.map((issue) => issue.message)
    });
  }

  return result.data;
}
