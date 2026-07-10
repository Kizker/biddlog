import React, { useEffect, useState } from 'react';

export default function LimitHargaFee() {
  const [limits, setLimits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ model: '', grade: 'aa', limit_price: 0, fee_amount: 0 });
  const [customFee, setCustomFee] = useState('');
  const feeOptions = [25, 50, 75, 100, 150, 200, 250, 300, 350, 400];

  const fetchLimits = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://biddlog.test/api/limits.php');
      const data = await res.json();
      if (data.status === 'success') {
        setLimits(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLimits();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Use custom fee if fee_amount is set to a specific value or custom input is filled
      const finalFee = customFee ? parseFloat(customFee) : formData.fee_amount;
      
      const payload = { ...formData, fee_amount: finalFee };
      
      const res = await fetch('http://biddlog.test/api/limits.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.status === 'success') {
        fetchLimits();
        setFormData({ model: '', grade: 'aa', limit_price: 0, fee_amount: 0 });
        setCustomFee('');
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus limit harga ini?')) return;
    try {
      await fetch(`http://biddlog.test/api/limits.php?id=${id}`, { method: 'DELETE' });
      fetchLimits();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ padding: '24px', background: 'white', borderRadius: '12px', border: '1px solid var(--line)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
      <h3 style={{ marginBottom: '24px', color: 'var(--navy)' }}>Master Data: Limit Harga & Fee</h3>
      
      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, padding: '20px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <h4 style={{ marginBottom: '16px' }}>Tambah Aturan Baru</h4>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>Model HP</label>
              <input 
                type="text" 
                placeholder="Contoh: iphone 13 pro"
                value={formData.model} 
                onChange={e => setFormData({...formData, model: e.target.value})} 
                required 
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--line)' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>Grade</label>
              <select 
                value={formData.grade} 
                onChange={e => setFormData({...formData, grade: e.target.value})} 
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--line)' }}
              >
                {['aa','ab','ac','ad','ae','af','ag','ah','ai','aj','a'].map(g => (
                  <option key={g} value={g}>{g.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>Harga Limit (Rp)</label>
              <input 
                type="number" 
                placeholder="0"
                value={formData.limit_price || ''} 
                onChange={e => setFormData({...formData, limit_price: parseFloat(e.target.value) || 0})} 
                required 
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--line)' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>Fee / Gaji (Ribuan Rp)</label>
              <select 
                value={customFee ? 'custom' : formData.fee_amount} 
                onChange={e => {
                  if (e.target.value === 'custom') {
                    setFormData({...formData, fee_amount: 0});
                  } else {
                    setFormData({...formData, fee_amount: parseFloat(e.target.value) || 0});
                    setCustomFee('');
                  }
                }} 
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--line)', marginBottom: '8px' }}
              >
                <option value="0">-- Pilih Nominal --</option>
                {feeOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
                <option value="custom">Isi Sendiri...</option>
              </select>
              {(formData.fee_amount === 0 && customFee !== '') || document.querySelector('select')?.value === 'custom' ? (
                <input 
                  type="number" 
                  placeholder="Ketik nominal fee manual..."
                  value={customFee} 
                  onChange={e => setCustomFee(e.target.value)} 
                  required 
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--line)' }} 
                />
              ) : null}
            </div>
            <button type="submit" className="btn-admin" style={{ marginTop: '8px' }}>Tambah Aturan</button>
          </form>
        </div>
        
        <div style={{ flex: 2 }}>
          {loading ? <p>Memuat...</p> : (
            <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead style={{ background: '#f8fafc', borderBottom: '1px solid var(--line)' }}>
                  <tr>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Model</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Grade</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Limit Harga</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Fee (Gaji)</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {limits.map((l, idx) => (
                    <tr key={l.id} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td style={{ padding: '12px', fontWeight: 600 }}>{l.model}</td>
                      <td style={{ padding: '12px' }}>{l.grade.toUpperCase()}</td>
                      <td style={{ padding: '12px' }}>Rp {parseFloat(l.limit_price).toLocaleString('id-ID')}</td>
                      <td style={{ padding: '12px', color: '#10b981', fontWeight: 'bold' }}>Rp {parseFloat(l.fee_amount).toLocaleString('id-ID')}</td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <button className="icon-button" onClick={() => handleDelete(l.id)} style={{ color: 'var(--red)' }}>🗑️</button>
                      </td>
                    </tr>
                  ))}
                  {limits.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Belum ada aturan yang dibuat.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
