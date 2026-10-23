# 🧰 Hito 5: Inventario Nexova con ORM

Una guía corta para entender qué construye el hito y cómo encajan sus piezas.

## 🏢 ¿Qué resuelve?

IT y Operaciones necesitan saber qué activos hay, dónde están y quién registró cada movimiento. La API registra activos y órdenes de entrada/salida para las oficinas de **Valencia** y **Miami**.

## 🗃️ Dos almacenes, dos responsabilidades

    🔐 Login y usuarios ── TinyDB
                             │ get_current_user
                             ▼
    📦 Activos y órdenes ─ PostgreSQL (Supabase)

- **TinyDB** conserva los usuarios y la autenticación JWT existentes.
- **Supabase PostgreSQL** guarda **Asset**, **AssetEntry** y **AssetExit**.
- No hay una tabla **User** en PostgreSQL. TinyDB conserva su ID entero y añade a cada usuario un UUID estable; **user_uuid** registra ese UUID en cada orden.
- Al autenticarse, usuarios antiguos sin UUID reciben uno en TinyDB. Su ID entero, usado por perfiles y rutas existentes, no cambia.
- **SUPABASE_DATABASE_URL** configura la conexión. Sin ella, el resto de la API sigue arrancando y las rutas de inventario responden que la base no está configurada.

## 🧱 ¿Qué es el ORM?

Un ORM relaciona objetos de Python con filas de una base SQL. **SQLModel** combina modelos tipados, validación Pydantic y mapeo SQLAlchemy:

| Modelo | Representa | Relación |
| --- | --- | --- |
| **Asset** | Un activo, su SKU único, categoría y oficina | Tiene entradas y salidas |
| **AssetEntry** | Una compra o entrega recibida | FK asset_id → Asset.id |
| **AssetExit** | Una asignación o consumo | FK asset_id → Asset.id |

Las claves foráneas y restricciones CHECK se validan también en PostgreSQL. Así, los datos mantienen sus reglas aunque se escriban fuera de la API.

## ➕➖ El stock se calcula

**current_stock** solo aparece en las respuestas; no existe como columna que pueda desactualizarse.

    stock actual = suma de entradas − suma de salidas

Ejemplo: llegan 10 portátiles, después 5 y se asignan 2 → **stock: 13**.

Las salidas requieren stock suficiente. La API bloquea la fila del activo y comprueba el stock dentro de la misma transacción que inserta la orden. Si falta stock, devuelve HTTP 400 con el detalle de disponible y solicitado, y no guarda una salida parcial.

## 🌐 Rutas protegidas

Todas las rutas usan el JWT existente:

| Método | Ruta | Acción |
| --- | --- | --- |
| GET | /inventory/products | Listar activos y stock calculado |
| POST | /inventory/products | Crear un activo |
| GET | /inventory/products/{id} | Consultar un activo |
| POST | /inventory/orders/inbound | Registrar una entrada |
| POST | /inventory/orders/outbound | Registrar una salida |
| GET | /inventory/orders | Listar órdenes con su activo |

**allocation** necesita **assigned_to**; **consumption** exige **assigned_to: null**. Las entradas y salidas deben tener cantidad positiva.

## ⚡ Consultas y transacciones

- El listado de activos agrupa entradas y salidas por activo en consultas agregadas. Esto evita calcular el stock con una consulta extra por cada fila (**N+1**).
- El listado de órdenes consulta entradas y salidas junto con sus activos mediante JOIN.
- Cada escritura de orden es transaccional: si falla la validación o la inserción, no queda un registro a medias.

## 🧪 Probarlo en desarrollo

1. Instala dependencias desde services/api/ con **uv sync**.
2. Define **SUPABASE_DATABASE_URL** en el entorno local y arranca con **uv run uvicorn main:app --reload --port 8000**.
3. Registra o inicia sesión en /auth/login; usa **Authorization: Bearer &lt;access_token&gt;** al llamar /inventory.
4. Ejecuta las pruebas con **uv run pytest**. Las pruebas normales usan una base SQLite temporal; la concurrencia requiere una base PostgreSQL dedicada de pruebas.
5. Para cargar los datos definidos en el hito, ejecuta **uv run seed-inventory** con una cuenta TinyDB existente. El seed es idempotente y está bloqueado por defecto en producción; una ejecución autorizada requiere las dos confirmaciones descritas en **services/api/README.es.md**.

> 🔒 No guardes URLs con contraseña, claves ni tokens en Git. Las pruebas automatizadas usan SQLite temporal; no ejecutes pruebas destructivas contra producción.
