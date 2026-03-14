// ============================================================
// SMPD - Sistem Manajemen Piket Digital
// app.js — Data, Auth, Router
// ============================================================

// ---- DATABASE (LocalStorage) ----
const DB = {
  keys: {
    kelas: 'smpd_kelas', siswa: 'smpd_siswa', guru: 'smpd_guru',
    user: 'smpd_user', keterlambatan: 'smpd_keterlambatan',
    perizinan: 'smpd_perizinan', session: 'smpd_session'
  },
  get(k) { try { return JSON.parse(localStorage.getItem(DB.keys[k]) || '[]'); } catch { return []; } },
  set(k, v) { localStorage.setItem(DB.keys[k], JSON.stringify(v)); return v; },
  nextId(k) { const a = DB.get(k); return a.length ? Math.max(...a.map(x => x.id || 0)) + 1 : 1; }
};

function initData() {
  if (localStorage.getItem('smpd_init')) return;
  DB.set('kelas', [
    { id: 1, nama_kelas: 'XI PPLG 1', tingkat: 'XI', jurusan: 'PPLG' },
    { id: 2, nama_kelas: 'XI PPLG 2', tingkat: 'XI', jurusan: 'PPLG' },
    { id: 3, nama_kelas: 'XI TKJ 1',  tingkat: 'XI', jurusan: 'TKJ'  }
  ]);
  DB.set('siswa', [
    { id: 1, nisn: '0012345678', nama: 'Ahmad Budi Santoso',  qr_data: 'SISWA-0012345678', no_hp_ortu: '081234567890', id_kelas: 2 },
    { id: 2, nisn: '0012345679', nama: 'Siti Nurhaliza',      qr_data: 'SISWA-0012345679', no_hp_ortu: '081234567891', id_kelas: 2 },
    { id: 3, nisn: '0012345680', nama: 'Rizki Ananda',        qr_data: 'SISWA-0012345680', no_hp_ortu: '081234567892', id_kelas: 1 }
  ]);
  DB.set('guru', [
    { id: 1, nip: '198001012001011001',  nama: 'Bapak Guru Admin',  no_hp: '081200000001' },
    { id: 2, nip: '198502152005012002',  nama: 'Ibu Guru Piket',    no_hp: '081200000002' }
  ]);
  DB.set('user', [
    { id: 1, username: 'admin',              password: 'password', role: 'admin',      id_siswa: null, id_guru: 1 },
    { id: 2, username: '198502152005012002', password: 'password', role: 'guru_piket', id_siswa: null, id_guru: 2 },
    { id: 3, username: '0012345678',         password: 'password', role: 'siswa',      id_siswa: 1,    id_guru: null },
    { id: 4, username: '0012345679',         password: 'password', role: 'siswa',      id_siswa: 2,    id_guru: null }
  ]);
  DB.set('keterlambatan', []);
  DB.set('perizinan', []);
  localStorage.setItem('smpd_init', '1');
}

// ---- AUTH ----
function login(username, password) {
  initData();
  const u = DB.get('user').find(x => x.username === username && x.password === password);
  if (!u) return null;
  const siswa = u.id_siswa ? DB.get('siswa').find(s => s.id === u.id_siswa) : null;
  const guru  = u.id_guru  ? DB.get('guru').find(g => g.id === u.id_guru)   : null;
  const session = { ...u, nama: siswa?.nama || guru?.nama || u.username };
  localStorage.setItem(DB.keys.session, JSON.stringify(session));
  return session;
}
function getSession() { try { return JSON.parse(localStorage.getItem(DB.keys.session) || 'null'); } catch { return null; } }
function logout() { localStorage.removeItem(DB.keys.session); }

function getSiswaById(id) {
  const s = DB.get('siswa').find(x => x.id === parseInt(id));
  if (!s) return null;
  const k = DB.get('kelas').find(x => x.id === s.id_kelas);
  return { ...s, nama_kelas: k?.nama_kelas || '—' };
}

// ---- HELPERS ----
const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
function formatBulan(str) { const [y,m] = str.split('-'); return BULAN[parseInt(m)-1] + ' ' + y; }
function today() { return new Date().toISOString().slice(0,10); }
function timeNow() { return new Date().toTimeString().slice(0,5); }
function timeFullNow() { return new Date().toTimeString().slice(0,8); }
function dateNow() { return new Date().toISOString().slice(0,7); }

function roleBadge(role) {
  const map = { admin: ['badge-red','Admin'], guru_piket: ['badge-blue','Guru Piket'], guru_bk: ['badge-green','Guru BK'], siswa: ['badge-navy','Siswa'] };
  const [cls, label] = map[role] || ['badge-gray', role];
  return `<span class="badge ${cls}">${label}</span>`;
}
function statusBadge(s) {
  const map = { pending: 'badge-amber', disetujui: 'badge-green', ditolak: 'badge-red' };
  return `<span class="badge ${map[s]||'badge-gray'}">${s}</span>`;
}

// ---- ROUTER ----
const Router = {
  routes: {},
  currentPage: null,
  register(name, fn) { this.routes[name] = fn; },
  go(page, params={}) {
    const hash = params && Object.keys(params).length
      ? '#' + page + '?' + new URLSearchParams(params).toString()
      : '#' + page;
    history.pushState({}, '', hash);
    this._render(page, params);
  },
  _parseHash() {
    const h = location.hash.slice(1) || 'login';
    const [page, qs] = h.split('?');
    const params = qs ? Object.fromEntries(new URLSearchParams(qs)) : {};
    return { page, params };
  },
  init() {
    window.addEventListener('popstate', () => {
      const { page, params } = this._parseHash();
      this._render(page, params);
    });
    const { page, params } = this._parseHash();
    this._render(page, params);
  },
  _render(page, params) {
    this.currentPage = page;
    const fn = this.routes[page] || this.routes['404'];
    if (fn) fn(params);
  }
};

// shorthand navigate
function goto(page, params) { Router.go(page, params); }

// ---- QR SCANNER STATE ----
let _qrInstance = null;
function stopQr() {
  if (_qrInstance) {
    try { _qrInstance.stop().catch(()=>{}); } catch(e) {}
    _qrInstance = null;
  }
}

// ============================================================
// PAGES — each returns HTML string, then mounts
// ============================================================

// ------ LAYOUT SHELLS ------
function sidebarAdmin() {
  const s = getSession();
  return `<aside class="sidebar">
    <div class="sidebar-brand">
      <div class="brand-icon"><i class="bi bi-clipboard-check"></i></div>
      <div class="brand-text"><h1>SMPD</h1><span>Piket Digital</span></div>
    </div>
    <nav class="sidebar-nav">
      <span class="nav-label">Manajemen</span>
      <a href="#admin-dashboard" class="slink ${Router.currentPage==='admin-dashboard'?'active':''}"><i class="bi bi-speedometer2"></i> Dashboard</a>
      <a href="#admin-siswa"     class="slink ${Router.currentPage==='admin-siswa'?'active':''}"><i class="bi bi-people"></i> Data Siswa</a>
      <a href="#admin-guru"      class="slink ${Router.currentPage==='admin-guru'?'active':''}"><i class="bi bi-person-badge"></i> Data Guru</a>
      <a href="#admin-kelas"     class="slink ${Router.currentPage==='admin-kelas'?'active':''}"><i class="bi bi-building"></i> Data Kelas</a>
      <span class="nav-label">Laporan</span>
      <a href="#admin-laporan"   class="slink ${Router.currentPage==='admin-laporan'?'active':''}"><i class="bi bi-file-earmark-bar-graph"></i> Laporan</a>
      <span class="nav-label">Panel</span>
      <a href="#guru-dashboard"  class="slink"><i class="bi bi-clipboard-data"></i> Panel Piket</a>
    </nav>
    <div class="sidebar-footer">
      <button class="btn-logout" onclick="logout();goto('login')"><i class="bi bi-box-arrow-right"></i> Keluar</button>
    </div>
  </aside>`;
}

function sidebarGuru() {
  return `<aside class="sidebar">
    <div class="sidebar-brand">
      <div class="brand-icon"><i class="bi bi-clipboard-check"></i></div>
      <div class="brand-text"><h1>SMPD</h1><span>Piket Digital</span></div>
    </div>
    <nav class="sidebar-nav">
      <span class="nav-label">Piket</span>
      <a href="#guru-dashboard"  class="slink ${Router.currentPage==='guru-dashboard'?'active':''}"><i class="bi bi-house"></i> Beranda</a>
      <a href="#guru-scanner"    class="slink ${Router.currentPage==='guru-scanner'?'active':''}"><i class="bi bi-upc-scan"></i> Scanner QR</a>
      <a href="#guru-terlambat"  class="slink ${Router.currentPage==='guru-terlambat'?'active':''}"><i class="bi bi-clock"></i> Input Terlambat</a>
      <a href="#guru-perizinan"  class="slink ${Router.currentPage==='guru-perizinan'?'active':''}"><i class="bi bi-file-check"></i> Manajemen Izin</a>
      <span class="nav-label">Lainnya</span>
      <a href="#admin-dashboard" class="slink"><i class="bi bi-gear"></i> Panel Admin</a>
    </nav>
    <div class="sidebar-footer">
      <button class="btn-logout" onclick="logout();goto('login')"><i class="bi bi-box-arrow-right"></i> Keluar</button>
    </div>
  </aside>`;
}

