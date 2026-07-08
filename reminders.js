const store = require('./store');

const DAY_MS = 24 * 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // check every hour

async function sendTelegramMessage(botToken, chatId, text) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    const data = await res.json();
    if (!data.ok) console.error('Telegram sendMessage failed:', data);
  } catch (err) {
    console.error('Telegram sendMessage error:', err);
  }
}

async function checkReminders(botToken) {
  if (!botToken) return;
  const songs = store.allSongsForReminders();
  const now = Date.now();

  for (const song of songs) {
    if (song.stage === 'ready_release') continue; // finished songs don't need nudging
    if (!song.reminderDays || song.reminderDays <= 0) continue;

    const staleFor = now - song.lastTouchedAt;
    const thresholdMs = song.reminderDays * DAY_MS;
    const alreadyNotifiedThisCycle = song.notifiedForTouchAt === song.lastTouchedAt;

    if (staleFor >= thresholdMs && !alreadyNotifiedThisCycle) {
      const days = Math.floor(staleFor / DAY_MS);
      const text =
        `🎛 «${song.title}» лежит без движения уже ${days} дн.\n` +
        `Текущий этап: ${stageLabel(song.stage)}.\n` +
        `Может, пора вернуться и продвинуть её дальше?`;
      await sendTelegramMessage(botToken, song.userId, text);
      store.markNotified(song.id, song.lastTouchedAt);
    }
  }
}

function stageLabel(stage) {
  const map = {
    idea: 'Идея',
    demo: 'Демо',
    recording: 'Запись дорожек',
    mixed_no_vocals: 'Сведено (без вокала)',
    vocal_final: 'Вокал + финальное сведение',
    ready_release: 'Готово к релизу',
  };
  return map[stage] || stage;
}

function startReminderLoop(botToken) {
  // run once shortly after boot, then on a fixed interval
  setTimeout(() => checkReminders(botToken), 15_000);
  setInterval(() => checkReminders(botToken), CHECK_INTERVAL_MS);
}

module.exports = { startReminderLoop, checkReminders };
