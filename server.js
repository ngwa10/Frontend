/**
 * Telegram Signal Listener (Production-ready)
 * - Listens up to 5 channels for trade signals
 * - Parses signals robustly, sends action to Auto Clicker via WebSocket
 * - Receives trade results via WebSocket, updates metrics (daily/weekly/monthly)
 * - Serves modern dashboard at / (webui.html)
 * - API endpoints for metrics and logs
 */

const express = require('express');
const path = require('path');
const WebSocket = require('ws');
const { recordTrade, getSummary, resetPeriod } = require('./metrics');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_BOT_TOKEN';
const TELEGRAM_API_ID = process.env.TELEGRAM_API_ID || 'YOUR_API_ID';
const TELEGRAM_API_HASH = process.env.TELEGRAM_API_HASH || 'YOUR_API_HASH';
const WS_URL = process.env.WS_URL || 'ws://localhost:8888'; // Auto Clicker WebSocket

const CHANNELS = [
  'channel1', 'channel2', 'channel3', 'channel4', 'channel5'
];

const app = express();
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
const input = require('input'); // npm i input

async function telegramListener() {
  // Use gramjs; ask for credentials on first run
  const apiId = TELEGRAM_API_ID; // your API ID
  const apiHash = TELEGRAM_API_HASH; // your API HASH
  const stringSession = new StringSession(''); // use input for first setup

  const client = new TelegramClient(stringSession, apiId, apiHash, { connectionRetries: 5 });
  await client.start({
    phoneNumber: async () => await input.text('Enter your phone number:'),
    password: async () => await input.text('Enter your password:'),
    phoneCode: async () => await input.text('Enter code:'),
    onError: (err) => log({ type: 'error', msg: err.message }),
  });

  log({ type: 'system', msg: 'Telegram started.' });

  for (const ch of CHANNELS) {
    client.addEventHandler((event) => {
      if (!event.message) return;
      const msg = event.message.message;
      const parsed = parseSignal(msg, ch);
      if (parsed) {
        sendToAutoClicker(parsed);
        log({ type: 'signal', ...parsed });
      }
    }, { chats: [ch] });
  }
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
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'webui.html')));
app.get('/metrics', (req, res) => res.json(getSummary()));
app.get('/logs', (req, res) => res.json(logs.slice(0, 100)));
app.post('/reset', (req, res) => {
  resetPeriod();
  res.json({ status: 'reset' });
});

app.listen(PORT, () => log({ type: 'system', msg: `Server listening on ${PORT}` }));
