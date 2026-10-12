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

// Base58btc decoder helper for Ed25519 multibase key verification
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58Decode(str) {
  if (str.length === 0) return Buffer.alloc(0);
  const bytes = [0];
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    const val = BASE58_ALPHABET.indexOf(c);
    if (val === -1) throw new Error(`Invalid Base58 character: ${c}`);
    for (let j = 0; j < bytes.length; j++) bytes[j] *= 58;
    bytes[0] += val;
    let carry = 0;
    for (let j = 0; j < bytes.length; j++) {
      bytes[j] += carry;
      carry = bytes[j] >> 8;
      bytes[j] &= 0xff;
    }
    while (carry) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (let i = 0; str[i] === BASE58_ALPHABET[0] && i < str.length - 1; i++) bytes.push(0);
  return Buffer.from(bytes.reverse());
}

function importMultibaseKey(multibaseStr) {
  const decoded = base58Decode(multibaseStr.slice(1));
  const rawKey = (decoded[0] === 0xed && decoded[1] === 0x01) ? decoded.subarray(2) : decoded;
  const spkiHeader = Buffer.from('302a300506032b6570032100', 'hex');
  const fullDer = Buffer.concat([spkiHeader, rawKey]);
  return crypto.createPublicKey({ key: fullDer, format: 'der', type: 'spki' });
}

function canonicalize(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalize).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalize(obj[k])).join(',') + '}';
}

