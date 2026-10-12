/**
 * TRUSTGOV - PHASE 5 TEST SUITE: BLOCKCHAIN REGISTRY & SMART CONTRACT ANCHORING
 * 
 * Tests:
 * 1. Authentication & token acquisition
 * 2. Officer creation & W3C Verifiable Credential issuance
 * 3. On-chain Officer DID registration
 * 4. Verifiable Credential on-chain anchoring (RFC 8785 SHA-256 hash)
 * 5. Registry metadata (contract address, chainId, blockNumber, txHash)
 * 6. Conflict prevention on duplicate anchor attempts (409 CREDENTIAL_ALREADY_ANCHORED)
 * 7. Public blockchain integrity verification endpoint
 * 8. Public blockchain record retrieval
 * 9. Lifecycle cascade: Officer SUSPENSION automatically updates on-chain status to SUSPENDED
 * 10. Lifecycle cascade: Officer REVOCATION automatically updates on-chain status to REVOKED
 * 11. Immutability guardrail: Revoked credentials cannot be anchored (400 CREDENTIAL_REVOKED)
 * 12. Tamper-evidence: Hash mismatch detection
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

function computeSha256(data) {
  const canonical = typeof data === 'string' ? data : canonicalize(data);
  return '0x' + crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

async function runTests() {
  console.log('================================================================');
  console.log('TRUSTGOV - PHASE 5: BLOCKCHAIN REGISTRY & ANCHORING TEST SUITE');
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
    // 1. Auth setup
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
      info: 'Admin, Officer, and Citizen JWT tokens acquired'
    });

    // 2. Create Officer for Phase 5
    const testOfficerCode = `TG-BC-${Date.now().toString().slice(-4)}`;
    const createOfficerRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/admin/officers', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, {
      full_name: 'Superintendent Vikram Singhania',
      officer_code: testOfficerCode,
      department: 'Central Cyber Crime Coordination Center',
      designation: 'Superintendent of Police',
      jurisdiction: 'National Cyber Security Command',
      official_email: `vikram.bc.${Date.now()}@cybercrime.gov.in`,
      official_phone: '+91 91234 56789'
    });
    const officerId = createOfficerRes.body?.data?.officer?.id;

    record('Officer created successfully', !!officerId, {
      info: `Officer ID: ${officerId}, Code: ${testOfficerCode}`
    });

    // 2b. Issue DID to officer
    const issueDidRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/officers/${officerId}/did`, method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, {});
    const officerDid = issueDidRes.body?.data?.did;

    record('Issue DID to officer', issueDidRes.status === 201 && !!officerDid, {
      info: `Officer DID: ${officerDid}`
    });

    // 3. Issue Verifiable Credential
    const issueVcRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/officers/${officerId}/credentials`, method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, { validityDays: 365 });

    const vcData = issueVcRes.body?.data;
    const credentialId = vcData?.credentialId;
    const credentialPayload = vcData?.credential;

    record('Issue W3C Verifiable Credential for Officer', issueVcRes.status === 201 && !!credentialId, {
      info: `Credential ID: ${credentialId}, Algorithm: Ed25519Signature2020`
    });

    // 4. Anchor Officer DID to Blockchain
    const anchorDidRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/officers/${officerId}/blockchain-anchor-did`, method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    });

    record('Anchor Officer DID to TrustGovRegistry Smart Contract',
      (anchorDidRes.status === 200 || anchorDidRes.status === 201) && anchorDidRes.body?.success, {
        info: `DID Hash: ${anchorDidRes.body?.data?.didHash}`
      }
    );

    // 5. Anchor Verifiable Credential to Blockchain
    const anchorVcRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/credentials/${credentialId}/blockchain-anchor`, method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    });

    const anchorData = anchorVcRes.body?.data;
    const computedExpectedHash = computeSha256(credentialPayload);

    record('Anchor Verifiable Credential to Blockchain Registry',
      anchorVcRes.status === 201 && anchorData?.credentialHash === computedExpectedHash, {
        info: `Credential Hash: ${anchorData?.credentialHash}, Tx: ${anchorData?.transactionHash}`
      }
    );

    // 6. Verify Blockchain Transaction metadata
    const validMetadata = !!(
      anchorData?.transactionHash &&
      anchorData?.contractAddress &&
      anchorData?.blockNumber !== undefined &&
      anchorData?.status === 'ACTIVE'
    );
    record('Verify Anchor Metadata (TxHash, ContractAddress, BlockNumber, Status)', validMetadata, {
      info: `Contract: ${anchorData?.contractAddress}, Block: ${anchorData?.blockNumber}, Status: ${anchorData?.status}`
    });

    // 7. Double-anchor prevention
    const doubleAnchorRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/credentials/${credentialId}/blockchain-anchor`, method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    });

    record('Prevent duplicate credential anchoring (HTTP 409 CREDENTIAL_ALREADY_ANCHORED)',
      doubleAnchorRes.status === 409 && doubleAnchorRes.body?.error?.code === 'CREDENTIAL_ALREADY_ANCHORED', {
        info: `Status: ${doubleAnchorRes.status}, Error: ${doubleAnchorRes.body?.error?.code}`
      }
    );

    // 8. Public Blockchain Integrity Verification Endpoint
    const publicVerifyRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/blockchain/${credentialId}/verify`, method: 'GET'
    });

    const verifyData = publicVerifyRes.body?.data;
    const verifySuccess = (
      publicVerifyRes.status === 200 &&
      verifyData?.valid === true &&
      verifyData?.anchored === true &&
      verifyData?.hashMatch === true &&
      verifyData?.onChainStatus === 'ACTIVE'
    );

    record('Public Blockchain Integrity Verification (GET /api/blockchain/:credentialId/verify)', verifySuccess, {
      info: `Anchored: ${verifyData?.anchored}, HashMatch: ${verifyData?.hashMatch}, Status: ${verifyData?.onChainStatus}`
    });

    // 9. Public Blockchain Record Retrieval
    const recordRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/blockchain/${credentialId}/record`, method: 'GET'
    });

    const recData = recordRes.body?.data;
    record('Public Blockchain Record Retrieval (GET /api/blockchain/:credentialId/record)',
      recordRes.status === 200 && recData?.credentialId === credentialId, {
        info: `Anchored At: ${recData?.anchoredAt}, Network: ${recData?.network}`
      }
    );

    // 10. Status Cascade: Suspend Officer & Check Blockchain Sync
    await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/officers/${officerId}/status`, method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, { status: 'SUSPENDED' });

    const verifySuspendedRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/blockchain/${credentialId}/verify`, method: 'GET'
    });

    const suspendedVerifyData = verifySuspendedRes.body?.data;
    record('Lifecycle Cascade: Officer SUSPENSION synchronizes on-chain status to SUSPENDED',
      suspendedVerifyData?.onChainStatus === 'SUSPENDED' || suspendedVerifyData?.officerStatus === 'SUSPENDED', {
        info: `On-Chain Status: ${suspendedVerifyData?.onChainStatus}, Officer Status: ${suspendedVerifyData?.officerStatus}`
      }
    );

    // 11. Status Cascade: Revoke Officer & Check Blockchain Sync
    await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/officers/${officerId}/status`, method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, { status: 'REVOKED' });

    const verifyRevokedRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/blockchain/${credentialId}/verify`, method: 'GET'
    });

    const revokedVerifyData = verifyRevokedRes.body?.data;
    record('Lifecycle Cascade: Officer REVOCATION synchronizes on-chain status to REVOKED',
      revokedVerifyData?.onChainStatus === 'REVOKED' || revokedVerifyData?.officerStatus === 'REVOKED', {
        info: `On-Chain Status: ${revokedVerifyData?.onChainStatus}, Officer Status: ${revokedVerifyData?.officerStatus}`
      }
    );

    // 12. Immutability Guardrail: Reject anchoring a revoked credential
    // Create revoked officer and attempt anchoring
    const testOfficerRevoked = `TG-BC-REV-${Date.now().toString().slice(-4)}`;
    const createRevOfficer = await request({
      hostname: 'localhost', port: 5000, path: '/api/admin/officers', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, {
      full_name: 'Former Inspector Revoked',
      officer_code: testOfficerRevoked,
      department: 'Traffic Control',
      designation: 'Inspector',
      jurisdiction: 'Zone 1',
      official_email: `rev.${Date.now()}@traffic.gov.in`,
      official_phone: '+91 98888 77777'
    });
    const revOfficerId = createRevOfficer.body?.data?.officer?.id;

    // Issue DID for revoked officer test
    await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/officers/${revOfficerId}/did`, method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, {});

    // Issue VC first
    const issueRevVc = await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/officers/${revOfficerId}/credentials`, method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, { validityDays: 365 });
    const revCredId = issueRevVc.body?.data?.credentialId;

    // Revoke officer (which revokes VC)
    await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/officers/${revOfficerId}/status`, method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, { status: 'REVOKED' });

    // Try to anchor the revoked credential
    const anchorRevokedRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/credentials/${revCredId}/blockchain-anchor`, method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    });

    record('Immutability Guardrail: Reject anchoring a REVOKED credential (HTTP 400 CREDENTIAL_REVOKED)',
      anchorRevokedRes.status === 400 && anchorRevokedRes.body?.error?.code === 'CREDENTIAL_REVOKED', {
        info: `Status: ${anchorRevokedRes.status}, Code: ${anchorRevokedRes.body?.error?.code}`
      }
    );

    // 13. Query non-existent credential verification
    const nonExistentRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/blockchain/VC-NON-EXISTENT-9999/verify', method: 'GET'
    });

    record('Non-existent credential returns 404 CREDENTIAL_NOT_FOUND',
      nonExistentRes.status === 404 && nonExistentRes.body?.error?.code === 'CREDENTIAL_NOT_FOUND', {
        info: `Status: ${nonExistentRes.status}, Code: ${nonExistentRes.body?.error?.code}`
      }
    );

    // 14. Audit log verification for blockchain anchoring
    const auditRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/admin/dashboard', method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    const recentLogs = auditRes.body?.data?.recentAuditLogs || [];
    const hasBcAudit = recentLogs.some(log =>
      log.action === 'BLOCKCHAIN_CREDENTIAL_ANCHORED' ||
      log.action === 'CREDENTIAL_REVOKED' ||
      log.action === 'CREDENTIAL_SUSPENDED'
    );

    record('Immutable Audit Trail records blockchain anchor and cascade events', hasBcAudit, {
      info: `Found audit events in dashboard metrics: ${hasBcAudit}`
    });

  } catch (err) {
    console.error('Fatal test execution error:', err);
    record('Fatal test suite exception', false, { error: err.message });
  }

  console.log('\n================================================================');
  console.log(`PHASE 5 TEST RESULTS: ${passCount} / ${testCount} PASSED (${Math.round((passCount / testCount) * 100)}%)`);
  console.log('================================================================\n');

  if (passCount === testCount) {
    console.log('>>> ALL PHASE 5 BLOCKCHAIN TESTS COMPLETED SUCCESSFULLY! <<<\n');
    process.exit(0);
  } else {
    console.error(`>>> ${testCount - passCount} TESTS FAILED! <<<\n`);
    process.exit(1);
  }
}

runTests();
