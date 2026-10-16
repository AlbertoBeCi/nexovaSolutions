# Local development infrastructure

The repository-root `docker-compose.yml` runs the public website, backoffice, `services/api`, and local PostgreSQL. From the root, start them with `docker compose up`; use `docker compose up --build` after changing a Dockerfile or dependency lockfile.

Dockerfiles live beside the code they package: `uis/Dockerfile` builds the Node Alpine image and `services/Dockerfile` builds the Python API. `uis/start.sh` starts the website and backoffice in one container. Each build context has its own `.dockerignore`; source directories are mounted for hot reload and data uses named volumes.

In Docker Desktop, the interfaces use Webpack with one-second polling (`NEXT_DOCKER_POLLING=1`) because Windows file mounts can delay filesystem events. This Compose-only setting adds some CPU and disk activity; development outside Docker keeps Next's normal configuration.

The root `.env.example` contains local development values and Compose loads it directly. An optional root `.env` overrides them; real `.env` files are excluded from build contexts. The API installs the versions pinned in `services/api/requirements.txt`, exported from `uv.lock`. Run `docker compose exec api uv run seed-users` once to create a local administrator. Do not use these development credentials outside the local environment.

The backoffice proxies browser API requests through Next.js to the Compose service name `api`. The API connects to PostgreSQL as `postgres`; all services share the explicitly named `nexova-local` network, and PostgreSQL's port is not published on the host. Development ports are 3000 (website), 3001 (backoffice), and 8000 (API). See the root README for startup instructions.

> _Spanish version: [README.es.md](./README.es.md)._
