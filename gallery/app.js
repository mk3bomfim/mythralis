// ============================================================
//  GaleriaVault - Digital Fortress Edition
// ============================================================

let myGlobe = null;
let currentMapMode = 'satellite';
let showStatesActive = true;
let showCitiesActive = true;
let stateBordersGeoJSON = null;

// Brazil capitals and major cities array
const majorCities = [
  { name: 'São Paulo', lat: -23.5505, lng: -46.6333 },
  { name: 'Rio de Janeiro', lat: -22.9068, lng: -43.1729 },
  { name: 'Brasília', lat: -15.7801, lng: -47.9292 },
  { name: 'Belo Horizonte', lat: -19.9191, lng: -43.9378 },
  { name: 'Salvador', lat: -12.9714, lng: -38.5014 },
  { name: 'Fortaleza', lat: -3.7319, lng: -38.5267 },
  { name: 'Recife', lat: -8.0542, lng: -34.8813 },
  { name: 'Porto Alegre', lat: -30.0346, lng: -51.2177 },
  { name: 'Curitiba', lat: -25.4284, lng: -49.2733 },
  { name: 'Manaus', lat: -3.1190, lng: -60.0217 },
  { name: 'Belém', lat: -1.4558, lng: -48.4902 },
  { name: 'Goiânia', lat: -16.6869, lng: -49.2648 },
  { name: 'São Luís', lat: -2.5307, lng: -44.3068 },
  { name: 'Maceió', lat: -9.6658, lng: -35.7350 },
  { name: 'Natal', lat: -5.7945, lng: -35.2110 },
  { name: 'Teresina', lat: -5.0919, lng: -42.8034 },
  { name: 'João Pessoa', lat: -7.1195, lng: -34.8450 },
  { name: 'Aracaju', lat: -10.9472, lng: -37.0731 },
  { name: 'Cuiabá', lat: -15.6010, lng: -56.0974 },
  { name: 'Campo Grande', lat: -20.4697, lng: -54.6201 },
  { name: 'Palmas', lat: -10.2128, lng: -48.3603 },
  { name: 'Porto Velho', lat: -8.7612, lng: -63.9039 },
  { name: 'Boa Vista', lat: 2.8235, lng: -60.6758 },
  { name: 'Macapá', lat: 0.0347, lng: -51.0694 },
  { name: 'Rio Branco', lat: -9.9754, lng: -67.8106 },
  { name: 'Vitória', lat: -20.3155, lng: -40.3128 },
  { name: 'Florianópolis', lat: -27.5954, lng: -48.5480 }
];

// ---- IndexedDB ----
let db;
const DB_NAME = 'galeriavault_v3';
const DB_VERSION = 2;

let useInMemoryDB = false;
const memoryDB = {
  users: [],
  invites: [],
  people: [],
  media: []
};

function openDB() {
  return new Promise((resolve) => {
    if (useInMemoryDB) { resolve(null); return; }
    if (db) { resolve(db); return; }

    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const d = e.target.result;

        // Users store
        if (!d.objectStoreNames.contains('users')) {
          const us = d.createObjectStore('users', { keyPath: 'id' });
          us.createIndex('username', 'username', { unique: true });
        }

        // Invites store
        if (!d.objectStoreNames.contains('invites')) {
          d.createObjectStore('invites', { keyPath: 'code' });
        }

        // People store with userId index
        if (!d.objectStoreNames.contains('people')) {
          const ps = d.createObjectStore('people', { keyPath: 'id' });
          ps.createIndex('userId', 'userId', { unique: false });
        }

        if (!d.objectStoreNames.contains('media')) {
          const ms = d.createObjectStore('media', { keyPath: 'id' });
          ms.createIndex('personId', 'personId', { unique: false });
        }
      };
      req.onsuccess = e => { db = e.target.result; resolve(db); };
      req.onerror = e => {
        console.warn("IndexedDB open failed (possibly blocked by Tracking Prevention). Falling back to In-Memory DB.", e);
        useInMemoryDB = true;
        resolve(null);
      };
    } catch (err) {
      console.warn("IndexedDB open threw error (blocked access). Falling back to In-Memory DB.", err);
      useInMemoryDB = true;
      resolve(null);
    }
  });
}

async function dbGetAll(store) {
  await openDB();
  if (useInMemoryDB) {
    return Promise.resolve(memoryDB[store] || []);
  }
  return new Promise((res) => {
    try {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = e => res(e.target.result);
      req.onerror = () => {
        console.warn(`dbGetAll failed for ${store}, falling back to memory`);
        res(memoryDB[store] || []);
      };
    } catch (err) {
      res(memoryDB[store] || []);
    }
  });
}

async function dbPut(store, obj) {
  await openDB();

  if (memoryDB[store]) {
    const idx = memoryDB[store].findIndex(x => x.id === obj.id || (store === 'invites' && x.code === obj.code));
    if (idx !== -1) {
      memoryDB[store][idx] = obj;
    } else {
      memoryDB[store].push(obj);
    }
  }

  if (useInMemoryDB) {
    return Promise.resolve();
  }

  return new Promise((res) => {
    try {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(obj);
      tx.oncomplete = res;
      tx.onerror = () => {
        console.warn(`dbPut failed for ${store}, saved to memory mirror only`);
        res();
      };
    } catch (err) {
      res();
    }
  });
}

async function dbDelete(store, id) {
  await openDB();

  if (memoryDB[store]) {
    memoryDB[store] = memoryDB[store].filter(x => x.id !== id && (store !== 'invites' || x.code !== id));
  }

  if (useInMemoryDB) {
    return Promise.resolve();
  }

  return new Promise((res) => {
    try {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).delete(id);
      tx.oncomplete = res;
      tx.onerror = () => {
        console.warn(`dbDelete failed for ${store}, removed from memory mirror`);
        res();
      };
    } catch (err) {
      res();
    }
  });
}

async function dbGetByIndex(store, idx, val) {
  await openDB();
  if (useInMemoryDB) {
    const items = memoryDB[store] || [];
    if (idx === 'userId') return Promise.resolve(items.filter(x => x.userId === val));
    if (idx === 'personId') return Promise.resolve(items.filter(x => x.personId === val));
    if (idx === 'username') return Promise.resolve(items.filter(x => x.username === val));
    return Promise.resolve([]);
  }
  return new Promise((res) => {
    try {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).index(idx).getAll(val);
      req.onsuccess = e => res(e.target.result);
      req.onerror = () => {
        const items = memoryDB[store] || [];
        if (idx === 'userId') res(items.filter(x => x.userId === val));
        else if (idx === 'personId') res(items.filter(x => x.personId === val));
        else if (idx === 'username') res(items.filter(x => x.username === val));
        else res([]);
      };
    } catch (err) {
      const items = memoryDB[store] || [];
      if (idx === 'userId') res(items.filter(x => x.userId === val));
      else if (idx === 'personId') res(items.filter(x => x.personId === val));
      else if (idx === 'username') res(items.filter(x => x.username === val));
      else res([]);
    }
  });
}

// ---- State ----
let currentUser = null; // logged in user
let people = [];
let currentPerson = null;
let personMedia = [];
let lbItems = [];
let lbIndex = 0;
let editingId = null;

// ---- DOM ----
const loginScreen = document.getElementById('login-screen');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const passInput = document.getElementById('password-input');
const appEl = document.getElementById('app');
const logoutBtn = document.getElementById('logout-btn');
const themeToggle = document.getElementById('theme-toggle');
const sysTag = document.getElementById('sys-tag');
const searchInput = document.getElementById('search-input');
const peopleList = document.getElementById('people-list');
const btnNewPerson = document.getElementById('btn-new-person');

const homeView = document.getElementById('home-view');
const personView = document.getElementById('person-view');
const dashboardHomeView = document.getElementById('dashboard-home-view');
const btnNavHome = document.getElementById('btn-nav-home');
const btnNavGlobe = document.getElementById('btn-nav-globe');
const btnNavNeural = document.getElementById('btn-nav-neural');
const neuralNetworkView = document.getElementById('neural-network-view');
const statCountTargets = document.getElementById('stat-count-targets');
const statCountMedia = document.getElementById('stat-count-media');
const logsContainer = document.getElementById('logs-container');
const dossieAvatarContainer = document.getElementById('dossie-avatar-container');

const dossieNum = document.getElementById('dossie-num');
const dossieName = document.getElementById('dossie-name');
const dossieNick = document.getElementById('dossie-nick');
const dossieDataGrid = document.getElementById('dossie-data-grid');
const dossieObsWrap = document.getElementById('dossie-obs-wrap');
const btnEditPerson = document.getElementById('btn-edit-person');
const btnDelPerson = document.getElementById('btn-delete-person');
const btnExportTxt = document.getElementById('btn-export-txt');
const btnExportZip = document.getElementById('btn-export-zip');
const btnExportPdf = document.getElementById('btn-export-pdf');
const btnExportAllZip = document.getElementById('btn-export-all-zip');
const btnImportCsv = document.getElementById('btn-import-csv');
const csvFileInput = document.getElementById('csv-file-input');

const photoInput = document.getElementById('photo-input');
const videoInput = document.getElementById('video-input');
const photoGrid = document.getElementById('photo-grid');
const videoGrid = document.getElementById('video-grid');
const photoCount = document.getElementById('photo-count');
const videoCount = document.getElementById('video-count');
const photoEmpty = document.getElementById('photo-empty');
const videoEmpty = document.getElementById('video-empty');

const personModal = document.getElementById('person-modal');
const personModalOverlay = document.getElementById('person-modal-overlay');
const modalTitle = document.getElementById('modal-title');
const fFullname = document.getElementById('f-fullname');
const fNick = document.getElementById('f-nick');
const fCpf = document.getElementById('f-cpf');
const fRg = document.getElementById('f-rg');
const fNascimento = document.getElementById('f-nascimento');
const fSexo = document.getElementById('f-sexo');
const fMae = document.getElementById('f-mae');
const fPai = document.getElementById('f-pai');
const fTelefone = document.getElementById('f-telefone');
const fTelefone2 = document.getElementById('f-telefone2');
const fEmail = document.getElementById('f-email');
const fSocial = document.getElementById('f-social');
const fRua = document.getElementById('f-rua');
const fBairro = document.getElementById('f-bairro');
const fCep = document.getElementById('f-cep');
const fCidade = document.getElementById('f-cidade');
const fEstado = document.getElementById('f-estado');
const fPais   = document.getElementById('f-pais');
const fPlaca = document.getElementById('f-placa');
const fVeiculo = document.getElementById('f-veiculo');
const fObs = document.getElementById('f-obs');
const btnPersonSave = document.getElementById('person-modal-save');
const btnPersonCancel = document.getElementById('person-modal-cancel');

const lightbox = document.getElementById('lightbox');
const lbOverlay = document.getElementById('lb-overlay');
const lbClose = document.getElementById('lb-close');
const lbPrev = document.getElementById('lb-prev');
const lbNext = document.getElementById('lb-next');
const lbMediaWrap = document.getElementById('lb-media-wrap');
const lbTitle = document.getElementById('lb-title');
const lbMeta = document.getElementById('lb-meta');
const lbDelete = document.getElementById('lb-delete');

const surveillanceCoords = document.getElementById('surveillance-coords');
const surveillanceMapFrame = document.getElementById('surveillance-map-frame');
const btnToggleMapSat = document.getElementById('btn-toggle-map-sat');
const btnToggleMapStreet = document.getElementById('btn-toggle-map-street');
const btnShowOnGlobe = document.getElementById('btn-show-on-globe');
const btnDeepZoomFullscreen = document.getElementById('btn-deep-zoom-fullscreen');
const btnToggleStates = document.getElementById('btn-toggle-states');
const btnToggleCities = document.getElementById('btn-toggle-cities');


const satelliteModal = document.getElementById('satellite-modal');
const satelliteModalOverlay = document.getElementById('satellite-modal-overlay');
const btnCloseSatellite = document.getElementById('btn-close-satellite');
const satHudCoords = document.getElementById('sat-hud-coords');
const satHudTargetName = document.getElementById('sat-hud-target-name');
const satelliteFullscreenIframeContainer = document.getElementById('satellite-fullscreen-iframe-container');

// ============================================================
//  THEME TOGGLE
// ============================================================
const themeToggleLogin = document.getElementById('theme-toggle-login');
const themeTogglesModal = document.querySelectorAll('.theme-toggle-modal');

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);

  // Update all theme toggles
  const icon = theme === 'dark' ? '\u2600' : '\u263E';
  themeToggle.textContent = icon;
  themeToggleLogin.textContent = icon;
  themeTogglesModal.forEach(btn => btn.textContent = icon);

  sysTag.textContent = theme === 'dark' ? 'DARK' : 'LIGHT';
  const logoTag = document.querySelector('.logo-tag');
  if (logoTag) logoTag.textContent = `SYSTEM: ${theme === 'dark' ? 'DARK' : 'LIGHT'}`;
  safeSetItem('gv_theme', theme);

  if (myGlobe) {
    updateGlobeTheme();
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

themeToggle.addEventListener('click', toggleTheme);
themeToggleLogin.addEventListener('click', toggleTheme);
themeTogglesModal.forEach(btn => btn.addEventListener('click', toggleTheme));

// load saved theme
const savedTheme = safeGetItem('gv_theme') || 'dark';
applyTheme(savedTheme);

// Auto-mask CPF, RG, phone, CEP
function maskInput(el, fn) { el.addEventListener('input', () => { el.value = fn(el.value); }); }
maskInput(fCpf, v => v.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2').slice(0, 14));
maskInput(fRg, v => v.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1})$/, '$1-$2').slice(0, 12));
maskInput(fTelefone, v => v.replace(/\D/g, '').replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').slice(0, 15));
maskInput(fTelefone2, v => v.replace(/\D/g, '').replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').slice(0, 15));
maskInput(fCep, v => v.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2').slice(0, 9));
maskInput(fNascimento, v => v.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1/$2').replace(/(\d{2})(\d)/, '$1/$2').slice(0, 10));
maskInput(fPlaca, v => v.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/([A-Z]{3})(\d)/, '$1-$2').slice(0, 8));

// ============================================================
//  LOGIN & AUTH
// ============================================================
const loginUsername = document.getElementById('login-username');
const loginPassword = document.getElementById('login-password');
const regInvite = document.getElementById('reg-invite');
const regUsername = document.getElementById('reg-username');
const regPassword = document.getElementById('reg-password');
const registerForm = document.getElementById('register-form');
const registerError = document.getElementById('register-error');
const showRegister = document.getElementById('show-register');
const showLogin = document.getElementById('show-login');
const registerBack = document.getElementById('register-back');
const userBadge = document.getElementById('user-badge');
const btnAdminPanel = document.getElementById('btn-admin-panel');

// Toggle login/register
showRegister.addEventListener('click', () => {
  loginForm.classList.add('hidden');
  document.querySelector('.auth-switch').classList.add('hidden');
  registerForm.classList.remove('hidden');
  registerBack.classList.remove('hidden');
});

showLogin.addEventListener('click', () => {
  registerForm.classList.add('hidden');
  registerBack.classList.add('hidden');
  loginForm.classList.remove('hidden');
  document.querySelector('.auth-switch').classList.remove('hidden');
});

// Login
loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  const result = await login(loginUsername.value.trim(), loginPassword.value);

  if (result.success) {
    // Animate login screen out
    loginScreen.classList.add('fade-out');
    setTimeout(() => {
      loginScreen.classList.add('hidden');
      loginScreen.classList.remove('fade-out');
      appEl.classList.remove('hidden');
      updateUserBadge();
      applyRolePermissions();
      loadPeople().then(() => {
        updateDashboardStats();
        addSystemLog(`SYS.AUTH: USER "${currentUser.username.toUpperCase()}" ACCESS GRANTED`);
        addSystemLog('MYTHRALIS SYSTEM TELEMETRY ONLINE');
      });
    }, 450);
  } else {
    loginError.textContent = result.error;
    loginError.classList.remove('hidden');
    loginPassword.value = '';
    setTimeout(() => loginError.classList.add('hidden'), 3000);
  }
});

// Register
registerForm.addEventListener('submit', async e => {
  e.preventDefault();
  const result = await registerWithInvite(
    regInvite.value.trim().toUpperCase(),
    regUsername.value.trim(),
    regPassword.value
  );

  if (result.success) {
    registerError.classList.add('hidden');
    alert('ACCOUNT CREATED SUCCESSFULLY');
    showLogin.click();
    loginUsername.value = result.user.username;
  } else {
    registerError.textContent = result.error;
    registerError.classList.remove('hidden');
  }
});

// Logout
logoutBtn.addEventListener('click', () => {
  logout();
  appEl.classList.add('hidden');
  loginScreen.classList.remove('fade-out');
  loginScreen.classList.remove('hidden');
  loginUsername.value = '';
  loginPassword.value = '';
  currentPerson = null;
  destroyGlobe();
});

// User badge
function updateUserBadge() {
  if (!currentUser) return;
  userBadge.textContent = `USER: ${currentUser.username.toUpperCase()} // ROLE: ${currentUser.role.toUpperCase()}`;

  if (currentUser.role === 'admin') {
    btnAdminPanel.classList.remove('hidden');
  } else {
    btnAdminPanel.classList.add('hidden');
  }
}

// ---- Role-based UI permissions ----
function applyRolePermissions() {
  const admin = isAdmin();

  // Sidebar: NEW FOLDER, NEW TARGET and IMPORT CSV buttons
  const btnNewFolderEl = document.getElementById('btn-new-folder');
  if (btnNewFolderEl) btnNewFolderEl.style.display = admin ? '' : 'none';
  btnNewPerson.style.display = admin ? '' : 'none';
  btnImportCsv.style.display = admin ? '' : 'none';

  // Dossie actions: EDIT, DELETE buttons
  btnEditPerson.style.display = admin ? '' : 'none';
  btnDelPerson.style.display = admin ? '' : 'none';

  // Media: ADD buttons
  document.querySelectorAll('.btn-add-media').forEach(el => {
    el.style.display = admin ? '' : 'none';
  });

  // Lightbox: DELETE FILE button
  if (lbDelete) lbDelete.style.display = admin ? '' : 'none';
}

// Auto-login on page load
(async function () {
  await initAccounts();
  if (autoLogin()) {
    loginScreen.classList.add('hidden');
    appEl.classList.remove('hidden');
    updateUserBadge();
    applyRolePermissions();
    await loadPeople();
    updateDashboardStats();
    addSystemLog(`SYS.AUTH: SESSION RESTORED FOR USER "${currentUser.username.toUpperCase()}"`);
    addSystemLog('MYTHRALIS SYSTEM TELEMETRY ONLINE');
  }
})();

// ============================================================
//  LOAD PEOPLE
// ============================================================
async function loadPeople() {
  let allPeople = [];
  try {
    const res = await fetch('/api/people');
    if (res.ok) allPeople = await res.json();
  } catch (err) {
    console.warn("Server load failed, falling back to local:", err);
    allPeople = await dbGetAll('people');
  }

  people = allPeople;

  // Geocode targets that do not have coordinates yet (migration)
  for (let p of people) {
    if (p.lat === undefined || p.lng === undefined) {
      try {
        const coords = await geocodeTargetAddress(p);
        p.lat = coords.lat;
        p.lng = coords.lng;
        await dbPut('people', p);

        // Also save to server
        await fetch('/api/people', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(p)
        });
      } catch (err) {
        console.warn("Migration geocoding failed for target:", p.fullname, err);
      }
    }
  }

  people.sort((a, b) => a.fullname.localeCompare(b.fullname));
  renderPeopleList();

  if (myGlobe) {
    updateGlobeData();
  }
}

