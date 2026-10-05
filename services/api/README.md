# `services/api` — Nexova API

Nexova's single FastAPI backend, with one router per domain:

- **incidents** (`/api/incidents`): exposes the same support-ticket analysis
  logic as `scripts/analyze.py` over HTTP, so a CSV can be uploaded from a
  frontend or any HTTP client.
- **suppliers** (`/suppliers`): supplier directory with each contract's monthly
  rate (Spain in EUR, USA in USD), persisted in TinyDB. Consumed by
  `uis/application` (`/suppliers` page).
- **users** / **auth** / **profiles**: user registration, JWT login and user
  profiles, persisted in their own TinyDB file. See "Authentication" below.

### Authentication

- `User` (email, hashed password, `is_active`, `role`) and `Profile` (name,
  phone, address, linked by `user_id`) live only in TinyDB
  (`users_db.py`, `USERS_DB_PATH`, default `services/api/data/users.json`) —
  separate from the suppliers TinyDB file.
- Passwords are hashed with `libpass[bcrypt]` (a maintained drop-in fork of
  `passlib`; it installs as the `passlib` package, so the code imports
  `passlib.context.CryptContext`). Sessions are stateless JWTs signed with
  `python-jose` (`security.py`).
- `POST /users` is the only public endpoint of `/users`: it always creates a
  `role="user"` account (the request body cannot contain `role` — it is
  rejected with `422 extra_forbidden`, same pattern as `id`/`updated_at` on
  `ProviderCreate`) and optionally creates a linked `Profile` in the same
  call.
- Every other `/users` route, `GET /auth/me`, and `/profiles/me` require a
  valid `Authorization: Bearer <token>` (obtained from `POST /auth/login`).
  `GET/PUT/DELETE /users/{id}` additionally require the caller to be that
  same user or an admin (`403` otherwise); changing `role` on `PUT
  /users/{id}` requires an admin.
- Five pre-existing routes now also require login (read-only routes stay
  public): `POST /suppliers`, `PATCH /suppliers/{id}/rate`, `PATCH
  /suppliers/{id}/status`, `DELETE /suppliers/{id}`, and `POST
  /api/incidents/analyze`.
- The first admin is bootstrapped with `uv run seed-users` from
  `ADMIN_EMAIL`/`ADMIN_PASSWORD` (see "Environment variables"). It is
  idempotent: re-running it never changes an existing account's role or
  password.
- **Forgot / reset / change password** (`POST /auth/forgot-password`,
  `POST /auth/reset-password`, `POST /auth/change-password`): reset tokens
  are stateless JWTs (`type="password_reset"`) that embed a fingerprint of
  the password hash at issue time, so they — and, the same way, every
  previously-issued **access** token — stop validating the moment the
  password actually changes. No revoked-token table needed. `new_password`
  on reset/change must be 8+ chars with at least one uppercase, one
  lowercase and one digit (this policy does **not** apply to `POST /users`
  registration, which only requires 8+ chars). `forgot-password` and
  `reset-password` are rate-limited per IP (5 requests / 15 min, in-memory).
