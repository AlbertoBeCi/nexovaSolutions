# Uso de las skills de rendimiento

Se ejecutaron los comandos siguientes y se leyeron sus salidas completas antes de editar las aplicaciones:

```powershell
npx --yes skills use "https://github.com/addyosmani/web-quality-skills" --skill "core-web-vitals"
npx --yes skills use "https://github.com/addyosmani/web-quality-skills" --skill "performance"
```

Ambas skills declaran versión 2.0. Salidas originales: [Core Web Vitals](core-web-vitals-output.txt) y [performance](performance-output.txt). Las rutas de apoyo impresas por los comandos se usaron para leer `references/MEASUREMENT.md` y `references/INP.md`.

Aplicación al trabajo:

- Web pública: dos rutas; TTFB, elemento LCP, CSS bloqueante, JavaScript y recursos. Casos P01 y P06 de AUDIT.md.
- Backoffice: pipeline y ficha; fuentes transferidas, dependencia de API externa y auditorías de accesibilidad. Casos P02–P05.
- Se utiliza Lighthouse como alternativa local al MCP de DevTools. Sus informes incluyen trazas comprimidas y condiciones completas por ejecución.
- No hay CrUX disponible en localhost. Las mediciones son laboratorio; TBT no se presenta como INP ni una sesión aislada como p75 de campo.
- No se aplican automáticamente ejemplos genéricos de las skills: imágenes, precargas especulativas y cambios de arquitectura no tienen una causa demostrada aquí.

Herramientas temporales, fuera del código de producción: Lighthouse 13.5.0, Playwright 1.64.1 y web-vitals 6.2.3. Navegador: Chrome 155.0.8059.84.
