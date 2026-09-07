---
name: revision-textos-ui
description: Verifica que un cambio en uis/ cumple las reglas de idioma y fidelidad al dominio de CONTEXT.md antes de commitear (español, sin valores crudos de la API, literales exactos).
scope: agent-requested
---

# Skill: revisión de textos de UI

## Objetivo único

Dado un cambio en `uis/`, **verificar que no rompe la regla
[`idioma-y-dominio`](../../rules/idioma-y-dominio.md)** derivada de
[`CONTEXT.md`](../../../CONTEXT.md). No corrige, no refactoriza: solo verifica y
reporta PASS/FAIL con las líneas ofensivas.

Tarea recurrente: se ejecuta en el paso 3 del flujo previo a commit de `AGENTS.md`
cada vez que el diff toca `uis/**`.

## Inputs

| Input | Por defecto | Descripción |
| --- | --- | --- |
| `rutas` | archivos `*.tsx`/`*.ts` del `git diff` bajo `uis/` | Qué revisar. Acepta `uis/website`, `uis/backoffice` o `uis/**`. |
| `contexto` | `CONTEXT.md` | Fuente de los literales de error/éxito y del bloque Schema.org. |
| `etiquetas` | `uis/backoffice/src/types/candidate.ts` | Define `statusLabels` y `stageLabels`; único sitio donde pueden vivir los códigos crudos. |

Ejecutar el verificador automático:

```bash
node .agents/skills/revision-textos-ui/scripts/check-ui-texts.mjs [ruta...]
```

Sin argumentos revisa `uis/`. Devuelve exit 0 si todo PASS, exit 1 si algún FAIL.

## Criterios de aceptación (explícitos y verificables)

| # | Criterio | Cómo se verifica |
| --- | --- | --- |
| 1 | Ningún literal crudo de estado/etapa de la API (`"received"`, `"in_progress"`, `"selected"`, `"discarded"`, `"pending"`, `"review"`, `"personal_interview"`, `"technical_interview"`, `"offer_presented"`) aparece como texto en JSX fuera de `candidate.ts`. | Script — regex sobre `.tsx`; falla si hay match fuera de `types/candidate.ts`. |
| 2 | Todo texto visible de estado/etapa se resuelve vía `statusLabels[...]` / `stageLabels[...]`. | Revisión manual guiada: cada `<option>`, badge o celda de estado/etapa usa el diccionario. |
| 3 | Los mensajes de validación y el mensaje de éxito presentes en el código coinciden **carácter a carácter** con `CONTEXT.md` (secciones "Mensajes de error esperados" y "Mensaje de éxito"). | Comparación manual contra `CONTEXT.md`. El script lista los strings largos añadidos en el diff para facilitarla. |
| 4 | Cada página/componente de `uis/` que hace `fetch`/llama a `services/api` renderiza un estado de **carga** y un estado de **error** visibles. | Revisión manual: buscar `loading` y `error`/`catch` con render asociado. |
| 5 | La ruta `/` de `uis/website` incluye `<script type="application/ld+json">` con `"@type": "Organization"` y los valores de `CONTEXT.md`. | Script — comprueba presencia; valores contra `CONTEXT.md` a ojo. |
| 6 | Idioma: los textos de cara al usuario añadidos están en español. | Revisión manual. |

## Salida

Informe por criterio:

```
revision-textos-ui — uis/backoffice
  [PASS] 1. sin literales crudos de estado/etapa
  [FAIL] 2. app/candidates/[id]/page.tsx:88  badge muestra {candidate.stage} sin stageLabels
  [PASS] 4. estados de carga y error presentes
  ...
Resultado: FAIL (1 criterio)
```

Si el resultado es FAIL, **no se commitea** hasta corregir.
