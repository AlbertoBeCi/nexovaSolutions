# `.agents/rules/`

Una regla por archivo, nombre en kebab-case (`<rule-name>.md`).

Cada regla asume [`AGENTS.md`](../../AGENTS.md) y solo añade lo específico de una
carpeta o tarea: dependencias, comandos, patrones de código, validaciones del
dominio, comprobaciones extra antes del commit.

## Alcance de aplicación (obligatorio)

Cada regla declara su modo de activación (`trigger`) en el frontmatter YAML y en una
línea `**Alcance:**` al inicio. Modos compatibles con Antigravity:

| `trigger` | Cuándo se aplica | Campos requeridos |
| --- | --- | --- |
| `always_on` | **Siempre activa.** En todo cambio del repo. | `description` (opcional) |
| `glob` | Cuando el cambio toca rutas que casan con `globs`. | `globs`, `description` |
| `model_decision` | Cuando el agente decide que aplica según `description`. | `description` |
| `manual` | Solo cuando el desarrollador la invoca explícitamente con `@`. | — |

```markdown
---
trigger: always_on | glob | model_decision | manual
globs: "uis/**"            # solo para trigger: glob (lista separada por comas)
description: "Descripción breve de la regla."
---

# <rule-name>

**Alcance:** <always | por patrón de archivo `...` | solicitada>

## Reglas
- ...

## Antes de commit
- ...
```

## Reglas actuales

| Regla | Trigger / Alcance |
| --- | --- |
| [`idioma-y-dominio.md`](./idioma-y-dominio.md) | `always_on` |
| [`uis.md`](./uis.md) | `glob` — `uis/**` |
| [`services.md`](./services.md) | `glob` — `services/**` |
| [`testing.md`](./testing.md) | `glob` — `services/**, uis/**, packages/**` |
