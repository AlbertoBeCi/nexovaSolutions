# `services/api` — Nexova API

Backend FastAPI único de Nexova, con un router por dominio:

- **incidents** (`/api/incidents`): expone por web la misma lógica de análisis
  de tickets de soporte que `scripts/analyze.py`, para poder subir un CSV desde
  un frontend o cualquier cliente HTTP.
- **suppliers** (`/suppliers`): directorio de proveedores con su tarifa mensual
  por contrato (Spain en EUR, USA en USD), persistido en TinyDB. Lo consume
  `uis/application` (página `/suppliers`).
- **users** / **auth** / **profiles**: registro de usuarios, login con JWT y
  perfiles de usuario, persistidos en su propio fichero TinyDB. Ver
  "Autenticación" abajo.

### Autenticación

- `User` (email, hash de contraseña, `is_active`, `role`) y `Profile` (name,
  phone, address, vinculado por `user_id`) viven solo en TinyDB
  (`users_db.py`, `USERS_DB_PATH`, por defecto `services/api/data/users.json`)
  — en un fichero separado del de proveedores.
- Las contraseñas se hashean con `libpass[bcrypt]` (fork mantenido y
  drop-in de `passlib`; se instala como el paquete `passlib`, asi que el
  codigo importa `passlib.context.CryptContext`). Las sesiones son JWT sin
  estado firmados con `python-jose` (`security.py`).
- `POST /users` es el único endpoint público de `/users`: siempre crea una
  cuenta con `role="user"` (el body no puede incluir `role` — se rechaza con
  `422 extra_forbidden`, igual que `id`/`updated_at` en `ProviderCreate`) y
  opcionalmente crea un `Profile` vinculado en la misma llamada.
- El resto de rutas de `/users`, `GET /auth/me` y `/profiles/me` exigen un
  `Authorization: Bearer <token>` válido (obtenido con `POST /auth/login`).
  `GET/PUT/DELETE /users/{id}` exigen además que quien llama sea ese mismo
  usuario o un admin (`403` si no); cambiar `role` en `PUT /users/{id}`
  requiere ser admin.
- Cinco rutas ya existentes ahora también exigen login (las lecturas siguen
  públicas): `POST /suppliers`, `PATCH /suppliers/{id}/rate`, `PATCH
  /suppliers/{id}/status`, `DELETE /suppliers/{id}` y `POST
  /api/incidents/analyze`.
- El primer admin se crea con `uv run seed-users` desde
  `ADMIN_EMAIL`/`ADMIN_PASSWORD` (ver "Variables de entorno"). Es idempotente:
  volver a ejecutarlo nunca cambia el rol ni la contraseña de una cuenta ya
  existente.
- **`uis/application` todavía no se actualizó**: llama a las rutas de
  `/suppliers` ahora protegidas sin token, asi que esas llamadas devolveran
  `401` desde la UI actual hasta una tarea de frontend posterior que agregue
  login/manejo de token.

## Requisitos

