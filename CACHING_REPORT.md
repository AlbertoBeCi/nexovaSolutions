# Informe técnico: rendimiento y caché

## 1. Contexto y metodología

La rama de trabajo es `feature/rendimiento-caching`. El frontend elegido es
`uis/backoffice` (Next.js 16.3.2, App Router, React 19.2.8); el backend es
`services/api` (FastAPI, SQLModel/PostgreSQL opcional para inventario y TinyDB
para usuarios/proveedores). La autenticación de inventario es JWT y las seis
rutas del router `/inventory` exigen usuario autenticado.

No había métricas de tráfico previas. Por eso:

- Frecuencias del inventario de endpoints son estimaciones basadas en los
  flujos visibles de las aplicaciones, no telemetría real.
- Las latencias de caché se midieron con `TestClient` y una base SQLite en
  memoria, no contra la conexión Supabase local. Se generaron 200 activos,
  1.000 entradas y 1.000 salidas. Para cada ruta se hicieron ocho pares de
  peticiones con parámetros idénticos: lectura fría (invalidación previa) y
  lectura con acierto. Las respuestas se compararon byte a byte. Los valores
  incluyen autenticación sustituida por una dependencia de prueba, FastAPI,
  copias seguras y serialización HTTP.
- El benchmark es reproducible con `uv run python benchmark_response_cache.py`
  desde `services/api/`. `benchmark_response_cache.py` crea únicamente SQLite y
  TinyDB en memoria; no lee `SUPABASE_DATABASE_URL` ni toca datos locales.
- El bundle se midió con `npm run build` de backoffice. Los bytes iniciales son
  la suma de los chunks síncronos únicos referenciados por el manifiesto de
  cliente de cada ruta. El manifiesto de imports diferidos da el tamaño de cada
  chunk asíncrono. Los bytes son tamaños de archivo, no una medición de red con
  compresión ni del navegador.

La instrumentación previa no medía cada petición. `main.py` ahora registra
método, ruta sin query string, estado y milisegundos con `time.perf_counter()`.
No registra cuerpos, credenciales ni parámetros. `API_REQUEST_TIMING_ENABLED`
permite desactivarla; el valor por defecto es `true`. No se usaron datos
representativos de Supabase: su destino podría ser remoto y no era necesario
para la medición segura.

## 2. Inventario del backend

El OpenAPI real contiene 27 operaciones. En la columna de frecuencia, **todas
las estimaciones son cualitativas**; no hay telemetría histórica. El coste
indicado es la operación principal; las dos rutas medidas muestran sus cifras
en la sección 5.

