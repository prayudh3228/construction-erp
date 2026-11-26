import { HttpException, type HttpStatus } from '@nestjs/common';
import { type ApiError } from '@erp/shared';
import { type ZodType } from 'zod';

/** Throw an error with the shared body shape: { statusCode, code, message, details? }. */
export function apiError(
  status: HttpStatus,
  code: string,
  message: string,
  details?: string[],
): HttpException {
  const body: ApiError = { statusCode: status, code, message, ...(details ? { details } : {}) };
  return new HttpException(body, status);
}

/** Validate a request body with a shared Zod schema; 400 VALIDATION_FAILED with readable details. */
export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw apiError(
      400,
      'VALIDATION_FAILED',
      'Some fields are missing or invalid.',
      result.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`),
    );
  }
  return result.data;
}
