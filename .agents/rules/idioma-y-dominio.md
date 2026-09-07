---
rule: idioma-y-dominio
scope: always
globs: ["**"]
---

# Idioma y fidelidad al dominio

**Alcance:** siempre activa — aplica a todo cambio del repo, sin excepción.

Deriva de [`CONTEXT.md`](../../CONTEXT.md). Si algo aquí choca con `CONTEXT.md`,
gana `CONTEXT.md`.

## Reglas

1. **Idioma base: español.** Toda la UI, mensajes de error, textos de cara al
   usuario y contenido de producto van en español. Un segundo idioma es mejora
   opcional y nunca a costa de la calidad del español.
2. **Nunca se muestran valores crudos de la API.** `received`, `in_progress`,
   `selected`, `discarded`, `pending`, `review`, `personal_interview`,
   `technical_interview`, `offer_presented` se traducen **siempre** con los
   diccionarios de etiquetas (`statusLabels`, `stageLabels`). En un `<select>`,
   el `value` usa el código de la API; el texto visible, la etiqueta en español.
3. **Los literales de validación son los de `CONTEXT.md`.** Los mensajes de error
   del formulario de talento (sección "Mensajes de error esperados") y el mensaje
   de éxito se copian **carácter a carácter**. No se parafrasean.
4. **Datos de contacto y cifras** (emails, teléfonos de Valencia/Miami, "12 años",
   "+500 procesos", fundación 2011) salen de `CONTEXT.md`. No inventar.
5. **El formulario de talento es solo para candidatos.** Si aparece captación B2B,
   debe mostrar el aviso "¿Eres una empresa buscando talento? Escríbenos a
   contacto@nexova.com".
6. **Schema.org**: la landing pública lleva el JSON-LD `Organization` de
   `CONTEXT.md` sin alterar sus valores.

## Antes de commit

- `grep` en el diff: ningún literal de estado/etapa de la API en JSX fuera de los
  mapas de etiquetas.
- Si tocaste textos de validación o de éxito, compáralos con `CONTEXT.md`.