// ============================================================
//  SIDEBAR LIST
// ============================================================
searchInput.addEventListener('input', renderPeopleList);

function renderPeopleList() {
  const q = searchInput.value.toLowerCase().trim();
  const filtered = people.filter(p => {
    // If target is censored, we can only search it by redacted name unless we search classified term, or just support basic search
    return p.fullname.toLowerCase().includes(q) ||
      (p.nick && p.nick.toLowerCase().includes(q)) ||
      (p.cpf && p.cpf.includes(q)) ||
      (p.rg && p.rg.includes(q)) ||
      (p.telefone && p.telefone.includes(q)) ||
      (p.placa && p.placa.toLowerCase().includes(q)) ||
      (p.cidade && p.cidade.toLowerCase().includes(q)) ||
      (p.email && p.email.toLowerCase().includes(q));
  });

  peopleList.innerHTML = '';

  if (filtered.length === 0) {
    peopleList.innerHTML = '<div style="padding:14px 16px;font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)">// NO TARGETS FOUND</div>';
    return;
  }

  filtered.forEach((p, i) => {
    const item = document.createElement('div');
    item.className = 'person-item' + (currentPerson && currentPerson.id === p.id ? ' active' : '');
    item.dataset.id = p.id;

    const num = String(i + 1).padStart(2, '0');
    const nick = p.nick ? `@ ${p.nick}` : (p.cidade || '');

    const censored = typeof isTargetCensored === 'function' && isTargetCensored(p);
    const nameHtml = censored ? `<span class="redacted-bar">CLASSIFIED DATA</span>` : escHtml(p.fullname);
    const nickHtml = censored ? `<span class="redacted-bar">REDACTED</span>` : escHtml(nick);

    item.innerHTML = `
      <span class="pi-num">${num} //</span>
      <div class="pi-info">
        <div class="pi-name">${nameHtml}</div>
        ${nick ? `<div class="pi-nick">${nickHtml}</div>` : ''}
      </div>`;

    item.addEventListener('click', () => selectPerson(p.id));
    peopleList.appendChild(item);
  });
}

// ============================================================
//  SELECT PERSON
// ============================================================
async function selectPerson(id) {
  currentPerson = people.find(p => p.id === id);
  if (!currentPerson) return;

  document.querySelectorAll('.person-item').forEach(el =>
    el.classList.toggle('active', el.dataset.id === id)
  );

  btnNavHome.classList.remove('active');
  btnNavGlobe.classList.remove('active');
  if (btnNavNeural) btnNavNeural.classList.remove('active');

  dashboardHomeView.classList.add('hidden');
  homeView.classList.add('hidden');
  personView.classList.remove('hidden');
  if (neuralNetworkView) neuralNetworkView.classList.add('hidden');
  destroyGlobe();
  stopNeuralAnimation();

  const idx = people.indexOf(currentPerson);
  dossieNum.textContent = `TARGET // ${String(idx + 1).padStart(2, '0')}`;

  renderDossieHeader(currentPerson);

  try {
    const res = await fetch(`/api/media?personId=${id}`);
    if (res.ok) {
      personMedia = await res.json();
    } else {
      personMedia = await dbGetByIndex('media', 'personId', id);
    }
  } catch (err) {
    console.warn("Server media load failed, fallback to local:", err);
    personMedia = await dbGetByIndex('media', 'personId', id);
  }
  renderBlocos();

  // Load geo-surveillance iframe
  if (currentPerson.lat !== undefined && currentPerson.lng !== undefined) {
    if (surveillanceCoords) {
      surveillanceCoords.textContent = `// COORDS: ${currentPerson.lat.toFixed(6)}, ${currentPerson.lng.toFixed(6)}`;
    }
    currentMapMode = 'satellite';
    loadMapIframe(currentPerson.lat, currentPerson.lng, 'satellite');
    if (btnToggleMapSat) btnToggleMapSat.classList.add('active');
    if (btnToggleMapStreet) btnToggleMapStreet.classList.remove('active');
  } else {
    if (surveillanceCoords) {
      surveillanceCoords.textContent = '// COORDS: DATA UNAVAILABLE';
    }
    if (surveillanceMapFrame) {
      surveillanceMapFrame.innerHTML = '<div class="globe-loading">// GEOLOCATION PENDING</div>';
    }
  }
}

function renderDossieHeader(p) {
  const censored = typeof isTargetCensored === 'function' && isTargetCensored(p);

  if (censored) {
    dossieName.innerHTML = '<span class="redacted-bar" style="font-size:1.8rem;">CLASSIFIED DOSSIER</span>';
    dossieNick.innerHTML = '<span class="redacted-bar">REDACTED</span>';
  } else {
    dossieName.textContent = p.fullname.toUpperCase();
    dossieNick.textContent = p.nick ? `@ ${p.nick.toUpperCase()}` : '';
  }

  // Show/Hide Lock Banner
  const lockBanner = document.getElementById('dossie-lock-banner');
  if (lockBanner) {
    if (censored) {
      lockBanner.classList.remove('hidden');
    } else {
      lockBanner.classList.add('hidden');
    }
  }

  // Calculate stable threat level percentage based on name hash code
  let hash = 0;
  for (let i = 0; i < p.fullname.length; i++) {
    hash = p.fullname.charCodeAt(i) + ((hash << 5) - hash);
  }
  const threatPct = Math.abs(hash % 71) + 20; // 20% to 90%
  const threatLevel = threatPct > 70 ? 'HIGH // IMMEDIATE CAPTURE' : (threatPct > 45 ? 'MODERATE // ACTIVE SURVEILLANCE' : 'LOW // STANDBY');

  // Groups of fields
  const sections = [
    {
      title: '// SECURE INTEL METRICS',
      fields: [
        { label: 'THREAT LEVEL', value: `${threatPct}% [ ${threatLevel} ]` },
        { label: 'SURVEILLANCE NODE', value: 'PRIMARY TACTICAL LINK // OK' },
        { label: 'DOSSIER SUPERVISOR', value: currentUser ? currentUser.username.toUpperCase() : 'SYS.ROOT' },
        { label: 'DATA SYNC STATUS', value: p.lat !== undefined ? 'REAL-TIME GEOLOCATED' : 'GEOLOCATION PENDING' }
      ]
    },
    {
      title: '// IDENTIFICATION',
      fields: [
        { label: 'FULL NAME', value: p.fullname },
        { label: 'NICK', value: p.nick },
        { label: 'CPF', value: p.cpf },
        { label: 'RG', value: p.rg },
        { label: 'DATE OF BIRTH', value: p.nascimento },
        { label: 'GENDER', value: p.sexo },
        { label: "MOTHER'S NAME", value: p.mae },
        { label: "FATHER'S NAME", value: p.pai },
      ]
    },
    {
      title: '// CONTACT',
      fields: [
        { label: 'PHONE', value: p.telefone },
        { label: 'PHONE 2', value: p.telefone2 },
        { label: 'EMAIL', value: p.email },
        { label: 'SOCIAL MEDIA', value: p.social },
      ]
    },
    {
      title: '// LOCATION',
      fields: [
        { label: 'STREET', value: p.rua },
        { label: 'NEIGHBORHOOD', value: p.bairro },
        { label: 'CEP', value: p.cep },
        { label: 'CITY', value: p.cidade },
        { label: 'STATE', value: p.estado },
        { label: 'COUNTRY', value: p.pais },
      ]
    },
    {
      title: '// VEHICLE',
      fields: [
        { label: 'LICENSE PLATE', value: p.placa },
        { label: 'VEHICLE', value: p.veiculo },
      ]
    },
  ];

  let html = '';
  sections.forEach((sec, sIdx) => {
    const active = sec.fields.filter(f => f.value);
    if (active.length === 0) return;
    html += `<div class="dossie-section-title">${sec.title}</div>`;
    html += `<div class="dossie-data-grid">`;
    active.forEach(f => {
      let valueHtml = '';
      if (censored && sIdx > 0) { // Censor all sections except secure intel metrics
        valueHtml = `<span class="redacted-bar">CLASSIFIED INFORMATION</span>`;
      } else {
        valueHtml = escHtml(f.value.toString().toUpperCase());
      }

      html += `
        <div class="dossie-data-item">
          <div class="di-label">${f.label}</div>
          <div class="di-value">${valueHtml}</div>
        </div>`;
    });
    html += `</div>`;
  });

  dossieDataGrid.innerHTML = html;

  if (censored) {
    dossieObsWrap.innerHTML = `<div class="dossie-obs">// NOTE: <span class="redacted-bar">CLASSIFIED INFORMATION REDACTED UNDER PROTOCOL 4-A</span></div>`;
  } else {
    dossieObsWrap.innerHTML = p.obs ? `<div class="dossie-obs">// NOTE: ${escHtml(p.obs)}</div>` : '';
  }
}

// ============================================================
//  RENDER BLOCOS
// ============================================================
function renderBlocos() {
  const photos = personMedia.filter(m => m.type === 'photo');
  const videos = personMedia.filter(m => m.type === 'video');

  // Update target dossier avatar
  if (photos.length > 0) {
    dossieAvatarContainer.innerHTML = `<img src="${photos[0].src}" alt="${escHtml(currentPerson.fullname)}" class="dossie-avatar-thumb" />`;
  } else {
    dossieAvatarContainer.innerHTML = `
      <div class="radar-scan-line"></div>
      <div class="avatar-wireframe"></div>
    `;
  }

  photoCount.textContent = photos.length;
  videoCount.textContent = videos.length;

  photoGrid.innerHTML = '';
  if (photos.length === 0) {
    photoEmpty.classList.remove('hidden');
  } else {
    photoEmpty.classList.add('hidden');
    photos.forEach((m, idx) => {
      const el = buildThumb(m);
      el.addEventListener('click', () => openLightbox(photos, idx));
      photoGrid.appendChild(el);
    });
  }

  videoGrid.innerHTML = '';
  if (videos.length === 0) {
    videoEmpty.classList.remove('hidden');
  } else {
    videoEmpty.classList.add('hidden');
    videos.forEach((m, idx) => {
      const el = buildThumb(m);
      el.addEventListener('click', () => openLightbox(videos, idx));
      videoGrid.appendChild(el);
    });
  }
}

function buildThumb(m) {
  const el = document.createElement('div');
  el.className = 'media-thumb';
  if (m.type === 'video') {
    el.innerHTML = `
      <video muted preload="metadata" style="pointer-events:none">
        <source src="${m.src}" type="${getMime(m.name)}" />
      </video>
      <span class="media-vid-badge">â -- ¶ VID</span>`;
  } else {
    el.innerHTML = `<img src="${m.src}" alt="${escHtml(m.name)}" loading="lazy" />`;
  }
  return el;
}

// ============================================================
//  ADD MEDIA
// ============================================================
photoInput.addEventListener('change', () => handleMedia(photoInput, 'photo'));
videoInput.addEventListener('change', () => handleMedia(videoInput, 'video'));

async function handleMedia(input, type) {
  if (!currentPerson) return;
  if (!isAdmin()) { alert('ACCESS DENIED  -  ADMIN ONLY'); input.value = ''; return; }
  const files = Array.from(input.files);

  for (const file of files) {
    let src = await readAsDataURL(file);
    let finalName = file.name;

    // Convert .mov to WebM (Edge doesn't support MOV natively)
    if (file.name.toLowerCase().endsWith('.mov')) {
      const overlay = showProcessing(`CONVERTING ${file.name}...`);
      try {
        const converted = await convertMovToMp4(file);
        if (converted) {
          src = converted.dataURL;
          finalName = file.name.replace(/\.mov$/i, '.webm');
        }
      } catch (err) {
        console.warn('MOV conversion failed, storing original:', err);
      } finally {
        overlay.remove();
      }
    }

    const m = {
      id: crypto.randomUUID(),
      personId: currentPerson.id,
      name: finalName,
      type,
      src,
      size: src.length, // use encoded size
      date: new Date().toISOString()
    };

    try {
      const res = await fetch('/api/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(m)
      });
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.media) {
          m.src = result.media.src;
        }
      }
    } catch (err) {
      console.error("Server media save failed:", err);
    }

    personMedia.push(m);
    await dbPut('media', m);
    addSystemLog(`MEDIA: UPLOADED ${type.toUpperCase()} "${finalName.toUpperCase()}" FOR TARGET "${currentPerson.fullname.toUpperCase()}"`);
  }
  input.value = '';
  renderBlocos();
  updateDashboardStats();
}

function showProcessing(text) {
  const overlay = document.createElement('div');
  overlay.className = 'export-overlay';
  overlay.innerHTML = `
    <div class="export-box">
      <h3>// PROCESSING</h3>
      <div class="export-label" style="margin-top:12px">${escHtml(text)}</div>
    </div>`;
  document.body.appendChild(overlay);
  return overlay;
}

function readAsDataURL(file) {
  return new Promise(resolve => {
    const r = new FileReader();
    r.onload = e => resolve(e.target.result);
    r.readAsDataURL(file);
  });
}

// ============================================================
//  MOV â†’ MP4 CONVERTER (canvas + MediaRecorder)
// ============================================================
function convertMovToMp4(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const url = URL.createObjectURL(file);
    video.src = url;

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load MOV file'));
    };

    video.onloadedmetadata = async () => {
      try {
        // Play to decode first frame
        await video.play();
        video.pause();

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');

        const chunks = [];
        const stream = canvas.captureStream(30); // 30 fps
        const options = { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 2500000 };

        // Fallback to vp8 if vp9 not supported
        const recorder = MediaRecorder.isTypeSupported(options.mimeType) ? new MediaRecorder(stream, options) : new MediaRecorder(stream, { mimeType: 'video/webm' });

        recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          const reader = new FileReader();
          reader.onloadend = () => {
            URL.revokeObjectURL(url);
            resolve({ dataURL: reader.result, blob });
          };
          reader.readAsDataURL(blob);
        };

        recorder.start();
        video.currentTime = 0;
        video.loop = false; // prevent loop
        await video.play();

        const draw = () => {
          if (video.paused || video.ended) {
            recorder.stop();
            return;
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          requestAnimationFrame(draw);
        };
        draw();

        video.onended = () => {
          video.pause();
          recorder.stop();
        };
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
  });
}

// ============================================================
//  PERSON MODAL
// ============================================================
btnNewPerson.addEventListener('click', () => {
  if (!isAdmin()) return;
  openPersonModal(null);
});
btnEditPerson.addEventListener('click', () => {
  if (!isAdmin()) return;
  openPersonModal(currentPerson);
});

function openPersonModal(person) {
  editingId = person ? person.id : null;
  modalTitle.textContent = person ? 'EDIT TARGET' : 'NEW TARGET';
  fFullname.value = person?.fullname || '';
  fNick.value = person?.nick || '';
  fCpf.value = person?.cpf || '';
  fRg.value = person?.rg || '';
  fNascimento.value = person?.nascimento || '';
  fSexo.value = person?.sexo || '';
  fMae.value = person?.mae || '';
  fPai.value = person?.pai || '';
  fTelefone.value = person?.telefone || '';
  fTelefone2.value = person?.telefone2 || '';
  fEmail.value = person?.email || '';
  fSocial.value = person?.social || '';
  fRua.value = person?.rua || '';
  fBairro.value = person?.bairro || '';
  fCep.value = person?.cep || '';
  fCidade.value = person?.cidade || '';
  fEstado.value = person?.estado || '';
  fPais.value = person?.pais || '';
  fPlaca.value = person?.placa || '';
  fVeiculo.value = person?.veiculo || '';
  fObs.value = person?.obs || '';
  personModal.classList.remove('hidden');
  fFullname.focus();
}

function closePersonModal() { personModal.classList.add('hidden'); }
btnPersonCancel.addEventListener('click', closePersonModal);
personModalOverlay.addEventListener('click', closePersonModal);

