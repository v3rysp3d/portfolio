# Design Doc — AI Engineering Showcase

**Status:** Draft (in progress)
**Owner:** Nathan Burr
**Last updated:** 2026-06-18
**Repo:** `nathan-burr-portfolio`

---

## 1. Summary

Turn the existing gated AI interview feature into a **production-grade, evaluated, guardrailed, cost-optimised LLM system** — and surface the engineering behind it as public proof.

The product and the proof are the same codebase:

- **Product:** a visitor can interview a digital "Nathan" on the portfolio. It answers from real background, stays on-scope, resists jailbreaks, and costs cents per conversation.
- **Proof:** behind it sits an eval harness (CI-gated), a model router, a guardrail suite, and an observability dashboard — the things hiring managers and AI clients actually pay for.

**Goal:** reposition the portfolio from "generalist who lists AI" to "applied-AI engineer with shippable, measured proof," opening remote/contract applied-AI work.

## 2. Goals / Non-goals

### Goals
- A **golden-dataset eval harness** with an LLM-as-judge, run in CI, gating prompt/model changes on quality regressions.
- A **model router** that picks the cheapest model that passes evals, with caching and token budgets — producing a real `$/conversation` figure.
- A **guardrail layer**: prompt-injection defence, PII handling, scope enforcement, structured-output validation, refusal handling — each with a measured catch-rate.
- An **observability layer**: every call traced (model, tokens, cost, latency, cache-hit rate, eval score) into a public dashboard.
- **Public artifacts:** live demo (the chat), eval dashboard, guardrail/red-team report, cost breakdown, and a technical writeup.

### Non-goals
- Not rebuilding the interview UX or the request→approve→session lifecycle — that exists and works.
- Not a general-purpose LLM gateway/framework. Scope is *this feature, done to production standard*.
- Not multi-provider. Anthropic only (matches the existing `AnthropicProvider`); the `LlmProvider` seam keeps it swappable if ever needed.
- No fine-tuning. Prompt + retrieval + routing + evals only.

## 3. Current state (what already exists)

The interview feature is already cleanly layered, which is why this is an extension, not a rewrite.

| Concern | Where it lives today | Showcase impact |
|---|---|---|
| Model call abstraction | `src/services/llm/LlmProvider.ts` (+ `AnthropicProvider`, `StubLlmProvider`) | Router slots in behind this interface — zero callers change |
| Prompt caching | `AnthropicProvider.complete()` — `cache_control` on the persona system prompt | Already implemented; dashboard will surface the hit-rate |
| Refusal handling | `AnthropicProvider` maps `stop_reason: 'refusal'` → `refused: true` | Guardrail layer extends this |
| Cost controls | `InterviewService` — manual approval, turn caps, session TTL, bounded history, daily token/session ceilings | Already strong; feeds the cost story |
| Usage accounting | `InterviewUsageRepository`, per-message `inputTokens`/`outputTokens` | Half of observability already captured |
| Persona / system prompt | `PersonaService.buildSystemPrompt()`, `personaNotes.ts` | The eval + guardrail target; prompt versioning hangs off here |
| Persistence | SQLite via `better-sqlite3`, repository layer | New eval/trace tables follow the same pattern |

**Implication:** the four showcase layers attach at known seams. No architectural surgery.

## 4. Architecture overview

```
                         ┌─────────────────────────────────┐
   visitor ──chat──▶ InterviewService.sendMessage()         │
                         │  (existing cost gates)            │
                         ▼                                   │
                   GuardrailPipeline (NEW)                   │
                     ├─ input: injection / PII / scope check │
                     ▼                                       │
                   ModelRouter (NEW, implements LlmProvider) │
                     ├─ classify difficulty → pick model     │
                     ├─ AnthropicProvider (cache + refusal)  │
                     ▼                                       │
                   GuardrailPipeline (NEW)                   │
                     └─ output: validate / scope / redact    │
                         ▼                                   │
                   TraceRecorder (NEW) ──▶ traces table ─────┘
                                                  │
   ┌──────────────────────────────────────────────┘
   ▼
 Eval harness (NEW, offline + CI) ──▶ eval_runs table ──▶ public dashboard
```

