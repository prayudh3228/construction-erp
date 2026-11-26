import { AUTH_ERROR_CODES, CLIENT_HEADER, CLIENT_KINDS, type ClientKind } from '@erp/shared';
import { type NextFunction, type Request, type Response } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence for cookie sessions. A page on another site can make the browser send our cookie
 * with a form post, but it cannot add a custom header without passing CORS, which only allows our
 * own web origin. So every state-changing request must say which client it is.
 */
export function clientHeaderMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method) || clientKind(req)) return next();
  res.status(403).json({
    statusCode: 403,
    code: AUTH_ERROR_CODES.clientHeaderMissing,
    message: `Requests that change data must send the ${CLIENT_HEADER} header.`,
  });
}

export function clientKind(req: Request): ClientKind | undefined {
  const value = req.headers[CLIENT_HEADER];
  return (CLIENT_KINDS as readonly unknown[]).includes(value) ? (value as ClientKind) : undefined;
}