btnPersonSave.addEventListener('click', async () => {
  if (!isAdmin()) { alert('ACCESS DENIED  -  ADMIN ONLY'); return; }
  const fullname = fFullname.value.trim();
  if (!fullname) { fFullname.focus(); fFullname.style.outline = '2px solid var(--fg)'; setTimeout(() => fFullname.style.outline = '', 1000); return; }

  const obj = {
    id: editingId || crypto.randomUUID(),
    userId: editingId ? (people.find(p => p.id === editingId)?.userId || currentUser.id) : currentUser.id,
    fullname,
    nick: fNick.value.trim(),
    cpf: fCpf.value.trim(),
    rg: fRg.value.trim(),
    nascimento: fNascimento.value.trim(),
    sexo: fSexo.value.trim(),
    mae: fMae.value.trim(),
    pai: fPai.value.trim(),
    telefone: fTelefone.value.trim(),
    telefone2: fTelefone2.value.trim(),
    email: fEmail.value.trim(),
    social: fSocial.value.trim(),
    rua: fRua.value.trim(),
    bairro: fBairro.value.trim(),
    cep: fCep.value.trim(),
    cidade: fCidade.value.trim(),
    estado: fEstado.value.trim().toUpperCase(),
    pais: fPais.value.trim(),
    placa: fPlaca.value.trim(),
    veiculo: fVeiculo.value.trim(),
    obs: fObs.value.trim(),
    created: editingId ? (people.find(p => p.id === editingId)?.created || new Date().toISOString()) : new Date().toISOString()
  };

  // Geocode address details of target
  const coords = await geocodeTargetAddress(obj);
  obj.lat = coords.lat;
  obj.lng = coords.lng;

  try {
    await fetch('/api/people', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(obj)
    });
  } catch (err) {
    console.error("Server save failed:", err);
  }

  await dbPut('people', obj);

  if (editingId) {
    const i = people.findIndex(p => p.id === editingId);
    if (i !== -1) people[i] = obj;
    addSystemLog(`DATABASE: TARGET "${fullname.toUpperCase()}" DETAILS UPDATED`);
  } else {
    people.push(obj);
    addSystemLog(`DATABASE: NEW TARGET "${fullname.toUpperCase()}" REGISTERED`);
  }
  people.sort((a, b) => a.fullname.localeCompare(b.fullname));
  updateDashboardStats();
  closePersonModal();
  renderPeopleList();

  if (editingId && currentPerson?.id === editingId) {
    currentPerson = obj;
    const idx = people.indexOf(obj);
    dossieNum.textContent = `TARGET // ${String(idx + 1).padStart(2, '0')}`;
    renderDossieHeader(obj);
  } else if (!editingId) {
    selectPerson(obj.id);
  }
});

// ============================================================
//  DELETE PERSON
// ============================================================
btnDelPerson.addEventListener('click', async () => {
  if (!isAdmin()) return;
  if (!currentPerson) return;
  if (!confirm(`DELETE TARGET "${currentPerson.fullname.toUpperCase()}" AND ALL ASSOCIATED MEDIA - \n\nTHIS CANNOT BE UNDONE.`)) return;

  try {
    await fetch(`/api/people?id=${currentPerson.id}`, { method: 'DELETE' });
  } catch (err) {
    console.error("Server delete failed:", err);
  }

  const media = await dbGetByIndex('media', 'personId', currentPerson.id);
  for (const m of media) await dbDelete('media', m.id);
  await dbDelete('people', currentPerson.id);
  const targetName = currentPerson.fullname.toUpperCase();
  people = people.filter(p => p.id !== currentPerson.id);
  currentPerson = null; personMedia = [];
  renderPeopleList();
  personView.classList.add('hidden');
  homeView.classList.remove('hidden');
  addSystemLog(`DATABASE: TARGET "${targetName}" AND ASSOCIATED MEDIA PURGED`);
  updateDashboardStats();
});

// ============================================================
//  LIGHTBOX
// ============================================================
function openLightbox(items, idx) {
  lbItems = items; lbIndex = idx;
  lightbox.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  showLbItem();
}

function showLbItem() {
  const m = lbItems[lbIndex];
  if (!m) return;
  lbTitle.textContent = m.name.toUpperCase();
  lbMeta.textContent = `${formatSize(m.size)} // ${formatDate(m.date)}`;
  lbMediaWrap.innerHTML = '';
  if (m.type === 'video') {
    const vid = document.createElement('video');
    vid.controls = true;
    vid.autoplay = true;
    const src = document.createElement('source');
    src.src = m.src;
    src.type = getMime(m.name);
    vid.appendChild(src);
    // fallback: try without explicit type
    vid.onerror = () => { src.removeAttribute('type'); vid.load(); };
    lbMediaWrap.appendChild(vid);
  } else {
    const img = document.createElement('img');
    img.src = m.src; img.alt = m.name;
    lbMediaWrap.appendChild(img);
  }
  lbPrev.style.opacity = lbIndex === 0 ? '0.25' : '1';
  lbNext.style.opacity = lbIndex === lbItems.length - 1 ? '0.25' : '1';
}

lbClose.addEventListener('click', closeLightbox);
lbOverlay.addEventListener('click', closeLightbox);
lbPrev.addEventListener('click', () => { if (lbIndex > 0) { lbIndex--; showLbItem(); } });
lbNext.addEventListener('click', () => { if (lbIndex < lbItems.length - 1) { lbIndex++; showLbItem(); } });

document.addEventListener('keydown', e => {
  if (lightbox.classList.contains('hidden')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') { if (lbIndex > 0) { lbIndex--; showLbItem(); } }
  if (e.key === 'ArrowRight') { if (lbIndex < lbItems.length - 1) { lbIndex++; showLbItem(); } }
});

function closeLightbox() {
  const vid = lbMediaWrap.querySelector('video');
  if (vid) { vid.pause(); vid.src = ''; }
  lightbox.classList.add('hidden');
  document.body.style.overflow = '';
}

lbDelete.addEventListener('click', async () => {
  if (!isAdmin()) return;
  const m = lbItems[lbIndex];
  if (!m || !confirm(`DELETE FILE "${m.name.toUpperCase()}" - `)) return;

  try {
    await fetch(`/api/media?id=${m.id}`, { method: 'DELETE' });
  } catch (err) {
    console.error("Server media delete failed:", err);
  }

  await dbDelete('media', m.id);
  personMedia = personMedia.filter(x => x.id !== m.id);
  lbItems = lbItems.filter(x => x.id !== m.id);
  addSystemLog(`MEDIA: FILE "${m.name.toUpperCase()}" DELETED FOR TARGET "${currentPerson.fullname.toUpperCase()}"`);
  updateDashboardStats();
  closeLightbox();
  renderBlocos();
});

// ============================================================
//  HELPERS
// ============================================================
function getMime(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const map = {
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'mkv': 'video/x-matroska',
    'ogg': 'video/ogg',
    'm4v': 'video/x-m4v',
  };
  return map[ext] || 'video/mp4';
}
function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function formatSize(b) {
  if (!b) return '';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
  return (b / 1073741824).toFixed(2) + ' GB';
}
function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
}

// ============================================================
//  EXPORT  -  TXT
// ============================================================
function buildTxt(person, mediaList) {
  const line = '='.repeat(60);
  const sep = '-'.repeat(60);
  const field = (label, value) => value ? `  ${label.padEnd(18)}: ${value}\n` : '';

  const photos = mediaList.filter(m => m.type === 'photo');
  const videos = mediaList.filter(m => m.type === 'video');

  let txt = '';
  txt += `${line}\n`;
  txt += `  MYTHRALIS INTELLIGENCE NETWORK\n`;
  txt += `  TARGET DOSSIER\n`;
  txt += `  Generated: ${new Date().toLocaleString('pt-BR')}\n`;
  txt += `${line}\n\n`;

  txt += `[ IDENTIFICATION ]\n${sep}\n`;
  txt += field('FULL NAME', person.fullname);
  txt += field('NICK / ALIAS', person.nick);
  txt += field('CPF', person.cpf);
  txt += field('RG', person.rg);
  txt += field('DATE OF BIRTH', person.nascimento);
  txt += field('GENDER', person.sexo);
  txt += field("MOTHER'S NAME", person.mae);
  txt += field("FATHER'S NAME", person.pai);
  txt += '\n';

  txt += `[ CONTACT ]\n${sep}\n`;
  txt += field('PHONE', person.telefone);
  txt += field('PHONE 2', person.telefone2);
  txt += field('EMAIL', person.email);
  txt += field('SOCIAL MEDIA', person.social);
  txt += '\n';

  txt += `[ LOCATION ]\n${sep}\n`;
  txt += field('STREET', person.rua);
  txt += field('NEIGHBORHOOD', person.bairro);
  txt += field('CEP', person.cep);
  txt += field('CITY', person.cidade);
  txt += field('STATE', person.estado);
  txt += field('COUNTRY', person.pais);
  txt += '\n';

  txt += `[ VEHICLE ]\n${sep}\n`;
  txt += field('LICENSE PLATE', person.placa);
  txt += field('VEHICLE', person.veiculo);
  txt += '\n';

  if (person.obs) {
    txt += `[ NOTES ]\n${sep}\n`;
    txt += `  ${person.obs}\n\n`;
  }

  txt += `[ MEDIA FILES ]\n${sep}\n`;
  txt += `  Photos : ${photos.length}\n`;
  txt += `  Videos : ${videos.length}\n`;
  if (photos.length) {
    txt += `\n  PHOTOS:\n`;
    photos.forEach((m, i) => txt += `    ${String(i + 1).padStart(2, '0')}. ${m.name}  (${formatSize(m.size)}  -  ${formatDate(m.date)})\n`);
  }
  if (videos.length) {
    txt += `\n  VIDEOS:\n`;
    videos.forEach((m, i) => txt += `    ${String(i + 1).padStart(2, '0')}. ${m.name}  (${formatSize(m.size)}  -  ${formatDate(m.date)})\n`);
  }
  txt += `\n${line}\n`;
  txt += `  END OF DOSSIER\n`;
  txt += `${line}\n`;

  return txt;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}

// Export single TXT
btnExportTxt.addEventListener('click', async () => {
  if (!currentPerson) return;
  const media = await dbGetByIndex('media', 'personId', currentPerson.id);
  const txt = buildTxt(currentPerson, media);
  const slug = currentPerson.fullname.replace(/\s+/g, '_').toUpperCase();
  downloadBlob(new Blob([txt], { type: 'text/plain;charset=utf-8' }), `${slug}_DOSSIER.txt`);
});

// ============================================================
//  EXPORT — PDF REPORT (single person)
// ============================================================
btnExportPdf.addEventListener('click', async () => {
  if (!currentPerson) return;
  try {
    await generatePersonPDF(currentPerson);
    addSystemLog(`PDF: GENERATED DOSSIER REPORT FOR "${currentPerson.fullname.toUpperCase()}"`);
  } catch (err) {
    console.error("PDF generation failed:", err);
    alert("FAILED TO GENERATE PDF REPORT: " + err.message);
  }
});

async function generatePersonPDF(person) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Get all media for the person
  const mediaList = await dbGetByIndex('media', 'personId', person.id);
  const photos = mediaList.filter(m => m.type === 'photo');
  const videos = mediaList.filter(m => m.type === 'video');

  doc.setFont('Courier');

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  const bgColor = isDark ? '#080a0c' : '#ffffff';
  const textColor = isDark ? '#ffffff' : '#111111';
  const accentColor = isDark ? '#cccccc' : '#555555';

  const pageW = 210;
  const pageH = 297;
  const margin = 15;
  const contentW = pageW - (margin * 2);

  // Background
  doc.setFillColor(bgColor);
  doc.rect(0, 0, pageW, pageH, 'F');

  // Border
  doc.setDrawColor(accentColor);
  doc.setLineWidth(0.5);
  doc.rect(margin - 2, margin - 2, contentW + 4, pageH - (margin * 2) + 4);

  let y = margin + 5;

  // Header
  doc.setFontSize(14);
  doc.setFont('Courier', 'bold');
  doc.setTextColor(accentColor);
  doc.text('MYTHRALIS INTELLIGENCE NETWORK // TARGET DOSSIER', margin, y);

  y += 5;
  doc.setFontSize(8);
  doc.setFont('Courier', 'normal');
  doc.setTextColor(isDark ? '#888888' : '#666666');
  doc.text(`SYSTEM STATUS: ACTIVE // ACCESS LEVEL: OVERLORD // GENERATED: ${new Date().toLocaleString('pt-BR')}`, margin, y);

  y += 4;
  doc.setDrawColor(accentColor);
  doc.setLineWidth(0.8);
  doc.line(margin, y, margin + contentW, y);

  y += 8;

  // Avatar Photo Box
  let photoWidth = 40;
  let photoHeight = 45;
  let photoX = margin + contentW - photoWidth;
  let photoY = y;

  doc.setDrawColor(isDark ? '#333333' : '#cccccc');
  doc.setLineWidth(0.3);
  doc.rect(photoX, photoY, photoWidth, photoHeight);

  if (photos.length > 0) {
    try {
      const imgData = photos[0].src;
      let format = 'JPEG';
      if (imgData.includes('image/png')) format = 'PNG';
      else if (imgData.includes('image/gif')) format = 'GIF';
      else if (imgData.includes('image/webp')) format = 'WEBP';

      doc.addImage(imgData, format, photoX + 1, photoY + 1, photoWidth - 2, photoHeight - 2);
    } catch (e) {
      console.error("Failed to add image to PDF:", e);
      doc.line(photoX, photoY, photoX + photoWidth, photoY + photoHeight);
      doc.line(photoX + photoWidth, photoY, photoX, photoY + photoHeight);
      doc.setFontSize(8);
      doc.setTextColor(isDark ? '#ffffff' : '#000000');
      doc.text('IMAGE LOAD ERROR', photoX + 5, photoY + photoHeight / 2);
    }
  } else {
    doc.line(photoX, photoY, photoX + photoWidth, photoY + photoHeight);
    doc.line(photoX + photoWidth, photoY, photoX, photoY + photoHeight);
    doc.setFontSize(8);
    doc.setTextColor(textColor);
    doc.text('NO PHOTO', photoX + 12, photoY + photoHeight / 2);
  }

  // Info
  const idX = margin;
  let idY = y;

  doc.setFontSize(11);
  doc.setFont('Courier', 'bold');
  doc.setTextColor(accentColor);
  doc.text(`[ SECTION 01 // IDENTIFICATION ]`, idX, idY);

  idY += 6;
  doc.setFontSize(9);
  doc.setFont('Courier', 'normal');
  doc.setTextColor(textColor);

  const drawField = (label, val, x, currY) => {
    doc.setFont('Courier', 'bold');
    doc.setTextColor(accentColor);
    doc.text(`${label}:`, x, currY);
    doc.setFont('Courier', 'normal');
    doc.setTextColor(textColor);
    const textVal = val ? String(val).toUpperCase() : 'N/A';
    doc.text(textVal, x + 35, currY);
    return currY + 5.5;
  };

  idY = drawField('FULL NAME', person.fullname, idX, idY);
  idY = drawField('ALIAS / NICK', person.nick, idX, idY);
  idY = drawField('CPF', person.cpf, idX, idY);
  idY = drawField('RG', person.rg, idX, idY);
  idY = drawField('BIRTHDATE', person.nascimento, idX, idY);
  idY = drawField('GENDER', person.sexo, idX, idY);
  idY = drawField('MOTHER', person.mae, idX, idY);

  y = Math.max(idY, photoY + photoHeight) + 6;

  // Section 2: Contact
  doc.setFontSize(11);
  doc.setFont('Courier', 'bold');
  doc.setTextColor(accentColor);
  doc.text(`[ SECTION 02 // CONTACT & SOCIALS ]`, margin, y);

  y += 6;
  let col1X = margin;
  let col2X = margin + (contentW / 2);

  let yContactL = y;
  let yContactR = y;

  yContactL = drawField('PRIMARY PHONE', person.telefone, col1X, yContactL);
  yContactL = drawField('ALT PHONE', person.telefone2, col1X, yContactL);

  yContactR = drawField('EMAIL ADDR', person.email, col2X, yContactR);
  yContactR = drawField('SOCIAL NET', person.social, col2X, yContactR);

  y = Math.max(yContactL, yContactR) + 4;

  // Section 3: Location
  doc.setFontSize(11);
  doc.setFont('Courier', 'bold');
  doc.setTextColor(accentColor);
  doc.text(`[ SECTION 03 // LOCATION & ADDRESS ]`, margin, y);

  y += 6;
  let yLocL = y;
  let yLocR = y;

  yLocL = drawField('STREET', person.rua, col1X, yLocL);
  yLocL = drawField('NEIGHBORHOOD', person.bairro, col1X, yLocL);
  yLocL = drawField('ZIP / CEP', person.cep, col1X, yLocL);

  yLocR = drawField('CITY', person.cidade, col2X, yLocR);
  yLocR = drawField('STATE', person.estado, col2X, yLocR);
  yLocR = drawField('COUNTRY', person.pais, col2X, yLocR);

  y = Math.max(yLocL, yLocR) + 4;

  // Section 4: Vehicle & Logistics
  doc.setFontSize(11);
  doc.setFont('Courier', 'bold');
  doc.setTextColor(accentColor);
  doc.text(`[ SECTION 04 // VEHICLES & LOGISTICS ]`, margin, y);

  y += 6;
  let yVehL = y;
  let yVehR = y;

  yVehL = drawField('LICENSE PLATE', person.placa, col1X, yVehL);
  yVehR = drawField('VEHICLE TYPE', person.veiculo, col2X, yVehR);

  y = Math.max(yVehL, yVehR) + 4;

  // Section 5: Observations
  doc.setFontSize(11);
  doc.setFont('Courier', 'bold');
  doc.setTextColor(accentColor);
  doc.text(`[ SECTION 05 // FIELD OBSERVATIONS & NOTES ]`, margin, y);

  y += 6;
  doc.setFontSize(9);
  doc.setFont('Courier', 'normal');
  doc.setTextColor(textColor);

  const obsText = person.obs ? person.obs : 'NO FIELD NOTES REGISTERED.';
  const splitNotes = doc.splitTextToSize(obsText, contentW);
  doc.text(splitNotes, margin, y);
  y += (splitNotes.length * 4.5) + 8;

  // Section 6: Media inventory
  if (y > pageH - 45) {
    doc.addPage();
    doc.setFillColor(bgColor);
    doc.rect(0, 0, pageW, pageH, 'F');
    doc.setDrawColor(accentColor);
    doc.setLineWidth(0.5);
    doc.rect(margin - 2, margin - 2, contentW + 4, pageH - (margin * 2) + 4);
    y = margin + 10;
  }

  doc.setFontSize(11);
  doc.setFont('Courier', 'bold');
  doc.setTextColor(accentColor);
  doc.text(`[ SECTION 06 // MEDIA INVENTORY ]`, margin, y);

  y += 6;
  doc.setFontSize(9);
  doc.setFont('Courier', 'normal');
  doc.setTextColor(textColor);

  doc.text(`TOTAL PHOTOS DETECTED: ${photos.length}`, margin, y);
  y += 4.5;
  doc.text(`TOTAL VIDEOS DETECTED: ${videos.length}`, margin, y);
  y += 8;

  // Extra Photos
  const extraPhotos = photos.slice(1, 5);
  if (extraPhotos.length > 0) {
    doc.setFontSize(10);
    doc.setFont('Courier', 'bold');
    doc.setTextColor(accentColor);
    doc.text(`// ATTACHED SURVEILLANCE IMAGES:`, margin, y);
    y += 6;

    let thumbW = 38;
    let thumbH = 30;
    let gap = 5;
    let currentX = margin;

    if (y + thumbH > pageH - 25) {
      doc.addPage();
      doc.setFillColor(bgColor);
      doc.rect(0, 0, pageW, pageH, 'F');
      doc.setDrawColor(accentColor);
      doc.setLineWidth(0.5);
      doc.rect(margin - 2, margin - 2, contentW + 4, pageH - (margin * 2) + 4);
      y = margin + 10;
    }

    extraPhotos.forEach((ph, index) => {
      try {
        let phFormat = 'JPEG';
        if (ph.src.includes('image/png')) phFormat = 'PNG';
        else if (ph.src.includes('image/gif')) phFormat = 'GIF';
        else if (ph.src.includes('image/webp')) phFormat = 'WEBP';

        doc.setDrawColor(isDark ? '#333333' : '#cccccc');
        doc.setLineWidth(0.3);
        doc.rect(currentX, y, thumbW, thumbH);

        doc.addImage(ph.src, phFormat, currentX + 0.5, y + 0.5, thumbW - 1, thumbH - 1);

        doc.setFontSize(7);
        doc.setFont('Courier', 'normal');
        doc.setTextColor(isDark ? '#888888' : '#555555');
        doc.text(`IMG_${String(index + 2).padStart(2, '0')}`, currentX, y + thumbH + 3.5);
      } catch (err) {
        console.error("Failed to add extra photo to PDF:", err);
      }
      currentX += thumbW + gap;
    });
    y += thumbH + 8;
  }

  doc.setFontSize(8);
  doc.setFont('Courier', 'bold');
  doc.setTextColor(accentColor);
  doc.text(`// END OF MYTHRALIS DOSSIER // CLASSIFIED //`, margin, pageH - margin - 5);

  const slug = person.fullname.replace(/\s+/g, '_').toUpperCase();
  doc.save(`${slug}_DOSSIER_REPORT.pdf`);
}

