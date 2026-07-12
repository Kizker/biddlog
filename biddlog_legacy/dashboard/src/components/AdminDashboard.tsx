import React, { useEffect, useState } from 'react';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    total_users: 0,
    total_items: 0,
    attendance_today: 0,
    obtained_today: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://biddlog.test/api/dashboard_stats.php')
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          setStats(data.data);
        }
      })
      .catch(err => console.error('Error fetching stats:', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: '24px', background: 'white', borderRadius: '12px', border: '1px solid var(--line)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
      <h3 style={{ marginBottom: '20px', color: 'var(--navy)', fontSize: '19px' }}>Dashboard Ringkasan</h3>
      
      {loading ? (
        <p>Memuat data...</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
          <div style={{ padding: '20px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#64748b', fontSize: '13px' }}>Total Pengguna</h4>
            <div style={{ fontSize: '31px', fontWeight: 'bold', color: 'var(--navy)' }}>{stats.total_users}</div>
          </div>
          <div style={{ padding: '20px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#64748b', fontSize: '13px' }}>Total Barang (Database)</h4>
            <div style={{ fontSize: '31px', fontWeight: 'bold', color: 'var(--blue)' }}>{stats.total_items}</div>
          </div>
          <div style={{ padding: '20px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#64748b', fontSize: '13px' }}>Presensi Hari Ini</h4>
            <div style={{ fontSize: '31px', fontWeight: 'bold', color: '#10b981' }}>{stats.attendance_today}</div>
          </div>
          <div style={{ padding: '20px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#64748b', fontSize: '13px' }}>Barang Didapat Hari Ini</h4>
            <div style={{ fontSize: '31px', fontWeight: 'bold', color: '#f59e0b' }}>{stats.obtained_today}</div>
          </div>
        </div>
      )}
    </div>
  );
}
