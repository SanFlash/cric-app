FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# Render assigns the listen port dynamically via $PORT — a hardcoded port
# will fail to bind correctly. Shell form so $PORT expands at container
# start; :-8000 fallback keeps `docker run` working locally without it set.
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
