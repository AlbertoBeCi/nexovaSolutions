# 🐳 Desarrollo local con Docker Compose

**Idea principal:** Docker Compose arranca varios servicios relacionados desde un solo comando y los conecta en una red privada.

## 🚀 Arrancar el entorno

Desde la raíz del repositorio:

```bash
docker compose up
```

| Aplicación | Dirección en el navegador |
| --- | --- |
| Web pública | `http://localhost:3000` |
| Backoffice | `http://localhost:3001` |
| API FastAPI / Swagger | `http://localhost:8000` / `http://localhost:8000/docs` |
| PostgreSQL | Solo accesible dentro de Docker, en `postgres:5432` |

Para crear el administrador local la primera vez, abre otra terminal en la raíz y ejecuta:

```bash
docker compose exec api uv run seed-users
```

El email y la contraseña están en `.env.example` y se pueden cambiar en un `.env` local. No reutilices esos valores fuera del entorno de desarrollo.

## 🧩 Qué procesos arrancan

Compose crea dos servicios de aplicación (`ui` y `api`) y PostgreSQL como dependencia local del inventario. `ui` es un solo contenedor con dos procesos Next.js: website en el puerto interno 3000 y backoffice en 3001. `api` ejecuta FastAPI con Uvicorn y `--reload`. PostgreSQL guarda los activos y movimientos de inventario; TinyDB sigue guardando proveedores, usuarios y perfiles.

`uis/Dockerfile` instala las dependencias de cada frontend por separado con `npm ci` y su `package-lock.json`. `services/Dockerfile` instala `uv` y usa `uv pip install -r requirements.txt`; ese archivo se exporta con versiones fijadas desde `uv.lock`. Cambiar dependencias requiere reconstruir:

```bash
docker compose up --build
```

## 🌐 Nombres de red y navegador

Dentro de la red de Compose, la API encuentra PostgreSQL en `postgres:5432` y Next encuentra la API en `http://api:8000`. Esos nombres son internos: el navegador de tu equipo no puede resolverlos.

Por eso el backoffice llama a `/_nexova-api/...` en su propio origen. Next reenvía la petición al servicio `api`. Así el navegador conserva el mismo origen y las llamadas con autenticación funcionan sin publicar el nombre interno.

## 🔄 Recarga y almacenamiento

Los directorios `src` de las dos apps y el código de la API se montan desde el equipo. Al guardar un archivo, Next aplica HMR y Uvicorn reinicia la API. Las dependencias no se ocultan bajo los montajes: permanecen en sus imágenes.

Volúmenes nombrados conservan la base PostgreSQL, TinyDB y las cachés `.next` cuando se detienen los contenedores. `docker compose down` detiene el entorno sin borrar esos datos. No uses `docker compose down -v` si quieres conservarlos.

## ⚙️ Configuración y comandos útiles

`.env.example` contiene valores locales de desarrollo y Compose lo carga directamente. Un `.env` opcional en la raíz sobreescribe sus valores. Los `.env` reales no se incluyen en los contextos de construcción; la API desactiva dotenv dentro del contenedor.

Cada contexto de construcción tiene su `.dockerignore`: `uis/.dockerignore` y `services/.dockerignore`. El Compose conecta los servicios mediante la red nombrada `nexova-local`; dentro de ella la API está en `api:8000` y PostgreSQL en `postgres:5432`.

Para que las ediciones del host se detecten desde Docker Desktop en Windows, las interfaces arrancan `next dev --webpack` con polling cada segundo (`NEXT_DOCKER_POLLING=1`). Ese ajuste solo se carga en Compose y utiliza algo más de CPU y disco. FastAPI fuerza polling en WatchFiles y reinicia por `--reload`.

### ¿Qué es `SECRET_KEY` y por qué se genera?

La API usa JWT para mantener la sesión después del login. Con el algoritmo `HS256`, `SECRET_KEY` es el secreto que la API usa para **firmar** cada token y comprobar después que nadie lo modificó. No es una clave que se obtenga de Docker, GitHub ni de otra cuenta; la genera el equipo que ejecuta la aplicación. Si alguien conoce esta clave podría fabricar tokens válidos, así que debe ser aleatoria y privada.

Para generar una:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

El comando usa `secrets`, un módulo de Python diseñado para valores criptográficamente aleatorios. `token_urlsafe(48)` toma 48 bytes aleatorios y los representa como texto Base64 seguro para usar en variables de entorno y URLs. El comando solo la **genera y la imprime**; no crea ni modifica ningún archivo.

En Docker Compose, guarda el valor impreso en la variable `SECRET_KEY` del archivo `.env` de la raíz. Si aún no existe, puedes crearlo a partir del ejemplo con `Copy-Item .env.example .env` y luego editarlo; si ya existe, edita ese archivo sin reemplazarlo. Compose lee `.env` para configurar el contenedor `api`. No guardes la clave en `services/api/.env` para Compose: dentro del contenedor dotenv está desactivado y ese archivo se monta desde el ejemplo. El `.env` de la raíz está excluido de Git.

La clave debe mantenerse igual entre reinicios para que las sesiones existentes sigan funcionando. Si la cambias, los JWT firmados con la clave anterior dejarán de validarse y el personal tendrá que iniciar sesión de nuevo. En desarrollo, Compose tiene un valor predeterminado para poder arrancar sin `.env`; una clave propia evita depender de ese valor compartido. El aviso `SECRET_KEY no está definida en el entorno` significa que la API usó su clave interna de desarrollo porque el proceso no recibió la variable.

Si arrancas FastAPI directamente en el host con `uv run uvicorn`, sin Compose, la API lee su configuración desde `services/api/.env`; esa es una ejecución distinta del contenedor.

```bash
docker compose config            # validar la configuración
docker compose logs -f ui api    # seguir los logs
docker compose down              # detener sin borrar datos
```

Este Compose cubre website, backoffice, `services/api` y PostgreSQL. `uis/application` y `services/incident-manager-api` siguen arrancándose por separado según sus README.

📍 [Compose](docker-compose.yml) · [Dockerfile de interfaces](uis/Dockerfile) · [Dockerfile del backend](services/Dockerfile) · [Guía de infraestructura](infra/README.es.md).

🏠 [Volver al índice](APRENDIENDO.md)
