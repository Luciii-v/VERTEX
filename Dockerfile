FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
      tesseract-ocr docker.io && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY tools/ tools/
EXPOSE 8000
CMD ["uvicorn", "tools.http_api:app", "--host", "0.0.0.0", "--port", "8000"]
