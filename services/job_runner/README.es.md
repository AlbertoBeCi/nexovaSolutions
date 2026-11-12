# `services/job_runner`

Módulo de control de estado para tareas en segundo plano del monorepo Nexova (tabla `job_runs`).

## Propósito

Implementa la máquina de estados canónica para tareas de orquestación nocturna (`nightly_export`):

```
pending -> processing -> completed
                     \-> failed
```

- **Independiente de FastAPI**: no importa ni ejecuta el servidor HTTP de la API.
- **Distributed lock vía `processing`**: `has_processing_lock(job_name)` comprueba si ya existe una ejecución en estado `processing`. No utiliza tablas ni columnas de bloqueo adicionales.
- **Idempotencia diaria vía `target_date`**: `has_completed_for_date(job_name, target_date)` verifica si ya existe un registro `completed` para `(job_name, target_date)`.
- **Sin registros zombi**: `mark_job_failed(job_id, error_message)` asegura la transición a `failed` guardando el mensaje de la excepción.

## Funciones principales

- `init_job_runs_db(engine)` — crea la tabla `job_runs` y sus índices (`(job_name, target_date)` y `(job_name, status)`).
- `has_processing_lock(job_name="nightly_export", db=...) -> bool`
- `has_completed_for_date(job_name, target_date, db=...) -> bool`
- `create_job_run(job_name, target_date, status="pending", db=...) -> dict`
- `mark_job_processing(job_id, db=...) -> dict`
- `mark_job_completed(job_id, db=...) -> dict`
- `mark_job_failed(job_id, error_message, db=...) -> dict`
- `get_job_run(job_id, db=...) -> dict | None`
- `list_job_runs(job_name=None, target_date=None, status=None, db=...) -> list[dict]`

> _Versión en inglés: [README.md](./README.md)._