// ============================================================
//  EXPORT  -  ZIP (single person)
// ============================================================
btnExportZip.addEventListener('click', async () => {
  if (!currentPerson) return;
  const media = await dbGetByIndex('media', 'personId', currentPerson.id);
  const slug = currentPerson.fullname.replace(/\s+/g, '_').toUpperCase();
  await buildAndDownloadZip([{ person: currentPerson, media }], `${slug}_DOSSIER.zip`);
});

// ============================================================
//  EXPORT  -  ZIP (all targets)
// ============================================================
btnExportAllZip.addEventListener('click', async () => {
  if (people.length === 0) { alert('NO TARGETS TO EXPORT.'); return; }
  const entries = [];
  for (const p of people) {
    const media = await dbGetByIndex('media', 'personId', p.id);
    entries.push({ person: p, media });
  }
  await buildAndDownloadZip(entries, `MYTHRALIS_ALL_TARGETS.zip`);
});

// ============================================================
//  ZIP BUILDER
// ============================================================
async function buildAndDownloadZip(entries, filename) {
  // Show progress overlay
  const overlay = document.createElement('div');
  overlay.className = 'export-overlay';
  overlay.innerHTML = `
    <div class="export-box">
      <h3>// BUILDING ARCHIVE</h3>
      <div class="export-bar-wrap"><div class="export-bar-fill" id="exp-bar"></div></div>
      <div class="export-label" id="exp-label">INITIALIZING...</div>
    </div>`;
  document.body.appendChild(overlay);

  const bar = document.getElementById('exp-bar');
  const label = document.getElementById('exp-label');

  const setProgress = (pct, text) => {
    bar.style.width = pct + '%';
    label.textContent = text;
  };

  try {
    const zip = new JSZip();

    // Count total media for progress
    const totalMedia = entries.reduce((s, e) => s + e.media.length, 0);
    let done = 0;

    for (const { person, media } of entries) {
      const slug = person.fullname.replace(/\s+/g, '_').toUpperCase();
      const folder = entries.length > 1 ? zip.folder(slug) : zip;

      // TXT dossier
      const txt = buildTxt(person, media);
      folder.file(`${slug}_DOSSIER.txt`, txt);

      // Media files
      const photos = media.filter(m => m.type === 'photo');
      const videos = media.filter(m => m.type === 'video');

      const photoFolder = photos.length ? folder.folder('PHOTOS') : null;
      const videoFolder = videos.length ? folder.folder('VIDEOS') : null;

      for (const m of media) {
        done++;
        setProgress(Math.round((done / (totalMedia || 1)) * 90), `PACKING: ${m.name}`);

        // dataURL â†’ base64
        const b64 = m.src.split(',')[1];
        const mime = m.src.split(';')[0].split(':')[1];
        const ext = m.name.split('.').pop() || (m.type === 'video' ? 'mp4' : 'jpg');
        const safe = m.name.replace(/[^a-zA-Z0-9._-]/g, '_');

        if (m.type === 'photo' && photoFolder) {
          photoFolder.file(safe, b64, { base64: true });
        } else if (m.type === 'video' && videoFolder) {
          videoFolder.file(safe, b64, { base64: true });
        }

        // yield to UI
        await new Promise(r => setTimeout(r, 0));
      }
    }

    setProgress(95, 'COMPRESSING...');
    await new Promise(r => setTimeout(r, 50));

    const blob = await zip.generateAsync(
      { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
      meta => setProgress(95 + Math.round(meta.percent * 0.05), `COMPRESSING... ${Math.round(meta.percent)}%`)
    );

    setProgress(100, 'DONE.');
    await new Promise(r => setTimeout(r, 400));

    downloadBlob(blob, filename);
  } catch (err) {
    console.error(err);
    label.textContent = 'ERROR: ' + err.message;
    await new Promise(r => setTimeout(r, 2000));
  } finally {
    overlay.remove();
  }
}

// ============================================================
//  IMPORT — CSV TARGETS
// ============================================================
btnImportCsv.addEventListener('click', () => {
  if (!isAdmin()) { alert('ACCESS DENIED — ADMIN ONLY'); return; }
  csvFileInput.click();
});

csvFileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (evt) => {
    const text = evt.target.result;
    try {
      await importCSVData(text);
    } catch (err) {
      console.error(err);
      alert("ERROR IMPORTING CSV: " + err.message);
    }
  };
  reader.readAsText(file, 'UTF-8');
  csvFileInput.value = ''; // Reset input
});

function parseCSV(text) {
  const lines = [];
  let row = [];
  let val = '';
  let inQuotes = false;

  const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const firstLine = cleanText.split('\n')[0];
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const delimiter = semiCount > commaCount ? ';' : ',';

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        val += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      row.push(val.trim());
      val = '';
    } else if (char === '\n' && !inQuotes) {
      row.push(val.trim());
      lines.push(row);
      row = [];
      val = '';
    } else {
      val += char;
    }
  }
  if (val || row.length > 0) {
    row.push(val.trim());
    lines.push(row);
  }
  return { lines, delimiter };
}

async function importCSVData(csvText) {
  const { lines } = parseCSV(csvText);
  if (lines.length < 2) {
    alert("INVALID CSV: Empty file or headers only.");
    return;
  }

  const rawHeaders = lines[0];
  const dataRows = lines.slice(1);

  const headerMap = {
    fullname: ['fullname', 'nome', 'name', 'nome completo', 'nome_completo'],
    nick: ['nick', 'apelido', 'alias', 'nickname'],
    cpf: ['cpf'],
    rg: ['rg'],
    nascimento: ['nascimento', 'data de nascimento', 'birthdate', 'nasc', 'data_nascimento', 'data'],
    sexo: ['sexo', 'genero', 'gender', 'sex', 'm/f'],
    mae: ['mae', 'nome da mae', 'mother', 'mãe', 'nome_mae'],
    pai: ['pai', 'nome do pai', 'father', 'pai', 'nome_pai'],
    telefone: ['telefone', 'fone', 'phone', 'celular', 'tel'],
    telefone2: ['telefone2', 'fone2', 'phone2', 'tel2'],
    email: ['email', 'e-mail'],
    social: ['social', 'redes sociais', 'instagram', 'facebook', 'rede_social'],
    rua: ['rua', 'logradouro', 'endereco', 'address', 'endereço'],
    bairro: ['bairro', 'neighborhood'],
    cep: ['cep', 'zipcode', 'zip'],
    cidade: ['cidade', 'city'],
    estado: ['estado', 'uf', 'state'],
    pais: ['pais', 'país', 'country'],
    placa: ['placa', 'license plate', 'plate'],
    veiculo: ['veiculo', 'vehicle', 'carro', 'car', 'veículo'],
    obs: ['obs', 'observações', 'notes', 'observacao', 'observações']
  };

  const colMapping = {};

  rawHeaders.forEach((header, index) => {
    const cleanHeader = header.toLowerCase().trim().replace(/["']/g, '');
    for (const [propKey, matchers] of Object.entries(headerMap)) {
      if (matchers.includes(cleanHeader)) {
        colMapping[propKey] = index;
        break;
      }
    }
  });

  if (colMapping.fullname === undefined) {
    const standardKeys = [
      'fullname', 'nick', 'cpf', 'rg', 'nascimento', 'sexo', 'mae', 'pai',
      'telefone', 'telefone2', 'email', 'social', 'rua', 'bairro', 'cep',
      'cidade', 'estado', 'pais', 'placa', 'veiculo', 'obs'
    ];
    standardKeys.forEach((key, index) => {
      if (index < rawHeaders.length) {
        colMapping[key] = index;
      }
    });
  }

  const overlay = document.createElement('div');
  overlay.className = 'export-overlay';
  overlay.innerHTML = `
    <div class="export-box">
      <h3>// IMPORTING CSV TARGETS</h3>
      <div class="export-bar-wrap"><div class="export-bar-fill" id="imp-bar" style="width:0%"></div></div>
      <div class="export-label" id="imp-label">READING DATA...</div>
    </div>`;
  document.body.appendChild(overlay);

  const bar = document.getElementById('imp-bar');
  const label = document.getElementById('imp-label');

  let importedCount = 0;
  const filteredRows = dataRows.filter(row => row.length > 0 && row.some(val => val.trim() !== ''));
  const totalRows = filteredRows.length;

  for (let i = 0; i < filteredRows.length; i++) {
    const row = filteredRows[i];

    const getValue = (propKey) => {
      const colIdx = colMapping[propKey];
      return colIdx !== undefined && row[colIdx] !== undefined ? row[colIdx].trim() : '';
    };

    const fullname = getValue('fullname') || `IMPORTED TARGET #${importedCount + 1}`;

    label.textContent = `GEOLOCATING & REGISTERING: ${fullname.toUpperCase()} (${importedCount + 1}/${totalRows})`;
    bar.style.width = `${((importedCount + 1) / totalRows) * 100}%`;

    const targetObj = {
      id: crypto.randomUUID(),
      userId: currentUser.id,
      fullname,
      nick: getValue('nick'),
      cpf: getValue('cpf'),
      rg: getValue('rg'),
      nascimento: getValue('nascimento'),
      sexo: getValue('sexo'),
      mae: getValue('mae'),
      pai: getValue('pai'),
      telefone: getValue('telefone'),
      telefone2: getValue('telefone2'),
      email: getValue('email'),
      social: getValue('social'),
      rua: getValue('rua'),
      bairro: getValue('bairro'),
      cep: getValue('cep'),
      cidade: getValue('cidade'),
      estado: getValue('estado').toUpperCase(),
      pais: getValue('pais'),
      placa: getValue('placa'),
      veiculo: getValue('veiculo'),
      obs: getValue('obs'),
      created: new Date().toISOString()
    };

    let coords = getFallbackCoords(targetObj);
    if (targetObj.rua || targetObj.cidade || targetObj.estado || targetObj.pais) {
      try {
        await new Promise(r => setTimeout(r, 150));
        coords = await geocodeTargetAddress(targetObj);
      } catch (err) {
        console.warn(`OSM failed for ${fullname}, using fallback:`, err);
      }
    }
    targetObj.lat = coords.lat;
    targetObj.lng = coords.lng;

    try {
      await fetch('/api/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(targetObj)
      });
    } catch (err) {
      console.error("Server save failed for imported target:", err);
    }

    await dbPut('people', targetObj);
    people.push(targetObj);
    addSystemLog(`DATABASE: IMPORTED TARGET "${fullname.toUpperCase()}" FROM CSV`);

    importedCount++;
  }

  overlay.remove();

  people.sort((a, b) => a.fullname.localeCompare(b.fullname));
  updateDashboardStats();
  renderPeopleList();

  alert(`SUCCESSFULLY IMPORTED ${importedCount} TARGETS FROM CSV.`);

  if (people.length > 0) {
    if (myGlobe) {
      initGlobe();
    }
  }
}

// ============================================================
//  ADMIN PANEL
// ============================================================
const adminModal = document.getElementById('admin-modal');
const adminOverlay = document.getElementById('admin-overlay');
const adminClose = document.getElementById('admin-close');
const btnGenerateInv = document.getElementById('btn-generate-invite');
const inviteDisplay = document.getElementById('invite-display');
const inviteCodeText = document.getElementById('invite-code-text');
const btnCopyInvite = document.getElementById('btn-copy-invite');
const invitesList = document.getElementById('invites-list');
const usersList = document.getElementById('users-list');

btnAdminPanel.addEventListener('click', openAdminPanel);
adminClose.addEventListener('click', () => adminModal.classList.add('hidden'));
adminOverlay.addEventListener('click', () => adminModal.classList.add('hidden'));

async function openAdminPanel() {
  if (!currentUser || currentUser.role !== 'admin') return;

  adminModal.classList.remove('hidden');
  inviteDisplay.classList.add('hidden');

  await refreshAdminLists();
}

btnGenerateInv.addEventListener('click', async () => {
  const result = await generateInvite();
  if (result.success) {
    inviteCodeText.textContent = result.code;
    inviteDisplay.classList.remove('hidden');
    await refreshAdminLists();
    addSystemLog(`ADMIN: SECURE INVITE CODE "${result.code}" GENERATED`);
  } else {
    alert(result.error);
  }
});

btnCopyInvite.addEventListener('click', () => {
  const code = inviteCodeText.textContent;
  navigator.clipboard.writeText(code).then(() => {
    const orig = btnCopyInvite.textContent;
    btnCopyInvite.textContent = 'COPIED!';
    setTimeout(() => btnCopyInvite.textContent = orig, 1500);
  });
});

async function refreshAdminLists() {
  // Invites
  const invites = await listInvites();
  const activeCount = invites.filter(i => !i.used).length;

  if (invites.length === 0) {
    invitesList.innerHTML = '<div class="admin-empty">// NO INVITES YET</div>';
  } else {
    invitesList.innerHTML = invites.map(inv => {
      const status = inv.used ? 'USED' : 'ACTIVE';
      const meta = inv.used ? (inv.revokedBy ? 'Revoked by admin' : `Used at ${new Date(inv.usedAt).toLocaleDateString('pt-BR')}`) : `Created ${new Date(inv.createdAt).toLocaleDateString('pt-BR')}`;

      const actions = inv.used ? `<button class="btn-bracket-sm btn-bracket-danger" onclick="deleteInviteFromPanel('${inv.code}')">DELETE</button>` : `<button class="btn-bracket-sm btn-bracket-danger" onclick="revokeInviteFromPanel('${inv.code}')">REVOKE</button>`;

      return `
        <div class="admin-list-item">
          <div class="admin-item-info">
            <div class="admin-item-title">${inv.code}</div>
            <div class="admin-item-meta">${meta}</div>
          </div>
          <span class="admin-item-status ${inv.used ? 'used' : 'active'}">${status}</span>
          ${actions}
        </div>`;
    }).join('');
  }

  // Update invite count in generate button
  btnGenerateInv.innerHTML = `GENERATE NEW INVITE <span style="opacity:.6">(${activeCount} active)</span>`;

  // Users
  const users = await listUsers();
  if (users.length === 0) {
    usersList.innerHTML = '<div class="admin-empty">// NO USERS</div>';
  } else {
    usersList.innerHTML = users.map(u => {
      const date = new Date(u.created).toLocaleDateString('pt-BR');
      const isSelf = u.id === currentUser.id;
      const canDelete = !isSelf;
      const roleToggle = !isSelf ? (u.role === 'admin' ? `<button class="btn-bracket-sm btn-bracket-warn" onclick="changeRoleFromPanel('${u.id}', 'user', '${escHtml(u.username)}')">DEMOTE</button>` : `<button class="btn-bracket-sm btn-bracket-promote" onclick="changeRoleFromPanel('${u.id}', 'admin', '${escHtml(u.username)}')">PROMOTE</button>`) : '<span class="admin-item-you">YOU</span>';
      return `
        <div class="admin-list-item">
          <div class="admin-item-info">
            <div class="admin-item-title">${escHtml(u.username)}</div>
            <div class="admin-item-meta">Created ${date}</div>
          </div>
          <span class="admin-item-status ${u.role}">${u.role.toUpperCase()}</span>
          ${roleToggle}
          ${canDelete ? `<button class="btn-bracket-sm btn-bracket-danger" onclick="deleteUserFromPanel('${u.id}', '${escHtml(u.username)}')">DELETE</button>` : ''}
        </div>`;
    }).join('');
  }
}

window.deleteUserFromPanel = async function (userId, username) {
  if (!confirm(`DELETE USER "${username}" AND ALL THEIR TARGETS - \n\nTHIS CANNOT BE UNDONE.`)) return;
  const result = await deleteUser(userId);
  if (result.success) {
    await refreshAdminLists();
    await loadPeople(); // refresh main list
    addSystemLog(`ADMIN: USER "${username.toUpperCase()}" AND ALL ASSOCIATED TARGETS DELETED`);
    updateDashboardStats();
  } else {
    alert(result.error);
  }
};

window.revokeInviteFromPanel = async function (code) {
  if (!confirm(`REVOKE INVITE CODE "${code}" - \n\nIt will no longer be usable.`)) return;
  const result = await revokeInvite(code);
  if (result.success) {
    await refreshAdminLists();
    addSystemLog(`ADMIN: INVITE CODE "${code}" REVOKED`);
  } else {
    alert(result.error);
  }
};

window.deleteInviteFromPanel = async function (code) {
  if (!confirm(`DELETE INVITE CODE "${code}" - `)) return;
  const result = await deleteInvite(code);
  if (result.success) {
    await refreshAdminLists();
    addSystemLog(`ADMIN: INVITE CODE "${code}" DELETED`);
  } else {
    alert(result.error);
  }
};

window.changeRoleFromPanel = async function (userId, newRole, username) {
  const action = newRole === 'admin' ? 'PROMOTE TO ADMIN' : 'DEMOTE TO USER';
  if (!confirm(`${action}: "${username}" - \n\nThis will change their permissions.`)) return;
  const result = await changeUserRole(userId, newRole);
  if (result.success) {
    await refreshAdminLists();
    await loadPeople();
    addSystemLog(`ADMIN: USER "${username.toUpperCase()}" ROLE CHANGED TO "${newRole.toUpperCase()}"`);
  } else {
    alert(result.error);
  }
};

// ============================================================
//  MATRIX TEXT EFFECT
// ============================================================
(function () {
  const el = document.getElementById('matrix-text');
  if (!el) return;

  const finalText = el.textContent;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*';
  const length = finalText.length;
  let frame = 0;
  const framesToReveal = 40; // total frames
  const revealPerFrame = Math.ceil(length / framesToReveal);

  let revealed = new Array(length).fill(false);
  let currentText = new Array(length).fill('');

  function scramble() {
    frame++;

    // Reveal characters progressively
    const toReveal = Math.min(frame * revealPerFrame, length);
    for (let i = 0; i < toReveal; i++) {
      if (!revealed[i] && Math.random() > 0.7) {
        revealed[i] = true;
        currentText[i] = finalText[i];
      }
    }

    // Scramble unrevealed
    for (let i = 0; i < length; i++) {
      if (!revealed[i]) {
        if (finalText[i] === ' ') {
          currentText[i] = ' ';
        } else {
          currentText[i] = chars[Math.floor(Math.random() * chars.length)];
        }
      }
    }

    el.textContent = currentText.join('');

    if (frame < framesToReveal || revealed.some(r => !r)) {
      setTimeout(scramble, 50);
    } else {
      el.textContent = finalText; // ensure final
    }
  }

  // Start after small delay
  setTimeout(scramble, 200);
})();

// ============================================================
//  SCHEMATIC CLOCK
// ============================================================
(function () {
  const schTime = document.getElementById('sch-time');
  if (!schTime) return;

  function updateClock() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    schTime.textContent = `${h}:${m}:${s}`;
  }

  updateClock();
  setInterval(updateClock, 1000);
})();

