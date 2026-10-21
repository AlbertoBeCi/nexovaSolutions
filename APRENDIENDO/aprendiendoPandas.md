# 📊 Analizar CSV con pandas

**Idea principal:** convertir una tabla de tickets en un resumen fácil de interpretar.

## 🔄 El recorrido

    CSV → leer tabla → validar filas → calcular métricas → mostrar/exportar

[scripts/analyze.py](scripts/analyze.py) recibe la ruta por la terminal. Si no se indica, la pregunta con `input()`.

## 🧩 Tres conceptos útiles

| Concepto | Qué significa |
| --- | --- |
| **DataFrame** | Una tabla de filas y columnas dentro de Python. |
| **Series** | Una columna de esa tabla. |
| **Máscara booleana** | Un `True` o `False` por fila para seleccionar registros. |

pandas puede validar toda una columna sin escribir un bucle por cada fila.

## ✅ Las 7 reglas

Un ticket es inválido si tiene alguno de estos problemas:

- Falta la empresa cliente.
- La categoría no está permitida.
- La descripción es demasiado corta.
- `agent_id` no cumple el formato `AGT-` y dos dígitos.
- El email no contiene `@`.
- Está cerrado y no tiene puntuación.
- La puntuación queda fuera de 1–5.

Las máscaras se combinan con **OR**. Una fila que incumple dos reglas cuenta como un único ticket inválido, aunque aparezca en ambos detalles de errores.

## 📈 Qué devuelve

El resumen incluye conteos por categoría y estado, registros inválidos y satisfacción media de los tickets cerrados válidos. Al terminar puedes exportarlo a `scripts/results.csv`.

La lógica compartida está en [incidents_analysis.py](packages/shared/nexova_shared/incidents_analysis.py); el script y la API la reutilizan.

> 🔒 Las salidas solo reciben métricas agregadas. No imprimas ni exportes emails individuales de clientes.

**Ejecutarlo desde la raíz:**

```bash
uv run --project services/api python scripts/analyze.py scripts/incidents-COMPANY.csv
```

🏠 [Volver al índice](APRENDIENDO.md)
