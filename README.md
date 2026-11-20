# Nathan Burr — Portfolio

A personal portfolio site that showcases projects and experience, backed by a
SQLite database that an admin can edit through the site itself (add / edit /
remove projects, experience, skills, and the profile). Built to be hosted
publicly, with security and a clean, layered OOP architecture as first-class
concerns.

---

## Stack

- **Runtime:** Node.js (≥ 20), TypeScript (strict)
- **Web:** Express 4, server-rendered EJS templates
- **Database:** SQLite via `better-sqlite3` (file-based, zero-config)
- **Auth:** session cookies (`express-session` + SQLite store), Argon2id hashing
- **Design:** custom CSS ("Engineering Editorial" — Fraunces + IBM Plex), no build step for the frontend

No client-side framework, no bundler — the public site is fast, static-feeling,
and works without JavaScript (JS is progressive enhancement only).

---

## Architecture

Strict layering, dependencies point inward, everything is constructor-injected
in one composition root (`src/app.ts`):

```
HTTP            controllers/      PublicController, AuthController, AdminController
  │
Business logic  services/         ProjectService, ProfileService, ContentService, AuthService
  │
Data access     repositories/     *Repository  (the ONLY code that writes SQL)
  │
Persistence     db/Database.ts    better-sqlite3 connection + migration runner
```

- `models/` — typed domain entities + row mappers (SQLite 0/1 ↔ booleans, JSON text ↔ arrays)
- `middleware/` — security headers, CSRF, auth guard, request locals, error handling
- `utils/` — validation (zod), view helpers, slugs, typed errors
- `views/` — EJS templates (`partials/`, `public/`, `admin/`)

Because all SQL is isolated in the repository layer, moving to a hosted database
later (see **Path to AWS**) is a contained change.

---

## Getting started

```bash
# 1. Install dependencies (compiles the better-sqlite3 / argon2 native modules)
npm install

# 2. Create your environment file
cp .env.example .env          # then edit values

# 3. Seed the database (creates the admin account + sample content)
npm run seed

# 4. Run in development (auto-reload)
npm run dev
```

Then open <http://localhost:3000>. The admin panel is at
<http://localhost:3000/admin>.

### Seeding & the admin password

`npm run seed` is idempotent — each section only runs if its table is empty.

- Set `ADMIN_USERNAME` / `ADMIN_PASSWORD` in `.env` to choose your credentials.
- If `ADMIN_PASSWORD` is left blank, a strong random password is generated and
  **printed to the console once** — copy it immediately.
- Change your password any time at **Admin → Account**.

### Production build

```bash
npm run build      # type-checks, compiles to dist/, copies SQL migrations
npm run seed:prod  # seed using the compiled output (first deploy only)
npm start          # runs dist/server.js
```

Set `NODE_ENV=production` and a strong `SESSION_SECRET` (≥ 32 chars) — the app
**refuses to start** in production without one. Generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

---

## Security measures

This is built to face the public internet:

- **Passwords:** Argon2id hashing; login verification runs in ~constant time
  whether or not the username exists (no user enumeration).
- **Sessions:** `httpOnly`, `sameSite=lax`, `secure` cookies (in production),
  server-side store, session id regenerated on login (anti-fixation).
- **CSRF:** synchroniser-token on every state-changing request, compared in
  constant time.
- **CSP & headers:** strict Content-Security-Policy via Helmet (no inline
  scripts), HSTS in production, sensible referrer policy.
- **Input validation:** every form validated with zod; URLs are restricted to
  `http(s)` so `javascript:`/`data:` hrefs can't be injected.
- **SQL injection:** impossible by construction — only parameterised prepared
  statements, all confined to the repository layer.
- **XSS:** EJS auto-escapes output; free-text is escaped before paragraph markup
  is added.
- **Rate limiting:** global limiter + a strict login limiter.
- **Error handling:** stack traces and internal messages are never leaked to
  clients in production.

