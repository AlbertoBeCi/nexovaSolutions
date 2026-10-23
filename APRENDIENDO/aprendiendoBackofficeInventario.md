# 📦 La interfaz de inventario del backoffice

**Idea principal:** el backoffice consulta la API protegida para mostrar existencias y registrar movimientos. El navegador no decide cuánto stock hay: el backend calcula y valida cada operación.

## 🔄 El recorrido

    Persona autenticada → vista de inventario → cliente HTTP → API → respuesta → actualizar la pantalla

La interfaz vive en `uis/backoffice`, el backend en `services/api` y las rutas HTTP del inventario empiezan por `/inventory`.

## 🔐 Proteger las vistas

Las cuatro rutas de inventario están dentro de un layout con `RequireAuth`:

| Ruta de pantalla | Para qué sirve |
| --- | --- |
| `/backoffice/inventory/products` | Consultar productos y existencias. |
| `/backoffice/inventory/orders/inbound` | Registrar una entrega recibida. |
| `/backoffice/inventory/orders/outbound` | Registrar una asignación o un consumo. |
| `/backoffice/inventory/orders` | Consultar entradas y salidas anteriores. |

Las URLs antiguas `/inventario...` redirigen a estas rutas y conservan sus parámetros.

El token se guarda en `localStorage` y el cliente HTTP lo envía como `Authorization: Bearer <token>`. Si falta o caduca, se abre el login. El parámetro `next` guarda una ruta interna para volver a ella después de iniciar sesión; se rechazan destinos externos para no redirigir fuera de la aplicación.

## 📡 Consultar y guardar

| Acción | Endpoint | Datos principales |
| --- | --- | --- |
| Listar productos | `GET /inventory/products` | `id`, `name`, `sku`, `category`, `office`, `current_stock`. |
| Consultar un producto | `GET /inventory/products/{asset_id}` | Los mismos campos, incluido el stock calculado. |
| Registrar entrada | `POST /inventory/orders/inbound` | `asset_id`, `quantity`, `supplier`, `office`. |
| Registrar salida | `POST /inventory/orders/outbound` | `asset_id`, `quantity`, `exit_type`, `assigned_to`, `office`. |
| Consultar historial | `GET /inventory/orders` | Tipo y cantidad, resumen del producto, oficina, fecha, `user_uuid` y `creator_name`. |

El formulario transforma los nombres de la API, escritos en `snake_case`, a nombres `camelCase` para los componentes. Por ejemplo, `current_stock` pasa a `currentStock`.

## 📊 Mostrar stock sin reutilizar un dato viejo

Al elegir un producto para una salida, la pantalla consulta `GET /inventory/products/{asset_id}` con caché desactivada. Cada petición se asocia al producto seleccionado. Mientras llega una respuesta nueva, no se muestra la cantidad de la selección anterior; las respuestas tardías de otra selección se ignoran.

Antes de guardar, se vuelve a consultar el producto. Si no hay unidades suficientes, se muestra cuántas hay y cuántas se solicitaron. El backend vuelve a comprobar el stock dentro de la transacción de escritura, porque otra persona podría registrar una salida en ese intervalo.

El stock es la suma de entradas menos salidas. `0` se presenta como «Sin existencias», de `1` a `5` como «Existencias bajas» y más de `5` como «Disponible». Los textos acompañan a los colores para que el estado no dependa solo de la vista.

## 🧾 Entender el historial

La API relaciona `user_uuid` con los usuarios de TinyDB y devuelve `creator_name`: el nombre del perfil, el email si no hay nombre o `null` si la cuenta ya no está. La tabla muestra siempre `user_uuid` y, además, el nombre del creador cuando está disponible. El ID de una entrada puede coincidir con el de una salida, así que el tipo de movimiento también forma parte de su identidad.

El historial usa los datos actuales del producto y del perfil; no conserva una copia histórica de sus nombres. La API entrega todas las órdenes en un array y no ofrece paginación.

## 🚦 Errores y estados de pantalla

El cliente conserva el estado HTTP en un `ApiRequestError`. Así puede traducir los casos conocidos sin mostrar el JSON recibido:

| Respuesta | Mensaje o acción en la interfaz |
| --- | --- |
| `400` por stock insuficiente | Explica las unidades disponibles y solicitadas; vuelve a consultar el stock. |
| Otro `400` o `422` | Traduce las validaciones conocidas o pide revisar los datos con un mensaje en español. |
| `401` | Limpia la sesión y vuelve al login con el destino solicitado. |
| `403` / `404` / `503` | Explica permisos, producto no disponible o falta temporal del servicio. |
| Red o `500` | Muestra un mensaje seguro y permite reintentar las consultas. |

Las vistas también distinguen carga, lista vacía, error y guardado correcto. Un error de red al enviar un movimiento no se reintenta automáticamente: primero se consulta el historial para evitar duplicarlo.

## 🧪 Comprobar el comportamiento

Desde `uis/backoffice`:

```bash
npm test -- --runInBand
npm run lint
npm run build
```

Desde `services/api`, `uv run pytest` usa bases de prueba aisladas. La prueba de concurrencia necesita PostgreSQL dedicado y puede omitirse cuando no está configurado.

📍 [Vistas](uis/backoffice/src/app/inventario) · [Cliente de inventario](uis/backoffice/src/services/inventory-api.ts) · [Router](services/api/routes/inventory.py) · [Schemas](services/api/inventory_schemas.py).

🏠 [Volver al índice](APRENDIENDO.md)
