# 🔎 Auditoría de los frontends de Nexova

Fecha: 19 de octubre de 2026. Rama: `feature/auditoria-de-rendimiento`.

## Evidencia inicial

Se mantienen las capturas aportadas por el usuario: web pública 73/100/100/100; registro de talento 73/100/100/100; backoffice 72/94/100/100. Sus advertencias de extensiones e IndexedDB impiden atribuir directamente la diferencia con el navegador limpio a correcciones de código. [Antecedentes](audit/before/REPORT.md).

La serie controlada usa producción (`build` + `start`), Chrome 155.0.8059.84 sin extensiones, Lighthouse 13.5.0, perfil móvil predeterminado con simulación de red/CPU, caché fría y sesión anónima. Se repiten tres navegaciones por URL. La configuración completa y cada ejecución están en [runs.json](audit/before/production/runs.json).

| Página | Performance, mediana (rango) | Accesibilidad | LCP | TBT | CLS |
| --- | --- | ---: | ---: | ---: | ---: |
| Web pública `/` | 98 (98–98) | 100 | 2.337 ms | 13,5 ms | 0 |
| Registro `/talento` | 98 (98–100) | 100 | 2.326 ms | 12,5 ms | 0 |
| Pipeline del backoffice | 98 (97–98) | 89 | 2.483 ms | 14 ms | 0 |
| Ficha del mismo candidato | 91 (91–91) | 96 | 3.508 ms | 34 ms | 0,000079 |

TTFB de documento: medianas de 2–5 ms en localhost; no diagnosticar con esto la latencia de un despliegue remoto. CrUX/RUM: sin datos para estas URLs locales. Lighthouse de navegación no mide INP: se comprobarán las interacciones en una sesión separada. [Resumen completo](audit/before/production/summary.json), [URLs fijas](audit/cases.json).

## Problemas y causa raíz

| ID | Evidencia y causa | Decisión dirigida |
| --- | --- | --- |
| P01 | La web pública solicita CSS de ~7 KB transferidos antes de pintar; `render-blocking-insight` estima ~100–110 ms evitables. | Evaluar `experimental.inlineCss` documentado en la versión instalada de Next. Conservarlo solo si mejora la medición y las navegaciones funcionan. Registrar el coste de HTML y caché. |
| P02 | Backoffice descarga dos WOFF2 (~53 KB transferidos) precargados por `next/font`; el cuerpo usa Arial y no hay clases consumidoras de Geist. | Eliminar únicamente fuentes y variables no utilizadas; verificar tipografía calculada y desaparición de solicitudes. |
| P03 | `select-name` identifica los dos filtros sin nombre accesible. El buscador también depende del placeholder. | Asociar etiquetas y unificar los selectores repetidos, conservando valores, filtros y diccionarios. |
| P04 | `color-contrast` identifica el subtítulo BACKOFFICE: contraste 2,62:1 sobre blanco frente a 4,5:1 requerido. | Ajustar solo el color de ese texto y verificar los temas claro/oscuro. |
| P05 | La ficha obtiene candidato y notas después de hidratar; el nombre es el LCP. No hay conexión anticipada al origen externo de la API. | Medir un `preconnect` limitado al origen real configurado, sin cambiar el flujo cliente ni la API. |
| P06 | Una primera navegación solicita `/favicon.ico` y obtiene 404; `errors-in-console` reduce prácticas recomendadas a 96 en esa pasada. | Proporcionar un icono de marca pequeño y comprobar las navegaciones nuevas. La mediana inicial de prácticas ya es 100. |

P01–P06 son correcciones vinculadas a evidencia. Los avisos genéricos sobre JavaScript antiguo o código no usado del framework son sugerencias: no se cambiará la compatibilidad ni se eliminarán funciones para inflar la nota. Optimización de imágenes del hero: no aplicable, el contenido principal es texto. La serie limpia no confirma un problema de TBT en las páginas iniciales.

## Dos casos de refactorización

1. **Web pública:** `site-header.tsx` repite el mapa de enlaces y sus textos en escritorio y móvil. Extraer `SiteNavigation` con variante visual y callback opcional al navegar; integrarlo en las dos presentaciones. Mantener el límite cliente actual, porque TBT no justifica una migración de arquitectura.
2. **Backoffice:** listado, alta y ficha repiten selectores, etiquetas y opciones de estado/etapa. Extraer un selector nativo reutilizable con `id`, etiqueta, opciones tipadas y props nativas de `<select>`. Integrarlo en esos consumidores; mantener `CandidateFields`, que ya existe, y los diccionarios del dominio.

Las abstracciones se comparten dentro de cada aplicación. No se introduce un workspace, una librería UI global ni cambios de contratos HTTP.

## Uso de skills y comprobaciones

Se ejecutaron `core-web-vitals` y `performance`, versión 2.0, antes de modificar las apps. Se leyeron sus salidas completas y las referencias locales de medición e INP. Las cuatro URLs se evaluaron con el mismo procedimiento. [Registro del agente](audit/agent/USO.md).

Cada problema se corrige en un commit independiente, con lint/build y comprobaciones de UI aplicables. Tras el commit se repite la misma URL en producción. Las capturas e informes iniciales están en `audit/before/production/`; los resultados finales irán a `audit/after/`.
