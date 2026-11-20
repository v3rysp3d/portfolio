import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Project root, resolved relative to this compiled/transpiled file.
 *
 * This file lives at `src/config/env.ts` in development (run via tsx) and at
 * `dist/config/env.js` in production (run via node). In both cases `__dirname`
 * is two levels below the project root, so `../../` resolves to the root and the
 * `views/` + `public/` + `data/` directories are found identically in both modes.
 */
export const APP_ROOT = path.resolve(__dirname, '..', '..');

function bool(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function int(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

export type LlmProviderKind = 'anthropic' | 'stub';
export type EmailTransportKind = 'ses' | 'console';
export type RouterClassifierKind = 'heuristic' | 'llm';

/**
 * Configuration for the "Interview my AI self" feature. Every limit is tunable
 * here so cost can be capped tightly in production. The Anthropic API key is
 * read once and stored on this frozen object — it is NEVER logged or rendered.
 */
export type InterviewConfig = Readonly<{
  enabled: boolean;
  /** Absolute origin used to build links inside emails (no trailing slash). */
  appBaseUrl: string;
  /** Inbox that receives access-approval requests (Nathan). */
  approverEmail: string;

  // ── LLM ──
  llmProvider: LlmProviderKind;
  /** Server-only secret. Never logged, never sent to the client. */
  anthropicApiKey: string;
  llmModel: string;
  llmMaxTokens: number;
  /** Only the last N user/assistant turn-pairs are sent to the model. */
  historyTurns: number;

  // ── AI showcase (all default to zero extra spend) ──
  /** Deterministic (regex/heuristic) guardrails run before any model call. Free. */
  guardrailsEnabled: boolean;
  /** Haiku→Sonnet model router. OFF by default: escalated turns cost more. */
  routerEnabled: boolean;
  /** Escalation model used only when the router is enabled. */
  llmModelStandard: string;
  /** 'heuristic' is free; 'llm' adds one cheap classifier call per message. */
  routerClassifier: RouterClassifierKind;

  // ── Cost caps ──
  maxTurns: number;
  sessionTtlHours: number;
  approvalTtlHours: number;
  maxInputChars: number;
  dailyRequestCap: number;
  dailySessionCap: number;
  dailyTokenCap: number;

  // ── Email ──
  emailTransport: EmailTransportKind;
  sesRegion: string;
  fromEmail: string;
}>;

export type AppConfig = Readonly<{
  nodeEnv: 'development' | 'production' | 'test';
  isProduction: boolean;
  port: number;
  databasePath: string;
  sessionSecret: string;
  trustProxy: boolean;
  viewsDir: string;
  publicDir: string;
  /** Absolute origin of the site (no trailing slash) — SEO + email links. */
  appBaseUrl: string;
  lab: Readonly<{ enabled: boolean }>;
  interview: InterviewConfig;
}>;

/**
 * Loads, validates and freezes the application configuration. Fails fast with a
 * descriptive error when a production deployment is misconfigured, so insecure
 * defaults can never reach a public host.
 */
function loadConfig(): AppConfig {
  const nodeEnv = (process.env.NODE_ENV ?? 'development') as AppConfig['nodeEnv'];
  const isProduction = nodeEnv === 'production';

  const port = Number.parseInt(process.env.PORT ?? '3000', 10);
  if (!Number.isFinite(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT value: "${process.env.PORT}"`);
  }

  const databasePath = process.env.DATABASE_PATH
    ? path.resolve(process.env.DATABASE_PATH)
    : path.join(APP_ROOT, 'data', 'portfolio.db');

  const sessionSecret = process.env.SESSION_SECRET ?? '';
  if (isProduction) {
    if (!sessionSecret || sessionSecret.length < 32 || sessionSecret.includes('change-me')) {
      throw new Error(
        'SESSION_SECRET must be set to a strong (>= 32 char) random value in production. ' +
          'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"',
      );
    }
  }

  // SEO (canonical/sitemap/OG) and interview emails both build absolute links
  // from this origin, so production must declare it explicitly and use HTTPS.
  const appBaseUrl = (process.env.APP_BASE_URL ?? `http://localhost:${port}`).replace(/\/+$/, '');
  if (isProduction) {
    if (!process.env.APP_BASE_URL) {
      throw new Error('APP_BASE_URL must be set in production (e.g. https://nathanburr.dev).');
    }
    if (!appBaseUrl.startsWith('https://')) {
      throw new Error(`APP_BASE_URL must use https in production, got: "${appBaseUrl}"`);
    }
  }

  const interview = loadInterviewConfig(isProduction, appBaseUrl);

  return Object.freeze({
    nodeEnv,
    isProduction,
    port,
    databasePath,
    sessionSecret: sessionSecret || 'insecure-development-secret-do-not-use-in-production',
    trustProxy: bool(process.env.TRUST_PROXY, false),
    viewsDir: path.join(APP_ROOT, 'views'),
    publicDir: path.join(APP_ROOT, 'public'),
    appBaseUrl,
    lab: Object.freeze({ enabled: bool(process.env.LAB_ENABLED, true) }),
    interview,
  });
}

/**
 * Builds the interview feature configuration. Defaults are deliberately
 * conservative so a fresh deploy is cheap and safe; tighten or loosen via env.
 *
 * Provider selection: explicit `LLM_PROVIDER` wins; otherwise we use the real
 * Anthropic provider when a key is present and fall back to the no-cost stub
 * (so the whole flow runs locally without an API key or any spend).
 */
function loadInterviewConfig(isProduction: boolean, appBaseUrl: string): InterviewConfig {
  const enabled = bool(process.env.INTERVIEW_ENABLED, true);
  const anthropicApiKey = (process.env.ANTHROPIC_API_KEY ?? '').trim();

  const explicitProvider = (process.env.LLM_PROVIDER ?? '').trim().toLowerCase();
  const llmProvider: LlmProviderKind =
    explicitProvider === 'anthropic' || explicitProvider === 'stub'
      ? (explicitProvider as LlmProviderKind)
      : anthropicApiKey
        ? 'anthropic'
        : 'stub';

  // Fail fast in production if the live provider is selected without a key — but
  // never echo the key (or its absence beyond a boolean) in the error.
  if (isProduction && enabled && llmProvider === 'anthropic' && !anthropicApiKey) {
    throw new Error(
      'Interview feature is enabled with LLM_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set. ' +
        'Provide the key via the environment (e.g. injected from AWS SSM/Secrets Manager), ' +
        'or set LLM_PROVIDER=stub / INTERVIEW_ENABLED=false.',
    );
  }

  const emailTransportRaw = (process.env.EMAIL_TRANSPORT ?? '').trim().toLowerCase();
  const emailTransport: EmailTransportKind = emailTransportRaw === 'ses' ? 'ses' : 'console';

  const approverEmail = (process.env.INTERVIEW_APPROVER_EMAIL ?? '').trim();
  const fromEmail = (process.env.SES_FROM_EMAIL ?? approverEmail).trim();

  if (isProduction && enabled && emailTransport === 'ses' && (!fromEmail || !approverEmail)) {
    throw new Error(
      'Interview feature with EMAIL_TRANSPORT=ses requires SES_FROM_EMAIL and INTERVIEW_APPROVER_EMAIL.',
    );
  }

  const routerEnabled = bool(process.env.LLM_ROUTER, false);
  const routerClassifierRaw = (process.env.LLM_ROUTER_CLASSIFIER ?? 'heuristic').trim().toLowerCase();
  const routerClassifier: RouterClassifierKind = routerClassifierRaw === 'llm' ? 'llm' : 'heuristic';
  if (routerClassifier === 'llm' && (!routerEnabled || llmProvider !== 'anthropic')) {
    throw new Error(
      'LLM_ROUTER_CLASSIFIER=llm requires LLM_ROUTER=true and the anthropic provider — ' +
        'it adds a classifier call per message, so it must be an explicit opt-in.',
    );
  }

  return Object.freeze({
    enabled,
    appBaseUrl,
    approverEmail,
    llmProvider,
    anthropicApiKey,
    llmModel: (process.env.LLM_MODEL ?? 'claude-haiku-4-5').trim(),
    llmMaxTokens: int(process.env.LLM_MAX_TOKENS, 400),
    historyTurns: int(process.env.INTERVIEW_HISTORY_TURNS, 8),
    guardrailsEnabled: bool(process.env.GUARDRAILS_ENABLED, true),
    routerEnabled,
    llmModelStandard: (process.env.LLM_MODEL_STANDARD ?? 'claude-sonnet-4-6').trim(),
    routerClassifier,
    maxTurns: int(process.env.INTERVIEW_MAX_TURNS, 12),
    sessionTtlHours: int(process.env.INTERVIEW_SESSION_TTL_HOURS, 48),
    approvalTtlHours: int(process.env.INTERVIEW_APPROVAL_TTL_HOURS, 168),
    maxInputChars: int(process.env.INTERVIEW_MAX_INPUT_CHARS, 1500),
    dailyRequestCap: int(process.env.INTERVIEW_DAILY_REQUEST_CAP, 50),
    dailySessionCap: int(process.env.INTERVIEW_DAILY_SESSION_CAP, 10),
    dailyTokenCap: int(process.env.INTERVIEW_DAILY_TOKEN_CAP, 150_000),
    emailTransport,
    sesRegion: (process.env.SES_REGION ?? process.env.AWS_REGION ?? 'us-east-1').trim(),
    fromEmail,
  });
}

export const config: AppConfig = loadConfig();
