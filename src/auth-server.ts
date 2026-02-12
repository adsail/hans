import http from 'http';
import { chromium, Browser, Page } from 'playwright';
import { createLogger } from './utils/logger.js';
import { URLS } from './actions/wegmans/selectors.js';
import fs from 'fs';
import path from 'path';

// Simple config for auth server - doesn't need full app config
const DATA_PATH = process.env.DATA_PATH || './data';
const BROWSER_STATE_PATH = path.join(DATA_PATH, 'browser-state');

const logger = createLogger('auth-server');

const HTML_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
  <title>Hans - Wegmans Auth</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
    h1 { color: #1a472a; }
    .status { padding: 20px; border-radius: 8px; margin: 20px 0; }
    .status.success { background: #d4edda; color: #155724; }
    .status.error { background: #f8d7da; color: #721c24; }
    .status.pending { background: #fff3cd; color: #856404; }
    button { background: #1a472a; color: white; border: none; padding: 12px 24px;
             border-radius: 4px; cursor: pointer; font-size: 16px; margin: 5px; }
    button:hover { background: #2d5a3d; }
    button:disabled { background: #ccc; cursor: not-allowed; }
    .instructions { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
    #screenshot { max-width: 100%; border: 1px solid #ddd; margin: 20px 0; }
    .hidden { display: none; }
  </style>
</head>
<body>
  <h1>Hans - Wegmans Authentication</h1>

  <div class="instructions">
    <h3>SSH Tunnel Instructions:</h3>
    <code>ssh -L 3847:localhost:3847 user@raspberry-pi</code>
    <p>Then open <a href="http://localhost:3847">http://localhost:3847</a> in your browser.</p>
  </div>

  <div id="status" class="status pending">Checking authentication status...</div>

  <div id="actions">
    <button id="checkBtn" onclick="checkStatus()">Check Status</button>
    <button id="loginBtn" onclick="startLogin()">Start Login</button>
    <button id="screenshotBtn" onclick="getScreenshot()">View Browser</button>
  </div>

  <div id="login-form" class="hidden">
    <h3>Interactive Login</h3>
    <p>The browser is now open. Use these controls to interact:</p>
    <div>
      <input type="text" id="input-text" placeholder="Text to type" style="padding: 8px; width: 200px;">
      <button onclick="typeText()">Type</button>
      <button onclick="pressEnter()">Press Enter</button>
    </div>
    <div style="margin-top: 10px;">
      <button onclick="clickAt()">Click (center of screenshot)</button>
      <button onclick="saveSession()">Save Session</button>
    </div>
  </div>

  <img id="screenshot" class="hidden" alt="Browser screenshot">

  <script>
    async function checkStatus() {
      const res = await fetch('/api/status');
      const data = await res.json();
      const el = document.getElementById('status');
      el.className = 'status ' + (data.authenticated ? 'success' : 'pending');
      el.textContent = data.authenticated ? 'Authenticated!' : 'Not authenticated - click "Start Login"';
    }

    async function startLogin() {
      document.getElementById('status').textContent = 'Starting browser...';
      const res = await fetch('/api/login', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        document.getElementById('login-form').classList.remove('hidden');
        getScreenshot();
      }
      document.getElementById('status').textContent = data.message;
    }

    async function getScreenshot() {
      const res = await fetch('/api/screenshot');
      const blob = await res.blob();
      const img = document.getElementById('screenshot');
      img.src = URL.createObjectURL(blob);
      img.classList.remove('hidden');
    }

    async function typeText() {
      const text = document.getElementById('input-text').value;
      await fetch('/api/type', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      getScreenshot();
    }

    async function pressEnter() {
      await fetch('/api/key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'Enter' })
      });
      setTimeout(getScreenshot, 1000);
    }

    async function clickAt() {
      await fetch('/api/click', { method: 'POST' });
      setTimeout(getScreenshot, 500);
    }

    async function saveSession() {
      const res = await fetch('/api/save', { method: 'POST' });
      const data = await res.json();
      const el = document.getElementById('status');
      el.className = 'status ' + (data.success ? 'success' : 'error');
      el.textContent = data.message;
    }

    checkStatus();
    setInterval(getScreenshot, 5000); // Auto-refresh screenshot
  </script>
</body>
</html>
`;

class AuthServer {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async start(port: number = 3847) {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url || '/', `http://localhost:${port}`);

      try {
        if (url.pathname === '/') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(HTML_TEMPLATE);
        } else if (url.pathname === '/api/status') {
          const authenticated = await this.checkAuth();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ authenticated }));
        } else if (url.pathname === '/api/login' && req.method === 'POST') {
          await this.startBrowser();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Browser started. Complete login below.' }));
        } else if (url.pathname === '/api/screenshot') {
          const screenshot = await this.getScreenshot();
          if (screenshot) {
            res.writeHead(200, { 'Content-Type': 'image/png' });
            res.end(screenshot);
          } else {
            res.writeHead(404);
            res.end('No browser session');
          }
        } else if (url.pathname === '/api/type' && req.method === 'POST') {
          const body = await this.readBody(req);
          const { text } = JSON.parse(body);
          await this.page?.keyboard.type(text);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } else if (url.pathname === '/api/key' && req.method === 'POST') {
          const body = await this.readBody(req);
          const { key } = JSON.parse(body);
          await this.page?.keyboard.press(key);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } else if (url.pathname === '/api/click' && req.method === 'POST') {
          const viewport = this.page?.viewportSize();
          if (viewport) {
            await this.page?.mouse.click(viewport.width / 2, viewport.height / 2);
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } else if (url.pathname === '/api/save' && req.method === 'POST') {
          await this.saveSession();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Session saved! You can close this page.' }));
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      } catch (error) {
        logger.error('Request error', { error });
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(error) }));
      }
    });

    server.listen(port, () => {
      logger.info(`Auth server running on http://localhost:${port}`);
      console.log('\n' + '='.repeat(60));
      console.log('WEGMANS AUTH SERVER STARTED');
      console.log('='.repeat(60));
      console.log(`\nTo authenticate via SSH tunnel:`);
      console.log(`  1. ssh -L ${port}:localhost:${port} user@your-pi`);
      console.log(`  2. Open http://localhost:${port} in your browser`);
      console.log('\n' + '='.repeat(60) + '\n');
    });
  }

  private async checkAuth(): Promise<boolean> {
    const statePath = path.join(BROWSER_STATE_PATH, 'wegmans');
    return fs.existsSync(statePath);
  }

  private async startBrowser() {
    if (this.browser) {
      await this.browser.close();
    }

    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
    });

    this.page = await context.newPage();
    await this.page.goto(URLS.login);
  }

  private async getScreenshot(): Promise<Buffer | null> {
    if (!this.page) return null;
    return await this.page.screenshot();
  }

  private async saveSession() {
    if (!this.page) throw new Error('No browser session');

    const statePath = path.join(BROWSER_STATE_PATH, 'wegmans');
    const context = this.page.context();
    await context.storageState({ path: statePath });

    logger.info('Session saved', { path: statePath });

    await this.browser?.close();
    this.browser = null;
    this.page = null;
  }

  private readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => resolve(body));
      req.on('error', reject);
    });
  }
}

// Run if called directly
const server = new AuthServer();
server.start();
