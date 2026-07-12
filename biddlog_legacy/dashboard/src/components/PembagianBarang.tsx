import React, { useEffect, useState } from 'react';

export default function PembagianBarang() {
  const [items, setItems] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [limits, setLimits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedItem, setDraggedItem] = useState<any>(null);
  const [searchAdmin, setSearchAdmin] = useState('');
  const [searchUser, setSearchUser] = useState('');
  const [activeItemMenu, setActiveItemMenu] = useState<number | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [publishStatus, setPublishStatus] = useState<'idle' | 'published' | 'publishing'>('idle');
  const [publishToast, setPublishToast] = useState('');

  const getLimitPrice = (item: any) => {
    const fullModel = item.storage ? `${item.model} ${item.storage}`.toLowerCase() : item.model.toLowerCase();
    const grade = item.grade.toLowerCase();
    
    let matchedLimit = limits.find(l => l.model.toLowerCase() === fullModel && l.grade.toLowerCase() === grade);
    if (!matchedLimit) {
      matchedLimit = limits.find(l => l.model.toLowerCase() === item.model.toLowerCase() && l.grade.toLowerCase() === grade);
    }
    const rawPrice = matchedLimit ? matchedLimit.limit_price : (item.auction_price || '');
    return rawPrice ? Number(rawPrice).toString() : '';
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const resItems = await fetch('http://biddlog.test/api/items.php');
      const dataItems = await resItems.json();
      
      const resUsers = await fetch('http://biddlog.test/api/users.php');
      const dataUsers = await resUsers.json();

      const resLimits = await fetch('http://biddlog.test/api/limits.php');
      const dataLimits = await resLimits.json();
      
      if (dataItems.status === 'success') {
        // Only show parsed/unassigned or recently assigned items
        const filteredItems = dataItems.data.filter((item: any) => item.status === 'parsed' || item.status === 'published');
        setItems(filteredItems);
        if (filteredItems.some((item: any) => item.status === 'published')) {
          setPublishStatus('published');
        } else {
          setPublishStatus('idle');
        }
      }
      if (dataUsers.status === 'success') {
        setUsers(dataUsers.data);
      }
      if (dataLimits.status === 'success') {
        setLimits(dataLimits.data);
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

  const handleDrop = async (e: React.DragEvent, userId: number) => {
    e.preventDefault();
    if (!draggedItem) return;
    
    // Optimistic update
    setItems(items.map(item => item.id === draggedItem.id ? { ...item, assigned_to: userId, assignee_name: users.find(u => u.id === userId)?.username, assigned_accounts: '', status: 'published' } : item));
    
    // Save to DB
    try {
      await fetch('http://biddlog.test/api/assignments.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: draggedItem.id, user_id: userId, assigned_accounts: '' })
      });
    } catch (err) {
      console.error(err);
      fetchData(); // revert on fail
    }
    setDraggedItem(null);
  };

  const handleUnassignDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedItem) return;
    
    setItems(items.map(item => item.id === draggedItem.id ? { ...item, assigned_to: null, assignee_name: null, status: 'parsed' } : item));
    
    try {
      await fetch('http://biddlog.test/api/assignments.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: draggedItem.id, user_id: null, assigned_accounts: draggedItem.assigned_accounts || '' })
      });
    } catch (err) {
      console.error(err);
      fetchData();
    }
    setDraggedItem(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleAccountSelect = async (item: any, account: string) => {
    const currentAccounts = item.assigned_accounts ? item.assigned_accounts.split(',') : [];
    let newAccounts = [];
    if (currentAccounts.includes(account)) {
      newAccounts = currentAccounts.filter((a: string) => a !== account);
    } else {
      newAccounts = [...currentAccounts, account];
    }
    const accountsStr = newAccounts.join(',');

    // Optimistic update
    setItems(items.map(i => i.id === item.id ? { ...i, assigned_accounts: accountsStr } : i));

    try {
      await fetch('http://biddlog.test/api/assignments.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: item.id, user_id: item.assigned_to, assigned_accounts: accountsStr })
      });
    } catch (err) {
      console.error(err);
      fetchData(); // revert
    }
  };

  const fallbackCopyTextToClipboard = (text: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        showCopyToast();
      } else {
        alert('Gagal menyalin hasil.');
      }
    } catch (err) {
      alert('Browser tidak mendukung fitur copy otomatis.');
    }
    document.body.removeChild(textArea);
  };

  const showCopyToast = () => {
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 3000);
  };

  const handleCopy = () => {
    let result = '';
    let index = 1;
    
    // Hanya memproses user yang memiliki barang yang di-assign
    const usersWithItems = users.filter(user => items.some(item => item.assigned_to === user.id));
    
    usersWithItems.forEach(user => {
      const userItems = items.filter(item => item.assigned_to === user.id);
        
      result += `${index}.${user.username} : \n`;
      
      userItems.forEach(item => {
        let itemLine = `${item.model.toLowerCase()} ${item.storage ? item.storage : ''} ${item.grade.toLowerCase()} (${item.unit_no || 1}) @${getLimitPrice(item)}`.trim().replace(/\s+/g, ' ');
        
        const accounts = (item.assigned_accounts || '').replace(/,/g, '/');
        if (accounts) {
          itemLine += ` (${accounts})`;
        }

        result += `${itemLine}\n`;
      });
      
      result += '\n';
      index++;
    });

    if (!navigator.clipboard) {
      fallbackCopyTextToClipboard(result.trim());
      return;
    }

    navigator.clipboard.writeText(result.trim()).then(() => {
      showCopyToast();
    }).catch(err => {
      console.error('Gagal menyalin:', err);
      fallbackCopyTextToClipboard(result.trim());
    });
  };

  const handlePublish = async () => {
    setPublishStatus('publishing');
    try {
      const usersWithItems = users.filter(user => items.some(item => item.assigned_to === user.id));
      const distribution = usersWithItems.map((user, idx) => {
        const userItems = items.filter(item => item.assigned_to === user.id);
        return {
          index: idx + 1,
          username: user.username,
          items: userItems.map(item => ({
            name: `${item.model.toLowerCase()} ${item.storage ? item.storage : ''} ${item.grade.toLowerCase()} (${item.unit_no || 1}) @${getLimitPrice(item)}`.trim().replace(/\s+/g, ' '),
            accounts: item.assigned_accounts || ''
          }))
        };
      });

      const res = await fetch('http://biddlog.test/api/publish.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ distribution })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setPublishStatus('published');
        setPublishToast('Pembagian berhasil dipublish ke Beranda!');
        setTimeout(() => setPublishToast(''), 3000);
        fetchData();
      } else {
        setPublishStatus('idle');
        setPublishToast('Gagal mempublish.');
        setTimeout(() => setPublishToast(''), 3000);
      }
    } catch (err) {
      console.error(err);
      setPublishStatus('idle');
      setPublishToast('Gagal mempublish.');
      setTimeout(() => setPublishToast(''), 3000);
    }
  };

  const handleUnpublish = async () => {
    try {
      await fetch('http://biddlog.test/api/publish.php', { method: 'DELETE' });
      setPublishStatus('idle');
      fetchData();
      setPublishToast('Publish dibatalkan.');
      setTimeout(() => setPublishToast(''), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ padding: '24px', background: 'white', borderRadius: '12px', border: '1px solid var(--line)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3 style={{ color: 'var(--navy)', margin: 0 }}>Pembagian Barang (Drag & Drop)</h3>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {publishStatus === 'published' ? (
            <>
              <button onClick={handlePublish} disabled={publishStatus === 'publishing'} style={{ background: '#6366f1', borderColor: '#6366f1' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px', verticalAlign: 'middle' }}><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                {publishStatus === 'publishing' ? 'Publishing...' : 'Publish'}
              </button>
              <button onClick={handleUnpublish} style={{ background: '#ef4444', borderColor: '#ef4444' }}>Tarik Publish</button>
            </>
          ) : (
            <button onClick={handlePublish} disabled={publishStatus === 'publishing'} style={{ background: '#6366f1', borderColor: '#6366f1' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px', verticalAlign: 'middle' }}><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              {publishStatus === 'publishing' ? 'Publishing...' : 'Publish'}
            </button>
          )}
          <button onClick={handleCopy} className="primary-button" style={{ background: '#10b981', borderColor: '#10b981' }}>Salin Hasil</button>
          <button onClick={fetchData} className="secondary-button">Refresh Data</button>
        </div>
      </div>

      {loading ? (
        <p>Memuat data...</p>
      ) : (
        <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
          {/* Unassigned Pool */}
          <div 
            style={{ flex: 1, background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', minHeight: '400px' }}
            onDragOver={handleDragOver}
            onDrop={handleUnassignDrop}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h4 style={{ margin: 0, color: '#475569' }}>Pool Barang Belum Dibagi</h4>
              <button 
                onClick={async () => {
                  if(confirm('Yakin ingin mereset/menghapus semua data barang? Semua pembagian akan hilang.')) {
                    await fetch('http://biddlog.test/api/items.php', { method: 'DELETE' });
                    fetchData();
                  }
                }}
                style={{ background: '#fee2e2', color: '#b91c1c', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Reset Semua Data
              </button>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <input 
                type="text" 
                placeholder="Cari barang..." 
                value={searchAdmin}
                onChange={(e) => setSearchAdmin(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--line)', outline: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {items.filter(item => !item.assigned_to && (item.model.toLowerCase().includes(searchAdmin.toLowerCase()) || item.raw_name.toLowerCase().includes(searchAdmin.toLowerCase()))).map(item => (
                <div 
                  key={item.id}
                  draggable
                  onDragStart={() => setDraggedItem(item)}
                  onDragEnd={() => setDraggedItem(null)}
                  style={{ 
                    padding: '12px', 
                    background: 'white', 
                    border: '1px solid var(--line)', 
                    borderRadius: '6px',
                    cursor: 'grab',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                  }}
                >
                  <div style={{ fontWeight: 'bold' }}>{item.model} {item.storage ? `${item.storage}GB` : ''}</div>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>Grade: {item.grade.toUpperCase()} • Limit: {getLimitPrice(item) ? parseFloat(getLimitPrice(item)).toLocaleString('id-ID') : '-'}</div>
                  <div style={{ fontSize: '10px', color: '#999', marginTop: '8px', background: '#f1f5f9', display: 'inline-block', padding: '2px 6px', borderRadius: '4px' }}>Recomendasi: {item.raw_name.split(' ').slice(0,1)[0] || 'Unknown'}</div>
                </div>
              ))}
              {items.filter(item => !item.assigned_to).length === 0 && (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>Semua barang sudah dibagikan.</div>
              )}
            </div>
          </div>

          {/* Users List for Drop */}
          <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '600px', overflowY: 'auto', paddingRight: '8px' }}>
            <div style={{ position: 'sticky', top: 0, background: 'white', zIndex: 1, paddingBottom: '8px' }}>
              <input 
                type="text" 
                placeholder="Cari pengguna..." 
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--line)', outline: 'none' }}
              />
            </div>
            {users.filter(user => user.username.toLowerCase().includes(searchUser.toLowerCase())).map(user => (
              <div 
                key={user.id}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, user.id)}
                style={{ 
                  background: 'white', 
                  border: '2px dashed var(--line)', 
                  borderRadius: '8px', 
                  padding: '16px',
                  minHeight: '200px'
                }}
              >
                <h4 style={{ margin: '0 0 16px 0', paddingBottom: '12px', borderBottom: '1px solid var(--line)', color: 'var(--navy)' }}>
                  👤 {user.username}
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {items.filter(item => item.assigned_to === user.id).map(item => (
                    <div 
                      key={item.id} 
                      style={{ fontSize: '12px', padding: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '4px', cursor: 'grab', display: 'flex', flexDirection: 'column', gap: '4px' }}
                    >
                      <div 
                        draggable
                        onDragStart={() => setDraggedItem(item)}
                        onDragEnd={() => setDraggedItem(null)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <strong>{`${item.model.toLowerCase()} ${item.storage ? item.storage : '-'} ${item.grade.toLowerCase()} (${item.unit_no || 1}) @${getLimitPrice(item)}`}</strong>
                        <div style={{ position: 'relative' }}>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveItemMenu(activeItemMenu === item.id ? null : item.id);
                            }}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px', padding: '2px 4px' }}
                            title="Atur Akun"
                          >
                            🏷️
                          </button>
                          
                          {/* Popover Menu */}
                          {activeItemMenu === item.id && (
                            <div style={{
                              position: 'absolute', right: 0, top: '24px', background: 'white', 
                              border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px', 
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', zIndex: 10, minWidth: '120px'
                            }}>
                              <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px', fontWeight: 600 }}>Pilih Akun:</div>
                              {(!user.accounts || user.accounts.trim() === '') ? (
                                <div style={{ fontSize: '10px', color: '#ef4444' }}>Belum ada akun di-set untuk user ini</div>
                              ) : (
                                user.accounts.split(',').map((acc: string) => {
                                  const isChecked = item.assigned_accounts && item.assigned_accounts.split(',').includes(acc);
                                  return (
                                    <label key={acc} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '4px 0', cursor: 'pointer' }}>
                                      <input 
                                        type="checkbox" 
                                        checked={isChecked}
                                        onChange={() => handleAccountSelect(item, acc)}
                                      />
                                      {acc}
                                    </label>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Tampilkan akun yang dipilih di bawah item */}
                      {item.assigned_accounts && item.assigned_accounts.trim() !== '' && (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {item.assigned_accounts.split(',').map((acc: string) => (
                            <span key={acc} style={{ background: '#dcfce7', color: '#166534', fontSize: '9px', padding: '2px 6px', borderRadius: '10px', fontWeight: 600 }}>
                              {acc}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {items.filter(item => item.assigned_to === user.id).length === 0 && (
                    <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', marginTop: '10px' }}>Tarik barang ke sini</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {copySuccess && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: '#10b981',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: 600,
          zIndex: 1000,
          animation: 'fadeUp 0.3s ease-out forwards'
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          Hasil disalin ke clipboard!
        </div>
      )}
      {/* Publish Toast */}
      {publishToast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: publishToast.includes('berhasil') ? '#6366f1' : '#ef4444',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: 600,
          zIndex: 1000,
          animation: 'fadeUp 0.3s ease-out forwards'
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          {publishToast}
        </div>
      )}
      
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
