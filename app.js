import { fetchCurrencies, convertCurrency } from './api.js';
import {
  saveFavorite,
  addHistory,
  getSettings,
  saveSettings,
  getAlerts,
  saveAlerts
} from './storage.js';
import { renderAmountPresets, renderFavorites, renderHistory } from './ui.js';

window.addEventListener('load', () => {
  const amountInput = document.getElementById('amount');
  const fromSelect = document.getElementById('fromCurrency');
  const toSelect = document.getElementById('toCurrency');
  const resultEl = document.getElementById('result');
  const amountPresets = document.getElementById('amountPresets');
  const favoritesList = document.getElementById('favoritesList');
  const historyList = document.getElementById('historyList');
  const rateMoodEl = document.getElementById('rateMood');
  const spotlightEl = document.getElementById('spotlightText');

  let deferredPrompt = null;

  // PWA install
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('installBtn');
    installBtn.style.display = 'inline-flex';
    installBtn.addEventListener(
      'click',
      async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
        installBtn.style.display = 'none';
      },
      { once: true }
    );
  });

  // Service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js');
  }

  // Spotlight pair of the day
  function pickSpotlightPair() {
    const pairs = [
      ['USD', 'EUR'],
      ['EUR', 'GBP'],
      ['USD', 'JPY'],
      ['GBP', 'USD'],
      ['EUR', 'USD']
    ];
    const todayIndex = new Date().getDate() % pairs.length;
    return pairs[todayIndex];
  }

  // Rate mood (compare today vs yesterday)
  async function loadRateMood(from, to) {
    try {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const url = `https://api.frankfurter.app/${yesterday}?from=${from}&to=${to}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const oldRate = data.rates[to];
      const newRate = await convertCurrency(1, from, to);

      if (newRate > oldRate) {
        rateMoodEl.textContent = `📈 ${to} is stronger today vs ${from}`;
      } else if (newRate < oldRate) {
        rateMoodEl.textContent = `📉 ${to} is weaker today vs ${from}`;
      } else {
        rateMoodEl.textContent = `➖ No major movement today`;
      }
    } catch {
      rateMoodEl.textContent = 'Could not load rate mood.';
    }
  }

  // Local-only alerts
  async function checkAlerts(from, to, currentRate) {
    const alerts = getAlerts();
    const triggered = alerts.filter(
      (a) =>
        a.from === from &&
        a.to === to &&
        ((a.direction === 'below' && currentRate <= a.target) ||
          (a.direction === 'above' && currentRate >= a.target))
    );

    if (triggered.length) {
      alert(`Your alert for ${from} → ${to} has been reached: ${currentRate}`);
      const remaining = alerts.filter((a) => !triggered.includes(a));
      saveAlerts(remaining);
    }
  }

  // Load currencies and initial UI
  (async () => {
    try {
      const currencies = await fetchCurrencies();
      const codes = Object.keys(currencies).sort();

      [fromSelect, toSelect].forEach((sel) => {
        codes.forEach((code) => {
          const opt = document.createElement('option');
          opt.value = code;
          opt.textContent = `${code} – ${currencies[code]}`;
          sel.appendChild(opt);
        });
      });

      const settings = getSettings();
      fromSelect.value = settings.defaultFrom || 'USD';
      toSelect.value = settings.defaultTo || 'EUR';
      if (settings.defaultAmount) amountInput.value = settings.defaultAmount;

      const [sFrom, sTo] = pickSpotlightPair();
      spotlightEl.textContent = `Check how ${sFrom} compares to ${sTo} today. Tap above to convert.`;
    } catch {
      resultEl.textContent = 'Could not load currencies. Check your connection.';
    }
  })();

  // Preset chips
  renderAmountPresets(amountPresets);
  amountPresets.addEventListener('click', (e) => {
    if (e.target.matches('.chip')) {
      amountInput.value = e.target.dataset.value;
    }
  });

  // Convert button
  document.getElementById('convertBtn').addEventListener('click', async () => {
    const amount = parseFloat(amountInput.value || '0');
    const from = fromSelect.value;
    const to = toSelect.value;

    if (!amount || amount <= 0) {
      resultEl.textContent = 'Enter a valid amount.';
      return;
    }

    try {
      resultEl.textContent = 'Converting...';
      const rateResult = await convertCurrency(amount, from, to);
      const formatted = rateResult.toFixed(2);

      resultEl.textContent = `${amount} ${from} = ${formatted} ${to}`;

      addHistory({ amount, from, to, result: formatted, ts: Date.now() });
      renderHistory(historyList);

      loadRateMood(from, to);
      await checkAlerts(from, to, rateResult);
    } catch {
      resultEl.textContent = 'Conversion failed. Try again.';
    }
  });

  // Swap button
  document.getElementById('swapBtn').addEventListener('click', () => {
    const from = fromSelect.value;
    fromSelect.value = toSelect.value;
    toSelect.value = from;
  });

  // Favorites
  document.getElementById('saveFavoriteBtn').addEventListener('click', () => {
    saveFavorite({ from: fromSelect.value, to: toSelect.value });
    renderFavorites(favoritesList);
  });

  favoritesList.addEventListener('click', (e) => {
    if (e.target.matches('.pill')) {
      fromSelect.value = e.target.dataset.from;
      toSelect.value = e.target.dataset.to;
    }
  });

  // Initial favorites & history
  renderHistory(historyList);
  renderFavorites(favoritesList);

  // Daily reminder (local flag only)
  document.getElementById('dailyReminderBtn').addEventListener('click', () => {
    const settings = getSettings();
    settings.dailyReminder = true;
    settings.dailyReminderSetAt = Date.now();
    saveSettings(settings);
    alert('Daily reminder preference saved.');
  });

  // Share
  document.getElementById('shareBtn').addEventListener('click', async () => {
    const shareData = {
      title: 'FX Daily – Smart Currency Converter',
      text: 'Check out this clean, fast currency converter web app.',
      url: window.location.origin
    };

    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      await navigator.clipboard.writeText(shareData.url);
      alert('Link copied. Share it with a friend!');
    }
  });
});