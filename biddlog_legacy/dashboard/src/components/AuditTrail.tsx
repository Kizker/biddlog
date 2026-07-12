import React, { useEffect, useState } from 'react';

export default function AuditTrail() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://biddlog.test/api/audit.php?limit=50');
      const data = await res.json();
      if (data.status === 'success') {
        setLogs(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div style={{ padding: '24px', background: 'white', borderRadius: '12px', border: '1px solid var(--line)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3 style={{ color: 'var(--navy)', margin: 0 }}>Audit Trail (Log Sistem)</h3>
        <button onClick={fetchLogs} className="secondary-button">Refresh Log</button>
      </div>

      {loading ? (
        <p>Memuat log...</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead style={{ background: '#f8fafc', borderBottom: '1px solid var(--line)' }}>
              <tr>
                <th style={{ padding: '12px', textAlign: 'left' }}>Waktu</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Pengguna</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Aksi</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Target</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>IP Address</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '12px', color: '#64748b' }}>{new Date(log.timestamp).toLocaleString('id-ID')}</td>
                  <td style={{ padding: '12px', fontWeight: 'bold' }}>{log.username || 'System/Guest'} ({log.user_id})</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ 
                      background: log.action.includes('delete') ? '#fee2e2' : log.action.includes('create') ? '#dcfce3' : '#f1f5f9', 
                      color: log.action.includes('delete') ? '#b91c1c' : log.action.includes('create') ? '#166534' : '#475569', 
                      padding: '2px 6px', borderRadius: '4px' 
                    }}>
                      {log.action}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>{log.target || '-'}</td>
                  <td style={{ padding: '12px', fontFamily: 'monospace' }}>{log.ip_address}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Belum ada log terekam.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
