require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
const API_BASE = process.env.API_BASE || 'https://api.esimaccess.com/api/v1/open';
const RT_ACCESS_CODE = process.env.RT_ACCESS_CODE;

const buildEsimUsageSummary = (profile) => {
  if (!profile || typeof profile !== 'object') return null;

  const totalVolume = Number(profile.totalVolume);
  const usedVolume = Number(profile.orderUsage);
  const hasNumericUsage = Number.isFinite(totalVolume) && Number.isFinite(usedVolume);

  return {
    iccid: profile.iccid || null,
    orderNo: profile.orderNo || null,
    esimStatus: profile.esimStatus || null,
    smdpStatus: profile.smdpStatus || null,
    expiredTime: profile.expiredTime || null,
    totalVolume: Number.isFinite(totalVolume) ? totalVolume : null,
    usedVolume: Number.isFinite(usedVolume) ? usedVolume : null,
    remainingVolume: hasNumericUsage ? Math.max(totalVolume - usedVolume, 0) : null,
    totalDuration: profile.totalDuration ?? null,
    durationUnit: profile.durationUnit || null,
    packageList: Array.isArray(profile.packageList) ? profile.packageList : [],
  };
};

// CORS configuration: restrict to allowed origins if provided via env
const parseAllowedOrigins = (val) => {
  if (!val) return null; // null => allow all (development default)
  if (val === '*') return '*';
  const list = String(val)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : null;
};

const ALLOWED_ORIGINS = parseAllowedOrigins(process.env.CORS_ORIGIN);

const corsOptions = {
  origin: (origin, callback) => {
    if (ALLOWED_ORIGINS === '*') return callback(null, true);
    if (!ALLOWED_ORIGINS) return callback(null, true); // default allow all if not configured
    if (!origin) return callback(null, true); // non-browser or same-origin
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: false,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static('public'));

const getAccessHeaders = () => ({
  'RT-AccessCode': RT_ACCESS_CODE,
  'Content-Type': 'application/json',
  Accept: 'application/json',
});

const postToEsimAccess = async (path, body) => {
  return axios.post(`${API_BASE}${path}`, body, {
    headers: getAccessHeaders(),
    timeout: 15000,
    validateStatus: () => true,
  });
};

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const handleEsimUsageQuery = async (req, res) => {
  try {
    if (!RT_ACCESS_CODE) {
      return res.status(500).json({ error: 'Server is not configured: RT_ACCESS_CODE missing' });
    }

    const { iccid } = req.body || {};
    if (!iccid || typeof iccid !== 'string') {
      return res.status(400).json({ error: 'Invalid request: iccid (string) is required' });
    }

    const response = await postToEsimAccess('/esim/query', { iccid });

    const data = response.data;
    const profile = data?.obj && typeof data.obj === 'object'
      ? data.obj
      : null;

    res.status(response.status).json({
      ...data,
      queriedIccid: iccid,
      usageSummary: buildEsimUsageSummary(profile),
    });
  } catch (err) {
    console.error('Proxy error:', err?.message || err);
    if (err?.response) {
      return res.status(err.response.status || 502).json(err.response.data || { error: 'Upstream error' });
    }
    if (err?.code === 'ECONNABORTED') {
      return res.status(504).json({ error: 'Upstream timeout' });
    }
    res.status(502).json({ error: 'Bad gateway', detail: err?.message });
  }
};

app.post('/api/esim/query', handleEsimUsageQuery);
app.post('/api/esimquery', handleEsimUsageQuery);

const handleBalanceQuery = async (_req, res) => {
  try {
    if (!RT_ACCESS_CODE) {
      return res.status(500).json({ error: 'Server is not configured: RT_ACCESS_CODE missing' });
    }

    const response = await postToEsimAccess('/balance/query', '');

    res.status(response.status).json(response.data);
  } catch (err) {
    console.error('Balance proxy error:', err?.message || err);
    if (err?.response) {
      return res.status(err.response.status || 502).json(err.response.data || { error: 'Upstream error' });
    }
    if (err?.code === 'ECONNABORTED') {
      return res.status(504).json({ error: 'Upstream timeout' });
    }
    res.status(502).json({ error: 'Bad gateway', detail: err?.message });
  }
};

app.post('/api/balance', handleBalanceQuery);
app.get('/api/balance', handleBalanceQuery);

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