function sidebarSiswa() {
  return `<aside class="sidebar">
    <div class="sidebar-brand">
      <div class="brand-icon"><i class="bi bi-clipboard-check"></i></div>
      <div class="brand-text"><h1>SMPD</h1><span>Piket Digital</span></div>
    </div>
    <nav class="sidebar-nav">
      <span class="nav-label">Beranda</span>
      <a href="#siswa-dashboard"  class="slink ${Router.currentPage==='siswa-dashboard'?'active':''}"><i class="bi bi-house"></i> Beranda</a>
      <a href="#siswa-profil"     class="slink ${Router.currentPage==='siswa-profil'?'active':''}"><i class="bi bi-qr-code"></i> Profil & QR Code</a>
      <a href="#siswa-perizinan"  class="slink ${Router.currentPage==='siswa-perizinan'?'active':''}"><i class="bi bi-file-earmark-text"></i> E-Permission</a>
      <a href="#siswa-riwayat"    class="slink ${Router.currentPage==='siswa-riwayat'?'active':''}"><i class="bi bi-clock-history"></i> Riwayat</a>
    </nav>
    <div class="sidebar-footer">
      <button class="btn-logout" onclick="logout();goto('login')"><i class="bi bi-box-arrow-right"></i> Keluar</button>
    </div>
  </aside>`;
}

function mount(html) {
  stopQr();
  document.getElementById('app').innerHTML = html;
  // activate sidebar link clicks without page reload
  document.querySelectorAll('.slink').forEach(a => {
    a.onclick = e => {
      e.preventDefault();
      const hash = a.getAttribute('href').slice(1);
      Router.go(hash);
    };
  });
}

function requireRole(...roles) {
  const s = getSession();
  if (!s || !roles.includes(s.role)) { goto('login'); return false; }
  return s;
}

// ============================================================
// PAGE: LOGIN
// ============================================================
Router.register('login', () => {
  initData();
  mount(`
  <div class="login-grid">
    <div class="login-left">
      <div class="login-left-brand">
        <div class="brand-icon"><i class="bi bi-clipboard-check"></i></div>
        <div><h1 style="font-size:1.1rem;font-weight:800;color:white">SMPD</h1><span style="font-size:0.68rem;color:rgba(255,255,255,0.45);letter-spacing:0.06em;text-transform:uppercase">Sistem Manajemen Piket Digital</span></div>
      </div>
      <div>
        <h2 style="font-size:2.1rem;font-weight:800;color:white;line-height:1.15;letter-spacing:-0.03em;margin-bottom:0.875rem">Kelola Kedisiplinan<br>Siswa Lebih Cerdas</h2>
        <p style="font-size:0.88rem;color:rgba(255,255,255,0.5);max-width:360px;line-height:1.7">Platform digital terpadu untuk memantau keterlambatan, mengelola perizinan, dan membuat laporan secara real-time.</p>
        <div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:1.5rem">
          <div class="feature-pill"><i class="bi bi-upc-scan"></i> Scanner QR Code</div>
          <div class="feature-pill"><i class="bi bi-file-check"></i> E-Permission</div>
          <div class="feature-pill"><i class="bi bi-bar-chart"></i> Laporan Otomatis</div>
          <div class="feature-pill"><i class="bi bi-clock-history"></i> Log Real-time</div>
        </div>
      </div>
      <p style="font-size:0.7rem;color:rgba(255,255,255,0.25)">© 2025 SMPD</p>
    </div>
    <div class="login-right">
      <div style="width:100%;max-width:340px">
        <h3 style="font-size:1.45rem;font-weight:800;color:var(--text-primary);letter-spacing:-0.02em;margin-bottom:4px">Selamat Datang</h3>
        <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:1.5rem">Masuk ke akun Anda untuk melanjutkan</p>
        <div id="loginMsg" class="alert alert-danger d-none mb-3"></div>
        <form id="loginForm">
          <div class="form-group">
            <label class="form-label">Username</label>
            <div class="input-icon-wrap"><i class="bi bi-person"></i>
              <input type="text" id="loginUser" class="form-control" placeholder="NISN / NIP / admin" required autofocus>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Password</label>
            <div class="input-icon-wrap"><i class="bi bi-lock"></i>
              <input type="password" id="loginPass" class="form-control" placeholder="••••••••" required>
            </div>
          </div>
          <button type="submit" class="btn btn-primary w-100" style="padding:0.65rem;font-size:0.9rem;margin-top:0.25rem">
            <i class="bi bi-box-arrow-in-right me-1"></i> Masuk
          </button>
        </form>
        <div style="background:var(--surface-3);border-radius:var(--radius-sm);padding:0.875rem;margin-top:1.25rem">
          <p style="font-size:0.7rem;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:var(--text-muted);margin-bottom:0.5rem">Akun Demo</p>
          <div style="display:flex;justify-content:space-between;font-size:0.78rem;color:var(--text-secondary);padding:2px 0"><span>Admin</span><code style="background:var(--border);padding:1px 5px;border-radius:4px;color:var(--navy-600)">admin / password</code></div>
          <div style="display:flex;justify-content:space-between;font-size:0.78rem;color:var(--text-secondary);padding:2px 0"><span>Guru Piket</span><code style="background:var(--border);padding:1px 5px;border-radius:4px;color:var(--navy-600)">198502... / password</code></div>
          <div style="display:flex;justify-content:space-between;font-size:0.78rem;color:var(--text-secondary);padding:2px 0"><span>Siswa</span><code style="background:var(--border);padding:1px 5px;border-radius:4px;color:var(--navy-600)">0012345678 / password</code></div>
        </div>
      </div>
    </div>
  </div>`);

  document.getElementById('loginForm').onsubmit = e => {
    e.preventDefault();
    const s = login(document.getElementById('loginUser').value.trim(), document.getElementById('loginPass').value);
    if (s) {
      if (s.role === 'siswa') goto('siswa-dashboard');
      else if (s.role === 'admin' || s.role === 'guru_bk') goto('admin-dashboard');
      else goto('guru-dashboard');
    } else {
      const m = document.getElementById('loginMsg');
      m.textContent = 'Username atau password salah.';
      m.classList.remove('d-none');
    }
  };
});

// ============================================================
// PAGE: ADMIN DASHBOARD
// ============================================================
Router.register('admin-dashboard', () => {
  const s = requireRole('admin','guru_bk'); if(!s) return;
  const bulan = dateNow();
  const perKelas = {};
  DB.get('kelas').forEach(k => perKelas[k.id] = { ...k, jumlah: 0 });
  DB.get('keterlambatan').filter(t => t.tanggal?.startsWith(bulan)).forEach(t => {
    const sw = DB.get('siswa').find(x => x.id === t.id_siswa);
    if (sw?.id_kelas && perKelas[sw.id_kelas]) perKelas[sw.id_kelas].jumlah++;
  });
  const arr = Object.values(perKelas);
  const maxJ = Math.max(...arr.map(k => k.jumlah), 1);

  mount(`<div class="app-layout">
    ${sidebarAdmin()}
    <div class="main">
      <div class="topbar">
        <div><div class="topbar-title">Dashboard</div><div style="font-size:0.75rem;color:var(--text-muted)">${new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div></div>
        <div style="display:flex;align-items:center;gap:8px;padding:0.4rem 0.875rem;background:var(--surface-3);border-radius:99px;font-size:0.8rem">
          <div style="width:24px;height:24px;background:var(--navy-700);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:700;color:white">${s.nama.charAt(0)}</div>
          <span style="font-weight:600">${s.nama}</span> ${roleBadge(s.role)}
        </div>
      </div>
      <div class="page-content">
        <div class="page-header">
          <div><h1 class="page-title">Monitoring & Data</h1><p class="page-subtitle">Ringkasan aktivitas keterlambatan dan perizinan</p></div>
          <button class="btn btn-primary" onclick="goto('admin-laporan')"><i class="bi bi-file-earmark-bar-graph me-1"></i> Laporan</button>
        </div>
        <div class="stat-grid mb-4">
          <div class="stat-card"><div class="stat-icon blue"><i class="bi bi-people-fill"></i></div><div><div class="stat-label">Total Siswa</div><div class="stat-value">${DB.get('siswa').length}</div></div></div>
          <div class="stat-card"><div class="stat-icon amber"><i class="bi bi-clock-fill"></i></div><div><div class="stat-label">Terlambat Hari Ini</div><div class="stat-value">${DB.get('keterlambatan').filter(t=>t.tanggal===today()).length}</div></div></div>
          <div class="stat-card"><div class="stat-icon red"><i class="bi bi-hourglass-split"></i></div><div><div class="stat-label">Izin Pending</div><div class="stat-value">${DB.get('perizinan').filter(p=>p.status==='pending').length}</div></div></div>
          <div class="stat-card"><div class="stat-icon green"><i class="bi bi-check-circle-fill"></i></div><div><div class="stat-label">Izin Disetujui</div><div class="stat-value">${DB.get('perizinan').filter(p=>p.status==='disetujui').length}</div></div></div>
        </div>
        <div class="row">
          <div class="col-lg-8">
            <div class="card">
              <div class="card-header">
                <div class="card-title"><i class="bi bi-bar-chart-line me-2" style="color:var(--accent)"></i>Keterlambatan per Kelas (Bulan Ini)</div>
                <span class="badge badge-blue">${formatBulan(bulan)}</span>
              </div>
              <div class="table-wrap">
                <table><thead><tr><th>Kelas</th><th>Tingkat</th><th>Jurusan</th><th>Jumlah</th><th>Grafik</th></tr></thead>
                <tbody>${arr.map(k=>`<tr>
                  <td><strong>${k.nama_kelas}</strong></td><td>${k.tingkat||'—'}</td><td>${k.jurusan||'—'}</td>
                  <td><span class="badge ${k.jumlah>0?'badge-amber':'badge-gray'}">${k.jumlah}</span></td>
                  <td style="width:140px"><div style="background:var(--surface-3);border-radius:99px;height:6px"><div style="width:${Math.round(k.jumlah/maxJ*100)}%;background:var(--accent);height:100%;border-radius:99px"></div></div></td>
                </tr>`).join('')}</tbody></table>
              </div>
            </div>
          </div>
          <div class="col-lg-4">
            <div class="card">
              <div class="card-header"><div class="card-title"><i class="bi bi-lightning-charge me-2" style="color:var(--gold)"></i>Aksi Cepat</div></div>
              <div class="card-body" style="display:flex;flex-direction:column;gap:0.6rem">
                <button class="action-card" onclick="goto('admin-siswa',{add:1})"><div class="action-card-icon" style="background:#eff6ff"><i class="bi bi-person-plus" style="color:var(--accent)"></i></div><div><h6>Tambah Siswa</h6><small>Daftarkan siswa baru</small></div></button>
                <button class="action-card" onclick="goto('admin-guru',{add:1})"><div class="action-card-icon" style="background:#f0fdf4"><i class="bi bi-person-badge" style="color:var(--success)"></i></div><div><h6>Tambah Guru</h6><small>Daftarkan guru baru</small></div></button>
                <button class="action-card" onclick="goto('admin-kelas',{add:1})"><div class="action-card-icon" style="background:#fffbeb"><i class="bi bi-building" style="color:var(--gold)"></i></div><div><h6>Tambah Kelas</h6><small>Buat kelas baru</small></div></button>
                <button class="action-card" onclick="goto('guru-perizinan')"><div class="action-card-icon" style="background:#fef2f2"><i class="bi bi-file-check" style="color:var(--danger)"></i></div><div><h6>Validasi Izin</h6><small>Approve/tolak pengajuan</small></div></button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`);
});

