# 🛠️ Qué resolvimos y cómo

Guía rápida de la auditoría de Nexova. Cambios pequeños, pruebas y evidencia;
conservamos la arquitectura. ¡La meta es mejorar, no perseguir un 100 perfecto! 😄

## ✅ Los problemas y sus soluciones

| Problema | Qué hicimos | Qué conseguimos |
| --- | --- | --- |
| 📏 Mediciones difíciles de comparar | Ambos frontends con `build` + `start`, tres pasadas por URL y un perfil nuevo de Chrome cada vez. | Una referencia reproducible, sin extensiones ni datos antiguos. |
| 🧭 Enlaces repetidos en móvil y escritorio | Extraímos `SiteNavigation` y lo usamos en las dos versiones del menú. | Un único sitio para mantener enlaces y textos. Menú y formulario comprobados. |
| 🏷️ Filtros sin nombre accesible | Añadimos etiquetas y creamos `CandidateSelect` para filtros, alta y ficha. | Accesibilidad del pipeline: **94 → 100**. Cinco pruebas del selector. |
| 👀 Texto Backoffice poco legible en tema claro | Oscurecimos solo ese texto; conservamos su color oscuro. | Contraste **7,72:1 en claro** y **7,55:1 en oscuro**, por encima de 4,5:1. |
| 🔤 Fuentes que se descargaban sin utilizarse | Retiramos dos precargas de Geist; Arial sigue igual. | **52.996 bytes menos** por visita y ninguna solicitud de fuentes en backoffice. |
| 🔌 Conexión tardía con la API | Añadimos una preconexión al origen que ya utiliza la aplicación. | Efecto pequeño por sí solo; no le atribuimos toda la mejora. |
| ⏳ La ficha esperaba a JavaScript para descubrir sus datos | Precargamos desde el HTML sus dos JSON: candidato y notas. El cliente reutiliza las mismas respuestas. | LCP de control **3,50 → 2,64 s**, sin duplicar peticiones. Tres pruebas de las URLs. |
| 🖼️ Iconos ausentes o pesados | Añadimos SVG de Nexova: elimina el 404 público y sustituye la descarga del ICO de plantilla del backoffice. | Prácticas públicas **96 → 100**; icono interno de **26.262 → 557 bytes** transferidos. |

## 🧪 Una prueba que descartamos

Probamos insertar el CSS en el HTML. **No mejoró la nota y empeoró el pintado**,
así que retiramos el cambio y guardamos el experimento. Medir también sirve para
saber qué no merece quedarse 🙂

## 📊 Resultado final

Medianas de tres ejecuciones en producción, con las mismas condiciones:

| Página | Rendimiento antes → después | LCP antes → después |
| --- | --- | --- |
| Portada | **98 → 98** | 2,33 → 2,33 s |
| Registro de talento | **98 → 98** | 2,48 → 2,47 s |
| Pipeline | **97 → 99** | 2,63 → 2,04 s |
| Ficha del candidato | **89 → 98** | 3,74 → 2,48 s |

La ficha muestra la mayor mejora: **unos 1,27 segundos menos de espera** 🚀
La web pública mejora en prácticas recomendadas; su rendimiento ya era bueno.
Las cuatro páginas terminan con accesibilidad, prácticas y SEO en 100.

## 🛡️ Cómo comprobamos que todo sigue funcionando

- Lint y build correctos en ambos frontends; **8 pruebas de backoffice en verde**.
- Menús, temas, registro, filtros, ficha, alta, edición, estados y notas comprobados.
- Las escrituras de candidatos y notas se simulan: **no tocamos datos reales**.
- INP local observado: **40 ms en la web**, **16–24 ms en backoffice**, con CPU ×4.
  Es laboratorio; no demuestra el rendimiento de todos los usuarios.

## 📷 Tus capturas también cuentan

Conservamos los **73 de portada/talento** y **72 del backoffice**, junto con sus
advertencias de extensiones e IndexedDB. Confirmamos que la web pública ya usaba
su build. Corregimos el nombre del PNG de talento y distinguimos la primera
captura del backoffice en desarrollo de la posterior en producción.

**No presentamos el salto de esas capturas al navegador limpio como una mejora
del código.** La comparativa anterior usa mediciones nuevas equivalentes.

🔎 Causas y análisis: [AUDIT.md](../AUDIT.md). Commits, cifras y límites:
[REPORT.md](../REPORT.md). Evidencias: [antes](before/isolated/) y [después](after/).
