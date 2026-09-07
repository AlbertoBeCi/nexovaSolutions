# Product context

## Problema de negocio

Nexova recibe CVs por email sin estructura. No hay forma de capturar leads de
candidatos ni de seguir su avance en los procesos de selección. La web anterior
(2019) es lenta, no accesible y no convierte.

## Stakeholder

**Carmen Ruiz**, Head of Marketing. Pide: web corporativa moderna + página con
formulario estructurado para que profesionales se registren en el banco de
talento (datos de contacto, experiencia, sector, nivel de inglés, disponibilidad).

## Decisiones de producto

- El formulario de talento es **solo para candidatos**, no para empresas que
  buscan contratar servicios. Debe mostrar un aviso visible redirigiendo a esas
  empresas a `contacto@nexova.com`.
- La UI interna nunca muestra los valores crudos de la API; se traducen a español
  con diccionarios de etiquetas.
- Posicionamiento: consultora de RRHH "potenciada con IA" (scoring de CVs, RAG,
  búsqueda semántica) — ver `docs/company-choice.md` y `docs/prompts.md`.

## Textos y validaciones

Literales exactos (mensajes de error, mensaje de éxito, campos y reglas) en
[`CONTEXT.md`](../CONTEXT.md). No inventar copy: usar el de ahí.
