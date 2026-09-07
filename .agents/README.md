# `.agents/` — configuración de agentes del monorepo

Complementa a [`AGENTS.md`](../AGENTS.md) (raíz), que define cómo opera **cualquier
agente**, qué leer al inicio de sesión y el flujo previo a un commit. Aquí vive la
configuración detallada, agnóstica de herramienta (Claude Code, Cursor, Copilot…).

## Estructura

```
./.agents
├─ rules/
│  ├─ <rule-name>.md        # una regla por archivo, con alcance declarado
│  └─ README.md             # tipos de alcance + plantilla
└─ skills/
   ├─ <skill>/SKILL.md      # objetivo único + inputs + criterios de aceptación
   └─ <skill>/scripts/      # verificadores ejecutables (opcional)

./memory-bank                # contexto del proyecto entre sesiones (en la raíz)
├─ projectbrief.md  productContext.md      (negocio)
├─ techContext.md   systemPatterns.md      (técnico)
└─ activeContext.md progress.md            (estado)
```

### `rules/`

Una regla por archivo (kebab-case). Cada una **declara su alcance** —
`always` · `file-pattern` · `agent-requested` — en el frontmatter y en una línea
`**Alcance:**`. Detalle y plantilla en [`rules/README.md`](./rules/README.md).

Reglas actuales: [`idioma-y-dominio`](./rules/idioma-y-dominio.md) (`always`),
[`uis`](./rules/uis.md) (`uis/**`), [`services`](./rules/services.md) (`services/**`).

### `skills/`

Una carpeta por skill con su `SKILL.md` (objetivo único, inputs, criterios de
aceptación verificables) y sus scripts al lado.

Skills actuales: [`revision-textos-ui`](./skills/revision-textos-ui/SKILL.md).

### `memory-bank/`

Ver [`../memory-bank/README.md`](../memory-bank/README.md). El agente lo lee al
inicio de cada sesión (orden en `AGENTS.md` §1) y lo actualiza en el mismo commit
cuando cambia el foco, el estado o una decisión.

## Precedencia

1. `CONTEXT.md` — dominio de negocio, gana siempre.
2. `AGENTS.md` (raíz) — reglas generales, lectura de sesión y flujo de commit.
3. `.agents/rules/` — reglas `always` + las que casan con el área en la que trabajas.
4. `README.md` de la carpeta concreta.

`memory-bank/` es contexto, no reglas: informa las decisiones pero no sustituye a
lo anterior.