// ============================================================
// PAGE: ADMIN SISWA
// ============================================================
Router.register('admin-siswa', (params={}) => {
  const s = requireRole('admin','guru_bk'); if(!s) return;
  const kelasOpts = DB.get('kelas').map(k=>`<option value="${k.id}">${k.nama_kelas}</option>`).join('');

  mount(`<div class="app-layout">
    ${sidebarAdmin()}
    <div class="main">
      <div class="topbar"><div class="topbar-title">Data Siswa</div></div>
      <div class="page-content">
        <div class="page-header">
          <div><h1 class="page-title">Data Siswa</h1><p class="page-subtitle">Kelola data siswa yang terdaftar</p></div>
          <button class="btn btn-primary" id="btnAdd"><i class="bi bi-plus-lg me-1"></i> Tambah Siswa</button>
        </div>
        <div class="card mb-4" id="formAdd" style="${params.add?'':'display:none'}">
          <div class="card-header"><div class="card-title"><i class="bi bi-person-plus me-2" style="color:var(--accent)"></i>Tambah Siswa</div>
          <button class="btn btn-sm" onclick="document.getElementById('formAdd').style.display='none'" style="color:var(--text-muted)"><i class="bi bi-x-lg"></i></button></div>
          <div class="card-body"><form id="fAdd">
            <div class="row" style="flex-wrap:wrap;gap:0.75rem">
              <div style="flex:1;min-width:160px"><label class="form-label">NISN</label><input type="text" name="nisn" class="form-control" placeholder="0012345XXX" required></div>
              <div style="flex:2;min-width:200px"><label class="form-label">Nama Lengkap</label><input type="text" name="nama" class="form-control" required></div>
              <div style="flex:1;min-width:150px"><label class="form-label">Kelas</label><select name="id_kelas" class="form-select"><option value="">— Pilih —</option>${kelasOpts}</select></div>
              <div style="flex:1;min-width:150px"><label class="form-label">No HP Ortu</label><input type="text" name="no_hp" class="form-control"></div>
              <div style="flex:0 0 auto;display:flex;align-items:flex-end"><button type="submit" class="btn btn-primary"><i class="bi bi-check-lg me-1"></i>Simpan</button></div>
            </div>
          </form></div>
        </div>
        <div class="card mb-3" style="padding:0.75rem 1rem">
          <div style="display:flex;align-items:center;gap:0.75rem">
            <i class="bi bi-search" style="color:var(--text-muted)"></i>
            <input type="text" id="srch" class="form-control" placeholder="Cari nama atau NISN..." style="border:none;padding:0;box-shadow:none;font-size:0.9rem">
          </div>
        </div>
        <div class="card"><div class="table-wrap">
          <table><thead><tr><th>#</th><th>NISN</th><th>Nama</th><th>Kelas</th><th>No HP Ortu</th><th>Aksi</th></tr></thead>
          <tbody id="tbl"></tbody></table>
        </div></div>
      </div>
    </div>
  </div>`);

  document.getElementById('btnAdd').onclick = () => {
    const f = document.getElementById('formAdd');
    f.style.display = f.style.display === 'none' ? 'block' : 'none';
  };

  function render(q='') {
    const kelas = DB.get('kelas');
    let list = DB.get('siswa');
    if (q) list = list.filter(x => x.nama.toLowerCase().includes(q.toLowerCase()) || x.nisn.includes(q));
    document.getElementById('tbl').innerHTML = list.length ? list.map((x,i) => {
      const k = kelas.find(kk=>kk.id===x.id_kelas);
      return `<tr><td style="color:var(--text-muted)">${i+1}</td>
        <td><code style="font-size:0.8rem;background:var(--surface-3);padding:2px 6px;border-radius:4px">${x.nisn}</code></td>
        <td><strong>${x.nama}</strong></td>
        <td>${k?`<span class="badge badge-navy">${k.nama_kelas}</span>`:'—'}</td>
        <td style="color:var(--text-muted)">${x.no_hp_ortu||'—'}</td>
        <td><button class="btn btn-sm btn-danger" onclick="hapusSiswa(${x.id})"><i class="bi bi-trash3"></i></button></td></tr>`;
    }).join('') : `<tr><td colspan="6"><div class="empty-state"><i class="bi bi-people"></i><p>Tidak ada data${q?' yang cocok':''}</p></div></td></tr>`;
  }

  window.hapusSiswa = id => {
    if (!confirm('Hapus siswa ini?')) return;
    DB.set('siswa', DB.get('siswa').filter(x=>x.id!==id));
    DB.set('user', DB.get('user').filter(u=>u.id_siswa!==id));
    render(document.getElementById('srch').value);
  };

  document.getElementById('srch').oninput = function() { render(this.value.trim()); };

  document.getElementById('fAdd').onsubmit = function(e) {
    e.preventDefault();
    const id = DB.nextId('siswa'), nisn = this.nisn.value.trim();
    const idKelas = this.id_kelas.value ? parseInt(this.id_kelas.value) : null;
    DB.get('siswa').push({ id, nisn, nama: this.nama.value, qr_data: 'SISWA-'+nisn, no_hp_ortu: this.no_hp.value||null, id_kelas: idKelas });
    DB.set('siswa', DB.get('siswa'));
    DB.get('user').push({ id: DB.nextId('user'), username: nisn, password: 'password', role: 'siswa', id_siswa: id, id_guru: null });
    DB.set('user', DB.get('user'));
    this.reset(); document.getElementById('formAdd').style.display='none';
    alert('Berhasil. Password default: password'); render();
  };
  render();
});

// ============================================================
// PAGE: ADMIN GURU
// ============================================================
Router.register('admin-guru', (params={}) => {
  const s = requireRole('admin'); if(!s) return;
  mount(`<div class="app-layout">
    ${sidebarAdmin()}
    <div class="main">
      <div class="topbar"><div class="topbar-title">Data Guru</div></div>
      <div class="page-content">
        <div class="page-header">
          <div><h1 class="page-title">Data Guru</h1><p class="page-subtitle">Kelola akun guru dan staff</p></div>
          <button class="btn btn-primary" id="btnAdd"><i class="bi bi-plus-lg me-1"></i> Tambah Guru</button>
        </div>
        <div class="card mb-4" id="formAdd" style="${params.add?'':'display:none'}">
          <div class="card-header"><div class="card-title"><i class="bi bi-person-plus me-2" style="color:var(--accent)"></i>Tambah Guru</div>
          <button class="btn btn-sm" onclick="document.getElementById('formAdd').style.display='none'" style="color:var(--text-muted)"><i class="bi bi-x-lg"></i></button></div>
          <div class="card-body"><form id="fAdd">
            <div class="row" style="flex-wrap:wrap;gap:0.75rem">
              <div style="flex:1;min-width:180px"><label class="form-label">NIP</label><input type="text" name="nip" class="form-control" required></div>
              <div style="flex:2;min-width:200px"><label class="form-label">Nama Lengkap</label><input type="text" name="nama" class="form-control" required></div>
              <div style="flex:1;min-width:140px"><label class="form-label">No HP</label><input type="text" name="no_hp" class="form-control"></div>
              <div style="flex:1;min-width:140px"><label class="form-label">Role</label>
                <select name="role" class="form-select"><option value="guru_piket">Guru Piket</option><option value="guru_bk">Guru BK</option><option value="admin">Admin</option></select></div>
              <div style="flex:0 0 auto;display:flex;align-items:flex-end"><button type="submit" class="btn btn-primary"><i class="bi bi-check-lg me-1"></i>Simpan</button></div>
            </div>
          </form></div>
        </div>
        <div class="card"><div class="table-wrap">
          <table><thead><tr><th>NIP</th><th>Nama</th><th>No HP</th><th>Role</th></tr></thead>
          <tbody id="tbl"></tbody></table>
        </div></div>
      </div>
    </div>
  </div>`);

  document.getElementById('btnAdd').onclick = () => {
    const f = document.getElementById('formAdd');
    f.style.display = f.style.display==='none'?'block':'none';
  };

  function render() {
    document.getElementById('tbl').innerHTML = DB.get('guru').map(g => {
      const u = DB.get('user').find(x=>x.id_guru===g.id);
      return `<tr>
        <td><code style="font-size:0.78rem;background:var(--surface-3);padding:2px 6px;border-radius:4px">${g.nip}</code></td>
        <td><strong>${g.nama}</strong></td>
        <td style="color:var(--text-muted)">${g.no_hp||'—'}</td>
        <td>${roleBadge(u?.role)}</td>
      </tr>`;
    }).join('') || `<tr><td colspan="4"><div class="empty-state"><i class="bi bi-person-badge"></i><p>Belum ada data guru</p></div></td></tr>`;
  }

  document.getElementById('fAdd').onsubmit = function(e) {
    e.preventDefault();
    const id = DB.nextId('guru');
    DB.get('guru').push({ id, nip: this.nip.value, nama: this.nama.value, no_hp: this.no_hp.value });
    DB.set('guru', DB.get('guru'));
    DB.get('user').push({ id: DB.nextId('user'), username: this.nip.value, password: 'password', role: this.role.value, id_siswa: null, id_guru: id });
    DB.set('user', DB.get('user'));
    this.reset(); document.getElementById('formAdd').style.display='none';
    alert('Berhasil. Login: NIP / password'); render();
  };
  render();
});

