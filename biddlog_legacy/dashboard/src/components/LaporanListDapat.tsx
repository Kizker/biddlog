import React, { useEffect, useState } from 'react';

export default function LaporanListDapat() {
  const [obtained, setObtained] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'hari_ini' | 'minggu_ini' | 'bulan_ini'>('hari_ini');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://biddlog.test/api/obtained.php');
      const data = await res.json();
      if (data.status === 'success') {
        setObtained(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredData = obtained.filter(item => {
    const itemDate = new Date(item.created_at);
    const today = new Date();
    
    if (filter === 'hari_ini') {
      return itemDate.toDateString() === today.toDateString();
    } else if (filter === 'minggu_ini') {
      const firstDay = new Date(today.setDate(today.getDate() - today.getDay()));
      return itemDate >= firstDay;
    } else if (filter === 'bulan_ini') {
      return itemDate.getMonth() === today.getMonth() && itemDate.getFullYear() === today.getFullYear();
    }
    return true;
  });

  return (
    <div style={{ padding: '24px', background: 'white', borderRadius: '12px', border: '1px solid var(--line)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h3 style={{ color: 'var(--navy)', margin: '0 0 8px 0' }}>Laporan List Dapat</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => setFilter('hari_ini')}
              style={{ padding: '6px 12px', borderRadius: '20px', border: '1px solid var(--line)', background: filter === 'hari_ini' ? 'var(--navy)' : 'white', color: filter === 'hari_ini' ? 'white' : 'var(--text)', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
              Hari Ini (Real-time)
            </button>
            <button 
              onClick={() => setFilter('minggu_ini')}
              style={{ padding: '6px 12px', borderRadius: '20px', border: '1px solid var(--line)', background: filter === 'minggu_ini' ? 'var(--navy)' : 'white', color: filter === 'minggu_ini' ? 'white' : 'var(--text)', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
              Minggu Ini
            </button>
            <button 
              onClick={() => setFilter('bulan_ini')}
              style={{ padding: '6px 12px', borderRadius: '20px', border: '1px solid var(--line)', background: filter === 'bulan_ini' ? 'var(--navy)' : 'white', color: filter === 'bulan_ini' ? 'white' : 'var(--text)', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
              Bulan Ini
            </button>
          </div>
        </div>
        <button onClick={fetchData} className="secondary-button">Refresh Data</button>
      </div>

      {loading ? (
        <p>Memuat data...</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead style={{ background: '#f8fafc', borderBottom: '1px solid var(--line)' }}>
              <tr>
                <th style={{ padding: '12px', textAlign: 'left' }}>Waktu Input</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Nama Anggota</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Model</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Grade</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Harga Dapat</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '12px', color: '#64748b' }}>{new Date(item.created_at).toLocaleString('id-ID')}</td>
                  <td style={{ padding: '12px', fontWeight: 'bold' }}>{item.username}</td>
                  <td style={{ padding: '12px' }}>{item.model} {item.storage ? `${item.storage}GB` : ''}</td>
                  <td style={{ padding: '12px' }}>{item.grade.toUpperCase()}</td>
                  <td style={{ padding: '12px', color: '#10b981', fontWeight: 'bold' }}>Rp {parseFloat(item.obtained_price).toLocaleString('id-ID')}</td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Belum ada data barang didapat untuk filter ini.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
