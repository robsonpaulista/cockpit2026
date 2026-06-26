FROM python:3.11-slim-bookworm

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
  && rm -rf /var/lib/apt/lists/*

COPY requirements-cockpit.txt .
RUN pip install --no-cache-dir -r requirements-cockpit.txt

COPY src ./src
COPY server.py .

ENV RECFACE_HOST=0.0.0.0
ENV RECFACE_PORT=8502

EXPOSE 8502

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8502/health')"

CMD ["python", "-m", "uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8502"]
