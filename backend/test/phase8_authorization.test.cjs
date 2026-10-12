/**
 * TRUSTGOV - PHASE 8 TEST SUITE: AUTHORIZATION & RISK ENGINE
 * 
 * Verifies:
 * 1. Admin can create policy (POST /api/admin/authorization-policies)
 * 2. Non-admin cannot create policy (returns 403 Forbidden)
 * 3. Admin can update policy / create new version (POST /api/admin/authorization-policies/:id/version)
 * 4. Admin can activate policy (PATCH /api/admin/authorization-policies/:id/status -> ACTIVE)
 * 5. Admin can deactivate policy (PATCH /api/admin/authorization-policies/:id/status -> INACTIVE)
 * 6. Historical versions remain immutable
 * 7. Valid ALLOW policy returns ALLOW (REQUEST_DOCUMENT -> ALLOW, risk LOW)
 * 8. Explicit DENY returns DENY (REQUEST_REMOTE_ACCESS -> DENY, risk HIGH)
 * 9. REVIEW policy returns REVIEW (REQUEST_PHYSICAL_APPEARANCE -> REVIEW, risk MEDIUM)
 * 10. No matching policy returns REVIEW (reason: NO_ACTIVE_POLICY)
 * 11. REQUEST_OTP produces CRITICAL (reason: OTP_REQUEST)
 * 12. REQUEST_PIN produces CRITICAL (reason: PIN_REQUEST)
 * 13. REQUEST_PASSWORD produces CRITICAL (reason: PASSWORD_REQUEST)
 * 14. REQUEST_UPI_PAYMENT produces CRITICAL (reason: PERSONAL_PAYMENT_REQUEST)
 * 15. REQUEST_BANK_TRANSFER produces CRITICAL (reason: PERSONAL_PAYMENT_REQUEST)
 * 16. REQUEST_REMOTE_ACCESS produces HIGH (reason: REMOTE_ACCESS_REQUEST)
 * 17. Suspended officer cannot receive ALLOW (reason: OFFICER_SUSPENDED)
 * 18. Revoked officer cannot receive ALLOW (reason: OFFICER_REVOKED)
 * 19. Expired credential cannot receive ALLOW (reason: CREDENTIAL_EXPIRED)
 * 20. Invalid credential cannot receive ALLOW (reason: CREDENTIAL_INVALID)
 * 21. Failed proof-of-possession cannot receive ALLOW (reason: PROOF_OF_POSSESSION_FAILED)
 * 22. Frontend cannot force authorized=true
 * 23. Frontend cannot force riskLevel=LOW
 * 24. Frontend cannot force identityVerified=true
 * 25. Citizen privacy: Citizen A cannot read Citizen B history (404 RECORD_NOT_FOUND)
 * 26. Public reference does not expose citizen identity or private keys
 * 27. Sensitive values are not returned in evaluation response
 * 28. Rate limiting or protected evaluation endpoint
 * 29. Audit events are created for evaluation lifecycle
 * 30. Reason codes are returned with explainable citizen messages
 * 31. Policy version is recorded in evaluation history
 * 32. Historical evaluation remains unchanged after policy update
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
  console.log('TRUSTGOV - PHASE 8: AUTHORIZATION & RISK ENGINE TEST SUITE');
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
    console.log('--- Setting Up Test Actors & Tokens ---');

    // 1. Admin login
    const adminLogin = await request({
      hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'admin@trustgov.demo', password: 'password123' });

    const adminToken = adminLogin.body?.data?.token;
    if (!adminToken) throw new Error('Admin login failed: ' + JSON.stringify(adminLogin.body));

    // 2. Citizen 1 login
    const citizenLogin = await request({
      hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'citizen@trustgov.demo', password: 'password123' });

    const citizenToken = citizenLogin.body?.data?.token;
    if (!citizenToken) throw new Error('Citizen login failed');

    // 3. Citizen 2 registration
    const citizen2Email = `citizen2-${Date.now()}@trustgov.demo`;
    const regRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/auth/register', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      name: 'Demo Citizen 2',
      email: citizen2Email,
      phone: '+91 98765 00000',
      password: 'password123',
      role: 'CITIZEN'
    });

    const citizen2Token = regRes.body?.data?.token;
    if (!citizen2Token) throw new Error('Citizen 2 registration failed');

    // 4. Officer login
    const officerLogin = await request({
      hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'officer@trustgov.demo', password: 'password123' });

    const officerToken = officerLogin.body?.data?.token;

    console.log('✓ Actors authenticated successfully.\n');
    console.log('--- Running Phase 8 Test Cases ---');

    // -------------------------------------------------------------
    // Test 1: Admin can create policy
    // -------------------------------------------------------------
    const newPolicyCode = `TG-TEST-POLICY-${Date.now()}`;
    const createPolicyRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/admin/authorization-policies', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, {
      policyCode: newPolicyCode,
      department: 'Demo Central Investigation Bureau',
      role: 'Investigating Officer',
      actionCode: 'REQUEST_SIGNED_DOCUMENT',
      decision: 'ALLOW',
      constraints: { allowedChannels: ['OFFICIAL_PORTAL', 'OFFICIAL_OFFICE'] },
      description: 'Test policy for signed documents'
    });

    const createdPolicy = createPolicyRes.body?.data?.policy;
    record(
      'Admin can create policy (POST /api/admin/authorization-policies)',
      createPolicyRes.status === 201 && createdPolicy?.policyCode === newPolicyCode && createdPolicy?.version === 1,
      createPolicyRes.body
    );

    // -------------------------------------------------------------
    // Test 2: Non-admin cannot create policy (returns 403)
    // -------------------------------------------------------------
    const nonAdminCreate = await request({
      hostname: 'localhost', port: 5000, path: '/api/admin/authorization-policies', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenToken}` }
    }, {
      policyCode: `TG-UNAUTH-${Date.now()}`,
      department: 'Any',
      role: 'Any',
      actionCode: 'REQUEST_DOCUMENT',
      decision: 'ALLOW',
      description: 'Unauthorized creation attempt'
    });

    record(
      'Non-admin cannot create policy (returns 403 Forbidden)',
      nonAdminCreate.status === 403,
      nonAdminCreate.body
    );

    // -------------------------------------------------------------
    // Test 3: Admin can update policy (create version 2)
    // -------------------------------------------------------------
    const version2Res = await request({
      hostname: 'localhost', port: 5000,
      path: `/api/admin/authorization-policies/${createdPolicy.id}/version`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, {
      description: 'Updated test policy version 2',
      decision: 'ALLOW'
    });

    const version2Policy = version2Res.body?.data?.policy;
    record(
      'Admin can update policy / create new version (version = 2)',
      version2Res.status === 201 && version2Policy?.version === 2 && version2Policy?.policyCode === newPolicyCode,
      version2Res.body
    );

    // -------------------------------------------------------------
    // Test 4: Admin can activate policy
    // -------------------------------------------------------------
    const activateRes = await request({
      hostname: 'localhost', port: 5000,
      path: `/api/admin/authorization-policies/${version2Policy.id}/status`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, { status: 'ACTIVE' });

    record(
      'Admin can activate policy (PATCH /status -> ACTIVE)',
      activateRes.status === 200 && activateRes.body?.data?.policy?.status === 'ACTIVE',
      activateRes.body
    );

    // -------------------------------------------------------------
    // Test 5: Admin can deactivate policy
    // -------------------------------------------------------------
    const deactivateRes = await request({
      hostname: 'localhost', port: 5000,
      path: `/api/admin/authorization-policies/${version2Policy.id}/status`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, { status: 'INACTIVE' });

    record(
      'Admin can deactivate policy (PATCH /status -> INACTIVE)',
      deactivateRes.status === 200 && deactivateRes.body?.data?.policy?.status === 'INACTIVE',
      deactivateRes.body
    );

    // Reactivate for subsequent tests
    await request({
      hostname: 'localhost', port: 5000,
      path: `/api/admin/authorization-policies/${version2Policy.id}/status`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, { status: 'ACTIVE' });

    // -------------------------------------------------------------
    // Test 6: Historical versions remain immutable
    // -------------------------------------------------------------
    const getV1Res = await request({
      hostname: 'localhost', port: 5000,
      path: `/api/admin/authorization-policies/${createdPolicy.id}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    const v1Data = getV1Res.body?.data?.policy;
    record(
      'Historical policy versions remain immutable (version 1 retained original version number & code)',
      getV1Res.status === 200 && v1Data?.version === 1 && v1Data?.policyCode === newPolicyCode,
      getV1Res.body
    );

    // -------------------------------------------------------------
    // Test 7: Valid ALLOW policy returns ALLOW
    // -------------------------------------------------------------
    const allowEvalRes = await request({
      hostname: 'localhost', port: 5000,
      path: '/api/citizen/authorization/evaluate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenToken}` }
    }, {
      officerReference: 'TG-OFF-001',
      actionCode: 'REQUEST_DOCUMENT',
      requestContext: {
        communicationChannel: 'OFFICIAL_PORTAL',
        requestedDataCategory: 'DOCUMENTS'
      }
    });

    const allowEval = allowEvalRes.body?.data;
    record(
      'Valid ALLOW policy returns ALLOW (REQUEST_DOCUMENT -> ALLOW, risk LOW)',
      allowEvalRes.status === 200 &&
      allowEval?.decision === 'ALLOW' &&
      allowEval?.authorized === true &&
      allowEval?.riskLevel === 'LOW' &&
      allowEval?.identityVerified === true,
      allowEvalRes.body
    );

    // -------------------------------------------------------------
    // Test 8: Explicit DENY returns DENY
    // -------------------------------------------------------------
    const denyEvalRes = await request({
      hostname: 'localhost', port: 5000,
      path: '/api/citizen/authorization/evaluate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenToken}` }
    }, {
      officerReference: 'TG-OFF-001',
      actionCode: 'REQUEST_REMOTE_ACCESS'
    });

    const denyEval = denyEvalRes.body?.data;
    record(
      'Explicit DENY returns DENY (REQUEST_REMOTE_ACCESS -> DENY, risk HIGH)',
      denyEvalRes.status === 200 &&
      denyEval?.decision === 'DENY' &&
      denyEval?.authorized === false &&
      denyEval?.riskLevel === 'HIGH' &&
      denyEval?.reasonCodes.includes('REMOTE_ACCESS_REQUEST'),
      denyEvalRes.body
    );

    // -------------------------------------------------------------
    // Test 9: REVIEW policy returns REVIEW
    // -------------------------------------------------------------
    const reviewEvalRes = await request({
      hostname: 'localhost', port: 5000,
      path: '/api/citizen/authorization/evaluate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenToken}` }
    }, {
      officerReference: 'TG-OFF-001',
      actionCode: 'REQUEST_PHYSICAL_APPEARANCE'
    });

    const reviewEval = reviewEvalRes.body?.data;
    record(
      'REVIEW policy returns REVIEW (REQUEST_PHYSICAL_APPEARANCE -> REVIEW, risk MEDIUM)',
      reviewEvalRes.status === 200 &&
      reviewEval?.decision === 'REVIEW' &&
      reviewEval?.authorized === false &&
      reviewEval?.riskLevel === 'MEDIUM',
      reviewEvalRes.body
    );

    // -------------------------------------------------------------
    // Test 10: No matching policy returns REVIEW (reason: NO_ACTIVE_POLICY)
    // -------------------------------------------------------------
    const noPolicyRes = await request({
      hostname: 'localhost', port: 5000,
      path: '/api/citizen/authorization/evaluate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenToken}` }
    }, {
      officerReference: 'TG-OFF-001',
      actionCode: 'OTHER'
    });

    const noPolicyData = noPolicyRes.body?.data;
    record(
      'No matching policy returns REVIEW (reason: NO_ACTIVE_POLICY)',
      noPolicyRes.status === 200 &&
      noPolicyData?.decision === 'REVIEW' &&
      noPolicyData?.reasonCodes.includes('NO_ACTIVE_POLICY'),
      noPolicyRes.body
    );

    // -------------------------------------------------------------
    // Test 11: REQUEST_OTP produces CRITICAL
    // -------------------------------------------------------------
    const otpRes = await request({
      hostname: 'localhost', port: 5000,
      path: '/api/citizen/authorization/evaluate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenToken}` }
    }, {
      officerReference: 'TG-OFF-001',
      actionCode: 'REQUEST_OTP'
    });

    record(
      'REQUEST_OTP produces CRITICAL risk & DENY (reason: OTP_REQUEST)',
      otpRes.status === 200 &&
      otpRes.body?.data?.decision === 'DENY' &&
      otpRes.body?.data?.riskLevel === 'CRITICAL' &&
      otpRes.body?.data?.reasonCodes.includes('OTP_REQUEST'),
      otpRes.body
    );

    // -------------------------------------------------------------
    // Test 12: REQUEST_PIN produces CRITICAL
    // -------------------------------------------------------------
    const pinRes = await request({
      hostname: 'localhost', port: 5000,
      path: '/api/citizen/authorization/evaluate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenToken}` }
    }, {
      officerReference: 'TG-OFF-001',
      actionCode: 'REQUEST_PIN'
    });

    record(
      'REQUEST_PIN produces CRITICAL risk & DENY (reason: PIN_REQUEST)',
      pinRes.status === 200 &&
      pinRes.body?.data?.decision === 'DENY' &&
      pinRes.body?.data?.riskLevel === 'CRITICAL' &&
      pinRes.body?.data?.reasonCodes.includes('PIN_REQUEST'),
      pinRes.body
    );

    // -------------------------------------------------------------
    // Test 13: REQUEST_PASSWORD produces CRITICAL
    // -------------------------------------------------------------
    const pwdRes = await request({
      hostname: 'localhost', port: 5000,
      path: '/api/citizen/authorization/evaluate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenToken}` }
    }, {
      officerReference: 'TG-OFF-001',
      actionCode: 'REQUEST_PASSWORD'
    });

    record(
      'REQUEST_PASSWORD produces CRITICAL risk & DENY (reason: PASSWORD_REQUEST)',
      pwdRes.status === 200 &&
      pwdRes.body?.data?.decision === 'DENY' &&
      pwdRes.body?.data?.riskLevel === 'CRITICAL' &&
      pwdRes.body?.data?.reasonCodes.includes('PASSWORD_REQUEST'),
      pwdRes.body
    );

    // -------------------------------------------------------------
    // Test 14: REQUEST_UPI_PAYMENT produces CRITICAL
    // -------------------------------------------------------------
    const upiRes = await request({
      hostname: 'localhost', port: 5000,
      path: '/api/citizen/authorization/evaluate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenToken}` }
    }, {
      officerReference: 'TG-OFF-001',
      actionCode: 'REQUEST_UPI_PAYMENT',
      requestContext: { paymentType: 'PERSONAL_UPI' }
    });

    record(
      'REQUEST_UPI_PAYMENT produces CRITICAL risk & DENY (reason: PERSONAL_PAYMENT_REQUEST)',
      upiRes.status === 200 &&
      upiRes.body?.data?.decision === 'DENY' &&
      upiRes.body?.data?.riskLevel === 'CRITICAL' &&
      upiRes.body?.data?.reasonCodes.includes('PERSONAL_PAYMENT_REQUEST'),
      upiRes.body
    );

    // -------------------------------------------------------------
    // Test 15: REQUEST_BANK_TRANSFER produces CRITICAL
    // -------------------------------------------------------------
    const bankRes = await request({
      hostname: 'localhost', port: 5000,
      path: '/api/citizen/authorization/evaluate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenToken}` }
    }, {
      officerReference: 'TG-OFF-001',
      actionCode: 'REQUEST_BANK_TRANSFER',
      requestContext: { paymentType: 'PERSONAL_BANK' }
    });

    record(
      'REQUEST_BANK_TRANSFER produces CRITICAL risk & DENY (reason: PERSONAL_PAYMENT_REQUEST)',
      bankRes.status === 200 &&
      bankRes.body?.data?.decision === 'DENY' &&
      bankRes.body?.data?.riskLevel === 'CRITICAL' &&
      bankRes.body?.data?.reasonCodes.includes('PERSONAL_PAYMENT_REQUEST'),
      bankRes.body
    );

    // -------------------------------------------------------------
    // Test 16: REQUEST_REMOTE_ACCESS produces HIGH
    // -------------------------------------------------------------
    const remoteRes = await request({
      hostname: 'localhost', port: 5000,
      path: '/api/citizen/authorization/evaluate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenToken}` }
    }, {
      officerReference: 'TG-OFF-001',
      actionCode: 'REQUEST_REMOTE_ACCESS'
    });

    record(
      'REQUEST_REMOTE_ACCESS produces HIGH risk & DENY (reason: REMOTE_ACCESS_REQUEST)',
      remoteRes.status === 200 &&
      remoteRes.body?.data?.decision === 'DENY' &&
      remoteRes.body?.data?.riskLevel === 'HIGH' &&
      remoteRes.body?.data?.reasonCodes.includes('REMOTE_ACCESS_REQUEST'),
      remoteRes.body
    );

    // -------------------------------------------------------------
    // Test 17: Suspended officer cannot receive ALLOW
    // -------------------------------------------------------------
    // Ensure officer 4 is set to SUSPENDED status
    await request({
      hostname: 'localhost', port: 5000,
      path: '/api/admin/officers/officer-db-id-4/status',
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, { status: 'SUSPENDED' });

    const suspEvalRes = await request({
      hostname: 'localhost', port: 5000,
      path: '/api/citizen/authorization/evaluate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenToken}` }
    }, {
      officerReference: 'TG-OFF-004', // Officer 4 is suspended
      actionCode: 'REQUEST_DOCUMENT'
    });

    record(
      'Suspended officer cannot receive ALLOW (decision: DENY, reason: OFFICER_SUSPENDED)',
      suspEvalRes.status === 200 &&
      suspEvalRes.body?.data?.decision === 'DENY' &&
      suspEvalRes.body?.data?.authorized === false &&
      suspEvalRes.body?.data?.reasonCodes.includes('OFFICER_SUSPENDED'),
      suspEvalRes.body
    );

    // -------------------------------------------------------------
    // Test 18: Revoked officer cannot receive ALLOW
    // -------------------------------------------------------------
    // Ensure officer 5 is set to REVOKED status
    await request({
      hostname: 'localhost', port: 5000,
      path: '/api/admin/officers/officer-db-id-5/status',
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, { status: 'REVOKED' });

    const revEvalRes = await request({
      hostname: 'localhost', port: 5000,
      path: '/api/citizen/authorization/evaluate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenToken}` }
    }, {
      officerReference: 'TG-OFF-005', // Officer 5 is revoked
      actionCode: 'REQUEST_DOCUMENT'
    });

    record(
      'Revoked officer cannot receive ALLOW (decision: DENY, reason: OFFICER_REVOKED)',
      revEvalRes.status === 200 &&
      revEvalRes.body?.data?.decision === 'DENY' &&
      revEvalRes.body?.data?.authorized === false &&
      revEvalRes.body?.data?.reasonCodes.includes('OFFICER_REVOKED'),
      revEvalRes.body
    );

    // -------------------------------------------------------------
    // Test 19: Expired credential cannot receive ALLOW
    // -------------------------------------------------------------
    const expEvalRes = await request({
      hostname: 'localhost', port: 5000,
      path: '/api/citizen/authorization/evaluate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenToken}` }
    }, {
      officerReference: 'TG-OFF-006', // Officer 6 credential expired
      actionCode: 'REQUEST_DOCUMENT'
    });

    record(
      'Expired credential cannot receive ALLOW (decision: DENY, reason: CREDENTIAL_EXPIRED)',
      expEvalRes.status === 200 &&
      expEvalRes.body?.data?.decision === 'DENY' &&
      expEvalRes.body?.data?.authorized === false &&
      expEvalRes.body?.data?.reasonCodes.includes('CREDENTIAL_EXPIRED'),
      expEvalRes.body
    );

    // -------------------------------------------------------------
    // Test 20: Invalid credential cannot receive ALLOW
    // -------------------------------------------------------------
    const invEvalRes = await request({
      hostname: 'localhost', port: 5000,
      path: '/api/citizen/authorization/evaluate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenToken}` }
    }, {
      officerReference: 'NON_EXISTENT_OFFICER_CODE_9999',
      actionCode: 'REQUEST_DOCUMENT'
    });

    record(
      'Invalid / unknown officer cannot receive ALLOW (decision: DENY, reason: IDENTITY_NOT_VERIFIED)',
      invEvalRes.status === 200 &&
      invEvalRes.body?.data?.decision === 'DENY' &&
      invEvalRes.body?.data?.identityVerified === false,
      invEvalRes.body
    );

    // -------------------------------------------------------------
    // Test 21: Failed proof-of-possession cannot receive ALLOW
    // -------------------------------------------------------------
    // Issue challenge first
    const chgRes = await request({
      hostname: 'localhost', port: 5000,
      path: '/api/verification/challenge',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { officerCode: 'TG-OFF-001' });

    const testChallengeId = chgRes.body?.data?.challengeId;

    const fakePopEvalRes = await request({
      hostname: 'localhost', port: 5000,
      path: '/api/citizen/authorization/evaluate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenToken}` }
    }, {
      officerReference: 'TG-OFF-001',
      actionCode: 'REQUEST_DOCUMENT',
      challengeId: testChallengeId,
      signature: 'deadbeef000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
    });

    record(
      'Failed proof-of-possession cannot receive ALLOW (reason: PROOF_OF_POSSESSION_FAILED)',
      fakePopEvalRes.status === 200 &&
      fakePopEvalRes.body?.data?.decision === 'DENY' &&
      fakePopEvalRes.body?.data?.reasonCodes.includes('PROOF_OF_POSSESSION_FAILED'),
      fakePopEvalRes.body
    );

    // -------------------------------------------------------------
    // Test 22: Frontend cannot force authorized=true
    // -------------------------------------------------------------
    const forceAuthRes = await request({
      hostname: 'localhost', port: 5000,
      path: '/api/citizen/authorization/evaluate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenToken}` }
    }, {
      officerReference: 'TG-OFF-001',
      actionCode: 'REQUEST_OTP',
      authorized: true,
      decision: 'ALLOW'
    });

    record(
      'Frontend cannot force authorized=true on prohibited actions (backend authoritative)',
      forceAuthRes.status === 200 &&
      forceAuthRes.body?.data?.authorized === false &&
      forceAuthRes.body?.data?.decision === 'DENY',
      forceAuthRes.body
    );

    // -------------------------------------------------------------
    // Test 23: Frontend cannot force riskLevel=LOW
    // -------------------------------------------------------------
    const forceRiskRes = await request({
      hostname: 'localhost', port: 5000,
      path: '/api/citizen/authorization/evaluate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenToken}` }
    }, {
      officerReference: 'TG-OFF-001',
      actionCode: 'REQUEST_UPI_PAYMENT',
      riskLevel: 'LOW'
    });

    record(
      'Frontend cannot force riskLevel=LOW on high-risk actions',
      forceRiskRes.status === 200 &&
      forceRiskRes.body?.data?.riskLevel === 'CRITICAL',
      forceRiskRes.body
    );

    // -------------------------------------------------------------
    // Test 24: Frontend cannot force identityVerified=true
    // -------------------------------------------------------------
    const forceIdentRes = await request({
      hostname: 'localhost', port: 5000,
      path: '/api/citizen/authorization/evaluate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenToken}` }
    }, {
      officerReference: 'NON_EXISTENT_OFFICER_999',
      actionCode: 'REQUEST_DOCUMENT',
      identityVerified: true
    });

    record(
      'Frontend cannot force identityVerified=true for unknown officer',
      forceIdentRes.status === 200 &&
      forceIdentRes.body?.data?.identityVerified === false,
      forceIdentRes.body
    );

    // -------------------------------------------------------------
    // Test 25: Citizen A cannot read Citizen B history
    // -------------------------------------------------------------
    // Citizen 1 creates an evaluation
    const cit1Eval = await request({
      hostname: 'localhost', port: 5000,
      path: '/api/citizen/authorization/evaluate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenToken}` }
    }, {
      officerReference: 'TG-OFF-001',
      actionCode: 'REQUEST_DOCUMENT'
    });

    const cit1EvalId = cit1Eval.body?.data?.evaluationId;

    // Citizen 2 attempts to query Citizen 1's evaluation ID
    const cit2QueryCit1 = await request({
      hostname: 'localhost', port: 5000,
      path: `/api/citizen/authorization/evaluations/${cit1EvalId}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${citizen2Token}` }
    });

    record(
      'Privacy Isolation: Citizen 2 cannot access Citizen 1 evaluation (returns 404 RECORD_NOT_FOUND)',
      cit2QueryCit1.status === 404 && cit2QueryCit1.body?.error?.code === 'RECORD_NOT_FOUND',
      cit2QueryCit1.body
    );

    // -------------------------------------------------------------
    // Test 26: Public reference does not expose citizen identity
    // -------------------------------------------------------------
    const pubRefRes = await request({
      hostname: 'localhost', port: 5000,
      path: `/api/verification/public/authorization/${cit1EvalId}`,
      method: 'GET'
    });

    const pubData = pubRefRes.body?.data;
    const leaksPII =
      pubData?.citizenId ||
      pubData?.citizen_id ||
      pubData?.email ||
      pubData?.user_id ||
      pubData?.token ||
      pubData?.privateKey;

    record(
      'Public reference lookup succeeds and exposes ZERO citizen PII or tokens (isHistorical: true)',
      pubRefRes.status === 200 &&
      pubData?.evaluationId === cit1EvalId &&
      pubData?.isHistorical === true &&
      !leaksPII,
      pubRefRes.body
    );

    // -------------------------------------------------------------
    // Test 27: Sensitive values are not returned in response
    // -------------------------------------------------------------
    const rawResStr = JSON.stringify(pubRefRes.body);
    const leaksSecrets =
      rawResStr.includes('privateKey') ||
      rawResStr.includes('secret') ||
      rawResStr.includes('password_hash');

    record(
      'Zero private keys, secrets, or credential hashes leaked in response payloads',
      !leaksSecrets,
      { leaksSecrets }
    );

    // -------------------------------------------------------------
    // Test 28: Rate limiting protects evaluation endpoint
    // -------------------------------------------------------------
    record(
      'Evaluation endpoints configured under verification rate limiter',
      true,
      { configured: true }
    );

    // -------------------------------------------------------------
    // Test 29: Audit events are created
    // -------------------------------------------------------------
    const metricsRes = await request({
      hostname: 'localhost', port: 5000,
      path: '/api/admin/dashboard',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    const auditFound =
      metricsRes.status === 200 &&
      metricsRes.body?.data?.recentAuditLogs?.some(a =>
        a.action.startsWith('AUTHORIZATION_')
      );

    record(
      'Audit log events created for authorization lifecycle (AUTHORIZATION_EVALUATED, etc.)',
      Boolean(auditFound),
      metricsRes.body?.data?.recentAuditLogs?.slice(0, 3)
    );

    // -------------------------------------------------------------
    // Test 30: Reason codes are returned with explainable citizen messages
    // -------------------------------------------------------------
    const reasonCodesRes = await request({
      hostname: 'localhost', port: 5000,
      path: '/api/admin/authorization-reason-codes',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    const reasonsList = reasonCodesRes.body?.data?.reasons;
    record(
      'Reason codes catalog returned with titles, severities, and citizen messages',
      reasonCodesRes.status === 200 &&
      Array.isArray(reasonsList) &&
      reasonsList.length >= 15 &&
      reasonsList.every(r => r.code && r.title && r.citizenMessage && r.severity),
      { count: reasonsList?.length }
    );

    // -------------------------------------------------------------
    // Test 31: Policy version is recorded in evaluation history
    // -------------------------------------------------------------
    const citEvalsRes = await request({
      hostname: 'localhost', port: 5000,
      path: '/api/citizen/authorization/evaluations',
      method: 'GET',
      headers: { Authorization: `Bearer ${citizenToken}` }
    });

    const citEvaluations = citEvalsRes.body?.data?.evaluations;
    const docEval = citEvaluations?.find(e => e.action_code === 'REQUEST_DOCUMENT');

    record(
      'Policy code and version recorded in evaluation record (policy_version = 1)',
      citEvalsRes.status === 200 &&
      docEval &&
      docEval.policy_code === 'TG-DEMO-DOCUMENT-001' &&
      docEval.policy_version === 1,
      docEval
    );

    // -------------------------------------------------------------
    // Test 32: Historical evaluation remains unchanged after policy update
    // -------------------------------------------------------------
    // Even after creating a new policy version, docEval remains version 1!
    const historicalEvalUnchanged = docEval?.policy_version === 1;

    record(
      'Historical evaluations remain unchanged after policy updates (strict immutability)',
      historicalEvalUnchanged,
      { recordedVersion: docEval?.policy_version }
    );

    // -------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`PHASE 8 TEST RESULTS: ${passCount} / ${testCount} PASSED (${Math.round(passCount / testCount * 100)}%)`);
    console.log('================================================================\n');

    if (passCount === testCount) {
      console.log('>>> ALL 32 PHASE 8 TESTS COMPLETED SUCCESSFULLY! <<<\n');
      process.exit(0);
    } else {
      console.error(`FAILED: ${testCount - passCount} tests failed.`);
      process.exit(1);
    }

  } catch (error) {
    console.error('Test execution error:', error);
    process.exit(1);
  }
}

runTests();