- Python 3.10+
- [uv](https://docs.astral.sh/uv/) (recomendado). Dependencias declaradas en
  `pyproject.toml` (FastAPI, Uvicorn, python-multipart, pandas, TinyDB,
  email-validator, libpass, python-jose, python-dotenv); `requirements.txt`
  se mantiene igual para quien use pip.

## Instalación y arranque (desarrollo)

```bash
cd services/api
uv sync                                      # crea .venv e instala deps + grupo dev
cp .env.example .env                         # completa SECRET_KEY, ADMIN_EMAIL, ADMIN_PASSWORD
uv run seed                                  # carga los proveedores iniciales (idempotente)
uv run seed-users                            # crea el primer admin (idempotente)
uv run uvicorn main:app --reload --port 8000
```

Con pip: `pip install -r requirements.txt`, `python seed.py` y
`uvicorn main:app --reload --port 8000`.

Documentación interactiva (Swagger UI) una vez arrancado:

```
http://localhost:8000/docs
```

También disponible en formato Redoc en `http://localhost:8000/redoc` y el
esquema OpenAPI crudo en `http://localhost:8000/openapi.json`. Para probar
rutas protegidas en Swagger: `POST /auth/login`, copia `access_token`, click
en "Authorize" e ingresa `Bearer <token>`.

### Variables de entorno

| Variable | Por defecto | Uso |
| --- | --- | --- |
| `SUPPLIERS_DB_PATH` | `services/api/data/suppliers.json` | Archivo TinyDB de proveedores (ignorado por git). |
| `USERS_DB_PATH` | `services/api/data/users.json` | Archivo TinyDB de usuarios/perfiles (ignorado por git). |
| `CORS_ORIGINS` | `localhost`/`127.0.0.1` en los puertos 3000 y 3001 | Orígenes permitidos, separados por comas. |
| `SECRET_KEY` | valor de desarrollo (loguea un warning) | Clave de firma del JWT. **Obligatoria** en producción. |
| `ALGORITHM` | `HS256` | Algoritmo de firma del JWT. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Minutos de validez del access token. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | ninguno | Credenciales del primer admin, solo las usa `uv run seed-users`. |

Copia `.env.example` a `.env` (ignorado por git, ver `services/api/.gitignore`)
y completa valores reales para desarrollo.

### Tests

```bash
uv run pytest
```

`tests/test_suppliers.py` cubre todos los endpoints de `/suppliers` y la
idempotencia del seeder; `tests/test_auth.py`, `tests/test_users.py` y
`tests/test_profiles.py` cubren registro, login, permisos de `/users` y
`/profiles/me`; `tests/test_protected_routes.py` verifica que las cinco
rutas recien protegidas rechazan peticiones sin token y aceptan un token
valido. Todos corren contra una TinyDB temporal por test
(`tests/conftest.py` tiene las fixtures compartidas de usuario/token).

## Endpoints — incidencias

### `POST /api/incidents/analyze`

Recibe un CSV de tickets de soporte como `multipart/form-data` (campo `file`),
aplica las 7 reglas de validación de negocio y devuelve un resumen agregado en
JSON (nunca datos de fila, nunca `customer_email`). El resultado queda
guardado en memoria como "último análisis".

- `200`: resumen del análisis (ver `AnalysisSummary` en `models.py`).
- `400`: no se adjuntó un `.csv`, el archivo está vacío, no es un CSV válido,
  o le faltan columnas requeridas.
- `422`: no se envió el campo `file` (validación automática de FastAPI).

`POST /api/incidents/analyze` requiere login (`Authorization: Bearer <token>`).

### `GET /api/incidents/results/export`

Descarga el resultado del último análisis ejecutado en este proceso, como CSV
(una fila por métrica). Pública.

- `200`: archivo `results.csv` descargable (`Content-Disposition: attachment`).
- `404`: todavía no se ha ejecutado ningún análisis en este proceso.

## Endpoints — usuarios / auth / perfiles

Modelos en `models.py`: `UserCreate` (payload de registro — `extra="forbid"`,
sin `role`/`id`/`hashed_password`/`created_at`/`is_active`) y `UserResponse`
(nunca incluye la contraseña ni su hash; embebe `profile` si existe).
`ProfileCreate`/`ProfileUpdate`/`ProfileResponse` siguen el mismo patrón para
`/profiles/me`.

| Método y ruta | Protección | Respuesta |
| --- | --- | --- |
| `POST /users` | Pública | `201` con el usuario nuevo (+ `profile` si se envió). `409` en email duplicado, `422` en payload inválido. |
| `GET /users` | Admin | `200` con todos los usuarios. `403` para quien no sea admin. |
| `GET /users/{id}` | Propio o admin | `200` con el usuario. `403` para otro usuario, `404` si no existe. |
| `PUT /users/{id}` | Propio o admin | Body `{"email"?, "role"?}`. `200` con el usuario actualizado. `403` si quien no es admin envía `role` o apunta a otro usuario. `409` en email duplicado. |
| `DELETE /users/{id}` | Propio o admin | `204`, también borra el `Profile` vinculado. `403`/`404`. |
| `POST /auth/login` | Pública | `OAuth2PasswordRequestForm` (`username`=email, `password`). `200` con `{"access_token", "token_type": "bearer"}`. `401` en credenciales incorrectas. |
| `GET /auth/me` | Login | `200` con el usuario actual (+ `profile`). |
| `GET /profiles/me` | Login | `200` con el perfil. `404` si todavía no se creó. |
| `PUT /profiles/me` | Login | Body `{"name", "phone"?, "address"?}`. Upsert: `200`, crea el perfil en la primera llamada. |

## Endpoints — proveedores

Modelos en `models.py`: `ProviderCreate` (entrada) y `ProviderResponse`
(salida = `ProviderCreate` + `id` + `updated_at`). El `id` es el `doc_id` de
TinyDB y `updated_at` (UTC) lo fija el sistema en el alta y en cada modificación.
Los bodies prohíben campos desconocidos (`extra="forbid"`): si un cliente envía
`id` o `updated_at` recibe un `422` (`extra_forbidden`) en vez de ignorarse sin avisar.

Validaciones (`422` automático si fallan): `name` no vacío; `country` `Spain` o
`USA`; `categories` con al menos una de `software`, `infrastructure`,
`logistics`, `marketing`, `payments`, `security`, `other`; `monthly_rate` > 0;
`currency` `EUR` para Spain y `USD` para USA; `status` `active` o `suspended`;
`contract_renewal_date` (`YYYY-MM-DD`), `contact_email` y `notes` opcionales.

| Método y ruta | Protección | Respuesta |
| --- | --- | --- |
| `POST /suppliers` | Login | `201` con el proveedor creado. `401` sin token, `422` si el payload no es válido. |
| `GET /suppliers?country=&category=` | Pública | `200` con la lista. Filtros opcionales y combinables; sin ellos, todos. |
| `GET /suppliers/{id}` | Pública | `200` con el detalle. `404` si no existe. |
| `PATCH /suppliers/{id}/rate` | Login | Body `{"monthly_rate": > 0}`. `200` con el registro y `updated_at` nuevo. `401` sin token, `422` si ≤ 0, `404` si no existe. |
| `PATCH /suppliers/{id}/status` | Login | Body `{"status": "active" \| "suspended"}`. `200` con el registro. `401` / `422` / `404`. |
| `DELETE /suppliers/{id}` | Login | `204` sin cuerpo. `401` sin token, `404` si no existe. |

Los errores `404` devuelven `{"detail": "Proveedor no encontrado."}`.

### Datos iniciales (`uv run seed`)

`seed.py` lee `fixtures/suppliers.json`, valida cada proveedor con
`ProviderCreate` e inserta solo los que no existen ya por `name` (sin distinguir
mayúsculas ni espacios extra). Se puede ejecutar tantas veces como se quiera:

```
[INFO] Seed completed: 9 new suppliers added, 0 already existed.
[INFO] Seed completed: 0 new suppliers added, 9 already existed.
```

## Persistencia

- **Proveedores**: TinyDB, un archivo JSON (`SUPPLIERS_DB_PATH`). Pensado para
  un solo proceso: las lecturas/escrituras se serializan con un lock porque
  TinyDB no es thread-safe. Con varios workers/instancias habría que migrar a
  una base de datos real.
- **Usuarios / perfiles**: otro archivo JSON de TinyDB (`USERS_DB_PATH`),
  mismo diseño de un solo proceso y misma estrategia de lock que proveedores,
  pero con su propio lock y fichero para que el trafico de auth nunca
  bloquee las lecturas/escrituras de proveedores ni viceversa.
- **Último análisis de incidencias**: variable en memoria del proceso
  (`store.py`), sin disco. **Se pierde si el proceso se reinicia** y no se
  comparte entre instancias; si hiciera falta, migrar a un store externo
  (Redis, una tabla, etc.).

## Privacidad

Igual que `scripts/analyze.py`, este servicio nunca imprime, registra ni
devuelve un `customer_email` individual en ninguna respuesta: todas las rutas
de salida de incidencias (`AnalysisSummary` y la exportación a CSV) solo
trabajan con agregados calculados en `shared/incidents_analysis.py::build_summary`.

## Estructura

```
services/api/
├── pyproject.toml          # proyecto uv: deps, grupo dev, comandos `seed`/`seed-users`
├── uv.lock
├── requirements.txt        # mismas deps, para pip
├── .env.example             # documenta SECRET_KEY, ADMIN_EMAIL, etc. (sin secretos reales)
├── .gitignore                # ignora .env (mantiene .env.example)
├── main.py                 # app FastAPI: CORS + routers
├── config.py                 # carga .env; configuracion de JWT/admin
├── models.py               # modelos Pydantic (proveedores, incidencias, usuarios/auth, errores)
├── database.py             # inicialización de TinyDB de proveedores + lock
├── users_db.py               # inicializacion de TinyDB de usuarios/perfiles + lock
├── security.py                # hash de contrasenas, JWT, get_current_user/get_current_admin
├── routes/
│   ├── incidents.py        # /api/incidents
│   ├── suppliers.py        # /suppliers
│   ├── users.py               # /users
│   ├── auth.py                 # /auth
│   └── profiles.py             # /profiles
├── analysis.py             # adaptador HTTP de shared/incidents_analysis.py
├── store.py                # almacén en memoria del último análisis
├── seed.py                 # carga idempotente de proveedores
├── seed_users.py              # creacion idempotente del admin inicial
├── fixtures/suppliers.json # datos iniciales del seeder
├── tests/
│   ├── conftest.py            # fixtures compartidas de usuario/token
│   ├── test_suppliers.py
│   ├── test_auth.py
│   ├── test_users.py
│   ├── test_profiles.py
│   └── test_protected_routes.py
└── data/                   # TinyDB local (ignorado por git)
```

> _English version: [README.md](./README.md)._
