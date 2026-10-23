# 🧪 Comprobar el comportamiento con pytest

**Idea principal:** una prueba automática ejecuta una acción y comprueba que su resultado coincide con lo esperado.

## 🔄 Una prueba sencilla

    Preparar datos → llamar al endpoint → comprobar respuesta y datos guardados

Ejemplos del proyecto:

- Crear un proveedor devuelve **201**.
- Una tarifa inválida devuelve **422**.
- Pedir un activo inexistente devuelve **404**.
- Una salida sin stock devuelve **400** y no guarda una orden.
- Ejecutar dos veces un seed no duplica sus registros.

## 🧰 Las herramientas

| Herramienta | Qué aporta |
| --- | --- |
| `TestClient` | Llama a FastAPI sin iniciar un servidor externo. |
| **Fixture** | Prepara una base temporal, un token u otros datos reutilizables. |
| `parametrize` | Repite una prueba con distintos casos. |
| `monkeypatch` | Sustituye temporalmente configuración o funciones. |
| `dependency_overrides` | Entrega una dependencia de pruebas en lugar de la real. |

Las pruebas de fechas pueden controlar el reloj para evitar fallos que dependan del tiempo de ejecución.

## 🗃️ Separar los datos de pruebas

Los tests habituales usan TinyDB y SQLite temporales. Las llamadas de email se sustituyen para que no envíen correos reales.

La concurrencia de inventario requiere **PostgreSQL aislado**: SQLite no comprueba el mismo bloqueo de filas. Esa prueba se omite si no se configura una base adecuada.

> 💾 Antes de una prueba destructiva, actualiza el backup o créalo y verifica que se pueda restaurar. Si falla el backup, la prueba no se ejecuta. Los tests destructivos no se conectan a producción.

## ▶️ Ejecutar y leer el resultado

Desde `services/api`:

```bash
uv run pytest
```

**Passed** significa que la prueba pasó; **failed**, que falló; **skipped**, que no se ejecutó. Una prueba omitida sigue pendiente de validación.

📍 [Fixtures](services/api/tests/conftest.py) · [Tests de proveedores](services/api/tests/test_suppliers.py) · [Tests de inventario](services/api/tests/test_inventory.py).

🏠 [Volver al índice](APRENDIENDO.md)
