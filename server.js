require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { validateInitData } = require('./telegramAuth');
const { startReminderLoop } = require('./reminders');
const store = require('./store');

const app = express();
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '*';

app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json());

// ---- auth middleware ----
function authTelegram(req, res, next) {
  const initData = req.headers['x-telegram-init-data'];

  // Dev convenience: allow bypassing Telegram auth locally with a fake user id.
  if (process.env.NODE_ENV !== 'production' && req.headers['x-dev-user-id']) {
    req.userId = String(req.headers['x-dev-user-id']);
    store.ensureUser(req.userId, { first_name: 'Dev' });
    return next();
  }

  const user = validateInitData(initData, BOT_TOKEN);
  if (!user) return res.status(401).json({ error: 'invalid_telegram_init_data' });

  req.userId = String(user.id);
  store.ensureUser(req.userId, user);
  next();
}

app.use('/api', authTelegram);

// ---- songs ----
app.get('/api/songs', (req, res) => {
  res.json(store.listSongs(req.userId));
});

app.post('/api/songs', (req, res) => {
  const song = store.createSong(req.userId, req.body || {});
  res.json(song);
});

app.put('/api/songs/:id', (req, res) => {
  const song = store.updateSong(req.userId, req.params.id, req.body || {});
  if (!song) return res.status(404).json({ error: 'not_found' });
  res.json(song);
});

app.delete('/api/songs/:id', (req, res) => {
  const ok = store.deleteSong(req.userId, req.params.id);
  if (!ok) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

// ---- stems ----
app.put('/api/songs/:id/stems', (req, res) => {
  const names = Array.isArray(req.body?.names) ? req.body.names : [];
  const song = store.setStems(req.userId, req.params.id, names);
  if (!song) return res.status(404).json({ error: 'not_found' });
  res.json(song);
});

app.put('/api/songs/:id/stems/:stemId', (req, res) => {
  const { status } = req.body || {};
  if (!['not_started', 'in_progress', 'done'].includes(status)) {
    return res.status(400).json({ error: 'invalid_status' });
  }
  const song = store.updateStem(req.userId, req.params.id, req.params.stemId, status);
  if (!song) return res.status(404).json({ error: 'not_found' });
  res.json(song);
});

// ---- playlists ----
app.get('/api/playlists', (req, res) => {
  res.json(store.listPlaylists(req.userId));
});

app.post('/api/playlists', (req, res) => {
  const pl = store.createPlaylist(req.userId, req.body?.name);
  res.json(pl);
});

app.put('/api/playlists/:id', (req, res) => {
  const pl = store.renamePlaylist(req.userId, req.params.id, req.body?.name);
  if (!pl) return res.status(404).json({ error: 'not_found' });
  res.json(pl);
});

app.delete('/api/playlists/:id', (req, res) => {
  const ok = store.deletePlaylist(req.userId, req.params.id);
  if (!ok) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

app.put('/api/playlists/:id/songs', (req, res) => {
  const songIds = Array.isArray(req.body?.songIds) ? req.body.songIds : [];
  const pl = store.setPlaylistSongs(req.userId, req.params.id, songIds);
  if (!pl) return res.status(404).json({ error: 'not_found' });
  res.json(pl);
});

app.get('/', (req, res) => res.send('Song tracker backend is running.'));

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  if (!BOT_TOKEN) {
    console.warn('WARNING: BOT_TOKEN is not set — Telegram auth and reminders will not work.');
  } else {
    startReminderLoop(BOT_TOKEN);
  }
});
