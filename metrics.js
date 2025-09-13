/**
 * Metrics manager: tracks trades, wins, losses per channel, daily/weekly/monthly summaries, top performer
 */

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;

const metrics = {
  totals: { trades: 0, wins: 0, losses: 0 },
  daily: {}, weekly: {}, monthly: {},
  channels: {}, // {channel: {trades, wins, losses}}
  history: [], // [{timestamp, channel, result}]
};

function now() { return Date.now(); }

function ensureChannel(channel) {
  if (!metrics.channels[channel]) metrics.channels[channel] = { trades: 0, wins: 0, losses: 0 };
}

function recordTrade(channel, result, currency, entry_time, martingale_level) {
  ensureChannel(channel);

  metrics.totals.trades++;
  metrics.channels[channel].trades++;

  // Result
  if (result === 'win') {
    metrics.totals.wins++; metrics.channels[channel].wins++;
  } else if (result === 'loss') {
    metrics.totals.losses++; metrics.channels[channel].losses++;
  }

  metrics.history.unshift({
    timestamp: now(), channel, result, currency, entry_time, martingale_level
  });
  if (metrics.history.length > 500) metrics.history.pop();

  // Daily, weekly, monthly
  let today = new Date().toISOString().slice(0, 10);
  let week = getWeek();
  let month = new Date().toISOString().slice(0, 7);

  if (!metrics.daily[today]) metrics.daily[today] = { trades: 0, wins: 0, losses: 0 };
  if (!metrics.weekly[week]) metrics.weekly[week] = { trades: 0, wins: 0, losses: 0 };
  if (!metrics.monthly[month]) metrics.monthly[month] = { trades: 0, wins: 0, losses: 0 };

  metrics.daily[today].trades++;
  metrics.weekly[week].trades++;
  metrics.monthly[month].trades++;
  if (result === 'win') {
    metrics.daily[today].wins++; metrics.weekly[week].wins++; metrics.monthly[month].wins++;
  } else if (result === 'loss') {
    metrics.daily[today].losses++; metrics.weekly[week].losses++; metrics.monthly[month].losses++;
  }
}

function getWeek() {
  let d = new Date();
  let first = d.getDate() - d.getDay();
  let weekStart = new Date(d.setDate(first));
  return weekStart.toISOString().slice(0, 10);
}

function getSummary() {
  // Top performing channel
  let topChannel = Object.entries(metrics.channels)
    .sort((a, b) => b[1].wins - a[1].wins)[0]?.[0] || '';

  return {
    totals: metrics.totals,
    daily: metrics.daily,
    weekly: metrics.weekly,
    monthly: metrics.monthly,
    channels: metrics.channels,
    topChannel,
    history: metrics.history.slice(0, 30),
  };
}

function resetPeriod() {
  metrics.daily = {}; metrics.weekly = {}; metrics.monthly = {};
  metrics.history = [];
  Object.keys(metrics.channels).forEach(ch => {
    metrics.channels[ch] = { trades: 0, wins: 0, losses: 0 };
  });
  metrics.totals = { trades: 0, wins: 0, losses: 0 };
}

module.exports = { recordTrade, getSummary, resetPeriod };
