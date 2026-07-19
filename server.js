const http = require('http');
const fs = require('fs');
const path = require('path');

// --- tiny .env loader (avoids needing an npm dependency) ---
function loadEnv(file) {
  const envPath = path.join(__dirname, file);
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnv('.env');

const PORT = process.env.PORT || 3000;
const WEB3FORMS_ACCESS_KEY = process.env.WEB3FORMS_ACCESS_KEY;
const PUBLIC_DIR = path.join(__dirname, 'public');

if (!WEB3FORMS_ACCESS_KEY) {
  console.warn(
    '[warn] WEB3FORMS_ACCESS_KEY is not set. Copy .env.example to .env and add your key, ' +
    'or the lead form will fail to send.'
  );
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

// Serves static files from /public, defaulting to index.html.
function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.normalize(path.join(PUBLIC_DIR, urlPath));

  // Prevent path traversal outside of /public
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<h1>404 - Page not found</h1>');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

// Handles the lead form submission server-side, so the web3forms access key
// never has to live in client-side JS / page source.
async function handleLead(req, res) {
  try {
    const raw = await readBody(req);
    let data;
    try {
      data = JSON.parse(raw || '{}');
    } catch {
      return sendJson(res, 400, { success: false, message: 'בקשה לא תקינה.' });
    }

    const { name, phone, need, botcheck } = data;

    // Honeypot check — real users never fill this hidden field.
    if (botcheck) {
      return sendJson(res, 200, { success: true });
    }

    if (!name || !phone) {
      return sendJson(res, 400, { success: false, message: 'שם וטלפון הם שדות חובה.' });
    }

    if (!WEB3FORMS_ACCESS_KEY) {
      return sendJson(res, 500, { success: false, message: 'שרת לא מוגדר לשליחת טפסים.' });
    }

    const payload = {
      access_key: WEB3FORMS_ACCESS_KEY,
      subject: 'ליד חדש מהאתר! - צבע בקליק',
      from_name: 'האתר של צבע בקליק',
      'שם מלא': name,
      'טלפון': phone,
      'מה צריך לצבוע': need || 'לא צוין',
    };

    const web3formsRes = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await web3formsRes.json();

    if (result.success) {
      return sendJson(res, 200, { success: true });
    }
    return sendJson(res, 502, { success: false, message: result.message || 'שליחה נכשלה.' });
  } catch (err) {
    console.error('Error sending lead:', err);
    return sendJson(res, 500, { success: false, message: 'שגיאת שרת, נסה שוב.' });
  }
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/lead') {
    return handleLead(req, res);
  }
  if (req.method === 'GET' || req.method === 'HEAD') {
    return serveStatic(req, res);
  }
  res.writeHead(405);
  res.end('Method Not Allowed');
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