// ============================================================
// PAGE: ADMIN KELAS
// ============================================================
Router.register('admin-kelas', (params={}) => {
  const s = requireRole('admin','guru_bk'); if(!s) return;
  mount(`<div class="app-layout">
    ${sidebarAdmin()}
    <div class="main">
      <div class="topbar"><div class="topbar-title">Data Kelas</div></div>
      <div class="page-content">
        <div class="page-header">
          <div><h1 class="page-title">Data Kelas</h1><p class="page-subtitle">Kelola kelas yang tersedia</p></div>
          <button class="btn btn-primary" id="btnAdd"><i class="bi bi-plus-lg me-1"></i> Tambah Kelas</button>
        </div>
        <div class="card mb-4" id="formAdd" style="${params.add?'':'display:none'}">
          <div class="card-header"><div class="card-title">Tambah Kelas</div>
          <button class="btn btn-sm" onclick="document.getElementById('formAdd').style.display='none'" style="color:var(--text-muted)"><i class="bi bi-x-lg"></i></button></div>
          <div class="card-body"><form id="fAdd">
            <div class="row" style="flex-wrap:wrap;gap:0.75rem">
              <div style="flex:2;min-width:180px"><label class="form-label">Nama Kelas</label><input type="text" name="nama" class="form-control" placeholder="XI PPLG 2" required></div>
              <div style="flex:1;min-width:110px"><label class="form-label">Tingkat</label><input type="text" name="tingkat" class="form-control" placeholder="XI"></div>
              <div style="flex:1;min-width:110px"><label class="form-label">Jurusan</label><input type="text" name="jurusan" class="form-control" placeholder="PPLG"></div>
              <div style="flex:0 0 auto;display:flex;align-items:flex-end"><button type="submit" class="btn btn-primary"><i class="bi bi-check-lg me-1"></i>Simpan</button></div>
            </div>
          </form></div>
        </div>
        <div class="card"><div class="table-wrap">
          <table><thead><tr><th>Nama Kelas</th><th>Tingkat</th><th>Jurusan</th><th>Jumlah Siswa</th><th>Aksi</th></tr></thead>
          <tbody id="tbl"></tbody></table>
        </div></div>
      </div>
    </div>
  </div>`);

  document.getElementById('btnAdd').onclick = () => {
    const f = document.getElementById('formAdd');
    f.style.display = f.style.display==='none'?'block':'none';
  };

  function render() {
    document.getElementById('tbl').innerHTML = DB.get('kelas').map(k => {
      const jml = DB.get('siswa').filter(x=>x.id_kelas===k.id).length;
      return `<tr>
        <td><strong>${k.nama_kelas}</strong></td><td>${k.tingkat||'—'}</td>
        <td>${k.jurusan?`<span class="badge badge-blue">${k.jurusan}</span>`:'—'}</td>
        <td><span class="badge ${jml>0?'badge-navy':'badge-gray'}">${jml} siswa</span></td>
        <td>${jml===0?`<button class="btn btn-sm btn-danger" onclick="hapusKelas(${k.id})"><i class="bi bi-trash3"></i></button>`:'<span style="font-size:0.78rem;color:var(--text-muted)">Ada siswa</span>'}</td>
      </tr>`;
    }).join('') || `<tr><td colspan="5"><div class="empty-state"><i class="bi bi-building"></i><p>Belum ada kelas</p></div></td></tr>`;
  }

  window.hapusKelas = id => {
    if (!confirm('Hapus kelas ini?')) return;
    DB.set('kelas', DB.get('kelas').filter(x=>x.id!==id)); render();
  };

  document.getElementById('fAdd').onsubmit = function(e) {
    e.preventDefault();
    const arr = DB.get('kelas');
    arr.push({ id: DB.nextId('kelas'), nama_kelas: this.nama.value, tingkat: this.tingkat.value, jurusan: this.jurusan.value });
    DB.set('kelas', arr); this.reset(); document.getElementById('formAdd').style.display='none'; render();
  };
  render();
});

// ============================================================
// PAGE: ADMIN LAPORAN
// ============================================================
Router.register('admin-laporan', () => {
  const s = requireRole('admin','guru_bk'); if(!s) return;
  const kelasOpts = DB.get('kelas').map(k=>`<option value="${k.id}">${k.nama_kelas}</option>`).join('');
  mount(`<div class="app-layout">
    ${sidebarAdmin()}
    <div class="main">
      <div class="topbar"><div class="topbar-title">Laporan Keterlambatan</div>
        <button class="btn btn-outline-primary" onclick="window.print()"><i class="bi bi-printer me-1"></i> Cetak</button>
      </div>
      <div class="page-content">
        <div class="page-header"><div><h1 class="page-title">Laporan Keterlambatan</h1><p class="page-subtitle">Filter dan ekspor data</p></div></div>
        <div class="card mb-4">
          <div class="card-body" style="display:flex;gap:1rem;align-items:flex-end;flex-wrap:wrap">
            <div><label class="form-label">Periode</label><input type="month" id="bulan" class="form-control" value="${dateNow()}"></div>
            <div><label class="form-label">Kelas</label><select id="fKelas" class="form-select" style="min-width:150px"><option value="">Semua</option>${kelasOpts}</select></div>
            <button class="btn btn-primary" onclick="renderLaporan()"><i class="bi bi-funnel me-1"></i> Tampilkan</button>
          </div>
        </div>
        <div class="stat-grid mb-4">
          <div class="stat-card"><div class="stat-icon blue"><i class="bi bi-calendar-check"></i></div><div><div class="stat-label">Total</div><div class="stat-value" id="rTotal">0</div></div></div>
          <div class="stat-card"><div class="stat-icon amber"><i class="bi bi-people"></i></div><div><div class="stat-label">Siswa Terlibat</div><div class="stat-value" id="rSiswa">0</div></div></div>
          <div class="stat-card"><div class="stat-icon red"><i class="bi bi-exclamation-triangle"></i></div><div><div class="stat-label">Berulang</div><div class="stat-value" id="rRepeat">0</div></div></div>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title" id="rTitle">Laporan</div><span class="badge badge-blue" id="rPeriode"></span></div>
          <div class="table-wrap"><table><thead><tr><th>No</th><th>Tanggal</th><th>Waktu</th><th>NISN</th><th>Nama</th><th>Kelas</th><th>Alasan</th></tr></thead>
          <tbody id="tbl"></tbody></table></div>
        </div>
      </div>
    </div>
  </div>`);

  window.renderLaporan = () => {
    const bulan = document.getElementById('bulan').value;
    const kelasId = document.getElementById('fKelas').value;
    let list = DB.get('keterlambatan').filter(t => t.tanggal?.startsWith(bulan));
    if (kelasId) {
      const ids = new Set(DB.get('siswa').filter(s=>String(s.id_kelas)===kelasId).map(s=>s.id));
      list = list.filter(t => ids.has(t.id_siswa));
    }
    document.getElementById('rPeriode').textContent = formatBulan(bulan);
    const ids = new Set(list.map(t=>t.id_siswa));
    const rep = {};
    list.forEach(t=>{rep[t.id_siswa]=(rep[t.id_siswa]||0)+1;});
    document.getElementById('rTotal').textContent = list.length;
    document.getElementById('rSiswa').textContent = ids.size;
    document.getElementById('rRepeat').textContent = Object.values(rep).filter(v=>v>1).length;
    document.getElementById('tbl').innerHTML = list.length ? list.map((t,i)=>{
      const sw = getSiswaById(t.id_siswa);
      return `<tr><td style="color:var(--text-muted)">${i+1}</td><td>${t.tanggal}</td>
        <td><span class="badge badge-amber">${(t.waktu||'').slice(0,5)}</span></td>
        <td><code style="font-size:0.78rem;background:var(--surface-3);padding:2px 5px;border-radius:4px">${sw?.nisn||'—'}</code></td>
        <td><strong>${sw?.nama||'—'}</strong></td>
        <td>${sw?.nama_kelas?`<span class="badge badge-navy">${sw.nama_kelas}</span>`:'—'}</td>
        <td style="color:var(--text-muted)">${t.alasan||'—'}</td></tr>`;
    }).join('') : `<tr><td colspan="7"><div class="empty-state"><i class="bi bi-calendar-x"></i><p>Tidak ada data</p></div></td></tr>`;
  };
  renderLaporan();
});

