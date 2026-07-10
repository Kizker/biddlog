import React, { useEffect, useState } from 'react';

export default function HasilBidding() {
  const [items, setItems] = useState<any[]>([]);
  const [obtained, setObtained] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resItems, resObtained] = await Promise.all([
        fetch('http://biddlog.test/api/items.php'),
        fetch('http://biddlog.test/api/obtained.php')
      ]);
      const dataItems = await resItems.json();
      const dataObtained = await resObtained.json();
      
      if (dataItems.status === 'success') setItems(dataItems.data);
      if (dataObtained.status === 'success') setObtained(dataObtained.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Simple reconciliation logic (just matching model/grade basically for preview)
  return (
    <div style={{ padding: '24px', background: 'white', borderRadius: '12px', border: '1px solid var(--line)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3 style={{ color: 'var(--navy)', margin: 0 }}>Rekonsiliasi Hasil Bidding</h3>
        <button onClick={fetchData} className="secondary-button">Refresh Data</button>
      </div>

      {loading ? (
        <p>Memuat rekonsiliasi...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <p style={{ color: '#64748b', fontSize: '14px' }}>Modul ini mencocokkan target (barang yang dibagikan) dengan list aktual yang didapatkan anggota. Jika selisih harga melebihi batas, Admin bisa memberikan validasi (ACC) di sini.</p>
          
          <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead style={{ background: '#f8fafc', borderBottom: '1px solid var(--line)' }}>
                <tr>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Anggota</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Barang (Target)</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Limit (Target)</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Harga (Dapat)</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Status Gaji</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {obtained.map(obt => {
                  // find target item that closely matches
                  const target = items.find(i => i.assigned_to === obt.user_id && i.model.toLowerCase() === obt.model.toLowerCase());
                  const overlimit = target && target.auction_price && parseFloat(obt.obtained_price) > parseFloat(target.auction_price);
                  
                  return (
                    <tr key={obt.id} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td style={{ padding: '12px', fontWeight: 'bold' }}>{obt.username}</td>
                      <td style={{ padding: '12px' }}>{obt.model} {obt.storage ? `${obt.storage}GB` : ''} ({obt.grade.toUpperCase()})</td>
                      <td style={{ padding: '12px' }}>{target ? `Rp ${parseFloat(target.auction_price || '0').toLocaleString('id-ID')}` : '-'}</td>
                      <td style={{ padding: '12px', color: overlimit ? 'var(--red)' : '#10b981', fontWeight: 'bold' }}>
                        Rp {parseFloat(obt.obtained_price).toLocaleString('id-ID')}
                      </td>
                      <td style={{ padding: '12px' }}>
                        {overlimit ? (
                          <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>Lewat Limit</span>
                        ) : target ? (
                          <span style={{ background: '#dcfce3', color: '#166534', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>Sesuai (Cair)</span>
                        ) : (
                          <span style={{ background: '#f1f5f9', color: '#475569', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>Tanpa Target</span>
                        )}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        {overlimit && (
                          <button style={{ padding: '6px 12px', background: 'var(--navy)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>ACC Gaji</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
