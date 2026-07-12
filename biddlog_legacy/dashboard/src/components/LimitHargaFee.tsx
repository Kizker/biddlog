import React, { useEffect, useState } from 'react';

export default function LimitHargaFee() {
  const [limits, setLimits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ id: '', model: '', grade: 'aa', limit_price: 0, fee_amount: 0 });
  const [customFee, setCustomFee] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
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
      const finalFee = isCustom ? parseFloat(customFee) : formData.fee_amount;
      const payload = { ...formData, fee_amount: finalFee };
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch('http://biddlog.test/api/limits.php', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.status === 'success') {
        fetchLimits();
        setFormData({ id: '', model: '', grade: 'aa', limit_price: 0, fee_amount: 0 });
        setCustomFee('');
        setIsCustom(false);
        setIsEditing(false);
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

  const handleEdit = (limit: any) => {
    setFormData({ id: limit.id, model: limit.model, grade: limit.grade, limit_price: limit.limit_price, fee_amount: limit.fee_amount });
    const parsedFee = parseFloat(limit.fee_amount);
    const isStandardFee = feeOptions.includes(parsedFee);
    setIsCustom(!isStandardFee);
    setCustomFee(isStandardFee ? '' : parsedFee.toString());
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setFormData({ id: '', model: '', grade: 'aa', limit_price: 0, fee_amount: 0 });
    setIsCustom(false);
    setCustomFee('');
  };

  const getModelSortScore = (modelStr: string) => {
    const m = modelStr.toLowerCase().trim();
    const nums = [...m.matchAll(/\d+/g)].map(n => parseInt(n[0], 10));
    let gen = 0;
    let storage = 0;
    
    if (nums.length > 0) {
      gen = nums[0];
      const storageMatch = m.match(/\b(64|128|256|512|1024)\b/);
      if (storageMatch) {
        storage = parseInt(storageMatch[0], 10);
      } else if (nums.length > 1) {
        storage = nums[nums.length - 1];
      }
    }
    
    let familyRank = 99;
    let variantRank = 99;

    if (m.startsWith('fold')) {
      familyRank = 1;
    } else if (m.startsWith('flip')) {
      familyRank = 2;
    } else if (m.startsWith('s') && !m.startsWith('samsung') && !m.startsWith('sony')) {
      familyRank = 3;
      if (m.includes('u') || m.includes('ultra')) variantRank = 1;
      else if (m.includes('+') || m.includes('plus')) variantRank = 2;
      else if (m.includes('edge')) variantRank = 3;
      else if (m.includes('fe')) variantRank = 5;
      else variantRank = 4;
    } else if (m.startsWith('note')) {
      familyRank = 4;
      if (m.includes('u') || m.includes('ultra')) variantRank = 1;
      else if (m.includes('+') || m.includes('plus')) variantRank = 2;
      else if (m.includes('lite')) variantRank = 4;
      else variantRank = 3;
    } else if (m.startsWith('a') && /\d/.test(m[1] || '')) {
      familyRank = 5;
      if (m.includes('s')) variantRank = 1;
      else variantRank = 2;
      if (!m.includes('5g')) variantRank += 0.5;
    }

    return { familyRank, gen, variantRank, storage };
  };

  const filteredLimits = limits
    .filter(l =>
      l.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.grade.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const scoreA = getModelSortScore(a.model);
      const scoreB = getModelSortScore(b.model);
      
      if (scoreA.familyRank !== scoreB.familyRank) return scoreA.familyRank - scoreB.familyRank;
      if (scoreA.gen !== scoreB.gen) return scoreB.gen - scoreA.gen;
      if (scoreA.variantRank !== scoreB.variantRank) return scoreA.variantRank - scoreB.variantRank;
      if (scoreA.storage !== scoreB.storage) return scoreB.storage - scoreA.storage;
      
      return a.grade.localeCompare(b.grade);
    });

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1.5px solid #e2e8f0',
    fontSize: '13px',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    outline: 'none',
    background: '#fff',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    marginBottom: '6px',
    color: '#475569',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
      }}>
        <div>
          <h3 style={{ margin: 0, color: 'var(--navy)', fontSize: '19px' }}>Limit Harga & Fee Barang</h3>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '13px' }}>Kelola master data harga limit dan fee per model/grade</p>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: '#f1f5f9',
          padding: '6px 14px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--navy)',
        }}>
          <span>{limits.length}</span>
          <span style={{ color: '#94a3b8' }}>aturan terdaftar</span>
        </div>
      </div>

      {/* Main content */}
      <div className="limit-harga-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) 1fr', gap: '24px', alignItems: 'flex-start' }}>

        {/* Form Card */}
        <div style={{
          padding: '24px',
          background: isEditing
            ? 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)'
            : 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          borderRadius: '12px',
          border: isEditing ? '1px solid #fde68a' : '1px solid #e2e8f0',
          transition: 'all 0.3s',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: isEditing ? '#f59e0b' : 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '15px', flexShrink: 0, transition: 'background 0.3s',
            }}>
              {isEditing ? '✏️' : '➕'}
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '14px', color: isEditing ? '#92400e' : 'var(--navy)' }}>
                {isEditing ? 'Edit Aturan' : 'Tambah Aturan Baru'}
              </h4>
              <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>
                {isEditing ? 'Perbarui limit dan fee item' : 'Tentukan limit dan fee per item'}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Model HP</label>
              <input
                type="text"
                placeholder="Contoh: iPhone 13 Pro"
                value={formData.model}
                onChange={e => setFormData({ ...formData, model: e.target.value })}
                required
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Grade</label>
                <select
                  value={formData.grade}
                  onChange={e => setFormData({ ...formData, grade: e.target.value })}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  {['aa', 'ab', 'ac', 'ad', 'ae', 'af', 'ag', 'ah', 'ai', 'aj', 'a'].map(g => (
                    <option key={g} value={g}>{g.toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Harga Limit (Rp)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={formData.limit_price || ''}
                  onChange={e => setFormData({ ...formData, limit_price: parseFloat(e.target.value) || 0 })}
                  required
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Fee / Gaji (Ribuan Rp)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                {feeOptions.map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => { setFormData({ ...formData, fee_amount: opt }); setIsCustom(false); setCustomFee(''); }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: formData.fee_amount === opt && !isCustom ? '2px solid var(--navy)' : '1.5px solid #e2e8f0',
                      background: formData.fee_amount === opt && !isCustom ? 'var(--navy)' : '#fff',
                      color: formData.fee_amount === opt && !isCustom ? '#fff' : '#475569',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {opt}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => { setIsCustom(true); setFormData({ ...formData, fee_amount: 0 }); }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: isCustom ? '2px solid var(--navy)' : '1.5px dashed #cbd5e1',
                    background: isCustom ? 'var(--navy)' : '#fff',
                    color: isCustom ? '#fff' : '#94a3b8',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  Lainnya...
                </button>
              </div>
              {isCustom && (
                <input
                  type="number"
                  placeholder="Ketik nominal fee manual..."
                  value={customFee}
                  onChange={e => setCustomFee(e.target.value)}
                  required
                  style={inputStyle}
                  autoFocus
                  onFocus={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
                />
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button
                type="submit"
                style={{
                  flex: 1,
                  padding: '12px',
                  background: isEditing ? '#f59e0b' : 'var(--navy)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'opacity 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                {isEditing ? 'Simpan Perubahan' : 'Tambah Aturan'}
              </button>
              {isEditing && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  style={{
                    padding: '12px 20px',
                    background: '#fff',
                    color: '#64748b',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                >
                  Batal
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Table Card */}
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}>
          {/* Search bar */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ position: 'relative' }}>
              <svg style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
              <input
                type="text"
                placeholder="Cari model atau grade..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ ...inputStyle, paddingLeft: '36px' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Memuat data...</div>
          ) : (
            <div style={{ overflowX: 'hidden', width: '100%' }}>
              <table style={{ width: '100%', minWidth: 0, borderCollapse: 'collapse', fontSize: '12px', tableLayout: 'fixed' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '10px 10px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', width: '35%' }}>Model</th>
                    <th style={{ padding: '10px 6px', textAlign: 'center', fontWeight: 600, color: '#64748b', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', width: '15%' }}>Grade</th>
                    <th style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 600, color: '#64748b', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', width: '20%' }}>Limit Harga</th>
                    <th style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 600, color: '#64748b', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', width: '15%' }}>Fee</th>
                    <th style={{ padding: '10px 6px', textAlign: 'center', fontWeight: 600, color: '#64748b', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', width: '15%' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLimits.map((l) => (
                    <tr key={l.id} style={{ borderTop: '1px solid #f1f5f9', transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '10px 10px', fontWeight: 600, color: 'var(--navy)', wordBreak: 'break-word' }}>{l.model}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                        <span style={{
                          background: '#e0f2fe',
                          color: '#0369a1',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '10px',
                          fontWeight: 700,
                        }}>
                          {l.grade.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 500, whiteSpace: 'nowrap' }}>Rp {parseFloat(l.limit_price).toLocaleString('id-ID')}</td>
                      <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: '#10b981', whiteSpace: 'nowrap' }}>Rp {parseFloat(l.fee_amount).toLocaleString('id-ID')}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                          <button
                            onClick={() => handleEdit(l)}
                            style={{
                              width: '32px', height: '32px',
                              borderRadius: '8px',
                              border: 'none',
                              background: '#eff6ff',
                              color: '#3b82f6',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '13px',
                              transition: 'background 0.15s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#dbeafe')}
                            onMouseLeave={e => (e.currentTarget.style.background = '#eff6ff')}
                            title="Edit aturan"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDelete(l.id)}
                            style={{
                              width: '32px', height: '32px',
                              borderRadius: '8px',
                              border: 'none',
                              background: '#fef2f2',
                              color: '#ef4444',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '13px',
                              transition: 'background 0.15s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#fee2e2')}
                            onMouseLeave={e => (e.currentTarget.style.background = '#fef2f2')}
                            title="Hapus aturan"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredLimits.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                        <div style={{ fontSize: '31px', marginBottom: '8px' }}>📋</div>
                        {searchQuery ? 'Tidak ada hasil yang cocok.' : 'Belum ada aturan yang dibuat.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Responsive overrides */}
      <style>{`
        @media (max-width: 768px) {
          .limit-harga-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
