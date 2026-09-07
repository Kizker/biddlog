import React, { useEffect, useState } from 'react';
import { parseTextList } from '../main';

export default function AdminAnalyzer() {
  const [rawText, setRawText] = useState(() => {
    try {
      return localStorage.getItem('biddlog_admin_analyzer_raw_text') || '';
    } catch {
      return '';
    }
  });
  const [parsedData, setParsedData] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('biddlog_admin_analyzer_parsed');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showAIAJ, setShowAIAJ] = useState(false);

  useEffect(() => {
    try {
      if (rawText) {
        localStorage.setItem('biddlog_admin_analyzer_raw_text', rawText);
      } else {
        localStorage.removeItem('biddlog_admin_analyzer_raw_text');
      }
    } catch (e) {}
  }, [rawText]);

  useEffect(() => {
    try {
      localStorage.setItem('biddlog_admin_analyzer_parsed', JSON.stringify(parsedData));
    } catch (e) {}
  }, [parsedData]);

  const handleResetInputs = () => {
    if (!rawText && parsedData.length === 0) return;
    if (!window.confirm('Kosongkan input teks dan hasil scan?')) return;
    setRawText('');
    setParsedData([]);
    setMessage('');
    try {
      localStorage.removeItem('biddlog_admin_analyzer_raw_text');
      localStorage.removeItem('biddlog_admin_analyzer_parsed');
    } catch (e) {}
  };

  const handleParse = () => {
    if (!rawText.trim()) return;
    const result = parseTextList(rawText, 'target');
    setParsedData(result.entries);
    setMessage(`Berhasil mem-parsing ${result.entries.length} baris data.`);
    setShowAIAJ(false); // reset toggle
  };

  const regularItems = parsedData.filter(item => !['ai', 'aj'].includes(item.grade?.toLowerCase()));
  const aiAjItems = parsedData.filter(item => ['ai', 'aj'].includes(item.grade?.toLowerCase()));
  
  const itemsToProcess = showAIAJ ? parsedData : regularItems;

  const handleUploadToBagian = async () => {
    if (itemsToProcess.length === 0) return;
    setIsSaving(true);
    setMessage('Menyimpan ke database...');
    
    try {
      const payload = {
        action: 'bulk_insert',
        items: itemsToProcess.map(entry => ({
          raw_line: entry.rawLine,
          brand: '', // To be enhanced by proper brand parser
          model: entry.model,
          storage: entry.storage,
          grade: entry.grade,
          unit: entry.unit || 1,
          price: entry.priceMax,
          person: entry.person
        }))
      };

      const res = await fetch('/api/items.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (data.status === 'success') {
        setMessage(`Berhasil! ${data.message} (${itemsToProcess.length} item)`);
        setRawText('');
        setParsedData([]);
      } else {
        setMessage(`Gagal: ${data.message}`);
      }
    } catch (err: any) {
      setMessage(`Error jaringan: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="workspace">
      <aside className="panel input-panel">
        <section className="json-input-section" style={{ padding: '16px', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, color: 'var(--navy)', fontSize: '15px' }}>Analyzer (Scan List Barang)</h3>
            {(rawText || parsedData.length > 0) && (
              <button
                type="button"
                onClick={handleResetInputs}
                style={{
                  padding: '4px 8px',
                  background: '#fee2e2',
                  color: '#dc2626',
                  border: '1px solid #fecaca',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
              >
                🗑️ Reset
              </button>
            )}
          </div>
          <p style={{ marginBottom: '12px', fontSize: '12px', color: 'var(--muted)' }}>Paste teks raw dari grup bidding di sini.</p>
          <textarea 
            style={{ width: '100%', height: '300px', padding: '12px', borderRadius: '6px', border: '1px solid var(--line)', fontFamily: 'monospace', fontSize: '12px', resize: 'vertical' }} 
            placeholder={`1.Mubdi : menik/mubdi/aldi\nfold 7 1024 ag (1) @18750\nfold 6 512 ad (1) @12950`}
            value={rawText}
            onChange={e => setRawText(e.target.value)}
          ></textarea>
          <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
            <button onClick={handleParse} className="btn-admin" style={{ flex: 1, padding: '12px', background: 'var(--blue)', color: 'white', borderRadius: '6px', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>
              Scan & Parse Data
            </button>
            {(rawText || parsedData.length > 0) && (
              <button onClick={handleResetInputs} className="secondary-button" style={{ padding: '12px 16px', color: '#dc2626', borderColor: '#fca5a5' }}>
                Reset
              </button>
            )}
          </div>
          {message && (
            <div style={{ marginTop: '12px', fontSize: '12px', padding: '10px', background: message.includes('Berhasil') ? '#dcfce7' : '#fee2e2', color: message.includes('Berhasil') ? '#166534' : '#991b1b', borderRadius: '6px', fontWeight: 500 }}>
              {message}
            </div>
          )}
        </section>
      </aside>

      <section className="panel table-panel">
        <div className="filters" style={{ justifyContent: 'space-between' }}>
          <div>
            <strong>Hasil Scan: </strong>
            <span style={{ color: 'var(--muted)', fontSize: '13px' }}>
              {itemsToProcess.length} item siap diupload {aiAjItems.length > 0 && !showAIAJ ? `(${aiAjItems.length} item AI/AJ disembunyikan)` : ''}
            </span>
          </div>
          <div className="filter-actions">
            {parsedData.length > 0 && (
              <button 
                onClick={handleUploadToBagian} 
                disabled={isSaving} 
                style={{ padding: '8px 16px', background: 'var(--navy)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: isSaving ? 'not-allowed' : 'pointer' }}
              >
                {isSaving ? 'Menyimpan...' : 'Upload ke Bagian'}
              </button>
            )}
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>No</th>
                <th>Target (Anggota)</th>
                <th>Model</th>
                <th>Storage</th>
                <th>Grade</th>
                <th>Limit (Rp)</th>
              </tr>
            </thead>
            <tbody>
              {itemsToProcess.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
                    Belum ada data hasil scan.
                  </td>
                </tr>
              ) : (
                itemsToProcess.map((item, idx) => (
                  <tr key={idx}>
                    <td>{idx + 1}</td>
                    <td><strong>{item.person}</strong></td>
                    <td>{item.model}</td>
                    <td>{item.storage || '-'}</td>
                    <td>{item.grade?.toUpperCase() || '-'}</td>
                    <td>{item.priceMax ? item.priceMax.toLocaleString('id-ID') : '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {aiAjItems.length > 0 && (
          <div style={{ padding: '16px', background: '#f8fafc', borderTop: '1px solid var(--line)', textAlign: 'center' }}>
            <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '12px' }}>
              Terdapat <strong>{aiAjItems.length}</strong> barang dengan grade AI / AJ.
            </p>
            <button 
              onClick={() => setShowAIAJ(!showAIAJ)}
              style={{ padding: '8px 16px', background: showAIAJ ? 'var(--red)' : 'var(--blue)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              {showAIAJ ? 'Sembunyikan AI & AJ' : 'Tampilkan AI & AJ'}
            </button>
          </div>
        )}
      </section>
    </section>
  );
}
