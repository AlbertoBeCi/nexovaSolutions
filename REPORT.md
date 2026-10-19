# 📊 Informe de mejoras de Nexova

**Resultado:** mejora medible en ambos frontends, con cambios dirigidos y dos componentes reutilizables integrados. Se conserva la arquitectura de las aplicaciones.

## 1. Antes y después

Medianas de **tres pasadas por URL**, en producción, Chrome limpio y Lighthouse móvil simulado. En cada pasada se abre un perfil nuevo. El candidato, las URLs y las versiones permanecen fijos. Fecha: 19/10/2026.

| Página | Performance antes → después | Accesibilidad | Prácticas recomendadas | SEO |
| --- | --- | --- | --- | --- |
| Web pública `/` | 98 → **98** | 100 → 100 | 96 → **100** | 100 → 100 |
| Web pública `/talento` | 98 → **98** | 100 → 100 | 96 → **100** | 100 → 100 |
| Pipeline del backoffice | 97 → **99** | 94 → **100** | 100 → 100 | 100 → 100 |
| Ficha del candidato | 89 → **98** | 100 → 100 | 100 → 100 | 100 → 100 |

Rangos de Performance: portada 98–98 → 98–98; talento 98–98 → 98–98; pipeline 97–97 → 99–99; ficha 89–91 → 98–98.

| Página | LCP antes → después | TBT antes → después | CLS antes → después | TTFB HTML antes → después |
| --- | --- | --- | --- | --- |
| Portada | 2.333 → **2.326 ms** | 12,5 → 11 ms | 0 → 0 | 2 → 2 ms |
| Talento | 2.483 → **2.474 ms** | 27 → 21 ms | 0 → 0 | 2 → 2 ms |
| Pipeline | 2.631 → **2.042 ms** | 25 → 14 ms | 0 → 0 | 2 → 1 ms |
| Ficha | 3.744 → **2.475 ms** | 39 → 11 ms | 0,000079 → 0,000079 | 5 → 5 ms |

La ficha reduce su LCP aproximadamente **1,27 s (34 %)**; el pipeline, **0,59 s (22 %)**. Las pequeñas diferencias de la web pública entran en la variación normal: su mejora confirmada es eliminar el error del icono, no acelerar significativamente el renderizado.

Fuentes originales: [antes](audit/before/isolated/summary.json), [después](audit/after/summary.json), [condiciones y pasadas finales](audit/after/runs.json). Los JSON completos conservan FCP, Speed Index y diagnósticos.

### Las capturas que aportaste también se conservan 📷

Portada: **73/100/100/100**; talento: **73/100/100/100**; backoffice en producción: **72/94/100/100**. Sus avisos de extensiones e IndexedDB y las métricas recortadas están anotados en [los antecedentes](audit/before/REPORT.md). La web pública ya estaba compilada, como confirmaste.

**No atribuimos el salto de 73 a 98 al código:** la comparación causal utiliza la serie limpia anterior y posterior. La primera captura de backoffice en desarrollo sigue identificada como tal; su TBT de 1.930 ms no se reutiliza como dato de producción.

## 2. Qué cambió y por qué

| Caso | Corrección y comprobación | Commit |
| --- | --- | --- |
| Navegación duplicada | `SiteNavigation` reúne enlaces/textos de móvil y escritorio. Se verifican apertura, navegación, cierre, temas y registro de tres pasos. No se le atribuye una ganancia de rendimiento. | `c15e49e` |
| P03 · Filtros sin nombre | Etiquetas asociadas al buscador y selectores. `CandidateSelect` se utiliza en filtros, alta y ficha; mantiene diccionarios y eventos nativos. Accesibilidad del pipeline 94 → 100. | `d242495` |
| P06 · Icono inexistente | SVG nativo de Next en la web pública. Desaparece el 404 y prácticas recomendadas 96 → 100 en ambas páginas. | `b851f84` |
| P04 · Contraste claro | Color del subtítulo Backoffice de zinc-400 a zinc-600 solo en tema claro. El oscuro conserva su color; se verifica contraste ≥ 4,5 en ambos temas. | `efda492` |
| P02 · Fuentes sin uso | Se retiran dos WOFF2 precargados, **52.996 bytes transferidos** por visita. Se mantiene Arial calculada y no quedan solicitudes de fuentes. Primer control del pipeline: LCP 2.043 ms. | `bc20b95` |
| P05 · Conexión tardía | Preconexión al origen de la API ya configurada. Control de ficha: mediana 3.499 ms, frente a 3.555 ms de una pasada sin el hint. Diferencia pequeña; no demuestra por sí sola una mejora estable. | `c4019ba` |
| P07 · JSON descubierto tras hidratar | Dos precargas en el HTML de la ficha, con las mismas URLs que los GET existentes. El flujo de datos continúa en el cliente. Tres controles: LCP mediano **2.639 ms**, frente a 3.499 ms con solo preconexión. Se comprueba una petición por recurso. | `d85fdba` |
| P08 · Icono de plantilla pesado | SVG de Nexova en backoffice. La traza solicita **557 bytes**, frente a 26.262 bytes del ICO; no descarga el ICO. Control de ficha: LCP **2.483 ms**, confirmado en la serie final. | `5381e95` |

