import re
import sys

def main():
    path = r'c:\laragon\www\biddlog\dashboard\src\main.tsx'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Change ActiveView type
    content = content.replace(
        "type ActiveView = 'analyzer' | 'guide' | 'checker';",
        "type ActiveView = 'analyzer' | 'scanner' | 'checker';"
    )

    # 2. Change the Tabs
    content = content.replace(
        "className={activeView === 'guide' ? 'active' : ''}\n              onClick={() => setActiveView('guide')}\n            >\n              Panduan Collector",
        "className={activeView === 'scanner' ? 'active' : ''}\n              onClick={() => setActiveView('scanner')}\n            >\n              Scanner"
    )

    # 3. Change rendering condition
    content = content.replace(
        "{activeView === 'guide' ? (\n          <CollectorGuide />\n        ) : activeView === 'checker' ?",
        "{activeView === 'scanner' ? (\n          <ScannerPanel />\n        ) : activeView === 'checker' ?"
    )

    # 4. Remove <CollectorGuide /> function
    # It starts around function CollectorGuide() and ends before function buildComparisonPreview
    content = re.sub(r'function CollectorGuide\(\).*?function buildComparisonPreview', 'function buildComparisonPreview', content, flags=re.DOTALL)

    # 5. Extract <section className="remote-scan-panel"> and move to a new component
    # We will just write a new ScannerPanel function instead of extracting perfectly.
    
    # We need to make ScannerPanel have access to startScan, stopScan, scanStatus, adbConnected, checkAdbStatus, fetchScanStatus
    # Wait, it's easier to just pass these as props or define ScannerPanel INSIDE App(), but defining components inside components is bad practice.
    # So we'll pass props to ScannerPanel.
    # Actually, we can just replace <section className="remote-scan-panel">...</section> inside App with nothing,
    # and put it inside ScannerPanel which we'll call as <ScannerPanel status={scanStatus} adb={adbConnected} onStart={startScan} onStop={stopScan} onCheckAdb={checkAdbStatus} onFetchStatus={fetchScanStatus} />

    # Let's remove remote-scan-panel from App:
    remote_scan_pattern = r'<section className="remote-scan-panel">.*?</section>\s*(<section className="sort-panel")'
    content = re.sub(remote_scan_pattern, r'\1', content, flags=re.DOTALL)

    # Now let's define ScannerPanel before App()
    scanner_panel_code = '''
function ScannerPanel({
  scanStatus,
  adbConnected,
  onStart,
  onStop,
  onCheckAdb,
  onFetchStatus
}: {
  scanStatus: ScanStatus;
  adbConnected: boolean | null;
  onStart: (type: string, account?: string, options?: any) => void;
  onStop: () => void;
  onCheckAdb: () => void;
  onFetchStatus: () => void;
}) {
  return (
    <section className="scanner-layout" style={{ display: 'flex', gap: '24px', padding: '24px', maxWidth: '1200px', margin: '0 auto', height: '100%', boxSizing: 'border-box' }}>
      <div className="panel" style={{ flex: '0 0 320px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <h2>📱 Scanner ADB</h2>
          <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '8px' }}>
            Pastikan HP terhubung via kabel USB dan USB Debugging aktif. Layar HP harus menyala.
          </p>
        </div>

        <div className="scan-status-bar" style={{ padding: '12px', background: 'var(--bg)', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span className={scan-dot scan-dot--} />
            <strong style={{ fontSize: '14px' }}>
              {scanStatus.status === 'idle' && 'Scanner Siap'}
              {scanStatus.status === 'running' && Scanning... ()}
              {scanStatus.status === 'done' && Selesai ()}
              {scanStatus.status === 'error' && Error}
            </strong>
          </div>
          {adbConnected !== null && (
            <span className={db-badge } style={{ display: 'inline-block' }}>
              {adbConnected ? '📱 ADB OK Terhubung' : '📱 ADB OFF / Terputus'}
            </span>
          )}
        </div>

        <div className="scan-actions" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {scanStatus.status === 'running' ? (
            <button type="button" className="scan-btn scan-btn--stop" onClick={onStop} style={{ padding: '12px' }}>
              ⏹ Stop Scan
            </button>
          ) : (
            <>
              <button
                type="button"
                className="scan-btn scan-btn--start"
                onClick={() => onStart('bidding', undefined, { phone_feedback: true })}
                style={{ padding: '12px', backgroundColor: 'var(--blue)', color: 'white' }}
              >
                ▶ Scan Bidding Reguler
              </button>
              <button
                type="button"
                className="scan-btn scan-btn--invoice"
                onClick={() => {
                  const account = prompt('Akun invoice (menik/mubdi/aldi):');
                  if (account && ['menik', 'mubdi', 'aldi'].includes(account.toLowerCase())) {
                    onStart('invoice', account.toLowerCase(), { phone_feedback: true });
                  }
                }}
                style={{ padding: '12px', backgroundColor: 'var(--green)', color: 'white' }}
              >
                📋 Scan Invoice/Riwayat
              </button>
            </>
          )}
          <button
            type="button"
            className="secondary-button"
            onClick={() => { onCheckAdb(); onFetchStatus(); }}
          >
            🔄 Refresh Status
          </button>
        </div>
        
        <div style={{ marginTop: 'auto', fontSize: '12px', color: 'var(--muted)', borderTop: '1px solid var(--line)', paddingTop: '16px' }}>
          <strong>Tips:</strong>
          <ul style={{ paddingLeft: '16px', marginTop: '8px' }}>
            <li>Data otomatis tersimpan ke lokal</li>
            <li>Tab Analyzer & Hasil Bidding akan otomatis diperbarui setelah scan selesai</li>
          </ul>
        </div>
      </div>

      <div className="panel" style={{ flex: '1', padding: '0', display: 'flex', flexDirection: 'column', background: '#1e1e2e', color: '#a6accd', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #303348', background: '#181825', fontWeight: 'bold', fontSize: '13px', color: '#cdd6f4' }}>
          Terminal Log
        </div>
        <div style={{ padding: '16px', overflowY: 'auto', flex: '1', fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
          {scanStatus.log_tail.length > 0 ? (
            scanStatus.log_tail.join('\\n')
          ) : (
            <span style={{ color: '#585b70' }}>Menunggu proses scan dimulai...</span>
          )}
        </div>
      </div>
    </section>
  );
}

function App() {'''

    content = content.replace('function App() {', scanner_panel_code)

    # 6. Change <ScannerPanel /> call inside App to pass props
    content = content.replace(
        '<ScannerPanel />',
        '<ScannerPanel scanStatus={scanStatus} adbConnected={adbConnected} onStart={startScan} onStop={stopScan} onCheckAdb={checkAdbStatus} onFetchStatus={fetchScanStatus} />'
    )

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    main()
