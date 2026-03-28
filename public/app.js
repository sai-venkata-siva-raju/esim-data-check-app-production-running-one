const byId = (id) => document.getElementById(id);

const iccidEl = byId('iccid');
const submitBtn = byId('submit');
const balanceBtn = byId('get-balance');
const outputEl = byId('output');
const statusEl = byId('status');

// Determine proxy base automatically or from a global override
// - If window.PROXY_BASE is set, use that
// - If served from 127.0.0.1:5500 or 5501, assume proxy at http://localhost:3000
// - Otherwise, use same-origin ('')
(function setProxyBase() {
  const h = window.location.hostname;
  const p = window.location.port;
  let base = '';
  if (window.PROXY_BASE) {
    base = window.PROXY_BASE;
  } else if ((h === '127.0.0.1' || h === 'localhost') && (p === '5500' || p === '5501')) {
    base = 'http://localhost:3000';
  }
  window.__PROXY_BASE__ = base; // e.g., '' or 'http://localhost:3000'
})();

function setStatus(msg, cls = '') {
  statusEl.textContent = msg || '';
  statusEl.className = `status ${cls}`;
}

function setOutput(obj) {
  try {
    outputEl.textContent = JSON.stringify(obj, null, 2);
  } catch (_) {
    outputEl.textContent = String(obj);
  }
}

async function queryICCID(iccid) {
  setStatus('Calling API…');
  setOutput('(waiting...)');

  try {
    const url = `${window.__PROXY_BASE__ || ''}/api/esimquery`;
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
      setOutput(data);
      return;
    }

    setStatus('Success', 'success');
    setOutput(data);
  } catch (err) {
    setStatus('Network error', 'error');
    setOutput({ error: err?.message || String(err) });
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
  setStatus('Fetching balance…');
  setOutput('(waiting...)');
  try {
    const url = `${window.__PROXY_BASE__ || ''}/api/balance`;
    const res = await fetch(url);
    const contentType = res.headers.get('content-type') || '';
    const isJSON = contentType.includes('application/json');
    const data = isJSON ? await res.json() : await res.text();
    if (!res.ok) {
      setStatus(`Error ${res.status}`, 'error');
      setOutput(data);
      return;
    }
    setStatus('Success', 'success');
    setOutput(data);
  } catch (err) {
    setStatus('Network error', 'error');
    setOutput({ error: err?.message || String(err) });
  }
});

iccidEl.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    submitBtn.click();
  }
});