// ============================================================
// PAGE: GURU DASHBOARD
// ============================================================
Router.register('guru-dashboard', () => {
  const s = requireRole('admin','guru_piket','guru_bk'); if(!s) return;
  const log = DB.get('keterlambatan').filter(t=>t.tanggal===today());
  const izin = DB.get('perizinan').filter(p=>p.status==='pending');
  mount(`<div class="app-layout">
    ${sidebarGuru()}
    <div class="main">
      <div class="topbar">
        <div><div class="topbar-title">Selamat datang, ${s.nama}</div><div style="font-size:0.75rem;color:var(--text-muted)">${new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div></div>
        <div style="display:flex;align-items:center;gap:6px;font-size:0.78rem;color:var(--text-muted)">
          <span style="width:8px;height:8px;background:#10b981;border-radius:50%;display:inline-block"></span> Piket Aktif
        </div>
      </div>
      <div class="page-content">
        <div class="stat-grid mb-4">
          <button class="stat-card" onclick="goto('guru-scanner')" style="cursor:pointer;border:2px solid var(--accent);background:linear-gradient(135deg,var(--navy-50),white);text-align:left">
            <div class="stat-icon blue" style="background:var(--navy-700)"><i class="bi bi-upc-scan" style="color:white"></i></div>
            <div><div class="stat-label">Scanner QR</div><div style="font-size:0.9rem;font-weight:700;color:var(--navy-700)">Scan Sekarang</div></div>
          </button>
          <button class="stat-card" onclick="goto('guru-terlambat')" style="cursor:pointer;text-align:left">
            <div class="stat-icon amber"><i class="bi bi-clock-fill"></i></div>
            <div><div class="stat-label">Terlambat Hari Ini</div><div class="stat-value">${log.length}</div></div>
          </button>
          <button class="stat-card" onclick="goto('guru-perizinan')" style="cursor:pointer;text-align:left">
            <div class="stat-icon red"><i class="bi bi-hourglass-split"></i></div>
            <div><div class="stat-label">Izin Pending</div><div class="stat-value">${izin.length}</div></div>
          </button>
        </div>
        <div class="row">
          <div class="col-lg-6">
            <div class="card">
              <div class="card-header"><div class="card-title"><i class="bi bi-list-ul me-2" style="color:var(--accent)"></i>Log Hari Ini</div>
                <button class="btn btn-sm btn-outline-primary" onclick="goto('guru-terlambat')">+ Tambah</button></div>
              <div style="max-height:360px;overflow-y:auto">${log.length ? log.map(t=>{
                const sw=getSiswaById(t.id_siswa);
                return `<div class="list-group-item" style="display:flex;justify-content:space-between;align-items:center">
                  <div><strong>${sw?.nama||'—'}</strong><div style="font-size:0.75rem;color:var(--text-muted)">${sw?.nama_kelas||''} • ${t.alasan||'—'}</div></div>
                  <span class="badge badge-amber">${(t.waktu||'').slice(0,5)}</span></div>`;
              }).join('') : '<div class="empty-state"><i class="bi bi-check-circle"></i><p>Belum ada hari ini</p></div>'}</div>
            </div>
          </div>
          <div class="col-lg-6">
            <div class="card">
              <div class="card-header"><div class="card-title"><i class="bi bi-inbox me-2" style="color:var(--gold)"></i>Izin Pending</div>
                <button class="btn btn-sm btn-warning" onclick="goto('guru-perizinan')">Kelola</button></div>
              <div style="max-height:360px;overflow-y:auto">${izin.length ? izin.map(p=>{
                const sw=getSiswaById(p.id_siswa);
                return `<div class="list-group-item">
                  <strong>${sw?.nama||'—'}</strong>
                  <div style="font-size:0.75rem;color:var(--text-muted)">${sw?.nama_kelas||''} • ${p.jenis==='keluar_sekolah'?'Keluar Sekolah':'Pulang Awal'}</div>
                  <div style="font-size:0.78rem;margin-top:2px">${(p.alasan||'').substring(0,60)}</div></div>`;
              }).join('') : '<div class="empty-state"><i class="bi bi-inbox"></i><p>Tidak ada pending</p></div>'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`);
});

// ============================================================
// PAGE: GURU TERLAMBAT
// ============================================================
Router.register('guru-terlambat', (params={}) => {
  const s = requireRole('admin','guru_piket','guru_bk'); if(!s) return;
  mount(`<div class="app-layout">
    ${sidebarGuru()}
    <div class="main">
      <div class="topbar"><div class="topbar-title">Input Terlambat</div>
        <div style="font-size:0.82rem;font-weight:700;color:var(--text-muted);display:flex;align-items:center;gap:6px"><i class="bi bi-clock"></i><span id="jamNow">${timeNow()}</span></div>
      </div>
      <div class="page-content">
        <div class="row">
          <div class="col-lg-5">
            <div class="card">
              <div class="card-header"><div class="card-title"><i class="bi bi-pencil-square me-2" style="color:var(--accent)"></i>Catat Keterlambatan</div></div>
              <div class="card-body">
                <form id="fTerlambat">
                  <div class="form-group">
                    <label class="form-label">Cari Siswa</label>
                    <div style="position:relative">
                      <input type="text" id="cari" class="form-control" placeholder="Ketik nama atau NISN..." autocomplete="off">
                      <div id="listSiswa" style="display:none;position:absolute;z-index:200;width:100%;background:var(--surface);border:1px solid var(--border-md);border-radius:var(--radius-sm);box-shadow:var(--shadow-md);max-height:200px;overflow-y:auto"></div>
                    </div>
                  </div>
                  <input type="hidden" id="idSiswa">
                  <div id="prevBox" style="display:none;background:var(--navy-50);border:1px solid var(--navy-100);border-radius:var(--radius-sm);padding:0.75rem 1rem;margin-bottom:1rem">
                    <div style="display:flex;align-items:center;gap:10px">
                      <div style="width:36px;height:36px;background:var(--navy-700);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:0.85rem" id="prevInit">?</div>
                      <div><div style="font-weight:700" id="prevNama">—</div><div style="font-size:0.75rem;color:var(--text-muted)" id="prevInfo">—</div></div>
                      <button type="button" onclick="clearSiswa()" style="margin-left:auto;background:none;border:none;color:var(--text-muted);cursor:pointer"><i class="bi bi-x-lg"></i></button>
                    </div>
                  </div>
                  <div class="form-group"><label class="form-label">Alasan (opsional)</label>
                    <input type="text" name="alasan" class="form-control" placeholder="Contoh: Macet, ban bocor..."></div>
                  <button type="submit" class="btn btn-warning w-100" style="padding:0.65rem">
                    <i class="bi bi-clock me-1"></i> Catat Terlambat Sekarang</button>
                </form>
              </div>
            </div>
          </div>
          <div class="col-lg-7">
            <div class="card">
              <div class="card-header"><div class="card-title"><i class="bi bi-list-ul me-2" style="color:var(--accent)"></i>Log Hari Ini</div>
                <span class="badge badge-blue" id="logCount">0 catatan</span></div>
              <div style="max-height:480px;overflow-y:auto" id="logList"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`);

  setInterval(() => { const el=document.getElementById('jamNow'); if(el) el.textContent=timeNow(); }, 10000);

  function selectSiswa(sw) {
    document.getElementById('idSiswa').value = sw.id;
    document.getElementById('cari').value = '';
    document.getElementById('listSiswa').style.display = 'none';
    document.getElementById('prevBox').style.display = 'block';
    document.getElementById('prevInit').textContent = sw.nama.charAt(0).toUpperCase();
    document.getElementById('prevNama').textContent = sw.nama;
    document.getElementById('prevInfo').textContent = sw.nisn + ' • ' + (sw.nama_kelas||'—');
  }

  window.clearSiswa = () => {
    document.getElementById('idSiswa').value = '';
    document.getElementById('prevBox').style.display = 'none';
    document.getElementById('cari').focus();
  };

  // Prefill from scanner
  if (params.id) {
    const sw = getSiswaById(params.id);
    if (sw) selectSiswa(sw);
  }

  document.getElementById('cari').oninput = function() {
    const q = this.value.trim();
    const el = document.getElementById('listSiswa');
    if (q.length < 2) { el.style.display='none'; return; }
    const arr = DB.get('siswa').filter(x => x.nama.toLowerCase().includes(q.toLowerCase()) || x.nisn.includes(q));
    if (!arr.length) { el.style.display='none'; return; }
    el.innerHTML = arr.slice(0,12).map(x => {
      const k = DB.get('kelas').find(kk=>kk.id===x.id_kelas);
      return `<div style="padding:0.55rem 0.875rem;font-size:0.82rem;cursor:pointer;border-bottom:1px solid var(--border)" 
        onmousedown="selTerlambat(${x.id})"
        onmouseover="this.style.background='var(--surface-2)'" onmouseout="this.style.background=''">
        <strong>${x.nama}</strong> <span style="color:var(--text-muted)">— ${x.nisn} (${k?.nama_kelas||'—'})</span></div>`;
    }).join('');
    el.style.display = 'block';
  };

  window.selTerlambat = id => {
    const sw = getSiswaById(id);
    if (sw) selectSiswa(sw);
  };

  document.getElementById('cari').onblur = () => setTimeout(() => {
    const el = document.getElementById('listSiswa');
    if (el) el.style.display = 'none';
  }, 200);

  function renderLog() {
    const log = DB.get('keterlambatan').filter(t=>t.tanggal===today()).sort((a,b)=>b.waktu?.localeCompare(a.waktu));
    const el = document.getElementById('logCount');
    if (el) el.textContent = log.length + ' catatan';
    const ll = document.getElementById('logList');
    if (!ll) return;
    ll.innerHTML = log.length ? log.map(t => {
      const sw = getSiswaById(t.id_siswa);
      return `<div class="list-group-item" style="display:flex;justify-content:space-between;align-items:center">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:34px;height:34px;background:var(--surface-3);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.8rem;color:var(--text-secondary);flex-shrink:0">${(sw?.nama||'?').charAt(0)}</div>
          <div><strong>${sw?.nama||'—'}</strong><div style="font-size:0.75rem;color:var(--text-muted)">${sw?.nama_kelas||''} • ${t.alasan||'—'}</div></div>
        </div>
        <span class="badge badge-amber">${(t.waktu||'').slice(0,5)}</span>
      </div>`;
    }).join('') : '<div class="empty-state"><i class="bi bi-check-circle"></i><p>Belum ada hari ini</p></div>';
  }
  renderLog();

  document.getElementById('fTerlambat').onsubmit = function(e) {
    e.preventDefault();
    const id = parseInt(document.getElementById('idSiswa').value);
    if (!id) { alert('Pilih siswa dulu!'); return; }
    const arr = DB.get('keterlambatan');
    arr.push({ id: DB.nextId('keterlambatan'), id_siswa: id, id_guru_piket: s.id_guru, tanggal: today(), waktu: timeFullNow(), alasan: this.alasan.value });
    DB.set('keterlambatan', arr);
    this.alasan.value = '';
    clearSiswa();
    renderLog();
    const btn = this.querySelector('button[type=submit]');
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="bi bi-check-circle me-1"></i> Berhasil!';
    btn.style.cssText = 'background:#f0fdf4;color:#065f46;width:100%;padding:0.65rem';
    setTimeout(() => { btn.innerHTML = orig; btn.style.cssText = 'width:100%;padding:0.65rem'; }, 2000);
  };
});

