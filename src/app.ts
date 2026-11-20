import express, { type Express } from 'express';
import session from 'express-session';
import connectSqlite3 from 'better-sqlite3-session-store';

import { config } from './config/env';
import { Database } from './db/Database';

import { ProjectRepository } from './repositories/ProjectRepository';
import { ProfileRepository } from './repositories/ProfileRepository';
import { ExperienceRepository } from './repositories/ExperienceRepository';
import { SkillRepository } from './repositories/SkillRepository';
import { UserRepository } from './repositories/UserRepository';
import { InterviewRequestRepository } from './repositories/InterviewRequestRepository';
import { InterviewSessionRepository } from './repositories/InterviewSessionRepository';
import { InterviewMessageRepository } from './repositories/InterviewMessageRepository';
import { InterviewUsageRepository } from './repositories/InterviewUsageRepository';
import { TraceRepository } from './repositories/TraceRepository';

import { ProjectService } from './services/ProjectService';
import { ProfileService } from './services/ProfileService';
import { ContentService } from './services/ContentService';
import { AuthService } from './services/AuthService';
import { PersonaService } from './services/PersonaService';
import { InterviewService } from './services/InterviewService';
import type { LlmProvider } from './services/llm/LlmProvider';
import { AnthropicProvider } from './services/llm/AnthropicProvider';
import { StubLlmProvider } from './services/llm/StubLlmProvider';
import { GuardedLlmProvider } from './services/llm/GuardedLlmProvider';
import { ModelRouter } from './services/llm/ModelRouter';
import { HeuristicClassifier, LlmClassifier } from './services/llm/DifficultyClassifier';
import { GuardrailPipeline } from './services/guardrails/GuardrailPipeline';
import { InjectionGuard } from './services/guardrails/InjectionGuard';
import { PiiGuard } from './services/guardrails/PiiGuard';
import { ScopeGuard } from './services/guardrails/ScopeGuard';
import { TraceRecorder } from './services/observability/TraceRecorder';
import type { EmailTransport } from './services/email/EmailTransport';
import { EmailService } from './services/email/EmailService';
import { ConsoleEmailTransport } from './services/email/ConsoleEmailTransport';
import { SesEmailTransport } from './services/email/SesEmailTransport';

import { PublicController } from './controllers/PublicController';
import { AuthController } from './controllers/AuthController';
import { AdminController } from './controllers/AdminController';
import { InterviewController } from './controllers/InterviewController';
import { InterviewAdminController } from './controllers/InterviewAdminController';
import { SeoController } from './controllers/SeoController';
import { LabController } from './controllers/LabController';
import { EvalRunReader } from './services/lab/EvalRunReader';
import { LabService } from './services/lab/LabService';

import { createRoutes, type ControllerSet } from './routes';
import { securityHeaders, generalRateLimiter } from './middleware/security';
import { csrfProtection } from './middleware/csrf';
import { createLocalsMiddleware } from './middleware/locals';
import { notFoundHandler, createErrorHandler } from './middleware/errorHandler';

/**
 * Application composition root. Wires the dependency graph
 * (database → repositories → services → controllers) and assembles the Express
 * middleware pipeline. Nothing here reaches into globals — every collaborator is
 * constructed once and injected, which keeps the layers swappable and testable.
 */
export class App {
  readonly instance: Express;
  readonly database: Database;

