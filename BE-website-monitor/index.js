const express = require('express');
const fs = require('fs');
const cors = require('cors');
const puppeteer = require('puppeteer');
const path = require('path');
const app = express();
const PORT = 5001;

const websites = [
  { name: "Trang chủ trung tâm", url: "https://ktxhcm.edu.vn/", isIframe: true },
  { name: "Trang sinh viên", url: "http://sv.ktxhcm.edu.vn/", isIframe: true },
  { name: "Trang quản lý sinh viên", url: "https://ql.ktxhcm.edu.vn/", isIframe: true },
  { name: "Trang CNTT-DL", url: "https://cntt-dl.ktxhcm.edu.vn/", isIframe: true },
  { name: "Trang khảo sát", url: "https://khaosat.ktxhcm.edu.vn/", isIframe: true },
  { name: "Trang báo cáo thông minh", url: "https://bi.ktxhcm.edu.vn/", isIframe: true },
  { name: "Trang quản lý FaceID", url: "https://face.ktxhcm.edu.vn/", isIframe: true },
];

// Async function to capture a screenshot
async function captureScreenshot(url, name) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(url);
  const screenshotPath = path.join(__dirname, 'screenshots', `${name}.png`);
  await page.screenshot({ path: screenshotPath });
  await browser.close();
  return screenshotPath;
}

// Function to check website status using Puppeteer
async function checkWebsites() {
  const statusList = await Promise.all(websites.map(async (site) => {
    try {
      const browser = await puppeteer.launch();
      const page = await browser.newPage();
      await page.goto(site.url, { waitUntil: 'networkidle2' }); // Ensure page is fully loaded

      // Check for X-Frame-Options header (if available)
      const xFrame = await page.evaluate(() => {
        return document.querySelector('meta[http-equiv="X-Frame-Options"]') ? 'DENY' : 'ALLOW';
      });

      const shouldSnapshot = xFrame === 'DENY';

      if (shouldSnapshot) {
        const screenshotPath = await captureScreenshot(site.url, site.name);
        const publicScreenshotPath = `/screenshots/${path.basename(screenshotPath)}`;
        await browser.close();
        return { ...site, status: 'checking', iframeBlocked: true, screenshot: publicScreenshotPath };
      }

      await browser.close();
      return { ...site, status: 'online', iframeBlocked: false };
    } catch (err) {
      console.error('Error checking website:', site.url, err);
      const screenshotPath = await captureScreenshot(site.url, site.name);
      const publicScreenshotPath = screenshotPath ? `/screenshots/${path.basename(screenshotPath)}` : null;
      return { ...site, status: 'offline', iframeBlocked: true, screenshot: publicScreenshotPath };
    }
  }));

  return statusList;
}

// Route to get website status
app.get('/websites-status', async (req, res) => {
  try {
    const statusList = await checkWebsites();
    res.json(statusList);
  } catch (err) {
    res.status(500).json({ error: 'Failed to check website status' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