| Método y ruta | Operación y datos | Acceso | Coste, frecuencia y cambio estimados | Decisión |
| --- | --- | --- | --- | --- |
| `POST /api/incidents/analyze` | Lee el CSV, valida filas y calcula agregados. | Login | CPU y memoria crecen con filas; uso ocasional; cada archivo cambia el resultado. | Sin caché: cuerpo distinto, efecto de escritura y resultado de proceso. |
| `GET /api/incidents/results/export` | Exporta a CSV el último análisis del proceso. | Login | Serializa el resumen actual; ocasional; cambia al analizar otro archivo o reiniciar. | Sin caché: depende del estado más reciente y del proceso. |
| `GET /inventory/products` | Lista activos y calcula stock con agregaciones de entradas y salidas; filtro `office`. | Login; cualquier usuario autenticado recibe la misma lista. | Consulta agrupada `O(activos + movimientos)`; frecuente al abrir/cambiar oficina; el stock cambia con cada movimiento. Medida. | Caché TTL 10 s, clave por oficina, invalidación de stock/productos. |
| `POST /inventory/products` | Inserta activo con SKU único. | Login | Consulta de unicidad e inserción; poco frecuente; cambia el catálogo. | Escritura: invalida todas las listas de productos después del commit. |
| `GET /inventory/products/{asset_id}` | Lee activo y suma entradas/salidas del activo. | Login | Búsqueda más dos sumas; ligado a consultar un producto; stock cambia con movimientos. | Sin caché: consulta puntual usada para mostrar/verificar stock fresco. |
| `POST /inventory/orders/inbound` | Registra entrada y usuario en una transacción. | Login | Bloqueo del activo e inserción; uso ocasional; añade movimiento y stock. | Escritura: invalida productos y órdenes tras el commit. |
| `POST /inventory/orders/outbound` | Comprueba stock bajo bloqueo y registra salida. | Login | Dos sumas y transacción; uso ocasional; añade movimiento y reduce stock. | Escritura: invalida productos y órdenes tras el commit. |
| `GET /inventory/orders` | Une movimientos con activos, resuelve creadores desde TinyDB y ordena historial; filtro `office`. | Login; misma proyección para usuarios autenticados. | Dos consultas, lectura de usuarios/perfiles y ordenación `O(movimientos log movimientos)`; frecuente al abrir/filtrar historial; crece con cada movimiento. Medida. | Caché TTL 30 s, clave por oficina; invalida por movimientos, usuarios y perfiles. |
| `POST /suppliers` | Inserta proveedor. | Login | Escritura TinyDB `O(1)` aprox.; baja frecuencia; cambia catálogo. | Sin caché: escritura no afecta las respuestas cacheadas. |
| `GET /suppliers` | Escanea, filtra y ordena proveedores; respuesta ligera. | Público | `O(proveedores)`; apertura/filtros ocasionales; cambia con CRUD. | Sin caché: tabla pequeña según fixture del seeder y coste bajo frente a invalidar filtros. |
| `GET /suppliers/{supplier_id}` | Busca un proveedor por `doc_id`. | Público | Búsqueda por id; ocasional; cambia con CRUD. | Sin caché: lectura puntual de coste bajo. |
| `DELETE /suppliers/{supplier_id}` | Elimina proveedor. | Login | Escritura TinyDB; poco frecuente. | Escritura, sin efecto sobre las entradas de inventario. |
| `PATCH /suppliers/{supplier_id}/rate` | Cambia tarifa y `updated_at`. | Login | Lectura y actualización TinyDB; poco frecuente. | Escritura, sin efecto sobre las entradas de inventario. |
| `PATCH /suppliers/{supplier_id}/status` | Cambia estado del proveedor. | Login | Lectura y actualización TinyDB; poco frecuente. | Escritura, sin efecto sobre las entradas de inventario. |
| `GET /users` | Lista email, rol y estado de todos los usuarios. | Admin | Escaneo TinyDB `O(usuarios)`; solo administración; cambia con cuentas. | Sin caché: datos identificables y acceso exclusivo de admin. |
| `POST /users` | Hashea password y crea usuario/perfil opcional. | Público | Hash bcrypt y escrituras TinyDB; baja frecuencia; crea datos de cuenta. | Sin caché: credenciales y escritura. Invalida la lista de órdenes por el nombre del creador. |
| `GET /users/{user_id}` | Lee usuario y perfil. | Propio o admin | Lectura TinyDB; consulta puntual; cambia con usuario/perfil. | Sin caché: respuesta personalizada e información personal. |
| `PUT /users/{user_id}` | Actualiza email y/o rol. | Propio o admin; cambiar rol requiere admin. | Lectura y actualización TinyDB; poco frecuente; cambia identidad/permisos. | Sin caché: autorización y datos personalizados; invalida nombres de órdenes si cambia. |
| `DELETE /users/{user_id}` | Elimina usuario y perfil. | Propio o admin | Dos escrituras TinyDB; poco frecuente. | Sin caché; invalida nombres de órdenes. |
| `POST /auth/login` | Verifica password y emite JWT. | Público | Hash bcrypt, coste de CPU; uso por inicio de sesión; no altera datos si falla. | Sin caché: credenciales y respuesta de sesión. |
| `GET /auth/me` | Lee usuario autenticado y perfil. | Login | Lecturas TinyDB; frecuente al iniciar vistas protegidas; cambia con cuenta/perfil. | Sin caché: respuesta específica del usuario. |
| `POST /auth/forgot-password` | Busca email y envía o registra enlace de reset. | Público, con rate limit | Hash/lookup y posible llamada externa; ocasional; acción sensible. | Sin caché: respuesta anti-enumeración y efecto de envío. |
| `POST /auth/reset-password` | Verifica token y actualiza password. | Público, con rate limit | Validación y hash bcrypt; muy ocasional; modifica credencial. | Sin caché: credencial y token de un solo uso. |
| `POST /auth/change-password` | Verifica y cambia password autenticada. | Login | Hash bcrypt y escritura; muy ocasional; invalida sesiones previas. | Sin caché: credencial y escritura. |
| `GET /profiles/me` | Lee el perfil del usuario autenticado. | Login | Escaneo TinyDB por `user_id`; uso ocasional; cambia al editar perfil. | Sin caché: respuesta personalizada. |
| `PUT /profiles/me` | Crea o actualiza perfil. | Login | Escritura TinyDB; uso ocasional. | Escritura; invalida la proyección `creator_name` de órdenes. |

