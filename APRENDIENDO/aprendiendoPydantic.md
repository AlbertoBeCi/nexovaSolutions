# ✅ Validar datos con Pydantic

**Idea principal:** un schema describe qué datos acepta la API y qué datos devuelve.

## 📥 Entrada y 📤 salida

| Schema | Responsabilidad |
| --- | --- |
| `ProviderCreate` | Lo que envía el cliente para crear un proveedor. |
| `ProviderResponse` | El proveedor devuelto, con `id` y `updated_at`. |

El backend genera el ID y la fecha de actualización.

## 🧩 Reglas escritas en el modelo

```python
monthly_rate: float = Field(gt=0)
```

Esto exige una tarifa mayor que cero. Otras reglas del proveedor son:

- País: `Spain` o `USA`.
- Al menos una categoría permitida.
- Email de contacto válido, si se proporciona.
- España usa `EUR`; Estados Unidos usa `USD`.

La relación país–moneda se comprueba con `@model_validator`, porque necesita mirar ambos campos juntos.

## 🚫 Campos inesperados

Con `extra="forbid"`, enviar un campo que el schema no declara produce **HTTP 422**. Por ejemplo, el cliente no puede incluir `updated_at` para cambiar la fecha por su cuenta.

FastAPI valida antes de ejecutar el endpoint. La interfaz puede avisar antes, pero las reglas definitivas siguen en el backend.

## 🧰 En inventario

Los schemas de creación rechazan cantidades no positivas y campos del servidor, como `user_uuid` y `created_at`.

La respuesta del activo añade `current_stock`. El schema describe el contrato HTTP; el modelo ORM describe la tabla SQL y está en otro archivo.

📍 [Schemas de proveedores](services/api/models.py) · [Schemas de inventario](services/api/inventory_schemas.py) · [Guía ORM](aprendiendoORM.md).

🏠 [Volver al índice](APRENDIENDO.md)
