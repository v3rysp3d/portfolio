import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ProfileService } from '../services/ProfileService';
import { asset } from '../utils/clientAssets';
import * as view from '../utils/viewHelpers';

/**
 * Populates response locals shared by every template: the current profile (for
 * nav/footer branding), the signed-in user, the active path, one-shot flash
 * messages, and the view-helper functions. Centralising this keeps controllers
 * focused on their own data.
 */
export function createLocalsMiddleware(profileService: ProfileService): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.locals.profile = profileService.getOrDefault();
    res.locals.currentUser = req.session.user ?? null;
    res.locals.currentPath = req.path;

    // Consume flash messages (one-shot).
    res.locals.flash = req.session.flash ?? [];
    if (req.session.flash) delete req.session.flash;

    res.locals.helpers = view;
    res.locals.asset = asset;
    res.locals.currentYear = new Date().getFullYear();

    next();
  };
}
