// server.js

const express             = require('express');
const fs                  = require('fs').promises;
const path                = require('path');
const cors                = require('cors');
const puppeteer           = require('puppeteer');
const axios               = require('axios');
const { default: pLimit } = require('p-limit');
const os                  = require('os');

const app             = express();
const PORT            = 5000;
const REQUEST_TIMEOUT = 20_000;       // 20s
const CACHE_DURATION  = 60 * 1000;    // 1 phút
const MAX_CONCURRENCY = 2;            // điều chỉnh theo tài nguyên

// Thư mục lưu screenshots
const screenshotsDir = path.join(__dirname, 'screenshots');
let websites    = [];
let browser     = null;
let cache       = null;
let lastChecked = 0;

// Bắt unhandled rejections để tránh crash
process.on('unhandledRejection', err => {
  console.error('💥 Unhandled rejection:', err);
});

// Đọc file website.json 1 lần
async function loadWebsites() {
  const filePath = path.join(__dirname, '..', 'website-monitor', 'src', 'website.json');
  const data     = await fs.readFile(filePath, 'utf8');
  return JSON.parse(data);
}

// Khởi tạo Puppeteer (singleton)
async function launchBrowser() {
  const opts = {
    headless: true,
    args: [ '--no-sandbox','--disable-setuid-sandbox' ],
  };
  if (process.platform === 'win32') {
    opts.executablePath = path.join(__dirname, 'chromium/.../chrome.exe');
  } else {
    console.log('Using default Puppeteer executable:', puppeteer.executablePath());
  }
  return puppeteer.launch(opts);
}

// Delay helper
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Chụp screenshot với đợi JS render + fullPage
async function captureScreenshot(page, name) {
  const fileName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.png';
  const fullPath = path.join(screenshotsDir, fileName);
  try {
    await page.emulateMediaType('screen');
    await delay(1000);
    await page.screenshot({ path: fullPath, fullPage: true });
    return `/screenshots/${fileName}`;
  } catch (err) {
    console.error('❌ Screenshot failed for', name, err);
    return null;
  }
}

// Kiểm tra 1 site
async function checkWebsiteStatus(site) {
  const result = {
    name:          site.name,
    url:           site.url,
    status:        'offline',
    statusCode:    0,
    loadTime:      null,
    screenshot:    null,
    iframeBlocked: false,
  };

  // 1) Quick HEAD check nếu chỉ cần alive/dead
  if (site.isIframe && !site.isSnapshot) {
    try {
      const t0   = Date.now();
      const resp = await axios.head(site.url, { timeout: REQUEST_TIMEOUT });
      result.status        = 'online';
      result.statusCode    = resp.status;
      result.loadTime      = Date.now() - t0;
      result.iframeBlocked = false;
    } catch (err) {
      result.statusCode = err.response?.status || 0;
    }
    return result;
  }

  // 2) Dùng Puppeteer cho snapshot hoặc kiểm tra X-Frame-Options
  let page;
  try {
    const browserInst = await launchBrowser();
    page = await browserInst.newPage();
    await page.setCacheEnabled(false);
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');

    const t0   = Date.now();
    const resp = await page.goto(site.url, {
      waitUntil: 'domcontentloaded',
      timeout:    REQUEST_TIMEOUT,
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma':        'no-cache',
        'If-None-Match': '',
      },
    });
    result.loadTime   = Date.now() - t0;
    result.statusCode = resp.status();
    result.status     = result.statusCode === 200 ? 'online' : 'offline';

    if (result.status === 'online') {
      if (site.isSnapshot) {
        result.screenshot    = await captureScreenshot(page, site.name);
        result.iframeBlocked = false;
      } else if (site.isIframe) {
        const xfo = await page.evaluate(() => {
          const m = document.querySelector('meta[http-equiv="X-Frame-Options"]');
          return m ? m.content : '';
        });
        result.iframeBlocked = /deny|sameorigin/i.test(xfo);
        if (result.iframeBlocked) {
          result.screenshot = await captureScreenshot(page, site.name);
        }
      }
    }
  } catch (err) {
    console.error(`❌ Error checking ${site.name}:`, err.message);
  } finally {
    if (page) await page.close();
  }

  return result;
}