> Run behind HTTPS in production (a reverse proxy or load balancer). Set
> `TRUST_PROXY=true` so secure cookies and client-IP rate limiting work.

---

## Editing content

Everything on the public site is data, editable at `/admin`:

| Section     | What you can do                                              |
|-------------|-------------------------------------------------------------|
| Projects    | Add, edit, delete; toggle **featured** (home) and **visible** (public) |
| Experience  | Add, edit, delete timeline entries                          |
| Skills      | Add, edit, delete; grouped by category                      |
| Profile     | Name, headline, bio, location, email, and social links      |
| Account     | Change your admin password                                  |

Hidden projects (visible = off) are still previewable by a signed-in admin via
their direct URL.

---

## Interview my AI self

A standout feature: visitors can have a short, virtual interview with an **AI
stand-in for Nathan**, grounded in the real profile/timeline/projects above. It
is **manually gated** — a visitor requests access, Nathan gets an email and
approves or declines, and only on approval is a single-use interview link emailed
to the requester.

- **Model:** Anthropic **Claude Haiku** (`@anthropic-ai/sdk`), called entirely
  server-side. With no API key set, a no-cost **stub** provider runs so the whole
  flow works locally for free.
- **Cost capped to the nth degree:** manual approval, a small per-reply
  `max_tokens`, a per-interview turn cap, link TTLs, a bounded history window,
  per-IP rate limits, and a **hard global daily token/session ceiling** in the
  database — plus an `INTERVIEW_ENABLED` kill switch.
- **Key safety:** the API key lives only in the environment (gitignored locally;
  AWS SSM/Secrets Manager in prod), is never logged or rendered, and the strict
  CSP keeps the browser from ever reaching the model.
- **Email:** AWS SES in production, console transport locally.
- **Admin:** monitor requests, sessions, transcripts, and today's usage at
  `/admin/interviews`; revoke any live session.

The feature is layered into the same architecture (migration `003` →
`Interview*` repositories → `InterviewService`/`PersonaService` →
`InterviewController` → `views/public/interview/`). All new config lives under
`config.interview` and is documented in `.env.example`.

---

## Path to AWS

The app runs as a single long-lived Node process with a SQLite file — ideal for a
small box with a persistent volume. A ready-made single-box deploy is included:

- **`Dockerfile`** (multi-stage), **`docker-compose.yml`** (app + **Caddy**
  auto-HTTPS), **`Caddyfile`**, and a full runbook in **[`DEPLOY.md`](./DEPLOY.md)**
  — Lightsail/EC2 provisioning, SES verification + sandbox→production, injecting
  the API key from SSM, `TRUST_PROXY=true`, and the cost/key-safety checklist.
- **Lift-and-shift alternative:** run the same container on ECS/Fargate or EC2
  with the SQLite file on an EBS/EFS volume, behind an ALB terminating TLS.
- **Managed database:** swap the storage engine without touching services or
  controllers — implement the same repository classes against RDS (Postgres),
  point `Database`/the repos at the new client, and the rest of the app is
  unchanged. The session store can move to the same database or ElastiCache.

---

## Project layout

```
nathan-burr-portfolio/
├─ src/
│  ├─ config/        env + path resolution
│  ├─ db/            Database, migrations/, seed
│  ├─ models/        domain entities + row mappers
│  ├─ repositories/  SQL data access
│  ├─ services/      business logic
│  ├─ controllers/   HTTP handlers
│  ├─ middleware/    security, csrf, auth, errors, locals
│  ├─ routes/        route table
│  ├─ utils/         validation, helpers, errors
│  ├─ types/         ambient + session typings
│  ├─ app.ts         composition root
│  └─ server.ts      entry point
├─ views/            EJS templates
├─ public/           css / js / favicon
├─ scripts/          build helpers
└─ data/             SQLite database (gitignored, created at runtime)
```
