# Pruebas de `uis/application` (Jest)

Batería de **143 pruebas** con **Jest** sobre la **lógica TypeScript** de los
clientes que consumen `services/api` y `services/incident-manager-api`:
mapeo de datos, traducción de errores al español, manejo de sesión y reglas de
estado. No prueba la serialización HTTP ni los componentes React; `fetch` se
sustituye por un doble de prueba, así que no hace falta levantar ninguna API.

## Cómo ejecutarlas

```bash
cd uis/application
npm install                 # una sola vez
npm test                    # toda la batería (<1 s)
npx jest --coverage         # con informe de cobertura
npx jest incidents-api      # solo un archivo
```

## Cómo leer el resultado

| Salida de Jest | Significado | Qué hacer |
| --- | --- | --- |
| `Tests: 143 passed` ✅ | La lógica de los clientes se comporta como se espera. | Nada. |
| `✕ nombre de la prueba` ❌ | Una regla cambió: Jest muestra `Expected` y `Received`. | Corregir el código o actualizar la prueba si el cambio fue intencionado. |
| `Test suite failed to run` ⚠️ | Error de compilación/import antes de ejecutar. | Revisar el mensaje (tipo roto, ruta del alias `@/`). |

## Qué se prueba y qué significa el resultado

| Archivo (`lib/__tests__/`) | Qué comprueba | Si pasa ✅ | Si falla ❌ |
| --- | --- | --- | --- |
| `api-client.test.ts` | Token adjuntado solo si existe; errores de red, 4xx/5xx y cuerpos ilegibles → mensaje en español; **401 con sesión cierra sesión, 401 sin sesión no**. | La persona siempre ve un mensaje claro y la sesión caducada se limpia. | Se vería «Failed to fetch» o un error crudo, o un login fallido cerraría la sesión por error. |
| `auth-storage.test.ts` | Guardar/leer/borrar token, suscriptores, y que un `localStorage` bloqueado no rompa la app. | La sesión se gestiona sin romper en modo privado. | La app lanzaría excepciones si el navegador bloquea el almacenamiento. |
| `auth-api.test.ts` | Login, registro (+ login automático, perfil recortado), sesión, perfil, olvidé/restablecer/cambiar contraseña; textos con tildes. | Los flujos de cuenta funcionan y los mensajes salen en español correcto. | Se mostrarían mensajes sin tildes o en inglés, o se guardaría un token inválido. |
| `suppliers-api.test.ts` | Mapeo `snake_case ⇄ camelCase`, filtros vacíos omitidos, y cada error de validación traducido («Tarifa mensual debe ser mayor que 0»…). | El directorio de proveedores muestra datos y errores correctos. | Campos mal mapeados o errores de Pydantic en inglés llegarían a la pantalla. |
| `incidents-api.test.ts` | Mapeo de incidencias, filtros, `IncidentsApiError` por tipo, transiciones inválidas con etiquetas en español y **que nunca se muestre el texto del backend**. | Los errores del gestor se muestran con textos propios de la UI. | Se filtraría texto crudo del backend o un código como `in_progress`. |
| `incident-types.test.ts` | Las transiciones de la UI coinciden **exactamente** con las del backend; cada código tiene etiqueta en español; *type guards*. | La UI y el backend están de acuerdo en el flujo de estados. | Se ofrecerían a la persona transiciones que el backend rechaza. |

## Cobertura actual

99,8 % de líneas en `lib/` y `types/incident.ts` (`npx jest --coverage`).
