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
  console.log('Starting Phase 2 Government Officer Management Test Suite...\n');
  const results = [];
  let testCount = 0;
  let passCount = 0;

  function record(name, pass, details = {}) {
    testCount++;
    if (pass) passCount++;
    results.push({ testId: testCount, name, pass, ...details });
    console.log(`[${pass ? 'PASS' : 'FAIL'}] Test ${testCount}: ${name}`);
    if (!pass && details.error) console.error('   Error:', details.error);
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

    // 1. Admin can list officers
    const listRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/admin/officers', method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    record('Admin can list officers (GET /api/admin/officers)',
      listRes.status === 200 && Array.isArray(listRes.body?.data?.officers) && listRes.body.data.officers.length > 0,
      { count: listRes.body?.data?.officers?.length }
    );

    // 2. Admin can create officer
    const newOfficerCode = `TG-TEST-${Date.now().toString().slice(-4)}`;
    const newOfficerEmail = `test.officer.${Date.now()}@agency.gov`;
    const createRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/admin/officers', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, {
      full_name: 'Test Officer Vikram Malhotra',
      officer_code: newOfficerCode,
      department: 'Central Investigation Bureau',
      designation: 'Special Agent in Charge',
      jurisdiction: 'Western Division HQ',
      official_email: newOfficerEmail,
      official_phone: '+91 98765 11223',
      status: 'ACTIVE'
    });
    const createdOfficer = createRes.body?.data?.officer;
    record('Admin can create officer (POST /api/admin/officers)',
      createRes.status === 201 && createdOfficer?.officer_code === newOfficerCode,
      { officerId: createdOfficer?.id }
    );

    const createdId = createdOfficer?.id;

    // 3. Admin can view officer (including Phase 3 placeholders)
    const getRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/officers/${createdId}`, method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const viewData = getRes.body?.data?.officer;
    record('Admin can view officer details with Phase 3 placeholders',
      getRes.status === 200 && 
      viewData?.officer_code === newOfficerCode &&
      viewData?.placeholders?.did === 'Not issued yet' &&
      viewData?.placeholders?.credential === 'Not issued yet' &&
      viewData?.placeholders?.blockchain === 'Not registered yet',
      { placeholders: viewData?.placeholders }
    );

    // 4. Admin can update officer
    const updateRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/officers/${createdId}`, method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, {
      full_name: 'Vikram Malhotra Senior',
      department: 'Cyber Crime Division',
      designation: 'Chief Cyber Inspector',
      jurisdiction: 'National Cyber Security Center',
      official_phone: '+91 98765 99999'
    });
    record('Admin can update officer (PUT /api/admin/officers/:id)',
      updateRes.status === 200 && updateRes.body?.data?.officer?.department === 'Cyber Crime Division',
      { updatedDept: updateRes.body?.data?.officer?.department }
    );

    // 5. Admin can suspend officer
    const suspendRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/officers/${createdId}/status`, method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, { status: 'SUSPENDED' });
    record('Admin can suspend officer (PATCH /api/admin/officers/:id/status -> SUSPENDED)',
      suspendRes.status === 200 && suspendRes.body?.data?.officer?.status === 'SUSPENDED',
      { status: suspendRes.body?.data?.officer?.status }
    );

    // 6. Admin can activate officer
    const activateRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/officers/${createdId}/status`, method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, { status: 'ACTIVE' });
    record('Admin can activate officer (PATCH /api/admin/officers/:id/status -> ACTIVE)',
      activateRes.status === 200 && activateRes.body?.data?.officer?.status === 'ACTIVE',
      { status: activateRes.body?.data?.officer?.status }
    );

    // 7. Admin can revoke officer
    const revokeRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/officers/${createdId}/status`, method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, { status: 'REVOKED' });
    record('Admin can revoke officer (PATCH /api/admin/officers/:id/status -> REVOKED)',
      revokeRes.status === 200 && revokeRes.body?.data?.officer?.status === 'REVOKED',
      { status: revokeRes.body?.data?.officer?.status }
    );

    // 8. Duplicate officer code is rejected (409)
    const dupRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/admin/officers', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, {
      full_name: 'Another Officer',
      officer_code: newOfficerCode, // duplicate!
      department: 'Police Department',
      designation: 'Inspector',
      jurisdiction: 'Zone 1',
      official_email: `another.${Date.now()}@agency.gov`,
      official_phone: '+91 99999 88888',
      status: 'ACTIVE'
    });
    record('Duplicate officer code is rejected with 409 Conflict',
      dupRes.status === 409 && dupRes.body?.error?.code === 'DUPLICATE_OFFICER_CODE',
      { statusCode: dupRes.status, code: dupRes.body?.error?.code }
    );

    // 9. Invalid input is rejected (400)
    const invalidRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/admin/officers', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, {
      full_name: 'X', // too short (< 2)
      officer_code: 'TG', // too short (< 3)
      official_email: 'not-an-email'
    });
    record('Invalid input is rejected with 400 Bad Request',
      invalidRes.status === 400 && invalidRes.body?.error?.code === 'VALIDATION_ERROR',
      { statusCode: invalidRes.status, error: invalidRes.body?.error?.message }
    );

    // 10. Citizen cannot manage officers (403)
    const citizenAccessRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/admin/officers', method: 'GET',
      headers: { 'Authorization': `Bearer ${citizenToken}` }
    });
    record('Citizen cannot manage officers (returns 403 Forbidden)',
      citizenAccessRes.status === 403 && citizenAccessRes.body?.error?.code === 'ACCESS_DENIED',
      { statusCode: citizenAccessRes.status }
    );

    // 11. Officer cannot manage officers (403)
    const officerAccessRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/admin/officers', method: 'GET',
      headers: { 'Authorization': `Bearer ${officerToken}` }
    });
    record('Officer cannot manage officers (returns 403 Forbidden)',
      officerAccessRes.status === 403 && officerAccessRes.body?.error?.code === 'ACCESS_DENIED',
      { statusCode: officerAccessRes.status }
    );

    // 12. Unauthenticated requests return 401
    const unauthRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/admin/officers', method: 'GET'
    });
    record('Unauthenticated requests return 401 Unauthorized',
      unauthRes.status === 401 && unauthRes.body?.error?.code === 'UNAUTHORIZED',
      { statusCode: unauthRes.status }
    );

    // 13. Unauthorized roles return 403 on modifying officer
    const citizenCreateRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/admin/officers', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${citizenToken}`
      }
    }, { full_name: 'Fake Officer', officer_code: 'TG-FAKE-01' });
    record('Unauthorized roles return 403 on POST /api/admin/officers',
      citizenCreateRes.status === 403 && citizenCreateRes.body?.error?.code === 'ACCESS_DENIED',
      { statusCode: citizenCreateRes.status }
    );

    // 14. Audit logs are created
    const dashRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/admin/dashboard', method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const recentAuditLogs = dashRes.body?.data?.recentAuditLogs || [];
    const officerAuditActions = recentAuditLogs.map(l => l.action);
    const hasOfficerAudit = officerAuditActions.some(a => 
      a === 'OFFICER_CREATED' || a === 'OFFICER_UPDATED' || a === 'OFFICER_ACTIVATED' || a === 'OFFICER_SUSPENDED' || a === 'OFFICER_REVOKED'
    );
    record('Audit logs are created for officer operations',
      hasOfficerAudit,
      { foundActions: officerAuditActions.filter(a => a.startsWith('OFFICER_')) }
    );

    // 15. Suspended officers cannot access protected officer functionality
    // Try logging in as TG-OFF-005 (seeded suspended officer) or access /api/auth/me
    const suspendedLoginRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'officer5@trustgov.demo', password: 'password123' });
    record('Suspended officers cannot access protected operations (Login returns 403 ACCOUNT_SUSPENDED)',
      suspendedLoginRes.status === 403 && suspendedLoginRes.body?.error?.code === 'ACCOUNT_SUSPENDED',
      { statusCode: suspendedLoginRes.status, code: suspendedLoginRes.body?.error?.code }
    );

    // 16. Revoked officers cannot access protected officer functionality
    // Our created officer was revoked in test 7. Attempting login returns 403.
    const revokedLoginRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: newOfficerEmail, password: 'password123' });
    record('Revoked officers cannot access protected operations (Login returns 403 ACCOUNT_SUSPENDED)',
      revokedLoginRes.status === 403 && revokedLoginRes.body?.error?.code === 'ACCOUNT_SUSPENDED',
      { statusCode: revokedLoginRes.status, code: revokedLoginRes.body?.error?.code }
    );

  } catch (err) {
    console.error('Test execution error:', err);
  }

  console.log(`\nTest Summary: ${passCount} / ${testCount} Passed (${Math.round((passCount / testCount) * 100)}%)\n`);
  return { passCount, testCount, allPassed: passCount === testCount && testCount === 16 };
}

runTests().then(summary => {
  if (summary.allPassed) {
    console.log('ALL 16 PHASE 2 TESTS PASSED PERFECTLY!');
    process.exit(0);
  } else {
    console.error('SOME TESTS FAILED.');
    process.exit(1);
  }
});