// ============================================================
//  GEO-SURVEILLANCE & 3D GLOBE SYSTEM
// ============================================================



// Geocoding function using OpenStreetMap Nominatim
async function geocodeTargetAddress(p) {
  if (!p.rua && !p.cidade && !p.estado) {
    return getFallbackCoords(p);
  }

  const queryParts = [];
  if (p.rua) queryParts.push(p.rua);
  if (p.bairro) queryParts.push(p.bairro);
  if (p.cidade) queryParts.push(p.cidade);
  if (p.estado) queryParts.push(p.estado);
  if (p.cep) queryParts.push(p.cep);
  queryParts.push(p.pais || 'Brasil');

  const query = queryParts.join(', ');

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon)
        };
      }
    }

    // Try simple query (City, State, Country)
    if (p.cidade || p.estado) {
      const simpleQuery = `${p.cidade || ''} ${p.estado || ''} ${p.pais || 'Brasil'}`.trim();
      const resSimple = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(simpleQuery)}`);
      if (resSimple.ok) {
        const dataSimple = await resSimple.json();
        if (dataSimple && dataSimple.length > 0) {
          const offsetLat = (Math.random() - 0.5) * 0.04;
          const offsetLng = (Math.random() - 0.5) * 0.04;
          return {
            lat: parseFloat(dataSimple[0].lat) + offsetLat,
            lng: parseFloat(dataSimple[0].lon) + offsetLng
          };
        }
      }
    }
  } catch (err) {
    console.warn("Nominatim Geocoding failed, using fallback:", err);
  }

  return getFallbackCoords(p);
}

function getFallbackCoords(p) {
  // BrasÃ­lia coordinates with a random spread across Brazil
  const offsetLat = (Math.random() - 0.5) * 8;
  const offsetLng = (Math.random() - 0.5) * 8;
  return {
    lat: -15.7801 + offsetLat,
    lng: -47.9292 + offsetLng
  };
}

function destroyGlobe() {
  if (!myGlobe) return;
  const container = document.getElementById('globe-container');
  if (container) {
    container.innerHTML = '';
  }

  try {
    const scene = myGlobe.scene();
    const renderer = myGlobe.renderer();

    if (scene) {
      scene.traverse(object => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(mat => mat.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
    }

    if (renderer) {
      renderer.dispose();
      const gl = renderer.getContext();
      if (gl) {
        const ext = gl.getExtension('WEBGL_lose_context');
        if (ext) ext.loseContext();
      }
    }
  } catch (err) {
    console.warn("Globe cleanup failed:", err);
  }

  myGlobe = null;
}

// Initialize the 3D Globe
function initGlobe() {
  const container = document.getElementById('globe-container');
  if (!container) return;
  if (myGlobe) {
    updateGlobeData();
    return;
  }

  container.innerHTML = `<div class="globe-loading">// INITIALIZING TACTICAL MAP ENVIRONMENT...</div>`;

  try {
    myGlobe = Globe()
      .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-dark.jpg')
      .backgroundImageUrl('')
      .backgroundColor('#000000')
      .showAtmosphere(true)
      .atmosphereColor('#ffffff')
      .htmlElementsData([])
      .htmlElement(d => {
        const el = document.createElement('div');
        el.className = 'globe-marker';
        el.innerHTML = `
          <div class="marker-ring"></div>
          <div class="marker-center"></div>
          <div class="marker-text">${escHtml(d.fullname.split(' ')[0])}</div>
        `;
        el.style.color = 'var(--globe-accent)';
        el.style.position = 'absolute';
        el.style.transform = 'translate(-50%, -50%)';

        el.title = `${d.fullname.toUpperCase()}${d.nick ? ` (${d.nick})` : ''} - ${d.cidade || ''}/${d.estado || ''}`;

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          myGlobe.controls().autoRotate = false;
          myGlobe.pointOfView({ lat: d.lat, lng: d.lng, altitude: 1.2 }, 1200);
          setTimeout(() => {
            selectPerson(d.id);
          }, 1300);
        });
        return el;
      })
      .polygonCapColor(() => 'rgba(255, 255, 255, 0.015)')
      .polygonStrokeColor(() => 'rgba(255, 255, 255, 0.35)')
      .polygonLabel(d => d.properties.nome || d.properties.name || '')
      .labelLat(d => d.lat)
      .labelLng(d => d.lng)
      .labelText(d => d.name)
      .labelSize(0.35)
      .labelDotRadius(0.12)
      .labelColor(() => 'rgba(255, 255, 255, 0.85)')
      .labelResolution(2);

    myGlobe(container);

    // Apply initial theme properties to globe elements
    updateGlobeTheme();

    // Auto rotate controls
    myGlobe.controls().autoRotate = true;
    myGlobe.controls().autoRotateSpeed = 0.4;
    myGlobe.controls().enableZoom = true;

    myGlobe.pointOfView({ lat: -15.78, lng: -47.93, altitude: 2.2 }, 0);

    updateGlobeData();
  } catch (err) {
    console.error("Globe.gl error:", err);
    container.innerHTML = `<div class="globe-loading" style="color:var(--muted)">// GEOLOCATION ERROR: SECURE 3D CONTEXT UNAVAILABLE</div>`;
  }
}

function updateGlobeData() {
  if (!myGlobe) return;
  const validData = people.filter(p => p.lat !== undefined && p.lng !== undefined);
  myGlobe.htmlElementsData(validData);
  updateGlobeBorders();
  updateGlobeCities();
}

function updateGlobeTheme() {
  if (!myGlobe) return;
  const theme = safeGetItem('gv_theme') || 'dark';
  const isDark = theme === 'dark';

  myGlobe
    .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-dark.jpg')
    .backgroundColor(isDark ? '#000000' : '#ffffff')
    .atmosphereColor(isDark ? '#ffffff' : '#000000')
    .polygonStrokeColor(() => isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.3)')
    .polygonCapColor(() => isDark ? 'rgba(255, 255, 255, 0.015)' : 'rgba(0, 0, 0, 0.015)')
    .labelColor(() => isDark ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.85)');
}

async function fetchStateBorders() {
  if (stateBordersGeoJSON) return stateBordersGeoJSON;
  try {
    const res = await fetch('https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson');
    if (res.ok) {
      stateBordersGeoJSON = await res.json();
      return stateBordersGeoJSON;
    }
  } catch (err) {
    console.warn("Failed to fetch state borders:", err);
  }
  return null;
}

async function updateGlobeBorders() {
  if (!myGlobe) return;
  if (showStatesActive) {
    if (!stateBordersGeoJSON) {
      await fetchStateBorders();
    }
    if (stateBordersGeoJSON && showStatesActive) {
      myGlobe.polygonsData(stateBordersGeoJSON.features);
    }
  } else {
    myGlobe.polygonsData([]);
  }
}

function updateGlobeCities() {
  if (!myGlobe) return;
  if (showCitiesActive) {
    myGlobe.labelsData(majorCities);
  } else {
    myGlobe.labelsData([]);
  }
}


// Helper to load Google Maps embed in the split pane
function loadMapIframe(lat, lng, mode) {
  if (!surveillanceMapFrame) return;
  const mapType = mode === 'satellite' ? 'h' : 'm';
  surveillanceMapFrame.classList.toggle('sat-mode', mode === 'satellite');
  surveillanceMapFrame.innerHTML = `
    <iframe src="https://maps.google.com/maps?q=${lat},${lng}&z=19&t=${mapType}&output=embed" allowfullscreen></iframe>
  `;
}

// Event Listeners for Map Pane actions
if (btnToggleMapSat) {
  btnToggleMapSat.addEventListener('click', () => {
    if (!currentPerson || currentPerson.lat === undefined) return;
    currentMapMode = 'satellite';
    loadMapIframe(currentPerson.lat, currentPerson.lng, 'satellite');
    btnToggleMapSat.classList.add('active');
    btnToggleMapStreet.classList.remove('active');
  });
}

if (btnToggleMapStreet) {
  btnToggleMapStreet.addEventListener('click', () => {
    if (!currentPerson || currentPerson.lat === undefined) return;
    currentMapMode = 'road';
    loadMapIframe(currentPerson.lat, currentPerson.lng, 'road');
    btnToggleMapStreet.classList.add('active');
    btnToggleMapSat.classList.remove('active');
  });
}

if (btnShowOnGlobe) {
  btnShowOnGlobe.addEventListener('click', () => {
    if (!currentPerson || currentPerson.lat === undefined) return;
    const targetLat = currentPerson.lat;
    const targetLng = currentPerson.lng;

    dashboardHomeView.classList.add('hidden');
    personView.classList.add('hidden');
    homeView.classList.remove('hidden');

    btnNavHome.classList.remove('active');
    btnNavGlobe.classList.add('active');

    document.querySelectorAll('.person-item').forEach(el => el.classList.remove('active'));
    currentPerson = null;

    initGlobe();
    if (myGlobe) {
      myGlobe.controls().autoRotate = false;
      myGlobe.pointOfView({ lat: targetLat, lng: targetLng, altitude: 1.2 }, 1200);
    }
  });
}

if (btnDeepZoomFullscreen) {
  btnDeepZoomFullscreen.addEventListener('click', () => {
    if (!currentPerson || currentPerson.lat === undefined) return;

    satelliteModal.classList.remove('hidden');
    satHudCoords.textContent = `COORDS: ${currentPerson.lat.toFixed(6)}, ${currentPerson.lng.toFixed(6)}`;
    satHudTargetName.textContent = currentPerson.fullname.toUpperCase();

    satelliteFullscreenIframeContainer.innerHTML = `
      <iframe src="https://maps.google.com/maps?q=${currentPerson.lat},${currentPerson.lng}&z=19&t=h&output=embed" allowfullscreen></iframe>
    `;
  });
}

// Fullscreen Modal close
function closeSatelliteModal() {
  satelliteModal.classList.add('hidden');
  satelliteFullscreenIframeContainer.innerHTML = '';
}

if (btnCloseSatellite) btnCloseSatellite.addEventListener('click', closeSatelliteModal);
if (satelliteModalOverlay) satelliteModalOverlay.addEventListener('click', closeSatelliteModal);

// Toggles for Map Layers (States and Cities)
if (btnToggleStates) {
  btnToggleStates.addEventListener('click', () => {
    showStatesActive = !showStatesActive;
    btnToggleStates.classList.toggle('active', showStatesActive);
    updateGlobeBorders();
  });
}

if (btnToggleCities) {
  btnToggleCities.addEventListener('click', () => {
    showCitiesActive = !showCitiesActive;
    btnToggleCities.classList.toggle('active', showCitiesActive);
    updateGlobeCities();
  });
}

// Navigation switches
if (btnNavHome) {
  btnNavHome.addEventListener('click', () => {
    dashboardHomeView.classList.remove('hidden');
    homeView.classList.add('hidden');
    personView.classList.add('hidden');
    if (neuralNetworkView) neuralNetworkView.classList.add('hidden');

    btnNavHome.classList.add('active');
    btnNavGlobe.classList.remove('active');
    if (btnNavNeural) btnNavNeural.classList.remove('active');

    document.querySelectorAll('.person-item').forEach(el => el.classList.remove('active'));
    currentPerson = null;

    destroyGlobe();
    stopNeuralAnimation();
    updateDashboardStats();
    addSystemLog('NAVIGATED TO MAIN HUB DASHBOARD');
  });
}

if (btnNavGlobe) {
  btnNavGlobe.addEventListener('click', () => {
    dashboardHomeView.classList.add('hidden');
    homeView.classList.remove('hidden');
    personView.classList.add('hidden');
    if (neuralNetworkView) neuralNetworkView.classList.add('hidden');

    btnNavHome.classList.remove('active');
    btnNavGlobe.classList.add('active');
    if (btnNavNeural) btnNavNeural.classList.remove('active');

    document.querySelectorAll('.person-item').forEach(el => el.classList.remove('active'));
    currentPerson = null;

    stopNeuralAnimation();
    initGlobe();
    updateGlobeData();
    addSystemLog('TACTICAL GLOBE MAP ENGINE INITIATED');
  });
}

if (btnNavNeural) {
  btnNavNeural.addEventListener('click', () => {
    dashboardHomeView.classList.add('hidden');
    homeView.classList.add('hidden');
    personView.classList.add('hidden');
    if (neuralNetworkView) neuralNetworkView.classList.remove('hidden');

    btnNavHome.classList.remove('active');
    btnNavGlobe.classList.remove('active');
    btnNavNeural.classList.add('active');

    document.querySelectorAll('.person-item').forEach(el => el.classList.remove('active'));
    currentPerson = null;

    destroyGlobe();
    initNeuralNetwork();
    addSystemLog('NEURAL NETWORK INTELLIGENCE MAP INITIATED');
  });
}

