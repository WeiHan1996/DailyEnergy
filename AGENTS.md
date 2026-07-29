# DailyEnergy Agent Instructions

- **Status**: Active
- **Last updated**: 2026-07-20
- **Scope**: Entire repository

These instructions apply to the entire repository.

## 1. Start every task by restoring routed context

Before planning, editing, coding, or creating issues:

1. Read this file.
2. Read `docs/agent/PROJECT_CONTEXT.md`.
3. Read `tasks/current.md`.
4. Run `pnpm agent:prepare <TASK_ID>` when the entrypoint is available.
5. Read every required source returned by the command.
6. Read related Accepted ADRs, executable Schema/API contracts, tests, fixtures, and nearby code.
7. Read `tasks/backlog.md` only when prioritization or dependency state is needed.

`PROJECT_CONTEXT.md`, the authority index, task packets, command summaries, chat history, and
generated reports are navigation aids, not sources of truth. They never replace the relevant
Accepted original document, executable contract, original design evidence, or current task file.

Use `--remote` only when GitHub state is needed and `--deep` only when environment or dependency
checks are needed. The default preparation command must remain read-only, local, fast, and bounded.

If the entrypoint is unavailable or its policy is invalid, fall back to reading, in order:
README.md, ROADMAP.md, docs/INDEX.md, tasks/current.md, relevant backlog entries, every upstream
document, all related Accepted ADRs, executable contracts, tests, and nearby code.

Do not rely on chat history as the source of truth.

If a required file is missing, conflicting, or still Draft when the task needs an Accepted
decision, stop and report the blocker instead of guessing. If impact cannot be classified safely,
expand the source set and validation scope.

## 2. Identify the operating mode

Classify the user request before acting:

- **Continue current task**: follow tasks/current.md exactly.
- **Review or explain**: inspect and report; do not mutate the repository unless requested.
- **Change the current task**: state the impact and update project-control files before or with the change.
- **Urgent defect or safety issue**: it may interrupt the current task, but record why and how the plan changes.
- **New idea**: add it to tasks/backlog.md; do not silently expand the current task.
- **Major direction change**: create or update an ADR before implementation.

The user’s explicit latest request takes precedence, but it does not erase the need to record durable decisions.

## 3. Source-of-truth priority

When information conflicts, use this order:

1. Accepted ADRs
2. Accepted product, AI, design, technical, safety, privacy, and operations specifications
3. Executable Schema and API contracts
4. Automated tests and acceptance fixtures
5. tasks/current.md
6. tasks/backlog.md
7. ROADMAP.md and README.md
8. Chat messages, temporary notes, and unmerged drafts

Do not resolve conflict only by choosing the newest timestamp.

## 3A. Classify proof before implementation

Assign the task one profile from `docs/agent/PROJECT_CONTEXT.md`: `code`, `design`, `hybrid`,
`docs`, `research`, or `security`. Use `docs/agent/authority-index.yaml` and
`docs/agent/validation-policy.yaml` as versioned routing and validation policy.

Before implementation, identify:

- the requirement being changed;
- the authoritative source for that requirement;
- the automated proof that can verify it;
- any original external evidence, authorization, or user decision automation cannot replace.

Design, hybrid, research, and security work must not report `PASS` when required manual evidence
or authorization is missing. Return the explicit pending status instead.

## 4. Work on one bounded task

- Only one task may be Ready or In Progress.
- Keep the work inside the current task’s goal, deliverables, and non-goals.
- Do not implement downstream work “while already here.”
- If a task is too large for one coherent PR, split it before implementation.
- Prefer explicit decisions and acceptance criteria over large speculative documents.
- Do not begin coding while a required upstream specification is unresolved.
- If blocked, update tasks/current.md to Blocked and state the exact unlock condition.

## 5. Product guardrails

All work must preserve these Accepted decisions:

- DailyEnergy is a lightweight daily companion, not a professional fortune-telling tool.
- The target seed users are 22–35-year-old professional women reached initially through Xiaohongshu and Douyin.
- The core experience is approximately one minute per day.
- Fortune or daily energy is an entertainment and reflection mechanism, not a promise to predict the future.
- The same user’s core result is stable for the same product date and version.
- Rules create structured facts; AI creates natural expression.
- Morning state, daily energy, evening feedback, and behavior data remain distinct.
- There is one core digital friend; tone options are not separate characters.
- Memory must be real, permissioned, explainable, and deletable.
- Missing a day or a task never causes punishment or shame.
- High-risk content exits the ordinary fortune flow.
- The MVP does not include unlimited chat, professional astrology, virtual romance, community, or fear-based monetization.

Changing any of these requires a new or superseding ADR.

## 6. AI and content guardrails

