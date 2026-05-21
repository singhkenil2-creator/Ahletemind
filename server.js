const express = require('express');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;
const DB   = path.join(__dirname, 'roadtopro_db.json');

// ─── ADMIN PASSWORD ─────────────────────────────────────────────────────────
const ADMIN_PASSWORD = 'footballadmin';
// ─────────────────────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

// ─── JSON "DATABASE" ─────────────────────────────────────────────────────────
function readDB() {
  try {
    if (!fs.existsSync(DB)) return { users: {}, syncLog: [] };
    return JSON.parse(fs.readFileSync(DB, 'utf8'));
  } catch { return { users: {}, syncLog: [] }; }
}

function writeDB(db) {
  if (db.syncLog.length > 5000) db.syncLog = db.syncLog.slice(-5000);
  fs.writeFileSync(DB, JSON.stringify(db, null, 2));
}

function now() { return new Date().toISOString(); }

function authAdmin(req, res) {
  if (req.headers['x-admin-password'] !== ADMIN_PASSWORD) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

// ─── ROUTES ──────────────────────────────────────────────────────────────────

// POST /api/sync
app.post('/api/sync', (req, res) => {
  try {
    const { deviceId, data } = req.body;
    if (!deviceId || !data) return res.status(400).json({ error: 'Missing fields' });

    const db = readDB();
    const existing = db.users[deviceId];

    db.users[deviceId] = {
      device_id:  deviceId,
      name:       data.user?.name  || 'Unknown',
      sport:      data.sport       || 'unknown',
      streak:     data.streak      || 0,
      xp:         data.xp         || 0,
      first_seen: existing?.first_seen || now(),
      last_seen:  now(),
      data
    };

    db.syncLog.push({ device_id: deviceId, synced_at: now(), data_size: JSON.stringify(data).length });
    writeDB(db);
    res.json({ ok: true });
  } catch (e) {
    console.error('Sync error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/admin/users
app.get('/api/admin/users', (req, res) => {
  if (!authAdmin(req, res)) return;
  const db = readDB();
  const users = Object.values(db.users)
    .sort((a, b) => b.last_seen.localeCompare(a.last_seen))
    .map(u => ({
      device_id:  u.device_id,
      name:       u.name,
      sport:      u.sport,
      streak:     u.streak,
      xp:         u.xp,
      first_seen: u.first_seen,
      last_seen:  u.last_seen,
      sync_count: db.syncLog.filter(l => l.device_id === u.device_id).length
    }));
  res.json(users);
});

// GET /api/admin/user/:id
app.get('/api/admin/user/:id', (req, res) => {
  if (!authAdmin(req, res)) return;
  const db = readDB();
  const u = db.users[req.params.id];
  if (!u) return res.status(404).json({ error: 'Not found' });
  res.json(u);
});

// GET /api/admin/stats
app.get('/api/admin/stats', (req, res) => {
  if (!authAdmin(req, res)) return;
  const db = readDB();
  const userList = Object.values(db.users);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const sportCount = {};
  userList.forEach(u => { sportCount[u.sport] = (sportCount[u.sport] || 0) + 1; });
  const topSports = Object.entries(sportCount)
    .map(([sport, count]) => ({ sport, count }))
    .sort((a, b) => b.count - a.count);

  const topStreaks = userList
    .sort((a, b) => b.streak - a.streak)
    .slice(0, 10)
    .map(u => ({ name: u.name, sport: u.sport, streak: u.streak, xp: u.xp }));

  const dayMap = {};
  db.syncLog.forEach(l => {
    const day = l.synced_at.slice(0, 10);
    dayMap[day] = (dayMap[day] || 0) + 1;
  });
  const syncsPerDay = Object.entries(dayMap)
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => a.day.localeCompare(b.day))
    .slice(-30);

  res.json({
    totalUsers:  userList.length,
    totalSyncs:  db.syncLog.length,
    activeLast7: userList.filter(u => u.last_seen >= sevenDaysAgo).length,
    topSports,
    topStreaks,
    syncsPerDay
  });
});

// DELETE /api/admin/user/:id
app.delete('/api/admin/user/:id', (req, res) => {
  if (!authAdmin(req, res)) return;
  const db = readDB();
  delete db.users[req.params.id];
  db.syncLog = db.syncLog.filter(l => l.device_id !== req.params.id);
  writeDB(db);
  res.json({ ok: true });
});

// Admin panel
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// All other routes → main app
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════╗');
  console.log('  ║     Road to Pro — Server Running     ║');
  console.log('  ╠══════════════════════════════════════╣');
  console.log(`  ║  App:    http://localhost:${PORT}         ║`);
  console.log(`  ║  Admin:  http://localhost:${PORT}/admin   ║`);
  console.log(`  ║  DB:     roadtopro_db.json            ║`);
  console.log('  ╚══════════════════════════════════════╝');
  console.log('');
});