async function runTests() {
  console.log('================================================================');
  console.log('TRUSTGOV - PHASE 4: VERIFIABLE CREDENTIALS (VC) TEST SUITE');
  console.log('================================================================\n');

  const results = [];
  let testCount = 0;
  let passCount = 0;

  function record(name, pass, details = {}) {
    testCount++;
    if (pass) passCount++;
    results.push({ testId: testCount, name, pass, ...details });
    console.log(`[${pass ? 'PASS' : 'FAIL'}] TEST ${testCount}: ${name}`);
    if (!pass && details.error) console.error('   Error Details:', details.error);
    if (details.info) console.log('   Info:', details.info);
  }

  try {
    // 0. Setup authentication tokens
    const adminLogin = await request({
      hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'admin@trustgov.demo', password: 'password123' });
    const adminToken = adminLogin.body?.data?.token;

    const officerLogin = await request({
      hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'officer@trustgov.demo', password: 'password123' });
    const officerToken = officerLogin.body?.data?.token;

    const citizenLogin = await request({
      hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'citizen@trustgov.demo', password: 'password123' });
    const citizenToken = citizenLogin.body?.data?.token;

    record('Authentication setup for Admin, Officer, and Citizen', !!(adminToken && officerToken && citizenToken), {
      info: 'Admin, Officer, and Citizen tokens acquired'
    });

    // Create a fresh officer for Phase 4 testing
    const testOfficerCode = `TG-P4-${Date.now().toString().slice(-4)}`;
    const testOfficerEmail = `p4.officer.${Date.now()}@cib.gov.in`;
    const createOfficerRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/admin/officers', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, {
      full_name: 'Inspector Vikram Rathore',
      officer_code: testOfficerCode,
      department: 'Central Investigation Bureau',
      designation: 'Chief Investigating Officer',
      jurisdiction: 'Special Cyber Crime Cell',
      official_email: testOfficerEmail,
      official_phone: '+91 98888 12345',
      status: 'ACTIVE'
    });
    const testOfficerId = createOfficerRes.body?.data?.officer?.id;

    record('Create fresh officer for Phase 4 testing', createOfficerRes.status === 201 && !!testOfficerId, {
      info: `Officer ID: ${testOfficerId}, Code: ${testOfficerCode}`
    });

    // Test 3: Prerequisite check: Cannot issue VC without an issued DID
    const noDidIssueRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/officers/${testOfficerId}/credentials`, method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, { validityDays: 365 });

    record('Reject VC issuance if officer has no issued DID (OFFICER_DID_REQUIRED)',
      noDidIssueRes.status === 400 && noDidIssueRes.body?.error?.code === 'OFFICER_DID_REQUIRED', {
        info: `Status: ${noDidIssueRes.status}, Error Code: ${noDidIssueRes.body?.error?.code}`
      }
    );

    // Now issue a DID for this officer
    const issueDidRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/officers/${testOfficerId}/did`, method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, {});
    const officerDid = issueDidRes.body?.data?.did;
    const officerPubKey = issueDidRes.body?.data?.publicKey;

    record('Issue DID to test officer as prerequisite', issueDidRes.status === 201 && !!officerDid, {
      info: `DID: ${officerDid}`
    });

    // Test 5: Issue Verifiable Credential to active officer with DID
    const issueVcRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/officers/${testOfficerId}/credentials`, method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, { validityDays: 365 });

    const issuedVc = issueVcRes.body?.data?.credential;
    const credentialId = issueVcRes.body?.data?.credentialId;

    record('Successfully issue Verifiable Credential to active officer',
      issueVcRes.status === 201 && !!issuedVc && !!credentialId, {
        info: `Credential ID: ${credentialId}, Status: ${issueVcRes.body?.data?.status}`
      }
    );

    // Test 6: W3C VC Structure Validation
    const hasContext = issuedVc && Array.isArray(issuedVc['@context']) && issuedVc['@context'].includes('https://www.w3.org/2018/credentials/v1');
    const hasTypes = issuedVc && Array.isArray(issuedVc.type) && issuedVc.type.includes('VerifiableCredential') && issuedVc.type.includes('GovernmentOfficerCredential');
    const hasIssuer = issuedVc && issuedVc.issuer === 'did:trustgov:a0000000-0000-4000-8000-000000000001';
    const hasSubject = issuedVc && issuedVc.credentialSubject?.id === officerDid && issuedVc.credentialSubject?.officerCode === testOfficerCode;
    const hasProof = issuedVc && issuedVc.proof && issuedVc.proof.type === 'Ed25519Signature2020' && issuedVc.proof.proofPurpose === 'assertionMethod' && !!issuedVc.proof.proofValue;

    record('Verify W3C VC data model conformity (@context, type, issuer, subject, proof)',
      hasContext && hasTypes && hasIssuer && hasSubject && hasProof, {
        info: `Context: ${hasContext}, Types: ${hasTypes}, Issuer: ${hasIssuer}, Subject: ${hasSubject}, Proof: ${hasProof}`
      }
    );

    // Test 7: Ed25519 Cryptographic Signature Verification
    // Retrieve the National Issuer Authority public key by fetching the issuer's DID
    const issuerDidRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/did/did:trustgov:a0000000-0000-4000-8000-000000000001', method: 'GET'
    });
    const issuerPubKeyMultibase = issuerDidRes.body?.verificationMethod?.[0]?.publicKeyMultibase;

    let signatureDirectlyVerified = false;
    try {
      const issuerPubKeyObj = importMultibaseKey(issuerPubKeyMultibase);
      const { proof, ...unsignedPayload } = issuedVc;
      const canonicalPayload = canonicalize(unsignedPayload);
      signatureDirectlyVerified = crypto.verify(
        null,
        Buffer.from(canonicalPayload, 'utf8'),
        issuerPubKeyObj,
        Buffer.from(proof.proofValue, 'hex')
      );
    } catch (e) {
      signatureDirectlyVerified = false;
    }

    record('Independent cryptographic Ed25519 signature verification against Issuer Public Key',
      signatureDirectlyVerified, {
        info: `Issuer Key Multibase: ${issuerPubKeyMultibase?.slice(0, 20)}... Verified: ${signatureDirectlyVerified}`
      }
    );

    // Test 8: Anti-Tamper Detection: Tampering with claim in credentialSubject
    let tamperedClaimDetected = false;
    try {
      const issuerPubKeyObj = importMultibaseKey(issuerPubKeyMultibase);
      const tamperedVc = JSON.parse(JSON.stringify(issuedVc));
      tamperedVc.credentialSubject.department = 'Fake Extortion Agency';
      const { proof, ...unsignedPayload } = tamperedVc;
      const canonicalPayload = canonicalize(unsignedPayload);
      tamperedClaimDetected = !crypto.verify(
        null,
        Buffer.from(canonicalPayload, 'utf8'),
        issuerPubKeyObj,
        Buffer.from(proof.proofValue, 'hex')
      );
    } catch {
      tamperedClaimDetected = true;
    }

    record('Anti-Tamper Detection: Altered claim in credentialSubject causes signature verification failure',
      tamperedClaimDetected, { info: 'Signature fails when claims are modified' }
    );

    // Test 9: Anti-Tamper Detection: Tampering with validity date
    let tamperedDateDetected = false;
    try {
      const issuerPubKeyObj = importMultibaseKey(issuerPubKeyMultibase);
      const tamperedVc = JSON.parse(JSON.stringify(issuedVc));
      tamperedVc.validUntil = '2099-12-31T23:59:59.999Z';
      const { proof, ...unsignedPayload } = tamperedVc;
      const canonicalPayload = canonicalize(unsignedPayload);
      tamperedDateDetected = !crypto.verify(
        null,
        Buffer.from(canonicalPayload, 'utf8'),
        issuerPubKeyObj,
        Buffer.from(proof.proofValue, 'hex')
      );
    } catch {
      tamperedDateDetected = true;
    }

    record('Anti-Tamper Detection: Altered expiration date causes signature verification failure',
      tamperedDateDetected, { info: 'Signature fails when dates are modified' }
    );

    // Test 10: 1:1 Active Credential Constraint (Cannot issue second active credential to same officer)
    const duplicateIssueRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/officers/${testOfficerId}/credentials`, method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, { validityDays: 365 });

    record('Enforce 1:1 active credential constraint (CREDENTIAL_ALREADY_EXISTS)',
      duplicateIssueRes.status === 409 && duplicateIssueRes.body?.error?.code === 'CREDENTIAL_ALREADY_EXISTS', {
        info: `Status: ${duplicateIssueRes.status}, Code: ${duplicateIssueRes.body?.error?.code}`
      }
    );

    // Test 11: Admin Get Officer Credentials
    const adminGetCredsRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/officers/${testOfficerId}/credentials`, method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const officerCredsList = adminGetCredsRes.body?.data?.credentials;

    record('Admin retrieve officer credentials list (GET /api/admin/officers/:id/credentials)',
      adminGetCredsRes.status === 200 && Array.isArray(officerCredsList) && officerCredsList.length >= 1, {
        info: `Found ${officerCredsList?.length} credentials`
      }
    );

    // Test 12: Officer Portal Get My Credentials
    const officerGetCredsRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/officer/credentials', method: 'GET',
      headers: { Authorization: `Bearer ${officerToken}` }
    });

    record('Officer Portal retrieve own credentials (GET /api/officer/credentials)',
      officerGetCredsRes.status === 200 && officerGetCredsRes.body?.data?.officer && Array.isArray(officerGetCredsRes.body?.data?.credentials), {
        info: `Officer: ${officerGetCredsRes.body?.data?.officer?.officerCode}`
      }
    );

    // Test 13: RBAC Access Control: Citizen cannot access Officer Portal
    const citizenAccessCredsRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/officer/credentials', method: 'GET',
      headers: { Authorization: `Bearer ${citizenToken}` }
    });

    record('RBAC: Citizen forbidden from accessing Officer Portal (403 Forbidden)',
      citizenAccessCredsRes.status === 403, {
        info: `Status: ${citizenAccessCredsRes.status}`
      }
    );

    // Test 14: Public Get Credential by ID
    const publicGetCredRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/credentials/${credentialId}`, method: 'GET'
    });

    record('Public retrieve credential by credentialId (GET /api/credentials/:credentialId)',
      publicGetCredRes.status === 200 && publicGetCredRes.body?.data?.credentialId === credentialId, {
        info: `Status: ${publicGetCredRes.status}, Credential: ${publicGetCredRes.body?.data?.credentialId}`
      }
    );

    // Test 15: Public Cryptographic Verification Endpoint
    const publicVerifyRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/credentials/${credentialId}/verify`, method: 'GET'
    });

    record('Public cryptographic credential verification (GET /api/credentials/:credentialId/verify)',
      publicVerifyRes.status === 200 && publicVerifyRes.body?.data?.valid === true && publicVerifyRes.body?.data?.signatureValid === true, {
        info: `Valid: ${publicVerifyRes.body?.data?.valid}, Signature: ${publicVerifyRes.body?.data?.signatureValid}`
      }
    );

    // Test 16: Multi-identifier public verification (verify by officer code)
    const verifyByCodeRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/credentials/${testOfficerCode}/verify`, method: 'GET'
    });

    record('Public verification resolves by Officer Code as well as Credential ID',
      verifyByCodeRes.status === 200 && verifyByCodeRes.body?.data?.valid === true && verifyByCodeRes.body?.data?.officer?.officerCode === testOfficerCode, {
        info: `Verified by Code: ${testOfficerCode}`
      }
    );

    // Test 17: Direct Payload Verification (POST /api/credentials/verify)
    const directVerifyRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/credentials/verify', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { credential: issuedVc });

    record('Direct raw credential payload cryptographic verification (POST /api/credentials/verify)',
      directVerifyRes.status === 200 && directVerifyRes.body?.data?.signatureValid === true, {
        info: `Signature Valid: ${directVerifyRes.body?.data?.signatureValid}`
      }
    );

    // Test 18: Direct Payload Verification with Tampered Claims
    const tamperedPayload = JSON.parse(JSON.stringify(issuedVc));
    tamperedPayload.credentialSubject.fullName = 'Impersonator Scammer';
    const directVerifyTamperedRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/credentials/verify', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { credential: tamperedPayload });

    record('Direct verification rejects tampered claims payload (valid: false, signatureValid: false)',
      directVerifyTamperedRes.status === 200 && directVerifyTamperedRes.body?.data?.valid === false && directVerifyTamperedRes.body?.data?.signatureValid === false, {
        info: `Valid: ${directVerifyTamperedRes.body?.data?.valid}, Signature: ${directVerifyTamperedRes.body?.data?.signatureValid}`
      }
    );

    // Test 19: Admin Suspend Credential (PATCH /api/admin/credentials/:id/status -> SUSPENDED)
    const suspendCredRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/credentials/${credentialId}/status`, method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, { status: 'SUSPENDED', reason: 'Routine audit suspension' });

    record('Admin suspend credential (PATCH /api/admin/credentials/:id/status)',
      suspendCredRes.status === 200 && suspendCredRes.body?.data?.status === 'SUSPENDED', {
        info: `New Status: ${suspendCredRes.body?.data?.status}`
      }
    );

    // Test 20: Suspended Credential fails public verification with CREDENTIAL_SUSPENDED
    const verifySuspendedRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/credentials/${credentialId}/verify`, method: 'GET'
    });

    record('Public verification reflects SUSPENDED status (valid: false, reason: CREDENTIAL_SUSPENDED)',
      verifySuspendedRes.status === 200 && verifySuspendedRes.body?.data?.valid === false && verifySuspendedRes.body?.data?.reason === 'CREDENTIAL_SUSPENDED', {
        info: `Reason: ${verifySuspendedRes.body?.data?.reason}`
      }
    );

    // Test 21: Admin Reactivate Suspended Credential (PATCH /api/admin/credentials/:id/status -> ACTIVE)
    const reactivateCredRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/credentials/${credentialId}/status`, method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, { status: 'ACTIVE', reason: 'Audit completed satisfactorily' });

    record('Admin reactivate suspended credential back to ACTIVE',
      reactivateCredRes.status === 200 && reactivateCredRes.body?.data?.status === 'ACTIVE', {
        info: `New Status: ${reactivateCredRes.body?.data?.status}`
      }
    );

    // Test 22: Admin Revoke Credential (Permanent deauthorization)
    const revokeCredRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/credentials/${credentialId}/status`, method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, { status: 'REVOKED', reason: 'Officer deauthorized permanently' });

    record('Admin permanently revoke credential (status: REVOKED)',
      revokeCredRes.status === 200 && revokeCredRes.body?.data?.status === 'REVOKED', {
        info: `New Status: ${revokeCredRes.body?.data?.status}`
      }
    );

    // Test 23: Revocation is permanent and cannot be modified
    const reactivateRevokedRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/credentials/${credentialId}/status`, method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, { status: 'ACTIVE' });

    record('Enforce permanent revocation: Cannot reactivate a revoked credential',
      reactivateRevokedRes.status === 400 && reactivateRevokedRes.body?.error?.code === 'CREDENTIAL_ALREADY_REVOKED', {
        info: `Status: ${reactivateRevokedRes.status}, Code: ${reactivateRevokedRes.body?.error?.code}`
      }
    );

    // Test 24: Cascade Invalidation Test: Suspending an officer cascades to active credentials
    // Create another officer, issue DID and VC
    const cascadeOfficerCode = `TG-CAS-${Date.now().toString().slice(-4)}`;
    const createCasOfficerRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/admin/officers', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, {
      full_name: 'Inspector Cascade Test',
      officer_code: cascadeOfficerCode,
      department: 'Enforcement Directorate',
      designation: 'Assistant Director',
      jurisdiction: 'Financial Crimes Unit',
      official_email: `cas.${Date.now()}@ed.gov.in`,
      official_phone: '+91 97777 12345',
      status: 'ACTIVE'
    });
    const casOfficerId = createCasOfficerRes.body?.data?.officer?.id;

    // Issue DID
    await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/officers/${casOfficerId}/did`, method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, {});

    // Issue VC
    const casVcRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/officers/${casOfficerId}/credentials`, method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, { validityDays: 365 });
    const casCredId = casVcRes.body?.data?.credentialId;

    // Suspend the officer
    await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/officers/${casOfficerId}/status`, method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, { status: 'SUSPENDED' });

    // Check credential verification
    const casVerifyRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/credentials/${casCredId}/verify`, method: 'GET'
    });

    record('Cascade Invalidation: Officer suspension cascades to credential SUSPENDED',
      casVerifyRes.status === 200 && casVerifyRes.body?.data?.valid === false && casVerifyRes.body?.data?.reason === 'CREDENTIAL_SUSPENDED', {
        info: `Credential Status: ${casVerifyRes.body?.data?.status}, Reason: ${casVerifyRes.body?.data?.reason}`
      }
    );

    // Test 25: Cannot issue VC to a revoked officer
    await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/officers/${casOfficerId}/status`, method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, { status: 'REVOKED' });

    const issueToRevokedRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/officers/${casOfficerId}/credentials`, method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, { validityDays: 365 });

    record('Reject VC issuance for a revoked officer (OFFICER_REVOKED)',
      issueToRevokedRes.status === 400 && issueToRevokedRes.body?.error?.code === 'OFFICER_REVOKED', {
        info: `Status: ${issueToRevokedRes.status}, Code: ${issueToRevokedRes.body?.error?.code}`
      }
    );

  } catch (err) {
    console.error('Fatal test execution error:', err);
    record('Fatal test suite exception', false, { error: err.message });
  }

  console.log('\n================================================================');
  console.log(`PHASE 4 TEST RESULTS: ${passCount} / ${testCount} PASSED (${Math.round((passCount / testCount) * 100)}%)`);
  console.log('================================================================\n');

  if (passCount === testCount) {
    console.log('>>> ALL PHASE 4 TESTS COMPLETED SUCCESSFULLY! <<<\n');
    process.exit(0);
  } else {
    console.error(`>>> ${testCount - passCount} TESTS FAILED! <<<\n`);
    process.exit(1);
  }
}

runTests();
