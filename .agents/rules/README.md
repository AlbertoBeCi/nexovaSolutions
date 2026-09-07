# `.agents/rules/`

Una regla por archivo, nombre en kebab-case (`<rule-name>.md`).

Cada regla asume [`AGENTS.md`](../../AGENTS.md) y solo añade lo específico de una
carpeta o tarea: dependencias, comandos, patrones de código, validaciones del
dominio, comprobaciones extra antes del commit.

## Alcance de aplicación (obligatorio)

Cada regla declara su alcance en el frontmatter y en una línea `**Alcance:**` al
inicio. Tres tipos:

| `scope` | Cuándo se aplica |
| --- | --- |
| `always` | **Siempre activa.** En todo cambio del repo. |
| `file-pattern` | Cuando el cambio toca rutas que casan con `globs`. |
| `agent-requested` | Solo cuando el agente (o el desarrollador) la invoca para una tarea concreta. |

```markdown
---
rule: <rule-name>
scope: always | file-pattern | agent-requested
globs: ["uis/**"]          # solo para file-pattern
---

# <rule-name>

**Alcance:** <always | por patrón de archivo `...` | solicitada>

## Reglas
- ...

## Antes de commit
- ...
```

## Reglas actuales

| Regla | Alcance |
| --- | --- |
| [`idioma-y-dominio.md`](./idioma-y-dominio.md) | `always` |
| [`uis.md`](./uis.md) | `file-pattern` — `uis/**` |
| [`services.md`](./services.md) | `file-pattern` — `services/**` |
