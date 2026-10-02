import type { FastifyReply, FastifyRequest } from "fastify";
import type { ZodSchema } from "zod";
import { ZodError } from "zod";

export function formatZodError(error: ZodError) {
  return {
    statusCode: 400,
    error: "Bad Request",
    message: "Validation failed",
    details: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
      code: issue.code,
    })),
  };
}

export function parseBody<T>(schema: ZodSchema<T>, body: unknown): T {
  return schema.parse(body);
}

export function parseQuery<T>(schema: ZodSchema<T>, query: unknown): T {
  return schema.parse(query);
}

export async function validateBody<T>(
  schema: ZodSchema<T>,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<T | null> {
  const result = schema.safeParse(request.body);
  if (!result.success) {
    await reply.status(400).send(formatZodError(result.error));
    return null;
  }
  return result.data;
}

export async function validateQuery<T>(
  schema: ZodSchema<T>,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<T | null> {
  const result = schema.safeParse(request.query);
  if (!result.success) {
    await reply.status(400).send(formatZodError(result.error));
    return null;
  }
  return result.data;
}

export function isMongoId(id: string): boolean {
  return /^[a-fA-F0-9]{24}$/.test(id);
}
