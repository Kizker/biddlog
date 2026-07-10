import sys

path = r'c:\laragon\www\biddlog\dashboard\src\main.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old_code = '''  function startScanPolling() {
    if (scanPollRef.current) clearInterval(scanPollRef.current);
    setScanPolling(true);
    scanPollRef.current = setInterval(async () => {
      const status = await fetchScanStatus();
      if (status && status.status !== 'running') {
        stopScanPolling();
      }
    }, 2000);
  }'''

new_code = '''  function startScanPolling() {
    if (scanPollRef.current) clearInterval(scanPollRef.current);
    setScanPolling(true);
    scanPollRef.current = setInterval(async () => {
      const status = await fetchScanStatus();
      if (status && status.status !== 'running') {
        stopScanPolling();
        // Auto-refresh when scan finishes!
        setTimeout(() => {
          if ((window as any)._autoLoadLocalData) {
            (window as any)._autoLoadLocalData();
          }
        }, 1000);
      }
    }, 2000);
  }'''

content = content.replace(old_code, new_code)
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
