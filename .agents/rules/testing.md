---
rule: testing
scope: file-pattern
globs: ["services/**", "uis/**", "packages/**"]
---

# testing

**Alcance:** por patrón de archivo — activa cuando el cambio toca `services/**`,
`uis/**` o `packages/**`. Las pruebas evolucionan con el código: **un cambio de
comportamiento no está terminado hasta que sus pruebas están actualizadas**, igual
que el `memory-bank/`.

Guía de la batería (qué prueba cada archivo, resultados, cobertura):
[`TESTING.md`](../../TESTING.md).

## Qué obliga a tocar las pruebas

| Si en tu cambio… | Entonces, en el mismo commit… |
| --- | --- |
| ➕ Añades un endpoint | Añade pruebas de **camino feliz**, **límites** y **errores** (ver checklist). |
| ✏️ Cambias un endpoint (ruta, campos, validación, status, mensaje, permisos) | Actualiza las pruebas afectadas; si fijaban un `# Comportamiento actual:` que cambias, edítalas **a propósito**. |
| 🗑️ Quitas un endpoint o campo | Borra sus pruebas; no dejes pruebas huérfanas ni `skip`. |
| 🔐 Proteges o desprotegés una ruta | Actualiza la matriz de rutas protegidas/públicas de `services/api/tests/test_accounts_rules.py`. |
| 🔀 Cambias una regla compartida (`packages/shared/`: transiciones, validación, analizador) | Revisa **todos** los consumidores: pruebas de `services/*`, `packages/shared/tests/` y el espejo TS (`uis/application/types/incident.ts` + `incident-types.test.ts`). |
| 🌐 Cambias un cliente HTTP de `uis/` (`lib/*-api.ts`, `src/services/*`) o el contrato de un endpoint que consume | Actualiza sus pruebas Jest (mapeo, errores traducidos, 401). |
| 🐞 Corriges un bug | Añade antes la prueba que lo reproduce (debe fallar sin el arreglo). |

## Checklist de un endpoint nuevo

| 🎯 Tipo | ✅ Mínimo exigido |
| --- | --- |
| 🟢 Camino feliz | Respuesta correcta con datos válidos y efecto persistido (un GET posterior lo confirma). |
| 🟡 Límites | Valores justo en el borde de cada regla (mínimo/máximo, vacío, solo espacios, `null`), cada valor del catálogo de un enum, ids inexistentes. |
| 🔴 Errores | Cada rama de error del handler (400/404/409/422…), que **un fallo no modifique datos**, y permisos (401 sin sesión, 403 sin rol). |
| 🙈 Fugas | Un 500 nunca expone el texto de la excepción. |

## Convenciones

- 🐍 **Python (`pytest`):** pruebas en `tests/` junto al servicio; un archivo por tema
  (`*_rules.py` para reglas de negocio). Reutiliza las fixtures de `conftest.py`
  (`anon_client`, `user_client`, `admin_client` en `services/api`; `client`,
  `create_incident` en `incident-manager-api`). Varios valores → `@pytest.mark.parametrize`.
- 🟦 **TypeScript (Jest):** `*.test.ts` en `__tests__/` junto al módulo; `fetch` se
  mockea con `mockFetch`/`jsonResponse` de `helpers.ts`. Una carpeta `__tests__` no
  se escanea en el verificador `revision-textos-ui`.
- 🎯 **Prueba la lógica, no la serialización HTTP:** reglas, permisos, mapeo y mensajes;
  no cabeceras, CORS ni el formato exacto del JSON.
- 📌 **Comportamiento discutible:** si fijas lo que el código hace hoy y quizá deba
  cambiar, márcalo con `# Comportamiento actual: …` y añádelo a la tabla
  «Comportamientos fijados» de `TESTING.md`.
- 🛡️ **Aislamiento:** nunca tocar datos reales (`data/`), enviar emails ni llamar a APIs
  externas. Estado global (`store`, `rate_limit`) se reinicia en fixtures `autouse`.
- 🚫 **Prohibido** dejar una prueba en `skip`/`xfail`, borrarla o debilitar un
  `assert` solo para que pase. Si una prueba falla, o el código está mal o la
  prueba describe un comportamiento que cambió a propósito: decide cuál y dilo.

## Antes de commit

1. ▶️ Ejecuta las pruebas del área tocada **y de sus consumidores**, todas en verde
   (`uv run pytest` desde la raíz lanza las 3 suites Python):
   - `services/api` → `uv run pytest`
   - `services/incident-manager-api` → `uv run pytest`
   - `uis/application` / `uis/backoffice` → `npm test` (con `npx jest --coverage` si quieres ver cobertura)
   - `packages/shared` → sus pruebas (`packages/shared/tests/`)
2. 📝 Si cambió el número de pruebas, un comportamiento fijado o la cobertura,
   actualiza [`TESTING.md`](../../TESTING.md) (resumen,
   tabla del archivo afectado y «Comportamientos fijados»).
3. 🧠 Si cambió el estado de las pruebas, refléjalo en `memory-bank/progress.md`
   y `memory-bank/activeContext.md`.
