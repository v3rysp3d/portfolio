# Deploying to AWS (single box + Docker + Caddy)

This app is a stateful Node process with a SQLite file, so the simplest, cheapest
fit is **one small instance** running the container behind **Caddy** (which gets
you automatic HTTPS). Budget ~$5–10/month. Everything here also works on a plain
EC2 `t4g.small`.

> The interview feature's two hard requirements drive this guide: the **Anthropic
> API key must never be committed or exposed**, and **cost is capped to the nth
> degree**. Both are addressed below.

---

## 0. Prerequisites

- A domain (or subdomain) you can point at the box, e.g. `interview.example.com`.
- An AWS account.
- Docker + Docker Compose on the instance.

---

## 1. Provision the instance

**AWS Lightsail (easiest):** create a container or a Linux VM (Ubuntu 22.04+,
1 GB+ RAM). **Or EC2:** launch a `t4g.small` (Ubuntu), open inbound `80` and
`443` in the security group.

On the box, install Docker:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # re-login afterwards
```

Clone the repo onto the instance.

## 2. Point DNS

Create an `A` record for your (sub)domain → the instance's public IP. Wait for it
to resolve before the first HTTPS boot (Caddy needs it to issue the certificate).

## 3. Generate a session secret

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## 4. Store the Anthropic API key securely (do NOT commit it)

Create the key in the [Anthropic Console](https://console.anthropic.com), then
store it in **AWS SSM Parameter Store** as a `SecureString` (or Secrets Manager):

```bash
aws ssm put-parameter \
  --name /portfolio/interview/anthropic_api_key \
  --type SecureString \
  --value 'sk-ant-...'
```

Give the instance's IAM role `ssm:GetParameter` (+ `kms:Decrypt`) on that
parameter only. At deploy time, fetch it into the environment — it never lands in
the image, the repo, or `docker-compose.yml`:

```bash
export ANTHROPIC_API_KEY=$(aws ssm get-parameter \
  --name /portfolio/interview/anthropic_api_key \
  --with-decryption --query Parameter.Value --output text)
```

## 5. Set up AWS SES (email)

1. **Verify a sender identity** (a domain, or a single From address) in the SES
   console for your `SES_REGION`. Set `SES_FROM_EMAIL` to it.
2. **Request production access.** A new SES account is in the *sandbox* and can
   only send to verified addresses. The approval email always goes to you (verify
   that address and you can test immediately), but the **interview invite goes to
   arbitrary requesters**, so you must request production access for that to work.
   SES console → *Account dashboard* → *Request production access*.
3. Grant the instance IAM role `ses:SendEmail`. No SES secret goes in `.env` — the
   AWS SDK uses the role.

> Want to launch before SES production access is granted? Keep
> `EMAIL_TRANSPORT=console` (or wire a different transport) and copy the invite
> link from the logs manually. The feature still works; only delivery changes.

## 6. Create the production `.env`

Copy `.env.example` → `.env` and set at least:

```ini
NODE_ENV=production
SESSION_SECRET=<the 48-byte value from step 3>
APP_BASE_URL=https://interview.example.com
INTERVIEW_APPROVER_EMAIL=you@example.com
LLM_PROVIDER=anthropic
LLM_MODEL=claude-haiku-4-5
EMAIL_TRANSPORT=ses
SES_FROM_EMAIL=interview@example.com
SES_REGION=us-east-1
# Tighten the caps to taste:
INTERVIEW_MAX_TURNS=12
INTERVIEW_DAILY_SESSION_CAP=10
INTERVIEW_DAILY_TOKEN_CAP=150000
```

Do **not** put `ANTHROPIC_API_KEY` in this committed-shaped file in a way that
ends up in git. Inject it from the environment (step 4) — Compose's `env_file`
plus the exported var both reach the container; the exported var wins. `.env` is
already gitignored.

Also set the site address for Caddy:

```bash
export SITE_ADDRESS=interview.example.com
```

## 7. Build and run

```bash
ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" SITE_ADDRESS="$SITE_ADDRESS" \
  docker compose up -d --build
```

Caddy obtains a Let's Encrypt certificate automatically. Visit
`https://interview.example.com/interview`.

## 8. Seed the database (first deploy only)

```bash
docker compose exec app node dist/db/seed.js
```

This creates the admin account (prints a generated password once if
`ADMIN_PASSWORD` is unset) and the portfolio content. The interview tables are
created automatically by the migration runner on first boot.

---

## Cost controls (defense in depth)

Already enforced by the app — verify they're set the way you want:

1. **Manual approval** — no model call happens until you click *Approve*.
2. **`LLM_MAX_TOKENS`** bounds every reply (default 400).
3. **`INTERVIEW_MAX_TURNS`** caps questions per interview (default 12).
4. **`INTERVIEW_HISTORY_TURNS`** bounds how much transcript is re-sent each call.
5. **Session TTL** expires links (default 48h).
6. **Per-IP rate limits** on request + message endpoints.
7. **`INTERVIEW_DAILY_TOKEN_CAP` / `_SESSION_CAP` / `_REQUEST_CAP`** — hard global
   daily ceilings; the app refuses further work once hit.
8. **Kill switch** — `INTERVIEW_ENABLED=false` disables the feature instantly.
9. **Anthropic Console spend limit** — set a low monthly *usage limit* on the API
   key as the ultimate backstop, outside the app. Do this.

## API key safety checklist

- Stored only in SSM/Secrets Manager; injected as an env var at runtime.
- Never in the image, the repo, `docker-compose.yml`, logs, or any template.
- The browser only ever calls our own endpoints; the strict CSP (`connect-src
  'self'`, no inline scripts) makes a client-side leak structurally impossible.
- **If the key is ever exposed, rotate it immediately** in the Anthropic Console
  and update the SSM parameter.

---

## Operations

```bash
docker compose logs -f app          # tail logs (console emails show here too)
docker compose up -d --build        # deploy an update
docker compose exec app sh          # shell into the container
```

**Backups:** the SQLite database lives in the `app_data` Docker volume at
`/app/data/portfolio.db`. Snapshot it periodically:

```bash
docker compose exec app sh -c 'sqlite3 /app/data/portfolio.db ".backup /app/data/backup.db"'
docker compose cp app:/app/data/backup.db ./backup-$(date +%F).db
```