// Ghi log kết quả
async function logStatus(results) {
  const timestamp = new Date().toISOString();
  let entry = `=================== \n${timestamp}\n===================\n`;
  for (const r of results) {
    entry +=
      `${r.name} | ${r.url} | ${r.status.toUpperCase()} | ` +
      `HTTP ${r.statusCode} | loadTime=${r.loadTime}ms | ` +
      `iframeBlocked=${r.iframeBlocked} | ` +
      `screenshot=${r.screenshot || 'N/A'}\n`;
  }
  try {
    await fs.appendFile('status_log.txt', entry, 'utf8');
  } catch (err) {
    console.error('❌ Write log failed:', err);
  }
}

// Xử lý chính cho /api/status và /api/status/nocache
async function handleStatusRequest(useCache = true) {
  const now = Date.now();
  if (useCache && cache && (now - lastChecked) < CACHE_DURATION) {
    return cache;
  }

  await fs.mkdir(screenshotsDir, { recursive: true });

  const limitConcurrency = pLimit(Math.min(websites.length, MAX_CONCURRENCY));
  const checks = websites.map(site => limitConcurrency(() => checkWebsiteStatus(site)));
  const settled = await Promise.allSettled(checks);
  const results = settled
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value);

  // await logStatus(results);

  const output = results.reduce((acc, r) => {
    acc[r.name] = {
      status:        r.status,
      statusCode:    r.statusCode,
      loadTime:      r.loadTime,
      iframeBlocked: r.iframeBlocked,
      screenshot:    r.screenshot,
    };
    return acc;
  }, {});

  cache       = output;
  lastChecked = now;
  return output;
}

// Khởi động server
(async () => {
  try {
    websites = await loadWebsites();
    await launchBrowser();
  } catch (err) {
    console.error('❌ Startup error:', err);
    process.exit(1);
  }

  app.use(cors());
  app.use('/screenshots', express.static(screenshotsDir));

  // Endpoint có cache
  app.get('/api/status', async (req, res) => {
    res.json(await handleStatusRequest(true));
  });

  // Endpoint không cache
  app.get('/api/status/nocache', async (req, res) => {
    res.json(await handleStatusRequest(false));
  });

  // Endpoint streaming bằng SSE
  app.get('/api/status/stream', async (req, res) => {
    // Thiết lập headers SSE
    res.writeHead(200, {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection:      'keep-alive',
    });
    res.write('\n');

    await launchBrowser();

    const limitStream    = pLimit(Math.min(websites.length, MAX_CONCURRENCY));
    const streamResults  = [];

    // helper gửi SSE
    const sendEvent = (data, eventName) => {
      if (res.writableEnded) return;
      if (eventName) res.write(`event: ${eventName}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Chạy song song, thu kết quả
    const tasks = websites.map(site =>
      limitStream(async () => {
        const r = await checkWebsiteStatus(site);
        streamResults.push(r);
        sendEvent({
          name:          r.name,
          status:        r.status,
          statusCode:    r.statusCode,
          loadTime:      r.loadTime,
          iframeBlocked: r.iframeBlocked,
          screenshot:    r.screenshot,
        });
      })
    );

    try {
      await Promise.all(tasks);
      // Ghi log sau khi stream xong
      await logStatus(streamResults);
      sendEvent({}, 'done');
    } catch (err) {
      console.error('Stream error:', err);
    } finally {
      res.end();
    }
  });

  process.on('SIGINT', async () => {
    console.log('🛑 Shutting down...');
    if (browser) await browser.close();
    process.exit();
  });

  app.listen(PORT, () => {
    console.log(`✅ Server listening on http://localhost:${PORT}`);
  });
})();
