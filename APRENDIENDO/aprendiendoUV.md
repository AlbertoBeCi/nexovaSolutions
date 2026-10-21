# 🛠️ Preparar el entorno y arrancar el proyecto

**Idea principal:** cada app tiene sus dependencias y se ejecuta desde su propia carpeta.

## 🐍 Python con uv

| Archivo o comando | Para qué sirve |
| --- | --- |
| `pyproject.toml` | Declara dependencias y comandos. |
| `uv.lock` | Registra las versiones resueltas. |
| `uv sync` | Crea el entorno virtual e instala dependencias. |
| `uv run ...` | Ejecuta un comando dentro del entorno. |

`requirements.txt` se conserva para quienes usan pip.

## 🚀 API: terminal 1

```bash
cd services/api
uv sync
uv run uvicorn main:app --reload --port 8000
```

Swagger está en `http://localhost:8000/docs`. Inicia sesión en `/auth/login` y usa el token en **Authorize** para llamar a las rutas protegidas.

## 🖥️ Frontend: terminal 2

Para operaciones:

```bash
cd uis/application
npm install
npm run dev
```

Abre `http://localhost:3001/suppliers`.

Para el backoffice, ejecuta los mismos comandos desde `uis/backoffice`. El analizador está en `http://localhost:3000/incidencias`.

## 🌱 Datos iniciales

Desde `services/api`, `uv run seed` carga proveedores y `uv run seed-users` crea el administrador configurado. Para inventario, consulta las condiciones de [su guía ORM](aprendiendoORM.md).

> 🔒 La configuración real vive en `.env`, ignorado por Git. Usa `.env.example` como referencia. Las guías nunca deben contener claves ni contraseñas.

📍 [Proyecto Python](services/api/pyproject.toml) · [README de la API](services/api/README.es.md).

🏠 [Volver al índice](APRENDIENDO.md)
