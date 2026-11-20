import type { NextFunction, Request, Response } from 'express';

/** Blocks access to admin routes unless a user is signed in. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.session.user) {
    next();
    return;
  }
  req.session.flash = [{ type: 'error', message: 'Please sign in to continue.' }];
  res.redirect('/admin/login');
}

/** Sends already-authenticated users away from the login page. */
export function redirectIfAuthenticated(req: Request, res: Response, next: NextFunction): void {
  if (req.session.user) {
    res.redirect('/admin');
    return;
  }
  next();
}
