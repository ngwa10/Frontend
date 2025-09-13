require('dotenv').config();

const express = require('express');
const path = require('path');
const WebSocket = require('ws');
const { recordTrade, getSummary, resetPeriod } = require('./metrics');

// Credentials from .env
const TELEGRAM_API_ID = process.env.TELEGRAM_API_ID;
const TELEGRAM_API_HASH = process.env.TELEGRAM_API_HASH;
const TELEGRAM_SESSION_STRING = process.env.TELEGRAM_SESSION_STRING;
const CHANNEL_IDS = process.env.CHANNEL_IDS
  ? process.env.CHANNEL_IDS.split(',').map(id => Number(id.trim()))
  : [];
const WS_URL = process.env.WS_URL;
const PORT = process.env.PORT || 8080;

let logs = [];
function log(msg) {
  logs.unshift(msg);
  if (logs.length > 300) logs.pop();
}

// --- WebSocket to Auto Clicker ---
let ws;
function connectWS() {
  ws = new WebSocket(WS_URL);
  ws.on('open', () => log({ type: 'system', msg: 'WebSocket connected.' }));
  ws.on('message', data => {
    try {
      const msg = JSON.parse(data);
      if (msg.type === 'trade_result') {
        recordTrade(msg.channel, msg.result, msg.currency, msg.entry_time, msg.martingale_level);
        log({ type: 'result', ...msg });
      }
    } catch (e) { log({ type: 'error', msg: 'WS parse error: ' + e.message }); }
  });
  ws.on('close', () => {
    log({ type: 'system', msg: 'WebSocket disconnected. Reconnecting...' });
    setTimeout(connectWS, 2000);
  });
  ws.on('error', err => log({ type: 'error', msg: 'WS error: ' + err.message }));
}
connectWS();

// --- Telegram Listener ---
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');

async function telegramListener() {
  const client = new TelegramClient(
    new StringSession(TELEGRAM_SESSION_STRING),
    Number(TELEGRAM_API_ID),
    TELEGRAM_API_HASH,
    { connectionRetries: 5 }
  );
  await client.start();
  log({ type: 'system', msg: 'Telegram self-userbot started.' });

  // Listen to all specified channel IDs
  client.addEventHandler(async (event) => {
    if (!event.message) return;
    // GramJS event.chatId gives channel/group/user ID
    const chatId =
      event.chatId ||
      (event.message.peerId && event.message.peerId.channelId) ||
      (event.message.peerId && event.message.peerId.userId);
    if (!CHANNEL_IDS.includes(Number(chatId))) return;
    const msg = event.message.message;
    const parsed = parseSignal(msg, chatId);
    if (parsed) {
      sendToAutoClicker(parsed);
      log({ type: 'signal', ...parsed });
    }
  }, { chats: CHANNEL_IDS });
}
telegramListener();

// --- Production-grade Signal Parsing ---
function parseSignal(msg, channel) {
  // Regex for currency, time, direction, martingale, OTC
  let actionKey = null;
  if (/buy|call|🟩|🔼|Up/i.test(msg)) actionKey = '/Buy1';
  if (/sell|put|🟥|🔽|Down|🔴/i.test(msg)) actionKey = '/Sell1';

  let currency = (msg.match(/([A-Z]{3}\/[A-Z]{3})/) || msg.match(/([A-Z]{6}-OTC)/) || [])[1] || '';
  let entryTime = (msg.match(/(\d{2}:\d{2})/) || [])[1] || '';
  let martingale_level = 0;
  let martMatch = msg.match(/martingale.*?(\d+)/i) || msg.match(/Protection.*(\d+)/i);
  if (martMatch) martingale_level = parseInt(martMatch[1]);
  let otc = /OTC|_otc/i.test(msg);

  if (!actionKey || !currency) return null;
  return { actionKey, channel, currency, entryTime, martingale_level, otc };
}

function sendToAutoClicker(cmd) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(cmd));
  else log({ type: 'error', msg: 'WS not ready, cannot send.' });
}

// --- REST API & UI ---
const app = express();
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'webui.html')));
app.get('/metrics', (req, res) => res.json(getSummary()));
app.get('/logs', (req, res) => res.json(logs.slice(0, 100)));
app.post('/reset', (req, res) => {
  resetPeriod();
  res.json({ status: 'reset' });
});

app.listen(PORT, () => log({ type: 'system', msg: `Server listening on ${PORT}` }));
