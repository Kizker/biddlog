import React, { useEffect, useState } from 'react';

export default function ManajemenPengguna() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ id: '', username: '', password: '', role: 'anggota' });
  const [isEditing, setIsEditing] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://biddlog.test/api/users.php');
      const data = await res.json();
      if (data.status === 'success') {
        setUsers(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = isEditing ? 'PUT' : 'POST';
      const res = await fetch('http://biddlog.test/api/users.php', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.status === 'success') {
        fetchUsers();
        setFormData({ id: '', username: '', password: '', role: 'anggota' });
        setIsEditing(false);
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (user: any) => {
    setFormData({ id: user.id, username: user.username, password: '', role: user.role });
    setIsEditing(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Yakin ingin menghapus pengguna ini?')) return;
    try {
      await fetch(`http://biddlog.test/api/users.php?id=${id}`, { method: 'DELETE' });
      fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ padding: '24px', background: 'white', borderRadius: '12px', border: '1px solid var(--line)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
      <h3 style={{ marginBottom: '24px', color: 'var(--navy)' }}>Manajemen Pengguna</h3>
      
      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, padding: '20px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <h4 style={{ marginBottom: '16px' }}>{isEditing ? 'Edit Pengguna' : 'Tambah Pengguna Baru'}</h4>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>Username</label>
              <input 
                type="text" 
                value={formData.username} 
                onChange={e => setFormData({...formData, username: e.target.value})} 
                required 
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--line)' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>{isEditing ? 'Password (kosongkan jika tidak diubah)' : 'Password'}</label>
              <input 
                type="password" 
                value={formData.password} 
                onChange={e => setFormData({...formData, password: e.target.value})} 
                required={!isEditing} 
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--line)' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>Role</label>
              <select 
                value={formData.role} 
                onChange={e => setFormData({...formData, role: e.target.value})} 
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--line)' }}
              >
                <option value="anggota">Anggota</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button type="submit" className="btn-admin" style={{ flex: 1 }}>{isEditing ? 'Simpan Perubahan' : 'Simpan'}</button>
              {isEditing && (
                <button type="button" className="secondary-button" onClick={() => { setIsEditing(false); setFormData({ id: '', username: '', password: '', role: 'anggota' }); }}>Batal</button>
              )}
            </div>
          </form>
        </div>
        
        <div style={{ flex: 2 }}>
          {loading ? <p>Memuat...</p> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead style={{ background: '#f8fafc', borderBottom: '1px solid var(--line)' }}>
                <tr>
                  <th style={{ padding: '12px', textAlign: 'left' }}>ID</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Username</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Role</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, idx) => (
                  <tr key={user.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '12px' }}>{user.id}</td>
                    <td style={{ padding: '12px', fontWeight: 'bold' }}>{user.username}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ 
                        background: user.role === 'admin' ? '#fee2e2' : '#e0f2fe', 
                        color: user.role === 'admin' ? '#b91c1c' : '#0369a1', 
                        padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' 
                      }}>
                        {user.role.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <button className="icon-button" onClick={() => handleEdit(user)} style={{ marginRight: '8px', color: 'var(--blue)' }}>✏️</button>
                      <button className="icon-button" onClick={() => handleDelete(user.id)} style={{ color: 'var(--red)' }}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
