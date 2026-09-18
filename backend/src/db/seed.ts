import { pool } from '../config/db';
import bcrypt from 'bcrypt';

async function seed() {
  console.log('Seeding database...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Clear existing data
    console.log('Clearing old data...');
    await client.query('TRUNCATE audit_logs, ivrsessions, evidence, scam_reports, verification_sessions, authorizations, credentials, officers, users CASCADE');

    const hashedPassword = await bcrypt.hash('password123', 10);

    // 2. Create primary demo users
    console.log('Creating primary demo users...');
    
    // Admin User
    const adminRes = await client.query(
      `INSERT INTO users (name, email, password_hash, role, status)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      ['Demo Admin User', 'admin@trustgov.demo', hashedPassword, 'ADMIN', 'ACTIVE']
    );
    const adminId = adminRes.rows[0].id;

    // Primary Officer User (TG-OFF-001)
    const officerUserRes = await client.query(
      `INSERT INTO users (name, email, password_hash, role, status)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      ['Demo Officer Rajesh Kumar', 'officer@trustgov.demo', hashedPassword, 'OFFICER', 'ACTIVE']
    );
    const primaryOfficerUserId = officerUserRes.rows[0].id;

    // Primary Citizen User
    const citizenUserRes = await client.query(
      `INSERT INTO users (name, email, password_hash, role, status)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      ['Demo Citizen Ramesh', 'citizen@trustgov.demo', hashedPassword, 'CITIZEN', 'ACTIVE']
    );
    const primaryCitizenUserId = citizenUserRes.rows[0].id;

    // Additional Officer Users for 6 total
    const officerNames = [
      'Demo Officer Rajesh Kumar', // TG-OFF-001 (Active, CIB)
      'Demo Officer Anita Desai',  // TG-OFF-002 (Active, ED)
      'Demo Officer Vikram Singh', // TG-OFF-003 (Active, Income Tax)
      'Demo Officer Sandeep Rao',  // TG-OFF-004 (Active, Police)
      'Demo Officer Priya Sharma', // TG-OFF-005 (Suspended/Revoked, CIB)
      'Demo Officer Amit Patel'    // TG-OFF-006 (Expired status, Income Tax)
    ];

    const officerEmails = [
      'officer@trustgov.demo',
      'officer2@trustgov.demo',
      'officer3@trustgov.demo',
      'officer4@trustgov.demo',
      'officer5@trustgov.demo',
      'officer6@trustgov.demo'
    ];

    const departments = [
      'Demo Central Investigation Bureau',
      'Demo Enforcement Directorate',
      'Demo Income Tax Department',
      'Demo Police Department',
      'Demo Central Investigation Bureau',
      'Demo Income Tax Department'
    ];

    const designations = [
      'Superintendent of Police',
      'Assistant Director',
      'Deputy Commissioner',
      'Inspector of Police',
      'Deputy Superintendent',
      'Income Tax Officer'
    ];

    const jurisdictions = [
      'New Delhi Zone',
      'Mumbai Regional Office',
      'Bengaluru Office',
      'Hyderabad City Division',
      'Kolkata Zone',
      'Chennai Regional Office'
    ];

    const officerCodes = [
      'TG-OFF-001',
      'TG-OFF-002',
      'TG-OFF-003',
      'TG-OFF-004',
      'TG-OFF-005',
      'TG-OFF-006'
    ];

    const officerStatuses: ('ACTIVE' | 'INACTIVE' | 'SUSPENDED')[] = [
      'ACTIVE',
      'ACTIVE',
      'ACTIVE',
      'ACTIVE',
      'SUSPENDED', // Revoked credential officer
      'ACTIVE'     // Expired credential officer (user active, but credential expired)
    ];

    const officerUserIds: string[] = [primaryOfficerUserId];
    
    // Create the rest of the officer users
    for (let i = 1; i < 6; i++) {
      const uRes = await client.query(
        `INSERT INTO users (name, email, password_hash, role, status)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [officerNames[i], officerEmails[i], hashedPassword, 'OFFICER', officerStatuses[i] === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE']
      );
      officerUserIds.push(uRes.rows[0].id);
    }

    const officerDbIds: string[] = [];

    // Create Officers
    console.log('Inserting officers details...');
    for (let i = 0; i < 6; i++) {
      // Mock DIDs and keys
      const deptCode = departments[i].includes('CIB') ? 'cib' : departments[i].includes('ED') ? 'ed' : departments[i].includes('Tax') ? 'it' : 'police';
      const mockDid = `did:trustgov:demo:${deptCode}:${officerCodes[i].toLowerCase()}`;
      const mockPublicKey = `04-${i}-mock-secp256k1-public-key-for-demo-purposes-${officerCodes[i]}`;

      const oRes = await client.query(
        `INSERT INTO officers (user_id, officer_code, department, designation, jurisdiction, status, did, public_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [
          officerUserIds[i],
          officerCodes[i],
          departments[i],
          designations[i],
          jurisdictions[i],
          officerStatuses[i],
          mockDid,
          mockPublicKey
        ]
      );
      officerDbIds.push(oRes.rows[0].id);
    }

    // 3. Create Default Authorizations for each officer
    console.log('Inserting default authorizations...');
    const actions = [
      { action: 'DOCUMENT_REQUEST', allowed: true, description: 'Authorized to request official identity documents or records.' },
      { action: 'OFFICIAL_NOTICE', allowed: true, description: 'Authorized to serve official notices to citizens.' },
      { action: 'INVESTIGATION_ACTION', allowed: true, description: 'Authorized to conduct investigation-related queries.' },
      { action: 'PERSONAL_UPI_PAYMENT', allowed: false, description: 'WARNING: Government officers NEVER demand transfer of funds to personal UPI accounts.' },
      { action: 'OTP_REQUEST', allowed: false, description: 'WARNING: Government officers NEVER demand OTPs or verification codes.' },
      { action: 'PASSWORD_REQUEST', allowed: false, description: 'WARNING: Government officers NEVER demand passwords.' },
      { action: 'PIN_REQUEST', allowed: false, description: 'WARNING: Government officers NEVER demand UPI/Bank PINs.' }
    ];

    for (const officerId of officerDbIds) {
      for (const act of actions) {
        await client.query(
          `INSERT INTO authorizations (officer_id, action, allowed, description)
           VALUES ($1, $2, $3, $4)`,
          [officerId, act.action, act.allowed, act.description]
        );
      }
    }

    // 4. Create Credentials
    console.log('Inserting credentials...');
    const credentialStatuses: ('ACTIVE' | 'REVOKED' | 'EXPIRED')[] = [
      'ACTIVE',   // TG-OFF-001
      'ACTIVE',   // TG-OFF-002
      'ACTIVE',   // TG-OFF-003
      'ACTIVE',   // TG-OFF-004
      'REVOKED',  // TG-OFF-005
      'EXPIRED'   // TG-OFF-006
    ];

    for (let i = 0; i < 6; i++) {
      const officerId = officerDbIds[i];
      const deptCode = departments[i].includes('CIB') ? 'cib' : departments[i].includes('ED') ? 'ed' : departments[i].includes('Tax') ? 'it' : 'police';
      const subjectDid = `did:trustgov:demo:${deptCode}:${officerCodes[i].toLowerCase()}`;
      const issuerDid = `did:trustgov:demo:authority:issuance`;
      
      const now = new Date();
      let issuedAt = new Date();
      let expiresAt = new Date();
      let revokedAt = null;

      if (credentialStatuses[i] === 'EXPIRED') {
        // Expired 30 days ago
        issuedAt.setDate(now.getDate() - 60);
        expiresAt.setDate(now.getDate() - 30);
      } else if (credentialStatuses[i] === 'REVOKED') {
        issuedAt.setDate(now.getDate() - 10);
        expiresAt.setDate(now.getDate() + 100);
        revokedAt = new Date();
        revokedAt.setDate(now.getDate() - 2); // Revoked 2 days ago
      } else {
        // Active
        issuedAt.setDate(now.getDate() - 5);
        expiresAt.setDate(now.getDate() + 365); // expires in 1 year
      }

      await client.query(
        `INSERT INTO credentials (officer_id, credential_id, issuer_did, subject_did, credential_hash, issued_at, expires_at, status, revoked_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          officerId,
          `VC-TG-${officerCodes[i]}-0001`,
          issuerDid,
          subjectDid,
          `sha256-mock-credential-hash-for-${officerCodes[i]}-demo`,
          issuedAt,
          expiresAt,
          credentialStatuses[i] === 'REVOKED' ? 'REVOKED' : credentialStatuses[i] === 'EXPIRED' ? 'EXPIRED' : 'ACTIVE',
          revokedAt
        ]
      );
    }

    // 5. Create some sample scam reports
    console.log('Inserting sample scam reports...');
    const report1 = await client.query(
      `INSERT INTO scam_reports (citizen_id, caller_number, claimed_department, claimed_officer_name, claimed_officer_id, payment_requested, payment_amount, upi_id, description, risk_score, risk_level, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
      [
        primaryCitizenUserId,
        '+91 98765 43210',
        'Demo Central Investigation Bureau',
        'Fake Inspector Malhotra',
        'TG-OFF-999',
        true,
        50000.00,
        'malhotra@upi',
        'Threatened arrest due to illegal parcel. Demanded immediate transfer to clear identity.',
        95,
        'CRITICAL',
        'SUBMITTED'
      ]
    );

    // 6. Create some sample audit logs
    console.log('Inserting sample audit logs...');
    await client.query(
      `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [adminId, 'SEEDED_DEMO_DATA', 'SYSTEM', null, JSON.stringify({ message: 'Seeded initial platform configuration' })]
    );

    await client.query('COMMIT');
    console.log('Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    client.release();
  }
}

seed();