// System Audit Trail Logging
function addSystemLog(actionText) {
  if (!logsContainer) return;
  const now = new Date();
  const timeStr = now.toLocaleTimeString('pt-BR');

  const logRow = document.createElement('div');
  logRow.className = 'log-row';
  logRow.innerHTML = `<span class="log-time">[${timeStr}]</span> <span class="log-action">SYS.AUDIT:</span> ${actionText}`;

  logsContainer.appendChild(logRow);
  logsContainer.scrollTop = logsContainer.scrollHeight;

  while (logsContainer.children.length > 50) {
    logsContainer.removeChild(logsContainer.firstChild);
  }
}

// Update dashboard stats
async function updateDashboardStats() {
  if (!statCountTargets || !statCountMedia) return;
  statCountTargets.textContent = String(people.length).padStart(2, '0');

  let mediaCount = 0;
  try {
    const res = await fetch('/api/media');
    if (res.ok) {
      const allMedia = await res.json();
      mediaCount = allMedia.length;
    }
  } catch (err) {
    console.warn("Failed to fetch all media for stats:", err);
    try {
      const allMediaDb = await dbGetAll('media');
      mediaCount = allMediaDb.length;
    } catch (e) { }
  }

  statCountMedia.textContent = String(mediaCount).padStart(2, '0');
}


// ============================================================
//  HEALTH REGISTRY SEARCH (SISReg III)
// ============================================================
const healthSearchForm = document.getElementById('health-search-form');
const healthSearchInput = document.getElementById('health-search-input');
const searchSpinner = document.getElementById('search-spinner');
const searchStatus = document.getElementById('search-status');
const searchResultsDiv = document.getElementById('search-results');
let isSearching = false;

function showSearchStatus(message, type) {
  if (!searchStatus) return;
  searchStatus.textContent = message;
  searchStatus.className = 'search-status ' + (type || '');
  searchStatus.classList.remove('hidden');
}

function hideSearchStatus() {
  if (searchStatus) searchStatus.classList.add('hidden');
}

function renderSearchResults(data) {
  if (!searchResultsDiv) return;
  searchResultsDiv.innerHTML = '';

  if (data.messages && data.messages.length > 0) {
    data.messages.forEach(msg => {
      showSearchStatus('SYS MSG: ' + msg, 'error');
    });
  }

  if (!data.results || data.results.length === 0) {
    searchResultsDiv.innerHTML = `
      <div class="search-no-results">
        NO RECORDS FOUND FOR QUERY: "${escapeHtml(data.query || '')}"
      </div>
    `;
    return;
  }

  const header = document.createElement('div');
  header.className = 'search-results-header';
  header.innerHTML = `
    <span class="search-results-title">QUERY RESULTS</span>
    <span class="search-results-count">${data.results.length} RECORD(S) FOUND</span>
  `;
  searchResultsDiv.appendChild(header);

  data.results.forEach((row, index) => {
    const item = document.createElement('div');
    item.className = 'search-result-item';
    item.style.animationDelay = `${index * 0.08}s`;

    let cellsHtml = '';
    row.forEach((cell, ci) => {
      cellsHtml += `
        <div class="result-cell">
          <div class="result-row-label">FIELD ${ci + 1}</div>
          <div class="result-row-value">${escapeHtml(cell)}</div>
        </div>
      `;
    });

    item.innerHTML = cellsHtml;
    searchResultsDiv.appendChild(item);
  });

  const meta = document.createElement('div');
  meta.className = 'search-results-meta';
  meta.textContent = `TIMESTAMP: ${data.timestamp || new Date().toISOString()} // SOURCE: SISREG III`;
  searchResultsDiv.appendChild(meta);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

if (healthSearchForm) {
  healthSearchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isSearching) return;

    const query = healthSearchInput.value.trim();
    if (!query) {
      showSearchStatus('ENTER A SEARCH QUERY FIRST', 'error');
      return;
    }

    isSearching = true;
    hideSearchStatus();
    searchResultsDiv.innerHTML = '';
    searchSpinner.classList.remove('hidden');
    const btnGo = document.getElementById('btn-search-go');
    if (btnGo) btnGo.disabled = true;

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      if (res.status === 429) {
        const err = await res.json();
        showSearchStatus(err.error || 'RATE LIMIT EXCEEDED  -  WAIT BEFORE RETRYING', 'error');
        return;
      }

      const data = await res.json().catch(() => null);

      if (!data) {
        showSearchStatus(`SERVER ERROR [HTTP ${res.status}]  -  NO VALID RESPONSE`, 'error');
        return;
      }

      if (data.success) {
        showSearchStatus(`QUERY COMPLETE  -  ${(data.results || []).length} RECORD(S) [VIA ${(data.method || 'UNKNOWN').toUpperCase()}]`, 'success');
        renderSearchResults(data);
        addSystemLog(`HEALTH REGISTRY SEARCH: "${query}"  -  ${(data.results || []).length} results`);
      } else {
        const errorMsg = data.error || (data.messages && data.messages[0]) || 'REQUEST FAILED';
        showSearchStatus(errorMsg.toUpperCase(), 'error');
        if (data.debug) {
          console.warn('Search debug info:', data.debug);
        }
        if (data.messages && data.messages.length > 0) {
          renderSearchResults(data);
        }
      }

    } catch (err) {
      console.error('Search error:', err);
      showSearchStatus('NETWORK ERROR  -  COULD NOT REACH SERVER', 'error');
    } finally {
      isSearching = false;
      searchSpinner.classList.add('hidden');
      if (btnGo) btnGo.disabled = false;
    }
  });
}

// ============================================================
//  FOLDER SYSTEM
// ============================================================
const btnNewFolder = document.getElementById('btn-new-folder');
const foldersHorizontalList = document.getElementById('folders-horizontal-list');
const sidebarFolderBadge = document.getElementById('sidebar-folder-badge');
const btnBackFolders = document.getElementById('btn-back-folders');

// Folder modal
const folderModal = document.getElementById('folder-modal');
const folderModalOverlay = document.getElementById('folder-modal-overlay');
const folderModalTitle = document.getElementById('folder-modal-title');
const fFolderName = document.getElementById('f-folder-name');
const fFolderColor = document.getElementById('f-folder-color');
const fFolderPassword = document.getElementById('f-folder-password');
const colorHexDisplay = document.getElementById('color-hex-display');
const folderPreviewIcon = document.getElementById('folder-preview-icon');
const folderPreviewName = document.getElementById('folder-preview-name');
const btnFolderSave = document.getElementById('folder-modal-save');
const btnFolderCancel = document.getElementById('folder-modal-cancel');

// Password modal
const folderPasswordModal = document.getElementById('folder-password-modal');
const folderPasswordOverlay = document.getElementById('folder-password-overlay');
const passwordFolderName = document.getElementById('password-folder-name');
const folderPasswordInput = document.getElementById('folder-password-input');
const folderPasswordError = document.getElementById('folder-password-error');
const btnFolderPasswordSubmit = document.getElementById('folder-password-submit');
const btnFolderPasswordCancel = document.getElementById('folder-password-cancel');

// Neural popup
const neuralPopup = document.getElementById('neural-popup');
const neuralPopupClose = document.getElementById('neural-popup-close');
const neuralPopupAvatar = document.getElementById('neural-popup-avatar');
const neuralPopupName = document.getElementById('neural-popup-name');
const neuralPopupData = document.getElementById('neural-popup-data');
const neuralPopupOpen = document.getElementById('neural-popup-open');

let folders = [];
let currentFolder = null;
let editingFolderId = null;
let pendingPasswordFolder = null;
let nnAnimFrame = null;

let unlockedFolderIds = new Set();

function isFolderLocked(folder) {
  return folder && folder.password && !unlockedFolderIds.has(folder.id);
}

function isTargetCensored(person) {
  if (!person) return false;
  return folders.some(f => (f.targetIds || []).includes(person.id) && isFolderLocked(f));
}

// ---- Load Folders ----
async function loadFolders() {
  try {
    const res = await fetch('/api/folders');
    if (res.ok) folders = await res.json();
  } catch (err) {
    console.warn('Failed to load folders:', err);
    folders = [];
  }

  // Auto-generate default folders if none exist and we have targets
  if (folders.length === 0 && people.length > 0) {
    folders = [
      {
        id: 'folder_alpha',
        name: 'SECURE ALPHA',
        color: '#E74C3C',
        password: '1234',
        targetIds: [],
        connections: ['folder_beta'],
        createdAt: new Date().toISOString()
      },
      {
        id: 'folder_beta',
        name: 'COBALT LINK',
        color: '#3498DB',
        password: '',
        targetIds: [],
        connections: ['folder_alpha', 'folder_grey'],
        createdAt: new Date().toISOString()
      },
      {
        id: 'folder_grey',
        name: 'TACTICAL SLATE',
        color: '#34495E',
        password: '',
        targetIds: [],
        connections: ['folder_beta'],
        createdAt: new Date().toISOString()
      }
    ];

    // Distribute targets automatically
    people.forEach((p, idx) => {
      const folderIdx = idx % 3;
      folders[folderIdx].targetIds.push(p.id);
    });

    // Save generated folders to backend database
    for (const f of folders) {
      try {
        await fetch('/api/folders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(f)
        });
      } catch (err) {}
    }
    
    addSystemLog('DATABASE: AUTO-GENERATED DEFAULT INTEL FOLDERS');
  }

  renderFoldersGrid();
}

// ---- Render Folders Grid (Horizontal Pills) ----
function renderFoldersGrid() {
  if (!foldersHorizontalList) return;
  foldersHorizontalList.innerHTML = '';

  if (folders.length === 0) {
    foldersHorizontalList.innerHTML = '<div style="padding:4px 8px;font-size:.55rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)">// NO FOLDERS</div>';
    return;
  }

  folders.forEach(f => {
    const pill = document.createElement('div');
    pill.className = 'folder-pill' + (currentFolder && currentFolder.id === f.id ? ' active' : '');
    pill.dataset.id = f.id;
    pill.style.setProperty('--folder-color', f.color || '#E74C3C');
    pill.style.setProperty('--folder-color-alpha', (f.color || '#E74C3C') + '15');

    const lockIcon = f.password ? '<span class="folder-pill-lock">🔒 </span>' : '';
    const targetCount = (f.targetIds || []).length;

    pill.innerHTML = `
      ${lockIcon}
      <span class="folder-pill-name" style="color:${f.color || '#E74C3C'}">${escHtml(f.name)} (${targetCount})</span>
      <span class="folder-pill-actions">
        <button class="btn-pill-edit" data-id="${f.id}" title="Edit">✎</button>
        <button class="btn-pill-del" data-id="${f.id}" title="Delete">✕</button>
      </span>`;

    pill.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-pill-edit')) {
        e.stopPropagation();
        openFolderModal(folders.find(fl => fl.id === e.target.dataset.id));
        return;
      }
      if (e.target.classList.contains('btn-pill-del')) {
        e.stopPropagation();
        deleteFolder(e.target.dataset.id);
        return;
      }
      openFolder(f);
    });

    foldersHorizontalList.appendChild(pill);
  });
}

// ---- Open Folder (with password gate) ----
function openFolder(folder) {
  if (folder.password) {
    pendingPasswordFolder = folder;
    passwordFolderName.textContent = folder.name.toUpperCase();
    folderPasswordInput.value = '';
    folderPasswordError.classList.add('hidden');
    folderPasswordModal.classList.remove('hidden');
    folderPasswordInput.focus();
    return;
  }
  activateFolder(folder);
}

function activateFolder(folder) {
  currentFolder = folder;

  if (sidebarFolderBadge) {
    sidebarFolderBadge.textContent = folder.name.toUpperCase();
    sidebarFolderBadge.style.background = folder.color || '#E74C3C';
    sidebarFolderBadge.style.color = '#fff';
    sidebarFolderBadge.style.display = 'inline-block';
  }
  if (btnBackFolders) {
    btnBackFolders.style.display = 'inline-block';
  }

  renderFoldersGrid();
  renderPeopleList();
  addSystemLog(`FOLDER: FILTER BY "${folder.name.toUpperCase()}"`);
}

// ---- Back to Folders (Clear Filter) ----
if (btnBackFolders) {
  btnBackFolders.addEventListener('click', () => {
    currentFolder = null;
    if (sidebarFolderBadge) sidebarFolderBadge.style.display = 'none';
    btnBackFolders.style.display = 'none';
    renderFoldersGrid();
    renderPeopleList();
    addSystemLog(`FOLDER: FILTER CLEARED`);
  });
}

// ---- Connected folders helper (BFS to find connected network) ----
function getConnectedFolderIds(startFolderId) {
  const visited = new Set();
  const queue = [startFolderId];
  visited.add(startFolderId);

  while (queue.length > 0) {
    const fid = queue.shift();
    const folder = folders.find(f => f.id === fid);
    if (folder && folder.connections) {
      folder.connections.forEach(connId => {
        if (!visited.has(connId)) {
          visited.add(connId);
          queue.push(connId);
        }
      });
    }
  }
  return Array.from(visited);
}

// ---- Override renderPeopleList to filter by folder + connected folders ----
const _origRenderPeopleList = renderPeopleList;
renderPeopleList = function() {
  if (!currentFolder) {
    // If no folder is active, show all targets (the original list)
    _origRenderPeopleList();
    return;
  }

  const q = searchInput.value.toLowerCase().trim();
  
  // Find all targets from current folder and all connected folders
  const connectedIds = getConnectedFolderIds(currentFolder.id);
  const folderTargetIds = [];
  folders.forEach(f => {
    if (connectedIds.includes(f.id)) {
      (f.targetIds || []).forEach(tid => {
        if (!folderTargetIds.includes(tid)) {
          folderTargetIds.push(tid);
        }
      });
    }
  });

  const filtered = people.filter(p => {
    if (!folderTargetIds.includes(p.id)) return false;
    return p.fullname.toLowerCase().includes(q) ||
      (p.nick && p.nick.toLowerCase().includes(q)) ||
      (p.cpf && p.cpf.includes(q)) ||
      (p.rg && p.rg.includes(q)) ||
      (p.telefone && p.telefone.includes(q)) ||
      (p.placa && p.placa.toLowerCase().includes(q)) ||
      (p.cidade && p.cidade.toLowerCase().includes(q)) ||
      (p.email && p.email.toLowerCase().includes(q));
  });

  peopleList.innerHTML = '';

  if (filtered.length === 0) {
    peopleList.innerHTML = '<div style="padding:14px 16px;font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)">// NO TARGETS IN THIS NETWORK</div>';
    return;
  }

  filtered.forEach((p, i) => {
    const item = document.createElement('div');
    item.className = 'person-item' + (currentPerson && currentPerson.id === p.id ? ' active' : '');
    item.dataset.id = p.id;

    const num = String(i + 1).padStart(2, '0');
    const nick = p.nick ? `@ ${p.nick}` : (p.cidade || '');

    item.innerHTML = `
      <span class="pi-num">${num} //</span>
      <div class="pi-info">
        <div class="pi-name">${escHtml(p.fullname)}</div>
        ${nick ? `<div class="pi-nick">${escHtml(nick)}</div>` : ''}
      </div>`;

    item.addEventListener('click', () => selectPerson(p.id));
    peopleList.appendChild(item);
  });
};

// ---- Folder Modal ----
if (btnNewFolder) {
  btnNewFolder.addEventListener('click', () => {
    if (!isAdmin()) return;
    openFolderModal(null);
  });
}

function openFolderModal(folder) {
  editingFolderId = folder ? folder.id : null;
  folderModalTitle.textContent = folder ? 'EDIT FOLDER' : 'NEW FOLDER';
  fFolderName.value = folder?.name || '';
  fFolderColor.value = folder?.color || '#E74C3C';
  fFolderPassword.value = '';
  colorHexDisplay.textContent = fFolderColor.value.toUpperCase();
  updateFolderPreview();
  folderModal.classList.remove('hidden');
  fFolderName.focus();
}

function closeFolderModal() { folderModal.classList.add('hidden'); }
if (btnFolderCancel) btnFolderCancel.addEventListener('click', closeFolderModal);
if (folderModalOverlay) folderModalOverlay.addEventListener('click', closeFolderModal);

// Color picker live preview
if (fFolderColor) {
  fFolderColor.addEventListener('input', () => {
    colorHexDisplay.textContent = fFolderColor.value.toUpperCase();
    updateFolderPreview();
  });
}
if (fFolderName) {
  fFolderName.addEventListener('input', updateFolderPreview);
}

function updateFolderPreview() {
  if (folderPreviewIcon) {
    folderPreviewIcon.querySelector('svg').style.color = fFolderColor.value;
  }
  if (folderPreviewName) {
    folderPreviewName.textContent = (fFolderName.value || 'FOLDER NAME').toUpperCase();
  }
}

// Save folder
if (btnFolderSave) {
  btnFolderSave.addEventListener('click', async () => {
    if (!isAdmin()) return;
    const name = fFolderName.value.trim();
    if (!name) { fFolderName.focus(); return; }

    const existing = editingFolderId ? folders.find(f => f.id === editingFolderId) : null;

    const folder = {
      id: editingFolderId || 'folder_' + crypto.randomUUID().slice(0, 8),
      name,
      color: fFolderColor.value,
      password: fFolderPassword.value || (existing?.password || ''),
      targetIds: existing?.targetIds || [],
      connections: existing?.connections || [],
      createdAt: existing?.createdAt || new Date().toISOString()
    };

    try {
      await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(folder)
      });
    } catch (err) { console.error('Folder save failed:', err); }

    if (editingFolderId) {
      const idx = folders.findIndex(f => f.id === editingFolderId);
      if (idx !== -1) folders[idx] = folder;
      addSystemLog(`FOLDER: UPDATED "${name.toUpperCase()}"`);
    } else {
      folders.push(folder);
      addSystemLog(`FOLDER: CREATED "${name.toUpperCase()}"`);
    }

    closeFolderModal();
    renderFoldersGrid();
  });
}

