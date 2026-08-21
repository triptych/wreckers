import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 480, height: 700 } });
const errors = [];
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', err => errors.push('pageerror: ' + err.message));

await page.goto('http://localhost:8934/index.html');
await page.waitForTimeout(500);
await page.screenshot({ path: '_smoke_title.png' });

// press START
await page.click('#kf');
await page.waitForTimeout(300);
await page.screenshot({ path: '_smoke_playing.png' });

// hold left turn for a bit to exercise beam logic
await page.dispatchEvent('#kl', 'pointerdown', { pointerId: 1 });
await page.waitForTimeout(1500);
await page.dispatchEvent('#kl', 'pointerup', { pointerId: 1 });
await page.waitForTimeout(500);
await page.screenshot({ path: '_smoke_after.png' });

console.log('ERRORS:', JSON.stringify(errors));
await browser.close();
