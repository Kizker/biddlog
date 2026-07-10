import React, { useEffect, useState } from 'react';

export default function PembagianBarang() {
  const [items, setItems] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedItem, setDraggedItem] = useState<any>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const resItems = await fetch('http://biddlog.test/api/items.php');
      const dataItems = await resItems.json();
      
      const resUsers = await fetch('http://biddlog.test/api/users.php');
      const dataUsers = await resUsers.json();
      
      if (dataItems.status === 'success') {
        // Only show parsed/unassigned or recently assigned items
        setItems(dataItems.data.filter((item: any) => item.status === 'parsed' || item.status === 'published'));
      }
      if (dataUsers.status === 'success') {
        setUsers(dataUsers.data);
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
    setItems(items.map(item => item.id === draggedItem.id ? { ...item, assigned_to: userId, assignee_name: users.find(u => u.id === userId)?.username, status: 'published' } : item));
    
    // Save to DB
    try {
      await fetch('http://biddlog.test/api/assignments.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: draggedItem.id, user_id: userId })
      });
    } catch (err) {
      console.error(err);
      fetchData(); // revert on fail
    }
    setDraggedItem(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div style={{ padding: '24px', background: 'white', borderRadius: '12px', border: '1px solid var(--line)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3 style={{ color: 'var(--navy)', margin: 0 }}>Pembagian Barang (Drag & Drop)</h3>
        <button onClick={fetchData} className="secondary-button">Refresh Data</button>
      </div>

      {loading ? (
        <p>Memuat data...</p>
      ) : (
        <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
          {/* Unassigned Pool */}
          <div style={{ flex: 1, background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', minHeight: '400px' }}>
            <h4 style={{ marginBottom: '16px', color: '#475569' }}>Pool Barang Belum Dibagi</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {items.filter(item => !item.assigned_to).map(item => (
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
                  <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>Grade: {item.grade.toUpperCase()} • Limit: {item.auction_price ? parseFloat(item.auction_price).toLocaleString('id-ID') : '-'}</div>
                  <div style={{ fontSize: '11px', color: '#999', marginTop: '8px', background: '#f1f5f9', display: 'inline-block', padding: '2px 6px', borderRadius: '4px' }}>Recomendasi: {item.raw_name.split(' ').slice(0,1)[0] || 'Unknown'}</div>
                </div>
              ))}
              {items.filter(item => !item.assigned_to).length === 0 && (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>Semua barang sudah dibagikan.</div>
              )}
            </div>
          </div>

          {/* Users List for Drop */}
          <div style={{ flex: 2, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
            {users.map(user => (
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
                    <div key={item.id} style={{ fontSize: '13px', padding: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '4px' }}>
                      <strong>{item.model}</strong> {item.storage ? `${item.storage}GB` : ''} <span style={{ color: '#166534', float: 'right' }}>{item.grade.toUpperCase()}</span>
                    </div>
                  ))}
                  {items.filter(item => item.assigned_to === user.id).length === 0 && (
                    <div style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', marginTop: '10px' }}>Tarik barang ke sini</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
