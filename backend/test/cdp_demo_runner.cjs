const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const artifactDir = 'C:\\Users\\Manish Kumar\\.gemini\\antigravity-ide\\brain\\dd17e136-08a1-4d2a-9a04-8f62d5ed6ce3';
const profileDir = path.join(artifactDir, 'chrome_demo_profile_final');

if (!fs.existsSync(profileDir)) {
  fs.mkdirSync(profileDir, { recursive: true });
}

async function run() {
  console.log('Launching headless Chrome on port 9222...');
  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    `--user-data-dir=${profileDir}`,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1440,1100',
    'http://localhost:5173/login'
  ]);

  await new Promise(r => setTimeout(r, 2500));

  try {
    const listRes = await fetch('http://127.0.0.1:9222/json/list');
    const tabs = await listRes.json();
    const pageTab = tabs.find(t => t.type === 'page');
    if (!pageTab) throw new Error('No page tab found');

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

    async function takeScreenshot(filename) {
      const targetPath = path.join(artifactDir, filename);
      const res = await send('Page.captureScreenshot', { format: 'png' });
      if (res.result?.data) {
        fs.writeFileSync(targetPath, Buffer.from(res.result.data, 'base64'));
        console.log(`Saved screenshot: ${filename}`);
      }
    }

    await send('Page.enable');
    await send('Runtime.enable');

    // 1. Login page
    console.log('Capturing Login Page...');
    await send('Page.navigate', { url: 'http://localhost:5173/login' });
    await new Promise(r => setTimeout(r, 2000));
    await takeScreenshot('demo_01_login.png');

    // 2. Citizen Login & Dashboard
    console.log('Logging in as Citizen...');
    await evaluate(`
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Demo Citizen'));
      if (btn) btn.click();
    `);
    await new Promise(r => setTimeout(r, 2500));
    await takeScreenshot('demo_02_citizen_dashboard.png');

    // 3. Officer Verification with OTP Warning
    console.log('Performing verification on TG-OFF-001 with OTP demand...');
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

      const submitBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Run Verification Checks'));
      if (submitBtn) submitBtn.click();
    `);
    await new Promise(r => setTimeout(r, 3500));
    await takeScreenshot('demo_03_officer_verified.png');

    // 4. Request Live Cryptographic Challenge
    console.log('Requesting live proof-of-possession challenge...');
    await evaluate(`
      const chgBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Request Live Challenge'));
      if (chgBtn) chgBtn.click();
    `);
    await new Promise(r => setTimeout(r, 2500));
    await takeScreenshot('demo_04_live_challenge.png');

    // 5. Officer Login & Officer Portal
    console.log('Logging out and entering Officer Portal...');
    await evaluate(`
      localStorage.clear();
      window.location.href = '/login';
    `);
    await new Promise(r => setTimeout(r, 1500));
    await evaluate(`
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Demo Officer'));
      if (btn) btn.click();
    `);
    await new Promise(r => setTimeout(r, 2500));
    await takeScreenshot('demo_05_officer_portal.png');

    // 6. Admin Login & Dashboard
    console.log('Logging out and entering Admin Portal...');
    await evaluate(`
      localStorage.clear();
      window.location.href = '/login';
    `);
    await new Promise(r => setTimeout(r, 1500));
    await evaluate(`
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Demo Admin'));
      if (btn) btn.click();
    `);
    await new Promise(r => setTimeout(r, 2500));
    await takeScreenshot('demo_06_admin_dashboard.png');

    // 7. Admin Officer Management
    console.log('Navigating to Officer Management...');
    await send('Page.navigate', { url: 'http://localhost:5173/admin/officers' });
    await new Promise(r => setTimeout(r, 2500));
    await takeScreenshot('demo_07_officer_management.png');

    // 8. IVR Simulator - Automated Scenario 1
    console.log('Navigating to IVR Simulator and launching Demo 1...');
    await send('Page.navigate', { url: 'http://localhost:5173/ivr' });
    await new Promise(r => setTimeout(r, 2000));
    await evaluate(`
      const demo1Btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Demo 1: Valid Officer'));
      if (demo1Btn) demo1Btn.click();
    `);
    await new Promise(r => setTimeout(r, 3000));
    await takeScreenshot('demo_08_ivr_simulator.png');

    console.log('\nAll 8 live demo screenshots successfully updated!');
    ws.close();
  } catch (err) {
    console.error('Demo execution error:', err);
  } finally {
    chromeProc.kill();
  }
}

run();
