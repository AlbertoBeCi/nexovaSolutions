# `.agents/skills/`

Una carpeta por skill:

```
.agents/skills/<skill>/
├─ SKILL.md        # instrucciones: cuándo usarla y cómo
├─ scripts/        # (opcional) código que ejecuta la skill
└─ resources/      # (opcional) plantillas, referencias
```

Son capacidades reutilizables, agnósticas de herramienta, que cualquier agente
puede invocar en el repo. Cada `SKILL.md` documenta: **objetivo único**, **inputs**
y **criterios de aceptación verificables**. Frontmatter mínimo:

```markdown
---
name: <skill>
description: <cuándo conviene usar esta skill>
scope: agent-requested
---
```

## Skills actuales

| Skill | Objetivo | Tarea recurrente |
| --- | --- | --- |
| [`revision-textos-ui/`](./revision-textos-ui/SKILL.md) | Verificar que un cambio en `uis/` cumple la regla de idioma y fidelidad al dominio de `CONTEXT.md` | Paso 3 del flujo previo a commit cuando el diff toca `uis/**` |

> Nota: `./skills/` (raíz) y `./.claude/skills/` son de la plantilla original.
> Las skills nuevas del proyecto van aquí.
