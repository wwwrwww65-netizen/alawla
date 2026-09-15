import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static assets from project root
app.use(express.static(__dirname));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'alawla-hotspot' });
});

// Notifications & announcements public content mock endpoint
app.get('/api/v1/public/content', (req, res) => {
  res.json({
    success: true,
    data: {
      notifications: [],
      announcements: []
    }
  });
});

// Quran info endpoint
app.get('/api/quran/info', (req, res) => {
  const surahsPath = path.join(__dirname, 'js', 'quran-surahs.json');
  let surahs = [];
  try {
    if (fs.existsSync(surahsPath)) {
      surahs = JSON.parse(fs.readFileSync(surahsPath, 'utf8'));
    }
  } catch (err) {
    console.error('Error reading surahs file:', err);
  }
  res.json({
    totalPages: 569,
    surahs: surahs
  });
});

// Quran page placeholder image if not found locally
app.get('/api/quran/page/:num', (req, res) => {
  const pageNum = req.params.num;
  const localPagePath = path.join(__dirname, 'public', 'quran-pages', `${pageNum}.jpg`);
  if (fs.existsSync(localPagePath)) {
    return res.sendFile(localPagePath);
  }
  // Return a transparent 1x1 GIF or a placeholder SVG so image tag doesn't break
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900"><rect width="100%" height="100%" fill="#0a0f1d"/><text x="50%" y="48%" fill="#dfab52" font-family="sans-serif" font-size="24" text-anchor="middle">المصحف الشريف</text><text x="50%" y="54%" fill="#94a3b8" font-family="sans-serif" font-size="18" text-anchor="middle">صفحة ${pageNum}</text></svg>`;
  res.setHeader('Content-Type', 'image/svg+xml');
  res.send(svg);
});

// Quran download mock/fallback
app.get('/download-quran', (req, res) => {
  res.setHeader('Content-Disposition', 'attachment; filename="mobile-quran.pdf"');
  res.setHeader('Content-Type', 'application/pdf');
  res.send(Buffer.from('%PDF-1.4\n%empty pdf placeholder\n%%EOF'));
});

// In-memory simulation session
let simulatedSession = {
  logged_in: false,
  username: '',
  loginTime: null,
  ip: '192.168.88.100',
  mac: 'AA:BB:CC:DD:EE:FF'
};

// MikroTik Hotspot login mock handler for testing in preview / dev server
app.all('/login', (req, res) => {
  const username = (req.query.username || req.body?.username || '').trim();
  const password = (req.query.password || req.body?.password || '').trim();
  res.setHeader('Content-Type', 'application/json');

  // Test error trigger keywords for testing error dialogs/blocker:
  if (username === '2222' || username.toLowerCase() === 'expired') {
    return res.json({
      logged_in: "no",
      error: "no valid profile found",
      action: "onLoginError"
    });
  }
  if (username === '3333' || username.toLowerCase() === 'used') {
    return res.json({
      logged_in: "no",
      error: "simultaneous session limit reached",
      action: "onLoginError"
    });
  }
  if (username.toLowerCase() === 'wrong' || username.toLowerCase() === 'error') {
    return res.json({
      logged_in: "no",
      error: "invalid username or password",
      action: "onLoginError"
    });
  }

  // If no username is provided at all:
  if (!username) {
    return res.json({
      logged_in: "no",
      error: "invalid username or password",
      action: "onLoginError"
    });
  }

  // Any other card succeeds in simulation!
  const domain = (req.query.domain || req.body?.domain || '3M/7M_Uon').trim();
  simulatedSession = {
    logged_in: true,
    username: username,
    domain: domain,
    loginTime: Date.now(),
    ip: req.ip || "192.168.88.100",
    mac: "70:85:C2:A1:3B:9E"
  };

  // Check if standard browser navigation vs AJAX
  const isAjax = req.xhr || req.headers['accept']?.includes('json') || req.query.var !== undefined || req.body?.dst !== undefined || req.headers['x-requested-with'];
  if (!isAjax && !req.query.username) {
    return res.redirect('/?status=connected');
  }

  return res.json({
    logged_in: "yes",
    username: username,
    domain: domain,
    link_only: "http://1.1.1.1/status",
    link_login_only: "http://1.1.1.1/login",
    link_logout: "http://1.1.1.1/logout",
    link_status: "http://1.1.1.1/status",
    nas_id: "MikroTik-Node-01",
    ip: simulatedSession.ip,
    mac: simulatedSession.mac,
    action: "onLoggedIn"
  });
});

// MikroTik Hotspot status JSON / HTML mock handler
app.all('/status', (req, res) => {
  const isAjax = req.headers.accept?.includes('application/json') || req.query.var !== undefined || req.xhr;
  const username = req.query.username || simulatedSession.username || "770807777";
  const currentSpeed = req.query.domain || simulatedSession.domain || "3M/7M_Uon";

  if (isAjax) {
    res.setHeader('Content-Type', 'application/json');
    return res.json({
      logged_in: "yes",
      username: username,
      ip: simulatedSession.ip,
      mac: simulatedSession.mac,
      bytes_in_nice: "185.4 MB",
      bytes_out_nice: "892.6 MB",
      uptime: "3h 45m",
      remain_bytes_total: "3.2 GB",
      session_time_left: "6d 12h",
      spes: currentSpeed,
      sspeed: currentSpeed,
      action: "onStatusQuery"
    });
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// MikroTik Hotspot logout mock handler
app.all('/logout', (req, res) => {
  simulatedSession.logged_in = false;
  simulatedSession.username = '';
  
  const isAjax = req.headers.accept?.includes('application/json') || req.query.var !== undefined || req.xhr;
  if (isAjax) {
    res.setHeader('Content-Type', 'application/json');
    return res.json({
      logged_in: "no",
      action: "onLoggedOut"
    });
  }
  res.redirect('/');
});

// Return JSON 404 for unmatched /api/* requests
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Default fallback to index.html for client-side navigation (non-file requests)
app.get('{*all}', (req, res) => {
  // If requesting a file with an extension that does not exist, return 404 instead of index.html
  if (path.extname(req.path)) {
    return res.status(404).send('File Not Found');
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running at http://0.0.0.0:${PORT}`);
});
