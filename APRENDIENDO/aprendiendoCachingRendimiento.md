# ⚡ Rendimiento y caché en Nexova

**Idea principal:** mejorar el rendimiento consiste en aplazar trabajo que quizá no haga falta y reutilizar resultados que cambian poco. Cada optimización tiene un coste: más memoria, algo de complejidad o datos que pueden tardar unos segundos en actualizarse.

## 🧭 Tres técnicas distintas

| Técnica | Qué evita | Ejemplo en Nexova |
| --- | --- | --- |
| Carga diferida (*lazy loading*) | Descargar o montar una parte de la interfaz antes de necesitarla. | Resumen del análisis CSV y notas de candidatos. |
| `useMemo` | Repetir un cálculo mientras sus datos de entrada no cambien. | Totales del historial de inventario. |
| Caché con TTL | Repetir una lectura del backend durante un intervalo corto. | Listas de activos y movimientos. |

No son intercambiables: la carga diferida actúa sobre los módulos de la interfaz, `useMemo` sobre cálculos de React y el TTL sobre respuestas del servidor.

## 🪶 Cargar la interfaz cuando haga falta

En `/incidencias`, el resumen solo aparece después de analizar un CSV. `next/dynamic` carga su componente cuando existe un resultado. Antes de eso, no hace falta descargar el código específico del resumen.

En la ficha de un candidato, las notas se consultan al pulsar **Ver notas internas**. La ficha principal no espera esa petición ni carga el panel mientras permanece cerrado. El panel conserva sus estados de carga, error, reintento, alta y borrado.

Dividir un módulo no garantiza una mejora grande: también se añade código para cargarlo. En esta implementación el chunk del resumen mide 4.820 bytes y la descarga inicial medida de la ruta solo bajó 145 bytes. La ventaja principal es aplazar ese trabajo hasta que se usa.

## 🧮 Memorizar un cálculo con `useMemo`

El resumen del historial recorre todos los movimientos para contar entradas y salidas, sumar cantidades y agruparlas por oficina. Es una pasada **O(n)**: cuantos más movimientos haya, más trabajo implica.

```tsx
const summary = useMemo(() => summarizeInventoryOrders(orders), [orders]);
```

Mientras `orders` conserve la misma referencia, React reutiliza el resumen. Cuando llega otra lista, vuelve a calcularlo. Por eso la dependencia es precisamente `[orders]`; omitirla podría mostrar totales obsoletos. `useMemo` no evita la descarga del historial ni sustituye la caché de la API.

## 🗃️ Qué lecturas del backend se cachean

La caché cubre dos listados protegidos del inventario:

| Endpoint | Trabajo que ahorra | TTL |
| --- | --- | --- |
| `GET /inventory/products` | Consulta los activos y agrega entradas y salidas para calcular existencias. | 10 segundos |
| `GET /inventory/orders` | Consulta entradas y salidas, relaciona productos, resuelve el nombre del creador y ordena el historial. | 30 segundos |

La clave incluye la oficina: «todas», «Valencia» y «Miami» son resultados distintos. La autenticación se comprueba en cada petición antes de ejecutar el endpoint, también cuando la respuesta viene de la caché. Los usuarios autenticados reciben la misma lista compartida para una oficina; la clave no mezcla respuestas personalizadas por sesión.

La caché vive en la memoria del proceso de FastAPI y admite hasta 128 resultados. No se comparte entre varios workers ni entre instancias. Al reiniciar el proceso se vacía; si otra instancia cambia la base de datos, una instancia distinta puede conservar su resultado hasta que venza el TTL. Para el despliegue actual se acepta ese límite a cambio de evitar añadir Redis.

## 🔄 Invalidar después de escribir

El TTL limita cuánto puede durar un resultado antiguo, pero las escrituras de la propia API lo eliminan antes:

- Crear un activo invalida las variantes del listado de productos.
- Registrar una entrada o una salida invalida productos y órdenes.
- Cambiar o borrar usuarios, o cambiar perfiles, invalida órdenes porque puede cambiar el nombre mostrado como creador.
- La invalidación se ejecuta después de confirmar la transacción. Si la escritura falla, se conserva el resultado válido que ya estaba cacheado.

La caché copia los valores al guardar y al devolverlos para que un endpoint no pueda modificar accidentalmente un objeto compartido. También agrupa solicitudes simultáneas de la misma clave y evita que una lectura iniciada antes de invalidar vuelva a guardar un resultado viejo.

## ⏱️ Frescura frente a rapidez

Un TTL corto mantiene el inventario reciente, pero reduce las oportunidades de reutilizar resultados. Un TTL largo ahorra más consultas, pero retrasa más la visibilidad de cambios externos. Se eligieron 10 segundos para productos porque el stock cambia con movimientos; el historial usa 30 segundos porque es una lectura agregada más costosa. Las escrituras hechas por esta API invalidan de inmediato.

En la base Supabase de pruebas, con datos sintéticos en una transacción revertida, una medición de ruta obtuvo para productos **48,39 ms en frío y 0,80 ms con acierto**; para órdenes, **187,17 ms y 26,46 ms**. El acierto evitó las consultas SQL. La respuesta grande del historial todavía requiere copiarse y serializarse, así que la caché no elimina todo el coste. Son mediciones de prueba, no una garantía de producción ni telemetría histórica.

## 🔒 Qué queda fuera de la caché

No se cachean sesiones, credenciales, perfiles personales, usuarios por ID ni respuestas cuyo contenido depende de quién ha iniciado sesión. Por ejemplo, `GET /auth/me` y `GET /profiles/me` son propios de cada usuario. Tampoco se cachea el detalle de un producto que se consulta para comprobar existencias antes de registrar una salida: ahí interesa leer el stock más reciente.

Las escrituras no se cachean. El listado de proveedores tampoco se cachea: su respuesta es ligera y el ahorro estimado no compensa mantener variantes e invalidaciones adicionales.

## 🧪 Comprobar los cambios

Desde `uis/backoffice`:

```bash
npm test -- --runInBand
npm run lint
npm run build
```

Desde `services/api`, ejecuta `uv run pytest`. El benchmark reproducible de la caché usa una base SQLite en memoria y puede ejecutarse con `uv run python benchmark_response_cache.py`; no necesita la base de Supabase.

📍 [Informe técnico](../CACHING_REPORT.md) · [Caché TTL](../services/api/response_cache.py) · [Rutas de inventario](../services/api/routes/inventory.py) · [Resumen de movimientos](../uis/backoffice/src/app/inventario/_lib/inventory-order-summary.ts) · [Página de incidencias](../uis/backoffice/src/app/incidencias/page.tsx) · [Panel de notas](../uis/backoffice/src/app/candidates/_components/candidate-notes-panel.tsx).

🏠 [Volver al índice](APRENDIENDO.md)
