import sys
import re

path = r'c:\laragon\www\biddlog\dashboard\src\main.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Modify ScannerPanel Terminal Log height
# <div className="panel" style={{ flex: '1', padding: '0', display: 'flex', flexDirection: 'column', background: '#1e1e2e', color: '#a6accd', overflow: 'hidden' }}>
old_terminal = "<div className=\"panel\" style={{ flex: '1', padding: '0', display: 'flex', flexDirection: 'column', background: '#1e1e2e', color: '#a6accd', overflow: 'hidden' }}>"
new_terminal = "<div className=\"panel\" style={{ flex: '1', maxHeight: '400px', padding: '0', display: 'flex', flexDirection: 'column', background: '#1e1e2e', color: '#a6accd', overflow: 'hidden' }}>"
content = content.replace(old_terminal, new_terminal)

# 2. Modify App: add useEffect and _autoLoadLocalData
old_app_start = '''function App() {
  const [activeView, setActiveView] = useState<ActiveView>('analyzer');'''

new_app_start = '''function App() {
  const [activeView, setActiveView] = useState<ActiveView>('analyzer');

  useEffect(() => {
    loadFromServer('scan-list/bidding-items.json', 'bidding-items.json (Otomatis)');
    (window as any)._autoLoadLocalData = () => loadFromServer('scan-list/bidding-items.json', 'bidding-items.json (Otomatis)');
  }, []);'''
content = content.replace(old_app_start, new_app_start)

# 3. Modify ResultChecker: add useEffect and _autoLoadInvoiceData
old_checker_start = '''function ResultChecker() {
  const [invoiceRaw, setInvoiceRaw] = useState<string>('');'''

new_checker_start = '''function ResultChecker() {
  const [invoiceRaw, setInvoiceRaw] = useState<string>('');

  useEffect(() => {
    loadInvoiceFromServer();
    (window as any)._autoLoadInvoiceData = () => loadInvoiceFromServer();
  }, []);'''
content = content.replace(old_checker_start, new_checker_start)

# 4. Modify startScanPolling in App to call both
old_poll = '''        setTimeout(() => {
          if ((window as any)._autoLoadLocalData) {
            (window as any)._autoLoadLocalData();
          }
        }, 1000);'''
new_poll = '''        setTimeout(() => {
          if ((window as any)._autoLoadLocalData) {
            (window as any)._autoLoadLocalData();
          }
          if ((window as any)._autoLoadInvoiceData) {
            (window as any)._autoLoadInvoiceData();
          }
        }, 1000);'''
content = content.replace(old_poll, new_poll)

# 5. Remove the upload field in App
app_upload_regex = r'<section className="upload-field" aria-labelledby="collector-json-label">.*?</section>'
content = re.sub(app_upload_regex, '', content, flags=re.DOTALL)

# 6. Remove the upload field in ResultChecker
# The ResultChecker one has aria-labelledby="invoice-json-label" or similar.
# Let's just find <section className="upload-field" ...> inside ResultChecker.
checker_upload_regex = r'<section className="upload-field" aria-labelledby="invoice-json-label">.*?</section>'
content = re.sub(checker_upload_regex, '', content, flags=re.DOTALL)

# Let's also remove `id="invoice-json-label"` if it's there.
checker_upload_regex2 = r'<section className="upload-field">.*?</section>'
# Since we might match the wrong one, we just use string replace.
# ResultChecker upload section:
# <section className="upload-field">
#   <span className="upload-title">
#     Upload JSON Invoice (Riwayat)
#   </span>...
# </section>
def remove_result_checker_upload(text):
    start = text.find('<span className="upload-title">\n                Upload JSON Invoice (Riwayat)\n              </span>')
    if start != -1:
        # trace back to <section className="upload-field">
        sec_start = text.rfind('<section className="upload-field">', 0, start)
        if sec_start != -1:
            sec_end = text.find('</section>', sec_start)
            if sec_end != -1:
                return text[:sec_start] + text[sec_end+len('</section>'):]
    return text
content = remove_result_checker_upload(content)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Main.tsx updated")