## 3. Decisiones del frontend

### Lazy loading

1. **Resumen del análisis CSV — `/incidencias`**. `AnalysisSummaryView` solo se
   monta después de que `POST /api/incidents/analyze` devuelve un resumen. Se
   importa con `next/dynamic`, conserva SSR predeterminado y muestra un estado
   accesible `role="status"`. Si no se analiza un archivo, no se solicita el
   chunk del resumen. El build produjo un chunk asíncrono de **4.820 B**. La
   suma de chunks síncronos de la ruta pasó de **43.114 B a 42.969 B** (−145 B,
   −0,3 %); el beneficio inicial medido es pequeño porque el cargador añade
   código. No se atribuyen 4.820 B de ahorro inicial a esta división.

2. **Notas internas — `/candidates/[id]`**. El botón «Ver notas internas» activa
   `CandidateNotesPanel` con `next/dynamic`. El panel conserva carga, error,
   reintento, alta y borrado de notas, y consulta `GET .../notes` solo al
   abrirse. Antes se pedía el candidato y las notas en un `Promise.all` al
   entrar a la ficha. El build produjo un chunk asíncrono de **4.409 B**. La
   prueba de la ruta confirma que ni el panel ni la consulta aparecen antes de
   activar el botón; después verifica el estado de carga y la nota cargada. No
   se conservó una medición de bundle de la ficha anterior a esta extracción,
   así que no se afirma una diferencia de bytes previa/posterior para esa ruta.

Ambos imports están en módulos cliente y no usan `ssr: false`. Las pruebas de
flujo cubren `/incidencias` antes/después del análisis y la ficha antes/después
de abrir notas. Los manifiestos `react-loadable` del build confirman los dos
chunks independientes.

### `useMemo`

`OrderHistorySummary` en `/backoffice/inventory/orders` llama a
`summarizeInventoryOrders(orders)` con `useMemo(..., [orders])`. La función
agrupa en una sola pasada (O(n)) cantidad y número de entradas/salidas, tanto
por tipo como por oficina. La referencia de `orders` procede del estado de
carga; al cambiar solo el filtro local por tipo, la agregación conserva su
resultado. Una prueba verifica una sola llamada con la misma referencia y una
nueva llamada con una lista actualizada.

Medición aislada de la función TypeScript compilada en Node, conjunto
determinista sintético: 100.000 movimientos, 20 repeticiones tras 5 de
calentamiento; mediana **1,555 ms**, p95 **2,244 ms**. Con 10.000 movimientos,
la mediana fue **0,159 ms**. Es un coste modesto hoy; la memoización evita
repetir la pasada cuando el historial crece y la vista se renderiza por cambios
que no alteran la lista. No se presenta como mejora perceptible en el conjunto
local, cuyo volumen real no se consultó.

## 4. Decisiones del backend

| Endpoint cacheado | Clave normalizada | TTL y frescura | Motivo |
| --- | --- | --- | --- |
| `GET /inventory/products` | `inventory:products:office=*`, `...office=Valencia` o `...office=Miami` | **10 s**, máximo de desactualización entre procesos. | Dos subconsultas agregadas de entradas/salidas; se usa al abrir inventario y filtrar por oficina. El stock mostrado debe reaccionar rápidamente. |
| `GET /inventory/orders` | `inventory:orders:office=*`, `...office=Valencia` o `...office=Miami` | **30 s**, máximo de desactualización entre procesos. | Dos joins, resolución de perfiles/creadores y ordenación; el historial cambia menos que el stock y puede tolerar una ventana corta. |

