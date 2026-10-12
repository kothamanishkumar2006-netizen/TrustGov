/**
 * TRUSTGOV - PHASE 10 TEST SUITE: IVR ACCESSIBILITY & VOICE SAFETY GATEWAY
 * 
 * Tests:
 * Category A: Session Creation (Tests 1-5)
 * Category B: Input Validation (Tests 6-10)
 * Category C: Officer Verification (Tests 11-17)
 * Category D: Security & Anti-Enumeration (Tests 18-25)
 * Category E: Phase 8 Authorization Integration (Tests 26-30)
 * Category F: Phase 9 Scam Reporting Integration (Tests 31-35)
 * Category G: Privacy & Data Minimization (Tests 36-39)
 * Category H: Lifecycle & End-to-End Simulation (Tests 40-42)
 */

const http = require('http');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('================================================================');
  console.log('TRUSTGOV - PHASE 10: IVR ACCESSIBILITY & VOICE SAFETY TESTS');
  console.log('================================================================\n');

  let testCount = 0;
  let passCount = 0;

  function record(name, pass, details = {}) {
    testCount++;
    if (pass) passCount++;
    const icon = pass ? '✓' : '✗';
    console.log(`[${icon}] Test ${testCount}: ${name}`);
    if (!pass && Object.keys(details).length > 0) {
      console.log('    Details:', JSON.stringify(details, null, 2));
    }
  }

  try {
    // 0. Reset simulator state
    await request({
      hostname: 'localhost', port: 5000, path: '/api/ivr/simulator/reset', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    // Authenticate admin for checking audit logs and reports
    const adminLogin = await request({
      hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'admin@trustgov.demo', password: 'password123' });
    const adminToken = adminLogin.body?.data?.token;

    console.log('--- Category A: Session Creation ---');

    // Test 1: Start IVR session
    const startRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/ivr/call/start', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { callerId: '+91 98765 43210' });
    record(
      'Start IVR session returns HTTP 201 (POST /api/ivr/call/start)',
      startRes.status === 201 && startRes.body?.success === true,
      startRes.body
    );

    const sessionA = startRes.body?.data;

    // Test 2: Session ID generated in TG-IVR-XXXXXXXX format
    const sessionIdValid = typeof sessionA?.sessionId === 'string' && /^TG-IVR-[A-Z0-9]{8}$/.test(sessionA.sessionId);
    record(
      'Session ID generated in safe TG-IVR-XXXXXXXX format',
      sessionIdValid,
      { sessionId: sessionA?.sessionId }
    );

    // Test 3: Session expiration TTL
    const expDate = new Date(sessionA?.expiresAt || 0);
    const ttlValid = expDate.getTime() > Date.now() + 4 * 60 * 1000 && expDate.getTime() <= Date.now() + 6 * 60 * 1000;
    record(
      'Session expiration TTL configured to ~5 minutes',
      ttlValid,
      { expiresAt: sessionA?.expiresAt }
    );

    // Test 4: Initial state is WELCOME or MENU
    record(
      'Initial state is WELCOME / MENU and status is ACTIVE',
      (sessionA?.state === 'WELCOME' || sessionA?.state === 'MENU') && sessionA?.status === 'ACTIVE',
      { state: sessionA?.state, status: sessionA?.status }
    );

    // Test 5: Safe response payload (no secrets, DB ids, or keys)
    const rawStartJson = JSON.stringify(startRes.body);
    const hasSecretsInStart = /privateKey|password_hash|secret|token|DATABASE_URL/i.test(rawStartJson);
    record(
      'Safe response payload (zero private keys, passwords, or internal secrets leaked)',
      !hasSecretsInStart && sessionA?.prompt?.includes('TrustGov demonstration'),
      { hasSecrets: hasSecretsInStart }
    );

    console.log('\n--- Category B: Input Validation ---');

    // Test 6: Valid DTMF navigation digit ('1' -> COLLECT_OFFICER_CODE)
    const dtmf1 = await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${sessionA.sessionId}/input`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { inputType: 'DTMF', value: '1' });
    record(
      'Valid DTMF keypad digit 1 advances state to COLLECT_OFFICER_CODE',
      dtmf1.status === 200 && dtmf1.body?.data?.state === 'COLLECT_OFFICER_CODE',
      dtmf1.body?.data
    );

    // Test 7: Invalid DTMF digit handled safely
    const dtmfInvalid = await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${sessionA.sessionId}/input`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { inputType: 'DTMF', value: '7' });
    record(
      'Invalid DTMF digit handled safely without server crash',
      dtmfInvalid.status === 200 && dtmfInvalid.body?.data?.status === 'ACTIVE',
      dtmfInvalid.body?.data
    );

    // Test 8: Unexpected input in given state
    const dtmfSymbol = await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${sessionA.sessionId}/input`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { inputType: 'DTMF', value: 'UNKNOWN_INPUT_RANDOM' });
    record(
      'Unexpected non-standard input handled gracefully',
      dtmfSymbol.status === 200 && dtmfSymbol.body?.success === true,
      dtmfSymbol.body
    );

    // Test 9: Empty input
    const emptyInput = await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${sessionA.sessionId}/input`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { inputType: 'DTMF', value: '' });
    record(
      'Empty input safely prompts caller without crash',
      emptyInput.status === 200 && emptyInput.body?.data?.prompt?.length > 0,
      emptyInput.body?.data
    );

    // Test 10: Oversized input (>100 characters)
    const largeStr = 'A'.repeat(300);
    const largeInput = await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${sessionA.sessionId}/input`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { inputType: 'DTMF', value: largeStr });
    record(
      'Oversized input rejected cleanly without buffer error',
      largeInput.status === 200 && largeInput.body?.data?.prompt?.includes('too long'),
      largeInput.body?.data
    );

    console.log('\n--- Category C: Officer Verification ---');

    // Create fresh session for verification testing
    const vfyCall = await request({
      hostname: 'localhost', port: 5000, path: '/api/ivr/call/start', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { callerId: '+91 99999 11111' });
    const sessionVfy = vfyCall.body?.data;

    // Advance to COLLECT_OFFICER_CODE
    await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${sessionVfy.sessionId}/input`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { inputType: 'DTMF', value: '1' });

    // Test 11: Valid officer code TG-OFF-001
    const validOff = await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${sessionVfy.sessionId}/input`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { inputType: 'DTMF', value: 'TG-OFF-001' });
    record(
      'Valid officer code TG-OFF-001 returns VERIFIED and advances state',
      validOff.status === 200 && validOff.body?.data?.verificationResult === 'VERIFIED' && validOff.body?.data?.state === 'IDENTITY_RESULT',
      validOff.body?.data
    );

    // Test 12: Invalid officer code TG-OFF-999 (Anti-enumeration: generic failure)
    const fakeOffCall = await request({
      hostname: 'localhost', port: 5000, path: '/api/ivr/call/start', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const sFake = fakeOffCall.body?.data;
    await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${sFake.sessionId}/input`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { inputType: 'DTMF', value: '1' });

    const fakeOffRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${sFake.sessionId}/input`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { inputType: 'DTMF', value: 'TG-OFF-999' });
    const fakePrompt = fakeOffRes.body?.data?.prompt || '';
    const antiEnumCheck = fakePrompt.includes('could not verify that officer code') && !fakePrompt.includes('does not exist');
    record(
      'Invalid officer code returns generic failure (anti-enumeration: never reveals "does not exist")',
      antiEnumCheck,
      { prompt: fakePrompt }
    );

    // Test 13: Officer status handling: suspended officer (TG-OFF-005)
    const suspCall = await request({
      hostname: 'localhost', port: 5000, path: '/api/ivr/call/start', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const sSusp = suspCall.body?.data;
    await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${sSusp.sessionId}/input`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { inputType: 'DTMF', value: '1' });

    const suspRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${sSusp.sessionId}/input`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { inputType: 'DTMF', value: 'TG-OFF-005' });
    record(
      'Suspended officer (TG-OFF-005) returns SUSPENDED / cannot currently be verified',
      suspRes.body?.data?.verificationResult === 'SUSPENDED' || suspRes.body?.data?.prompt?.includes('cannot currently be verified'),
      suspRes.body?.data
    );

    // Test 14: Verification service integration (stores reference in citizen_verification_history)
    const vfyRef = validOff.body?.data?.verificationReference;
    const pubCheck = await request({
      hostname: 'localhost', port: 5000, path: `/api/verification/public/${vfyRef}`, method: 'GET'
    });
    const pubRefMatches = pubCheck.body?.data?.verificationId === vfyRef || pubCheck.body?.data?.verificationReference === vfyRef;
    record(
      'Verification integrates with Phase 7 store (reference accessible in public lookup)',
      pubCheck.status === 200 && pubRefMatches,
      pubCheck.body?.data
    );

    // Test 15: Verification failure records attempt
    record(
      'Verification failure properly increments attempt counter',
      fakeOffRes.body?.data?.attemptCount >= 1,
      { attemptCount: fakeOffRes.body?.data?.attemptCount }
    );

    // Test 16: Verification incomplete: live proof-of-possession limitation honestly handled
    const popIncompleteCall = await request({
      hostname: 'localhost', port: 5000, path: '/api/ivr/call/start', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const sIncomplete = popIncompleteCall.body?.data;
    await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${sIncomplete.sessionId}/input`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { inputType: 'DTMF', value: '1' });
    const incompleteRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${sIncomplete.sessionId}/input`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { inputType: 'DTMF', value: 'TG-OFF-001-POP' });
    record(
      'Proof-of-possession limitation honestly returns INCOMPLETE over phone channel',
      incompleteRes.body?.data?.verificationResult === 'INCOMPLETE' && incompleteRes.body?.data?.prompt?.includes('live possession verification could not be completed'),
      incompleteRes.body?.data
    );

    // Test 17: No private-key or credential secret exposure in verification
    const vfyPayloadStr = JSON.stringify(validOff.body);
    const keyLeak = /BEGIN PRIVATE KEY|BEGIN RSA|Ed25519Private|issuerSecret/i.test(vfyPayloadStr);
    record(
      'Zero private keys, secrets, or PEM blocks in verification response',
      !keyLeak,
      { keyLeak }
    );

    console.log('\n--- Category D: Security & Anti-Tampering ---');

    // Test 18: Session tampering blocked (server-side state authoritative)
    const tamperRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${sessionA.sessionId}/input`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      inputType: 'DTMF',
      value: '1',
      state: 'VERIFIED',
      decision: 'ALLOW',
      riskLevel: 'LOW'
    });
    record(
      'Client manipulation of state/decision blocked (server state is strictly authoritative)',
      tamperRes.status === 200 && tamperRes.body?.data?.state !== 'VERIFIED',
      tamperRes.body?.data
    );

    // Test 19: Expired session blocked (using simulator expire endpoint)
    await request({
      hostname: 'localhost', port: 5000, path: '/api/ivr/simulator/expire', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { sessionId: sessionA.sessionId });

    const expiredInput = await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${sessionA.sessionId}/input`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { inputType: 'DTMF', value: '1' });
    record(
      'Expired session blocks further input and returns sessionExpired prompt',
      expiredInput.body?.data?.status === 'EXPIRED' && expiredInput.body?.data?.prompt?.includes('expired'),
      expiredInput.body?.data
    );

    // Test 20: Completed session blocked
    const endCallRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${sessionVfy.sessionId}/end`, method: 'POST'
    });
    const postEndInput = await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${sessionVfy.sessionId}/input`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { inputType: 'DTMF', value: '1' });
    record(
      'Completed session blocked from further interaction',
      endCallRes.body?.data?.status === 'COMPLETED' && postEndInput.body?.data?.status === 'COMPLETED',
      { endStatus: endCallRes.body?.data?.status, postEndStatus: postEndInput.body?.data?.status }
    );

    // Test 21: Attempt limit enforcement (Lock session after 5 invalid attempts)
    const lockCall = await request({
      hostname: 'localhost', port: 5000, path: '/api/ivr/call/start', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const sLock = lockCall.body?.data;
    await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${sLock.sessionId}/input`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { inputType: 'DTMF', value: '1' });

    let finalLockRes;
    for (let i = 0; i < 5; i++) {
      finalLockRes = await request({
        hostname: 'localhost', port: 5000, path: `/api/ivr/session/${sLock.sessionId}/input`, method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, { inputType: 'DTMF', value: 'BAD-CODE-XXX' });
    }
    record(
      'Excessive failed officer code attempts lock session (status: LOCKED)',
      finalLockRes.body?.data?.status === 'LOCKED' && finalLockRes.body?.data?.prompt?.includes('locked'),
      finalLockRes.body?.data
    );

    // Test 22: Enumeration protection: identical failure prompt
    const enum1 = await request({
      hostname: 'localhost', port: 5000, path: '/api/ivr/call/start', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${enum1.body?.data?.sessionId}/input`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { inputType: 'DTMF', value: '1' });
    const enumFail1 = await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${enum1.body?.data?.sessionId}/input`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { inputType: 'DTMF', value: 'TG-OFF-777' });

    const enum2 = await request({
      hostname: 'localhost', port: 5000, path: '/api/ivr/call/start', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${enum2.body?.data?.sessionId}/input`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { inputType: 'DTMF', value: '1' });
    const enumFail2 = await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${enum2.body?.data?.sessionId}/input`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { inputType: 'DTMF', value: 'TG-OFF-888' });

    record(
      'Enumeration protection: identical generic failure for differing non-existent officers',
      enumFail1.body?.data?.prompt === enumFail2.body?.data?.prompt && enumFail1.body?.data?.prompt?.includes('could not verify'),
      { prompt1: enumFail1.body?.data?.prompt }
    );

    // Test 23: Rate limiting is configured on IVR routes
    const { ivrCallLimiter, ivrInputLimiter } = require('../dist/ivr/ivrRoutes');
    record(
      'Rate limiters configured on IVR call start and input endpoints',
      typeof ivrCallLimiter === 'function' && typeof ivrInputLimiter === 'function',
      { ivrCallLimiter: !!ivrCallLimiter, ivrInputLimiter: !!ivrInputLimiter }
    );

    // Test 24: Secret leakage check in all audit logs via Admin API
    const auditCall = await request({
      hostname: 'localhost', port: 5000, path: '/api/ivr/call/start', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${auditCall.body?.data?.sessionId}/input`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { inputType: 'DTMF', value: '1' });
    await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${auditCall.body?.data?.sessionId}/end`, method: 'POST'
    });

    const adminDashRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/admin/dashboard', method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const auditLogs = adminDashRes.body?.data?.recentAuditLogs || [];
    const ivrAuditEvents = auditLogs.filter(a => a.action && a.action.startsWith('IVR_'));
    const auditStr = JSON.stringify(ivrAuditEvents);
    const leakedSecrets = /BEGIN PRIVATE KEY|password_hash|DATABASE_URL/i.test(auditStr);
    record(
      'Zero private keys or sensitive credentials in IVR audit logs',
      !leakedSecrets && ivrAuditEvents.length > 0,
      { ivrEventCount: ivrAuditEvents.length, leakedSecrets }
    );

    // Test 25: Audit events emitted for IVR lifecycle
    const actions = ivrAuditEvents.map(a => a.action);
    const hasCoreAudits = actions.includes('IVR_SESSION_STARTED') &&
                          actions.includes('IVR_OFFICER_CODE_SUBMITTED') &&
                          actions.includes('IVR_SESSION_COMPLETED');
    record(
      'Audit events emitted for IVR lifecycle (STARTED, SUBMITTED, COMPLETED)',
      hasCoreAudits,
      { recordedActions: Array.from(new Set(actions)) }
    );

    console.log('\n--- Category E: Phase 8 Authorization Integration ---');

    // Create session for authorization tests
    const authCall = await request({
      hostname: 'localhost', port: 5000, path: '/api/ivr/call/start', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const sAuth = authCall.body?.data;
    // Advance: Verify officer TG-OFF-001 first
    await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${sAuth.sessionId}/input`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { inputType: 'DTMF', value: '1' });
    await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${sAuth.sessionId}/input`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { inputType: 'DTMF', value: 'TG-OFF-001' });

    // Test 26: Valid action check (REQUEST_DOCUMENT via keypad 4)
    // Press 2 to check action -> enter 4
    await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${sAuth.sessionId}/input`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { inputType: 'DTMF', value: '2' });
    const docActionRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${sAuth.sessionId}/input`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { inputType: 'DTMF', value: '4' });
    record(
      'Valid action check (REQUEST_DOCUMENT) evaluated via Phase 8 policy (ALLOW)',
      docActionRes.body?.data?.authorizationResult === 'ALLOW' && docActionRes.body?.data?.prompt?.includes('permitted under the current TrustGov demonstration policy'),
      docActionRes.body?.data
    );

    // Test 27: Critical prohibited action (REQUEST_UPI_PAYMENT via keypad 1)
    await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${sAuth.sessionId}/input`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { inputType: 'DTMF', value: '2' });
    const upiActionRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${sAuth.sessionId}/input`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { inputType: 'DTMF', value: '1' });
    const upiPrompt = upiActionRes.body?.data?.prompt || '';
    record(
      'Critical prohibited action (REQUEST_UPI_PAYMENT) yields DENY + CRITICAL with money transfer warning',
      upiActionRes.body?.data?.authorizationResult === 'DENY' &&
      upiActionRes.body?.data?.riskLevel === 'CRITICAL' &&
      upiPrompt.includes('Do not provide money'),
      upiActionRes.body?.data
    );

    // Test 28: Review action (REQUEST_PHYSICAL_APPEARANCE)
    await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${sAuth.sessionId}/input`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { inputType: 'DTMF', value: '2' });
    const reviewActionRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${sAuth.sessionId}/input`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { inputType: 'DTMF', value: 'REQUEST_PHYSICAL_APPEARANCE' });
    record(
      'Review action (REQUEST_PHYSICAL_APPEARANCE) yields REVIEW with written notice guidance',
      reviewActionRes.body?.data?.authorizationResult === 'REVIEW' && reviewActionRes.body?.data?.prompt?.includes('requires additional'),
      reviewActionRes.body?.data
    );

    // Test 29: Authorization evaluation reference generated in TG-AUTH-XXXXXXXX format
    const authRef = upiActionRes.body?.data?.authorizationReference;
    const authRefValid = typeof authRef === 'string' && /^TG-AUTH-[A-Z0-9]{8}$/.test(authRef);
    record(
      'Authorization reference generated in safe TG-AUTH-XXXXXXXX format',
      authRefValid,
      { authorizationReference: authRef }
    );

    // Test 30: Backend-authoritative decision (cannot be manipulated by caller payload)
    await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${sAuth.sessionId}/input`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { inputType: 'DTMF', value: '2' });
    const tamperedAuth = await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${sAuth.sessionId}/input`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      inputType: 'DTMF',
      value: 'REQUEST_OTP',
      authorizationResult: 'ALLOW',
      riskLevel: 'LOW'
    });
    record(
      'Backend calculates authoritative result (caller cannot force ALLOW on REQUEST_OTP)',
      tamperedAuth.body?.data?.authorizationResult === 'DENY' && tamperedAuth.body?.data?.riskLevel === 'CRITICAL',
      tamperedAuth.body?.data
    );

    console.log('\n--- Category F: Phase 9 Scam Reporting Integration ---');

    // Test 31: Report creation via IVR (Press 3 -> Press 1 for PAYMENT_DEMAND)
    const reportCall = await request({
      hostname: 'localhost', port: 5000, path: '/api/ivr/call/start', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const sReport = reportCall.body?.data;
    // Press 3 to report
    await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${sReport.sessionId}/input`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { inputType: 'DTMF', value: '3' });

    // Press 1 for PAYMENT_DEMAND
    const reportSubmitRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${sReport.sessionId}/input`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { inputType: 'DTMF', value: '1' });
    record(
      'Report creation via IVR submits to Phase 9 reporting engine',
      reportSubmitRes.status === 200 && reportSubmitRes.body?.data?.state === 'REFERENCE' && reportSubmitRes.body?.data?.reportReference?.startsWith('TG-REPORT-'),
      reportSubmitRes.body?.data
    );

    // Query admin reports API to check the created report in database
    const adminReportsRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/admin/reports', method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const reportsList = adminReportsRes.body?.data?.reports || [];
    const repId = reportSubmitRes.body?.data?.reportReference;
    const repInDb = reportsList.find(r => r.reportId === repId || r.report_id === repId);

    // Test 32: Correct report category mapping
    record(
      'Keypad option 1 correctly maps to PAYMENT_DEMAND category in database',
      repInDb?.reportCategory === 'PAYMENT_DEMAND' || repInDb?.report_category === 'PAYMENT_DEMAND',
      { reportFound: repInDb }
    );

    // Test 33: Report reference format (TG-REPORT-XXXXXXXX)
    const repRefValid = typeof repId === 'string' && /^TG-REPORT-[A-Z0-9]{8}$/.test(repId);
    record(
      'Report reference generated in safe TG-REPORT-XXXXXXXX format',
      repRefValid,
      { reportReference: repId }
    );

    // Test 34: Citizen/session association in Phase 9 report
    record(
      'Report properly attributed with server-managed citizen identity and IVR source description',
      !!(repInDb?.citizenId || repInDb?.citizen_id) && (repInDb?.description || '').includes('IVR voice gateway'),
      { repInDb }
    );

    // Test 35: Unverified interaction reporting (citizen can report without officer lookup)
    const directRepCall = await request({
      hostname: 'localhost', port: 5000, path: '/api/ivr/call/start', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const sDirect = directRepCall.body?.data;
    await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${sDirect.sessionId}/input`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { inputType: 'DTMF', value: '3' });
    const directRepRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${sDirect.sessionId}/input`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { inputType: 'DTMF', value: '3' }); // 3 = IMPERSONATION
    record(
      'Unverified suspicious interaction can be reported immediately (officer verification optional)',
      directRepRes.body?.data?.reportReference?.startsWith('TG-REPORT-'),
      directRepRes.body?.data
    );

    console.log('\n--- Category G: Privacy & Data Minimization ---');

    // Test 36: No caller phone number exposed in API responses
    const allRepResponsesStr = JSON.stringify([startRes.body, validOff.body, docActionRes.body, reportSubmitRes.body]);
    const phoneExposed = /\+91 98765|\+91 99999/i.test(allRepResponsesStr);
    record(
      'Caller phone numbers strictly excluded from public API responses',
      !phoneExposed,
      { phoneExposed }
    );

    // Test 37: Zero citizen PII in public references
    const hasPiiInRef = /citizen|user-id|email/i.test(repId) || /citizen|user-id|email/i.test(vfyRef);
    record(
      'Public verification & report references contain ZERO citizen PII',
      !hasPiiInRef,
      { vfyRef, repId }
    );

    // Test 38: No confidential credential contents read out over phone
    const vfyPromptText = validOff.body?.data?.prompt || '';
    const credentialContentsExposed = /credentialSubject|issuanceDate|proofValue|crypto/i.test(vfyPromptText);
    record(
      'No raw credential JSON, signatures, or cryptographic proofs read over phone',
      !credentialContentsExposed,
      { vfyPromptText }
    );

    // Test 39: Zero internal policy rule trees or policy AST leaked
    const authPromptText = upiActionRes.body?.data?.prompt || '';
    const policyDetailsExposed = /constraints|allowedPaymentTypes|PolicyConstraints|astNode/i.test(authPromptText);
    record(
      'Voice prompts contain neutral guidance without exposing internal policy engine syntax',
      !policyDetailsExposed,
      { authPromptText }
    );

    console.log('\n--- Category H: Lifecycle & Usability ---');

    // Test 40: Complete session happy-path flow
    const e2eCall = await request({
      hostname: 'localhost', port: 5000, path: '/api/ivr/call/start', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { callerId: '+91 91234 56789' });
    const sE2e = e2eCall.body?.data;

    // 1. Menu -> Officer code
    const e2e_1 = await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${sE2e.sessionId}/input`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { inputType: 'DTMF', value: '1' });

    // 2. Enter code TG-OFF-001
    const e2e_2 = await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${sE2e.sessionId}/input`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { inputType: 'DTMF', value: 'TG-OFF-001' });

    // 3. Check action -> 2
    const e2e_3 = await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${sE2e.sessionId}/input`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { inputType: 'DTMF', value: '2' });

    // 4. Action -> 4 (DOCUMENT)
    const e2e_4 = await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${sE2e.sessionId}/input`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { inputType: 'DTMF', value: '4' });

    // 5. End call -> 9
    const e2e_5 = await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${sE2e.sessionId}/input`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { inputType: 'DTMF', value: '9' });

    const e2eSuccess = e2eCall.status === 201 &&
                       e2e_1.body?.data?.state === 'COLLECT_OFFICER_CODE' &&
                       e2e_2.body?.data?.verificationResult === 'VERIFIED' &&
                       e2e_3.body?.data?.state === 'COLLECT_ACTION' &&
                       e2e_4.body?.data?.authorizationResult === 'ALLOW' &&
                       e2e_5.body?.data?.status === 'COMPLETED';

    record(
      'Complete end-to-end happy path flow (Start -> Verify -> Action -> Hangup)',
      e2eSuccess,
      { finalStatus: e2e_5.body?.data?.status }
    );

    // Test 41: Repeat prompt (0) replays current prompt
    const repeatCall = await request({
      hostname: 'localhost', port: 5000, path: '/api/ivr/call/start', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const sRepeat = repeatCall.body?.data;
    const repeatRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${sRepeat.sessionId}/repeat`, method: 'POST'
    });
    record(
      'Repeat endpoint (POST /repeat) replays current prompt accurately',
      repeatRes.status === 200 && repeatRes.body?.data?.prompt?.includes('TrustGov demonstration'),
      repeatRes.body?.data
    );

    // Test 42: Manual call termination via end endpoint
    const endDirectRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${sRepeat.sessionId}/end`, method: 'POST'
    });
    record(
      'Manual call termination (POST /end) marks session COMPLETED',
      endDirectRes.status === 200 && endDirectRes.body?.data?.status === 'COMPLETED' && endDirectRes.body?.data?.prompt?.includes('Goodbye'),
      endDirectRes.body?.data
    );

  } catch (err) {
    console.error('Fatal test execution failure:', err);
  }

  console.log('\n================================================================');
  console.log(`PHASE 10 TEST RESULTS: ${passCount} / ${testCount} PASSED (${Math.round((passCount / testCount) * 100)}%)`);
  console.log('================================================================\n');

  if (passCount === testCount && testCount >= 40) {
    console.log('>>> ALL PHASE 10 TESTS COMPLETED SUCCESSFULLY! <<<\n');
    process.exit(0);
  } else {
    console.error(`>>> PHASE 10 TESTS FAILED (${testCount - passCount} failures) <<<`);
    process.exit(1);
  }
}

runTests();