// ============================================================
// PAGE: GURU PERIZINAN
// ============================================================
Router.register('guru-perizinan', () => {
  const s = requireRole('admin','guru_piket','guru_bk'); if(!s) return;
  let filter = 'pending';

  mount(`<div class="app-layout">
    ${sidebarGuru()}
    <div class="main">
      <div class="topbar"><div class="topbar-title">Manajemen Perizinan</div></div>
      <div class="page-content">
        <div class="page-header">
          <div><h1 class="page-title">Perizinan Siswa</h1><p class="page-subtitle">Approve atau tolak pengajuan izin</p></div>
          <span class="badge badge-red" id="pcnt" style="font-size:0.85rem;padding:0.5rem 0.875rem"></span>
        </div>
        <div class="nav-tabs mb-4">
          <div class="nav-item"><a class="nav-link active tab-izin" href="#" data-f="pending">Pending</a></div>
          <div class="nav-item"><a class="nav-link tab-izin" href="#" data-f="disetujui">Disetujui</a></div>
          <div class="nav-item"><a class="nav-link tab-izin" href="#" data-f="ditolak">Ditolak</a></div>
          <div class="nav-item"><a class="nav-link tab-izin" href="#" data-f="all">Semua</a></div>
        </div>
        <div id="izinContent"></div>
      </div>
    </div>
  </div>`);

  window.setStatusIzin = (id, status) => {
    const arr = DB.get('perizinan');
    const p = arr.find(x=>x.id===id);
    if (p) { p.status = status; p.id_guru_validasi = s.id_guru; p.waktu_validasi = new Date().toISOString(); DB.set('perizinan', arr); renderIzin(); }
  };

  function renderIzin() {
    let list = DB.get('perizinan');
    const pending = list.filter(p=>p.status==='pending');
    const el = document.getElementById('pcnt');
    if (el) el.textContent = pending.length + ' menunggu';
    if (filter !== 'all') list = list.filter(p=>p.status===filter);
    const ic = document.getElementById('izinContent');
    if (!ic) return;
    if (filter === 'pending') {
      ic.innerHTML = list.length ? list.map(p => {
        const sw = getSiswaById(p.id_siswa);
        return `<div class="card mb-3" style="border-left:3px solid var(--warning)">
          <div class="card-body">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.875rem">
              <div style="display:flex;align-items:center;gap:10px">
                <div style="width:42px;height:42px;background:var(--navy-700);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;color:white;font-size:1rem">${(sw?.nama||'?').charAt(0)}</div>
                <div><div style="font-weight:700;font-size:0.95rem">${sw?.nama||'—'}</div>
                  <div style="font-size:0.75rem;color:var(--text-muted)">${sw?.nisn||''} • <span class="badge badge-navy">${sw?.nama_kelas||'—'}</span></div></div>
              </div>
              <div style="text-align:right"><span class="badge badge-amber">Pending</span><div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px">${p.tanggal}</div></div>
            </div>
            <div style="background:var(--surface-2);border-radius:var(--radius-sm);padding:0.75rem;margin-bottom:0.875rem">
              <div style="font-size:0.72rem;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:var(--text-muted);margin-bottom:4px">
                <i class="bi bi-${p.jenis==='keluar_sekolah'?'door-open':'house-door'} me-1"></i>${p.jenis==='keluar_sekolah'?'Keluar Sekolah':'Pulang Awal'}</div>
              <div style="font-size:0.87rem">${p.alasan}</div>
            </div>
            <div style="display:flex;gap:0.5rem">
              <button class="btn btn-success" style="flex:1;justify-content:center" onclick="setStatusIzin(${p.id},'disetujui')"><i class="bi bi-check-lg me-1"></i>Setujui</button>
              <button class="btn btn-danger" onclick="setStatusIzin(${p.id},'ditolak')"><i class="bi bi-x-lg me-1"></i>Tolak</button>
            </div>
          </div>
        </div>`;
      }).join('') : '<div class="empty-state" style="padding:4rem"><i class="bi bi-inbox" style="font-size:3rem;opacity:0.3;display:block;margin-bottom:0.75rem"></i><p>Tidak ada izin pending</p></div>';
    } else {
      ic.innerHTML = `<div class="card"><div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>Siswa</th><th>Kelas</th><th>Jenis</th><th>Alasan</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${
        list.length ? list.map(p => {
          const sw = getSiswaById(p.id_siswa);
          return `<tr><td>${p.tanggal}</td><td><strong>${sw?.nama||'—'}</strong><br><small>${sw?.nisn||''}</small></td>
            <td><span class="badge badge-navy">${sw?.nama_kelas||'—'}</span></td>
            <td>${p.jenis==='keluar_sekolah'?'Keluar':'Pulang'}</td>
            <td style="max-width:180px;font-size:0.82rem;color:var(--text-secondary)">${(p.alasan||'').substring(0,45)}...</td>
            <td>${statusBadge(p.status)}</td>
            <td>${p.status==='pending'?`<div style="display:flex;gap:4px"><button class="btn btn-sm btn-success" onclick="setStatusIzin(${p.id},'disetujui')"><i class="bi bi-check"></i></button><button class="btn btn-sm btn-danger" onclick="setStatusIzin(${p.id},'ditolak')"><i class="bi bi-x"></i></button></div>`:'—'}</td>
          </tr>`;
        }).join('') : '<tr><td colspan="7"><div class="empty-state"><i class="bi bi-file-x"></i><p>Tidak ada data</p></div></td></tr>'
      }</tbody></table></div></div>`;
    }
  }

  document.querySelectorAll('.tab-izin').forEach(a => {
    a.onclick = e => {
      e.preventDefault();
      filter = a.dataset.f;
      document.querySelectorAll('.tab-izin').forEach(x=>x.classList.remove('active'));
      a.classList.add('active');
      renderIzin();
    };
  });
  renderIzin();
});

// ============================================================
// PAGE: GURU SCANNER
// ============================================================
Router.register('guru-scanner', () => {
  const s = requireRole('admin','guru_piket','guru_bk'); if(!s) return;
  mount(`<div class="app-layout">
    ${sidebarGuru()}
    <div class="main">
      <div class="topbar"><div class="topbar-title">Scanner QR Code</div></div>
      <div class="page-content">
        <div class="page-header"><div><h1 class="page-title">Scanner QR Code</h1><p class="page-subtitle">Scan ID siswa untuk identifikasi cepat</p></div></div>
        <div class="row">
          <div class="col-lg-6">
            <div class="card"><div class="card-header"><div class="card-title"><i class="bi bi-camera me-2" style="color:var(--accent)"></i>Kamera</div></div>
            <div class="card-body">
              <div id="reader" style="background:var(--navy-950);border-radius:var(--radius-md);overflow:hidden;min-height:280px"></div>
              <p style="font-size:0.78rem;color:var(--text-muted);text-align:center;margin-top:0.75rem"><i class="bi bi-info-circle me-1"></i>Arahkan kamera ke QR Code siswa</p>
            </div></div>
          </div>
          <div class="col-lg-6">
            <div id="scanResult">
              <div style="border:2px dashed var(--border-md);border-radius:var(--radius-lg);padding:4rem 2rem;text-align:center;color:var(--text-muted)">
                <i class="bi bi-qr-code-scan" style="font-size:3rem;display:block;margin-bottom:1rem;opacity:0.3"></i>
                <div style="font-size:0.9rem;font-weight:600">Menunggu Scan</div>
                <p style="font-size:0.8rem;margin-top:4px">Scan QR Code siswa</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`);

  if (typeof Html5Qrcode === 'undefined') {
    document.getElementById('reader').innerHTML = `<div style="padding:2rem;text-align:center;color:var(--text-muted)"><i class="bi bi-camera-video-off" style="font-size:2rem;display:block;margin-bottom:0.75rem;opacity:0.4"></i><p style="font-size:0.85rem">Library QR tidak tersedia. Pastikan terhubung ke internet.</p><button class="btn btn-primary" style="margin-top:0.75rem" onclick="goto('guru-terlambat')"><i class="bi bi-pencil-square me-1"></i>Input Manual</button></div>`;
    return;
  }

  let lastResult = '';
  _qrInstance = new Html5Qrcode("reader");
  _qrInstance.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 230, height: 230 } }, decodedText => {
    if (decodedText === lastResult) return;
    lastResult = decodedText;
    const nisn = decodedText.replace(/^SISWA-/i, '');
    const found = DB.get('siswa').find(x => x.qr_data===decodedText || x.nisn===decodedText || x.nisn===nisn);
    const sr = document.getElementById('scanResult');
    if (!sr) return;
    if (found) {
      const sw = getSiswaById(found.id);
      sr.innerHTML = `<div class="card" style="border:2px solid var(--success)">
        <div style="background:#f0fdf4;padding:1rem 1.25rem;border-bottom:1px solid #a7f3d0;display:flex;align-items:center;gap:8px">
          <i class="bi bi-check-circle-fill" style="color:var(--success);font-size:1.1rem"></i>
          <span style="font-weight:700;color:#065f46">Siswa Ditemukan</span>
        </div>
        <div style="padding:1.25rem">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:1.25rem">
            <div style="width:50px;height:50px;background:var(--navy-700);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.1rem;font-weight:800;color:white;flex-shrink:0">${sw.nama.charAt(0)}</div>
            <div><div style="font-size:1.05rem;font-weight:800">${sw.nama}</div>
              <div style="font-size:0.8rem;color:var(--text-muted)">${sw.nisn} • <span class="badge badge-navy">${sw.nama_kelas}</span></div></div>
          </div>
          <div style="display:flex;gap:0.5rem">
            <button class="btn btn-warning" style="flex:1;justify-content:center" onclick="goto('guru-terlambat',{id:${sw.id}})"><i class="bi bi-clock me-1"></i>Catat Terlambat</button>
            <button class="btn btn-outline-primary" style="flex:1;justify-content:center" onclick="goto('guru-perizinan')"><i class="bi bi-file-check me-1"></i>Kelola Izin</button>
          </div>
        </div>
      </div>`;
    } else {
      sr.innerHTML = `<div class="card" style="border:2px solid var(--warning)">
        <div style="padding:3rem 2rem;text-align:center">
          <i class="bi bi-exclamation-triangle-fill" style="font-size:2.5rem;color:var(--warning);display:block;margin-bottom:0.75rem"></i>
          <div style="font-weight:700">Siswa Tidak Ditemukan</div>
          <p style="font-size:0.8rem;color:var(--text-muted);margin-top:4px">QR Code tidak terdaftar</p>
          <button class="btn btn-outline-primary" style="margin-top:1rem" onclick="goto('guru-terlambat')">Input Manual</button>
        </div>
      </div>`;
    }
    setTimeout(() => { lastResult = ''; }, 3000);
  }, () => {}).catch(() => {
    const r = document.getElementById('reader');
    if (r) r.innerHTML = `<div style="padding:2rem;text-align:center;color:var(--text-muted)"><i class="bi bi-camera-video-off" style="font-size:2rem;display:block;margin-bottom:0.75rem;opacity:0.4"></i><p>Kamera tidak tersedia.</p><button class="btn btn-primary" style="margin-top:0.75rem" onclick="goto('guru-terlambat')"><i class="bi bi-pencil-square me-1"></i>Input Manual</button></div>`;
  });
});

