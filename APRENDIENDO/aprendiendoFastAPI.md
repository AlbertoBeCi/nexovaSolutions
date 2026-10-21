# 🌐 De un script a una API con FastAPI

**Idea principal:** una API permite que una pantalla u otro programa pidan trabajo al backend mediante HTTP.

## 🔄 Cómo viaja la información

    Pantalla → petición HTTP → FastAPI → lógica de negocio → respuesta JSON

Un **endpoint** combina un método y una ruta. `POST /api/incidents/analyze` significa «envía un CSV para analizarlo».

## 📂 El analizador de incidencias

| Endpoint | Qué hace |
| --- | --- |
| `POST /api/incidents/analyze` | Recibe un archivo y devuelve métricas en JSON. |
| `GET /api/incidents/results/export` | Descarga el último resumen como CSV. |

El archivo llega como `multipart/form-data`. Se calcula el mismo resumen que en el script de terminal.

El último resultado se guarda **en memoria**, protegido por un `Lock`. Se pierde al reiniciar y no se comparte entre varios procesos.

## 🧱 Cómo se organiza

- **`main.py`** crea la aplicación y conecta los routers.
- **`APIRouter`** agrupa las rutas de un dominio: incidencias, proveedores o inventario.
- **`Depends()`** entrega dependencias como el usuario o la sesión de base de datos.
- **Pydantic** valida los datos. [Ver su guía](aprendiendoPydantic.md).

Las rutas de estos dominios requieren un JWT obtenido en `/auth/login`, enviado como `Authorization: Bearer <token>`.

## 🚦 Respuestas habituales

| Código | Cómo leerlo |
| --- | --- |
| `200` / `201` | Operación correcta / registro creado. |
| `400` | La petición incumple una condición del negocio. |
| `401` | Falta autenticación o el token no es válido. |
| `404` | El recurso solicitado no existe. |
| `422` | Los datos no pasan la validación. |

Un error se comunica con una respuesta HTTP. No debe cerrar el servidor con `sys.exit()`.

## 🖥️ Navegador y CORS

Las pantallas usan los puertos 3000 y 3001; la API usa el 8000. **CORS** indica qué orígenes pueden llamarla desde un navegador. Se configuran con `CORS_ORIGINS`.

📍 [main.py](services/api/main.py) · [Router](services/api/routes/incidents.py) · Swagger local: `http://localhost:8000/docs`.

🏠 [Volver al índice](APRENDIENDO.md)
