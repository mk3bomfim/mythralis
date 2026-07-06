// ============================================================
//  TDN — ACCOUNT & INVITE SYSTEM

function safeGetItem(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
function safeSetItem(key, value) {
  try { localStorage.setItem(key, value); } catch (e) {}
}
function safeRemoveItem(key) {
  try { localStorage.removeItem(key); } catch (e) {}
}


async function initAccounts() {
  await openDB();
  
  // 1. Sync users from server
  try {
    const res = await fetch('/api/users');
    if (res.ok) {
      const serverUsers = await res.json();
      for (const u of serverUsers) {
        await dbPut('users', u);
      }
    }
  } catch (err) {
    console.warn("Failed to sync users from server:", err);
  }

  // 2. Sync invites from server
  try {
    const res = await fetch('/api/invites');
    if (res.ok) {
      const serverInvites = await res.json();
      for (const i of serverInvites) {
        await dbPut('invites', i);
      }
    }
  } catch (err) {
    console.warn("Failed to sync invites from server:", err);
  }

  const users = await dbGetAll('users');
  
  // Create default admin if no users exist
  if (users.length === 0) {
    const admin = {
      id: crypto.randomUUID(),
      username: 'admin',
      password: hashPassword('Mithralisf348rhnefwweifiwefjwegj34'),
      role: 'admin',
      created: new Date().toISOString()
    };
    await dbPut('users', admin);
    
    // Also save default admin to server
    try {
      await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(admin)
      });
    } catch(e) {}
    
    console.log('✓ Default admin created with secure password');
  } else {
    // Automatically migrate old default passwords to secure default
    const adminUser = users.find(u => u.username === 'admin');
    if (adminUser && (adminUser.password === hashPassword('1234') || adminUser.password === hashPassword('Mithralis@2026#'))) {
      adminUser.password = hashPassword('Mithralisf348rhnefwweifiwefjwegj34');
      await dbPut('users', adminUser);
      
      // Also save updated admin to server
      try {
        await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(adminUser)
        });
      } catch(e) {}
      
      console.log('✓ Default admin password upgraded to secure value');
    }
  }
}

// Simple hash (for demo — use bcrypt in production)
function hashPassword(pass) {
  let hash = 0;
  for (let i = 0; i < pass.length; i++) {
    hash = ((hash << 5) - hash) + pass.charCodeAt(i);
    hash = hash & hash;
  }
  return hash.toString(36);
}

// ---- Login ----
async function login(username, password) {
  await openDB();
  const users = await dbGetAll('users');
  const user = users.find(u => u.username === username);
  
  if (!user) return { success: false, error: 'USER NOT FOUND' };
  
  const hash = hashPassword(password);
  if (user.password !== hash) return { success: false, error: 'INVALID PASSWORD' };
  
  currentUser = user;
  safeSetItem('tdn_user', JSON.stringify(user));
  return { success: true, user };
}

// ---- Auto-login from localStorage ----
function autoLogin() {
  const stored = safeGetItem('tdn_user');
  if (stored) {
    currentUser = JSON.parse(stored);
    return true;
  }
  return false;
}

// ---- Logout ----
function logout() {
  currentUser = null;
  safeRemoveItem('tdn_user');
}

// ---- Register with invite ----
async function registerWithInvite(inviteCode, username, password) {
  await openDB();
  
  // Validate invite
  const invites = await dbGetAll('invites');
  const invite = invites.find(i => i.code === inviteCode && !i.used);
  
  if (!invite) return { success: false, error: 'INVALID OR USED INVITE CODE' };
  
  // Check username uniqueness
  const users = await dbGetAll('users');
  if (users.some(u => u.username === username)) {
    return { success: false, error: 'USERNAME ALREADY EXISTS' };
  }
  
  // Create user
  const user = {
    id: crypto.randomUUID(),
    username,
    password: hashPassword(password),
    role: 'user',
    created: new Date().toISOString()
  };
  await dbPut('users', user);
  
  // Save user to server
  try {
    await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
  } catch (err) {
    console.warn("Failed to save user to server:", err);
  }
  
  // Mark invite as used
  invite.used = true;
  invite.usedBy = user.id;
  invite.usedAt = new Date().toISOString();
  await dbPut('invites', invite);
  
  // Save invite update to server
  try {
    await fetch('/api/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invite)
    });
  } catch (err) {
    console.warn("Failed to save invite to server:", err);
  }
  
  return { success: true, user };
}