- AI must not invent user facts, memories, causes, or future events.
- AI must not change deterministic scores or rule-engine facts.
- AI output must use a strict Schema and pass safety checks.
- Model failure must have a bounded retry and safe template fallback.
- Prompt, model, rule, template, and result versions must be traceable.
- Never send unrelated history or unnecessary sensitive data to a model.
- Never expose provider keys, system prompts, internal rules, or private data to the miniapp.
- Do not use fear, certainty, shame, exclusivity, or fabricated intimacy.
- Do not produce diagnostic medical, psychological, legal, or investment conclusions.
- Do not use ordinary fortune content for self-harm, suicide, violence, or medical emergencies.

## 7. Technical guardrails

The accepted default stack is:

- WeChat native mini program with TypeScript
- NestJS with TypeScript
- PostgreSQL
- Prisma
- Redis and BullMQ
- Next.js admin
- Zod and server-side validation
- Docker Compose for the initial deployment model

Do not change frameworks, database, repository model, or service boundaries without an ADR.

Implementation must:

- use shared executable Schema where practical;
- validate all external input on the server;
- enforce idempotency and uniqueness for daily results and writes;
- separate secrets from code and client bundles;
- redact sensitive logs;
- include relevant tests;
- cover loading, failure, fallback, retry, and deletion;
- keep migrations reversible or explicitly reviewed;
- avoid premature microservices and infrastructure complexity.

## 8. Document lifecycle

Product, AI, design, and technical documents use:

- Planned
- Draft
- Accepted
- Implemented
- Superseded
- Deprecated

ADRs use:

- Proposed
- Accepted
- Rejected
- Superseded
- Deprecated

Rules:

- New specifications start as Draft.
- New ADRs start as Proposed.
- Only user or authorized project confirmation moves them to Accepted.
- Do not mark a document Accepted merely because a PR was opened.
- When the user confirms, update status and acceptance date before merging.
- If a document is replaced, mark it Superseded and link the replacement.
- Update docs/INDEX.md whenever a document is added, accepted, or replaced.

## 9. Git and PR workflow

Unless the user explicitly requests otherwise:

- Do not commit directly to main.
- Create a branch named agent/{short-description}.
- Keep a PR focused on one task or one tightly coupled specification set.
- Create a draft PR for user review.
- State the exact target files before writing.
- Do not include unrelated cleanup.
- Check that the branch is based on current main.
- Verify changed filenames and read back important generated files.
- Describe what changed, why, impact, validation, and decisions needed.
- After user confirmation, update Draft or Proposed statuses to Accepted when applicable.
- Mark the PR ready and merge only after explicit approval.
- Prefer squash merge for one coherent task unless history preservation matters.
- After merge, verify main and update tasks/current.md.

## 10. Required task completion behavior

A task is not complete when the file or code merely exists.

Before requesting review:

- verify all required deliverables;
- compare the branch with main;
- confirm only intended files changed;
- run proportionate tests or validation;
- verify links, Schema, and document metadata;
- update docs/INDEX.md;
- update tasks/current.md to In Review;
- include unresolved decisions in the PR body;
- identify the next task without starting it.

Use `pnpm agent:validate --mode=changed` for fast feedback and
`pnpm agent:validate --mode=task --task=<TASK_ID>` for the task Gate. Before requesting review for
code that can affect behavior, run the required full Gate. Unknown paths, tooling/config changes,
Schema/contracts, security boundaries, or ambiguous impact must expand to full validation.

Successful validation output should be a short summary. Failed output must be bounded and redacted,
with a stable rule ID and the root-cause neighborhood. Never expose secrets, tokens, cookies,
private keys, or real user content in command output or persisted artifacts.

After approval and merge:

- set the completed task to Done;
- move exactly one next task to Ready;
- update the recent handoff in tasks/current.md;
- update tasks/backlog.md;
- verify the merged state on main.

## 11. Session handoff

At the end of any material task, tasks/current.md must be sufficient for a new agent to continue without chat history.

Record:

- current phase;
- task ID and name;
- status;
- branch and PR when present;
- completed deliverables;
- validations performed;
- blockers and decisions needed;
- exact next action;
- next task after acceptance.

The user can resume with:

> 继续 DailyEnergy 当前任务

The agent must then read the repository files before taking action.

## 12. Security and destructive operations

- Never commit secrets, tokens, private keys, production credentials, or real sensitive user content.
- Never use production data in local or test environments without explicit approved anonymization.
- Never perform destructive database migrations, delete branches, delete user data, alter production, or force-update refs without explicit authorization and verified targets.
- Prefer reversible changes.
- Preserve unrelated user work.
- Stop and ask when the target or scope is ambiguous.

## 13. Definition of a good change

A good change:

- advances the current task;
- follows Accepted decisions;
- has explicit scope and non-goals;
- is testable or reviewable;
- handles normal and exceptional states;
- protects privacy and safety;
- does not create unnecessary architecture;
- updates durable project memory;
- leaves one clear next action.