// ============================================================
// PAGE: SISWA DASHBOARD
// ============================================================
Router.register('siswa-dashboard', () => {
  const s = requireRole('siswa'); if(!s) return;
  const sw = getSiswaById(s.id_siswa);
  const terlambat = DB.get('keterlambatan').filter(t=>t.id_siswa===s.id_siswa);
  const izin = DB.get('perizinan').filter(p=>p.id_siswa===s.id_siswa);
  mount(`<div class="app-layout">
    ${sidebarSiswa()}
    <div class="main">
      <div class="topbar"><div class="topbar-title">Beranda</div>
        <span style="font-size:0.78rem;color:var(--text-muted)">${new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</span>
      </div>
      <div class="page-content">
        <div style="background:linear-gradient(135deg,var(--navy-800) 0%,var(--navy-600) 100%);border-radius:var(--radius-xl);padding:2rem;color:white;position:relative;overflow:hidden;margin-bottom:1.5rem">
          <div style="position:absolute;top:-60px;right:-60px;width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,0.05)"></div>
          <div style="position:absolute;bottom:-40px;right:80px;width:130px;height:130px;border-radius:50%;background:rgba(255,255,255,0.04)"></div>
          <div style="width:56px;height:56px;background:rgba(255,255,255,0.15);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.4rem;font-weight:800;margin-bottom:0.875rem">${sw.nama.charAt(0)}</div>
          <h2 style="font-size:1.4rem;font-weight:800;letter-spacing:-0.02em;margin-bottom:4px">${sw.nama}</h2>
          <p style="font-size:0.82rem;color:rgba(255,255,255,0.55)">${sw.nisn} • ${sw.nama_kelas}</p>
          <div style="display:flex;gap:2.5rem;margin-top:1.25rem">
            <div><div style="font-size:1.7rem;font-weight:800;line-height:1">${terlambat.length}</div><div style="font-size:0.72rem;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.04em;margin-top:2px">Keterlambatan</div></div>
            <div><div style="font-size:1.7rem;font-weight:800;line-height:1">${izin.length}</div><div style="font-size:0.72rem;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.04em;margin-top:2px">Pengajuan Izin</div></div>
          </div>
          <button onclick="goto('siswa-profil')" style="position:absolute;right:2rem;top:50%;transform:translateY(-50%);background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);border-radius:var(--radius-md);padding:0.875rem 1rem;color:white;cursor:pointer;text-align:center;transition:background 0.18s" onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.12)'">
            <i class="bi bi-qr-code" style="font-size:1.75rem;display:block;margin-bottom:4px"></i>
            <span style="font-size:0.72rem">QR Code</span>
          </button>
        </div>
        <div class="row mb-4">
          <div class="col-md-4"><button class="action-card w-100" style="text-align:left" onclick="goto('siswa-profil')"><div class="action-card-icon" style="background:var(--navy-50)"><i class="bi bi-qr-code" style="color:var(--navy-700)"></i></div><div><h6>QR Code Saya</h6><small>Tunjukkan ke guru piket</small></div></button></div>
          <div class="col-md-4"><button class="action-card w-100" style="text-align:left" onclick="goto('siswa-perizinan')"><div class="action-card-icon" style="background:#eff6ff"><i class="bi bi-file-earmark-plus" style="color:var(--accent)"></i></div><div><h6>Ajukan Izin</h6><small>Keluar / pulang awal</small></div></button></div>
          <div class="col-md-4"><button class="action-card w-100" style="text-align:left" onclick="goto('siswa-riwayat')"><div class="action-card-icon" style="background:#fffbeb"><i class="bi bi-clock-history" style="color:var(--gold)"></i></div><div><h6>Riwayat</h6><small>Rekap keterlambatan</small></div></button></div>
        </div>
        <div class="row">
          <div class="col-lg-6">
            <div class="card">
              <div class="card-header"><div class="card-title"><i class="bi bi-file-earmark-check me-2" style="color:var(--accent)"></i>Status Izin Terkini</div>
                <button class="btn btn-sm btn-accent" onclick="goto('siswa-perizinan')" style="background:var(--accent);color:white;border:none;padding:0.3rem 0.75rem;border-radius:var(--radius-sm);font-size:0.75rem;cursor:pointer">+ Ajukan</button></div>
              <div>${izin.length ? izin.slice(0,5).map(p=>`<div class="list-group-item" style="display:flex;justify-content:space-between;align-items:flex-start">
                <div><div style="font-size:0.75rem;color:var(--text-muted)">${p.tanggal} • ${p.jenis==='keluar_sekolah'?'Keluar':'Pulang Awal'}</div>
                <div style="font-size:0.85rem;margin-top:2px">${(p.alasan||'').substring(0,50)}</div></div>
                ${statusBadge(p.status)}</div>`).join('') : '<div class="empty-state"><i class="bi bi-file-earmark"></i><p>Belum ada pengajuan</p></div>'}</div>
            </div>
          </div>
          <div class="col-lg-6">
            <div class="card">
              <div class="card-header"><div class="card-title"><i class="bi bi-clock-history me-2" style="color:var(--gold)"></i>Riwayat Keterlambatan</div>
                <button class="btn btn-sm btn-outline-primary" onclick="goto('siswa-riwayat')">Lihat Semua</button></div>
              <div>${terlambat.length ? terlambat.slice(0,5).map(t=>`<div class="list-group-item" style="display:flex;justify-content:space-between;align-items:center">
                <div><div style="font-size:0.85rem;font-weight:600">${t.tanggal}</div><div style="font-size:0.75rem;color:var(--text-muted)">${t.alasan||'—'}</div></div>
                <span class="badge badge-amber">${(t.waktu||'').slice(0,5)}</span></div>`).join('') : '<div class="empty-state"><i class="bi bi-check2-circle"></i><p>Tidak ada riwayat. Pertahankan!</p></div>'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`);
});

// ============================================================
// PAGE: SISWA PROFIL
// ============================================================
Router.register('siswa-profil', () => {
  const s = requireRole('siswa'); if(!s) return;
  const sw = getSiswaById(s.id_siswa);
  const qr = sw.qr_data || 'SISWA-' + sw.nisn;
  mount(`<div class="app-layout">
    ${sidebarSiswa()}
    <div class="main">
      <div class="topbar"><div class="topbar-title">Profil & QR Code</div></div>
      <div class="page-content">
        <div class="row">
          <div class="col-md-5">
            <div class="card">
              <div style="background:linear-gradient(135deg,var(--navy-800),var(--navy-600));padding:1.5rem;text-align:center;border-radius:var(--radius-lg) var(--radius-lg) 0 0">
                <div style="font-size:0.72rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.45);margin-bottom:6px"><i class="bi bi-qr-code-scan me-1"></i>Kartu Identitas Digital</div>
                <div style="font-size:1rem;font-weight:700;color:white">${sw.nama}</div>
                <div style="font-size:0.78rem;color:rgba(255,255,255,0.5)">${sw.nama_kelas}</div>
              </div>
              <div style="padding:1.5rem;text-align:center">
                <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:1rem;font-weight:600;letter-spacing:0.04em">TUNJUKKAN KE GURU PIKET</div>
                <div style="background:white;border-radius:var(--radius-md);padding:1rem;display:inline-block;box-shadow:0 4px 16px rgba(13,31,62,0.12)">
                  <div id="qrcode"></div>
                </div>
                <p style="font-size:0.75rem;color:var(--text-muted);margin-top:0.75rem">ID: ${qr}</p>
              </div>
            </div>
          </div>
          <div class="col-md-7">
            <div class="card mb-3">
              <div class="card-header"><div class="card-title"><i class="bi bi-person-circle me-2" style="color:var(--accent)"></i>Data Diri</div></div>
              <div class="card-body">
                <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.25rem;padding-bottom:1.25rem;border-bottom:1px solid var(--border)">
                  <div style="width:60px;height:60px;background:linear-gradient(135deg,var(--navy-700),var(--navy-500));border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.4rem;font-weight:800;color:white;flex-shrink:0">${sw.nama.charAt(0)}</div>
                  <div><div style="font-size:1.1rem;font-weight:800">${sw.nama}</div><span class="badge badge-navy">${sw.nama_kelas}</span></div>
                </div>
                <div style="display:grid;grid-template-columns:110px 1fr;gap:0.6rem;font-size:0.85rem">
                  <span style="color:var(--text-muted);font-weight:600">NISN</span><span style="font-weight:600;font-family:monospace">${sw.nisn}</span>
                  <span style="color:var(--text-muted);font-weight:600">Kelas</span><span>${sw.nama_kelas}</span>
                  <span style="color:var(--text-muted);font-weight:600">Status</span><span><span class="badge badge-green">Aktif</span></span>
                </div>
              </div>
            </div>
            <div class="card">
              <div class="card-header"><div class="card-title"><i class="bi bi-info-circle me-2" style="color:var(--gold)"></i>Cara Menggunakan QR Code</div></div>
              <div class="card-body" style="display:flex;flex-direction:column;gap:0.875rem">
                ${[['1','Tampilkan QR Code ini','Tunjukkan ke guru piket saat terlambat'],['2','Guru scan QR Code','Guru piket memindai untuk mencatat keterlambatan'],['3','Cek riwayat aplikasi','Pantau riwayat di menu Riwayat']].map(([n,t,d])=>`
                <div style="display:flex;align-items:flex-start;gap:0.875rem">
                  <div style="width:26px;height:26px;background:var(--navy-50);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:800;color:var(--navy-700);flex-shrink:0">${n}</div>
                  <div><div style="font-size:0.85rem;font-weight:600">${t}</div><div style="font-size:0.78rem;color:var(--text-muted)">${d}</div></div>
                </div>`).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`);

  // Generate QR
  if (typeof QRCode !== 'undefined') {
    new QRCode(document.getElementById('qrcode'), { text: qr, width: 180, height: 180, correctLevel: QRCode.CorrectLevel.M });
  } else {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    script.onload = () => new QRCode(document.getElementById('qrcode'), { text: qr, width: 180, height: 180 });
    document.head.appendChild(script);
  }
});

