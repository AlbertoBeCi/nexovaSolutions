# Auditoría de serialización de la API

## Resumen

Se revisaron **26 endpoints** de services/api: **23 respuestas JSON**, **2 respuestas sin cuerpo (204)** y **1 descarga CSV**.

| Estado | Antes | Después |
| --- | ---: | ---: |
| Correctos | 17 | 26 |
| Por ajustar | 9 | 0 |
| Incorrectos | 0 | 0 |

No se encontraron endpoints que devolvieran directamente un ORM o diccionarios de dominio sin modelo. Los ajustes se concentraron en reducir campos redundantes o innecesarios en algunas proyecciones y declarar explícitamente la respuesta CSV.

**Alcance:** autenticación, usuarios, perfiles, proveedores, inventario e incidencias.

## Cambios principales

- **Registro público (POST /users):** la respuesta ahora usa UserRegistrationResponse y solo incluye id y role; ya no devuelve el email ni el perfil.
- **Listados:** usuarios usan UserListItem, sin perfil anidado ni fecha de creación; proveedores usan ProviderListItem, sin notas ni email de contacto.
- **Perfiles:** ProfileResponse ya no expone user_id, una FK redundante en las rutas del perfil propio.
- **Movimientos de inventario:** las respuestas ya no incluyen user_uuid; el listado tampoco repite asset_id cuando el activo ya está representado en AssetSummary.
- **Exportación de incidencias:** el CSV declara response_model=None y conserva su respuesta binaria.

## Inventario de endpoints

En las tablas, “Antes” refleja la auditoría inicial. Todos los endpoints quedan **correctos** después de los cambios.

### Autenticación y usuarios

| Método y ruta | Respuesta | Antes | Nota |
| --- | --- | :---: | --- |
| POST /auth/login | Token (access_token, token_type) | ✅ | Email y contraseña solo son datos de entrada. |
| GET /auth/me | UserResponse con perfil opcional | ✅ | Perfil anidado explícito; sin profile.user_id. |
| POST /auth/forgot-password | MessageResponse | ✅ | Mensaje genérico, no confirma si existe el email. |
| POST /auth/reset-password | MessageResponse | ✅ | No devuelve el email. |
| POST /auth/change-password | Token nuevo | ✅ | No devuelve credenciales. |
| POST /users | UserRegistrationResponse (201) | ⚠️ | Registro público; respuesta mínima con id y role. |
| GET /users | Lista de UserListItem | ⚠️ | Listado admin: sin perfil ni fecha de creación. |
| GET /users/{user_id} | UserResponse | ✅ | Detalle autenticado; email permitido, sin hash ni UUID interno. |
| PUT /users/{user_id} | UserResponse | ✅ | Entrada limitada a email y rol. |
| DELETE /users/{user_id} | Sin cuerpo (204) | ✅ | Elimina usuario y perfil. |

### Perfiles y proveedores

| Método y ruta | Respuesta | Antes | Nota |
| --- | --- | :---: | --- |
| GET /profiles/me | ProfileResponse | ⚠️ | Sin user_id; incluye id, nombre, teléfono y dirección. |
| PUT /profiles/me | ProfileResponse | ⚠️ | Salida sin FK; entrada separada y sin IDs internos. |
| POST /suppliers | ProviderResponse | ✅ | Entrada ProviderCreate separada. |
| GET /suppliers | Lista de ProviderListItem | ⚠️ | Sin notas ni email de contacto; son datos del detalle. |
| GET /suppliers/{supplier_id} | ProviderResponse | ✅ | Detalle con los campos contractuales. |
| PATCH /suppliers/{supplier_id}/rate | ProviderResponse | ✅ | Entrada limitada a la tarifa. |
| PATCH /suppliers/{supplier_id}/status | ProviderResponse | ✅ | Entrada limitada al estado. |
| DELETE /suppliers/{supplier_id} | Sin cuerpo (204) | ✅ | Sin payload. |

### Incidencias e inventario

| Método y ruta | Respuesta | Antes | Nota |
| --- | --- | :---: | --- |
| POST /api/incidents/analyze | AnalysisSummary | ✅ | Métricas agregadas; no devuelve filas ni emails individuales. |
| GET /api/incidents/results/export | CSV (text/csv) | ⚠️ | Binario; declara response_model=None. |
| GET /inventory/products | Lista de AssetListItem | ✅ | Proyección explícita con stock calculado. |
| POST /inventory/products | AssetResponse (201) | ✅ | AssetCreate no permite definir id ni stock. |
| GET /inventory/products/{asset_id} | AssetResponse | ✅ | Detalle con proyección explícita. |
| POST /inventory/orders/inbound | AssetEntryResponse (201) | ⚠️ | Conserva asset_id; omite user_uuid. |
| POST /inventory/orders/outbound | AssetExitResponse (201) | ⚠️ | Conserva asset_id; omite user_uuid. |
| GET /inventory/orders | Lista de OrderListItem | ⚠️ | Incluye AssetSummary; omite asset_id duplicado y user_uuid. |

## Contratos y relaciones

- **Detalle de usuario y /auth/me:** pueden incluir el perfil como objeto explícito porque las vistas de cuenta necesitan ambos. El perfil no repite user_id.
- **Listado de usuarios:** usa una proyección plana y ligera. El email es necesario para la administración autenticada.
- **Proveedores:** el listado contiene identidad, clasificación, tarifa, moneda, estado, renovación y actualización. Las notas y el email de contacto quedan en el detalle.
- **Orden y activo:** el listado de movimientos incluye AssetSummary (id, nombre, SKU, categoría y sede), suficiente para la UI sin serializar la entidad completa.
- **Usuario creador de un movimiento:** se muestra una proyección con su nombre; no se incluye el objeto usuario ni su UUID interno.
- **Movimientos de entrada y salida:** mantienen asset_id como referencia necesaria y omiten la identidad interna del creador.
- **Perfil propio:** no anida el usuario ni devuelve la FK; la relación se deduce de la ruta autenticada.

## Verificación

- **API:** 395 pruebas pasaron; 1 se omitió porque requiere PostgreSQL de pruebas. Los tests cubren las nuevas formas de usuarios, perfiles e inventario, además de registro y proveedores.
- **Backoffice:** Jest 148/148, lint y build correctos.
- **Application:** Jest 143/143, lint y build correctos. El build completó compilación, typecheck y generación de páginas.
- **Textos UI:** skill revision-textos-ui, PASS.
- **Suite base previa:** no pudo ejecutarse porque uv necesitaba descargar setuptools>=69 de PyPI y el entorno bloqueó la conexión de red (socket 10013). Se reintentó con un directorio temporal de caché y se confirmó el mismo bloqueo.

**Resultado de serialización:** 26 ✅ / 0 ⚠️ / 0 ❌.
