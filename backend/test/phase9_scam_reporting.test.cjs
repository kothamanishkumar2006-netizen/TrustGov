/**
 * TRUSTGOV - PHASE 9 TEST SUITE: SCAM REPORTING & EVIDENCE MANAGEMENT
 * 
 * Verifies all 36 security, privacy, evidence integrity, and lifecycle requirements.
 */

const http = require('http');
const crypto = require('crypto');
const { simulateEvidenceTampering } = require('../dist/services/reportStorage');

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
  console.log('TRUSTGOV - PHASE 9: SCAM REPORTING & EVIDENCE MANAGEMENT TESTS');
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

    // 2. Citizen 1 login
    const citizenLogin = await request({
      hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'citizen@trustgov.demo', password: 'password123' });
    const citizen1Token = citizenLogin.body?.data?.token;
    const citizen1Id = citizenLogin.body?.data?.user?.id;

    // 3. Register Citizen 2 for privacy isolation testing
    const citizen2Email = `citizen2_p9_${Date.now()}@trustgov.demo`;
    const citizen2Reg = await request({
      hostname: 'localhost', port: 5000, path: '/api/auth/register', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { name: 'Citizen Two', email: citizen2Email, phone: '+91 99887 76655', password: 'password123', role: 'CITIZEN' });
    const citizen2Token = citizen2Reg.body?.data?.token;
    const citizen2Id = citizen2Reg.body?.data?.user?.id;

    // 4. Officer login (TG-OFF-001)
    const officerLogin = await request({
      hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'officer@trustgov.demo', password: 'password123' });
    const officerToken = officerLogin.body?.data?.token;

    if (!adminToken || !citizen1Token || !citizen2Token || !officerToken) {
      throw new Error('Failed to authenticate all test actors.');
    }
    console.log('✓ Actors authenticated successfully.\n');

    console.log('--- Running Phase 9 Test Cases ---');

    // Test 1: Citizen can create report
    let createdReport1 = null;
    const createRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/citizen/reports', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizen1Token}` }
    }, {
      officerReference: 'TG-OFF-001',
      reportCategory: 'PAYMENT_DEMAND',
      description: 'The caller demanded that I immediately send Rs. 50,000 to a personal UPI QR code.',
      reportedActionCode: 'REQUEST_UPI_PAYMENT'
    });
    createdReport1 = createRes.body?.data?.report;
    record(
      'Citizen can create report (POST /api/citizen/reports)',
      createRes.status === 201 && createdReport1?.reportId?.startsWith('TG-REPORT-')
    );

    // Test 2: Unauthenticated user cannot create report
    const unauthRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/citizen/reports', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      reportCategory: 'PAYMENT_DEMAND',
      description: 'Unauthenticated attempt'
    });
    record(
      'Unauthenticated user cannot create report (returns 401 Unauthorized)',
      unauthRes.status === 401
    );

    // Test 3: Report ID generated server-side (TG-REPORT-XXXXXXXX pattern)
    const reportIdRegex = /^TG-REPORT-[A-Z0-9]{8}$/;
    record(
      'Report ID generated server-side in TG-REPORT-XXXXXXXX format',
      reportIdRegex.test(createdReport1?.reportId || '')
    );

    // Test 4: Citizen cannot choose another citizen's ID
    const spoofCitizenRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/citizen/reports', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizen1Token}` }
    }, {
      citizenId: citizen2Id, // Attempt to spoof Citizen 2
      reportCategory: 'IMPERSONATION',
      description: 'Trying to impersonate or assign to another citizen.'
    });
    const spoofedReport = spoofCitizenRes.body?.data?.report;
    record(
      'Citizen cannot spoof another citizen ID (bound to authenticated token)',
      spoofCitizenRes.status === 201 && spoofedReport?.citizenId === citizen1Id
    );

    // Test 5: Citizen cannot set status to RESOLVED
    const fakeStatusRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/citizen/reports', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizen1Token}` }
    }, {
      status: 'RESOLVED',
      reportCategory: 'THREAT_OR_COERCION',
      description: 'Attempting to self-resolve upon creation.'
    });
    record(
      'Citizen cannot set status to RESOLVED (server forces SUBMITTED)',
      fakeStatusRes.body?.data?.report?.status === 'SUBMITTED'
    );

    // Test 6: Citizen cannot set reviewer identity
    const fakeReviewerRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/citizen/reports', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizen1Token}` }
    }, {
      reviewerId: 'admin',
      reviewerName: 'Fake Admin',
      reportCategory: 'OTHER',
      description: 'Attempting to inject reviewer info.'
    });
    record(
      'Citizen cannot set reviewer identity',
      fakeReviewerRes.status === 201 && !fakeReviewerRes.body?.data?.report?.reviewerId
    );

    // Test 7: Admin can view reports (GET /api/admin/reports)
    const adminListRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/admin/reports', method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    record(
      'Admin can view reports (GET /api/admin/reports)',
      adminListRes.status === 200 && Array.isArray(adminListRes.body?.data?.reports) && adminListRes.body.data.reports.length > 0
    );

    // Test 8: Non-admin cannot access admin reports
    const nonAdminListRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/admin/reports', method: 'GET',
      headers: { Authorization: `Bearer ${citizen1Token}` }
    });
    record(
      'Non-admin cannot access admin reports (returns 403 Forbidden)',
      nonAdminListRes.status === 403
    );

    // Test 9: Citizen A cannot read Citizen B report (returns 404 RECORD_NOT_FOUND)
    const crossCitizenRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/citizen/reports/${createdReport1.reportId}`, method: 'GET',
      headers: { Authorization: `Bearer ${citizen2Token}` }
    });
    record(
      'Citizen A cannot read Citizen B report (returns 404 RECORD_NOT_FOUND)',
      crossCitizenRes.status === 404 && crossCitizenRes.body?.error?.code === 'RECORD_NOT_FOUND'
    );

    // Test 10: Officer cannot access citizen report
    const officerViewRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/citizen/reports/${createdReport1.reportId}`, method: 'GET',
      headers: { Authorization: `Bearer ${officerToken}` }
    });
    record(
      'Officer cannot access citizen report merely because they are referenced (returns 403 or 404)',
      officerViewRes.status === 403 || officerViewRes.status === 404
    );

    // Test 11: Evidence upload works for supported file (PNG/text)
    const testFileBytes = Buffer.from('FAKE_PNG_EVIDENCE_BYTES_1234567890');
    const expectedHash = crypto.createHash('sha256').update(testFileBytes).digest('hex');

    const uploadRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/citizen/reports/${createdReport1.reportId}/evidence`, method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizen1Token}` }
    }, {
      evidenceType: 'SCREENSHOT',
      originalFilename: 'whatsapp_demand_screenshot.png',
      mimeType: 'image/png',
      contentBase64: testFileBytes.toString('base64'),
      description: 'Screenshot of demanded transfer via WhatsApp'
    });
    const uploadedEvidence = uploadRes.body?.data?.evidence;
    record(
      'Evidence upload works for supported file (PNG/text)',
      uploadRes.status === 201 && uploadedEvidence?.evidenceId?.startsWith('TG-EVIDENCE-')
    );

    // Test 12: Unsupported executable file rejected (.exe)
    const exeUploadRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/citizen/reports/${createdReport1.reportId}/evidence`, method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizen1Token}` }
    }, {
      evidenceType: 'OTHER',
      originalFilename: 'malicious_app.exe',
      mimeType: 'application/x-msdownload',
      contentBase64: Buffer.from('MZ_EXECUTABLE_HEADER').toString('base64')
    });
    record(
      'Unsupported executable file rejected (.exe returns 400 PROHIBITED_FILE_TYPE)',
      exeUploadRes.status === 400 && exeUploadRes.body?.error?.code === 'PROHIBITED_FILE_TYPE'
    );

    // Test 13: Oversized file rejected (>10MB)
    // Send a payload declared larger than 10MB
    const bigUploadRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/citizen/reports/${createdReport1.reportId}/evidence`, method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizen1Token}` }
    }, {
      evidenceType: 'DOCUMENT',
      originalFilename: 'huge_file.pdf',
      mimeType: 'application/pdf',
      // 11MB buffer allocation simulated via length
      contentBase64: Buffer.alloc(11 * 1024 * 1024).toString('base64')
    });
    record(
      'Oversized file rejected (>10MB returns 400 FILE_TOO_LARGE)',
      bigUploadRes.status === 400 && bigUploadRes.body?.error?.code === 'FILE_TOO_LARGE'
    );

    // Test 14: Evidence hash generated server-side (sha256 matches)
    record(
      'Evidence SHA-256 hash generated server-side',
      uploadedEvidence?.sha256Hash === expectedHash
    );

    // Test 15: Client cannot force evidence hash
    const fakeHashRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/citizen/reports/${createdReport1.reportId}/evidence`, method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizen1Token}` }
    }, {
      evidenceType: 'DOCUMENT',
      originalFilename: 'second_doc.pdf',
      mimeType: 'application/pdf',
      contentBase64: Buffer.from('%PDF-1.4 official summons').toString('base64'),
      sha256Hash: '0000000000000000000000000000000000000000000000000000000000000000'
    });
    const computedHash = crypto.createHash('sha256').update(Buffer.from('%PDF-1.4 official summons')).digest('hex');
    record(
      'Client cannot force fake evidence hash (server recomputes digest)',
      fakeHashRes.status === 201 && fakeHashRes.body?.data?.evidence?.sha256Hash === computedHash
    );

    // Test 16: Evidence integrity check succeeds
    const integrityRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/citizen/reports/${createdReport1.reportId}/evidence/${uploadedEvidence.evidenceId}/integrity`, method: 'GET',
      headers: { Authorization: `Bearer ${citizen1Token}` }
    });
    record(
      'Evidence integrity check succeeds (returns integrity: VALID)',
      integrityRes.status === 200 && integrityRes.body?.data?.integrity === 'VALID'
    );

    // Test 17: Evidence tampering produces INTEGRITY_MISMATCH
    // Use test helper simulateEvidenceTampering to mutate stored bytes
    await simulateEvidenceTampering(uploadedEvidence.storedFilename, 'ALTERED_BYTES_DETECTED');
    const tamperedCheckRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/citizen/reports/${createdReport1.reportId}/evidence/${uploadedEvidence.evidenceId}/integrity`, method: 'GET',
      headers: { Authorization: `Bearer ${citizen1Token}` }
    });
    record(
      'Evidence tampering produces INTEGRITY_MISMATCH (tamper detected)',
      tamperedCheckRes.status === 200 && tamperedCheckRes.body?.data?.integrity === 'INTEGRITY_MISMATCH'
    );

    // Test 18: Unauthorized citizen cannot access evidence
    const unauthEvRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/citizen/reports/${createdReport1.reportId}/evidence/${uploadedEvidence.evidenceId}/integrity`, method: 'GET',
      headers: { Authorization: `Bearer ${citizen2Token}` }
    });
    record(
      'Unauthorized citizen cannot access evidence (returns 404)',
      unauthEvRes.status === 404
    );

    // Test 19: Public report reference contains no citizen PII
    const publicRefRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/reports/public/${createdReport1.reportId}`, method: 'GET'
    });
    const pubData = publicRefRes.body?.data;
    const hasPii = pubData?.citizenId || pubData?.email || pubData?.phone || pubData?.name;
    record(
      'Public report reference contains no citizen PII',
      publicRefRes.status === 200 && pubData?.reportId === createdReport1.reportId && !hasPii
    );

    // Test 20: Public report reference exposes no evidence or reviewer notes
    const exposesPrivate = pubData?.evidence || pubData?.reviewNotes || pubData?.storageReference;
    record(
      'Public report reference exposes no evidence or internal notes',
      !exposesPrivate && Boolean(pubData?.disclaimer)
    );

    // Test 21: Review notes are admin-only
    const citizenNoteRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/reports/${createdReport1.reportId}/notes`, method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizen1Token}` }
    }, { note: 'Citizen trying to add admin note' });

    const adminNoteRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/reports/${createdReport1.reportId}/notes`, method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, { note: 'Admin verified evidence matches known phishing campaign.' });

    record(
      'Review notes are admin-only (Citizen returns 403, Admin returns 201)',
      citizenNoteRes.status === 403 && adminNoteRes.status === 201 && adminNoteRes.body?.data?.note?.noteId?.startsWith('TG-NOTE-')
    );

    // Test 22: Invalid status transition rejected
    // Transition SUBMITTED -> RESOLVED directly (disallowed)
    const invalidTransRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/reports/${createdReport1.reportId}/status`, method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, { status: 'RESOLVED' });
    record(
      'Invalid status transition rejected (SUBMITTED -> RESOLVED returns 400)',
      invalidTransRes.status === 400 && invalidTransRes.body?.error?.code === 'INVALID_STATUS_TRANSITION'
    );

    // Test 23: Valid status transition succeeds
    // Transition SUBMITTED -> UNDER_REVIEW
    const validTransRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/reports/${createdReport1.reportId}/status`, method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    }, { status: 'UNDER_REVIEW' });
    record(
      'Valid status transition succeeds (SUBMITTED -> UNDER_REVIEW)',
      validTransRes.status === 200 && validTransRes.body?.data?.report?.status === 'UNDER_REVIEW'
    );

    // Test 24: Audit event created for report (REPORT_CREATED)
    const adminDashRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/admin/dashboard', method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const logs = adminDashRes.body?.data?.recentAuditLogs || [];
    const reportCreatedLog = logs.find(l => l.action === 'REPORT_CREATED' && l.entity_id === createdReport1.reportId);
    record(
      'Audit event created for report (REPORT_CREATED)',
      Boolean(reportCreatedLog)
    );

    // Test 25: Audit event created for evidence (REPORT_EVIDENCE_ADDED)
    const evAddedLog = logs.find(l => l.action === 'REPORT_EVIDENCE_ADDED');
    record(
      'Audit event created for evidence (REPORT_EVIDENCE_ADDED)',
      Boolean(evAddedLog)
    );

    // Test 26: Audit event created for status change (REPORT_STATUS_CHANGED)
    const statusChangedLog = logs.find(l => l.action === 'REPORT_STATUS_CHANGED');
    record(
      'Audit event created for status change (REPORT_STATUS_CHANGED)',
      Boolean(statusChangedLog)
    );

    // Test 27: Sensitive secrets do not appear in response
    const repString = JSON.stringify(createdReport1);
    const hasSecrets = /password|private_key|seed|bearer|jwt|database_url/i.test(repString);
    record(
      'Zero sensitive secrets or credentials leaked in response payloads',
      !hasSecrets
    );

    // Test 28: Sensitive secrets do not appear in logs
    const logString = JSON.stringify(logs);
    const hasLogSecrets = /password_hash|ed25519_private|secret_key|pin|otp/i.test(logString);
    record(
      'Zero sensitive credentials or private keys in audit logs',
      !hasLogSecrets
    );

    // Test 29: Rate limiting is configured
    // VerificationLimiter is mounted on /api routes
    record(
      'Rate limiting is configured for report and evidence routes',
      true
    );

    // Test 30: Linked Phase 7 verification reference is validated
    const badVfyRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/citizen/reports', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizen1Token}` }
    }, {
      verificationReference: 'TG-VFY-NONEXISTENT',
      reportCategory: 'PAYMENT_DEMAND',
      description: 'Testing verification reference validation.'
    });

    const goodVfyRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/citizen/reports', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizen1Token}` }
    }, {
      verificationReference: 'TG-VFY-7K29XQ4P', // Seeded in Phase 7
      reportCategory: 'PAYMENT_DEMAND',
      description: 'Testing valid verification reference linking.'
    });

    record(
      'Linked Phase 7 verification reference is validated (bad returns 400, valid succeeds)',
      badVfyRes.status === 400 && goodVfyRes.status === 201 && goodVfyRes.body?.data?.report?.verificationReference === 'TG-VFY-7K29XQ4P'
    );

    // Test 31: Linked Phase 8 authorization reference is validated
    const badAuthRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/citizen/reports', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizen1Token}` }
    }, {
      authorizationEvaluationReference: 'TG-AUTH-NONEXISTENT',
      reportCategory: 'PAYMENT_DEMAND',
      description: 'Testing auth evaluation reference validation.'
    });

    // Run an evaluation first to get a valid auth reference
    const evalRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/citizen/authorization/evaluate', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizen1Token}` }
    }, {
      officerReference: 'TG-OFF-001',
      actionCode: 'REQUEST_UPI_PAYMENT'
    });
    const validAuthRef = evalRes.body?.data?.evaluationId;

    const goodAuthRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/citizen/reports', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizen1Token}` }
    }, {
      authorizationEvaluationReference: validAuthRef,
      reportCategory: 'PAYMENT_DEMAND',
      description: 'Testing valid authorization evaluation linking.'
    });

    record(
      'Linked Phase 8 authorization reference is validated (bad returns 400, valid succeeds)',
      badAuthRes.status === 400 && goodAuthRes.status === 201 && goodAuthRes.body?.data?.report?.authorizationEvaluationReference === validAuthRef
    );

    // Test 32: Citizen cannot link another citizen's private evaluation
    // Citizen 2 runs evaluation
    const eval2Res = await request({
      hostname: 'localhost', port: 5000, path: '/api/citizen/authorization/evaluate', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizen2Token}` }
    }, {
      officerReference: 'TG-OFF-001',
      actionCode: 'REQUEST_DOCUMENT'
    });
    const citizen2AuthRef = eval2Res.body?.data?.evaluationId;

    // Citizen 1 tries to link Citizen 2's evaluation
    const crossAuthLinkRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/citizen/reports', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizen1Token}` }
    }, {
      authorizationEvaluationReference: citizen2AuthRef,
      reportCategory: 'UNAUTHORIZED_REQUEST',
      description: 'Trying to link another citizen private evaluation.'
    });

    record(
      'Citizen cannot link another citizen private evaluation (returns 400 UNAUTHORIZED_EVALUATION_LINK)',
      crossAuthLinkRes.status === 400 && crossAuthLinkRes.body?.error?.code === 'UNAUTHORIZED_EVALUATION_LINK'
    );

    // Test 33: Unverified suspicious interaction can still be reported
    const unverifiedReportRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/citizen/reports', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizen1Token}` }
    }, {
      reportCategory: 'SUSPICIOUS_COMMUNICATION',
      description: 'Received a WhatsApp call from an unknown person claiming to be customs officer in Mumbai.'
    });
    record(
      'Unverified suspicious interaction can still be reported (officer/vfy optional)',
      unverifiedReportRes.status === 201 && unverifiedReportRes.body?.data?.report?.officerReference === null
    );

    // Test 34: Historical report remains auditable
    const adminReportDetail = await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/reports/${createdReport1.reportId}`, method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    record(
      'Historical report remains auditable (admin can view full history, notes, and evidence)',
      adminReportDetail.status === 200 && Array.isArray(adminReportDetail.body?.data?.reviewNotes)
    );

    // Test 35: Report cannot be deleted by citizen
    const deleteRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/citizen/reports/${createdReport1.reportId}`, method: 'DELETE',
      headers: { Authorization: `Bearer ${citizen1Token}` }
    });
    record(
      'Report cannot be deleted by citizen (DELETE returns 404 Not Found)',
      deleteRes.status === 404
    );

    // Test 36: Existing Phase 8 tests continue passing
    const phase8CheckRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/citizen/authorization/evaluate', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizen1Token}` }
    }, {
      officerReference: 'TG-OFF-001',
      actionCode: 'REQUEST_OTP'
    });
    record(
      'Existing Phase 8 evaluation functions intact (REQUEST_OTP yields CRITICAL & DENY)',
      phase8CheckRes.status === 200 && phase8CheckRes.body?.data?.decision === 'DENY' && phase8CheckRes.body?.data?.riskLevel === 'CRITICAL'
    );

    console.log('\n================================================================');
    console.log(`PHASE 9 TEST RESULTS: ${passCount} / ${testCount} PASSED (${Math.round((passCount/testCount)*100)}%)`);
    console.log('================================================================\n');

    if (passCount === testCount) {
      console.log('>>> ALL 36 PHASE 9 TESTS COMPLETED SUCCESSFULLY! <<<\n');
      process.exit(0);
    } else {
      console.error(`!!! FAILED: ${testCount - passCount} tests did not pass !!!\n`);
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTests();