  constructor() {
    this.database = new Database(config.databasePath);
    const conn = this.database.connection;

    // Repositories (data access)
    const projectRepo = new ProjectRepository(conn);
    const profileRepo = new ProfileRepository(conn);
    const experienceRepo = new ExperienceRepository(conn);
    const skillRepo = new SkillRepository(conn);
    const userRepo = new UserRepository(conn);
    const interviewRequestRepo = new InterviewRequestRepository(conn);
    const interviewSessionRepo = new InterviewSessionRepository(conn);
    const interviewMessageRepo = new InterviewMessageRepository(conn);
    const interviewUsageRepo = new InterviewUsageRepository(conn);
    const traceRepo = new TraceRepository(conn);

    // Services (business logic)
    const projectService = new ProjectService(projectRepo);
    const profileService = new ProfileService(profileRepo);
    const contentService = new ContentService(experienceRepo, skillRepo);
    const authService = new AuthService(userRepo);

    // Interview feature: pick the LLM provider + email transport from config.
    // No API key → no-cost stub provider, so the flow runs locally for free.
    const personaService = new PersonaService(profileService, contentService, projectService);
    const baseProvider: LlmProvider =
      config.interview.llmProvider === 'anthropic'
        ? new AnthropicProvider({
            apiKey: config.interview.anthropicApiKey,
            model: config.interview.llmModel,
            maxTokens: config.interview.llmMaxTokens,
          })
        : new StubLlmProvider();

    // Optional Haiku→Sonnet router (LLM_ROUTER, default off = today's spend).
    const routedProvider: LlmProvider =
      config.interview.routerEnabled && config.interview.llmProvider === 'anthropic'
        ? new ModelRouter(
            baseProvider,
            new AnthropicProvider({
              apiKey: config.interview.anthropicApiKey,
              model: config.interview.llmModelStandard,
              maxTokens: config.interview.llmMaxTokens,
            }),
            config.interview.routerClassifier === 'llm'
              ? new LlmClassifier(baseProvider)
              : new HeuristicClassifier(),
          )
        : baseProvider;

    // Deterministic zero-cost guardrails wrap whatever provider runs; blocked
    // attacks never reach a model. The eval harness wraps its subject with the
    // same pipeline, so /lab's safety numbers describe production exactly.
    const profile = profileService.getOrDefault();
    const guardrailPipeline = new GuardrailPipeline([
      new InjectionGuard(),
      new PiiGuard(profile.email),
      new ScopeGuard(),
    ]);
    const llmProvider: LlmProvider = new GuardedLlmProvider(
      routedProvider,
      guardrailPipeline,
      config.interview.guardrailsEnabled,
    );

    const emailTransport: EmailTransport =
      config.interview.emailTransport === 'ses'
        ? new SesEmailTransport(config.interview.sesRegion)
        : new ConsoleEmailTransport();
    const emailService = new EmailService(emailTransport, config.interview.fromEmail);
    const traceRecorder = new TraceRecorder(traceRepo);
    const interviewService = new InterviewService(
      interviewRequestRepo,
      interviewSessionRepo,
      interviewMessageRepo,
      interviewUsageRepo,
      personaService,
      llmProvider,
      emailService,
      traceRecorder,
      config.interview,
    );

    // AI showcase: /lab reads committed eval runs + local traces (all free).
    const evalRunReader = new EvalRunReader();
    const labService = new LabService(
      evalRunReader,
      traceRepo,
      interviewUsageRepo,
      config.interview.routerEnabled,
    );

    // Controllers (HTTP)
    const controllers: ControllerSet = {
      publicController: new PublicController(projectService, contentService, labService),
      authController: new AuthController(authService),
      adminController: new AdminController(
        projectService,
        profileService,
        contentService,
        authService,
      ),
      interviewController: new InterviewController(interviewService, labService),
      interviewAdminController: new InterviewAdminController(interviewService),
      seoController: new SeoController(projectService),
      labController: new LabController(labService, evalRunReader),
    };

    this.instance = this.configure(controllers, profileService);
  }

  private configure(controllers: ControllerSet, profileService: ProfileService): Express {
    const app = express();

    // Behind a proxy/LB (nginx, ALB, Cloudflare), trust the X-Forwarded-* headers
    // so secure cookies and client-IP rate limiting work correctly.
    if (config.trustProxy) app.set('trust proxy', 1);

    // Views (server-rendered EJS).
    app.set('view engine', 'ejs');
    app.set('views', config.viewsDir);

    // Security headers + CSP for every response.
    app.use(securityHeaders(config.isProduction));

    // Static assets (served before sessions so they carry no session cost).
    app.use(express.static(config.publicDir, { maxAge: config.isProduction ? '1d' : 0 }));

    // Global rate limiting (after static, so assets aren't counted).
    app.use(generalRateLimiter);

    // Parse HTML form bodies only, with a small size cap.
    app.use(express.urlencoded({ extended: false, limit: '100kb' }));

    // Server-side sessions persisted in the same SQLite database.
    const SqliteStore = connectSqlite3(session);
    app.use(
      session({
        name: 'sid',
        secret: config.sessionSecret,
        store: new SqliteStore({
          client: this.database.connection,
          expired: { clear: true, intervalMs: 15 * 60 * 1000 },
        }),
        resave: false,
        saveUninitialized: false,
        rolling: true,
        cookie: {
          httpOnly: true,
          sameSite: 'lax',
          secure: config.isProduction,
          maxAge: 8 * 60 * 60 * 1000, // 8 hours
        },
      }),
    );

    // Shared template locals (profile, flash, helpers, current user).
    app.use(createLocalsMiddleware(profileService));

    // CSRF protection — mints/validates the synchroniser token (needs session + body).
    app.use(csrfProtection);

    // Application routes.
    app.use(createRoutes(controllers));

    // 404 then centralised error handling (must be last).
    app.use(notFoundHandler);
    app.use(createErrorHandler(config.isProduction));

    return app;
  }
}
