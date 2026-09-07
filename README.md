# Nexova Solutions — AI Engineering Company Project

[![4Geeks Academy](https://img.shields.io/badge/4Geeks-Academy-blue)](https://4geeksacademy.com)
[![AI Engineering](https://img.shields.io/badge/track-AI%20Engineering-green)](https://4geeksacademy.com/es/programas-de-carrera/ingenieria-ia)

_Transversal project of the 4Geeks Academy AI Engineering Career Program, built on the fictional company **Nexova Solutions** (HR consultancy and talent acquisition — Valencia + Miami). Based on the 4Geeks monorepo template._

_Estas instrucciones tambien estan disponibles en [espanol](./README.es.md)._

---

## Purpose

One company built across many milestones (Web, Programming, Backend, Telemetry, RAG, Agents, Workflows, Real-time). Each top-level folder has a single responsibility, like a real engineering team repo.

- **[`CONTEXT.md`](./CONTEXT.md)** is the single source of truth for the domain (field names, texts, validations, business rules). Per-milestone briefings live in [`docs/context/`](./docs/context/).
- **[`AGENTS.md`](./AGENTS.md)** defines how any AI agent operates here: what to read at the start of a session, the mandatory pre-commit flow, and what must not be changed without confirmation.
- Detailed rules and reusable skills live in [`.agents/`](./.agents/); project memory in [`memory-bank/`](./memory-bank/).

---

## How to work here

1. **Read** [`AGENTS.md`](./AGENTS.md) and the [`memory-bank/`](./memory-bank/) files.
2. **Open the `README.md`** of the folder you are going to work in, plus its rule in [`.agents/rules/`](./.agents/rules/) if it has one.
3. **Implement in the right folder** — never dump code in the root.
4. **Document** what you add: every new app, service, agent or pipeline gets a subfolder + `README.md`.

---

## How to run the apps

Each app has its own `package.json` and `node_modules` — run commands from its folder.

| App | Path | Commands |
| --- | --- | --- |
| Public website (Milestone 1) | [`uis/website/`](./uis/website/) | `npm install` · `npm run dev` (→ http://localhost:3000) |
| Backoffice — talent pipeline (Milestone 3) | [`uis/backoffice/`](./uis/backoffice/) | `npm install` · `npm run dev` — needs `.env.local` (see `.env.example`) |
| Domain model + logic (Milestone 2) | [`packages/domain/`](./packages/domain/) | `npm install` · `npm run typecheck` · `npm run demo` |

---

## How to think about this monorepo

| Layer               | Folders                           | What lives here                                                  |
| ------------------- | --------------------------------- | ---------------------------------------------------------------- |
| **Company context** | `CONTEXT.md`, `docs/context/`     | Domain facts, field names, constraints, per-milestone briefings  |
| **Agent config**    | `AGENTS.md`, `.agents/`, `memory-bank/` | How agents operate, rules, skills, project memory          |
| **User-facing**     | `uis/`, `services/`               | Frontends and backends users (or operators) interact with        |
| **Data**            | `data/`                           | Raw files, pipelines, processed datasets, evaluation sets        |
| **AI**              | `agents/`, `skills/`, `mcps/`     | Agents, reusable agent capabilities, MCP tool servers            |
| **Automation**      | `workflows/`                      | n8n flows and cross-system orchestration                         |
| **Reuse**           | `packages/`, `shared/`            | Shared types, domain logic, SDKs, schemas, templates             |
| **Operations**      | `infra/`, `scripts/`, `internal/` | Docker, deploy configs, one-off scripts, internal CLIs           |
| **Documentation**   | `docs/`                           | Architecture, decisions, conventions, prompt log                 |

**Rule of thumb:** if it has a UI → `uis/`. If it exposes an API or runs in the background → `services/`. If it moves or transforms data → `data/`. If an AI model does the work → `agents/` (+ `skills/` or `mcps/` as needed).

---

## Project status

| Milestone | Deliverable | Status |
| --- | --- | --- |
| 1 — Public web | Corporate landing + talent-capture form (responsive, accessible, SEO) | ✅ In [`uis/website/`](./uis/website/) (Next.js/React). Migrated from the original static HTML, now removed. |
| 2 — Programming fundamentals | Domain model + logic (scoring, matching, filtering) in TypeScript | ✅ In [`packages/domain/`](./packages/domain/) (`@repo/domain`) |
| 3 — Talent pipeline | Internal app: candidate list with filters, detail view, create/edit, notes; consumes the 4Geek Tracker API | 🚧 In [`uis/backoffice/`](./uis/backoffice/) |
| 4+ — Backend, Telemetry, RAG, Agents, Workflows, Real-time | — | ⏳ Not started |

`services/`, `data/`, `agents/`, `mcps/`, `workflows/`, `infra/`, `internal/` are still empty scaffolding.

---

## Folder guide — what goes where

Read the linked `README.md` inside each folder before you start coding there.

### Root files

| Path                         | Purpose                                                                   | What you do here                                                        |
| ---------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [`CONTEXT.md`](./CONTEXT.md) | Single source of truth for the Nexova domain                              | Read it before building anything; only the developer changes it       |
| [`AGENTS.md`](./AGENTS.md)   | How any AI agent operates in this repo                                    | Session-start reading, pre-commit flow, no-touch list                 |
| `README.md` / `README.es.md` | This guide                                                                | Orientation — you are here                                            |
| `docker-compose.yml`         | Local dev orchestration (not present yet)                                 | Add at repo root once `services/` and databases exist                 |

### `uis/` — user interfaces

**Purpose:** All frontend applications — anything a human sees and clicks.

**Put here:**

- Public website → [`uis/website/`](./uis/website/)
- Internal admin / backoffice → [`uis/backoffice/`](./uis/backoffice/)
- Customer portals, dashboards with a UI, Streamlit/Gradio tools

Each app: its own `package.json`, `README.md`, layout and a working entry view from the first commit.

→ See [`uis/README.md`](./uis/README.md)

### `services/` — centralized company API (FastAPI)

**Purpose:** One **centralized FastAPI backend** for the whole company — a single entry point that keeps complexity low as the project grows.

**Put here:**

- One main FastAPI app (e.g. `api/`) with routers/modules per domain
- Background workers only when they truly need to run separately from the API

**Recommendation:** avoid splitting into many microservices early.

→ See [`services/README.md`](./services/README.md)

### `data/` — datasets, pipelines, and evaluation

**Purpose:** Everything data-related, from raw files to production-ready tables.

| Subfolder                                       | Purpose                      | What you do here                                                          |
| ----------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------- |
| [`data/raw/`](./data/raw/README.md)             | Untouched source data        | Store dumps, exports, sample CSVs/JSON — document origin and PII rules    |
| [`data/pipelines/`](./data/pipelines/README.md) | ETL/ELT jobs                 | Write ingestion, cleaning, and transformation scripts                     |
| [`data/process/`](./data/process/README.md)     | Clean / intermediate outputs | Save artifacts produced by pipelines (features, aggregates, clean tables) |
| [`data/eval/`](./data/eval/README.md)           | Quality measurement          | Golden sets, RAG/agent eval datasets, experiment metrics                  |

**Flow:** `raw` → `pipelines` → `process` → consumed by `services/`, `uis/`, or `agents/`. Use `eval` to prove quality.

### `agents/` — AI agents

**Purpose:** Autonomous or semi-autonomous AI assistants for the company.

**Put here:**

- One subfolder per agent (e.g. `support-agent/`, `onboarding-agent/`)
- Agent config, prompts, tools wiring, tests
- Start from [`agents/_template/`](./agents/_template/README.md) when creating a new agent

> Not to be confused with [`.agents/`](./.agents/), which holds agent **configuration** (rules and skills) for whoever works in this repo.

→ See [`agents/README.md`](./agents/README.md)

### `skills/` — reusable agent capabilities

**Purpose:** Packaged instructions + scripts that agents reuse across the repo.

**Put here:**

- Skills for data analysis, code review, scraping, research, etc.
- Each skill = a folder with `SKILL.md`, optional scripts and resources

> Project-specific skills live in [`.agents/skills/`](./.agents/skills/); `skills/` and `.claude/skills/` are from the template.

→ See [`skills/README.md`](./skills/README.md)

### `mcps/` — Model Context Protocol servers

**Purpose:** Bridge AI models to your systems — databases, APIs, GitHub, custom tools.

**Put here:** one subfolder per MCP server, with its tool definitions, resources and server config.

→ See [`mcps/README.md`](./mcps/README.md)

### `workflows/` — automation and orchestration

**Purpose:** Connect systems without writing full apps — scheduled jobs, webhooks, notifications.

**Put here:** n8n workflow exports, Make/Zapier configs, or orchestration docs that link `services/`, `data/pipelines/`, and `agents/`.

→ See [`workflows/README.md`](./workflows/README.md)

### `packages/` — shared libraries

**Purpose:** Versionable code reused by multiple apps, agents, or pipelines.

**Put here:**

- [`packages/domain/`](./packages/domain/) → `@repo/domain` — recruitment domain model + logic (Milestone 2)
- [`packages/shared/`](./packages/shared/) → `@repo/shared-types` — types shared across apps and services
- UI component libraries, API clients, analytics SDKs

**Rule:** if `uis/` and `services/` both need the same interface → extract it here.

→ See [`packages/README.md`](./packages/README.md)

### `shared/` — loose shared assets

**Purpose:** Resources that are not a full package — schemas, templates, static assets, short docs.

→ See [`shared/README.md`](./shared/README.md)

### `docs/` — cross-cutting documentation

**Purpose:** Architecture and decisions that span the whole company project.

**Contains:** [`docs/context/`](./docs/context/) (per-milestone briefings), `docs/company-choice.md`, `docs/prompts.md` (prompt log). Add architecture diagrams, ADRs and conventions here.

→ See [`docs/README.md`](./docs/README.md)

### `infra/` — infrastructure and deployment

**Purpose:** How the company project runs in Docker, cloud, or CI. Dockerfiles, Terraform, K8s manifests, Nginx configs, CI/CD pipelines.

→ See [`infra/README.md`](./infra/README.md)

### `scripts/` — helper scripts

**Purpose:** Small, repeatable automation — not full apps. Setup scripts, seed generators, one-off migrations. Document each one.

→ See [`scripts/README.md`](./scripts/README.md)

### `internal/` — internal developer tools

**Purpose:** Robust utilities for the engineering team — CLIs, packaged migration tools, prompt evaluators, with their own `package.json` and tests.

→ See [`internal/README.md`](./internal/README.md)

---

## Where should I put this?

```text
Public website?                            → uis/website/
Internal app (operators / HR)?             → uis/backoffice/
Runs on a server / API / queue?            → services/
Raw or transformed data?                   → data/raw/ or data/process/
Moves data between systems?                → data/pipelines/
Measures AI / pipeline quality?            → data/eval/
An AI assistant with a goal?               → agents/
A rule for how agents work here?           → .agents/rules/
A reusable agent skill?                    → .agents/skills/
Project state to remember between sessions?→ memory-bank/
Code imported by 2+ folders?               → packages/
A schema / template / asset, not a lib?    → shared/
Architecture or team-wide docs?            → docs/
Docker / deploy / cloud config?            → infra/
A one-off script?                          → scripts/
A CLI tool with its own package?           → internal/
```

---

## Repository structure (tree)

```text
nexovaSolutions/
├── README.md / README.es.md   # This guide
├── CONTEXT.md                 # Domain source of truth (Milestone 1 briefing)
├── AGENTS.md                  # How AI agents operate here
├── .agents/
│   ├── rules/                 # Dev rules with declared scope
│   └── skills/                # Reusable agent skills (+ verifier scripts)
├── memory-bank/               # Project memory (business + technical + state)
├── uis/
│   ├── website/               # Public corporate site (Next.js) — Milestone 1
│   └── backoffice/            # Talent pipeline app (Next.js) — Milestone 3
├── packages/
│   ├── domain/                # @repo/domain — recruitment logic — Milestone 2
│   └── shared/                # @repo/shared-types
├── services/                  # Centralized FastAPI company API (empty)
├── data/{raw,pipelines,process,eval}/   # Data lifecycle (empty)
├── agents/                    # AI agents (+ _template/ starter) (empty)
├── skills/  mcps/  workflows/ # Template scaffolding (empty)
├── docs/                      # context/, company-choice.md, prompts.md
├── infra/  scripts/  internal/  shared/ # (empty)
```

---

## Links

- [4Geeks Academy — AI Engineering](https://4geeksacademy.com/es/programas-de-carrera/ingenieria-ia)
- [How to start a coding project](https://4geeks.com/lesson/how-to-start-a-project)

---

## Contributors

Built on the 4Geeks Academy AI Engineering monorepo template by [@marcogonzalo](https://www.linkedin.com/in/marcogonzalo) and [@alezanchezr](https://x.com/alesanchezr) and many other contributors. Find out more about our [AI Engineering Course](https://4geeksacademy.com/en/career-programs/ai-engineering), and [other courses](https://4geeksacademy.com/en/program-comparison).

You can find other templates and resources like this at the [4Geeks Academy GitHub page](https://github.com/4geeksacademy).
