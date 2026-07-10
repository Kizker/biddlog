import React, { useEffect, useState } from 'react';

export default function LaporanPresensi() {
  const [attendances, setAttendances] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // Simplify by generating dates for the current week
  const today = new Date();
  const dates = Array.from({length: 7}, (_, i) => {
    const d = new Date();
    d.setDate(today.getDate() - today.getDay() + 1 + i); // Monday to Sunday
    return d.toISOString().split('T')[0];
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

  const getStatus = (userId: number, dateStr: string) => {
    const att = attendances.find(a => a.user_id === userId && a.date === dateStr);
    return att ? att.status : '-';
  };

  return (
    <div style={{ padding: '24px', background: 'white', borderRadius: '12px', border: '1px solid var(--line)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3 style={{ color: 'var(--navy)', margin: 0 }}>Laporan Presensi Mingguan</h3>
        <button onClick={fetchData} className="secondary-button">Refresh Data</button>
      </div>

      {loading ? (
        <p>Memuat data...</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
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
                    const status = getStatus(user.id, date);
                    const colorMap: Record<string, string> = {
                      'hadir': '#10b981',
                      'absen': '#ef4444',
                      'izin': '#f59e0b',
                      '-': '#94a3b8'
                    };
                    return (
                      <td key={date} style={{ padding: '12px', textAlign: 'center', borderLeft: '1px solid var(--line)' }}>
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
