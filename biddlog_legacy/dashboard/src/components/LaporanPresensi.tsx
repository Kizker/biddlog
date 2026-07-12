import React, { useEffect, useState } from 'react';

export default function LaporanPresensi({ isDemoMode }: { isDemoMode?: boolean }) {
  const [attendances, setAttendances] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date();
  const currentDay = today.getDay() === 0 ? 7 : today.getDay(); // 1 (Mon) - 7 (Sun)
  const dates = Array.from({length: 7}, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - currentDay + 1 + i); // Monday to Sunday
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dayOfMonth = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dayOfMonth}`;
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const resUsers = await fetch('http://biddlog.test/api/users.php');
      const dataUsers = await resUsers.json();
      
      // Fetch all for now to map the spreadsheet
      // In production, should fetch by date range
      const resAtt = await fetch('http://biddlog.test/api/attendances.php?date='); 
      const dataAtt = await resAtt.json();

      if (dataUsers.status === 'success') {
        setUsers(dataUsers.data);
      }
      if (dataAtt.status === 'success') {
        setAttendances(dataAtt.data);
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

  const getAttendance = (userId: number, dateStr: string) => {
    return attendances.find(a => a.user_id === userId && a.date === dateStr);
  };

  const handleReset = async () => {
    if (!confirm('Yakin ingin mereset/menghapus semua data presensi?')) return;
    try {
      const res = await fetch('http://biddlog.test/api/attendances.php', { method: 'DELETE' });
      const data = await res.json();
      if (data.status === 'success') {
        alert(data.message);
        fetchData();
      } else {
        alert('Gagal reset: ' + data.message);
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan saat reset.');
    }
  };

  return (
    <div style={{ padding: '24px', background: 'white', borderRadius: '12px', border: '1px solid var(--line)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3 style={{ color: 'var(--navy)', margin: 0 }}>Laporan Presensi Mingguan</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          {isDemoMode && (
            <button onClick={handleReset} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '8px 16px', borderRadius: '6px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}>
              Reset Presensi
            </button>
          )}
          <button onClick={fetchData} className="secondary-button">Refresh Data</button>
        </div>
      </div>

      {loading ? (
        <p>Memuat data...</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: 'var(--navy)', color: 'white' }}>
                <th style={{ padding: '12px', textAlign: 'left', minWidth: '150px' }}>Nama Anggota</th>
                {dates.map(date => (
                  <th key={date} style={{ padding: '12px', textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.2)' }}>
                    {new Date(date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '12px', fontWeight: 'bold', background: '#f8fafc' }}>
                    {user.username}
                  </td>
                  {dates.map(date => {
                    const att = getAttendance(user.id, date);
                    const status = att ? att.status : '-';
                    const timeStr = att && att.created_at ? new Date(att.created_at).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'}) : '';
                    const colorMap: Record<string, string> = {
                      'hadir': '#10b981',
                      'absen': '#ef4444',
                      'izin': '#f59e0b',
                      '-': '#94a3b8'
                    };
                    return (
                      <td key={date} style={{ padding: '12px', textAlign: 'center', borderLeft: '1px solid var(--line)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <span style={{ 
                            background: `${colorMap[status.toLowerCase()] || '#94a3b8'}20`, 
                            color: colorMap[status.toLowerCase()] || '#94a3b8',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontWeight: 600,
                            textTransform: 'capitalize'
                          }}>
                            {status}
                          </span>
                          {timeStr && <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>{timeStr}</span>}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
