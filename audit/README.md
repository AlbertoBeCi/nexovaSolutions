# 🔎 Evidencias de la auditoría

Empieza por [AUDIT.md](../AUDIT.md), [REPORT.md](../REPORT.md) o la guía breve
[SOLUCIONES.md](SOLUCIONES.md) 😄

| Carpeta | Contenido |
| --- | --- |
| `before/` | Capturas aportadas por el usuario y sus antecedentes. |
| `before/production/` | Primera exploración con proceso Chrome compartido. |
| **`before/isolated/`** | **Línea base comparable: tres perfiles nuevos por URL.** |
| `runs/` | Control tras cada commit; incluye CSS inline descartado. |
| **`after/`** | **Tres pasadas finales por las mismas cuatro URLs.** |
| `checks/` | Regresión funcional, contraste, fuentes, peticiones e INP local. |
| `agent/` | Salidas completas de las skills y registro de aplicación. |

En las series Lighthouse: `summary.json` contiene medianas; `runs.json`, condiciones
y muestras; `*-1.json`, `*-2.json`, `*-3.json`, los informes completos. Los HTML y
`*-lighthouse.png` corresponden a la primera pasada, no a una mediana artificial.
`*-page.jpg` muestra la página medida; `*-trace.json.gz` conserva la traza.

La comparativa utiliza **`before/isolated/` → `after/`**. Las capturas históricas
73/72 y la exploración compartida se conservan con su contexto; no se mezclan sus
condiciones para atribuir mejoras al código. Reproducción: [scripts](../scripts/README.es.md).