- **Email delivery** (`mailer.py`): `forgot-password` sends the reset link
  through [Resend](https://resend.com) when `RESEND_API_KEY` is set. Without
  it (or if the Resend call fails), it falls back to logging the token to
  the server console (logger `auth`) — that's the default in a fresh
  checkout, so the flow is testable with zero external setup. With Resend's
  own test sender (`onboarding@resend.dev`, the `RESEND_FROM_EMAIL`
  default), delivery only reaches the email the Resend account was created
  with, until a real domain is verified there.
- `uis/application` now has a minimal login (`/login`), `/forgot-password`,
  `/reset-password` and `/account/change-password` (see that app's README).
  `uis/website` and `uis/backoffice` still don't consume this auth system.

## Requirements

- Python 3.10+
- [uv](https://docs.astral.sh/uv/) (recommended). Dependencies are declared in
  `pyproject.toml` (FastAPI, Uvicorn, python-multipart, pandas, TinyDB,
  email-validator, libpass, python-jose, python-dotenv, resend);
  `requirements.txt` is kept in sync for pip users.

## Install and run (development)

```bash
cd services/api
uv sync                                      # creates .venv, installs deps + dev group
cp .env.example .env                         # fill in SECRET_KEY, ADMIN_EMAIL, ADMIN_PASSWORD
uv run seed                                  # loads the initial suppliers (idempotent)
uv run seed-users                            # bootstraps the first admin (idempotent)
uv run uvicorn main:app --reload --port 8000
```

With pip: `pip install -r requirements.txt`, `python seed.py` and
`uvicorn main:app --reload --port 8000`.

Interactive docs (Swagger UI) once running:

```
http://localhost:8000/docs
```

Also available as Redoc at `http://localhost:8000/redoc` and the raw OpenAPI
schema at `http://localhost:8000/openapi.json`. To try protected routes in
Swagger: `POST /auth/login`, copy `access_token`, click "Authorize" and enter
`Bearer <token>`.

### Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `SUPPLIERS_DB_PATH` | `services/api/data/suppliers.json` | TinyDB file for suppliers (git-ignored). |
| `USERS_DB_PATH` | `services/api/data/users.json` | TinyDB file for users/profiles (git-ignored). |
| `CORS_ORIGINS` | `localhost`/`127.0.0.1` on ports 3000 and 3001 | Allowed origins, comma-separated. |
| `SECRET_KEY` | dev-only fallback (logs a warning) | JWT signing key. **Must** be set explicitly in production. |
| `ALGORITHM` | `HS256` | JWT signing algorithm. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Access token lifetime, in minutes. |
| `PASSWORD_RESET_EXPIRE_MINUTES` | `15` | Password-reset token lifetime, in minutes. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | none | First admin's credentials, used only by `uv run seed-users`. |
| `RESEND_API_KEY` | none (falls back to console logging) | API key for [Resend](https://resend.com). Enables real email delivery for `forgot-password`. |
| `RESEND_FROM_EMAIL` | `Nexova <onboarding@resend.dev>` | Sender address. Needs a verified domain in Resend to deliver to arbitrary recipients. |
| `FRONTEND_URL` | `http://localhost:3001` | Base URL used to build the `/reset-password?token=...` link in the email (and in the console fallback). |

Copy `.env.example` to `.env` (git-ignored, see `services/api/.gitignore`) and
fill in real values for development.

### Tests

```bash
uv run pytest
```

Full test guide (what each file checks, how to read a pass/fail, coverage): [`TESTING.md`](../../docs/entrega/TESTING.md).

`tests/test_suppliers.py` covers every `/suppliers` endpoint and the seeder's
idempotency; `tests/test_auth.py`, `tests/test_users.py` and
`tests/test_profiles.py` cover registration, login, `/users` permissions and
`/profiles/me`; `tests/test_protected_routes.py` checks that the five
newly-protected routes reject requests without a token and accept a valid
one; `tests/test_password_reset.py` covers forgot/reset/change-password
(single-use tokens, weak-password rejection, rate limiting, and previously
issued access tokens becoming invalid after a password change). All of them
run against a temporary TinyDB per test (`tests/conftest.py` has the shared
user/token fixtures, plus an autouse fixture that resets the in-memory rate
limiter between tests).

## Endpoints — incidents

### `POST /api/incidents/analyze`

Accepts a support-ticket CSV as `multipart/form-data` (field `file`), applies
the 7 business validation rules, and returns an aggregated JSON summary
(never row-level data, never `customer_email`). The result is stored in
memory as the "last analysis".

- `200`: analysis summary (see `AnalysisSummary` in `models.py`).
- `400`: no `.csv` file attached, empty file, invalid CSV, or missing
  required columns.
- `422`: no `file` field sent (FastAPI's automatic validation).

`POST /api/incidents/analyze` requires login (`Authorization: Bearer <token>`).

### `GET /api/incidents/results/export`

Downloads the result of the last analysis run in this process, as a CSV (one
row per metric). Requires login (`Authorization: Bearer <token>`).

- `200`: downloadable `results.csv` file (`Content-Disposition: attachment`).
- `401`: missing or invalid token.
- `404`: no analysis has been run yet in this process.

## Endpoints — users / auth / profiles

Models in `models.py`: `UserCreate` (registration payload — `extra="forbid"`,
no `role`/`id`/`hashed_password`/`created_at`/`is_active`) and `UserResponse`
(never includes the password or its hash; embeds `profile` when one exists).
`ProfileCreate`/`ProfileUpdate`/`ProfileResponse` follow the same pattern for
`/profiles/me`.

| Method and path | Protection | Response |
| --- | --- | --- |
| `POST /users` | Public | `201` with the new user (+ `profile` if sent). `409` on a duplicate email, `422` on an invalid payload. |
| `GET /users` | Admin | `200` with every user. `403` for a non-admin. |
| `GET /users/{id}` | Self or admin | `200` with the user. `403` for another user, `404` if missing. |
| `PUT /users/{id}` | Self or admin | Body `{"email"?, "role"?}`. `200` with the updated user. `403` if a non-admin sends `role` or targets another user. `409` on a duplicate email. |
| `DELETE /users/{id}` | Self or admin | `204`, also deletes the linked `Profile`. `403`/`404`. |
| `POST /auth/login` | Public | `OAuth2PasswordRequestForm` (`username`=email, `password`). `200` with `{"access_token", "token_type": "bearer"}`. `401` on bad credentials. |
| `GET /auth/me` | Login | `200` with the current user (+ `profile`). |
| `GET /profiles/me` | Login | `200` with the profile. `404` if not created yet. |
| `PUT /profiles/me` | Login | Body `{"name", "phone"?, "address"?}`. Upsert: `200`, creates the profile on first call. |
| `POST /auth/forgot-password` | Public | Body `{"email"}`. Always `200` with the same generic message. `429` if rate-limited (5/15min per IP). No email is sent — the reset token is logged to the console. |
| `POST /auth/reset-password` | Public | Body `{"token", "new_password"}`. `200` on success. `400` on an invalid/expired/already-used token or if `new_password` equals the current one. `422` if `new_password` is too weak. `429` if rate-limited. |
| `POST /auth/change-password` | Login | Body `{"current_password", "new_password"}`. `200` with a **new** `Token` (the change invalidates every previously issued access token, including the one used to call this endpoint). `401` if `current_password` is wrong. `400` if `new_password` equals the current one. `422` if too weak. |

## Endpoints — suppliers

Models in `models.py`: `ProviderCreate` (input) and `ProviderResponse`
(output = `ProviderCreate` + `id` + `updated_at`). `id` is TinyDB's `doc_id`, and
`updated_at` (UTC) is set by the system on creation and on every change. Request
bodies forbid unknown fields (`extra="forbid"`), so a client sending `id` or
`updated_at` gets a `422` (`extra_forbidden`) instead of having it silently ignored.

Validation (automatic `422` on failure): non-empty `name`; `country` `Spain` or
`USA`; `categories` with at least one of `software`, `infrastructure`,
`logistics`, `marketing`, `payments`, `security`, `other`; `monthly_rate` > 0;
`currency` `EUR` for Spain and `USD` for USA; `status` `active` or `suspended`;
optional `contract_renewal_date` (`YYYY-MM-DD`), `contact_email` and `notes`.

| Method and path | Protection | Response |
| --- | --- | --- |
| `POST /suppliers` | Login | `201` with the created supplier. `401` without a token, `422` on an invalid payload. |
| `GET /suppliers?country=&category=` | Public | `200` with the list. Optional, combinable filters; none returns all. |
| `GET /suppliers/{id}` | Public | `200` with the detail. `404` if it does not exist. |
| `PATCH /suppliers/{id}/rate` | Login | Body `{"monthly_rate": > 0}`. `200` with the record and a new `updated_at`. `401` without a token, `422` if ≤ 0, `404` if missing. |
| `PATCH /suppliers/{id}/status` | Login | Body `{"status": "active" \| "suspended"}`. `200` with the record. `401` / `422` / `404`. |
| `DELETE /suppliers/{id}` | Login | `204` with no body. `401` without a token, `404` if it does not exist. |

`404` errors return `{"detail": "Proveedor no encontrado."}` (Spanish, shown as-is by the UI).

### Seed data (`uv run seed`)

`seed.py` reads `fixtures/suppliers.json`, validates each supplier with
`ProviderCreate`, and only inserts those not already present by `name`
(case- and extra-whitespace-insensitive). It can be run any number of times:

```
[INFO] Seed completed: 9 new suppliers added, 0 already existed.
[INFO] Seed completed: 0 new suppliers added, 9 already existed.
```

## Persistence

- **Suppliers**: TinyDB, a single JSON file (`SUPPLIERS_DB_PATH`). Designed for
  one process: reads/writes are serialized with a lock because TinyDB is not
  thread-safe. Multiple workers/instances would require a real database.
- **Users / profiles**: a separate TinyDB JSON file (`USERS_DB_PATH`), same
  one-process design and locking strategy as suppliers, but its own lock and
  file so auth traffic never blocks supplier reads/writes or vice versa.
- **Last incidents analysis**: process-memory variable (`store.py`), no disk.
  It is **lost on restart** and not shared across instances; if needed,
  migrate to an external store (Redis, a table, etc.).

## Privacy

Just like `scripts/analyze.py`, this service never prints, logs, or returns
an individual `customer_email` in any response: every incidents output path
(`AnalysisSummary` and the CSV export) only works with aggregates computed in
`shared/incidents_analysis.py::build_summary`.

## Structure

```
services/api/
├── pyproject.toml          # uv project: deps, dev group, `seed`/`seed-users` commands
├── uv.lock
├── requirements.txt        # same deps, for pip
├── .env.example             # documents SECRET_KEY, ADMIN_EMAIL, etc. (no real secrets)
├── .gitignore                # ignores .env (keeps .env.example)
├── main.py                 # FastAPI app: CORS + routers
├── config.py                 # loads .env; JWT/admin settings
├── models.py               # Pydantic models (suppliers, incidents, users/auth, errors)
├── database.py             # suppliers TinyDB setup + lock
├── users_db.py               # users/profiles TinyDB setup + lock
├── security.py                # password hashing, JWT, get_current_user/get_current_admin
├── rate_limit.py               # in-memory rate limiter (forgot/reset-password)
├── mailer.py                    # Resend email delivery (forgot-password), console fallback
├── routes/
│   ├── incidents.py        # /api/incidents
│   ├── suppliers.py        # /suppliers
│   ├── users.py               # /users
│   ├── auth.py                 # /auth (login, me, forgot/reset/change-password)
│   └── profiles.py             # /profiles
├── analysis.py             # HTTP adapter over shared/incidents_analysis.py
├── store.py                # in-memory store for the last analysis
├── seed.py                 # idempotent supplier loader
├── seed_users.py              # idempotent admin bootstrap
├── fixtures/suppliers.json # seeder input data
├── tests/
│   ├── conftest.py            # shared user/token fixtures, rate-limit reset
│   ├── test_suppliers.py
│   ├── test_auth.py
│   ├── test_users.py
│   ├── test_profiles.py
│   ├── test_protected_routes.py
│   └── test_password_reset.py
└── data/                   # local TinyDB (git-ignored)
```

> _Spanish version: [README.es.md](./README.es.md)._
