const crypto = require('crypto');

// Validates the initData string Telegram Mini Apps send, per:
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
function validateInitData(initData, botToken) {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const pairs = [];
  for (const [key, value] of params.entries()) pairs.push(`${key}=${value}`);
  pairs.sort();
  const dataCheckString = pairs.join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (computedHash !== hash) return null;

  const authDate = Number(params.get('auth_date') || 0);
  const ageSeconds = Date.now() / 1000 - authDate;
  if (ageSeconds > 60 * 60 * 24) return null; // reject initData older than 24h

  const userJson = params.get('user');
  return userJson ? JSON.parse(userJson) : null;
}

module.exports = { validateInitData };
