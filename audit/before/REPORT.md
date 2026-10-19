# Informe de auditoría de rendimiento

**Fecha:** 19 de octubre de 2026
**Alcance:** revisión estática de `uis/website/` y capturas locales de Lighthouse de `uis/website/` y `uis/backoffice/`
**Estado:** preliminar; falta medición de campo y repetición limpia de laboratorio

## Resumen

Se revisó el código de la web pública y se registraron dos capturas locales de Lighthouse proporcionadas por el usuario: la portada pública y el backoffice. La portada usa texto renderizado desde el servidor, no presenta imágenes grandes en el hero y tiene una cantidad limitada de interactividad cliente. Las capturas sirven como referencias iniciales de laboratorio, pero no confirman el p75 de campo ni representan necesariamente dispositivos reales.

No se proporcionó una URL desplegada ni datos CrUX/RUM o trazas detalladas de Chrome. Lighthouse avisó que las extensiones de Chrome y datos almacenados en IndexedDB pudieron afectar la carga. Por tanto, repetir la prueba en una ventana de incógnito y sin extensiones antes de fijar la línea base.

## Resultados de métricas

### Puntuaciones Lighthouse

| Aplicación | URL | Rendimiento | Accesibilidad | Prácticas recomendadas | SEO |
| --- | --- | ---: | ---: | ---: | ---: |
| Web pública | `http://localhost:3000/` | 73 | 100 | 100 | 100 |
| Backoffice | `http://localhost:3001/` | 72 | 94 | 100 | 100 |

### Métricas de laboratorio

| Aplicación | FCP | LCP | TBT | CLS | Speed Index | INP |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Web pública | 0,8 s | 2,1 s | 1.560 ms | 0 | 1,7 s | No reportado |
| Backoffice | 0,8 s | 1,2 s | 1.930 ms | 0 | 2,5 s | No reportado |

La captura de la web pública corresponde a `localhost:3000/`, vista responsive de 820 × 1217, y muestra la navegación «Inicio», «Servicios», «Por qué Nexova» y «Contacto». Evidencia: [imagen1FrontEndAntes.png](./imagen1FrontEndAntes.png).

La captura del backoffice corresponde a `localhost:3001/` y muestra el pipeline de talento. El viewport no se alcanza a leer. Evidencia: [imagen1BackofficeAntes.png](./imagen1BackofficeAntes.png).

### Diagnósticos Lighthouse visibles

- Reducir el tiempo de ejecución de JavaScript: **2,1 s**.
- Minimizar el trabajo del hilo principal: **2,9 s**.
- Reducir JavaScript sin usar: ahorro estimado de **1.967 KiB**.
- Minificar JavaScript: ahorro estimado de **78 KiB**.
- JavaScript antiguo: ahorro estimado de **13 KiB**.
- Se encontraron **9 tareas largas** en el hilo principal y **4 marcas User Timing**.

Estos diagnósticos aparecen en la captura de la web pública. La captura del backoffice no muestra los paneles de diagnóstico desplegados, así que no se atribuyen esos valores a esa aplicación.

## Observaciones del código

### LCP

- La portada (`uis/website/src/app/page.tsx`) es un Server Component y su titular principal está incluido en el HTML renderizado.
- El hero revisado no contiene una imagen ni un vídeo cuya descarga determine el LCP.
- El layout carga Fraunces y Public Sans con `next/font/google` y `display: "swap"` (`uis/website/src/app/layout.tsx`). La inspección no demuestra un retraso de fuente; una traza debe confirmar si el intercambio afecta el renderizado o la geometría del texto.
- No se recomienda añadir un preload especulativo sin evidencia de descubrimiento tardío de un recurso LCP.

### INP

- La cabecera (`uis/website/src/app/_components/site-header.tsx`) gestiona el menú móvil con estado React y un listener de redimensionamiento.
- El formulario (`uis/website/src/app/_components/talent-form.tsx`) valida un conjunto pequeño de campos y actualiza el estado al escribir o cambiar de paso.
- La revisión estática no muestra trabajo computacional pesado ni permite conocer demoras de entrada, procesamiento o renderizado. Hace falta una traza de las interacciones reales.

### CLS

- En las páginas revisadas no se identificaron imágenes o embeds que necesiten espacio reservado.
- El menú móvil aparece al abrirse y cambia la altura del encabezado. El formulario puede insertar un resumen de errores o reemplazar el formulario tras el envío. Son cambios asociados a interacciones; su efecto debe comprobarse en una sesión real.
- No se detectó desde el código un cambio de contenido asíncrono inicial que confirme un problema de CLS.

## Próximos pasos

1. Repetir Lighthouse en incógnito, sin extensiones, para la web pública (`localhost:3000`) y el backoffice (`localhost:3001`); guardar cada resultado y sus condiciones.
2. Medir CrUX por página cuando haya URLs desplegadas; si no hay datos de página, anotar el fallback de origen por separado.
3. Grabar trazas de carga en móvil y escritorio para las rutas incluidas.
4. Medir las interacciones indicadas en [`AUDIT.md`](./AUDIT.md), registrando dispositivo, viewport, red, CPU y estado de caché.
5. Corregir solo causas confirmadas por la evidencia y repetir las mediciones bajo las mismas condiciones.
6. Actualizar este informe con valores p75 de campo y resultados de laboratorio claramente separados.

## Limitaciones

La captura es una medición local única afectada posiblemente por extensiones y datos del navegador; no equivale a una medición de campo. No se han hecho cambios de rendimiento en la aplicación. Las observaciones de código son hipótesis para orientar la medición, no estimaciones de ahorro ni conclusiones sobre el estado real de los Core Web Vitals.
