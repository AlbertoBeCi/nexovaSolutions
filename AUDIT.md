# 🔎 Auditoría de los frontends de Nexova

Fecha: 19 de octubre de 2026. Rama: `feature/auditoria-de-rendimiento`.

## Evidencia inicial

Se mantienen las capturas aportadas por el usuario: web pública 73/100/100/100; registro de talento 73/100/100/100; backoffice 72/94/100/100. Sus advertencias de extensiones e IndexedDB impiden atribuir directamente la diferencia con el navegador limpio a correcciones de código. [Antecedentes](audit/before/REPORT.md).

La serie comparable usa producción (`build` + `start`), Chrome 155.0.8059.84 sin extensiones, Lighthouse 13.5.0 y perfil móvil predeterminado con simulación de red/CPU. Cada pasada abre un perfil nuevo, con caché fría, sesión anónima y tema oscuro del sistema. Se repiten tres navegaciones por URL. Configuración y ejecuciones: [runs.json](audit/before/isolated/runs.json).

| Página | Performance, mediana (rango) | Accesibilidad | LCP | TBT | CLS |
| --- | --- | ---: | ---: | ---: | ---: |
| Web pública `/` | 98 (98–98) | 100 | 2.333 ms | 12,5 ms | 0 |
| Registro `/talento` | 98 (98–98) | 100 | 2.483 ms | 27 ms | 0 |
| Pipeline del backoffice | 97 (97–97) | 94 | 2.631 ms | 25 ms | 0 |
| Ficha del mismo candidato | 89 (89–91) | 100 | 3.744 ms | 39 ms | 0,000079 |

Prácticas recomendadas: **96 en ambas páginas públicas**, 100 en backoffice; SEO: 100 en todas. TTFB de documento: medianas de 2–5 ms en localhost; no representa la latencia de un despliegue remoto. CrUX/RUM: sin datos para estas URLs locales. Lighthouse de navegación no mide INP: se comprueba aparte con `web-vitals`. [Resumen completo](audit/before/isolated/summary.json), [URLs fijas](audit/cases.json).

La serie anterior en `audit/before/production/` es exploratoria: compartía el proceso de Chrome entre pasadas y una comprobación previa había fijado el tema claro. Sirvió para detectar el contraste y la caché interna de favicons. **La comparación final utiliza exclusivamente `before/isolated` frente a `after`**.

## Problemas y causa raíz

| ID | Evidencia y causa | Decisión dirigida |
| --- | --- | --- |
| P01 | La web pública solicita CSS de ~7 KB transferidos antes de pintar; `render-blocking-insight` estima ~100–110 ms evitables. | Se probó `experimental.inlineCss`: no mejoró la nota y empeoró FCP/LCP. Se retiró en otro commit; se conserva el experimento en `audit/runs/01-css/`. |
| P02 | Backoffice descarga dos WOFF2 (~53 KB transferidos) precargados por `next/font`; el cuerpo usa Arial y no hay clases consumidoras de Geist. | Eliminar únicamente fuentes y variables no utilizadas; verificar tipografía calculada y desaparición de solicitudes. |
| P03 | `select-name` identifica los dos filtros sin nombre accesible. El buscador también depende del placeholder. | Asociar etiquetas y unificar los selectores repetidos, conservando valores, filtros y diccionarios. |
| P04 | `color-contrast` identifica el subtítulo BACKOFFICE: contraste 2,62:1 sobre blanco frente a 4,5:1 requerido. | Ajustar solo el color de ese texto y verificar los temas claro/oscuro. |
| P05 | La ficha obtiene candidato y notas después de hidratar; el nombre es el LCP. No hay conexión anticipada al origen externo de la API. | Preconexión limitada al origen ya configurado. Efecto pequeño por sí sola; no se atribuye toda la mejora a este hint. |
| P06 | Las tres visitas públicas con perfil nuevo solicitan un favicon inexistente: 404 y `errors-in-console`, prácticas 96. | Icono SVG de Nexova mediante la convención nativa `app/icon.svg`; comprobar nuevas navegaciones. |
| P07 | Los dos GET de la ficha se descubren al ejecutar el efecto cliente, después del JS. Esperar a esa cadena retrasa el H1 aunque el HTML y el hilo principal sean rápidos. | Precargar exactamente esos dos JSON desde el HTML; las lecturas siguen en el mismo cliente. Comprobar una solicitud por recurso y correspondencia de URLs con pruebas. |
| P08 | La traza del backoffice transfiere 26.262 bytes del favicon de plantilla durante la carga. | Usar el SVG de marca: 557 bytes transferidos en la pasada de control, sin descargar el ICO. |

P02–P08 se aplicaron; P01 se descartó por su medición. Los avisos genéricos sobre JavaScript antiguo o código no usado del framework son sugerencias: no se cambia la compatibilidad ni se eliminan funciones para inflar la nota. Optimización de imágenes del hero: no aplicable, el contenido principal es texto. La serie limpia no confirma los 1.560 ms de TBT de la captura original; no se promete corregir un cuello de botella que no se reproduce.

## Dos casos de refactorización

1. **Web pública:** `site-header.tsx` repite el mapa de enlaces y sus textos en escritorio y móvil. Extraer `SiteNavigation` con variante visual y callback opcional al navegar; integrarlo en las dos presentaciones. Mantener el límite cliente actual, porque TBT no justifica una migración de arquitectura.
2. **Backoffice:** listado, alta y ficha repiten selectores, etiquetas y opciones de estado/etapa. Extraer un selector nativo reutilizable con `id`, etiqueta, opciones tipadas y props nativas de `<select>`. Integrarlo en esos consumidores; mantener `CandidateFields`, que ya existe, y los diccionarios del dominio.

Ambas extracciones están integradas: `SiteNavigation` en las dos presentaciones de la cabecera; `CandidateSelect` en filtros, alta y ficha, con cinco pruebas. Las abstracciones se comparten dentro de cada aplicación. Se conserva la arquitectura y los contratos HTTP.

## Uso de skills y comprobaciones

Se ejecutaron `core-web-vitals` y `performance`, versión 2.0, antes de modificar las apps. Se leyeron sus salidas completas y las referencias locales de medición e INP. Las cuatro URLs se evaluaron con el mismo procedimiento. [Registro del agente](audit/agent/USO.md).

Cada problema tiene un commit independiente, lint/build y comprobaciones de UI aplicables; se repite Lighthouse tras cada cambio en `audit/runs/`. Las capturas comparables están en `audit/before/isolated/` y `audit/after/`. [REPORT.md](REPORT.md) explica resultados, límites, commits y comprobaciones. [Guía breve con emoticonos](audit/SOLUCIONES.md).