La caché vive en `services/api/response_cache.py`: TTL, máximo 128 entradas,
evicción LRU, limpieza de vencidas, `deepcopy` al guardar/devolver y cargas
coordinadas por clave. No almacena sesiones SQLModel ni objetos ORM. Las rutas
siguen verificando `get_current_user` antes de consultar la caché. Ninguna de
las dos respuestas se filtra por usuario u organización: el contrato actual da
la misma lista a cualquier usuario autenticado. El filtro de oficina sí forma
parte de la clave. Las respuestas con error no se guardan.

La invalidación ocurre después de confirmar cada escritura:

- `POST /inventory/products` invalida todas las variantes de productos.
- `POST /inventory/orders/inbound` y `/outbound` invalidan todas las variantes
  de productos y órdenes.
- `POST /users`, `PUT /users/{user_id}`, `DELETE /users/{user_id}` y
  `PUT /profiles/me` invalidan órdenes porque pueden cambiar el nombre de
  creador que la respuesta incluye.
- El fallo de una transacción de orden no invalida. Las pruebas cubren un
  `400` por stock insuficiente y confirman que el acierto existente se conserva.

La caché usa generación por etiqueta: si una lectura empezó antes de invalidar,
no puede volver a insertar un resultado viejo después de la invalidación. Cada
worker tiene memoria separada; una escritura en otro worker/instancia no puede
invalidar esta caché. En ese caso la convergencia ocurre en un máximo de 10 s
para productos y 30 s para órdenes. La salida siempre vuelve a comprobar stock
en la base en una transacción y el detalle de producto no se cachea. El seed de
inventario es un comando administrativo externo que se documenta para correr
antes del servicio; si se ejecuta mientras la API está viva, también queda
sujeto a esa ventana por proceso.

## 5. Resultados

| Endpoint | Fría mediana / p95 | Acierto mediana / p95 | Cambio de mediana | Respuesta |
| --- | ---: | ---: | ---: | ---: |
| `GET /inventory/products` | 13,56 / 46,18 ms | 5,73 / 8,06 ms | **−57,7 %** | 24.206 B |
| `GET /inventory/orders` | 140,28 / 292,59 ms | 52,25 / 67,36 ms | **−62,7 %** | 623.707 B |

Son **mediciones** de ocho pares por ruta sobre la base sintética descrita; el
p95 con ocho muestras es inestable. Un acierto evita las consultas SQL, el
escaneo TinyDB de nombres y la ordenación, pero sigue ejecutando autenticación,
copia segura y serialización. El tamaño de respuesta domina parte del tiempo de
`/inventory/orders`; los resultados no equivalen a latencia de red de
producción. La prueba funcional cuenta una ejecución original para dos lecturas
idénticas y verifica que un filtro distinto usa otra clave.

**Verificaciones ejecutadas:**

- API: `services/api/.venv/Scripts/python.exe -m pytest -p no:cacheprovider` →
  **404 passed, 1 skipped** (prueba de concurrencia condicionada a una base
  PostgreSQL aislada).
- Backoffice: `npm test -- --runInBand` → **151/151**; `npm run lint` → PASS;
  `npm run build` → PASS (incluye TypeScript).
- Skill `revision-textos-ui` para `uis/backoffice` → PASS.
- No se modificó `uis/application`. En su línea base, 143 pruebas y lint
  pasaron; su build no pudo descargar Geist de Google Fonts por la red
  restringida.
- El comando estándar `uv run pytest` no pudo usarse en esta ejecución: primero
  falló al abrir la caché global de `uv`; con caché temporal intentó descargar
  `setuptools` y PyPI fue inaccesible. La suite completa se ejecutó con el
  intérprete ya instalado en `services/api/.venv`.
- En la primera ejecución de la prueba de timing, `TestClient` con el gestor de
  contexto inició el ciclo de vida normal de la API e intentó conectar con la
  URL local configurada para Supabase. La conexión fue denegada antes de leer o
  escribir datos; se ajustó la prueba para no iniciar ese ciclo de vida. La
  suite final y el benchmark aislado de SQLite se ejecutaron sin esa conexión.

### Comprobación adicional con Supabase de pruebas

