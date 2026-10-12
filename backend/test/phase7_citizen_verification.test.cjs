/**
 * TRUSTGOV - PHASE 7 TEST SUITE: CITIZEN VERIFICATION & TRUST EXPERIENCE
 * 
 * Tests:
 * 1. Citizen verification succeeds for valid officer code
 * 2. Citizen verification succeeds for valid Credential ID
 * 3. Citizen verification succeeds for valid DID
 * 4. Citizen verification succeeds for valid TrustGov QR code
 * 5. Invalid officer code returns FAILED with clear explanation
 * 6. Unknown credential ID returns FAILED
 * 7. Unknown DID returns FAILED
 * 8. Revoked credential returns FAILED
 * 9. Suspended credential returns FAILED
 * 10. Suspended officer returns FAILED
 * 11. Revoked officer returns FAILED
 * 12. Proof-of-possession verification with valid Ed25519 signature
 * 13. Proof-of-possession verification with tampered signature rejected
 * 14. Replay attack rejection (HTTP 409 CHALLENGE_ALREADY_USED)
 * 15. Verification history record created automatically
 * 16. Authenticated citizen can retrieve own verification history
 * 17. Citizen privacy: Citizen A cannot retrieve Citizen B's verification records
 * 18. Public verification reference lookup returns safe non-PII summary
 * 19. Public reference does not expose citizen ID, user ID, tokens, or private keys
 * 20. Public reference is distinctly marked as historical (isHistorical: true)
 * 21. Proactive anti-scam warning triggered on prohibited demands (e.g. OTP/UPI)
 * 22. Zero private keys, seeds, or confidential tokens leaked across all responses
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
  console.log('TRUSTGOV - PHASE 7: CITIZEN VERIFICATION & TRUST EXPERIENCE TESTS');
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
    console.log('--- Setting Up Test Actors & Credentials ---');

    // 1. Admin login
    const adminLogin = await request({
      hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'admin@trustgov.demo', password: 'password123' });
    const adminToken = adminLogin.body?.data?.token;

    // 2. Citizen 1 login
    const citizenLogin = await request({
      hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'citizen@trustgov.demo', password: 'password123' });
    const citizenToken = citizenLogin.body?.data?.token;
    const citizen1Id = citizenLogin.body?.data?.user?.id;

    // 3. Register Citizen 2 for privacy isolation testing
    const citizen2Email = `citizen2_${Date.now()}@trustgov.demo`;
    const citizen2Reg = await request({
      hostname: 'localhost', port: 5000, path: '/api/auth/register', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { name: 'Citizen Two', email: citizen2Email, phone: '+91 99887 76655', password: 'password123', role: 'CITIZEN' });
    const citizen2Token = citizen2Reg.body?.data?.token;
    const citizen2Id = citizen2Reg.body?.data?.user?.id;

    // 4. Officer 1 login (TG-OFF-001)
    const off1Login = await request({
      hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'officer@trustgov.demo', password: 'password123' });
    const off1Token = off1Login.body?.data?.token;

    // Fetch existing credentials of Officer 1
    const off1CredsRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/officer/credentials', method: 'GET',
      headers: { Authorization: `Bearer ${off1Token}` }
    });
    const off1Cred = off1CredsRes.body?.data?.credentials?.[0];
    const off1CredId = off1Cred?.credentialId || 'VC-TG-TG-OFF-001-4D78E09B';
    const off1Did = off1Cred?.officerDid || 'did:trustgov:550e8400-e29b-41d4-a716-446655440001';

    // Provision key if needed
    const listRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/admin/officers', method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const officers = listRes.body?.data?.officers || [];
    const off1 = officers.find(o => o.officer_code === 'TG-OFF-001') || officers[0];
    const offSuspended = officers.find(o => o.officer_code === 'TG-OFF-005') || officers[4];

    await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/officers/${off1.id}/provision-key`, method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    console.log('\n--- Running Phase 7 Verification Tests ---\n');

    // Test 1: Verification succeeds with valid Officer Code
    const verifyByCodeRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/citizen/verify', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenToken}` }
    }, { method: 'OFFICER_CODE', value: 'TG-OFF-001' });

    record('Verification succeeds for valid Officer Code',
      verifyByCodeRes.status === 200 &&
      verifyByCodeRes.body?.data?.result === 'VERIFIED' &&
      verifyByCodeRes.body?.data?.officer?.officerCode === 'TG-OFF-001' &&
      verifyByCodeRes.body?.data?.verificationId?.startsWith('TG-VFY-'),
      { status: verifyByCodeRes.status, body: verifyByCodeRes.body }
    );
    const validVerificationId = verifyByCodeRes.body?.data?.verificationId;

    // Test 2: Verification succeeds with valid Credential ID
    const verifyByCredIdRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/citizen/verify', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenToken}` }
    }, { method: 'CREDENTIAL_ID', value: off1CredId });

    record('Verification succeeds for valid Credential ID',
      verifyByCredIdRes.status === 200 &&
      verifyByCredIdRes.body?.data?.result === 'VERIFIED' &&
      verifyByCredIdRes.body?.data?.checks?.credential?.status === 'VERIFIED',
      { status: verifyByCredIdRes.status, body: verifyByCredIdRes.body }
    );

    // Test 3: Verification succeeds with valid DID
    const verifyByDidRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/citizen/verify', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenToken}` }
    }, { method: 'DID', value: off1Did });

    record('Verification succeeds for valid DID',
      verifyByDidRes.status === 200 &&
      verifyByDidRes.body?.data?.result === 'VERIFIED' &&
      verifyByDidRes.body?.data?.checks?.identity?.status === 'VERIFIED',
      { status: verifyByDidRes.status, body: verifyByDidRes.body }
    );

    // Test 4: Verification succeeds with valid TrustGov QR URI
    const qrData = `TRUSTGOV://verify/${off1CredId}`;
    const verifyByQrRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/citizen/verify', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenToken}` }
    }, { method: 'QR', value: qrData });

    record('Verification succeeds for valid TrustGov QR code scheme',
      verifyByQrRes.status === 200 &&
      verifyByQrRes.body?.data?.result === 'VERIFIED' &&
      verifyByQrRes.body?.data?.method === 'QR',
      { status: verifyByQrRes.status, body: verifyByQrRes.body }
    );

    // Test 5: Invalid officer code returns FAILED with clear reason
    const invalidCodeRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/citizen/verify', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenToken}` }
    }, { method: 'OFFICER_CODE', value: 'TG-FAKE-000' });

    record('Invalid officer code returns FAILED (HTTP 404)',
      invalidCodeRes.status === 404 &&
      invalidCodeRes.body?.data?.result === 'FAILED' &&
      invalidCodeRes.body?.error?.code === 'OFFICER_NOT_FOUND',
      { status: invalidCodeRes.status, body: invalidCodeRes.body }
    );

    // Test 6: Unknown credential ID returns FAILED
    const unknownCredRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/citizen/verify', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenToken}` }
    }, { method: 'CREDENTIAL_ID', value: 'VC-TG-DOESNOTEXIST-9999' });

    record('Unknown credential ID returns FAILED (HTTP 404)',
      unknownCredRes.status === 404 &&
      unknownCredRes.body?.data?.result === 'FAILED',
      { status: unknownCredRes.status, body: unknownCredRes.body }
    );

    // Test 7: Unknown DID returns FAILED
    const unknownDidRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/citizen/verify', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenToken}` }
    }, { method: 'DID', value: 'did:trustgov:00000000-0000-0000-0000-000000000000' });

    record('Unknown DID returns FAILED (HTTP 404)',
      unknownDidRes.status === 404 &&
      unknownDidRes.body?.data?.result === 'FAILED',
      { status: unknownDidRes.status, body: unknownDidRes.body }
    );

    // Test 8: Create officer and revoke credential -> Verification returns FAILED
    const tempOffRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/admin/officers', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, {
      full_name: 'Test Revoked Officer',
      officer_code: `TG-REV-${Date.now().toString().slice(-4)}`,
      department: 'Central Investigation Bureau',
      designation: 'Inspector',
      jurisdiction: 'New Delhi',
      official_email: `rev_${Date.now()}@trustgov.demo`,
      official_phone: '+91 99999 88888',
      status: 'ACTIVE'
    });
    const tempOff = tempOffRes.body?.data?.officer;

    await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/officers/${tempOff.id}/did`, method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, { keyType: 'Ed25519' });

    const tempVcRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/officers/${tempOff.id}/credentials`, method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, { validityDays: 30 });
    const tempVcId = tempVcRes.body?.data?.credentialId;

    // Revoke the credential
    await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/credentials/${tempVcId}/status`, method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, { status: 'REVOKED', reason: 'Disciplinary revocation' });

    const verifyRevokedRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/citizen/verify', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenToken}` }
    }, { method: 'CREDENTIAL_ID', value: tempVcId });

    record('Revoked credential returns FAILED result',
      verifyRevokedRes.status === 200 &&
      verifyRevokedRes.body?.data?.result === 'FAILED' &&
      verifyRevokedRes.body?.data?.checks?.credential?.status === 'FAILED',
      { status: verifyRevokedRes.status, body: verifyRevokedRes.body }
    );

    // Test 9: Suspended credential returns FAILED
    const tempOff2Res = await request({
      hostname: 'localhost', port: 5000, path: '/api/admin/officers', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, {
      full_name: 'Test Suspended Cred Officer',
      officer_code: `TG-SUSC-${Date.now().toString().slice(-4)}`,
      department: 'Enforcement Directorate',
      designation: 'Assistant Director',
      jurisdiction: 'Mumbai',
      official_email: `susc_${Date.now()}@trustgov.demo`,
      official_phone: '+91 99999 77777',
      status: 'ACTIVE'
    });
    const tempOff2 = tempOff2Res.body?.data?.officer;

    await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/officers/${tempOff2.id}/did`, method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, { keyType: 'Ed25519' });

    const tempVc2Res = await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/officers/${tempOff2.id}/credentials`, method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, { validityDays: 30 });
    const tempVc2Id = tempVc2Res.body?.data?.credentialId;

    // Suspend credential
    await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/credentials/${tempVc2Id}/status`, method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, { status: 'SUSPENDED', reason: 'Audit suspension' });

    const verifySuspendedCredRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/citizen/verify', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenToken}` }
    }, { method: 'CREDENTIAL_ID', value: tempVc2Id });

    record('Suspended credential returns FAILED result',
      verifySuspendedCredRes.status === 200 &&
      verifySuspendedCredRes.body?.data?.result === 'FAILED',
      { status: verifySuspendedCredRes.status, body: verifySuspendedCredRes.body }
    );

    // Test 10: Suspended officer returns FAILED
    const verifySuspendedOffRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/citizen/verify', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenToken}` }
    }, { method: 'OFFICER_CODE', value: offSuspended.officer_code });

    record('Suspended officer returns FAILED result',
      verifySuspendedOffRes.status === 200 &&
      verifySuspendedOffRes.body?.data?.result === 'FAILED' &&
      verifySuspendedOffRes.body?.data?.checks?.officerStatus?.active === false,
      { status: verifySuspendedOffRes.status, body: verifySuspendedOffRes.body }
    );

    // Test 11: Revoked officer returns FAILED
    await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/officers/${tempOff.id}/status`, method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, { status: 'REVOKED', reason: 'Permanent termination' });

    const verifyRevokedOffRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/citizen/verify', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenToken}` }
    }, { method: 'OFFICER_CODE', value: tempOff.officer_code });

    record('Revoked officer returns FAILED result',
      verifyRevokedOffRes.status === 200 &&
      verifyRevokedOffRes.body?.data?.result === 'FAILED',
      { status: verifyRevokedOffRes.status, body: verifyRevokedOffRes.body }
    );

    // Test 12: Proof-of-Possession with valid signature
    // Issue challenge
    const chgRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/verification/challenge', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { officerCode: 'TG-OFF-001' });
    const chgId = chgRes.body?.data?.challengeId;

    // Sign challenge as Officer 1
    const signRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/officer/proof/sign', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${off1Token}` }
    }, { challengeId: chgId });
    const signature = signRes.body?.data?.signature;

    // Verify proof through unified citizen endpoint
    const verifyPopRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/citizen/verify', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenToken}` }
    }, {
      method: 'OFFICER_CODE',
      value: 'TG-OFF-001',
      challengeId: chgId,
      signature
    });

    record('Proof-of-possession verification with valid Ed25519 signature',
      verifyPopRes.status === 200 &&
      verifyPopRes.body?.data?.result === 'VERIFIED' &&
      verifyPopRes.body?.data?.checks?.proofOfPossession?.status === 'VERIFIED',
      { status: verifyPopRes.status, body: verifyPopRes.body }
    );

    // Test 13: Proof-of-possession with tampered signature rejected
    const chg2Res = await request({
      hostname: 'localhost', port: 5000, path: '/api/verification/challenge', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { officerCode: 'TG-OFF-001' });
    const chg2Id = chg2Res.body?.data?.challengeId;

    const verifyTamperedPopRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/citizen/verify', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenToken}` }
    }, {
      method: 'OFFICER_CODE',
      value: 'TG-OFF-001',
      challengeId: chg2Id,
      signature: 'deadbeef'.repeat(16) // fake signature
    });

    record('Proof-of-possession verification with tampered signature rejected',
      verifyTamperedPopRes.status === 200 &&
      verifyTamperedPopRes.body?.data?.result === 'FAILED' &&
      verifyTamperedPopRes.body?.data?.checks?.proofOfPossession?.status === 'FAILED',
      { status: verifyTamperedPopRes.status, body: verifyTamperedPopRes.body }
    );

    // Test 14: Replay attack rejection (reusing consumed challenge returns 409)
    const replayPopRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/verification/verify-proof', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { challengeId: chgId, signature });

    record('Replay attack protection: Re-submitting consumed challenge returns 409',
      replayPopRes.status === 409 &&
      replayPopRes.body?.error?.code === 'CHALLENGE_ALREADY_USED',
      { status: replayPopRes.status, body: replayPopRes.body }
    );

    // Test 15: Verification history created automatically
    const historyRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/citizen/verifications', method: 'GET',
      headers: { Authorization: `Bearer ${citizenToken}` }
    });
    const historyList = historyRes.body?.data?.history || [];

    record('Verification history records created automatically for authenticated citizen',
      historyRes.status === 200 &&
      Array.isArray(historyList) &&
      historyList.length >= 3 &&
      historyList.some(h => h.result === 'VERIFIED') &&
      historyList.some(h => h.result === 'FAILED'),
      { count: historyList.length }
    );

    // Test 16: Authenticated citizen can retrieve single verification record
    const firstHist = historyList[0];
    const singleHistRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/citizen/verifications/${firstHist.id}`, method: 'GET',
      headers: { Authorization: `Bearer ${citizenToken}` }
    });

    record('Citizen can retrieve own verification details by ID',
      singleHistRes.status === 200 &&
      singleHistRes.body?.data?.verificationId === firstHist.verificationId,
      { status: singleHistRes.status, body: singleHistRes.body }
    );

    // Test 17: Privacy Enforcement: Citizen A cannot view Citizen B's verification history
    const citizen2AccessRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/citizen/verifications/${firstHist.id}`, method: 'GET',
      headers: { Authorization: `Bearer ${citizen2Token}` }
    });

    record('Privacy Isolation: Citizen 2 cannot access Citizen 1’s verification record (HTTP 404)',
      citizen2AccessRes.status === 404 &&
      citizen2AccessRes.body?.error?.code === 'RECORD_NOT_FOUND',
      { status: citizen2AccessRes.status, body: citizen2AccessRes.body }
    );

    // Test 18: Public verification reference lookup returns safe non-PII summary
    const pubLookupRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/verification/public/${validVerificationId}`, method: 'GET'
    });

    record('Public verification reference lookup succeeds (GET /api/verification/public/:ref)',
      pubLookupRes.status === 200 &&
      pubLookupRes.body?.data?.verificationId === validVerificationId &&
      pubLookupRes.body?.data?.result === 'VERIFIED',
      { status: pubLookupRes.status, body: pubLookupRes.body }
    );

    // Test 19: Public reference does NOT expose citizen ID, user ID, tokens, or private keys
    const pubData = pubLookupRes.body?.data || {};
    const hasCitizenId = 'citizen_id' in pubData || 'citizenId' in pubData || 'userId' in pubData;
    const hasToken = 'token' in pubData || 'token' in pubLookupRes.body;
    const hasPrivKey = JSON.stringify(pubLookupRes.body).toLowerCase().includes('private');

    record('Privacy Guarantee: Public reference contains ZERO citizen PII or credentials',
      !hasCitizenId && !hasToken && !hasPrivKey,
      { hasCitizenId, hasToken, hasPrivKey }
    );

    // Test 20: Public reference is distinctly marked as historical
    record('Public reference is distinctly marked as historical with disclaimer',
      pubData.isHistorical === true &&
      typeof pubData.disclaimer === 'string' &&
      pubData.disclaimer.includes('historical'),
      { isHistorical: pubData.isHistorical, disclaimer: pubData.disclaimer }
    );

    // Test 21: Proactive anti-scam warning triggered on prohibited demand
    const scamDemandRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/citizen/verify', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenToken}` }
    }, {
      method: 'OFFICER_CODE',
      value: 'TG-OFF-001',
      claimedAction: 'PERSONAL_UPI_PAYMENT'
    });

    record('Anti-Scam Guardrail: Prohibited demands trigger critical scam warning',
      scamDemandRes.status === 200 &&
      scamDemandRes.body?.data?.safety?.isProhibitedDemand === true &&
      scamDemandRes.body?.data?.safety?.warning?.includes('CRITICAL SCAM WARNING'),
      { safety: scamDemandRes.body?.data?.safety }
    );

    // Test 22: Security scan: Zero private key or seed material in any Phase 7 response
    const allResponsesStr = JSON.stringify([
      verifyByCodeRes.body,
      historyRes.body,
      singleHistRes.body,
      pubLookupRes.body,
      scamDemandRes.body
    ]);

    const leaksPrivateKey = allResponsesStr.includes('privateKey') ||
                            allResponsesStr.includes('private_key') ||
                            allResponsesStr.includes('seedPhrase') ||
                            allResponsesStr.includes('-----BEGIN');

    record('Security Audit: Zero private keys, seeds, or PEM blocks in any API response',
      !leaksPrivateKey,
      { leaksPrivateKey }
    );

    console.log('\n================================================================');
    console.log(`PHASE 7 TEST RESULTS: ${passCount} / ${testCount} PASSED (${Math.round(passCount / testCount * 100)}%)`);
    console.log('================================================================\n');

    if (passCount === testCount) {
      console.log('>>> ALL 22 PHASE 7 TESTS COMPLETED SUCCESSFULLY! <<<\n');
      process.exit(0);
    } else {
      console.log(`>>> ${testCount - passCount} TESTS FAILED! <<<\n`);
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution exception:', err);
    process.exit(1);
  }
}

runTests();
