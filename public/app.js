const byId = (id) => document.getElementById(id);

const iccidEl = byId('iccid');
const submitBtn = byId('submit');
const balanceBtn = byId('get-balance');
const statusEl = byId('status');
const summaryEl = byId('summary');

(function setProxyBase() {
  const h = window.location.hostname;
  const p = window.location.port;
  let base = '';
  if (window.PROXY_BASE) {
    base = window.PROXY_BASE;
  } else if ((h === '127.0.0.1' || h === 'localhost') && (p === '5500' || p === '5501')) {
    base = 'http://localhost:3000';
  }
  window.__PROXY_BASE__ = base;
})();

function setStatus(msg, cls = '') {
  statusEl.textContent = msg || '';
  statusEl.className = `status ${cls}`;
}

function hideSummary() {
  summaryEl.classList.add('hidden');
  summaryEl.innerHTML = '';
}

function formatBytes(value) {
  if (!Number.isFinite(value) || value < 0) return '-';
  if (value === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const size = value / 1024 ** exponent;
  const digits = size >= 10 || exponent === 0 ? 0 : 2;
  return `${size.toFixed(digits)} ${units[exponent]}`;
}

function formatMoneyValue(value) {
  if (!Number.isFinite(value)) return '-';
  return (value / 10000).toFixed(2);
}

function renderSummary(data) {
  const usage = data?.usageSummary;
  const balance = data?.obj?.balance;

  if (usage) {
    const items = [
      ['ICCID', usage.iccid || '-'],
      ['Status', usage.esimStatus || '-'],
      ['SM-DP+', usage.smdpStatus || '-'],
      ['Total Data', formatBytes(usage.totalVolume)],
      ['Used Data', formatBytes(usage.usedVolume)],
      ['Remaining Data', formatBytes(usage.remainingVolume)],
      ['Valid Until', usage.expiredTime || '-'],
    ];

    summaryEl.innerHTML = `
      <div class="summary-grid">
        ${items.map(([label, value]) => `
          <div class="summary-item">
            <div class="summary-label">${label}</div>
            <div class="summary-value">${value}</div>
          </div>
        `).join('')}
      </div>
    `;
    summaryEl.classList.remove('hidden');
    return;
  }

  if (Number.isFinite(balance)) {
    summaryEl.innerHTML = `
      <div class="summary-grid">
        <div class="summary-item">
          <div class="summary-label">Merchant Balance</div>
          <div class="summary-value">${formatMoneyValue(balance)}</div>
        </div>
      </div>
    `;
    summaryEl.classList.remove('hidden');
    return;
  }

  hideSummary();
}

async function queryICCID(iccid) {
  setStatus('Calling API...');
  hideSummary();

  try {
    const url = `${window.__PROXY_BASE__ || ''}/api/esim/query`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ iccid }),
    });

    const contentType = res.headers.get('content-type') || '';
    const isJSON = contentType.includes('application/json');
    const data = isJSON ? await res.json() : await res.text();

    if (!res.ok) {
      setStatus(`Error ${res.status}`, 'error');
      return;
    }

    setStatus('Success', 'success');
    renderSummary(data);
  } catch (err) {
    setStatus('Network error', 'error');
    hideSummary();
  }
}

submitBtn.addEventListener('click', () => {
  const iccid = iccidEl.value.trim();
  if (!iccid) {
    setStatus('Please enter an ICCID', 'error');
    return;
  }
  queryICCID(iccid);
});

balanceBtn.addEventListener('click', async () => {
  setStatus('Fetching balance...');
  hideSummary();
  try {
    const url = `${window.__PROXY_BASE__ || ''}/api/balance`;
    const res = await fetch(url, { method: 'POST' });
    const contentType = res.headers.get('content-type') || '';
    const isJSON = contentType.includes('application/json');
    const data = isJSON ? await res.json() : await res.text();
    if (!res.ok) {
      setStatus(`Error ${res.status}`, 'error');
      return;
    }
    setStatus('Success', 'success');
    renderSummary(data);
  } catch (err) {
    setStatus('Network error', 'error');
    hideSummary();
  }
});

iccidEl.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    submitBtn.click();
  }
});
