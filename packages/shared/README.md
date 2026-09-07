# `@repo/shared-types`

Tipos TypeScript compartidos entre aplicaciones, servicios y agentes del
monorepo. Requerido por [`packages/README.md`](../README.md): todo paquete lleva
su propio README.

## Estado

Plantilla. `types/index.ts` solo tiene los placeholders `Id` y `BaseEntity`.

## Qué poner aquí

- Interfaces que **dos o más** áreas (`uis/`, `services/`, `agents/`) necesitan
  compartir — p. ej. el contrato de la API de candidatos.
- Nada específico de una sola app: eso vive en la carpeta de esa app.
- Lógica de negocio (scoring, filtros) no va aquí; va en
  [`@repo/domain`](../domain/README.md).

## Uso

```jsonc
// package.json del consumidor
"dependencies": { "@repo/shared-types": "*" }
```

```ts
import type { BaseEntity } from "@repo/shared-types";
```