La conexión se verificó con `SELECT 1`. La base estaba vacía: antes de la
prueba no existían las tablas de inventario. Para la primera medición se
crearon temporalmente 200 activos, 1.000 entradas y 1.000 salidas dentro de
una transacción; se invocaron directamente las funciones de lectura, ocho
pares frío/acierto por endpoint, y se revirtió la transacción. Después se
confirmó que las tres tablas seguían ausentes.

| Ruta | Fría mediana / p95 | Acierto mediana / p95 | Consultas SQL fría / acierto | Respuesta |
| --- | ---: | ---: | ---: | ---: |
| `GET /inventory/products` | 48,39 / 53,72 ms | 0,80 / 0,98 ms | 1 / 0 | 25.193 B; 200 activos |
| `GET /inventory/orders` | 187,17 / 317,69 ms | 26,46 / 32,22 ms | 2 / 0 | 633.707 B; 2.000 movimientos |

Estas cifras usan la conexión real a Supabase, pero datos sintéticos no
persistidos. Miden las funciones de ruta y la ida/vuelta de PostgreSQL desde
este entorno; excluyen middleware HTTP, autenticación FastAPI y serialización
de respuesta HTTP. El acierto de órdenes conserva coste visible por copiar una
respuesta grande. El p95 proviene de ocho muestras y es orientativo.

#### Middleware HTTP antes y después de sembrar

Para cumplir la comprobación de tráfico del middleware, se repitió la medición
con `TestClient` sin activar el lifespan de la app (que inicializa el esquema).
Las dependencias de autenticación y TinyDB se sustituyeron por fixtures; se
ejecutaron las rutas FastAPI, su serialización y el middleware de timing. Cada
fase hizo ocho pares de solicitudes secuenciales a la misma URL con
`office=Valencia` (16 peticiones por ruta). Los logs fueron `200` y registraron
método, path sin query string y duración. Ejemplo: `http_request method=GET
path=/inventory/orders status=200 duration_ms=141.41`.

| Ruta | Antes del seed, 0 filas: fría / acierto (p95) | Después del seed, 200 activos, 1.000 entradas y 1.000 salidas: fría / acierto (p95) | SQL fría / acierto | Respuesta tras seed |
| --- | ---: | ---: | ---: | ---: |
| `GET /inventory/products` | 45,58 (58,60) / 1,50 (1,76) ms | 49,10 (51,57) / 2,33 (3,20) ms | 1 / 0 | 12.996 B |
| `GET /inventory/orders` | 86,59 (88,59) / 1,79 (2,37) ms | 137,45 (207,55) / 18,96 (25,41) ms | 2 / 0 | 320.141 B |

Los movimientos usaron oficinas, categorías, proveedores, cantidades,
destinatarios y UUID de creador variados. Con el volumen de prueba, la mediana
fría de órdenes subió un **58,7 %** y la de productos un **7,7 %** respecto a
las tablas vacías. El acierto evitó todas las consultas SQL; la respuesta de
órdenes de 320 KB aún cuesta más por copia y serialización. No había telemetría
histórica de usuarios reales; estas 16 peticiones por ruta y fase son carga
controlada, no frecuencia de producción. Toda la creación de esquema y datos
ocurrió en una transacción revertida; se confirmó de nuevo que las tablas
seguían ausentes al terminar. El p95 es orientativo por el tamaño de muestra.

## 6. Frescura frente a rendimiento

En el mismo proceso, las escrituras HTTP invalidan las entradas inmediatamente
después del commit. Los TTL de 10 y 30 segundos son respaldo para escrituras de
otro worker, instancia o proceso administrativo. El stock visible puede estar
desactualizado hasta 10 segundos en una lectura distribuida; no se usa esa
respuesta para autorizar una salida: la escritura bloquea el activo y vuelve a
calcular stock en PostgreSQL. El historial puede tardar hasta 30 segundos en
reflejar una escritura externa. La caché es local al proceso y no se describe
como compartida.

## 7. Qué no se cacheó y por qué

