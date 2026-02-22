import { fetchCurrencies, convertCurrency } from './api.js';
import {
  saveFavorite,
  addHistory,
  getSettings,
  saveSettings,
  getAlerts,
  saveAlerts,
  getStreak,
  saveStreak,
  addRecentPair,
  getRecentPairs,
  getHistory,
  getTheme,
  saveTheme
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
  const sparklineSvg = document.getElementById('sparklineSvg');
  const strengthList = document.getElementById('strengthList');
  const themeSelect = document.getElementById('themeSelect');

  let deferredPrompt = null;

  // THEME HANDLING
  function applyTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    themeSelect.value = theme;
    saveTheme(theme);
  }

  const initialTheme = getTheme();
  applyTheme(initialTheme);

  themeSelect.addEventListener('change', () => {
    applyTheme(themeSelect.value);
  });

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

  // Daily streak
  function updateStreak() {
    const streak = getStreak();
    const today = new Date().setHours(0, 0, 0, 0);
    const yesterday = today - 86400000;

    if (streak.last === today) {
      // already counted today
    } else if (streak.last === yesterday) {
      streak.count += 1;
      streak.last = today;
    } else {
      streak.count = 1;
      streak.last = today;
    }

    saveStreak(streak);

    const streakText = document.getElementById('streakText');
    streakText.textContent = `🔥 ${streak.count} day streak`;
  }

  // Tip of the day
  function loadTipOfTheDay() {
    const tips = [
      "Bank exchange rates often include hidden fees.",
      "Forex is the world’s largest financial market.",
      "Rates change based on supply, demand, and global events.",
      "Online purchases may use different exchange rates.",
      "Some currencies are more volatile than others."
    ];

    const dayIndex = new Date().getDate() % tips.length;
    document.getElementById('tipText').textContent = tips[dayIndex];
  }

  // Trending pairs
  function loadTrendingPairs() {
    const pairs = [
      { from: "USD", to: "EUR" },
      { from: "EUR", to: "GBP" },
      { from: "USD", to: "JPY" }
    ];

    const container = document.getElementById('trendingPairs');
    container.innerHTML = '';

    pairs.forEach(p => {
      const btn = document.createElement('button');
      btn.className = 'pill';
      btn.textContent = `${p.from} → ${p.to}`;
      btn.onclick = () => {
        fromSelect.value = p.from;
        toSelect.value = p.to;
        loadSparkline(p.from, p.to);
        loadRateMood(p.from, p.to);
      };
      container.appendChild(btn);
    });
  }

  // Market snapshot
  async function loadMarketSnapshot() {
    try {
      const pairs = [
        ["USD", "EUR"],
        ["EUR", "GBP"],
        ["USD", "JPY"]
      ];

      const [from, to] = pairs[new Date().getDate() % pairs.length];

      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const url = `https://api.frankfurter.app/${yesterday}?from=${from}&to=${to}`;
      const res = await fetch(url);
      const data = await res.json();
      const oldRate = data.rates[to];

      const newRate = await convertCurrency(1, from, to);

      const el = document.getElementById('marketSnapshot');

      if (newRate > oldRate) el.textContent = `${to} strengthened against ${from} today.`;
      else if (newRate < oldRate) el.textContent = `${to} weakened against ${from} today.`;
      else el.textContent = `No major movement in ${from} → ${to} today.`;

    } catch {
      document.getElementById('marketSnapshot').textContent = "Unable to load market insight.";
    }
  }

  // Recently viewed pairs
  function loadRecentPairs() {
    const container = document.getElementById('recentPairs');
    const list = getRecentPairs();
    container.innerHTML = '';

    list.forEach(pair => {
      const [from, to] = pair.split('-');
      const btn = document.createElement('button');
      btn.className = 'pill';
      btn.textContent = `${from} → ${to}`;
      btn.onclick = () => {
        fromSelect.value = from;
        toSelect.value = to;
        loadSparkline(from, to);
        loadRateMood(from, to);
      };
      container.appendChild(btn);
    });
  }

  // Weekly summary
  function loadWeeklySummary() {
    const history = getHistory();
    const el = document.getElementById('weeklySummary');

    if (history.length === 0) {
      el.textContent = "No conversions yet this week.";
      return;
    }

    const weekAgo = Date.now() - 7 * 86400000;
    const recent = history.filter(h => h.ts >= weekAgo);

    if (recent.length === 0) {
      el.textContent = "No conversions in the last 7 days.";
      return;
    }

    const mostUsed = recent
      .map(h => `${h.from}-${h.to}`)
      .reduce((acc, p) => {
        acc[p] = (acc[p] || 0) + 1;
        return acc;
      }, {});

    const topPair = Object.entries(mostUsed).sort((a, b) => b[1] - a[1])[0][0];
    const [from, to] = topPair.split('-');

    el.textContent = `${recent.length} conversions this week. Most used: ${from} → ${to}.`;
  }

  // Sparkline: 7-day filled area chart
  async function loadSparkline(from, to) {
    try {
      const today = new Date();
      const end = today.toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 6 * 86400000);
      const start = startDate.toISOString().split('T')[0];

      const url = `https://api.frankfurter.app/${start}..${end}?from=${from}&to=${to}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const data = await res.json();

      const dates = Object.keys(data.rates).sort();
      const values = dates.map(d => data.rates[d][to]);

      if (!values.length) {
        sparklineSvg.innerHTML = '';
        return;
      }

      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = max - min || 1;

      const points = values.map((v, i) => {
        const x = (i / (values.length - 1 || 1)) * 100;
        const y = 40 - ((v - min) / range) * 30 - 5;
        return { x, y };
      });

      const pathD = points.map((p, i) =>
        (i === 0 ? `M ${p.x},${p.y}` : ` L ${p.x},${p.y}`)
      ).join('');

      const areaD =
        `M ${points[0].x},40 ` +
        points.map(p => `L ${p.x},${p.y}`).join(' ') +
        ` L ${points[points.length - 1].x},40 Z`;

      sparklineSvg.innerHTML = `
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.6" />
            <stop offset="100%" stop-color="var(--accent)" stop-opacity="0" />
          </linearGradient>
        </defs>
        <path d="${areaD}" fill="url(#sparkGrad)" />
        <path d="${pathD}" fill="none" stroke="var(--accent)" stroke-width="1.5" />
      `;
    } catch {
      sparklineSvg.innerHTML = '';
    }
  }

  // Currency strength index (score + arrow)
  async function loadCurrencyStrength() {
    try {
      const majors = ['USD', 'EUR', 'GBP', 'JPY'];
      const base = 'USD';
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      const resToday = await fetch(`https://api.frankfurter.app/${today}?from=${base}`);
      const resYest = await fetch(`https://api.frankfurter.app/${yesterday}?from=${base}`);
      if (!resToday.ok || !resYest.ok) throw new Error();

      const dataToday = await resToday.json();
      const dataYest = await resYest.json();

      strengthList.innerHTML = '';

      majors.forEach(code => {
        if (code === base) return;

        const rateToday = dataToday.rates[code];
        const rateYest = dataYest.rates[code];
        if (!rateToday || !rateYest) return;

        const change = (rateToday - rateYest) / rateYest;
        const scoreRaw = 5 + change * 50; // small changes → around 5
        const score = Math.max(1, Math.min(10, Math.round(scoreRaw)));

        const arrow = change > 0.001 ? '↑' : change < -0.001 ? '↓' : '→';

        const li = document.createElement('li');
        li.textContent = `${code} strength: ${score}/10 ${arrow}`;
        strengthList.appendChild(li);
      });
    } catch {
      strengthList.innerHTML = '<li>Unable to load strength data.</li>';
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

      // Initial sparkline + mood + strength
      loadSparkline(fromSelect.value, toSelect.value);
      loadRateMood(fromSelect.value, toSelect.value);
      loadCurrencyStrength();
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

      addRecentPair(from, to);
      loadRecentPairs();
      loadWeeklySummary();
      loadSparkline(from, to);
      loadCurrencyStrength();
    } catch {
      resultEl.textContent = 'Conversion failed. Try again.';
    }
  });

  // Swap button
  document.getElementById('swapBtn').addEventListener('click', () => {
    const from = fromSelect.value;
    fromSelect.value = toSelect.value;
    toSelect.value = from;
    loadSparkline(fromSelect.value, toSelect.value);
    loadRateMood(fromSelect.value, toSelect.value);
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
      loadSparkline(fromSelect.value, toSelect.value);
      loadRateMood(fromSelect.value, toSelect.value);
    }
  });

  // Quick actions
  document.getElementById('qaConvert').onclick = () => {
    document.getElementById('convertBtn').click();
  };

  document.getElementById('qaSwap').onclick = () => {
    document.getElementById('swapBtn').click();
  };

  document.getElementById('qaLastAmount').onclick = () => {
    const history = getHistory();
    if (history.length > 0) {
      amountInput.value = history[0].amount;
    }
  };

  // Initial renders
  renderHistory(historyList);
  renderFavorites(favoritesList);
  loadRecentPairs();
  loadWeeklySummary();
  updateStreak();
  loadTipOfTheDay();
  loadTrendingPairs();
  loadMarketSnapshot();

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