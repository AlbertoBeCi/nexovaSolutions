# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Candidatos profesionales (Público):** Profesionales de tecnología, retail, servicios financieros y consultoría en España y Estados Unidos que buscan nuevas oportunidades laborales a través del banco de talento de Nexova.
- **Empresas cliente (Público B2B):** Directivos y equipos de talento de empresas medianas que requieren headhunting ejecutivo, outsourcing de atención al cliente o formación corporativa.
- **Operadores internos de RRHH y Operaciones (`uis/backoffice` y `uis/application`):** Reclutadores, gestores de inventario, administradores de proveedores y equipo de soporte que gestionan candidaturas, incidencias, telemetría y desempeño de negocio.

## Product Purpose

Nexova Solutions es una consultora de recursos humanos y adquisición de talento fundada en 2011 con sedes en Valencia (España) y Miami (EE. UU.). Su ecosistema web combina:
1. **Sitio web corporativo (`uis/website`):** Presentar las líneas de servicio, demostrar trayectoria y capturar candidaturas estructuradas en 3 pasos.
2. **Backoffice y Operaciones (`uis/backoffice`, `uis/application`):** Herramientas internas para gestionar el pipeline de talento, inventario de activos, proveedores, incidencias, telemetría técnica y reportes semanales de desempeño.

## Positioning

Consultora hispano-estadounidense de talento con más de 12 años de trayectoria y +500 procesos completados, combinando selección ejecutiva personalizada, equipos dedicados de atención al cliente y formación en liderazgo con operaciones internas potenciadas por datos.

## Operating Context

- Operación bicultural entre Valencia, España (EUR) y Miami, Florida (USD).
- Idioma base del producto: español.
- Fuente de verdad del dominio público y literales de validación: `CONTEXT.md`.

## Capabilities and Constraints

- El formulario de `/talento` es exclusivamente para candidatos; las empresas interesadas en contratar servicios deben ser dirigidas a `contacto@nexova.com`.
- Los 11 mensajes de error, el mensaje de éxito y el bloque Schema.org `Organization` de `CONTEXT.md` deben mantenerse literales.
- En las interfaces internas (`uis/backoffice` y `uis/application`), los códigos crudos de la API se traducen siempre a español mediante diccionarios de etiquetas.

## Brand Commitments

- Nombre: **Nexova** / **Nexova Solutions**.
- Cifras verificadas: fundación en 2011, 12 años de experiencia, +500 procesos exitosos, sedes en Valencia (`+34 960 123 456`) y Miami (`+1 305 555 0191`), contacto `contacto@nexova.com`.

## Accessibility & Inclusion

- Cumplimiento WCAG AA (contraste mínimo 4.5:1 en texto normal y placeholders, 3:1 en texto grande).
- Navegación completa por teclado, foco visible, objetivos táctiles ≥ 44px en móvil y respeto a `prefers-reduced-motion`.
