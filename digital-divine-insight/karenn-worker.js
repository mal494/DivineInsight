// karenn-worker.js
// A background "nag" observer. It never triggers actions; it only comments on events.

const STATE = Object.freeze({
  BOOTING: 'booting',
  IDLE: 'idle',
  CHANNELING: 'channeling',
  REVEALED: 'revealed',
  ERROR: 'error',
});

let currentState = STATE.BOOTING;
let nagToken = 0;
let lastSaidAtByKey = new Map();
let lastMessageText = '';

function nowMs() {
  return Date.now();
}

function cooldownOk(dedupeKey, cooldownMs) {
  const last = lastSaidAtByKey.get(dedupeKey) || 0;
  const n = nowMs();
  if (n - last < cooldownMs) return false;
  lastSaidAtByKey.set(dedupeKey, n);
  return true;
}

function say(text, { level = 'info', dedupeKey = 'karenn:generic', cooldownMs = 1200 } = {}) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return;
  if (!cooldownOk(dedupeKey, cooldownMs)) return;

  lastMessageText = trimmed;
  self.postMessage({
    type: 'KARENN_SAY',
    payload: {
      text: trimmed,
      level,
      dedupeKey,
    },
  });
}

function dominantAxis(localWeights) {
  if (!localWeights || typeof localWeights !== 'object') return 'balance';
  const keys = Object.keys(localWeights);
  if (!keys.length) return 'balance';
  return keys.reduce((best, key) => (Number(localWeights[key]) > Number(localWeights[best]) ? key : best), keys[0]);
}

function scheduleChannelingNags() {
  const token = ++nagToken;
  const lines = [
    'Are you done yet?',
    'Are you done yet? The suspense is exhausting.',
    'Any day now. Are you done yet?',
  ];

  lines.forEach((line, index) => {
    const delay = 1800 + index * 2200;
    setTimeout(() => {
      if (token !== nagToken) return;
      if (currentState !== STATE.CHANNELING) return;
      say(line, { dedupeKey: `karenn:channeling:${index}`, cooldownMs: 1500 });
    }, delay);
  });
}

function scheduleIdleNag() {
  const token = ++nagToken;
  setTimeout(() => {
    if (token !== nagToken) return;
    if (currentState !== STATE.IDLE) return;
    say('Still thinking? Are you done yet?', { dedupeKey: 'karenn:idle', cooldownMs: 15000 });
  }, 25000);
}

function onStateChanged(nextState) {
  currentState = nextState;

  if (currentState === STATE.CHANNELING) {
    scheduleChannelingNags();
    return;
  }

  if (currentState === STATE.IDLE) {
    scheduleIdleNag();
    return;
  }

  // Cancel pending scheduled nags when leaving idle/channeling.
  nagToken++;
}

function onDrawResult(payload) {
  const cardName = payload?.cardName || 'that card';
  const orientation = payload?.orientation === 'reversed' ? 'reversed' : 'upright';
  const axis = dominantAxis(payload?.localWeights);

  const axisLine = axis === 'balance'
    ? 'No dominant axis. Indecisive. On brand.'
    : `Dominant axis: ${axis}. Of course it is.`;

  say(`So you pulled ${cardName} (${orientation}). ${axisLine}`, {
    dedupeKey: `karenn:draw:${String(cardName).toLowerCase()}:${orientation}:${axis}`,
    cooldownMs: 800,
  });
}

self.onmessage = (event) => {
  const data = event?.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'KARENN_EVENT') {
    const { eventType, payload } = data.payload || {};
    const type = String(eventType || '');

    if (type === 'APP_BOOT') {
      say('Booting. Try not to break anything.', { dedupeKey: 'karenn:boot', cooldownMs: 1 });
      return;
    }

    if (type === 'STATE_CHANGED') {
      const nextState = String(payload?.nextState || '');
      if (Object.values(STATE).includes(nextState)) onStateChanged(nextState);
      return;
    }

    if (type === 'DRAW_REQUESTED') {
      say('Here we go again.', { dedupeKey: 'karenn:draw_requested', cooldownMs: 1200 });
      return;
    }

    if (type === 'DRAW_RESULT') {
      onDrawResult(payload);
      return;
    }

    if (type === 'DRAW_ERROR' || type === 'APP_ERROR') {
      say('Error. Shocking.', { level: 'error', dedupeKey: 'karenn:error', cooldownMs: 1200 });
      return;
    }

    if (type === 'JOURNAL_OPEN') {
      say('Reviewing your past decisions. Bold.', { dedupeKey: 'karenn:journal_open', cooldownMs: 2000 });
      return;
    }

    if (type === 'JOURNAL_CLEAR') {
      say('Erasing history. Classic.', { dedupeKey: 'karenn:journal_clear', cooldownMs: 2000 });
      return;
    }

    if (type === 'RESET_ALTAR') {
      say('Resetting. Again.', { dedupeKey: 'karenn:reset', cooldownMs: 1200 });
      return;
    }

    return;
  }

  if (data.type === 'KARENN_REPEAT_LAST') {
    if (lastMessageText) {
      self.postMessage({
        type: 'KARENN_SAY',
        payload: { text: lastMessageText, level: 'info', dedupeKey: 'karenn:repeat' },
      });
    }
  }
};

