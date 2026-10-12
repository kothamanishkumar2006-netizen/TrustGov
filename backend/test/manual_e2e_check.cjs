const http = require('http');

function req(options, data = null) {
  return new Promise((resolve, reject) => {
    const r = http.request(options, (res) => {
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
    r.on('error', reject);
    if (data) {
      r.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    r.end();
  });
}

async function testAll() {
  console.log('====================================================');
  console.log('  TRUSTGOV FULL END-TO-END FLOW VALIDATION SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(name, condition, details = '') {
    if (condition) {
      passed++;
      console.log(`  [PASS] ${name}`);
    } else {
      failed++;
      console.error(`  [FAIL] ${name} -> ${details}`);
    }
  }

  // 1. Auth Login tests
  console.log('--- 1. AUTHENTICATION ---');
  const adminRes = await req({
    hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'admin@trustgov.demo', password: 'password123' });
  const adminToken = adminRes.body?.data?.token;
  assert('Admin login succeeds', adminRes.status === 200 && !!adminToken, JSON.stringify(adminRes.body));

  const officerRes = await req({
    hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'officer@trustgov.demo', password: 'password123' });
  const officerToken = officerRes.body?.data?.token;
  assert('Officer login succeeds', officerRes.status === 200 && !!officerToken, JSON.stringify(officerRes.body));

  const citizenRes = await req({
    hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'citizen@trustgov.demo', password: 'password123' });
  const citizenToken = citizenRes.body?.data?.token;
  assert('Citizen login succeeds', citizenRes.status === 200 && !!citizenToken, JSON.stringify(citizenRes.body));

  // 2. Admin endpoints
  console.log('\n--- 2. ADMIN ENDPOINTS ---');
  const dashRes = await req({
    hostname: 'localhost', port: 5000, path: '/api/admin/dashboard', method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert('Admin dashboard metrics', dashRes.status === 200 && dashRes.body?.success, JSON.stringify(dashRes.body));

  const secRes = await req({
    hostname: 'localhost', port: 5000, path: '/api/admin/security-metrics', method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert('Admin security metrics', secRes.status === 200 && secRes.body?.success, JSON.stringify(secRes.body));

  const officersRes = await req({
    hostname: 'localhost', port: 5000, path: '/api/admin/officers', method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert('Admin list officers', officersRes.status === 200 && officersRes.body?.success, JSON.stringify(officersRes.body));
  const officers = officersRes.body?.data?.officers || [];
  const primaryOfficer = officers.find(o => o.officer_code === 'TG-OFF-001') || officers[0];

  const policiesRes = await req({
    hostname: 'localhost', port: 5000, path: '/api/admin/authorization-policies', method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert('Admin list authorization policies', policiesRes.status === 200 && policiesRes.body?.success, JSON.stringify(policiesRes.body));

  const actionsRes = await req({
    hostname: 'localhost', port: 5000, path: '/api/admin/authorization-actions', method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert('Admin list authorization actions catalog', actionsRes.status === 200 && actionsRes.body?.success, JSON.stringify(actionsRes.body));

  const reasonsRes = await req({
    hostname: 'localhost', port: 5000, path: '/api/admin/authorization-reason-codes', method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert('Admin list reason codes catalog', reasonsRes.status === 200 && reasonsRes.body?.success, JSON.stringify(reasonsRes.body));

  const adminReportsRes = await req({
    hostname: 'localhost', port: 5000, path: '/api/admin/reports', method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert('Admin list scam reports', adminReportsRes.status === 200 && adminReportsRes.body?.success, JSON.stringify(adminReportsRes.body));

  // 3. Officer Portal endpoints
  console.log('\n--- 3. OFFICER PORTAL ENDPOINTS ---');
  const officerCredsRes = await req({
    hostname: 'localhost', port: 5000, path: '/api/officer/credentials', method: 'GET',
    headers: { Authorization: `Bearer ${officerToken}` }
  });
  assert('Officer fetch own credentials', officerCredsRes.status === 200 && officerCredsRes.body?.success, JSON.stringify(officerCredsRes.body));
  const creds = officerCredsRes.body?.data?.credentials || [];
  const activeCred = creds.find(c => c.status === 'ACTIVE') || creds[0];

  const officerPendingRes = await req({
    hostname: 'localhost', port: 5000, path: '/api/officer/proof/pending', method: 'GET',
    headers: { Authorization: `Bearer ${officerToken}` }
  });
  assert('Officer fetch pending challenges', officerPendingRes.status === 200 && officerPendingRes.body?.success, JSON.stringify(officerPendingRes.body));

  const officerScopeRes = await req({
    hostname: 'localhost', port: 5000, path: '/api/officer/authorization/scope', method: 'GET',
    headers: { Authorization: `Bearer ${officerToken}` }
  });
  assert('Officer fetch authorization scope', officerScopeRes.status === 200 && officerScopeRes.body?.success, JSON.stringify(officerScopeRes.body));

  // 4. Blockchain endpoints (both canonical & frontend alias formats)
  console.log('\n--- 4. BLOCKCHAIN REGISTRY ENDPOINTS ---');
  if (activeCred) {
    const credId = activeCred.credentialId;

    // First anchor the credential via Admin
    const anchorRes = await req({
      hostname: 'localhost', port: 5000, path: `/api/admin/credentials/${credId}/blockchain-anchor`, method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, {});
    assert('Admin anchor credential to blockchain registry', anchorRes.status === 201 || (anchorRes.status === 409 && anchorRes.body?.error?.code === 'CREDENTIAL_ALREADY_ANCHORED'), JSON.stringify(anchorRes.body));

    // Backend canonical
    const bcCanonicalVerify = await req({
      hostname: 'localhost', port: 5000, path: `/api/blockchain/${credId}/verify`, method: 'GET'
    });
    assert('Blockchain canonical verify endpoint GET /api/blockchain/:id/verify', bcCanonicalVerify.status === 200, JSON.stringify(bcCanonicalVerify.body));

    const bcCanonicalRecord = await req({
      hostname: 'localhost', port: 5000, path: `/api/blockchain/${credId}/record`, method: 'GET'
    });
    assert('Blockchain canonical record endpoint GET /api/blockchain/:id/record', bcCanonicalRecord.status === 200, JSON.stringify(bcCanonicalRecord.body));

    // Frontend alias formats
    const bcFrontendVerify = await req({
      hostname: 'localhost', port: 5000, path: `/api/blockchain/credentials/${credId}/verify`, method: 'GET'
    });
    assert('Frontend alias GET /api/blockchain/credentials/:id/verify', bcFrontendVerify.status === 200, JSON.stringify(bcFrontendVerify.body));

    const bcFrontendRecord = await req({
      hostname: 'localhost', port: 5000, path: `/api/blockchain/credentials/${credId}`, method: 'GET'
    });
    assert('Frontend alias GET /api/blockchain/credentials/:id', bcFrontendRecord.status === 200, JSON.stringify(bcFrontendRecord.body));
  }

  // 5. Citizen Verification & Trust flows
  console.log('\n--- 5. CITIZEN VERIFICATION FLOWS ---');
  // 5a. Verify by Officer Code
  const vfyCodeRes = await req({
    hostname: 'localhost', port: 5000, path: '/api/citizen/verify', method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenToken}` }
  }, { method: 'OFFICER_CODE', value: 'TG-OFF-001' });
  assert('Citizen verify by Officer Code (TG-OFF-001)', vfyCodeRes.status === 200 && vfyCodeRes.body?.data?.result === 'VERIFIED', JSON.stringify(vfyCodeRes.body));

  // 5b. Verify with Prohibited Action (OTP)
  const vfyOtpRes = await req({
    hostname: 'localhost', port: 5000, path: '/api/citizen/verify', method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenToken}` }
  }, { method: 'OFFICER_CODE', value: 'TG-OFF-001', claimedAction: 'OTP_REQUEST' });
  const scamAlert = vfyOtpRes.body?.data?.safety?.isProhibitedDemand;
  assert('Anti-scam alert triggered when claimedAction is OTP_REQUEST', scamAlert === true, JSON.stringify(vfyOtpRes.body?.data?.safety));

  // 5c. Live Proof-of-Possession Challenge & Signature
  console.log('\n--- 6. PROOF OF POSSESSION (CHALLENGE / RESPONSE) ---');
  const chgRes = await req({
    hostname: 'localhost', port: 5000, path: '/api/verification/challenge', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { officerCode: 'TG-OFF-001' });
  assert('Create cryptographic challenge for TG-OFF-001', chgRes.status === 201 && chgRes.body?.data?.challengeId, JSON.stringify(chgRes.body));
  const challengeId = chgRes.body?.data?.challengeId;

  if (challengeId) {
    // Officer signs the challenge
    const signRes = await req({
      hostname: 'localhost', port: 5000, path: '/api/officer/proof/sign', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${officerToken}` }
    }, { challengeId });
    assert('Officer signs challenge with custody key', signRes.status === 200 && signRes.body?.data?.signature, JSON.stringify(signRes.body));
    const signature = signRes.body?.data?.signature;

    if (signature) {
      // Citizen submits proof
      const verifyProofRes = await req({
        hostname: 'localhost', port: 5000, path: '/api/verification/verify-proof', method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenToken}` }
      }, { challengeId, signature });
      assert('Citizen verifies live cryptographic proof of possession', verifyProofRes.status === 200 && verifyProofRes.body?.data?.valid === true, JSON.stringify(verifyProofRes.body));
    }
  }

  // 7. Phase 8 Authorization & Risk Evaluation
  console.log('\n--- 7. AUTHORIZATION & RISK EVALUATION ---');
  // Safe document request
  const evalDocRes = await req({
    hostname: 'localhost', port: 5000, path: '/api/citizen/authorization/evaluate', method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenToken}` }
  }, {
    officerReference: 'TG-OFF-001',
    actionCode: 'REQUEST_DOCUMENT',
    requestContext: { communicationChannel: 'OFFICIAL_PORTAL', urgency: 'ROUTINE' }
  });
  assert('Evaluate safe action (REQUEST_DOCUMENT -> ALLOW)', evalDocRes.status === 200 && evalDocRes.body?.data?.decision === 'ALLOW', JSON.stringify(evalDocRes.body));

  // Critical prohibited action
  const evalUpiRes = await req({
    hostname: 'localhost', port: 5000, path: '/api/citizen/authorization/evaluate', method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenToken}` }
  }, {
    officerReference: 'TG-OFF-001',
    actionCode: 'REQUEST_UPI_PAYMENT',
    requestContext: { communicationChannel: 'PHONE', urgency: 'IMMEDIATE' }
  });
  assert('Evaluate critical action (REQUEST_UPI_PAYMENT -> DENY & CRITICAL)', evalUpiRes.status === 200 && evalUpiRes.body?.data?.decision === 'DENY' && evalUpiRes.body?.data?.riskLevel === 'CRITICAL', JSON.stringify(evalUpiRes.body));

  // 8. Phase 9 Scam Reporting & Evidence
  console.log('\n--- 8. SCAM REPORTING & EVIDENCE ---');
  const createReportRes = await req({
    hostname: 'localhost', port: 5000, path: '/api/citizen/reports', method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenToken}` }
  }, {
    reportCategory: 'PAYMENT_DEMAND',
    description: 'Suspicious caller demanded immediate UPI payment for fine clearance.',
    officerReference: 'TG-OFF-001'
  });
  assert('Citizen submits scam report', createReportRes.status === 201 && createReportRes.body?.data?.report?.reportId, JSON.stringify(createReportRes.body));
  const createdReportId = createReportRes.body?.data?.report?.reportId;

  if (createdReportId) {
    // Add evidence
    const addEvRes = await req({
      hostname: 'localhost', port: 5000, path: `/api/citizen/reports/${createdReportId}/evidence`, method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenToken}` }
    }, {
      evidenceType: 'SCREENSHOT',
      originalFilename: 'screenshot.png',
      mimeType: 'image/png',
      contentBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    });
    assert('Citizen attaches evidence file', addEvRes.status === 201 && addEvRes.body?.data?.evidence?.id, JSON.stringify(addEvRes.body));
    const evidenceId = addEvRes.body?.data?.evidence?.id;

    if (evidenceId) {
      // Check integrity
      const intRes = await req({
        hostname: 'localhost', port: 5000, path: `/api/citizen/reports/${createdReportId}/evidence/${evidenceId}/integrity`, method: 'GET',
        headers: { Authorization: `Bearer ${citizenToken}` }
      });
      assert('Citizen checks evidence integrity', intRes.status === 200 && intRes.body?.data?.integrity === 'VALID', JSON.stringify(intRes.body));
    }
  }

  // 9. Phase 10 IVR Simulator
  console.log('\n--- 9. IVR SIMULATOR ---');
  const ivrStart = await req({
    hostname: 'localhost', port: 5000, path: '/api/ivr/call/start', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { callerPhone: '+919876543210', language: 'en-IN' });
  assert('Start IVR call session', ivrStart.status === 201 && ivrStart.body?.data?.sessionId, JSON.stringify(ivrStart.body));
  const ivrSessionId = ivrStart.body?.data?.sessionId;

  if (ivrSessionId) {
    // Keypad 1 (Verify officer)
    const ivrInput1 = await req({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${ivrSessionId}/input`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { digits: '1' });
    assert('IVR keypad digit 1 (Verify Officer menu)', ivrInput1.status === 200 && ivrInput1.body?.data?.state === 'COLLECT_OFFICER_CODE', JSON.stringify(ivrInput1.body));

    // Submit officer code
    const ivrCode = await req({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${ivrSessionId}/input`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { digits: 'TG-OFF-001' });
    assert('IVR submits officer code (TG-OFF-001)', ivrCode.status === 200 && ivrCode.body?.data?.verificationResult === 'VERIFIED', JSON.stringify(ivrCode.body));

    // Repeat prompt
    const ivrRepeat = await req({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${ivrSessionId}/repeat`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {});
    assert('IVR repeats current prompt', ivrRepeat.status === 200 && ivrRepeat.body?.success, JSON.stringify(ivrRepeat.body));

    // End call
    const ivrEnd = await req({
      hostname: 'localhost', port: 5000, path: `/api/ivr/session/${ivrSessionId}/end`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {});
    assert('IVR terminates call session cleanly', ivrEnd.status === 200 && ivrEnd.body?.data?.status === 'COMPLETED', JSON.stringify(ivrEnd.body));
  }

  // Summary
  console.log('\n====================================================');
  console.log(`  VALIDATION SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');
}

testAll().catch(console.error);
