import express, { type Router } from 'express';
import type { PublicController } from '../controllers/PublicController';
import type { AuthController } from '../controllers/AuthController';
import type { AdminController } from '../controllers/AdminController';
import type { InterviewController } from '../controllers/InterviewController';
import type { InterviewAdminController } from '../controllers/InterviewAdminController';
import type { SeoController } from '../controllers/SeoController';
import type { LabController } from '../controllers/LabController';
import { requireAuth, redirectIfAuthenticated } from '../middleware/authGuard';
import {
  loginRateLimiter,
  interviewRequestRateLimiter,
  interviewMessageRateLimiter,
} from '../middleware/security';
import { asyncHandler } from '../utils/asyncHandler';

export interface ControllerSet {
  publicController: PublicController;
  authController: AuthController;
  adminController: AdminController;
  interviewController: InterviewController;
  interviewAdminController: InterviewAdminController;
  seoController: SeoController;
  labController: LabController;
}

/**
 * Builds the full route table. Public routes are open; everything under
 * `/admin` (except the login endpoints) is gated by {@link requireAuth}.
 * CSRF protection and rate limiting are applied at the app level / per-route.
 */
export function createRoutes(c: ControllerSet): Router {
  const router = express.Router();
  const {
    publicController: pub,
    authController: auth,
    adminController: admin,
    interviewController: iv,
    interviewAdminController: ivAdmin,
    seoController: seo,
    labController: lab,
  } = c;

  // ── Crawler infrastructure ─────────────────────────────────────────────
  router.get('/robots.txt', seo.robots);
  router.get('/sitemap.xml', seo.sitemap);

  // ── Public site ──────────────────────────────────────────────────────────
  router.get('/', pub.home);
  router.get('/cv', pub.cv);
  router.get('/projects', pub.projects_index);
  router.get('/projects/:slug', pub.projectDetail);

  // ── AI engineering showcase ────────────────────────────────────────────
  router.get('/lab', lab.index);
  router.get('/lab/red-team', lab.redTeam);

  // ── Interview (AI persona) ─────────────────────────────────────────────────
  router.get('/interview', iv.showLanding);
  router.post('/interview/request', interviewRequestRateLimiter, asyncHandler(iv.requestAccess));
  // Review = GET renders (no side effect) / POST acts — defeats email link prefetch.
  router.get('/interview/review/:token', iv.showReview);
  router.post('/interview/review/:token', asyncHandler(iv.submitReview));
  router.get('/interview/s/:token', asyncHandler(iv.enterSession));
  router.get('/interview/chat', iv.showChat);
  router.post('/interview/message', interviewMessageRateLimiter, asyncHandler(iv.postMessage));

  // ── Authentication ─────────────────────────────────────────────────────────
  router.get('/admin/login', redirectIfAuthenticated, auth.showLogin);
  router.post('/admin/login', loginRateLimiter, redirectIfAuthenticated, asyncHandler(auth.login));

  // ── Admin panel (auth required) ────────────────────────────────────────────
  const adminRouter = express.Router();
  adminRouter.use(requireAuth);

  adminRouter.post('/logout', auth.logout);
  adminRouter.get('/', admin.dashboard);

  // Projects
  adminRouter.get('/projects', admin.listProjects);
  adminRouter.get('/projects/new', admin.newProjectForm);
  adminRouter.post('/projects', admin.createProject);
  adminRouter.get('/projects/:id/edit', admin.editProjectForm);
  adminRouter.post('/projects/:id', admin.updateProject);
  adminRouter.post('/projects/:id/delete', admin.deleteProject);

  // Profile
  adminRouter.get('/profile', admin.profileForm);
  adminRouter.post('/profile', admin.updateProfile);

  // Experience
  adminRouter.get('/experience', admin.listExperience);
  adminRouter.get('/experience/new', admin.newExperienceForm);
  adminRouter.post('/experience', admin.createExperience);
  adminRouter.get('/experience/:id/edit', admin.editExperienceForm);
  adminRouter.post('/experience/:id', admin.updateExperience);
  adminRouter.post('/experience/:id/delete', admin.deleteExperience);

  // Skills
  adminRouter.get('/skills', admin.listSkills);
  adminRouter.get('/skills/new', admin.newSkillForm);
  adminRouter.post('/skills', admin.createSkill);
  adminRouter.get('/skills/:id/edit', admin.editSkillForm);
  adminRouter.post('/skills/:id', admin.updateSkill);
  adminRouter.post('/skills/:id/delete', admin.deleteSkill);

  // Account
  adminRouter.get('/account', admin.accountForm);
  adminRouter.post('/account/password', asyncHandler(admin.changePassword));

  // Interviews (monitoring + revoke)
  adminRouter.get('/interviews', ivAdmin.list);
  adminRouter.get('/interviews/:id', ivAdmin.detail);
  adminRouter.post('/interviews/sessions/:id/revoke', ivAdmin.revoke);

  router.use('/admin', adminRouter);

  return router;
}
