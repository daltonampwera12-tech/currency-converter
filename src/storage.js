const FAVORITES_KEY = 'fxd_favorites';
const HISTORY_KEY = 'fxd_history';
const SETTINGS_KEY = 'fxd_settings';
const ALERTS_KEY = 'fxd_alerts';

export function getFavorites() {
  return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
}

export function saveFavorite(pair) {
  const list = getFavorites();
  if (!list.find(p => p.from === pair.from && p.to === pair.to)) {
    list.push(pair);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(list));
  }
}

export function getHistory() {
  return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
}

export function addHistory(entry) {
  const list = getHistory();
  list.unshift(entry);
  const trimmed = list.slice(0, 10);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
}

export function getSettings() {
  return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function getAlerts() {
  return JSON.parse(localStorage.getItem(ALERTS_KEY) || '[]');
}

export function saveAlerts(alerts) {
  localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
}
