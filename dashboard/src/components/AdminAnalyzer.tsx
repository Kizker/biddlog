import React, { useState } from 'react';
import { parseTextList } from '../main';

export default function AdminAnalyzer() {
  const [rawText, setRawText] = useState('');
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showAIAJ, setShowAIAJ] = useState(false);

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

      const res = await fetch('http://biddlog.test/api/items.php', {
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
          <h3 style={{ marginBottom: '16px', color: 'var(--navy)', fontSize: '16px' }}>Analyzer (Scan List Barang)</h3>
          <p style={{ marginBottom: '12px', fontSize: '13px', color: 'var(--muted)' }}>Paste teks raw dari grup bidding di sini.</p>
          <textarea 
            style={{ width: '100%', height: '300px', padding: '12px', borderRadius: '6px', border: '1px solid var(--line)', fontFamily: 'monospace', fontSize: '13px', resize: 'vertical' }} 
            placeholder={`1.Mubdi : menik/mubdi/aldi\nfold 7 1024 ag (1) @18750\nfold 6 512 ad (1) @12950`}
            value={rawText}
            onChange={e => setRawText(e.target.value)}
          ></textarea>
          <div style={{ marginTop: '16px' }}>
            <button onClick={handleParse} className="btn-admin" style={{ width: '100%', padding: '12px', background: 'var(--blue)', color: 'white', borderRadius: '6px', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>
              Scan & Parse Data
            </button>
          </div>
          {message && (
            <div style={{ marginTop: '12px', fontSize: '13px', padding: '10px', background: message.includes('Berhasil') ? '#dcfce7' : '#fee2e2', color: message.includes('Berhasil') ? '#166534' : '#991b1b', borderRadius: '6px', fontWeight: 500 }}>
              {message}
            </div>
          )}
        </section>
      </aside>

      <section className="panel table-panel">
        <div className="filters" style={{ justifyContent: 'space-between' }}>
          <div>
            <strong>Hasil Scan: </strong>
            <span style={{ color: 'var(--muted)', fontSize: '14px' }}>
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
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '12px' }}>
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
