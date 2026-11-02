# Local development infrastructure

The repository-root `docker-compose.yml` runs the public website, backoffice and `services/api`, with inventory in Supabase PostgreSQL. Configure the root `.env` and `services/api/.env` as described in the root README, then start with `docker compose up`; use `docker compose up --build` after changing a Dockerfile or dependency lockfile. A missing or empty root `SUPABASE_DATABASE_URL` stops Compose before startup.

Dockerfiles live beside the code they package: `uis/Dockerfile` builds the Node Alpine image and `services/Dockerfile` builds the Python API. `uis/start.sh` starts the website and backoffice in one container. Each build context has its own `.dockerignore`; source directories are mounted for hot reload and data uses named volumes.

In Docker Desktop, the interfaces use Webpack with one-second polling (`NEXT_DOCKER_POLLING=1`) because Windows file mounts can delay filesystem events. This Compose-only setting adds some CPU and disk activity; development outside Docker keeps Next's normal configuration.

The API loads `.env.example`, the required root `.env`, then the required `services/api/.env`. Compose explicitly selects the root `SUPABASE_DATABASE_URL`, sets container persistence paths and disables dotenv. Authentication secrets and bootstrap credentials come from `services/api/.env`; there is no shared development password in the root example. Real `.env` files are excluded from build contexts and the API's mounted `.env` remains masked by its safe example.

The existing backend source mount also shares `services/api/data/users.json`; Docker and host execution use the same accounts, profiles, password hashes and UUIDs. Only for a new store, run `docker compose exec api uv run --no-sync seed-users`. Suppliers retain the `api_data` volume; Next.js retains its cache volumes. The API installs the versions pinned in `services/api/requirements.txt`, exported from `uv.lock`.

The backoffice proxies browser API requests through Next.js to the Compose service name `api`. The API connects to the Supabase URL with `sslmode=require`; all containers share the explicitly named `nexova-local` network. Compose no longer defines a local PostgreSQL service or volume. Existing PostgreSQL volumes are not deleted or migrated; an old PostgreSQL container can be stopped separately. Development ports are 3000 (website), 3001 (backoffice), and 8000 (API). After environment changes, recreate the API with `docker compose up -d --no-deps --force-recreate api`.

> _Spanish version: [README.es.md](./README.es.md)._
