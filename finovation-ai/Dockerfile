FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

# LightGBM's Linux wheel expects the OpenMP runtime, even though the frozen API
# serves the packaged forecast artifacts rather than retraining models.
RUN apt-get update \
    && apt-get install --yes --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml uv.lock ./
RUN pip install --no-cache-dir uv \
    && uv sync --frozen --no-dev

COPY api ./api
COPY src ./src
COPY artifacts ./artifacts
COPY configs ./configs
COPY data ./data
COPY examples ./examples

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=6 \
    CMD python -c "from urllib.request import urlopen; urlopen('http://127.0.0.1:8000/health/ready', timeout=3)"

CMD ["python", "-m", "uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
