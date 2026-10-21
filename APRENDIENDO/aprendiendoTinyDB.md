# 🗃️ Guardar datos con TinyDB

**Idea principal:** TinyDB guarda registros en un archivo JSON, sin un servidor de base de datos aparte.

## 📂 Qué guarda Nexova

| Datos | Archivo por defecto |
| --- | --- |
| Proveedores | `services/api/data/suppliers.json` |
| Usuarios y perfiles | `services/api/data/users.json` |

Se pueden cambiar con `SUPPLIERS_DB_PATH` y `USERS_DB_PATH`. La carpeta de datos está ignorada por Git.

## 🔢 Identificar y buscar

Cada registro recibe un **`doc_id`** entero: 1, 2, 3… Es el ID usado en las rutas existentes.

```python
where("country") == "Spain"
```

Esta consulta selecciona proveedores de España. Varias condiciones se combinan con `&`, que significa **Y**.

Los usuarios también tienen un **UUID estable** para identificar al autor de las órdenes de inventario. Conservan su ID entero para los perfiles y las rutas anteriores.

## 🔐 El candado: `Lock`

FastAPI puede atender peticiones en varios hilos. Un `Lock` permite que el acceso protegido al JSON se haga de uno en uno.

Este candado pertenece a un proceso. No coordina varios workers o servidores; ese despliegue necesita una persistencia que soporte esos accesos.

## 🌱 Datos iniciales

`uv run seed` carga los proveedores de `fixtures/suppliers.json` después de validarlos. Es **idempotente**: omite los existentes para evitar duplicados.

`uv run seed-users` crea el primer administrador con la configuración local.

> 💾 Antes de una prueba destructiva, actualiza el backup o créalo y verifica que pueda restaurarse. `data/` incluye usuarios: borrarla para reiniciar proveedores también eliminaría esas cuentas.

📍 [Base de proveedores](services/api/database.py) · [Base de usuarios](services/api/users_db.py) · [Seed](services/api/seed.py).

🏠 [Volver al índice](APRENDIENDO.md)
