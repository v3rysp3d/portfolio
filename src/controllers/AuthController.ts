import type { Request, Response } from 'express';
import type { Session } from 'express-session';
import type { AuthService } from '../services/AuthService';
import { loginSchema } from '../utils/validation';

/** Handles admin sign-in and sign-out. */
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  showLogin = (_req: Request, res: Response): void => {
    res.render('admin/login', {
      title: 'Admin sign in',
      values: { username: '' },
      errors: {} as Record<string, string>,
    });
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      this.renderLoginError(res, req.body?.username ?? '', 'Please enter your username and password.');
      return;
    }

    const user = await this.auth.verifyCredentials(parsed.data.username, parsed.data.password);
    if (!user) {
      // Deliberately generic message — never reveal whether the username exists.
      this.renderLoginError(res, parsed.data.username, 'Invalid username or password.');
      return;
    }

    const sessionUser = this.auth.toSessionUser(user);
    // Regenerate the session id on privilege change to defeat session fixation.
    await this.regenerate(req.session);
    req.session.user = sessionUser;
    await this.save(req.session);

    req.session.flash = [{ type: 'success', message: `Welcome back, ${sessionUser.username}.` }];
    res.redirect('/admin');
  };

  logout = (req: Request, res: Response): void => {
    req.session.destroy(() => {
      res.clearCookie('sid');
      res.redirect('/');
    });
  };

  private renderLoginError(res: Response, username: string, message: string): void {
    res.status(401).render('admin/login', {
      title: 'Admin sign in',
      values: { username },
      errors: { _: message },
    });
  }

  private regenerate(session: Session): Promise<void> {
    return new Promise((resolve, reject) => {
      session.regenerate((err) => (err ? reject(err) : resolve()));
    });
  }

  private save(session: Session): Promise<void> {
    return new Promise((resolve, reject) => {
      session.save((err) => (err ? reject(err) : resolve()));
    });
  }
}
