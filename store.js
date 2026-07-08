const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'db.json');

function ensureDbFile() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ users: {}, songs: {}, playlists: {} }, null, 2));
  }
}
ensureDbFile();

function load() {
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}
function save(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function genId(prefix) {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// ---- users ----
function ensureUser(telegramId, tgUser) {
  const db = load();
  if (!db.users[telegramId]) {
    db.users[telegramId] = {
      id: telegramId,
      firstName: tgUser?.first_name || '',
      username: tgUser?.username || '',
      createdAt: Date.now(),
    };
    save(db);
  }
  return db.users[telegramId];
}

// ---- songs ----
function listSongs(userId) {
  const db = load();
  return Object.values(db.songs).filter((s) => s.userId === userId);
}
function getSong(userId, songId) {
  const db = load();
  const s = db.songs[songId];
  if (!s || s.userId !== userId) return null;
  return s;
}
function createSong(userId, { title, ideaNotes }) {
  const db = load();
  const id = genId('song');
  const now = Date.now();
  db.songs[id] = {
    id,
    userId,
    title: title || 'Без названия',
    ideaNotes: ideaNotes || '',
    stage: 'idea',
    reminderDays: 7,
    stems: [],
    lastTouchedAt: now,
    notifiedForTouchAt: null,
    createdAt: now,
  };
  save(db);
  return db.songs[id];
}
function updateSong(userId, songId, patch) {
  const db = load();
  const s = db.songs[songId];
  if (!s || s.userId !== userId) return null;
  const allowed = ['title', 'ideaNotes', 'stage', 'reminderDays'];
  for (const k of allowed) {
    if (patch[k] !== undefined) s[k] = patch[k];
  }
  s.lastTouchedAt = Date.now();
  s.notifiedForTouchAt = null; // reset reminder cycle whenever song is touched
  save(db);
  return s;
}
function deleteSong(userId, songId) {
  const db = load();
  const s = db.songs[songId];
  if (!s || s.userId !== userId) return false;
  delete db.songs[songId];
  for (const pl of Object.values(db.playlists)) {
    pl.songIds = pl.songIds.filter((id) => id !== songId);
  }
  save(db);
  return true;
}

// ---- stems ----
function setStems(userId, songId, names) {
  const db = load();
  const s = db.songs[songId];
  if (!s || s.userId !== userId) return null;
  const existingByName = Object.fromEntries(s.stems.map((st) => [st.name, st]));
  s.stems = names.map((name) => existingByName[name] || { id: genId('stem'), name, status: 'not_started' });
  s.lastTouchedAt = Date.now();
  s.notifiedForTouchAt = null;
  save(db);
  return s;
}
function updateStem(userId, songId, stemId, status) {
  const db = load();
  const s = db.songs[songId];
  if (!s || s.userId !== userId) return null;
  const stem = s.stems.find((st) => st.id === stemId);
  if (!stem) return null;
  stem.status = status;
  s.lastTouchedAt = Date.now();
  s.notifiedForTouchAt = null;
  save(db);
  return s;
}

// ---- playlists ----
function listPlaylists(userId) {
  const db = load();
  return Object.values(db.playlists).filter((p) => p.userId === userId);
}
function createPlaylist(userId, name) {
  const db = load();
  const id = genId('pl');
  db.playlists[id] = { id, userId, name: name || 'Новый плейлист', songIds: [], createdAt: Date.now() };
  save(db);
  return db.playlists[id];
}
function renamePlaylist(userId, playlistId, name) {
  const db = load();
  const p = db.playlists[playlistId];
  if (!p || p.userId !== userId) return null;
  p.name = name;
  save(db);
  return p;
}
function deletePlaylist(userId, playlistId) {
  const db = load();
  const p = db.playlists[playlistId];
  if (!p || p.userId !== userId) return false;
  delete db.playlists[playlistId];
  save(db);
  return true;
}
function setPlaylistSongs(userId, playlistId, songIds) {
  const db = load();
  const p = db.playlists[playlistId];
  if (!p || p.userId !== userId) return null;
  p.songIds = songIds;
  save(db);
  return p;
}

// ---- reminders (used by cron) ----
function allSongsForReminders() {
  const db = load();
  return Object.values(db.songs).map((s) => ({ ...s, userId: s.userId }));
}
function markNotified(songId, touchedAt) {
  const db = load();
  const s = db.songs[songId];
  if (!s) return;
  s.notifiedForTouchAt = touchedAt;
  save(db);
}

module.exports = {
  ensureUser,
  listSongs, getSong, createSong, updateSong, deleteSong,
  setStems, updateStem,
  listPlaylists, createPlaylist, renamePlaylist, deletePlaylist, setPlaylistSongs,
  allSongsForReminders, markNotified,
};
