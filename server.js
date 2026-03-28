require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
const API_BASE = process.env.API_BASE || 'https://api.esimaccess.com/api/v1/open';
const RT_ACCESS_CODE = process.env.RT_ACCESS_CODE;

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

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Proxy endpoint for esimquery
app.post('/api/esimquery', async (req, res) => {
  try {
    if (!RT_ACCESS_CODE) {
      return res.status(500).json({ error: 'Server is not configured: RT_ACCESS_CODE missing' });
    }

    const { iccid } = req.body || {};
    if (!iccid || typeof iccid !== 'string') {
      return res.status(400).json({ error: 'Invalid request: iccid (string) is required' });
    }

    const url = `${API_BASE}/esimquery`;

    const response = await axios.post(
      url,
      { iccid },
      {
        headers: {
          'RT-AccessCode': RT_ACCESS_CODE,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        // reasonable timeout to avoid hanging
        timeout: 15000,
        validateStatus: () => true, // let us forward the actual API status
      }
    );

    // Forward status and data as-is from upstream
    res.status(response.status).json(response.data);
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
});

// Proxy endpoint for balance query
app.get('/api/balance', async (_req, res) => {
  try {
    if (!RT_ACCESS_CODE) {
      return res.status(500).json({ error: 'Server is not configured: RT_ACCESS_CODE missing' });
    }

    const url = `${API_BASE}/balance/query`;
    const response = await axios.get(url, {
      headers: {
        'RT-AccessCode': RT_ACCESS_CODE,
        'Accept': 'application/json',
      },
      timeout: 15000,
      validateStatus: () => true,
    });

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
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
