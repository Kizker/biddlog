import sys
import re

path = r'c:\laragon\www\biddlog\dashboard\src\main.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

app_bad_injection = '''
  async function loadInvoiceFromServer() {
    try {
      const response = await fetch('/api/data/invoice/invoice-items.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      setRawJson(text); // Assuming this updates the relevant state
    } catch (err) {
      console.error('Gagal memuat invoice dari server:', err);
    }
  }

  useEffect(() => {
    loadFromServer('scan-list/bidding-items.json', 'bidding-items.json (Otomatis)');
    loadInvoiceFromServer();
    (window as any)._autoLoadLocalData = () => loadFromServer('scan-list/bidding-items.json', 'bidding-items.json (Otomatis)');
    (window as any)._autoLoadInvoiceData = () => loadInvoiceFromServer();
  }, []);'''

app_correct = '''
  useEffect(() => {
    loadFromServer('scan-list/bidding-items.json', 'bidding-items.json (Otomatis)');
    (window as any)._autoLoadLocalData = () => loadFromServer('scan-list/bidding-items.json', 'bidding-items.json (Otomatis)');
  }, []);'''
content = content.replace(app_bad_injection, app_correct)

checker_bad = '''function ResultChecker() {
  const [invoiceRaw, setInvoiceRaw] = useState<string>('');

  useEffect(() => {
    loadInvoiceFromServer();
    (window as any)._autoLoadInvoiceData = () => loadInvoiceFromServer();
  }, []);'''

checker_correct = '''function ResultChecker() {
  const [invoiceRaw, setInvoiceRaw] = useState<string>('');

  async function loadInvoiceFromServer() {
    try {
      const response = await fetch('/api/data/invoice/invoice-items.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      setInvoiceRaw(text);
      setInvoiceFileName('🌐 invoice-items.json (Otomatis)');
    } catch (err) {
      console.error('Gagal memuat invoice dari server:', err);
    }
  }

  useEffect(() => {
    loadInvoiceFromServer();
    (window as any)._autoLoadInvoiceData = () => loadInvoiceFromServer();
  }, []);'''
content = content.replace(checker_bad, checker_correct)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed main.tsx")
