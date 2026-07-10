import re

with open('main.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the return statement of App component
match = re.search(r'(return\s*\(\s*)<main className="app-shell">(.*?)(\)\s*;\s*}\s*createRoot)', content, re.DOTALL)
if match:
    prefix = match.group(1)
    main_inner = match.group(2)
    suffix = match.group(3)
    
    # In main_inner, we want to hide the original topbar or remove it, but for now we'll just wrap the whole thing.
    # Actually, we can just replace the <main> block.
    
    # We will replace the original return JSX with our new layout
    new_jsx = '''
    <div className="app-container">
      {role === 'admin' && (
        <aside className="admin-sidebar">
          <div className="sidebar-header">
            <div className="sidebar-logo">
              <img src="/bidding-item-analyzer-crop.png" alt="Logo" />
            </div>
            <div className="sidebar-divider"></div>
            <h2 className="sidebar-title">Biddlog</h2>
          </div>
          <nav className="sidebar-nav">
            {['Dashboard', 'Analyzer', 'Hasil Bidding', 'Scanner', 'Pembagian Barang', 'Laporan Presensi', 'Laporan List Dapat', 'Pengguna', 'Audit Trail'].map(name => {
              const viewMap: Record<string, string> = {
                'Analyzer': 'analyzer',
                'Scanner': 'scanner',
                'Hasil Bidding': 'checker'
              };
              return (
                <a 
                  key={name} 
                  href="#" 
                  className={sidebar-link }
                  onClick={(e) => { 
                    e.preventDefault(); 
                    setAdminView(name); 
                    if (viewMap[name]) setActiveView(viewMap[name] as ActiveView); 
                  }}
                >
                  {name}
                </a>
              );
            })}
          </nav>
          <div className="sidebar-footer">
            <button className="btn-logout" type="button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
              Keluar
            </button>
            <div className="admin-user-info">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              Administrator
            </div>
          </div>
        </aside>
      )}

      <div className={role === 'anggota' ? 'public-layout' : 'main-content'}>
        {role === 'anggota' && (
          <header className="public-header">
            <div className="header-left">
              <div className="header-logo">
                <img src="/bidding-item-analyzer-crop.png" alt="Logo" />
              </div>
              <div className="header-divider"></div>
              <h2 className="header-title">Biddlog</h2>
            </div>
            <nav className="header-nav">
              <a href="#" className="header-nav-link active">Beranda</a>
              <a href="#" className="header-nav-link">Presensi</a>
              <a href="#" className="header-nav-link">List Dapat</a>
            </nav>
            <div className="header-right">
              <div className="btn-admin">
                Admin
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              </div>
              <div className="header-stat">0 Barang</div>
              <div className="header-stat">0 Tampil</div>
            </div>
          </header>
        )}

        <main className={role === 'anggota' ? 'app-shell' : ''} style={role === 'admin' ? { padding: '24px' } : {}}>
          <div className="app-inner">
            {role === 'anggota' && (
              <div style={{ padding: '20px', background: 'white', borderRadius: '8px', border: '1px solid var(--line)', textAlign: 'center' }}>
                <p>Silakan tunggu Admin mempublish daftar barang (Data kosong).</p>
              </div>
            )}
            
            <div style={{ display: role === 'admin' ? 'block' : 'none' }}>
              <section className="topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '24px' }}>{adminView}</h2>
                <div className="summary">
                  <span>{parsedItems.length} barang</span>
                  <span>{visibleItems.length} tampil</span>
                </div>
              </section>

              {activeView === 'scanner' ? (
                <PortableGuidePanel />
              ) : activeView === 'checker' ? (
                <ResultChecker />
              ) : (
                <section className="workspace">
                  <aside className="panel input-panel" ref={sidebarRef}>
                    <section className="json-input-section" style={{ padding: '16px', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--line)', marginBottom: '16px' }}>
                      <p className="section-label" style={{ marginBottom: '12px' }}>Output Collector JSON</p>
                      <div className="json-input-card">
                        <label className="file-input-button" style={{ display: 'block', padding: '10px 16px', background: 'var(--blue)', color: 'white', textAlign: 'center', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                          Pilih File JSON
                          <input
                            accept=".json"
                            type="file"
                            onChange={(event) => importJsonFile(event.target.files?.[0])}
                            style={{ display: 'none' }}
                          />
                        </label>
                        <div className="file-status" style={{ marginTop: '12px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <strong style={{ color: 'var(--text)' }}>{importedFileName || 'Belum ada file'}</strong>
                          <span style={{ color: 'var(--muted)' }}>{rawJson ? ${collectorItems.length} baris data terbaca : 'Data masih kosong'}</span>
                        </div>
                      </div>
                    </section>
                    
                    <section className="sort-panel" aria-labelledby="sort-panel-title">
                      <div className="sort-panel-header">
                        <div>
                          <p id="sort-panel-title" className="section-label">
                            Pengurutan Data
                          </p>
                          <span>{sortMode === 'catalog' ? 'Urutan katalog aktif' : 'Urutan scan aktif'}</span>
                        </div>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => setBrandOrder(defaultBrandOrder)}
                        >
                          Default
                        </button>
                      </div>
                      <div className="segmented-control" role="group" aria-label="Mode pengurutan">
                        <button
                          type="button"
                          className={sortMode === 'catalog' ? 'active' : ''}
                          onClick={() => setSortMode('catalog')}
                        >
                          Katalog
                        </button>
                        <button
                          type="button"
                          className={sortMode === 'scan' ? 'active' : ''}
                          onClick={() => setSortMode('scan')}
                        >
                          Scan
                        </button>
                      </div>
                      <div className="brand-sort-builder">
                        <div className="brand-add-row">
                          <input
                            value={newBrand}
                            onChange={(event) => setNewBrand(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                addBrand();
                              }
                            }}
                            placeholder="Tambah brand, contoh: sony"
                          />
                          <button type="button" className="secondary-button" onClick={addBrand}>
                            Tambah
                          </button>
                        </div>
                        <div className="brand-order-list" aria-label="Prioritas brand katalog">
                          {brandOrder.map((brand, index) => (
                            <div
                              className={rand-order-item }
                              draggable
                              key={${brand}-}
                              onDragEnd={() => setDraggedBrandIndex(null)}
                              onDragOver={(event) => event.preventDefault()}
                              onDragStart={() => setDraggedBrandIndex(index)}
                              onDrop={() => dropBrand(index)}
                              title="Tahan lalu geser untuk mengubah urutan"
                            >
                              <span className="brand-rank">{index + 1}</span>
                              <strong>{brand}</strong>
                              <div className="brand-actions">
                                <button type="button" className="icon-button" disabled={index === 0} onClick={() => moveBrand(index, -1)} title="Naikkan brand">Up</button>
                                <button type="button" className="icon-button" disabled={index === brandOrder.length - 1} onClick={() => moveBrand(index, 1)} title="Turunkan brand">Down</button>
                                <button type="button" className="icon-button danger" onClick={() => removeBrand(index)} title="Hapus brand">X</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <p className="sort-hint">
                        Mode katalog otomatis mengurutkan model premium dulu, nomor besar ke kecil,
                        storage besar ke kecil, lalu grade terbaik ke bawah.
                      </p>
                    </section>

                    <div className="filter-sidebar-header">
                      <div>
                        <p className="section-label">Filter Data Saat Ini</p>
                        <span>{activeFilterCount} filter aktif</span>
                      </div>
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={!hasActiveFilter(filters)}
                        onClick={() => setFilters(emptyFilters)}
                      >
                        Reset
                      </button>
                    </div>

                    <MultiFilter title="Merek HP" values={filterOptions.brands} selected={filters.brands} onToggle={(value) => setFilters((current) => toggleFilter(current, 'brands', value))} />
                    <MultiFilter title="Model" values={filterOptions.models} selected={filters.models} onToggle={(value) => setFilters((current) => toggleFilter(current, 'models', value))} />
                    <MultiFilter title="Storage" values={filterOptions.storages} selected={filters.storages} onToggle={(value) => setFilters((current) => toggleFilter(current, 'storages', value))} />
                    <MultiFilter title="Grade" values={filterOptions.grades} selected={filters.grades} onToggle={(value) => setFilters((current) => toggleFilter(current, 'grades', value))} />
                    <MultiFilter title="Status" values={filterOptions.statuses} selected={filters.statuses} onToggle={(value) => setFilters((current) => toggleFilter(current, 'statuses', value))} />
                  </aside>

                  <section className="panel table-panel" style={sidebarHeight > 0 ? ({ '--sidebar-height': ${sidebarHeight}px } as React.CSSProperties) : undefined}>
                    <div className="filters">
                      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari model, kode item, raw name" />
                      <div className="filter-actions">
                        <button className="secondary-button" disabled={visibleItems.length === 0} onClick={copyItemCodes} type="button">
                          {copiedItemCodes ? 'Tersalin' : 'Copy Kode Item'}
                        </button>
                        <button type="button" onClick={exportXlsx}>Export</button>
                      </div>
                    </div>

                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>No</th>
                            <th>Kode Item</th>
                            <th>Model</th>
                            <th>Storage</th>
                            <th>Grade</th>
                            <th>Unit Ke</th>
                            <th>Marker</th>
                            <th>Harga</th>
                            <th>Status</th>
                            <th>Raw Name</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleItems.map((item, index) => (
                            <tr key={item.id}>
                              <td>{index + 1}</td>
                              <td><strong>{item.item_code}</strong></td>
                              <td>{item.model}</td>
                              <td>{item.storage ?? '-'}</td>
                              <td>{item.grade_code.toUpperCase() || '-'}</td>
                              <td>{item.unit_no}</td>
                              <td title={item.source_text || item.source_hash || ''}>{item.scan_marker || '-'}</td>
                              <td>{currency(item.auction_price_number)}</td>
                              <td>{item.status || '-'}</td>
                              <td>{item.raw_name}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </section>
              )}
            </div>
          </div>
        </main>
      </div>

      <div className="role-switcher">
        <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <input type="radio" checked={role === 'admin'} onChange={() => { setRole('admin'); setAdminView('Analyzer'); setActiveView('analyzer'); }} /> Admin
        </label>
        <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <input type="radio" checked={role === 'anggota'} onChange={() => { setRole('anggota'); setActiveView('analyzer'); }} /> Anggota
        </label>
      </div>
    </div>
    '''

    with open('main.tsx', 'w', encoding='utf-8') as fw:
        fw.write(content[:match.start()] + prefix + new_jsx + suffix)
    print("Patched main.tsx successfully")
else:
    print("Regex failed")