// ---- Generate invite (admin only) ----
async function generateInvite() {
  if (!currentUser || currentUser.role !== 'admin') {
    return { success: false, error: 'ADMIN ACCESS REQUIRED' };
  }
  
  const code = crypto.randomUUID().split('-')[0].toUpperCase(); // short code
  const invite = {
    code,
    createdBy: currentUser.id,
    createdAt: new Date().toISOString(),
    used: false
  };
  
  await dbPut('invites', invite);
  
  // Save invite to server
  try {
    await fetch('/api/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invite)
    });
  } catch (err) {
    console.warn("Failed to save invite to server:", err);
  }
  
  return { success: true, code };
}

// ---- List users (admin only) ----
async function listUsers() {
  if (!currentUser || currentUser.role !== 'admin') return [];
  return await dbGetAll('users');
}

// ---- List invites (admin only) ----
async function listInvites() {
  if (!currentUser || currentUser.role !== 'admin') return [];
  return await dbGetAll('invites');
}

// ---- Delete invite (admin only) ----
async function deleteInvite(code) {
  if (!currentUser || currentUser.role !== 'admin') {
    return { success: false, error: 'ADMIN ACCESS REQUIRED' };
  }
  await dbDelete('invites', code);
  
  // Delete invite from server
  try {
    await fetch(`/api/invites?code=${code}`, { method: 'DELETE' });
  } catch (err) {
    console.warn("Failed to delete invite from server:", err);
  }
  
  return { success: true };
}

// ---- Revoke invite (admin only) ----
async function revokeInvite(code) {
  if (!currentUser || currentUser.role !== 'admin') {
    return { success: false, error: 'ADMIN ACCESS REQUIRED' };
  }
  const invites = await dbGetAll('invites');
  const invite = invites.find(i => i.code === code);
  if (!invite) return { success: false, error: 'INVITE NOT FOUND' };
  
  invite.used = true;
  invite.revokedBy = currentUser.id;
  invite.revokedAt = new Date().toISOString();
  await dbPut('invites', invite);
  
  // Save invite update to server
  try {
    await fetch('/api/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invite)
    });
  } catch (err) {
    console.warn("Failed to save invite to server:", err);
  }
  
  return { success: true };
}
async function deleteUser(userId) {
  if (!currentUser || currentUser.role !== 'admin') {
    return { success: false, error: 'ADMIN ACCESS REQUIRED' };
  }
  if (userId === currentUser.id) {
    return { success: false, error: 'CANNOT DELETE YOURSELF' };
  }
  
  // Delete all targets of this user
  const allPeople = await dbGetAll('people');
  const userPeople = allPeople.filter(p => p.userId === userId);
  
  for (const person of userPeople) {
    const media = await dbGetByIndex('media', 'personId', person.id);
    for (const m of media) await dbDelete('media', m.id);
    await dbDelete('people', person.id);
  }
  
  await dbDelete('users', userId);
  
  // Delete user from server
  try {
    await fetch(`/api/users?id=${userId}`, { method: 'DELETE' });
  } catch (err) {
    console.warn("Failed to delete user from server:", err);
  }
  
  return { success: true };
}

// ---- Change user role (admin only) ----
async function changeUserRole(userId, newRole) {
  if (!currentUser || currentUser.role !== 'admin') {
    return { success: false, error: 'ADMIN ACCESS REQUIRED' };
  }
  if (userId === currentUser.id) {
    return { success: false, error: 'CANNOT CHANGE YOUR OWN ROLE' };
  }
  if (!['admin', 'user'].includes(newRole)) {
    return { success: false, error: 'INVALID ROLE' };
  }
  
  const users = await dbGetAll('users');
  const user = users.find(u => u.id === userId);
  if (!user) return { success: false, error: 'USER NOT FOUND' };
  
  user.role = newRole;
  await dbPut('users', user);
  
  // Save user update to server
  try {
    await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
  } catch (err) {
    console.warn("Failed to save user update to server:", err);
  }
  
  return { success: true };
}

// ---- Helper: check if user is admin ----
function isAdmin() {
  return currentUser && currentUser.role === 'admin';
}
