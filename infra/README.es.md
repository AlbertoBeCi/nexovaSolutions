# Infraestructura de desarrollo local

El `docker-compose.yml` de la raíz ejecuta la web pública, el backoffice, `services/api` y PostgreSQL local. Desde la raíz, arráncalos con `docker compose up`; usa `docker compose up --build` después de cambiar un Dockerfile o un archivo de bloqueo de dependencias.

Los Dockerfiles viven junto al código que contienen: `uis/Dockerfile` construye la imagen Node Alpine y `services/Dockerfile` construye la API Python. `uis/start.sh` arranca website y backoffice en un solo contenedor. Cada contexto tiene su propio `.dockerignore`; las carpetas de código se montan para permitir recarga en caliente y los datos usan volúmenes nombrados.

En Docker Desktop, las interfaces usan Webpack con polling cada segundo (`NEXT_DOCKER_POLLING=1`) porque el montaje de archivos de Windows puede retrasar eventos del sistema. Es un ajuste solo de Compose; añade algo de actividad de CPU y disco. En desarrollo fuera de Docker, Next mantiene su configuración normal.

El `.env.example` de la raíz contiene valores locales de desarrollo y Compose los carga directamente. Un `.env` opcional en la raíz los sobreescribe; los `.env` reales se excluyen de los contextos de construcción. La API instala las versiones fijadas en `services/api/requirements.txt`, exportadas desde `uv.lock`. Ejecuta una vez `docker compose exec api uv run seed-users` para crear un administrador local. No uses estas credenciales de desarrollo fuera del entorno local.

El backoffice envía las llamadas del navegador a la API mediante un proxy de Next.js hacia el servicio Compose `api`. La API accede a PostgreSQL por `postgres`; los servicios comparten la red con nombre `nexova-local` y el puerto de PostgreSQL no se publica en el host. Los puertos de desarrollo son 3000 (website), 3001 (backoffice) y 8000 (API). Consulta el README de la raíz para ver instrucciones de inicio.