// ============================================================
// PAGE: SISWA PERIZINAN
// ============================================================
Router.register('siswa-perizinan', () => {
  const s = requireRole('siswa'); if(!s) return;
  mount(`<div class="app-layout">
    ${sidebarSiswa()}
    <div class="main">
      <div class="topbar"><div class="topbar-title">E-Permission</div></div>
      <div class="page-content">
        <div class="row">
          <div class="col-lg-5">
            <div class="card mb-3">
              <div class="card-header"><div class="card-title"><i class="bi bi-send me-2" style="color:var(--accent)"></i>Ajukan Izin</div></div>
              <div class="card-body">
                <div id="msgIzin" class="alert d-none mb-3"></div>
                <form id="fIzin">
                  <div class="form-group"><label class="form-label">Tanggal</label>
                    <input type="date" name="tanggal" class="form-control" value="${today()}" required></div>
                  <div class="form-group"><label class="form-label">Jenis Izin</label>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem">
                      <label class="jopt" style="display:flex;align-items:center;gap:8px;padding:0.75rem;border:1.5px solid var(--accent);border-radius:var(--radius-sm);cursor:pointer;font-size:0.84rem;font-weight:600;background:var(--navy-50)">
                        <input type="radio" name="jenis" value="keluar_sekolah" checked style="display:none"><i class="bi bi-door-open" style="color:var(--accent)"></i>Keluar Sekolah</label>
                      <label class="jopt" style="display:flex;align-items:center;gap:8px;padding:0.75rem;border:1.5px solid var(--border-md);border-radius:var(--radius-sm);cursor:pointer;font-size:0.84rem;font-weight:600">
                        <input type="radio" name="jenis" value="pulang_awal" style="display:none"><i class="bi bi-house-door" style="color:var(--gold)"></i>Pulang Awal</label>
                    </div>
                  </div>
                  <div class="form-group"><label class="form-label">Alasan <span style="color:var(--danger)">*</span></label>
                    <textarea name="alasan" class="form-control" rows="4" placeholder="Jelaskan alasan izin secara lengkap..." required></textarea></div>
                  <button type="submit" class="btn btn-primary w-100" style="padding:0.65rem"><i class="bi bi-send me-1"></i>Kirim Pengajuan</button>
                </form>
              </div>
            </div>
          </div>
          <div class="col-lg-7">
            <div class="card">
              <div class="card-header"><div class="card-title"><i class="bi bi-list-check me-2" style="color:var(--accent)"></i>Status Pengajuan</div></div>
              <div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>Jenis</th><th>Alasan</th><th>Status</th></tr></thead>
              <tbody id="tblIzin"></tbody></table></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`);

  // Jenis radio styling
  document.querySelectorAll('.jopt').forEach(lbl => {
    lbl.querySelector('input').onchange = () => {
      document.querySelectorAll('.jopt').forEach(l => {
        const inp = l.querySelector('input');
        const isKeluar = inp.value === 'keluar_sekolah';
        l.style.borderColor = inp.checked ? (isKeluar?'var(--accent)':'var(--gold)') : 'var(--border-md)';
        l.style.background  = inp.checked ? (isKeluar?'var(--navy-50)':'#fffbeb') : 'white';
      });
    };
    lbl.onclick = () => { lbl.querySelector('input').checked = true; lbl.querySelector('input').dispatchEvent(new Event('change')); };
  });

  function renderTbl() {
    const list = DB.get('perizinan').filter(p=>p.id_siswa===s.id_siswa).sort((a,b)=>b.tanggal?.localeCompare(a.tanggal));
    document.getElementById('tblIzin').innerHTML = list.length ? list.map(p=>`<tr>
      <td>${p.tanggal}</td>
      <td><span class="badge ${p.jenis==='keluar_sekolah'?'badge-blue':'badge-navy'}">${p.jenis==='keluar_sekolah'?'Keluar':'Pulang Awal'}</span></td>
      <td style="max-width:180px;font-size:0.82rem;color:var(--text-secondary)">${(p.alasan||'').substring(0,40)}...</td>
      <td>${statusBadge(p.status)}</td></tr>`).join('') : '<tr><td colspan="4"><div class="empty-state"><i class="bi bi-file-earmark"></i><p>Belum ada</p></div></td></tr>';
  }
  renderTbl();

  document.getElementById('fIzin').onsubmit = function(e) {
    e.preventDefault();
    const jenis = this.querySelector('[name=jenis]:checked')?.value;
    if (!jenis) return;
    DB.get('perizinan').push({ id: DB.nextId('perizinan'), id_siswa: s.id_siswa, tanggal: this.tanggal.value, jenis, alasan: this.alasan.value, status: 'pending', waktu_pengajuan: new Date().toISOString(), id_guru_validasi: null, waktu_validasi: null });
    DB.set('perizinan', DB.get('perizinan'));
    this.alasan.value = '';
    const m = document.getElementById('msgIzin');
    m.textContent = 'Pengajuan berhasil! Tunggu persetujuan guru piket.';
    m.className = 'alert alert-success'; m.classList.remove('d-none');
    setTimeout(() => m.classList.add('d-none'), 4000);
    renderTbl();
  };
});

// ============================================================
// PAGE: SISWA RIWAYAT
// ============================================================
Router.register('siswa-riwayat', () => {
  const s = requireRole('siswa'); if(!s) return;
  const list = DB.get('keterlambatan').filter(t=>t.id_siswa===s.id_siswa).sort((a,b)=>b.tanggal?.localeCompare(a.tanggal));
  const bulanIni = list.filter(t=>t.tanggal?.startsWith(dateNow())).length;
  mount(`<div class="app-layout">
    ${sidebarSiswa()}
    <div class="main">
      <div class="topbar"><div class="topbar-title">Riwayat Kedisiplinan</div></div>
      <div class="page-content">
        <div class="stat-grid mb-4">
          <div class="stat-card"><div class="stat-icon amber"><i class="bi bi-clock-history"></i></div><div><div class="stat-label">Total Keterlambatan</div><div class="stat-value">${list.length}</div></div></div>
          <div class="stat-card"><div class="stat-icon blue"><i class="bi bi-calendar-month"></i></div><div><div class="stat-label">Bulan Ini</div><div class="stat-value">${bulanIni}</div></div></div>
          <div class="stat-card"><div class="stat-icon green"><i class="bi bi-shield-check"></i></div><div><div class="stat-label">Status</div><div style="font-size:1rem;font-weight:700;margin-top:4px;color:var(--text-primary)">${list.length===0?'🎉 Sempurna!':bulanIni===0?'Bulan ini bersih':'Perlu perhatian'}</div></div></div>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title"><i class="bi bi-clock-history me-2" style="color:var(--accent)"></i>Rekap Keterlambatan</div></div>
          <div class="table-wrap"><table><thead><tr><th>No</th><th>Tanggal</th><th>Waktu Tiba</th><th>Alasan</th></tr></thead>
          <tbody>${list.length ? list.map((t,i)=>`<tr>
            <td style="color:var(--text-muted)">${i+1}</td>
            <td><strong>${t.tanggal}</strong></td>
            <td><span class="badge badge-amber">${(t.waktu||'').slice(0,5)}</span></td>
            <td style="color:var(--text-secondary)">${t.alasan||'—'}</td></tr>`).join('') : '<tr><td colspan="4"><div class="empty-state"><i class="bi bi-check2-circle"></i><p>Tidak ada riwayat. Pertahankan!</p></div></td></tr>'}
          </tbody></table></div>
        </div>
      </div>
    </div>
  </div>`);
});

// 404
Router.register('404', () => {
  mount(`<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:1rem;color:var(--text-muted)">
    <i class="bi bi-compass" style="font-size:4rem;opacity:0.3"></i>
    <h2 style="font-size:1.5rem;font-weight:800;color:var(--text-primary)">Halaman tidak ditemukan</h2>
    <button class="btn btn-primary" onclick="goto('login')">Kembali ke Login</button>
  </div>`);
});

// ---- INIT ----
initData();
Router.init();