`GET /users/{user_id}` es un candidato real de lectura, pero devuelve email y
perfil para el propio usuario o un administrador, tiene coste de búsqueda
TinyDB bajo y su autorización puede cambiar. Cachearlo exigiría separar las
respuestas por usuario y permisos sin una medición que justifique esa
complejidad. También se dejaron fuera `/auth/me`, login y respuestas del
analizador por ser datos personalizados o estado/credenciales sensibles.

## 8. Limitaciones y reproducción

- La matriz de endpoints y las frecuencias estimadas describen el código actual;
  no hay telemetría real. El middleware empieza a producir registros cuando se
  ejecute el servicio con `API_REQUEST_TIMING_ENABLED=true`.
- No se inspeccionó ni se usó la base indicada por la configuración local. El
  benchmark tiene volumen sintético configurable en las constantes
  `PRODUCT_COUNT` y `MOVEMENT_COUNT_PER_TYPE` de
  `services/api/benchmark_response_cache.py` y recrea la base en memoria en
  cada ejecución.
- Para repetir medidas, ejecuta `uv run python benchmark_response_cache.py`
  desde `services/api/`. Para repetir las pruebas usa `uv run pytest` cuando
  `uv` pueda resolver sus dependencias, o el Python del `.venv` ya instalado
  con `-p no:cacheprovider`.
- Para observar timing HTTP real en un entorno de desarrollo, arranca la API
  normalmente y revisa sus logs; desactívalo con
  `API_REQUEST_TIMING_ENABLED=false`. No se hizo una medición de producción.

## Matriz de requisitos y evidencia

| Requisito | Implementación | Prueba/evidencia |
| --- | --- | --- |
| Dos cargas diferidas con justificación | `uis/backoffice/src/app/incidencias/page.tsx`; `uis/backoffice/src/app/candidates/[id]/page.tsx`; `candidate-notes-panel.tsx` | Resumen solo tras analizar CSV; notas y petición GET solo al abrir panel. Pruebas Jest, manifiestos Next y chunks de 4.820 B / 4.409 B. |
| `useMemo` no trivial y dependencias correctas | `order-history-summary.tsx`; `inventory-order-summary.ts` | Agregación O(n) de entradas/salidas por oficina y tipo con `[orders]`; prueba de misma referencia/datos nuevos; microbenchmark sintético 10k/100k. |
| Inventario completo de endpoints | Sección 2 de este informe | 27 operaciones del OpenAPI con datos, acceso, coste, frecuencia estimada y ritmo de cambio subyacente. |
| Dos endpoints con TTL elegidos por coste, frecuencia y estabilidad | `services/api/response_cache.py`; `routes/inventory.py` | Productos 10 s; órdenes 30 s. Motivos y equilibrio de frescura/rendimiento en secciones 2, 4 y 6; prueba de caché y mediciones. |
| Invalidación tras cambios de datos | `routes/inventory.py`, `routes/users.py`, `routes/profiles.py` | Escrituras confirmadas invalidan listas; la prueba verifica datos frescos tras escribir y conserva caché si falla una salida. |
| No cachear datos personalizados o sensibles | Las listas cacheadas son iguales para cualquier usuario autenticado; clave separada por oficina | La autenticación se verifica también en aciertos. `GET /users/{user_id}`, `/auth/me` y credenciales quedan fuera; justificación en sección 7. |
| Beneficio de caché medido | Funciones de ruta sobre Supabase de pruebas y benchmark aislado SQLite | 8 pares frío/acierto; Supabase: 48,39→0,80 ms en productos y 187,17→26,46 ms en órdenes, con 0 consultas SQL en acierto. La transacción de fixture se revirtió. |
| Middleware y volumen antes/después de seed | `main.py` ejecutado con las rutas vía `TestClient`, en transacción revertida | Sección “Middleware HTTP antes y después de sembrar”: 0 filas frente a 200 activos/2.000 movimientos, logs `200`, latencia fría/acierto y consultas SQL por fase. |
| Timing HTTP seguro y configurable | `services/api/main.py`, `.env.example` | `test_request_timing.py`: campos mínimos, query fuera del log y opción para desactivar. |
| Informe y benchmark reproducibles | `services/api/benchmark_response_cache.py`; este archivo | El benchmark persistente del repo usa SQLite/TinyDB en memoria y no necesita Supabase; este informe separa esas cifras de la prueba puntual con Supabase. |
