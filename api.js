const FX_API_BASE = 'https://api.frankfurter.app';

export async function fetchCurrencies() {
  const res = await fetch(`${FX_API_BASE}/currencies`);
  if (!res.ok) throw new Error('Failed to load currencies');
  return res.json();
}

export async function convertCurrency(amount, from, to) {
  const params = new URLSearchParams({ amount, from, to });
  const res = await fetch(`${FX_API_BASE}/latest?${params.toString()}`);
  if (!res.ok) throw new Error('Conversion failed');
  const data = await res.json();
  return data.rates[to];
}