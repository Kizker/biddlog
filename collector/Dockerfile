FROM python:3.10-slim

# Install ADB (Android Debug Bridge) client
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        android-tools-adb \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/collector

# Install Python dependencies
COPY requirements.txt requirements-server.txt ./
RUN pip install --no-cache-dir -r requirements.txt -r requirements-server.txt

# Copy collector scripts
COPY appium_collector.py invoice_collector.py check_setup.py config.json config.example.json ./

# Copy scan API
COPY scan_api.py ./

# Create output directories
RUN mkdir -p output/scan-list output/invoice

# Expose API port
EXPOSE 5000

# Default: start the scan API server
CMD ["python", "scan_api.py"]
