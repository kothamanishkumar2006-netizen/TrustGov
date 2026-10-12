/**
 * TRUSTGOV - PHASE 6 TEST SUITE: SECURE OFFICER PROOF-OF-POSSESSION & CHALLENGE-RESPONSE
 * 
 * Tests:
 * 1. Challenge generation & CSPRNG randomness (32 bytes / 64 hex chars)
 * 2. 5-minute TTL calculation and timestamp integrity
 * 3. Pending challenge retrieval for authenticated officers
 * 4. KeyProvider Ed25519 cryptographic signing under custody abstraction
 * 5. Multi-tier proof verification (DID, VC, Officer, Ed25519 PoP, Blockchain)
 * 6. Replay attack protection: Immediate HTTP 409 rejection on reused challenge
 * 7. Signature forgery protection: Rejection on tampered signature bits
 * 8. Challenge ownership enforcement: Officer 1 cannot sign Officer 2's challenge
 * 9. Non-existent challenge rejection (HTTP 404)
 * 10. Status cascade: Suspended officer verification failure
 * 11. Zero private key leakage across all API responses
 */

const http = require('http');
const crypto = require('crypto');

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
  console.log('TRUSTGOV - PHASE 6: PROOF-OF-POSSESSION & CHALLENGE-RESPONSE TESTS');
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
    // Step 0: Auth Setup
    console.log('--- Setting Up Test Officers and Cryptographic Keys ---');
    const adminLogin = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'admin@trustgov.demo', password: 'password123' });

    const adminToken = adminLogin.body?.data?.token;

    // Login Officer 1 (TG-OFF-001)
    const off1Login = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'officer@trustgov.demo', password: 'password123' });

    const off1Token = off1Login.body?.data?.token;

    // Login Officer 2 (TG-OFF-002)
    const off2Login = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'officer2@trustgov.demo', password: 'password123' });

    const off2Token = off2Login.body?.data?.token;

    // Fetch officers list from admin endpoint
    const listRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/admin/officers',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    const officers = listRes.body?.data?.officers || [];
    const off1 = officers.find(o => o.officer_code === 'TG-OFF-001') || officers[0];
    const off2 = officers.find(o => o.officer_code === 'TG-OFF-002') || officers[1];

    if (!off1 || !off2) {
      throw new Error('Test officers TG-OFF-001 or TG-OFF-002 not found in system');
    }

    // Ensure DID for Officer 1
    const did1Res = await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/admin/officers/${off1.id}/issue-did`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, { keyType: 'Ed25519' });

    // If DID was already issued, provision signing key
    if (did1Res.status === 409 || did1Res.body?.error?.code === 'DID_ALREADY_EXISTS') {
      await request({
        hostname: 'localhost',
        port: 5000,
        path: `/api/admin/officers/${off1.id}/provision-key`,
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
    }

    // Ensure Verifiable Credential for Officer 1
    let off1CredId;
    const vc1Res = await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/admin/officers/${off1.id}/credentials`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, { validityDays: 365 });

    if (vc1Res.status === 201) {
      off1CredId = vc1Res.body?.data?.credentialId;
    } else {
      // Fetch existing credentials for Officer 1
      const credsRes = await request({
        hostname: 'localhost',
        port: 5000,
        path: `/api/admin/officers/${off1.id}/credentials`,
        method: 'GET',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      off1CredId = credsRes.body?.data?.credentials?.[0]?.credentialId;
    }

    // Anchor Officer 1 Credential on Blockchain
    if (off1CredId) {
      await request({
        hostname: 'localhost',
        port: 5000,
        path: `/api/blockchain/credentials/${off1CredId}/anchor`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
      });
    }

    // Ensure DID for Officer 2
    const did2Res = await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/admin/officers/${off2.id}/issue-did`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, { keyType: 'Ed25519' });

    if (did2Res.status === 409 || did2Res.body?.error?.code === 'DID_ALREADY_EXISTS') {
      await request({
        hostname: 'localhost',
        port: 5000,
        path: `/api/admin/officers/${off2.id}/provision-key`,
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
    }

    // Ensure Credential for Officer 2
    await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/admin/officers/${off2.id}/credentials`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, { validityDays: 365 });

    console.log('\n--- Running Phase 6 Verification Test Cases ---\n');

    // TEST 1: Challenge Generation & CSPRNG Nonce
    const ch1Res = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/verification/challenge',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { officerCode: off1.officer_code });

    const ch1 = ch1Res.body.data;
    const isNonceValid = ch1 && typeof ch1.nonce === 'string' && ch1.nonce.length === 64;
    const isUuid = /^CHG-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ch1?.challengeId);
    record(
      'Challenge Generation: CSPRNG 32-byte nonce (64 hex chars) and CHG-UUID format',
      ch1Res.status === 201 && isNonceValid && isUuid,
      { status: ch1Res.status, body: ch1Res.body }
    );

    // TEST 2: 5-Minute Expiration TTL Check
    const issuedMs = new Date(ch1.issuedAt).getTime();
    const expiresMs = new Date(ch1.expiresAt).getTime();
    const diffMs = expiresMs - issuedMs;
    record(
      'Challenge TTL: Exactly 5 minutes (300,000 ms) window',
      diffMs === 300000 && expiresMs > Date.now(),
      { diffMs, issuedAt: ch1.issuedAt, expiresAt: ch1.expiresAt }
    );

    // TEST 3: Retrieve Pending Challenges for Officer 1
    const pendingRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/officer/proof/pending',
      method: 'GET',
      headers: { Authorization: `Bearer ${off1Token}` }
    });

    const hasChallengeInQueue = pendingRes.body?.data?.challenges?.some(c => c.challengeId === ch1.challengeId);
    record(
      'Pending Challenges Retrieval: Generated challenge exists in officer queue',
      pendingRes.status === 200 && hasChallengeInQueue,
      { status: pendingRes.status, count: pendingRes.body?.data?.challenges?.length }
    );

    // TEST 4: KeyProvider Cryptographic Signing
    const signRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/officer/proof/sign',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${off1Token}` }
    }, { challengeId: ch1.challengeId });

    const signData = signRes.body.data;
    const isSigBase64 = signData && typeof signData.signature === 'string' && signData.signature.length > 40;
    record(
      'Officer Proof Signing: Returns valid Ed25519 signature under key custody abstraction',
      signRes.status === 200 && isSigBase64 && signData.challengeId === ch1.challengeId,
      { status: signRes.status, body: signRes.body }
    );

    // TEST 5: Public Proof Verification (5-Tier Verification PASS)
    const verifyRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/verification/verify-proof',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { challengeId: ch1.challengeId, signature: signData.signature });

    const vData = verifyRes.body.data;
    const allChecksPass = vData?.valid === true &&
      vData?.identity?.verified === true &&
      vData?.credential?.verified === true &&
      vData?.authorization?.verified === true &&
      vData?.proofOfPossession?.verified === true &&
      vData?.blockchain?.verified === true;

    record(
      'Proof-of-Possession 5-Tier Verification: Valid signature passes all integrity checks',
      verifyRes.status === 200 && allChecksPass,
      { status: verifyRes.status, body: verifyRes.body }
    );

    // TEST 6: Replay Attack Protection (HTTP 409)
    const replayRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/verification/verify-proof',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { challengeId: ch1.challengeId, signature: signData.signature });

    record(
      'Replay Attack Protection: Re-submitting verified challenge returns HTTP 409 CHALLENGE_ALREADY_USED',
      replayRes.status === 409 && replayRes.body?.error?.code === 'CHALLENGE_ALREADY_USED',
      { status: replayRes.status, body: replayRes.body }
    );

    // TEST 7: Signature Forgery Protection (Tampered Signature Bits)
    // Generate fresh challenge
    const ch2Res = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/verification/challenge',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { officerCode: off1.officer_code });

    const ch2 = ch2Res.body.data;
    // Sign legitimately first
    const sign2Res = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/officer/proof/sign',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${off1Token}` }
    }, { challengeId: ch2.challengeId });

    // Tamper signature by flipping characters
    const realSig = sign2Res.body.data.signature;
    const tamperedSig = (realSig[0] === '0' ? '1' : '0') + realSig.slice(1);

    const forgedRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/verification/verify-proof',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { challengeId: ch2.challengeId, signature: tamperedSig });

    record(
      'Forgery Detection: Tampered signature bits rejected with HTTP 400 INVALID_SIGNATURE',
      forgedRes.status === 400 && forgedRes.body?.error?.code === 'INVALID_SIGNATURE',
      { status: forgedRes.status, body: forgedRes.body }
    );

    // TEST 8: Challenge Ownership Enforcement (Officer 1 cannot sign Officer 2's challenge)
    const ch3Res = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/verification/challenge',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { officerCode: off2.officer_code });

    const ch3 = ch3Res.body.data;
    const crossSignRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/officer/proof/sign',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${off1Token}` } // Off 1 tries to sign Off 2's challenge
    }, { challengeId: ch3.challengeId });

    record(
      'Challenge Ownership: Unauthorized officer cannot sign another officer’s challenge (HTTP 403)',
      crossSignRes.status === 403 && (crossSignRes.body?.error?.code === 'CHALLENGE_MISMATCH' || crossSignRes.body?.error?.code === 'FORBIDDEN'),
      { status: crossSignRes.status, body: crossSignRes.body }
    );

    // TEST 9: Non-existent Challenge Rejection (HTTP 404)
    const randomUuid = crypto.randomUUID();
    const notFoundRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/verification/verify-proof',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { challengeId: randomUuid, signature: realSig });

    record(
      'Non-existent Challenge: Random UUID returns HTTP 404 CHALLENGE_NOT_FOUND',
      notFoundRes.status === 404 && notFoundRes.body?.error?.code === 'CHALLENGE_NOT_FOUND',
      { status: notFoundRes.status, body: notFoundRes.body }
    );

    // TEST 10: Status Cascade Failure on Suspended Officer
    // Suspend Officer 2
    await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/admin/officers/${off2.id}/status`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, { status: 'SUSPENDED' });

    // Officer 2 attempts to sign a challenge while suspended
    const ch4Res = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/verification/challenge',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { officerCode: off2.officer_code });

    const signSuspendedRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/officer/proof/sign',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${off2Token}` }
    }, { challengeId: ch4Res.body.data.challengeId });

    record(
      'Lifecycle Cascade: Suspended officer signing rejected or marked invalid (HTTP 403)',
      signSuspendedRes.status === 403 && (signSuspendedRes.body?.error?.code === 'OFFICER_NOT_ACTIVE' || signSuspendedRes.body?.error?.code === 'ACCOUNT_SUSPENDED'),
      { status: signSuspendedRes.status, body: signSuspendedRes.body }
    );

    // Restore Officer 2 status to ACTIVE
    await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/admin/officers/${off2.id}/status`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, { status: 'ACTIVE' });

    // TEST 11: Zero Private Key Leakage Audit
    const allResponses = [ch1Res.body, signRes.body, verifyRes.body, pendingRes.body];
    const sensitiveTerms = ['privateKey', 'private_key', 'secretKey', 'privKey', 'seed', 'mnemonic'];
    let leakDetected = false;

    for (const resObj of allResponses) {
      const str = JSON.stringify(resObj);
      for (const term of sensitiveTerms) {
        if (str.includes(`"${term}"`)) {
          leakDetected = true;
          console.error(`LEAK FOUND: Term "${term}" detected in API response!`);
        }
      }
    }

    record(
      'Security Audit: Zero private key or seed material leaked in any API response',
      !leakDetected,
      { leakDetected }
    );

  } catch (err) {
    console.error('Test execution exception:', err);
    record('Fatal test suite exception', false, { error: err.message });
  }

  console.log('\n================================================================');
  console.log(`PHASE 6 TEST RESULTS: ${passCount} / ${testCount} PASSED`);
  console.log('================================================================\n');

  if (passCount === testCount) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests();
