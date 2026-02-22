import { getFavorites, getHistory } from './storage.js';

export function renderAmountPresets(container, values = [10, 20, 50, 100]) {
  container.innerHTML = '';
  values.forEach(v => {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.textContent = v;
    btn.dataset.value = v;
    container.appendChild(btn);
  });
}

export function renderFavorites(container) {
  const favorites = getFavorites();
  container.innerHTML = favorites.length ? '' : '<p class="muted">No favorites yet.</p>';
  favorites.forEach(pair => {
    const btn = document.createElement('button');
    btn.className = 'pill';
    btn.textContent = `${pair.from} → ${pair.to}`;
    btn.dataset.from = pair.from;
    btn.dataset.to = pair.to;
    container.appendChild(btn);
  });
}

export function renderHistory(container) {
  const history = getHistory();
  container.innerHTML = history.length ? '' : '<p class="muted">No recent conversions.</p>';
  history.forEach(item => {
    const li = document.createElement('li');
    li.textContent = `${item.amount} ${item.from} → ${item.result} ${item.to}`;
    container.appendChild(li);
  });
}
