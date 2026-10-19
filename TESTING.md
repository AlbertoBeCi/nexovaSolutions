# Pruebas de la auditoría

## Backoffice

Desde `uis/backoffice`: `npm test -- --runInBand` ejecuta **8 pruebas**: cinco de
`CandidateSelect` con Jest y Testing Library. Cubren etiquetas accesibles,
traducción de opciones, eventos controlados, atributos nativos y estado de guardado;
tres comprueban que la precarga y las lecturas de candidato/notas usan las mismas URLs.

## Navegador y rendimiento

Desde la raíz: `node scripts/audit-regression.mjs final` comprueba ambos frontends
en producción. Bloquea las escrituras hacia la API real. Los resultados se guardan
en `audit/checks/`.

`node scripts/audit-frontends.mjs after 3` ejecuta Lighthouse tres veces por URL;
las condiciones y los informes originales quedan en `audit/after/`.

Las herramientas de navegador se instalan en TEMP, según `scripts/README.md`.
Cada app se comprueba también con `npm run lint` y `npm run build`.
