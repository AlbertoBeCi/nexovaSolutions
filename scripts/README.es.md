# Carpeta `scripts`

Esta carpeta contiene **scripts auxiliares** del monorepo: automatizaciones de desarrollo, utilidades de mantenimiento, tareas repetitivas (setup, lint, migraciones, generación de datos, etc.) y tooling interno.

- **Propósito principal**: agrupar herramientas de soporte que no pertenecen a una app/agente/pipeline específico, pero facilitan el trabajo del equipo.
- **Recomendación**: documenta cada script (qué hace, parámetros, requisitos, ejemplos de uso) y procura que sean reproducibles (y seguros) en distintos entornos.

## `analyze.py` — análisis de tickets de soporte (Nexova)

Script en Python (requiere `pandas`, instálalo con `pip install pandas`) que procesa un
CSV de tickets de soporte, detecta registros inválidos y calcula métricas por
categoría, estado y satisfacción del cliente, sin exponer nunca emails individuales.

```bash
pip install pandas
python scripts/analyze.py scripts/incidents-COMPANY.csv   # o sin argumento: pide la ruta
```

- `generate_incidents_fixture.py`: genera un CSV de prueba sintético y reproducible
  (`incidents-COMPANY.csv`) con datos ficticios, útil para probar `analyze.py`.
- `APRENDIENDO.md`: explicación paso a paso del script pensada para quien recién
  empieza con Python y pandas.

## `seed_incidents.py` — carga el gestor de incidencias (Nexova)

Carga `incidents-COMPANY.csv` en el gestor de incidencias persistente
(`services/incident-manager-api/`), aplicando las mismas 7 reglas de
validación que `analyze.py` más un mapeo CSV → `Incident` (ver el README de
ese servicio). Necesita las dependencias de `services/incident-manager-api`
(SQLAlchemy + pandas), así que se ejecuta con su entorno `uv` en vez de un
`python` a secas:

```bash
uv run --project services/incident-manager-api python scripts/seed_incidents.py
```

Idempotente: ejecutarlo dos veces inserta 0 la segunda vez (ver
`services/incident-manager-api/README.md` para los conteos esperados y el
modelo de datos con restricciones CHECK que alimenta).

## `audit-frontends.mjs` — mediciones locales reproducibles

Necesita ambas apps Next.js en producción en 3000/3001 y Chrome. Instala las herramientas fuera del repositorio:

```powershell
npm install --prefix "$env:TEMP\nexova-performance-tools" lighthouse@13.5.0 playwright@1.64.1 web-vitals@6.2.3
node scripts/audit-frontends.mjs before/production 3
```

Ejecuta desde la raíz. Argumentos: fase dentro de `audit/`, número de pasadas (o `shots` para volver a capturar informes existentes) y nombres opcionales de casos. Guarda la URL fija del candidato en `audit/cases.json`, restablece el almacenamiento entre navegaciones Lighthouse y conserva informes, condiciones, trazas y capturas. Mantén versiones y configuración iguales antes/después; estas mediciones de laboratorio no representan un p75 de usuarios reales.

## `audit-regression.mjs` — comprobaciones de navegador sin escrituras reales

Usa las herramientas temporales Playwright/web-vitals y los servidores de
producción anteriores. Ejecuta `node scripts/audit-regression.mjs final` desde la
raíz. Acepta el ámbito opcional `website` o `backoffice` después de la fase.
La fase admite letras, números y guiones; guarda `audit/checks/<fase>.json`.

Comprueba navegación, temas, formulario público, filtros accesibles, CRUD con
respuestas simuladas, errores de API, contraste, fuentes y reutilización de
precargas. Bloquea las mutaciones reales. Observa INP con CPU ×4 sin simulación de
red; son observaciones locales, no p75 de campo. La comprobación aislada de la
ficha fija es de solo lectura y mantiene la caché para verificar las precargas.
