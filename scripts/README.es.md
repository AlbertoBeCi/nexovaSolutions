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