// Delete folder
async function deleteFolder(id) {
  const folder = folders.find(f => f.id === id);
  if (!folder) return;
  if (!confirm(`DELETE FOLDER "${folder.name.toUpperCase()}"?\n\nTargets inside will NOT be deleted.`)) return;

  try {
    await fetch(`/api/folders?id=${id}`, { method: 'DELETE' });
  } catch (err) { console.error('Folder delete failed:', err); }

  folders = folders.filter(f => f.id !== id);
  // Remove connections to this folder from others
  folders.forEach(f => {
    f.connections = (f.connections || []).filter(c => c !== id);
  });

  if (currentFolder && currentFolder.id === id) {
    currentFolder = null;
    sidebarTargetsSection.classList.add('hidden');
    peopleList.classList.add('hidden');
    btnNewPerson.classList.add('hidden');
  }

  addSystemLog(`FOLDER: DELETED "${folder.name.toUpperCase()}"`);
  renderFoldersGrid();

  // Save updated connections
  for (const f of folders) {
    try {
      await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(f)
      });
    } catch (err) {}
  }
}

// ---- Password Gate ----
if (btnFolderPasswordSubmit) {
  btnFolderPasswordSubmit.addEventListener('click', () => {
    if (!pendingPasswordFolder) return;
    if (folderPasswordInput.value === pendingPasswordFolder.password) {
      if (typeof unlockedFolderIds !== 'undefined') {
        unlockedFolderIds.add(pendingPasswordFolder.id);
      }
      folderPasswordModal.classList.add('hidden');
      activateFolder(pendingPasswordFolder);
      
      // Open manage modal upon unlocking folder
      openFolderManageModal(pendingPasswordFolder);
      
      // Decrypt currently viewed dossier if it belongs to this folder
      if (currentPerson && (pendingPasswordFolder.targetIds || []).includes(currentPerson.id)) {
        renderDossieHeader(currentPerson);
        renderBlocos();
      }
      
      renderPeopleList();
      pendingPasswordFolder = null;
    } else {
      folderPasswordError.classList.remove('hidden');
      folderPasswordInput.value = '';
      setTimeout(() => folderPasswordError.classList.add('hidden'), 2000);
    }
  });
}
if (btnFolderPasswordCancel) {
  btnFolderPasswordCancel.addEventListener('click', () => {
    folderPasswordModal.classList.add('hidden');
    pendingPasswordFolder = null;
  });
}
if (folderPasswordOverlay) {
  folderPasswordOverlay.addEventListener('click', () => {
    folderPasswordModal.classList.add('hidden');
    pendingPasswordFolder = null;
  });
}
// Enter key on password input
if (folderPasswordInput) {
  folderPasswordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnFolderPasswordSubmit.click();
  });
}

// ---- When saving a new target, add to current folder ----
const _origBtnPersonSaveClick = btnPersonSave.onclick;
btnPersonSave.addEventListener('click', async () => {
  // After save, if a folder is open, add the target to it
  setTimeout(async () => {
    if (currentFolder && people.length > 0) {
      const lastPerson = people[people.length - 1];
      if (lastPerson && !(currentFolder.targetIds || []).includes(lastPerson.id)) {
        if (!editingId) { // only for new targets
          currentFolder.targetIds = currentFolder.targetIds || [];
          currentFolder.targetIds.push(lastPerson.id);
          try {
            await fetch('/api/folders', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(currentFolder)
            });
          } catch (err) {}
          renderFoldersGrid();
          renderPeopleList();
        }
      }
    }
  }, 500);
}, { capture: false });

// Load folders on startup
loadFolders();

// ============================================================
//  NEURAL NETWORK ENGINE
// ============================================================
const neuralCanvas = document.getElementById('neural-canvas');
const nnBtnReset = document.getElementById('nn-btn-reset');
const nnBtnLinkMode = document.getElementById('nn-btn-link-mode');
const nnStatFolders = document.getElementById('nn-stat-folders');
const nnStatTargets = document.getElementById('nn-stat-targets');
const nnStatLinks = document.getElementById('nn-stat-links');

let nnCtx = null;
let nnNodes = [];
let nnEdges = [];
let nnParticles = [];
let nnCamera = { x: 0, y: 0, zoom: 1 };
let nnDragging = null;
let nnPanning = false;
let nnPanStart = { x: 0, y: 0 };
let nnLinkMode = false;
let nnLinkSource = null;
let nnHoverNode = null;

function stopNeuralAnimation() {
  if (nnAnimFrame) {
    cancelAnimationFrame(nnAnimFrame);
    nnAnimFrame = null;
  }
}

function initNeuralNetwork() {
  if (!neuralCanvas) return;
  nnCtx = neuralCanvas.getContext('2d');
  nnEnergy = 1.0;
  nnCamera = { x: 0, y: 0, zoom: 1 };

  // Resize canvas
  const rect = neuralCanvas.parentElement.getBoundingClientRect();
  neuralCanvas.width = rect.width * window.devicePixelRatio;
  neuralCanvas.height = rect.height * window.devicePixelRatio;
  nnCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
  neuralCanvas._cssW = rect.width;
  neuralCanvas._cssH = rect.height;

  buildNeuralGraph();
  startNeuralAnimation();
}

function buildNeuralGraph() {
  nnEnergy = 1.0;
  nnCamera = { x: 0, y: 0, zoom: 1 };
  nnNodes = [];
  nnEdges = [];
  nnParticles = [];

  const cw = neuralCanvas._cssW || 800;
  const ch = neuralCanvas._cssH || 600;
  const cx = cw / 2;
  const cy = ch / 2;

  // Create folder nodes in a circle
  const folderRadius = Math.min(cw, ch) * 0.28;
  folders.forEach((f, i) => {
    const angle = (i / Math.max(folders.length, 1)) * Math.PI * 2 - Math.PI / 2;
    nnNodes.push({
      id: f.id,
      type: 'folder',
      label: f.name,
      color: f.color || '#E74C3C',
      x: cx + Math.cos(angle) * folderRadius,
      y: cy + Math.sin(angle) * folderRadius,
      vx: 0, vy: 0,
      radius: 28,
      data: f
    });
  });

  // Collect all unique target IDs across all folders
  const targetSet = new Set();
  folders.forEach(f => (f.targetIds || []).forEach(tid => targetSet.add(tid)));

  // Create target nodes
  const targets = people.filter(p => targetSet.has(p.id));
  targets.forEach((t, i) => {
    const angle = (i / Math.max(targets.length, 1)) * Math.PI * 2;
    const dist = folderRadius * 1.6 + Math.random() * 60;
    nnNodes.push({
      id: t.id,
      type: 'target',
      label: t.fullname,
      color: '#888888',
      x: cx + Math.cos(angle) * dist + (Math.random() - 0.5) * 40,
      y: cy + Math.sin(angle) * dist + (Math.random() - 0.5) * 40,
      vx: 0, vy: 0,
      radius: 14,
      data: t
    });
  });

  // Create edges: folder → target
  folders.forEach(f => {
    (f.targetIds || []).forEach(tid => {
      if (nnNodes.find(n => n.id === tid)) {
        nnEdges.push({ source: f.id, target: tid, color: f.color || '#E74C3C' });
      }
    });
  });

  // Create edges: folder → folder (connections)
  folders.forEach(f => {
    (f.connections || []).forEach(cid => {
      // Avoid duplicates
      if (!nnEdges.find(e => (e.source === f.id && e.target === cid && e._isConnection) || (e.source === cid && e.target === f.id && e._isConnection))) {
        const cf = folders.find(fl => fl.id === cid);
        nnEdges.push({
          source: f.id,
          target: cid,
          color: '#ffffff',
          _isConnection: true,
          _color1: f.color || '#E74C3C',
          _color2: cf?.color || '#3498DB'
        });
      }
    });
  });

  // Spawn initial particles
  nnEdges.forEach(e => {
    for (let i = 0; i < 2; i++) {
      nnParticles.push({
        edge: e,
        t: Math.random(),
        speed: 0.002 + Math.random() * 0.003
      });
    }
  });

  // Update stats
  if (nnStatFolders) nnStatFolders.textContent = folders.length;
  if (nnStatTargets) nnStatTargets.textContent = targets.length;
  if (nnStatLinks) nnStatLinks.textContent = nnEdges.length;
}

let nnEnergy = 1.0;

function startNeuralAnimation() {
  stopNeuralAnimation();
  function frame() {
    updateNeuralPhysics();
    renderNeuralGraph();
    nnAnimFrame = requestAnimationFrame(frame);
  }
  nnAnimFrame = requestAnimationFrame(frame);
}

function updateNeuralPhysics() {
  // Update particles (always run particle flow)
  nnParticles.forEach(p => {
    p.t += p.speed;
    if (p.t > 1) p.t -= 1;
  });

  // If stable and not dragging, skip forces
  if (nnEnergy < 0.005 && !nnDragging) {
    return;
  }

  const cw = neuralCanvas._cssW || 800;
  const ch = neuralCanvas._cssH || 600;
  const damping = 0.92;
  const repulsion = 1200;
  const springLen = 120;
  const springK = 0.008;

  // Node-node repulsion
  for (let i = 0; i < nnNodes.length; i++) {
    for (let j = i + 1; j < nnNodes.length; j++) {
      const a = nnNodes[i], b = nnNodes[j];
      let dx = b.x - a.x, dy = b.y - a.y;
      let dist = Math.sqrt(dx * dx + dy * dy) || 1;
      let force = (repulsion / (dist * dist)) * nnEnergy;
      let fx = (dx / dist) * force, fy = (dy / dist) * force;
      a.vx -= fx; a.vy -= fy;
      b.vx += fx; b.vy += fy;
    }
  }

  // Edge spring attraction
  nnEdges.forEach(e => {
    const a = nnNodes.find(n => n.id === e.source);
    const b = nnNodes.find(n => n.id === e.target);
    if (!a || !b) return;
    let dx = b.x - a.x, dy = b.y - a.y;
    let dist = Math.sqrt(dx * dx + dy * dy) || 1;
    let force = (dist - springLen) * springK * nnEnergy;
    let fx = (dx / dist) * force, fy = (dy / dist) * force;
    a.vx += fx; a.vy += fy;
    b.vx -= fx; b.vy -= fy;
  });

  // Center gravity
  nnNodes.forEach(n => {
    n.vx += (cw / 2 - n.x) * 0.0005 * nnEnergy;
    n.vy += (ch / 2 - n.y) * 0.0005 * nnEnergy;
  });

  // Apply velocity
  nnNodes.forEach(n => {
    if (n === nnDragging) return;
    n.vx *= damping;
    n.vy *= damping;
    n.x += n.vx;
    n.y += n.vy;
    // Bounds
    n.x = Math.max(n.radius, Math.min(cw - n.radius, n.x));
    n.y = Math.max(n.radius, Math.min(ch - n.radius, n.y));
  });

  // Decay energy
  nnEnergy *= 0.98;
}

function renderNeuralGraph() {
  if (!nnCtx) return;
  const cw = neuralCanvas._cssW || 800;
  const ch = neuralCanvas._cssH || 600;
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

  nnCtx.clearRect(0, 0, cw, ch);

  // Draw subtle grid (Static background grid, does not jump with camera zoom)
  nnCtx.strokeStyle = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)';
  nnCtx.lineWidth = 0.5;
  const gridSize = 40;
  for (let x = 0; x < cw; x += gridSize) {
    nnCtx.beginPath(); nnCtx.moveTo(x, 0); nnCtx.lineTo(x, ch); nnCtx.stroke();
  }
  for (let y = 0; y < ch; y += gridSize) {
    nnCtx.beginPath(); nnCtx.moveTo(0, y); nnCtx.lineTo(cw, y); nnCtx.stroke();
  }

  // Draw neural elements with Camera translation and scale applied
  nnCtx.save();
  nnCtx.translate(nnCamera.x, nnCamera.y);
  nnCtx.scale(nnCamera.zoom, nnCamera.zoom);

  // Draw edges
  nnEdges.forEach(e => {
    const a = nnNodes.find(n => n.id === e.source);
    const b = nnNodes.find(n => n.id === e.target);
    if (!a || !b) return;

    nnCtx.beginPath();
    nnCtx.moveTo(a.x, a.y);

    const mx = (a.x + b.x) / 2 + (a.y - b.y) * 0.1;
    const my = (a.y + b.y) / 2 + (b.x - a.x) * 0.1;
    nnCtx.quadraticCurveTo(mx, my, b.x, b.y);

    if (e._isConnection) {
      const grad = nnCtx.createLinearGradient(a.x, a.y, b.x, b.y);
      grad.addColorStop(0, e._color1 + '88');
      grad.addColorStop(1, e._color2 + '88');
      nnCtx.strokeStyle = grad;
      nnCtx.lineWidth = 2.5;
      nnCtx.setLineDash([6, 4]);
    } else {
      nnCtx.strokeStyle = e.color + '44';
      nnCtx.lineWidth = 1;
      nnCtx.setLineDash([]);
    }
    nnCtx.stroke();
    nnCtx.setLineDash([]);
  });

  // Draw particles on edges
  nnParticles.forEach(p => {
    const a = nnNodes.find(n => n.id === p.edge.source);
    const b = nnNodes.find(n => n.id === p.edge.target);
    if (!a || !b) return;

    const t = p.t;
    const mx = (a.x + b.x) / 2 + (a.y - b.y) * 0.1;
    const my = (a.y + b.y) / 2 + (b.x - a.x) * 0.1;
    const px = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * mx + t * t * b.x;
    const py = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * my + t * t * b.y;

    nnCtx.beginPath();
    nnCtx.arc(px, py, 2, 0, Math.PI * 2);
    nnCtx.fillStyle = p.edge.color + 'CC';
    nnCtx.fill();
  });

  // Draw nodes
  nnNodes.forEach(n => {
    const isHover = nnHoverNode === n;
    const glowR = n.radius + (isHover ? 8 : 4);

    if (n.type === 'folder') {
      const glow = nnCtx.createRadialGradient(n.x, n.y, n.radius * 0.5, n.x, n.y, glowR * 1.5);
      glow.addColorStop(0, n.color + '55');
      glow.addColorStop(1, n.color + '00');
      nnCtx.beginPath();
      nnCtx.arc(n.x, n.y, glowR * 1.5, 0, Math.PI * 2);
      nnCtx.fillStyle = glow;
      nnCtx.fill();

      nnCtx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
        const r = n.radius + (isHover ? 4 : 0);
        const px = n.x + Math.cos(a) * r;
        const py = n.y + Math.sin(a) * r;
        if (i === 0) nnCtx.moveTo(px, py); else nnCtx.lineTo(px, py);
      }
      nnCtx.closePath();
      nnCtx.fillStyle = n.color + (isHover ? 'DD' : 'AA');
      nnCtx.fill();
      nnCtx.strokeStyle = n.color;
      nnCtx.lineWidth = isHover ? 2.5 : 1.5;
      nnCtx.stroke();

      nnCtx.fillStyle = isDark ? '#ffffff' : '#000000';
      nnCtx.font = '8px "Courier New"';
      nnCtx.textAlign = 'center';
      const labelText = n.label.length > 14 ? n.label.slice(0, 12) + '..' : n.label;
      nnCtx.fillText(labelText.toUpperCase(), n.x, n.y + n.radius + 14);

    } else {
      const glow = nnCtx.createRadialGradient(n.x, n.y, n.radius * 0.3, n.x, n.y, glowR);
      glow.addColorStop(0, (isDark ? '#ffffff' : '#000000') + '33');
      glow.addColorStop(1, (isDark ? '#ffffff' : '#000000') + '00');
      nnCtx.beginPath();
      nnCtx.arc(n.x, n.y, glowR, 0, Math.PI * 2);
      nnCtx.fillStyle = glow;
      nnCtx.fill();

      nnCtx.beginPath();
      nnCtx.arc(n.x, n.y, n.radius + (isHover ? 2 : 0), 0, Math.PI * 2);
      nnCtx.fillStyle = isDark ? '#1a1a1a' : '#f0f0f0';
      nnCtx.fill();
      nnCtx.strokeStyle = isDark ? '#555' : '#999';
      nnCtx.lineWidth = isHover ? 2 : 1;
      nnCtx.stroke();

      nnCtx.fillStyle = isDark ? '#aaa' : '#555';
      nnCtx.font = 'bold 10px "Courier New"';
      nnCtx.textAlign = 'center';
      nnCtx.textBaseline = 'middle';
      nnCtx.fillText(n.label.charAt(0).toUpperCase(), n.x, n.y);
      nnCtx.textBaseline = 'alphabetic';

      nnCtx.fillStyle = isDark ? '#888' : '#666';
      nnCtx.font = '7px "Courier New"';
      const tLabel = n.label.length > 12 ? n.label.slice(0, 10) + '..' : n.label;
      nnCtx.fillText(tLabel.toUpperCase(), n.x, n.y + n.radius + 11);
    }
  });

  nnCtx.restore();

  // Link mode indicator
  if (nnLinkMode && nnLinkSource) {
    nnCtx.fillStyle = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)';
    nnCtx.font = '10px "Courier New"';
    nnCtx.textAlign = 'left';
    nnCtx.fillText('// LINK MODE — CLICK A FOLDER TO CONNECT', 12, ch - 12);
  }
}

