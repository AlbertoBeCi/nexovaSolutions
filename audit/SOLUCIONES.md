# 🛠️ Qué resolvimos y cómo

Guía rápida de la auditoría de Nexova. La meta es mejorar con pruebas y cambios pequeños, manteniendo la arquitectura actual. No necesitamos un 100 perfecto 😄

**Estado:** preparación y registro de evidencias completados parcialmente. Las correcciones de rendimiento del código siguen pendientes.

## ✅ Problemas resueltos hasta ahora

### 1. El backoffice estaba ejecutándose en desarrollo 🚀

**Qué pasaba:** lo habíamos iniciado con `npm run dev`, mientras la evaluación exige producción.

**Cómo lo resolvimos:** detuvimos ese proceso, ejecutamos `npm run build` y arrancamos `npm run start -- -p 3001`. Comprobamos que el backoffice y su API respondían HTTP 200.

**Resultado:** el backoffice quedó disponible en `http://localhost:3001` en producción. La captura posterior muestra 72 en rendimiento y 94 en accesibilidad; todavía no demuestra una mejora por cambios de código.

### 2. Las capturas podían confundirse entre páginas 🧭

**Qué pasaba:** una imagen llamada como si fuera del backoffice mostraba realmente `/talento` y tenía la extensión duplicada `.png.png`.

**Cómo lo resolvimos:** comprobamos su contenido, la renombramos a [imagen1TalentoAntes.png](before/imagen1TalentoAntes.png) y corregimos los enlaces de los documentos.

**Resultado:** cada puntuación queda asociada a su página:

| Página | Rendimiento | Accesibilidad |
| --- | ---: | ---: |
| Web pública `/` | 73 | 100 |
| Registro `/talento` | 73 | 100 |
| Backoffice `/` en producción | 72 | 94 |

### 3. Había que distinguir mediciones incompletas y modos de ejecución 🔎

**Qué pasaba:** las nuevas capturas no muestran las métricas inferiores y podían confundirse con las anteriores. También habíamos supuesto incorrectamente que la web pública estaba en desarrollo; el usuario confirmó que usaba su build.

**Cómo lo resolvimos:** anotamos el modo de cada medición y conservamos los valores originales con su contexto. Por ejemplo, los 1.930 ms de TBT del backoffice pertenecen a la captura de desarrollo; no los atribuimos a la nueva captura de producción.

**Resultado:** donde falta una métrica indicamos «No visible», sin inventarla ni copiarla desde otra página.

## ⏳ Lo que todavía debemos resolver

| Problema o tarea | Próximo paso |
| --- | --- |
| Rendimiento por debajo del objetivo de 90 | Obtener informes completos, identificar la causa de mayor impacto y aplicar una corrección cada vez. |
| Bloqueo por JavaScript en la portada: TBT de 1.560 ms | Analizar las tareas del hilo principal antes de decidir qué código reducir o diferir. |
| Accesibilidad 94 en el backoffice | Consultar los fallos concretos de Lighthouse y comprobar las etiquetas de los filtros. |
| Navegación y selectores repetidos | Documentar ambos casos y extraer componentes pequeños reutilizables dentro de cada app. |
| Advertencias de extensiones e IndexedDB | Repetir mediciones con un perfil limpio y mantener las condiciones antes/después. |
| Evidencia incompleta del backoffice en producción | Guardar su PNG y registrar las métricas que no aparecen en el recorte. |

## 📝 Cómo documentaremos cada nueva corrección

Añadiremos una explicación breve: **problema → causa → cambio → resultado medido → commit**. Compararemos la misma URL en producción y comprobaremos que sus funciones siguen funcionando.

Los detalles y las cifras están en [AUDIT.md](before/AUDIT.md) y [REPORT.md](before/REPORT.md). Esta guía se actualizará cuando apliquemos las correcciones ✨
