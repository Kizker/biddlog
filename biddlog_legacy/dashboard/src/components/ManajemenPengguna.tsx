import React, { useEffect, useState } from 'react';

export default function ManajemenPengguna() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ id: '', username: '', password: '', role: 'anggota', accounts: [] as string[] });
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const accountOptions = ['Menik', 'Mubdi', 'Aldi'];

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
        body: JSON.stringify({ ...formData, accounts: formData.accounts.join(',') })
      });
      const data = await res.json();
      if (data.status === 'success') {
        fetchUsers();
        setFormData({ id: '', username: '', password: '', role: 'anggota', accounts: [] });
        setIsEditing(false);
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (user: any) => {
    setFormData({ id: user.id, username: user.username, password: '', role: user.role, accounts: user.accounts ? user.accounts.split(',') : [] });
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

  const cancelEdit = () => {
    setIsEditing(false);
    setFormData({ id: '', username: '', password: '', role: 'anggota', accounts: [] });
  };

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const adminCount = users.filter(u => u.role === 'admin').length;
  const anggotaCount = users.filter(u => u.role === 'anggota').length;

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
          <h3 style={{ margin: 0, color: 'var(--navy)', fontSize: '19px' }}>Manajemen Pengguna</h3>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '13px' }}>Kelola akun admin dan anggota sistem</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{
            background: '#fef2f2',
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 600,
            color: '#b91c1c',
          }}>
            {adminCount} Admin
          </div>
          <div style={{
            background: '#e0f2fe',
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 600,
            color: '#0369a1',
          }}>
            {anggotaCount} Anggota
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="pengguna-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) 1fr', gap: '24px', alignItems: 'flex-start' }}>

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
              background: isEditing ? '#f59e0b' : 'var(--navy)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '15px', flexShrink: 0, transition: 'background 0.3s',
            }}>
              {isEditing ? '✏️' : '👤'}
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '14px', color: isEditing ? '#92400e' : 'var(--navy)' }}>
                {isEditing ? 'Edit Pengguna' : 'Tambah Pengguna Baru'}
              </h4>
              <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>
                {isEditing ? 'Kosongkan password jika tidak diubah' : 'Buat akun baru untuk anggota'}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Username</label>
              <input
                type="text"
                placeholder="Masukkan username..."
                value={formData.username}
                onChange={e => setFormData({ ...formData, username: e.target.value })}
                required
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>

            <div>
              <label style={labelStyle}>{isEditing ? 'Password Baru' : 'Password'}</label>
              <input
                type="password"
                placeholder={isEditing ? 'Kosongkan jika tidak diubah...' : 'Masukkan password...'}
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                required={!isEditing}
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>

            <div>
              <label style={labelStyle}>Role</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['anggota', 'admin'].map(role => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setFormData({ ...formData, role })}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      border: formData.role === role
                        ? (role === 'admin' ? '2px solid #b91c1c' : '2px solid #0369a1')
                        : '1.5px solid #e2e8f0',
                      background: formData.role === role
                        ? (role === 'admin' ? '#fef2f2' : '#e0f2fe')
                        : '#fff',
                      color: formData.role === role
                        ? (role === 'admin' ? '#b91c1c' : '#0369a1')
                        : '#94a3b8',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      textTransform: 'capitalize',
                    }}
                  >
                    {role === 'admin' ? '🛡️ Admin' : '👤 Anggota'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Akun (Menik/Mubdi/Aldi)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {accountOptions.map(acc => {
                  const isChecked = formData.accounts.includes(acc);
                  return (
                    <label
                      key={acc}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        background: isChecked ? '#e0f2fe' : '#f1f5f9',
                        color: isChecked ? '#0369a1' : '#64748b',
                        border: isChecked ? '1px solid #7dd3fc' : '1px solid transparent',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        userSelect: 'none',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const newAccounts = e.target.checked
                            ? [...formData.accounts, acc]
                            : formData.accounts.filter(a => a !== acc);
                          setFormData({ ...formData, accounts: newAccounts });
                        }}
                        style={{ display: 'none' }}
                      />
                      {isChecked ? '✓ ' : '+ '} {acc}
                    </label>
                  );
                })}
              </div>
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
                {isEditing ? 'Simpan Perubahan' : 'Tambah Pengguna'}
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

        {/* User list card */}
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          maxHeight: '550px'
        }}>
          {/* Search bar */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ position: 'relative' }}>
              <svg style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
              <input
                type="text"
                placeholder="Cari pengguna..."
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
            <div style={{ overflowX: 'auto', overflowY: 'auto', width: '100%', flex: 1 }}>
              <table style={{ width: '100%', minWidth: 0, borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'fixed' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 600, color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', width: '5%' }}>#</th>
                    <th style={{ padding: '12px 20px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', width: '25%' }}>Username</th>
                    <th style={{ padding: '12px 20px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', width: '40%' }}>Akun Terhubung</th>
                    <th style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 600, color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', width: '15%' }}>Role</th>
                    <th style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 600, color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', width: '15%' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user, idx) => (
                    <tr
                      key={user.id}
                      style={{ borderTop: '1px solid #f1f5f9', transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '14px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>{idx + 1}</td>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <span style={{ fontWeight: 600, color: 'var(--navy)' }}>{user.username}</span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {user.accounts ? user.accounts.split(',').map((acc: string) => (
                            <span key={acc} style={{
                              background: '#f1f5f9',
                              color: '#475569',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '10px',
                              fontWeight: 600,
                              border: '1px solid #e2e8f0'
                            }}>
                              {acc}
                            </span>
                          )) : <span style={{ color: '#94a3b8', fontSize: '11px', fontStyle: 'italic' }}>Tidak ada</span>}
                        </div>
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block',
                          whiteSpace: 'nowrap',
                          background: user.role === 'admin' ? '#fef2f2' : '#e0f2fe',
                          color: user.role === 'admin' ? '#b91c1c' : '#0369a1',
                          padding: '4px 12px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                        }}>
                          {user.role === 'admin' ? 'ADMIN' : 'ANGGOTA'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                          <button
                            onClick={() => handleEdit(user)}
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
                            title="Edit pengguna"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDelete(user.id)}
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
                            title="Hapus pengguna"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                        <div style={{ fontSize: '31px', marginBottom: '8px' }}>👤</div>
                        {searchQuery ? 'Tidak ada pengguna yang cocok.' : 'Belum ada pengguna terdaftar.'}
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
          .pengguna-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