Los controles de cada cambio y sus trazas están en [audit/runs/](audit/runs/). Una pasada intermedia sirve como control; las conclusiones globales usan las tres finales y las tres iniciales. Los efectos combinados no permiten repartir con precisión cada milisegundo entre cambios.

### Un experimento que descartamos 🧪

P01: probamos `experimental.inlineCss` (`be4fbb0`), siguiendo la documentación instalada de Next. Tres pasadas por página mantuvieron Performance en 98 y empeoraron FCP/LCP: portada, LCP 2.489 ms frente a 2.337 ms exploratorios; talento, 2.485 frente a 2.326 ms. Se retiró en `27272f0`. [Evidencia del experimento](audit/runs/01-css/summary.json).

El CSS bloqueante permanece como oportunidad secundaria. No se conservaron cambios sin beneficio demostrado ni se alteró la compatibilidad del framework por sus avisos genéricos de JS antiguo/no utilizado.

## 3. Comprobaciones ✅

- **Producción:** `npm run lint` y `npm run build` correctos en ambas apps; `npm run start -- -p 3000/3001` para servirlas.
- **Pruebas:** `npm test -- --runInBand` en backoffice: **8 pruebas**, 2 suites. Cinco cubren el selector; tres, las URLs utilizadas por las precargas y el cliente HTTP. [Detalle](TESTING.md).
- **Idioma y dominio:** skill `revision-textos-ui` sobre ambos `src/`; sin códigos de estado/etapa visibles, diccionarios conservados y sin cambiar mensajes de negocio.
- **Navegador:** menú móvil/escritorio, temas, validación y envío simulado del registro; filtros en URL, ficha, alta, edición, cambios de estado/etapa, notas, errores de API y protección de incidencias. Las escrituras se interceptan y simulan: no se modifican registros reales.
- **Red y aspecto:** Arial conservada, fuentes eliminadas, dos GET de ficha sin duplicación, SVG ligero y contraste claro/oscuro. [Resultados del recorrido](audit/checks/final.json).
- **Skills:** `core-web-vitals` y `performance` 2.0 aplicadas a las cuatro páginas; salidas completas y decisiones en [audit/agent/](audit/agent/USO.md).

### Qué significan los KPI finales

Performance ≥ 90, LCP < 2.500 ms y CLS < 0,1 en las **cuatro medianas**. Talento y ficha quedan cerca del límite de LCP: conviene vigilar regresiones y repetir en el despliegue real. TTFB local de 1–5 ms solo describe el servidor de este equipo.

INP se comprueba aparte con `web-vitals` y CPU ×4 durante interacciones reales del navegador: **40 ms en la sesión pública**, observaciones de **16–24 ms en el recorrido del backoffice**, con escrituras simuladas. Condiciones en `audit/checks/final.json`. **TBT no equivale a INP**, FID ya no es la métrica vigente y una sesión local no demuestra el p75 de usuarios reales. No hay CrUX/RUM para localhost.

## 4. Valoración y límites

**Mayor impacto:** descubrir los JSON antes de hidratar, junto con eliminar recursos innecesarios. Se ataca la cadena que retrasa el nombre del candidato; no se oculta contenido ni se sustituye el LCP por una pantalla vacía.

La red externa de 4Geeks puede variar. Las métricas son de laboratorio, móvil simulado y sesión anónima; no cubren todas las vistas privadas ni todos los dispositivos. No se reestructura el renderizado ni se cambia el contrato de la API. La instalación de herramientas de pruebas informó 41 avisos de dependencias (4 moderados, 36 altos, 1 crítico); resolverlos requiere una revisión de dependencias aparte y no se aplicó `npm audit fix --force`.

## 5. Entrega 📦

- [AUDIT.md](AUDIT.md): causa raíz, condiciones, datos iniciales y dos casos de refactorización.
- [audit/SOLUCIONES.md](audit/SOLUCIONES.md): explicación corta con emoticonos.
- [Antes](audit/before/isolated/) y [después](audit/after/): informes HTML/JSON, trazas y capturas de las cuatro páginas.
- Commits separados para correcciones, experimento descartado y evidencia final, en `feature/auditoria-de-rendimiento`.

La rama se publicó en GitHub el **20/10/2026**, con autorización expresa del usuario.
Se prepara el PR hacia `main`, incluyendo el `README.es.md` que estaba guardado
en el stash de `feature/contenedorizacion-monorepo`.

### Integración con `main` · 20/10/2026

Se incorporan los cambios actuales de inventario, Docker y manejo de errores de
`main`. Se conserva `safeFetch` al combinarlo con las URLs de precarga, y se
unifica Jest para ejecutar las suites de `main` junto con las ocho pruebas de la
auditoría. El README guardado se recupera sin eliminar el stash.

Validación de integración: **148 pruebas en 11 suites**, lint y build de ambos
frontends y skill `revision-textos-ui` correctos. Se conservan las coberturas y
los resultados de otras áreas con su fecha original en `TESTING.md`.

Las cifras Lighthouse anteriores corresponden a los builds auditados el
19/10/2026, anteriores a esta integración. Se mantienen como evidencia histórica;
no se presentan como una nueva medición del código combinado.