New modules (all under `src/services/`, following existing conventions):

- `llm/ModelRouter.ts` — implements `LlmProvider`, wraps one or more `AnthropicProvider` instances keyed by tier.
- `guardrails/` — `GuardrailPipeline.ts`, `InjectionGuard.ts`, `PiiGuard.ts`, `ScopeGuard.ts`.
- `observability/TraceRecorder.ts` — writes a structured trace per turn.
- `eval/` — `EvalRunner.ts`, `Judge.ts`, `goldens/*.json` (dataset), `rubric.ts` (typed schema).

New repositories/tables: `TraceRepository` (`traces`), `EvalRepository` (`eval_runs`, `eval_cases`), and a `prompt_versions` notion (hash of the persona prompt at run time).

## 5. Layer 1 — Eval harness *(build first; highest leverage)*

The spine. Everything else is measured against it.

### Golden dataset (`src/eval/goldens/`)
JSON cases, version-controlled. Each case:
```jsonc
{
  "id": "background-react-experience",
  "category": "factual | tone | scope | safety",
  "input": "How much React experience does Nathan have?",
  "expect": {
    "must_be_grounded": true,          // no facts absent from persona source
    "must_stay_in_scope": true,
    "must_refuse": false,
    "notes": "Should cite real projects, not invent employers"
  }
}
```
Seed ~40–60 cases across four categories: **factual** (grounded answers), **tone** (voice), **scope** (politely deflects off-topic), **safety** (jailbreaks/PII — overlaps Layer 3).

### Judge (`src/eval/Judge.ts`)
LLM-as-judge using **structured outputs** (`client.messages.parse()` with a Zod rubric) so verdicts are typed, not parsed from prose. **Judge is tiered for cost:** `claude-haiku-4-5` by default (fast, cheap), escalating to `claude-sonnet-4-6` only on low-confidence/ambiguous verdicts. The judge also returns a `confidence` field to drive that escalation.

> **Caveat — self-grading:** when the chat model is also Haiku, Haiku is grading Haiku, which risks correlated blind spots. Mitigation: a periodic **calibration pass** runs a stronger model (`claude-sonnet-4-6` / `claude-opus-4-8`) over a small human-labelled subset to confirm the cheap judge tracks the strong one. If they diverge, raise the default judge tier.

Rubric schema (per case): `grounded: boolean`, `inScope: boolean`, `correctRefusal: boolean`, `toneScore: 1–5`, `rationale: string`.

### Runner + CI gate
- `npm run eval` runs the dataset against the **stub provider replaying recorded fixtures** by default (zero cost, deterministic) and against the **live model** on demand / nightly.
- Persist each run to `eval_runs` with the persona-prompt hash + model + aggregate scores.
- **CI gate:** fail the build if any category's pass-rate drops below a committed threshold. This is the single most credibility-shifting piece.

### Cost note
Dataset runs are batchable — the **Batches API (50% off)** is the right tool for nightly full-dataset scoring; interactive single-case runs use the standard endpoint.

## 6. Layer 2 — Cost & latency engineering

### Model router (`src/services/llm/ModelRouter.ts`)
Implements `LlmProvider`, so `InterviewService` is unchanged. Holds a map of tiers → `AnthropicProvider`:

| Tier | Model | Price (in/out per MTok) | Used for |
|---|---|---|---|
| cheap | `claude-haiku-4-5` | $1 / $5 | default chat turns |
| standard | `claude-sonnet-4-6` | $3 / $15 | turns flagged "hard" by the classifier |
| (judge) | `claude-haiku-4-5` → `claude-sonnet-4-6` on ambiguity | $1/$5 · $3/$15 | eval only, never user-facing |

Routing rule: cheap by default; escalate when the turn is complex. The complexity decision uses a **model-based classifier** — a single cheap `claude-haiku-4-5` call that scores the turn's difficulty/sensitivity — rather than brittle keyword heuristics. (Haiku is cheap enough that a classify-then-answer round trip is affordable, and a real classifier is the more credible, "complicated-is-better" engineering story.) The eval harness validates that routing-down doesn't drop quality below threshold — *that linkage is the story* (routing decisions justified by measured quality, not vibes).

