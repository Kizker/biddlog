import React, { useEffect, useState } from 'react';

export default function AdminGaji() {
  const [users, setUsers] = useState<any[]>([]);
  const [obtained, setObtained] = useState<any[]>([]);
  const [limits, setLimits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resUsers, resObtained, resLimits] = await Promise.all([
        fetch('http://biddlog.test/api/users.php'),
        fetch('http://biddlog.test/api/obtained.php'),
        fetch('http://biddlog.test/api/limits.php')
      ]);
      
      const dataUsers = await resUsers.json();
      const dataObtained = await resObtained.json();
      const dataLimits = await resLimits.json();
      
      if (dataUsers.status === 'success') setUsers(dataUsers.data);
      if (dataObtained.status === 'success') setObtained(dataObtained.data);
      if (dataLimits.status === 'success') setLimits(dataLimits.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const calculateSalary = (userId: number) => {
    const userItems = obtained.filter(o => o.user_id === userId && o.status === 'acc');
    let total = 0;
    
    userItems.forEach(item => {
      // Find fee rule for this model and grade
      const rule = limits.find(l => l.model.toLowerCase() === item.model.toLowerCase() && l.grade.toLowerCase() === item.grade.toLowerCase());
      if (rule && rule.fee_amount) {
        total += parseFloat(rule.fee_amount);
      } else {
        // Fallback default fee
        total += 25000;
      }
    });
    
    return { count: userItems.length, total };
  };

  return (
    <div style={{ padding: '24px', background: 'white', borderRadius: '12px', border: '1px solid var(--line)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3 style={{ color: 'var(--navy)', margin: 0 }}>Kalkulator Gaji / Fee Anggota</h3>
        <button onClick={fetchData} className="secondary-button">Refresh Data</button>
      </div>

      {loading ? (
        <p>Menghitung gaji...</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead style={{ background: '#f8fafc', borderBottom: '1px solid var(--line)' }}>
              <tr>
                <th style={{ padding: '16px', textAlign: 'left' }}>Nama Anggota</th>
                <th style={{ padding: '16px', textAlign: 'center' }}>Total Barang Didapat</th>
                <th style={{ padding: '16px', textAlign: 'right' }}>Estimasi Gaji (Rp)</th>
                <th style={{ padding: '16px', textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const salary = calculateSalary(user.id);
                if (salary.count === 0) return null; // Only show members with obtained items
                
                return (
                  <tr key={user.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '16px', fontWeight: 'bold', fontSize: '15px' }}>{user.username}</td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <span style={{ background: '#f1f5f9', padding: '4px 12px', borderRadius: '20px', fontWeight: 'bold', color: 'var(--navy)' }}>{salary.count} Unit</span>
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right', fontSize: '17px', fontWeight: 'bold', color: '#10b981' }}>
                      Rp {salary.total.toLocaleString('id-ID')}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <button className="secondary-button" style={{ fontSize: '11px' }}>Lihat Detail</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
