# 🏢 El directorio de proveedores

**Idea principal:** la app de operaciones permite consultar y mantener los contratos de proveedores de Nexova.

## 🔄 El recorrido

    Pantalla /suppliers → API /suppliers → TinyDB → respuesta → actualizar tabla

La app vive en `uis/application` y usa el puerto **3001**. La API usa el **8000**. El usuario inicia sesión para acceder a las rutas protegidas.

## 🌐 El CRUD

CRUD reúne crear, consultar, actualizar y eliminar.

| Acción | Endpoint |
| --- | --- |
| Crear | `POST /suppliers` |
| Listar / consultar uno | `GET /suppliers` / `GET /suppliers/{id}` |
| Cambiar tarifa | `PATCH /suppliers/{id}/rate` |
| Cambiar estado | `PATCH /suppliers/{id}/status` |
| Eliminar | `DELETE /suppliers/{id}` |

`PATCH` cambia una parte del registro. Crear devuelve **201**; eliminar devuelve **204** sin cuerpo; un ID inexistente devuelve **404**.

## 🔎 Filtros que se pueden compartir

Una URL como `/suppliers?country=Spain&category=software` conserva los filtros al recargar y permite compartir la vista.

- `useSearchParams()` lee la URL.
- `history.replaceState()` actualiza los parámetros.
- Un efecto pide a la API la lista filtrada.
- El componente está dentro de `Suspense` para la lectura de esos parámetros.

La carga se deduce comparando la clave del resultado guardado con la petición actual. **Reintentar** cambia esa clave y vuelve a pedir los datos.

## ✏️ Reflejar los cambios

Al editar una tarifa, la API devuelve el proveedor actualizado. La pantalla sustituye esa fila en la tabla.

Si un proveedor nuevo no encaja con los filtros activos, la interfaz explica por qué no aparece.

## 🇪🇸 Lo que ve la persona

Los diccionarios convierten `Spain` en «España» y `suspended` en «Suspendido». También se traducen los errores de validación.

Las tarifas usan `Intl.NumberFormat` para moneda y separadores. Las fechas de renovación se formatean en UTC para evitar cambios de día por la zona horaria.

La tabla tiene desplazamiento horizontal propio. Su contenedor usa `relative` para mantener dentro el texto accesible de la cabecera de acciones.

📍 [Router](services/api/routes/suppliers.py) · [Directorio](uis/application/app/suppliers/_components/suppliers-directory.tsx) · [Etiquetas](uis/application/types/supplier.ts).

🏠 [Volver al índice](APRENDIENDO.md)