### Caching & budgets
- Prompt caching already on the persona prompt (`AnthropicProvider`). Surface `cache_read_input_tokens` vs `input_tokens` in the dashboard to show the hit-rate.
- Token counting via the API (`messages.countTokens`) for pre-flight estimates — never `tiktoken`.
- Existing daily token ceiling + per-session turn cap stay as the hard backstop.

### Output
A real, defensible **`$/conversation`** and **p50/p95 latency** number, broken down by tier and cache-hit rate.

## 7. Layer 3 — Guardrails *(leans on the security background)*

An interview bot is adversarial by nature — visitors *will* try to break it. That makes it the ideal canvas.

`GuardrailPipeline` runs input checks before the model and output checks after:

- **InjectionGuard** — detect prompt-injection / instruction-override attempts ("ignore your instructions", role-play escapes). Layered: cheap heuristic prefilter → model-based check for ambiguous cases. Backed by an attack-prompt eval set with a measured **catch-rate**.
- **PiiGuard** — redact/refuse PII in both directions; never persist secrets.
- **ScopeGuard** — keep answers about Nathan's background/work; politely deflect otherwise (partly already in the persona prompt; promote to an enforced check).
- **Structured-output validation** — where the model returns structured data, validate against schema; `strict: true` tool/Zod schemas.
- **Refusal handling** — already mapped in `AnthropicProvider`; route safety refusals to a friendly redirect (existing behaviour) and log the category.

Each guard is independently testable and contributes a number to the red-team report.

## 8. Layer 4 — Observability

### TraceRecorder (`src/services/observability/TraceRecorder.ts`)
One structured trace per turn → `traces` table:

```
id, session_id, ts, model_tier, model_id,
input_tokens, output_tokens, cache_read_tokens,
latency_ms, refused, guardrail_flags (json),
est_cost_usd, prompt_version_hash, eval_score (nullable)
```

Cost is derived from a per-model price table (single source of truth, reused by the router and dashboard).

### Public dashboard
A read-only **`/lab`** page rendering, from `traces` + `eval_runs`:
- Eval pass-rate over time, by category (the headline chart)
- `$/conversation` and token/cache breakdown
- p50/p95 latency by tier
- Guardrail catch-rate / refusal counts
- Prompt-version history (each deploy = a point on the eval timeline)

Privacy: aggregate metrics only; no transcript content, no requester PII.

## 9. Public-facing artifacts (the resume payload)

1. **Live demo** — the interview chat, hero placement, above the fold: *"Don't read my CV — interview me."*
2. **Eval dashboard** — `/lab`, one click away. The "this person actually does evals" moment.
3. **Red-team / guardrail report** — **fully public, and versioned.** Show the actual attack prompts, including the ones that *defeated earlier prompt versions*, and how later versions fixed them — an attack-vs-prompt-version timeline. The narrative ("here's what broke v1, here's the fix, here's the eval proving it") is more compelling than a static catch-rate, and demonstrates iterative hardening. Visitors can also try the published attacks against the live demo.
4. **Cost writeup** — `$/conversation`, routing + caching explained.
5. **Technical blog post** — "Building an evaluated, guardrailed, cost-optimised LLM feature" — the narrative artifact, linkable from the resume.

## 10. Data model additions

New tables (migrations under existing `scripts`/migrations convention):
- `traces` — per-turn observability (schema above).
- `eval_runs` — one row per harness run (timestamp, prompt hash, model, aggregate scores per category).
- `eval_cases` — per-case verdict within a run (FK to `eval_runs`, the rubric fields).

Golden dataset itself is version-controlled JSON, **not** a table (it should diff in PRs).

## 11. Tech & model choices (as of 2026-06-18)