// ---- Neural Canvas Interaction ----
if (neuralCanvas) {
  neuralCanvas.addEventListener('mousedown', (e) => {
    const rect = neuralCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Convert screen coordinates to world coordinates (based on camera translate & zoom)
    const wx = (mx - nnCamera.x) / nnCamera.zoom;
    const wy = (my - nnCamera.y) / nnCamera.zoom;

    const node = nnNodes.find(n => {
      const dx = wx - n.x, dy = wy - n.y;
      return Math.sqrt(dx * dx + dy * dy) < n.radius + 4;
    });

    if (nnLinkMode && node && node.type === 'folder') {
      if (!nnLinkSource) {
        nnLinkSource = node;
      } else if (nnLinkSource.id !== node.id) {
        createFolderConnection(nnLinkSource.data, node.data);
        nnLinkSource = null;
        nnLinkMode = false;
        if (nnBtnLinkMode) nnBtnLinkMode.classList.remove('active');
        buildNeuralGraph();
      }
      return;
    }

    if (node) {
      nnDragging = node;
      nnEnergy = 1.0; // wake up physics
    } else {
      nnPanning = true;
      nnPanStart = { x: mx, y: my };
    }
  });

  neuralCanvas.addEventListener('mousemove', (e) => {
    const rect = neuralCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Convert screen coordinates to world coordinates
    const wx = (mx - nnCamera.x) / nnCamera.zoom;
    const wy = (my - nnCamera.y) / nnCamera.zoom;

    if (nnDragging) {
      nnDragging.x = wx;
      nnDragging.y = wy;
      nnDragging.vx = 0;
      nnDragging.vy = 0;
      nnEnergy = 1.0; // wake up physics
      return;
    }

    if (nnPanning) {
      nnCamera.x += mx - nnPanStart.x;
      nnCamera.y += my - nnPanStart.y;
      nnPanStart = { x: mx, y: my };
      return;
    }

    // Hover detection (World coordinates)
    const node = nnNodes.find(n => {
      const dx = wx - n.x, dy = wy - n.y;
      return Math.sqrt(dx * dx + dy * dy) < n.radius + 4;
    });
    nnHoverNode = node || null;
    neuralCanvas.style.cursor = node ? 'pointer' : (nnPanning ? 'grabbing' : 'grab');
  });

  neuralCanvas.addEventListener('mouseup', (e) => {
    if (nnDragging) {
      nnDragging = null;
      return;
    }
    nnPanning = false;
  });

  neuralCanvas.addEventListener('click', (e) => {
    if (nnLinkMode) return;
    const rect = neuralCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Convert screen coordinates to world coordinates
    const wx = (mx - nnCamera.x) / nnCamera.zoom;
    const wy = (my - nnCamera.y) / nnCamera.zoom;

    const node = nnNodes.find(n => {
      const dx = wx - n.x, dy = wy - n.y;
      return Math.sqrt(dx * dx + dy * dy) < n.radius + 4;
    });

    if (node && node.type === 'target') {
      showNeuralPopup(node, e.clientX, e.clientY);
    } else if (node && node.type === 'folder') {
      openFolder(node.data);
    } else {
      hideNeuralPopup();
    }
  });

  // Wheel Zoom Listener
  neuralCanvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = neuralCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const zoomFactor = 1.08;
    const nextZoom = e.deltaY < 0 ? nnCamera.zoom * zoomFactor : nnCamera.zoom / zoomFactor;
    
    if (nextZoom < 0.25 || nextZoom > 4) return;

    nnCamera.x = mx - (mx - nnCamera.x) * (nextZoom / nnCamera.zoom);
    nnCamera.y = my - (my - nnCamera.y) * (nextZoom / nnCamera.zoom);
    nnCamera.zoom = nextZoom;
  });

  // Resize
  window.addEventListener('resize', () => {
    if (!neuralNetworkView || neuralNetworkView.classList.contains('hidden')) return;
    const rect = neuralCanvas.parentElement.getBoundingClientRect();
    neuralCanvas.width = rect.width * window.devicePixelRatio;
    neuralCanvas.height = rect.height * window.devicePixelRatio;
    nnCtx = neuralCanvas.getContext('2d');
    nnCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
    neuralCanvas._cssW = rect.width;
    neuralCanvas._cssH = rect.height;
  });
}

// ---- Zoom Buttons Interaction ----
const nnBtnZoomIn = document.getElementById('nn-btn-zoom-in');
const nnBtnZoomOut = document.getElementById('nn-btn-zoom-out');

function zoomCanvas(multiplier) {
  const cx = (neuralCanvas._cssW || 800) / 2;
  const cy = (neuralCanvas._cssH || 600) / 2;
  const nextZoom = nnCamera.zoom * multiplier;
  if (nextZoom < 0.25 || nextZoom > 4) return;

  nnCamera.x = cx - (cx - nnCamera.x) * (nextZoom / nnCamera.zoom);
  nnCamera.y = cy - (cy - nnCamera.y) * (nextZoom / nnCamera.zoom);
  nnCamera.zoom = nextZoom;
}

if (nnBtnZoomIn) nnBtnZoomIn.addEventListener('click', () => zoomCanvas(1.25));
if (nnBtnZoomOut) nnBtnZoomOut.addEventListener('click', () => zoomCanvas(1 / 1.25));

// ---- Neural Popup ----
function showNeuralPopup(node, x, y) {
  if (!neuralPopup) return;
  const person = node.data;

  // Avatar
  const allMedia = [];
  // Try to find a photo from media
  neuralPopupAvatar.innerHTML = `<div class="avatar-placeholder">${person.fullname.charAt(0)}</div>`;

  // Fetch media for this person to get avatar
  fetch(`/api/media?personId=${person.id}`)
    .then(r => r.ok ? r.json() : [])
    .then(media => {
      const photo = media.find(m => m.type === 'photo');
      if (photo) {
        neuralPopupAvatar.innerHTML = `<img src="${photo.src}" alt="${escHtml(person.fullname)}" />`;
      }
    }).catch(() => {});

  neuralPopupName.textContent = person.fullname.toUpperCase();

  let dataHtml = '';
  if (person.nick) dataHtml += `<div class="npd-row"><span class="npd-label">NICK:</span> ${escHtml(person.nick)}</div>`;
  if (person.cpf) dataHtml += `<div class="npd-row"><span class="npd-label">CPF:</span> ${escHtml(person.cpf)}</div>`;
  if (person.cidade) dataHtml += `<div class="npd-row"><span class="npd-label">CITY:</span> ${escHtml(person.cidade)}</div>`;
  if (person.telefone) dataHtml += `<div class="npd-row"><span class="npd-label">PHONE:</span> ${escHtml(person.telefone)}</div>`;
  if (person.email) dataHtml += `<div class="npd-row"><span class="npd-label">EMAIL:</span> ${escHtml(person.email)}</div>`;
  if (!dataHtml) dataHtml = '<div class="npd-row" style="color:var(--muted)">// MINIMAL DATA</div>';
  neuralPopupData.innerHTML = dataHtml;

  // Position popup
  const pw = 280, ph = 300;
  let px = x + 16, py = y - 16;
  if (px + pw > window.innerWidth) px = x - pw - 16;
  if (py + ph > window.innerHeight) py = window.innerHeight - ph - 16;
  if (py < 16) py = 16;

  neuralPopup.style.left = px + 'px';
  neuralPopup.style.top = py + 'px';
  neuralPopup.classList.remove('hidden');

  // Open dossier button
  neuralPopupOpen.onclick = () => {
    hideNeuralPopup();
    selectPerson(person.id);
  };
}

function hideNeuralPopup() {
  if (neuralPopup) neuralPopup.classList.add('hidden');
}

if (neuralPopupClose) neuralPopupClose.addEventListener('click', hideNeuralPopup);

// ---- Link Mode ----
if (nnBtnLinkMode) {
  nnBtnLinkMode.addEventListener('click', () => {
    nnLinkMode = !nnLinkMode;
    nnLinkSource = null;
    nnBtnLinkMode.classList.toggle('active', nnLinkMode);
  });
}

if (nnBtnReset) {
  nnBtnReset.addEventListener('click', () => {
    buildNeuralGraph();
  });
}

async function createFolderConnection(folderA, folderB) {
  // Add bidirectional connection
  folderA.connections = folderA.connections || [];
  folderB.connections = folderB.connections || [];

  if (!folderA.connections.includes(folderB.id)) {
    folderA.connections.push(folderB.id);
  }
  if (!folderB.connections.includes(folderA.id)) {
    folderB.connections.push(folderA.id);
  }

  // Save both folders
  try {
    await fetch('/api/folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(folderA) });
    await fetch('/api/folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(folderB) });
  } catch (err) { console.error('Connection save failed:', err); }

  // Update local data
  const idxA = folders.findIndex(f => f.id === folderA.id);
  const idxB = folders.findIndex(f => f.id === folderB.id);
  if (idxA !== -1) folders[idxA] = folderA;
  if (idxB !== -1) folders[idxB] = folderB;

  addSystemLog(`NETWORK: LINKED "${folderA.name.toUpperCase()}" ↔ "${folderB.name.toUpperCase()}"`);
}

// ---- Folder Targets Manage Modal (View & Delete targets in folder) ----
const folderManageModal = document.getElementById('folder-manage-modal');
const folderManageOverlay = document.getElementById('folder-manage-overlay');
const folderManageTitle = document.getElementById('folder-manage-title');
const folderTargetsList = document.getElementById('folder-targets-list');
const folderManageClose = document.getElementById('folder-manage-close');

function openFolderManageModal(folder) {
  if (!folderManageModal) return;
  folderManageTitle.textContent = `FOLDER: ${folder.name.toUpperCase()}`;
  renderFolderTargetsList(folder);
  folderManageModal.classList.remove('hidden');
}

function renderFolderTargetsList(folder) {
  if (!folderTargetsList) return;
  folderTargetsList.innerHTML = '';
  
  const folderTargets = people.filter(p => (folder.targetIds || []).includes(p.id));
  
  if (folderTargets.length === 0) {
    folderTargetsList.innerHTML = '<div class="admin-empty" style="text-align:center; padding:16px;">// NO TARGETS IN THIS FOLDER</div>';
  } else {
    folderTargets.forEach(t => {
      const row = document.createElement('div');
      row.className = 'admin-list-item';
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      row.style.padding = '8px 12px';
      row.style.borderBottom = '1px solid var(--surface2)';
      
      row.innerHTML = `
        <span style="font-size:.65rem; text-transform:uppercase; font-weight:bold; color:var(--fg);">${escHtml(t.fullname)}</span>
        <button class="btn-bracket-sm btn-bracket-danger btn-remove-target" data-tid="${t.id}" style="font-size:.5rem; padding: 2px 6px;">REMOVE</button>
      `;
      
      row.querySelector('.btn-remove-target').addEventListener('click', async (e) => {
        const tid = e.target.dataset.tid;
        if (!confirm(`REMOVE "${t.fullname.toUpperCase()}" FROM FOLDER "${folder.name.toUpperCase()}"?`)) return;
        
        folder.targetIds = (folder.targetIds || []).filter(id => id !== tid);
        
        try {
          await fetch('/api/folders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(folder)
          });
        } catch (err) { console.error(err); }
        
        const idx = folders.findIndex(f => f.id === folder.id);
        if (idx !== -1) folders[idx] = folder;
        
        addSystemLog(`FOLDER: REMOVED "${t.fullname.toUpperCase()}" FROM "${folder.name.toUpperCase()}"`);
        
        renderFolderTargetsList(folder);
        renderFoldersGrid();
        renderPeopleList();
        if (currentPerson && currentPerson.id === tid) {
          renderDossieHeader(currentPerson);
        }
      });
      
      folderTargetsList.appendChild(row);
    });
  }

  // Populate Select Dropdown with targets not in this folder
  const addSelect = document.getElementById('folder-manage-add-select');
  const addBtn = document.getElementById('folder-manage-add-btn');
  if (addSelect) {
    addSelect.innerHTML = '';
    const targetsNotInFolder = people.filter(p => !(folder.targetIds || []).includes(p.id));
    
    if (targetsNotInFolder.length === 0) {
      addSelect.innerHTML = '<option value="">// ALL TARGETS ASSOCIATED</option>';
      if (addBtn) addBtn.disabled = true;
    } else {
      if (addBtn) addBtn.disabled = false;
      const defaultOpt = document.createElement('option');
      defaultOpt.value = '';
      defaultOpt.textContent = '-- SELECT TARGET TO ADD --';
      addSelect.appendChild(defaultOpt);

      targetsNotInFolder.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.fullname.toUpperCase();
        addSelect.appendChild(opt);
      });
    }

    if (addBtn) {
      addBtn.onclick = async () => {
        const tid = addSelect.value;
        if (!tid) return;

        const target = people.find(p => p.id === tid);
        if (!target) return;

        folder.targetIds = folder.targetIds || [];
        if (!folder.targetIds.includes(tid)) {
          folder.targetIds.push(tid);
        }

        try {
          await fetch('/api/folders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(folder)
          });
        } catch (err) { console.error(err); }

        const idx = folders.findIndex(f => f.id === folder.id);
        if (idx !== -1) folders[idx] = folder;

        addSystemLog(`FOLDER: ADDED "${target.fullname.toUpperCase()}" TO "${folder.name.toUpperCase()}"`);

        renderFolderTargetsList(folder);
        renderFoldersGrid();
        renderPeopleList();
        if (currentPerson && currentPerson.id === tid) {
          renderDossieHeader(currentPerson);
        }
      };
    }
  }
}

if (folderManageClose) folderManageClose.addEventListener('click', () => folderManageModal.classList.add('hidden'));
if (folderManageOverlay) folderManageOverlay.addEventListener('click', () => folderManageModal.classList.add('hidden'));

// ---- Assign Target to Folder Modal ----
const btnAddToFolder = document.getElementById('btn-add-to-folder');
const folderAssignModal = document.getElementById('folder-assign-modal');
const folderAssignOverlay = document.getElementById('folder-assign-overlay');
const folderAssignList = document.getElementById('folder-assign-list');
const folderAssignSave = document.getElementById('folder-assign-save');
const folderAssignSubtitle = document.getElementById('folder-assign-subtitle');

if (btnAddToFolder) {
  btnAddToFolder.addEventListener('click', () => {
    if (!currentPerson) return;
    if (!isAdmin()) { alert('ACCESS DENIED - ADMIN ONLY'); return; }
    
    if (folderAssignSubtitle) {
      folderAssignSubtitle.textContent = `// ASSIGN FOLDERS FOR ${currentPerson.fullname.toUpperCase()}`;
    }
    renderFolderAssignList(currentPerson);
    folderAssignModal.classList.remove('hidden');
  });
}

function renderFolderAssignList(person) {
  if (!folderAssignList) return;
  folderAssignList.innerHTML = '';
  
  if (folders.length === 0) {
    folderAssignList.innerHTML = '<div style="font-size:.6rem; color:var(--muted); text-align:center; padding:12px;">// NO FOLDERS CREATED YET. CREATE ONE FIRST.</div>';
    return;
  }
  
  folders.forEach(f => {
    const isAssigned = (f.targetIds || []).includes(person.id);
    const item = document.createElement('label');
    item.className = 'folder-assign-item';
    
    item.innerHTML = `
      <input type="checkbox" data-fid="${f.id}" ${isAssigned ? 'checked' : ''} />
      <div class="folder-assign-label-wrap">
        <span class="folder-assign-color-dot" style="background:${f.color || '#E74C3C'}"></span>
        <span class="folder-assign-name" style="color:var(--fg);">${escHtml(f.name)}</span>
      </div>
      <span class="folder-assign-targets-count">${(f.targetIds || []).length} Targets</span>
    `;
    
    folderAssignList.appendChild(item);
  });
}

if (folderAssignSave) {
  folderAssignSave.addEventListener('click', async () => {
    if (!currentPerson) return;
    
    const checkboxes = folderAssignList.querySelectorAll('input[type="checkbox"]');
    for (const cb of checkboxes) {
      const fid = cb.dataset.fid;
      const folder = folders.find(f => f.id === fid);
      if (!folder) continue;
      
      const isChecked = cb.checked;
      let targetIds = folder.targetIds || [];
      const includesTarget = targetIds.includes(currentPerson.id);
      
      let modified = false;
      if (isChecked && !includesTarget) {
        targetIds.push(currentPerson.id);
        modified = true;
      } else if (!isChecked && includesTarget) {
        targetIds = targetIds.filter(id => id !== currentPerson.id);
        modified = true;
      }
      
      if (modified) {
        folder.targetIds = targetIds;
        try {
          await fetch('/api/folders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(folder)
          });
        } catch (err) {}
        
        const idx = folders.findIndex(f => f.id === fid);
        if (idx !== -1) folders[idx] = folder;
      }
    }
    
    addSystemLog(`FOLDER: ASSIGNMENT UPDATED FOR "${currentPerson.fullname.toUpperCase()}"`);
    folderAssignModal.classList.add('hidden');
    renderFoldersGrid();
    renderPeopleList();
    renderDossieHeader(currentPerson);
  });
}

if (folderAssignOverlay) folderAssignOverlay.addEventListener('click', () => folderAssignModal.classList.add('hidden'));

// ---- Decrypt Dossier Lock Banner Button ----
const btnDossieDecrypt = document.getElementById('btn-dossie-decrypt');
if (btnDossieDecrypt) {
  btnDossieDecrypt.addEventListener('click', () => {
    if (!currentPerson) return;
    // Find the first locked folder containing this person
    const lockedFolder = folders.find(f => (f.targetIds || []).includes(currentPerson.id) && isFolderLocked(f));
    if (lockedFolder) {
      openFolder(lockedFolder);
    }
  });
}

// ---- Auto Open Manage Modal for no-password folder ----
const originalActivateFolder = activateFolder;
activateFolder = function(folder) {
  originalActivateFolder(folder);
  openFolderManageModal(folder);
};

