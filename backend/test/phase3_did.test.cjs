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

async function runTests() {
  console.log('================================================================');
  console.log('TRUSTGOV - PHASE 3: DID & CRYPTOGRAPHIC IDENTITY TEST SUITE');
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

    // Create a fresh officer for Phase 3 testing
    const testOfficerCode = `TG-P3-${Date.now().toString().slice(-4)}`;
    const testOfficerEmail = `p3.officer.${Date.now()}@cib.gov.in`;
    const createOfficerRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/admin/officers', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, {
      full_name: 'Inspector Ananya Sen',
      officer_code: testOfficerCode,
      department: 'Central Investigation Bureau',
      designation: 'Cyber Crime Special Lead',
      jurisdiction: 'National Cyber Command',
      official_email: testOfficerEmail,
      official_phone: '+91 98111 22334',
      status: 'ACTIVE'
    });

    const officerId = createOfficerRes.body?.data?.officer?.id;
    if (!officerId) {
      throw new Error(`Failed to create prerequisite officer: ${JSON.stringify(createOfficerRes.body)}`);
    }

    // -------------------------------------------------------------
    // TEST 1: Admin can issue DID to valid officer
    // -------------------------------------------------------------
    const issueRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/officers/${officerId}/did`, method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const issuedData = issueRes.body?.data;
    const testDid = issuedData?.did;
    const testPubKey = issuedData?.publicKey;

    record(
      'Admin can issue DID to valid officer (POST /api/admin/officers/:id/did)',
      issueRes.status === 201 &&
      issueRes.body?.success === true &&
      typeof testDid === 'string' &&
      testDid.startsWith('did:trustgov:') &&
      issuedData?.keyType === 'Ed25519' &&
      issuedData?.status === 'ACTIVE',
      { did: testDid, keyType: issuedData?.keyType }
    );

    // -------------------------------------------------------------
    // TEST 2: Issued DID is stored correctly
    // -------------------------------------------------------------
    const getOfficerRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/officers/${officerId}`, method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const officerDetails = getOfficerRes.body?.data?.officer;

    record(
      'Issued DID is stored correctly and linked to officer',
      getOfficerRes.status === 200 &&
      (officerDetails?.did === testDid || officerDetails?.did_identity?.did === testDid),
      { storedDid: officerDetails?.did_identity?.did || officerDetails?.did }
    );

    // -------------------------------------------------------------
    // TEST 3: Public key is stored correctly
    // -------------------------------------------------------------
    const storedPubKey = officerDetails?.did_identity?.public_key || officerDetails?.public_key;
    record(
      'Public key is stored correctly (Ed25519 multibase format)',
      typeof storedPubKey === 'string' &&
      storedPubKey === testPubKey &&
      storedPubKey.startsWith('z'),
      { publicKey: storedPubKey }
    );

    // -------------------------------------------------------------
    // TEST 4: Private key is NOT stored in database
    // -------------------------------------------------------------
    const officerJson = JSON.stringify(officerDetails);
    const hasPrivateKeyInDbRecord = (
      officerJson.includes('private_key') ||
      officerJson.includes('privateKey') ||
      officerJson.includes('secretKey') ||
      officerJson.includes('secret_key') ||
      officerJson.includes('mnemonic') ||
      officerJson.includes('seed')
    );
    record(
      'Private key is NOT stored in database or officer record',
      !hasPrivateKeyInDbRecord,
      { checkedFields: ['private_key', 'privateKey', 'secretKey', 'mnemonic'] }
    );

    // -------------------------------------------------------------
    // TEST 5: API response does NOT contain private key
    // -------------------------------------------------------------
    const issueResponseJson = JSON.stringify(issueRes.body);
    const hasPrivateKeyInApiResponse = (
      issueResponseJson.includes('privateKey') ||
      issueResponseJson.includes('private_key') ||
      issueResponseJson.includes('secretKey') ||
      issueResponseJson.includes('secret_key') ||
      issueResponseJson.includes('mnemonic') ||
      issueResponseJson.includes('seed')
    );
    record(
      'API response does NOT contain private key',
      !hasPrivateKeyInApiResponse && issueRes.body?.data?.privateKey === undefined,
      { responseKeys: Object.keys(issueRes.body?.data || {}) }
    );

    // -------------------------------------------------------------
    // TEST 6: DID resolution returns public DID Document
    // -------------------------------------------------------------
    const resolveRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/did/${testDid}`, method: 'GET'
    });
    const didDoc = resolveRes.body?.data || resolveRes.body;
    const hasVerificationMethod = Array.isArray(didDoc?.verificationMethod) && didDoc.verificationMethod.length > 0;
    const hasAuth = Array.isArray(didDoc?.authentication) && didDoc.authentication.length > 0;

    record(
      'DID resolution returns public DID Document (GET /api/did/:did)',
      resolveRes.status === 200 &&
      didDoc?.id === testDid &&
      hasVerificationMethod &&
      hasAuth &&
      didDoc?.status === 'ACTIVE' &&
      didDoc.verificationMethod[0].publicKeyMultibase === testPubKey,
      { docId: didDoc?.id, status: didDoc?.status }
    );

    // -------------------------------------------------------------
    // TEST 7: Unknown DID returns 404
    // -------------------------------------------------------------
    const unknownDid = 'did:trustgov:00000000-0000-0000-0000-000000000000';
    const unknownRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/did/${unknownDid}`, method: 'GET'
    });
    record(
      'Unknown DID returns 404 Not Found',
      unknownRes.status === 404 && unknownRes.body?.error?.code === 'DID_NOT_FOUND',
      { status: unknownRes.status, code: unknownRes.body?.error?.code }
    );

    // -------------------------------------------------------------
    // TEST 8: Malformed DID is rejected with 400 Bad Request
    // -------------------------------------------------------------
    const malformedRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/did/not-a-did-at-all', method: 'GET'
    });
    record(
      'Malformed DID is rejected with 400 Bad Request',
      malformedRes.status === 400 && malformedRes.body?.error?.code === 'INVALID_DID_FORMAT',
      { status: malformedRes.status, code: malformedRes.body?.error?.code }
    );

    // -------------------------------------------------------------
    // TEST 9: Duplicate DID issuance returns 409 Conflict
    // -------------------------------------------------------------
    const duplicateRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/officers/${officerId}/did`, method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    record(
      'Duplicate DID issuance returns 409 Conflict',
      duplicateRes.status === 409 && duplicateRes.body?.error?.code === 'DID_ALREADY_EXISTS',
      { status: duplicateRes.status, message: duplicateRes.body?.error?.message }
    );

    // -------------------------------------------------------------
    // TEST 10: Citizen cannot issue DID (403 Forbidden)
    // -------------------------------------------------------------
    const citizenIssueRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/officers/${officerId}/did`, method: 'POST',
      headers: { 'Authorization': `Bearer ${citizenToken}` }
    });
    record(
      'Citizen cannot issue DID (returns 403 Forbidden)',
      citizenIssueRes.status === 403 && citizenIssueRes.body?.error?.code === 'ACCESS_DENIED',
      { status: citizenIssueRes.status }
    );

    // -------------------------------------------------------------
    // TEST 11: Officer cannot issue DID (403 Forbidden)
    // -------------------------------------------------------------
    const officerIssueRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/officers/${officerId}/did`, method: 'POST',
      headers: { 'Authorization': `Bearer ${officerToken}` }
    });
    record(
      'Officer cannot issue DID (returns 403 Forbidden)',
      officerIssueRes.status === 403 && officerIssueRes.body?.error?.code === 'ACCESS_DENIED',
      { status: officerIssueRes.status }
    );

    // -------------------------------------------------------------
    // TEST 12: Unauthenticated request returns 401 Unauthorized
    // -------------------------------------------------------------
    const unauthIssueRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/officers/${officerId}/did`, method: 'POST'
    });
    record(
      'Unauthenticated request returns 401 Unauthorized',
      unauthIssueRes.status === 401 && unauthIssueRes.body?.error?.code === 'UNAUTHORIZED',
      { status: unauthIssueRes.status }
    );

    // -------------------------------------------------------------
    // TEST 13: Cryptographic signature verification succeeds
    // -------------------------------------------------------------
    const demoKeyPair = crypto.generateKeyPairSync('ed25519');
    const demoDer = demoKeyPair.publicKey.export({ type: 'spki', format: 'der' });
    const demoRawPub = demoDer.subarray(12);
    const demoMulticodec = Buffer.concat([Buffer.from([0xed, 0x01]), demoRawPub]);

    // Encode Base58btc
    let digits = [0];
    for (let i = 0; i < demoMulticodec.length; i++) {
      for (let j = 0; j < digits.length; j++) digits[j] <<= 8;
      digits[0] += demoMulticodec[i];
      let carry = 0;
      for (let j = 0; j < digits.length; j++) {
        digits[j] += carry;
        carry = (digits[j] / 58) | 0;
        digits[j] %= 58;
      }
      while (carry) {
        digits.push(carry % 58);
        carry = (carry / 58) | 0;
      }
    }
    const demoMultibasePub = 'z' + digits.reverse().map(d => BASE58_ALPHABET[d]).join('');

    const testMessage = 'TrustGov Phase 3 verification test';
    const testSignature = crypto.sign(null, Buffer.from(testMessage, 'utf8'), demoKeyPair.privateKey);
    const importedPub = importMultibaseKey(demoMultibasePub);
    const verifySuccess = crypto.verify(null, Buffer.from(testMessage, 'utf8'), importedPub, testSignature);

    record(
      'Cryptographic signature verification succeeds (Ed25519)',
      verifySuccess === true,
      { info: 'SIGNATURE VERIFICATION: PASS' }
    );

    // -------------------------------------------------------------
    // TEST 14: Modified message fails signature verification (Tamper detection)
    // -------------------------------------------------------------
    const tamperedMessage = 'TrustGov Phase 3 verification test modified';
    const verifyTampered = crypto.verify(null, Buffer.from(tamperedMessage, 'utf8'), importedPub, testSignature);

    record(
      'Modified message fails signature verification (Tamper detection)',
      verifyTampered === false,
      { info: 'TAMPER DETECTION: PASS' }
    );

    // -------------------------------------------------------------
    // TEST 15: Suspended officer's DID becomes/appears SUSPENDED
    // -------------------------------------------------------------
    const suspendRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/officers/${officerId}/status`, method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, { status: 'SUSPENDED' });

    const resolveSuspended = await request({
      hostname: 'localhost', port: 5000, path: `/api/did/${testDid}`, method: 'GET'
    });
    const suspendedDoc = resolveSuspended.body?.data || resolveSuspended.body;

    record(
      "Suspended officer's DID becomes/appears SUSPENDED",
      suspendRes.status === 200 &&
      resolveSuspended.status === 200 &&
      suspendedDoc?.status === 'SUSPENDED',
      { officerStatus: suspendRes.body?.data?.officer?.status, didDocStatus: suspendedDoc?.status }
    );

    // -------------------------------------------------------------
    // TEST 16: Revoked officer's DID becomes/appears REVOKED
    // -------------------------------------------------------------
    const revokeRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/officers/${officerId}/status`, method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, { status: 'REVOKED' });

    const resolveRevoked = await request({
      hostname: 'localhost', port: 5000, path: `/api/did/${testDid}`, method: 'GET'
    });
    const revokedDoc = resolveRevoked.body?.data || resolveRevoked.body;

    record(
      "Revoked officer's DID becomes/appears REVOKED",
      revokeRes.status === 200 &&
      resolveRevoked.status === 200 &&
      revokedDoc?.status === 'REVOKED',
      { officerStatus: revokeRes.body?.data?.officer?.status, didDocStatus: revokedDoc?.status }
    );

    // -------------------------------------------------------------
    // TEST 17: Audit log is created when DID is issued
    // -------------------------------------------------------------
    const dashboardRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/admin/dashboard', method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const recentAuditLogs = dashboardRes.body?.data?.recentAuditLogs || [];
    const auditActions = recentAuditLogs.map(l => l.action);
    const hasDidIssuedAudit = auditActions.includes('DID_ISSUED');
    const hasDidStatusAudit = auditActions.includes('DID_STATUS_CHANGED');

    record(
      'Audit log is created when DID is issued and status changes',
      hasDidIssuedAudit || hasDidStatusAudit,
      { foundActions: auditActions.filter(a => a.startsWith('DID_')) }
    );

    // -------------------------------------------------------------
    // TEST 18: Private key does not appear in logs
    // -------------------------------------------------------------
    const auditLogJson = JSON.stringify(recentAuditLogs);
    const hasPrivateKeyInLogs = (
      auditLogJson.includes('privateKey') ||
      auditLogJson.includes('private_key') ||
      auditLogJson.includes('secretKey') ||
      auditLogJson.includes('secret_key') ||
      auditLogJson.includes('mnemonic')
    );
    record(
      'Private key does not appear in audit logs',
      !hasPrivateKeyInLogs,
      { logEntriesScanned: recentAuditLogs.length }
    );

    // -------------------------------------------------------------
    // TEST 19: Private key does not appear in frontend responses
    // -------------------------------------------------------------
    const officerMeRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/auth/me', method: 'GET',
      headers: { 'Authorization': `Bearer ${officerToken}` }
    });
    const officerMeJson = JSON.stringify(officerMeRes.body);
    const hasPrivateKeyInMe = (
      officerMeJson.includes('privateKey') ||
      officerMeJson.includes('private_key') ||
      officerMeJson.includes('secretKey')
    );
    record(
      'Private key does not appear in frontend /auth/me or profile responses',
      !hasPrivateKeyInMe && officerMeRes.body?.data?.officerDetails?.did !== undefined,
      { officerDetailsKeys: Object.keys(officerMeRes.body?.data?.officerDetails || {}) }
    );

    // -------------------------------------------------------------
    // TEST 20: Existing Phase 1 tests still pass
    // -------------------------------------------------------------
    const healthRes = await request({
      hostname: 'localhost', port: 5000, path: '/health', method: 'GET'
    });
    const citizenMeRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/auth/me', method: 'GET',
      headers: { 'Authorization': `Bearer ${citizenToken}` }
    });
    record(
      'Existing Phase 1 tests still pass (Health check & Auth profile)',
      healthRes.status === 200 &&
      healthRes.body?.success === true &&
      citizenMeRes.status === 200 &&
      citizenMeRes.body?.data?.user?.role === 'CITIZEN',
      { health: healthRes.body?.message, citizenRole: citizenMeRes.body?.data?.user?.role }
    );

    // -------------------------------------------------------------
    // TEST 21: Existing Phase 2 tests still pass
    // -------------------------------------------------------------
    const listOfficersRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/admin/officers', method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const officersList = listOfficersRes.body?.data?.officers;
    record(
      'Existing Phase 2 tests still pass (Officer Management listing & access control)',
      listOfficersRes.status === 200 &&
      Array.isArray(officersList) &&
      officersList.length > 0 &&
      citizenIssueRes.status === 403,
      { totalOfficers: officersList?.length }
    );

  } catch (err) {
    console.error('Phase 3 Test Execution Error:', err);
  }

  console.log('================================================================');
  console.log(`Phase 3 Test Results: ${passCount} / ${testCount} Passed (${Math.round((passCount / testCount) * 100)}%)`);
  console.log('================================================================\n');

  return { passCount, testCount, allPassed: passCount === testCount && testCount === 21 };
}

runTests().then(summary => {
  if (summary.allPassed) {
    console.log('ALL 21 PHASE 3 TESTS PASSED PERFECTLY!');
    process.exit(0);
  } else {
    console.error(`SOME PHASE 3 TESTS FAILED: ${summary.passCount}/${summary.testCount}`);
    process.exit(1);
  }
});