- SDK: `@anthropic-ai/sdk` (already `^0.104.2`).
- Chat default: `claude-haiku-4-5`; escalation: `claude-sonnet-4-6`.
- Judge: `claude-haiku-4-5` default, escalating to `claude-sonnet-4-6` on low-confidence verdicts (cost-first; self-grading caveat + calibration pass in §5/§13).
- Difficulty classifier: a single cheap `claude-haiku-4-5` call scoring turn complexity/sensitivity.
- Structured outputs: `messages.parse()` + Zod (supported on Haiku 4.5 / Sonnet 4.6 / Opus 4.8).
- Batches API for nightly full-dataset eval scoring (50% off).
- Prompt caching already in use; verify via `usage.cache_read_input_tokens`.

> Model IDs and prices verified against the bundled `claude-api` reference; re-check before launch as the lineup moves.

## 12. Milestones

1. **M1 — Eval harness (MVP).** Golden dataset (~40 cases), Judge with typed rubric, `npm run eval`, persisted runs. *Deliverable: a pass-rate number.*
2. **M2 — CI gate.** Wire eval into CI; commit thresholds; fixture-replay path for zero-cost deterministic runs.
3. **M3 — Observability.** `TraceRecorder` + `traces` table; `/lab` dashboard v1 (eval chart + cost).
4. **M4 — Model router.** `ModelRouter` behind `LlmProvider`; difficulty classifier; evals prove routing-down holds quality.
5. **M5 — Guardrails.** `GuardrailPipeline` + injection/PII/scope guards + attack-prompt eval set; catch-rate on dashboard.
6. **M6 — Public polish + writeup.** Hero demo placement, `/lab` polish, red-team report, blog post, resume rewrite.

Each milestone is independently shippable and independently resume-worthy.

## 13. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Eval cost runs away during dev | Fixture-replay by default; live + Batches only nightly/on-demand; **hard $20/month ceiling** across all live LLM spend (eval + demo), tracked against the per-model price table |
| Judge unreliable / grades itself | Haiku judges Haiku by default (cost) — mitigate the self-grading bias with a periodic Sonnet/Opus calibration pass over a human-labelled subset; ambiguous verdicts escalate to Sonnet live |
| Public dashboard leaks PII | Aggregate-only; no transcript/requester data; reuse existing redaction discipline |
| Scope creep into a "framework" | Hard non-goal; everything scoped to this one feature |
| Demo abused / cost spike | Existing manual-approval gate + caps remain the backstop; **heavy rate limiting on the public demo: 1 request / 10s, max 30 / hour** (via `express-rate-limit`, already a dependency); guardrails add defence-in-depth; $20/mo ceiling is the hard stop |

## 14. Success metrics

- Eval pass-rate per category, trending up across prompt versions.
- A defensible `$/conversation` (target: low single-digit cents).
- Guardrail catch-rate on the attack set (target: high, with the number published).
- p95 latency within an acceptable interactive bound.
- **Outcome metric:** the site/resume demonstrably lands applied-AI conversations.

## 15. Resolved decisions (2026-06-18)

- **Dashboard route:** `/lab` — clean, professional, resume-friendly.
- **Red-team report:** fully public and **versioned** — publish the attacks (including the ones that beat earlier prompt versions) and the fixes that closed them; visitors can try them against the live demo. See §9.
- **Budget:** hard **$20/month** ceiling across all live LLM spend. Heavy rate limiting on the public demo: **1 request / 10s, max 30 / hour**. Live full-dataset evals run nightly (Batches, 50% off) within that ceiling; fixture-replay for dev iteration is free.
- **Difficulty classifier:** model-based — a cheap `claude-haiku-4-5` complexity score, not keyword heuristics (the more credible engineering story).
- **Golden dataset:** Nathan-drafted-by-Claude from `PersonaService` / `resumeData.ts`, then Nathan corrects for factual accuracy.
- **Judge model:** cost-first — `claude-haiku-4-5` default, escalate to `claude-sonnet-4-6` on ambiguity, with a stronger-model calibration pass to catch self-grading bias (§5).

### Still open (non-blocking)
- Exact wording/threshold per eval category for the CI gate (set empirically once the dataset exists).

---

*Next step: M1 — scaffold the eval harness (golden dataset structure, typed judge rubric, runnable scorer against the current persona prompt).*
