import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/errors';

/** Converts any unmatched route into a 404 that flows to the error handler. */
export function notFoundHandler(_req: Request, _res: Response, next: NextFunction): void {
  next(new HttpError(404, 'The page you are looking for does not exist.'));
}

/**
 * Central error handler. Renders a friendly error page and — crucially for a
 * public deployment — never exposes stack traces or internal messages for 5xx
 * errors in production.
 */
export function createErrorHandler(isProduction: boolean): ErrorRequestHandler {
  return (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
    const httpError = err instanceof HttpError ? err : null;
    const status = httpError?.status ?? 500;

    if (status >= 500) {
      // eslint-disable-next-line no-console
      console.error('[error]', req.method, req.originalUrl, err);
    }

    const safeMessage =
      status < 500
        ? (httpError?.message ?? 'Request error')
        : isProduction
          ? 'Something went wrong on our end. Please try again later.'
          : err instanceof Error
            ? err.message
            : String(err);

    res.status(status);

    // The error view itself failing must not crash the process.
    res.render('error', { status, message: safeMessage, title: `Error ${status}` }, (renderErr, html) => {
      if (renderErr) {
        res.type('text/plain').send(`Error ${status}: ${safeMessage}`);
        return;
      }
      res.send(html);
    });
  };
}
