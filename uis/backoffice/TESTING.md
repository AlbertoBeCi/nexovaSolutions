# Pruebas de `uis/backoffice` (Jest)

Batería de **114 pruebas** con **Jest** sobre la **lógica TypeScript** de los
clientes del backoffice: pipeline de candidatos (API externa de 4Geeks
Tracker), análisis de incidencias CSV (`services/api`) y sesión. No prueba la
serialización HTTP ni los componentes React; `fetch` se sustituye por un doble
de prueba, así que no hace falta ninguna API levantada.

## Cómo ejecutarlas

```bash
cd uis/backoffice
npm install                 # una sola vez
npm test                    # toda la batería (<1 s)
npx jest --coverage         # con informe de cobertura
npx jest services/__tests__/api   # solo un archivo
```

## Cómo leer el resultado

| Salida de Jest | Significado | Qué hacer |
| --- | --- | --- |
| `Tests: 114 passed` ✅ | La lógica de los clientes se comporta como se espera. | Nada. |
| `✕ nombre de la prueba` ❌ | Una regla cambió: Jest muestra `Expected` y `Received`. | Corregir el código o actualizar la prueba si el cambio fue intencionado. |
| `Test suite failed to run` ⚠️ | Error de compilación/import antes de ejecutar. | Revisar el mensaje. |

## Qué se prueba y qué significa el resultado

| Archivo | Qué comprueba | Si pasa ✅ | Si falla ❌ |
| --- | --- | --- | --- |
| `src/services/__tests__/api.test.ts` | Candidatos y notas: mapeo DTO → modelo (fechas a `Date`), filtros, `getCandidateById` → `null` en 404, payload de escritura sin `status`/`stage`, errores en español y **red caída sin `TypeError` nativo**. | La lista y la ficha de candidatos muestran datos correctos y errores legibles. | Aparecería «Failed to fetch», o se sobrescribiría el estado del candidato al editarlo. |
| `src/services/__tests__/incidents-api.test.ts` | Resumen del análisis: siempre 7 reglas/5 categorías/3 estados en orden fijo, huecos a 0, etiquetas en español, tildes corregidas en errores, 401 cierra sesión y descarga de `results.csv`. | El análisis de incidencias se pinta completo y los errores son claros. | Faltarían filas en las tablas, o se verían mensajes sin tildes / en inglés. |
| `src/lib/__tests__/api-client.test.ts` | Igual que en `uis/application`: token, errores y política de 401. | La sesión caducada se limpia y los errores son legibles. | Se mostraría un error crudo o se cerraría la sesión sin motivo. |
| `src/lib/__tests__/auth-api.test.ts` | Login, registro, sesión, perfil y cambio de contraseña (el backoffice no tiene «olvidé contraseña»). | Los flujos de cuenta funcionan con mensajes correctos. | Mensajes mal escritos o token mal guardado. |
| `src/lib/__tests__/auth-storage.test.ts` | Guardar/leer/borrar token, suscriptores y `localStorage` bloqueado. | La sesión no rompe en modo privado. | Excepciones si el navegador bloquea el almacenamiento. |

## Cobertura actual

99,5 % de líneas en `src/lib` y `src/services` (`npx jest --coverage`).
