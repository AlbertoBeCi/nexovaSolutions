# `memory-bank/`

Contexto del proyecto que debe sobrevivir entre sesiones de trabajo con agentes.
Un archivo markdown por tema.

**Al empezar una sesión:** el agente lee estos archivos (orden en `AGENTS.md` §1).
**Durante el trabajo:** cuando cambie el foco, se tome una decisión o avance el
estado, actualiza el archivo correspondiente **en el mismo commit**.

No dupliques `CONTEXT.md` (dominio de negocio) ni lo que ya está en el código:
enlaza.

| Archivo | Tipo | Contenido |
| --- | --- | --- |
| [`projectbrief.md`](./projectbrief.md) | negocio | Objetivo del proyecto, hitos, alcance |
| [`productContext.md`](./productContext.md) | negocio | Problema que resuelve, stakeholders, decisiones de producto |
| [`techContext.md`](./techContext.md) | técnico | Stack, versiones, restricciones técnicas |
| [`systemPatterns.md`](./systemPatterns.md) | técnico | Arquitectura y decisiones tomadas |
| [`activeContext.md`](./activeContext.md) | estado | En qué se trabaja ahora y por qué |
| [`progress.md`](./progress.md) | estado | Qué funciona, qué falta, próximos pasos |

Contiene contexto **de negocio y técnico** (no solo uno de los dos), alineado con
[`../CONTEXT.md`](../CONTEXT.md).
