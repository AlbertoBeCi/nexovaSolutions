FROM python:3.14.8-slim

WORKDIR /workspace/services/api

RUN pip install --no-cache-dir "uv==0.12.22"

COPY api/requirements.txt ./requirements.txt
RUN uv venv /opt/venv \
    && uv pip install --python /opt/venv/bin/python -r requirements.txt

COPY api/ ./
COPY --from=monorepo shared/incidents_analysis.py /workspace/shared/incidents_analysis.py
COPY --from=monorepo packages/shared/nexova_shared /workspace/packages/shared/nexova_shared

EXPOSE 8000

CMD ["uv", "run", "--no-sync", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
