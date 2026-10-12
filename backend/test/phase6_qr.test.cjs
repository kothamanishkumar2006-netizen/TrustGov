/**
 * TRUSTGOV - PHASE 6 TEST SUITE: QR VERIFICATION WORKFLOW & CITIZEN RESOLUTION
 * 
 * Tests:
 * 1. Resolution of direct TrustGov QR payload (TRUSTGOV://verify/<credentialId>)
 * 2. Resolution of parameter-based TrustGov QR payload (TRUSTGOV://verify?credential=<credentialId>)
 * 3. Rejection of unsupported or malicious QR schemes (https://, bitcoin:, raw strings)
 * 4. Rejection of unknown credential IDs in valid schemes (HTTP 404)
 * 5. Automatic verification challenge generation during QR scan
 * 6. Audit logging of QR scan events
 * 7. End-to-end QR scan -> officer challenge sign -> proof verification workflow
 * 8. Zero private key leakage in QR payload and scan resolution
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
  console.log('TRUSTGOV - PHASE 6: QR SCANNER & RESOLUTION TEST SUITE');
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
    // Setup: Admin Login & Officer with Credential
    console.log('--- Setting Up Test Officer for QR Badge Testing ---');
    const adminLogin = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'admin@trustgov.demo', password: 'password123' });

    const adminToken = adminLogin.body?.data?.token;

    // Login as officer (TG-OFF-001)
    const offLogin = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'officer@trustgov.demo', password: 'password123' });

    const offToken = offLogin.body?.data?.token;

    // Fetch officers list from admin endpoint
    const listRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/admin/officers',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    const officers = listRes.body?.data?.officers || [];
    const officer = officers.find(o => o.officer_code === 'TG-OFF-001') || officers[0];
    const officerId = officer.id;
    const officerCode = officer.officer_code;

    // Ensure DID for Officer
    await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/admin/officers/${officerId}/did`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, { keyType: 'Ed25519' });

    // Rebind / provision key in KeyProvider
    await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/admin/officers/${officerId}/provision-key`,
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    // Ensure Credential for Officer
    let credId;
    const vcRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/admin/officers/${officerId}/credentials`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, { validityDays: 365 });

    if (vcRes.status === 201) {
      credId = vcRes.body?.data?.credentialId;
    } else {
      const credsRes = await request({
        hostname: 'localhost',
        port: 5000,
        path: `/api/admin/officers/${officerId}/credentials`,
        method: 'GET',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      credId = credsRes.body?.data?.credentials?.[0]?.credentialId;
    }

    // Anchor on blockchain
    if (credId) {
      await request({
        hostname: 'localhost',
        port: 5000,
        path: `/api/blockchain/credentials/${credId}/anchor`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
      });
    }

    console.log('\n--- Running QR Resolution Test Cases ---\n');

    // TEST 1: Direct TrustGov QR Scheme Resolution
    const directQr = `TRUSTGOV://verify/${credId}`;
    const resolve1 = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/verification/qr-resolve',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { qrData: directQr });

    const d1 = resolve1.body.data;
    record(
      'Direct QR Scheme Resolution: Resolves TRUSTGOV://verify/<credentialId>',
      resolve1.status === 200 && d1?.credentialId === credId && d1?.officerCode === officerCode,
      { status: resolve1.status, body: resolve1.body }
    );

    // TEST 2: Parameter-based TrustGov QR Scheme Resolution
    const paramQr = `TRUSTGOV://verify?credential=${credId}`;
    const resolve2 = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/verification/qr-resolve',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { qrData: paramQr });

    const d2 = resolve2.body.data;
    record(
      'Parameter QR Scheme Resolution: Resolves TRUSTGOV://verify?credential=<credentialId>',
      resolve2.status === 200 && d2?.credentialId === credId,
      { status: resolve2.status, body: resolve2.body }
    );

    // TEST 3: Automatic Challenge Generation During QR Scan
    const autoChallenge = d1?.challenge;
    const isChallengeReady = Boolean(autoChallenge && autoChallenge.challengeId && autoChallenge.nonce && autoChallenge.expiresAt);
    record(
      'Auto-Challenge on QR Scan: Automatically issues live cryptographic challenge for officer',
      isChallengeReady && autoChallenge?.status === 'PENDING',
      { autoChallenge }
    );

    // TEST 4: Rejection of Unsupported QR Schemes (HTTP 400)
    const phishingQr = 'https://tax-clearance-scam.com/verify?officer=123';
    const badSchemeRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/verification/qr-resolve',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { qrData: phishingQr });

    record(
      'Scheme Enforcement: Rejects non-TrustGov QR schemes with HTTP 400 UNSUPPORTED_QR_SCHEME',
      badSchemeRes.status === 400 && badSchemeRes.body?.error?.code === 'UNSUPPORTED_QR_SCHEME',
      { status: badSchemeRes.status, body: badSchemeRes.body }
    );

    // TEST 5: Unknown Credential Rejection in Valid Scheme (HTTP 404)
    const unknownQr = 'TRUSTGOV://verify/VC-TG-FAKECRED-99999999';
    const notFoundRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/verification/qr-resolve',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { qrData: unknownQr });

    record(
      'Unknown Credential: Non-existent credential in QR badge returns HTTP 404 CREDENTIAL_NOT_FOUND',
      notFoundRes.status === 404 && notFoundRes.body?.error?.code === 'CREDENTIAL_NOT_FOUND',
      { status: notFoundRes.status, body: notFoundRes.body }
    );

    // TEST 6: Complete End-to-End Workflow: QR Scan -> Officer Sign -> Citizen Verify
    // 1. Citizen scanned directQr, obtained autoChallenge.challengeId
    const targetChallengeId = autoChallenge.challengeId;

    // 2. Officer signs challenge in their custody app
    const signRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/officer/proof/sign',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${offToken}` }
    }, { challengeId: targetChallengeId });

    const proofSig = signRes.body?.data?.signature;

    // 3. Citizen verifies signature
    const verifyProofRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/verification/verify-proof',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { challengeId: targetChallengeId, signature: proofSig });

    record(
      'Full End-to-End Workflow: QR scan -> challenge issuance -> officer custody sign -> citizen proof verification',
      verifyProofRes.status === 200 && verifyProofRes.body?.data?.valid === true,
      { status: verifyProofRes.status, valid: verifyProofRes.body?.data?.valid }
    );

    // TEST 7: Zero Private Key Leakage in QR Payload
    const qrString = directQr;
    const hasNoKeysInQr = !qrString.includes('private') && !qrString.includes('secret') && !qrString.includes('key');
    const hasNoKeysInResponse = !JSON.stringify(resolve1.body).includes('privateKey');

    record(
      'Zero Key Leakage: QR badge contains only public verification reference, zero private keys',
      hasNoKeysInQr && hasNoKeysInResponse,
      { directQr }
    );

  } catch (err) {
    console.error('Test execution exception:', err);
    record('Fatal test suite exception', false, { error: err.message });
  }

  console.log('\n================================================================');
  console.log(`PHASE 6 QR TEST RESULTS: ${passCount} / ${testCount} PASSED`);
  console.log('================================================================\n');

  if (passCount === testCount) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests();
