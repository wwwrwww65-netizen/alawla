import express from 'express';
import path from 'path';
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

// MikroTik Hotspot login mock handler for testing in preview
app.all('/login', (req, res) => {
  res.redirect('/?status=connected');
});

// MikroTik Hotspot logout mock handler
app.all('/logout', (req, res) => {
  res.redirect('/');
});

// Default fallback to index.html
app.get('{*all}', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running at http://0.0.0.0:${PORT}`);
});
