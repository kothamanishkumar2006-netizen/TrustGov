const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = 'C:\\Users\\Manish Kumar\\.gemini\\antigravity-ide\\brain\\dd17e136-08a1-4d2a-9a04-8f62d5ed6ce3\\chrome_visible_profile';

if (!fs.existsSync(profileDir)) {
  fs.mkdirSync(profileDir, { recursive: true });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log('====================================================');
  console.log('  LAUNCHING VISIBLE GOOGLE CHROME FOR LIVE DEMO');
  console.log('====================================================\n');

  // Launch Chrome as an independent, detached process so it stays open
  const chromeProc = spawn(chromePath, [
    '--remote-debugging-port=9222',
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1400,920',
    'http://localhost:5173/login'
  ], {
    detached: true,
    stdio: 'ignore'
  });
  chromeProc.unref();

  console.log('Chrome launched! Waiting 3 seconds for connection...');
  await sleep(3000);

  try {
    const listRes = await fetch('http://127.0.0.1:9222/json/list');
    const tabs = await listRes.json();
    const pageTab = tabs.find(t => t.type === 'page');
    if (!pageTab) throw new Error('Could not find active Chrome tab');

    console.log('Connecting to Chrome DevTools Protocol...');
    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

    let msgId = 1;
    const pending = new Map();

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id && pending.has(data.id)) {
        pending.get(data.id)(data);
        pending.delete(data.id);
      }
    };

    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = rej;
    });

    function send(method, params = {}) {
      return new Promise((resolve) => {
        const id = msgId++;
        pending.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    async function evaluate(expression) {
      const res = await send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true
      });
      return res.result?.result?.value;
    }

    await send('Page.enable');
    await send('Runtime.enable');

    console.log('\n[STAGE 1/6] Displaying Security Gateway Login in Chrome...');
    await send('Page.navigate', { url: 'http://localhost:5173/login' });
    await sleep(3500);

    console.log('[STAGE 2/6] Auto-signing in as Demo Citizen...');
    await evaluate(`
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Demo Citizen'));
      if (btn) btn.click();
    `);
    await sleep(4000);

    console.log('[STAGE 3/6] Demonstrating Citizen Officer Verification (TG-OFF-001)...');
    await evaluate(`
      const codeTab = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Officer Code'));
      if (codeTab) codeTab.click();

      const input = document.querySelector('input[placeholder*="TG-OFF"]');
      if (input) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, 'TG-OFF-001');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }

      const select = document.querySelector('select');
      if (select) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
        setter.call(select, 'OTP_REQUEST');
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    `);
    await sleep(2500);

    console.log('[STAGE 3b] Submitting verification to trigger 5-tier checks and Anti-Scam Shield...');
    await evaluate(`
      const submitBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Run Verification Checks'));
      if (submitBtn) submitBtn.click();
    `);
    await sleep(5000);

    console.log('[STAGE 4/6] Demonstrating Officer Portal with Cryptographic Badge & DID...');
    await evaluate(`
      localStorage.clear();
      window.location.href = '/login';
    `);
    await sleep(2000);
    await evaluate(`
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Demo Officer'));
      if (btn) btn.click();
    `);
    await sleep(5000);

    console.log('[STAGE 5/6] Demonstrating Admin Portal & Officer Management...');
    await evaluate(`
      localStorage.clear();
      window.location.href = '/login';
    `);
    await sleep(2000);
    await evaluate(`
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Demo Admin'));
      if (btn) btn.click();
    `);
    await sleep(3500);
    await send('Page.navigate', { url: 'http://localhost:5173/admin/officers' });
    await sleep(4500);

    console.log('[STAGE 6/6] Demonstrating IVR Telephony Gateway Simulator...');
    await send('Page.navigate', { url: 'http://localhost:5173/ivr' });
    await sleep(3000);
    await evaluate(`
      const demo1Btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Demo 1: Valid Officer'));
      if (demo1Btn) demo1Btn.click();
    `);
    await sleep(4000);

    console.log('\n====================================================');
    console.log('  LIVE DEMO COMPLETED SUCCESSFULLY IN CHROME!');
    console.log('  Chrome remains open on your desktop for you to explore.');
    console.log('====================================================\n');

    ws.close();
  } catch (err) {
    console.error('Demo automation error:', err);
  }
}

run();
