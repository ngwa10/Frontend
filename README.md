# Telegram Signal Listener - Zeabur Production Deployment

## Requirements / Features

- **Signal Listening**: Listens to up to 5 Telegram channels for trading signals.
- **Signal Parsing**: Supports robust parsing of messages for currency pair, entry time, expiration, direction (buy/sell), martingale levels, OTC status, and more.
- **Command Types**:
  - `/Buy1`, `/Sell1`, `/TFtrig`, `/1M`, `/5M`, `/TrigAmt`, `/IncAmt`, `/DecAmt`, `/TrigSig`, `/free1` to `/free10`
  - Sent as JSON via WebSocket to Auto Clicker (Android).
- **Metrics Tracking**:
  - Daily, weekly, monthly summary of trades, wins, losses.
  - Per-channel stats and winrate.
  - Top-performing channel card.
  - Trade history log (last 30 trades).
- **WebSocket Communication**:
  - Sends parsed commands to Auto Clicker app.
  - Receives trade results (`trade_result` messages) from Auto Clicker.
  - Updates metrics in real time.
- **Modern Dashboard**:
  - Dark theme, responsive layout, card-based metrics.
  - Winrate bars, top performer highlight.
  - Easy to extend with charts or more features.

---

## Setup

1. **Clone repository**
2. **Install dependencies**
   ```bash
   npm install express ws telegram gramjs input
   ```
3. **Configure credentials**
   - Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, and `WS_URL` in environment variables or directly in `server.js`
   - Edit `CHANNELS` array in `server.js` with your channel usernames/IDs
4. **Deploy**
   - On Zeabur, set the environment variables
   - Run:
     ```bash
     node server.js
     ```
   - Visit `http://your-zeabur-domain/` for dashboard

## Extending Signal Parsing

- Edit `parseSignal()` in `server.js` to handle more complex formats.

## Metrics API

- `/metrics` — JSON summary
- `/logs` — Recent logs
- `/reset` — POST to reset metrics

## UI

- All UI in `webui.html`, one file, no build tools required.

---

**Future Work:**  
- Add authentication for API  
- Integrate with Android Auto Clicker for real-time metrics  
- Add charts (e.g., Chart.js for more visuals)

**Notes:**  
- All code is commented for future developers.
- All business logic and UI are in just 3 files for maintainability.
