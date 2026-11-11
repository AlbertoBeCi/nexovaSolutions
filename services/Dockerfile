FROM python:3.14.8-slim

WORKDIR /workspace/services/api

RUN pip install --no-cache-dir "uv==0.12.22"

COPY api/requirements.txt ./requirements.txt
RUN uv venv /opt/venv \
    && uv pip install --python /opt/venv/bin/python -r requirements.txt

COPY api/ ./
COPY telemetry/ /workspace/services/telemetry/
COPY --from=monorepo services/reporting/ /workspace/services/reporting/
COPY --from=monorepo data/pipelines/pipeline.py /workspace/data/pipelines/pipeline.py
COPY --from=monorepo data/pipelines/__init__.py /workspace/data/pipelines/__init__.py
COPY --from=monorepo data/process/business_performance.py /workspace/data/process/business_performance.py
COPY --from=monorepo data/process/__init__.py /workspace/data/process/__init__.py
COPY --from=monorepo shared/incidents_analysis.py /workspace/shared/incidents_analysis.py
COPY --from=monorepo packages/shared/nexova_shared /workspace/packages/shared/nexova_shared

EXPOSE 8000

CMD ["uv", "run", "--no-sync", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
