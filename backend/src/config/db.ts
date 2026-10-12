import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcrypt';
import { issuerAuthority, ISSUER_DID } from '../services/issuer';
import { createAndSignCredential } from '../services/credential';

// Load .env from root directory relative to this folder
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const connectionString = process.env.DATABASE_URL;

// --- IN-MEMORY DATABASE FALLBACK STATE ---
class InMemoryDB {
  users: any[] = [];
  officers: any[] = [];
  credentials: any[] = [];
  authorizations: any[] = [];
  scamReports: any[] = [];
  auditLogs: any[] = [];
  verificationSessions: any[] = [];
  ivrSessions: any[] = [];
  get ivrsessions() { return this.ivrSessions; }
  set ivrsessions(val: any[]) { this.ivrSessions = val; }
  didIdentities: any[] = [];
  verifiableCredentials: any[] = [];
  blockchainRegistry: any[] = [];
  blockchainDidRegistry: any[] = [];
  verificationChallenges: any[] = [];
  citizenVerificationHistory: any[] = [];
  authorizationPolicies: any[] = [];
  authorizationEvaluations: any[] = [];
  reportEvidence: any[] = [];
  reportReviewNotes: any[] = [];

  constructor() {
    this.seed();
  }

  async seed() {
    // Generate bcrypt hash for 'password123'
    const hashedPassword = await bcrypt.hash('password123', 10);

    // Primary demo users
    const adminId = 'd3b07384-d113-49d7-897b-d24546419777';
    const officerId = 'officer-u-id-1';
    const citizenId = 'citizen-u-id-1';

    this.users.push({
      id: adminId,
      name: 'Demo Admin User',
      email: 'admin@trustgov.demo',
      phone: '+91 99999 11111',
      password_hash: hashedPassword,
      role: 'ADMIN',
      status: 'ACTIVE',
      created_at: new Date(),
      updated_at: new Date()
    });

    this.users.push({
      id: officerId,
      name: 'Demo Officer Rajesh Kumar',
      email: 'officer@trustgov.demo',
      phone: '+91 99999 22222',
      password_hash: hashedPassword,
      role: 'OFFICER',
      status: 'ACTIVE',
      created_at: new Date(),
      updated_at: new Date()
    });

    this.users.push({
      id: citizenId,
      name: 'Demo Citizen Ramesh',
      email: 'citizen@trustgov.demo',
      phone: '+91 98765 43210',
      password_hash: hashedPassword,
      role: 'CITIZEN',
      status: 'ACTIVE',
      created_at: new Date(),
      updated_at: new Date()
    });

    // Seed 6 demo officers
    const officerNames = [
      'Demo Officer Rajesh Kumar',
      'Demo Officer Anita Desai',
      'Demo Officer Vikram Singh',
      'Demo Officer Sandeep Rao',
      'Demo Officer Priya Sharma',
      'Demo Officer Amit Patel'
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

    const codes = ['TG-OFF-001', 'TG-OFF-002', 'TG-OFF-003', 'TG-OFF-004', 'TG-OFF-005', 'TG-OFF-006'];
    const statuses = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'SUSPENDED', 'ACTIVE'];

    for (let i = 0; i < 6; i++) {
      let uId = i === 0 ? officerId : `officer-u-id-${i + 1}`;
      if (i > 0) {
        this.users.push({
          id: uId,
          name: officerNames[i],
          email: officerEmails[i],
          phone: `+91 99999 0000${i}`,
          password_hash: hashedPassword,
          role: 'OFFICER',
          status: statuses[i] === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE',
          created_at: new Date(),
          updated_at: new Date()
        });
      }

      const oId = `officer-db-id-${i + 1}`;
      const deptCode = departments[i].includes('CIB') ? 'cib' : departments[i].includes('ED') ? 'ed' : departments[i].includes('Tax') ? 'it' : 'police';
      
      this.officers.push({
        id: oId,
        user_id: uId,
        officer_code: codes[i],
        full_name: officerNames[i],
        department: departments[i],
        designation: designations[i],
        jurisdiction: jurisdictions[i],
        official_email: officerEmails[i],
        official_phone: i === 0 ? '+91 99999 22222' : `+91 99999 0000${i}`,
        status: statuses[i],
        did: `did:trustgov:demo:${deptCode}:${codes[i].toLowerCase()}`,
        public_key: `04-${i}-mock-secp256k1-public-key-for-demo-purposes-${codes[i]}`,
        created_at: new Date(Date.now() - (6 - i) * 3600000),
        updated_at: new Date()
      });

      const demoDid = `did:trustgov:550e8400-e29b-41d4-a716-44665544000${i + 1}`;
      const demoPubKey = 'z6MkemMNhF7WuBVhjeSexMQfCn9EJRgp3H43ULEjPGz9RpUJ';
      this.didIdentities.push({
        id: `did-id-${i + 1}`,
        officer_id: oId,
        did: demoDid,
        public_key: demoPubKey,
        key_type: 'Ed25519',
        status: statuses[i],
        created_at: new Date(Date.now() - (6 - i) * 3600000),
        updated_at: new Date()
      });

      // Default Authorizations
      const actions = [
        { action: 'DOCUMENT_REQUEST', allowed: true },
        { action: 'OFFICIAL_NOTICE', allowed: true },
        { action: 'INVESTIGATION_ACTION', allowed: true },
        { action: 'PERSONAL_UPI_PAYMENT', allowed: false },
        { action: 'OTP_REQUEST', allowed: false },
        { action: 'PASSWORD_REQUEST', allowed: false },
        { action: 'PIN_REQUEST', allowed: false }
      ];

      for (const act of actions) {
        this.authorizations.push({
          id: `auth-id-${oId}-${act.action}`,
          officer_id: oId,
          action: act.action,
          allowed: act.allowed,
          description: `Rule for ${act.action}`
        });
      }

      // Credentials
      let credStatus = 'ACTIVE';
      let expires = new Date();
      let revoked = null;

      if (codes[i] === 'TG-OFF-005') {
        credStatus = 'REVOKED';
        revoked = new Date();
      } else if (codes[i] === 'TG-OFF-006') {
        credStatus = 'EXPIRED';
        expires.setDate(expires.getDate() - 30);
      } else {
        expires.setDate(expires.getDate() + 365);
      }

      this.credentials.push({
        id: `cred-id-${i + 1}`,
        officer_id: oId,
        credential_id: `VC-TG-${codes[i]}-0001`,
        issuer_did: 'did:trustgov:demo:authority:issuance',
        subject_did: `did:trustgov:demo:${deptCode}:${codes[i].toLowerCase()}`,
        credential_hash: `sha256-mock-credential-hash-for-${codes[i]}-demo`,
        issued_at: new Date(),
        expires_at: expires,
        status: credStatus,
        revoked_at: revoked
      });

      const vcData = createAndSignCredential({
        officerId: oId,
        officerCode: codes[i],
        fullName: officerNames[i],
        department: departments[i],
        designation: designations[i],
        jurisdiction: jurisdictions[i],
        officialEmail: officerEmails[i],
        officerDid: demoDid,
        validityDays: codes[i] === 'TG-OFF-006' ? -30 : 365
      });

      this.verifiableCredentials.push({
        id: `vc-db-id-${i + 1}`,
        credential_id: vcData.credentialId,
        officer_id: oId,
        officer_did: demoDid,
        issuer_did: ISSUER_DID,
        credential_type: 'GovernmentOfficerCredential',
        credential_subject: vcData.credential.credentialSubject,
        credential_payload: vcData.credential,
        proof: vcData.credential.proof,
        status: credStatus,
        issued_at: vcData.issuedAt,
        valid_from: vcData.validFrom,
        valid_until: vcData.validUntil,
        revoked_at: revoked,
        suspended_at: credStatus === 'SUSPENDED' ? new Date() : null,
        created_at: vcData.issuedAt,
        updated_at: new Date()
      });
    }

    // Seed Issuer Authority Identity
    this.didIdentities.push({
      id: 'did-id-issuer-authority',
      officer_id: null,
      did: ISSUER_DID,
      public_key: issuerAuthority.getPublicKeyMultibase(),
      key_type: 'Ed25519',
      status: 'ACTIVE',
      created_at: new Date(),
      updated_at: new Date()
    });

    // Phase 8: Seed Demo Authorization Policies
    this.authorizationPolicies.push(
      {
        id: 'auth-pol-1',
        policy_code: 'TG-DEMO-DOCUMENT-001',
        version: 1,
        department: 'Demo Central Investigation Bureau',
        role: 'ALL',
        action_code: 'REQUEST_DOCUMENT',
        decision: 'ALLOW',
        constraints: {
          allowedChannels: ['OFFICIAL_PORTAL', 'OFFICIAL_OFFICE', 'VERIFIED_PHONE'],
          allowedDataCategories: ['BASIC_IDENTITY', 'DOCUMENTS'],
          paymentAllowed: false,
          otpAllowed: false,
          remoteAccessAllowed: false
        },
        description: 'TrustGov Demo Policy: Investigating officers may request official documents via designated channels.',
        status: 'ACTIVE',
        effective_from: new Date('2026-01-01'),
        effective_to: null,
        created_by: adminId,
        created_at: new Date('2026-01-01'),
        updated_at: new Date('2026-01-01')
      },
      {
        id: 'auth-pol-2',
        policy_code: 'TG-DEMO-OTP-001',
        version: 1,
        department: 'ALL',
        role: 'ALL',
        action_code: 'REQUEST_OTP',
        decision: 'DENY',
        constraints: { otpAllowed: false },
        description: 'TrustGov Demo Safety Policy: Strict prohibition on requesting citizen OTPs.',
        status: 'ACTIVE',
        effective_from: new Date('2026-01-01'),
        effective_to: null,
        created_by: adminId,
        created_at: new Date('2026-01-01'),
        updated_at: new Date('2026-01-01')
      },
      {
        id: 'auth-pol-3',
        policy_code: 'TG-DEMO-PIN-001',
        version: 1,
        department: 'ALL',
        role: 'ALL',
        action_code: 'REQUEST_PIN',
        decision: 'DENY',
        constraints: { pinAllowed: false },
        description: 'TrustGov Demo Safety Policy: Strict prohibition on requesting security/ATM/UPI PINs.',
        status: 'ACTIVE',
        effective_from: new Date('2026-01-01'),
        effective_to: null,
        created_by: adminId,
        created_at: new Date('2026-01-01'),
        updated_at: new Date('2026-01-01')
      },
      {
        id: 'auth-pol-4',
        policy_code: 'TG-DEMO-PASSWORD-001',
        version: 1,
        department: 'ALL',
        role: 'ALL',
        action_code: 'REQUEST_PASSWORD',
        decision: 'DENY',
        constraints: { passwordAllowed: false },
        description: 'TrustGov Demo Safety Policy: Strict prohibition on requesting passwords.',
        status: 'ACTIVE',
        effective_from: new Date('2026-01-01'),
        effective_to: null,
        created_by: adminId,
        created_at: new Date('2026-01-01'),
        updated_at: new Date('2026-01-01')
      },
      {
        id: 'auth-pol-5',
        policy_code: 'TG-DEMO-PAYMENT-001',
        version: 1,
        department: 'ALL',
        role: 'ALL',
        action_code: 'REQUEST_UPI_PAYMENT',
        decision: 'DENY',
        constraints: { paymentAllowed: false },
        description: 'TrustGov Demo Safety Policy: Strict prohibition on personal UPI payments.',
        status: 'ACTIVE',
        effective_from: new Date('2026-01-01'),
        effective_to: null,
        created_by: adminId,
        created_at: new Date('2026-01-01'),
        updated_at: new Date('2026-01-01')
      },
      {
        id: 'auth-pol-6',
        policy_code: 'TG-DEMO-BANK-001',
        version: 1,
        department: 'ALL',
        role: 'ALL',
        action_code: 'REQUEST_BANK_TRANSFER',
        decision: 'DENY',
        constraints: { paymentAllowed: false },
        description: 'TrustGov Demo Safety Policy: Strict prohibition on personal bank account transfers.',
        status: 'ACTIVE',
        effective_from: new Date('2026-01-01'),
        effective_to: null,
        created_by: adminId,
        created_at: new Date('2026-01-01'),
        updated_at: new Date('2026-01-01')
      },
      {
        id: 'auth-pol-7',
        policy_code: 'TG-DEMO-REMOTE-001',
        version: 1,
        department: 'ALL',
        role: 'ALL',
        action_code: 'REQUEST_REMOTE_ACCESS',
        decision: 'DENY',
        constraints: { remoteAccessAllowed: false },
        description: 'TrustGov Demo Safety Policy: Strict prohibition on remote desktop or screen access requests.',
        status: 'ACTIVE',
        effective_from: new Date('2026-01-01'),
        effective_to: null,
        created_by: adminId,
        created_at: new Date('2026-01-01'),
        updated_at: new Date('2026-01-01')
      },
      {
        id: 'auth-pol-8',
        policy_code: 'TG-DEMO-APPEARANCE-001',
        version: 1,
        department: 'Demo Central Investigation Bureau',
        role: 'ALL',
        action_code: 'REQUEST_PHYSICAL_APPEARANCE',
        decision: 'REVIEW',
        constraints: { allowedChannels: ['OFFICIAL_PORTAL', 'OFFICIAL_OFFICE'], requiresOfficialNotice: true },
        description: 'TrustGov Demo Policy: Physical appearance requests require verified written legal notice.',
        status: 'ACTIVE',
        effective_from: new Date('2026-01-01'),
        effective_to: null,
        created_by: adminId,
        created_at: new Date('2026-01-01'),
        updated_at: new Date('2026-01-01')
      },
      {
        id: 'auth-pol-9',
        policy_code: 'TG-DEMO-NOTICE-001',
        version: 1,
        department: 'Demo Central Investigation Bureau',
        role: 'ALL',
        action_code: 'ISSUE_OFFICIAL_NOTICE',
        decision: 'ALLOW',
        constraints: { allowedChannels: ['OFFICIAL_PORTAL', 'OFFICIAL_OFFICE'], allowedDataCategories: ['DOCUMENTS'] },
        description: 'TrustGov Demo Policy: Authorized to issue formal statutory notices.',
        status: 'ACTIVE',
        effective_from: new Date('2026-01-01'),
        effective_to: null,
        created_by: adminId,
        created_at: new Date('2026-01-01'),
        updated_at: new Date('2026-01-01')
      }
    );

    // Scam reports (Phase 9 standard demo scenarios)
    this.scamReports.push(
      {
        id: 'demo-report-1',
        report_id: 'TG-REPORT-DEMO-001',
        citizen_id: citizenId,
        officer_reference: 'TG-OFF-001',
        officer_name: 'Demo Officer Rajesh Kumar',
        department: 'Demo Central Investigation Bureau',
        verification_reference: 'TG-VFY-7K29XQ4P',
        authorization_evaluation_reference: 'TG-AUTH-DEMO-001',
        report_category: 'PAYMENT_DEMAND',
        description: 'The person requested that I transfer money to a personal UPI account to clear investigation charges.',
        reported_action_code: 'REQUEST_UPI_PAYMENT',
        risk_level: 'CRITICAL',
        status: 'SUBMITTED',
        submitted_at: new Date('2026-09-20T10:00:00Z'),
        updated_at: new Date('2026-09-20T10:00:00Z'),
        resolved_at: null,
        created_at: new Date('2026-09-20T10:00:00Z')
      },
      {
        id: 'demo-report-2',
        report_id: 'TG-REPORT-DEMO-002',
        citizen_id: citizenId,
        officer_reference: 'TG-OFF-001',
        officer_name: 'Demo Officer Rajesh Kumar',
        department: 'Demo Central Investigation Bureau',
        verification_reference: null,
        authorization_evaluation_reference: null,
        report_category: 'OTP_REQUEST',
        description: 'Caller demanded SMS One-Time Password under threat of freezing bank accounts.',
        reported_action_code: 'REQUEST_OTP',
        risk_level: 'CRITICAL',
        status: 'UNDER_REVIEW',
        submitted_at: new Date('2026-09-21T11:30:00Z'),
        updated_at: new Date('2026-09-21T11:30:00Z'),
        resolved_at: null,
        created_at: new Date('2026-09-21T11:30:00Z')
      },
      {
        id: 'demo-report-3',
        report_id: 'TG-REPORT-DEMO-003',
        citizen_id: citizenId,
        officer_reference: 'TG-OFF-002',
        officer_name: 'Demo Officer Anita Desai',
        department: 'Demo Enforcement Directorate',
        verification_reference: null,
        authorization_evaluation_reference: null,
        report_category: 'SUSPICIOUS_DOCUMENT',
        description: 'Received a forged summons document demanding appearance at an unverified location.',
        reported_action_code: 'REQUEST_DOCUMENT',
        risk_level: 'MEDIUM',
        status: 'RESOLVED',
        submitted_at: new Date('2026-09-22T09:15:00Z'),
        updated_at: new Date('2026-09-22T16:00:00Z'),
        resolved_at: new Date('2026-09-22T16:00:00Z'),
        created_at: new Date('2026-09-22T09:15:00Z')
      }
    );

    // Phase 9: Seed review notes
    this.reportReviewNotes.push({
      id: 'demo-note-1',
      report_id: 'demo-report-2',
      note_id: 'TG-NOTE-DEMO-001',
      reviewer_id: adminId,
      reviewer_name: 'Demo Admin User',
      note: 'Initial review confirms pattern matches known fake officer impersonation scam. Escalated for verification.',
      created_at: new Date('2026-09-21T14:00:00Z')
    });

    // Audit logs
    this.auditLogs.push({
      id: 'audit-id-1',
      actor_id: adminId,
      actor_name: 'Demo Admin User',
      actor_email: 'admin@trustgov.demo',
      actor_role: 'ADMIN',
      action: 'SEEDED_IN_MEMORY_DATA',
      entity_type: 'SYSTEM',
      created_at: new Date()
    });

    // Phase 7: Seed citizen verification history
    this.citizenVerificationHistory.push({
      id: 'cvh-id-1',
      verification_id: 'TG-VFY-7K29XQ4P',
      citizen_id: citizenId,
      verification_method: 'QR',
      officer_reference: 'TG-OFF-001',
      officer_name: 'Demo Officer Rajesh Kumar',
      department: 'Demo Central Investigation Bureau',
      credential_reference: 'VC-TG-TG-OFF-001-4D78E09B',
      result: 'VERIFIED',
      failure_reason: null,
      checks_summary: {
        identity: 'VERIFIED',
        credential: 'VERIFIED',
        officerStatus: 'ACTIVE',
        proofOfPossession: 'VERIFIED',
        blockchain: 'VERIFIED'
      },
      verified_at: new Date(Date.now() - 3600000),
      created_at: new Date(Date.now() - 3600000)
    });

    this.citizenVerificationHistory.push({
      id: 'cvh-id-2',
      verification_id: 'TG-VFY-9M41BL2C',
      citizen_id: citizenId,
      verification_method: 'CREDENTIAL_ID',
      officer_reference: 'TG-OFF-999',
      officer_name: 'Unknown Impersonator',
      department: 'Unknown Agency',
      credential_reference: 'VC-FAKE-999-XXXX',
      result: 'FAILED',
      failure_reason: 'CREDENTIAL_NOT_FOUND',
      checks_summary: {
        identity: 'FAILED',
        credential: 'FAILED',
        officerStatus: 'UNKNOWN',
        proofOfPossession: 'NOT_CHECKED',
        blockchain: 'FAILED'
      },
      verified_at: null,
      created_at: new Date(Date.now() - 7200000)
    });
  }
}

const memDB = new InMemoryDB();

// Simulated Pool
class MemoryPool {
  async query(text: string, params: any[] = []): Promise<{ rows: any[] }> {
    const queryNormalized = text.trim().replace(/\s+/g, ' ');

    // 1. SELECT NOW()
    if (queryNormalized.includes('SELECT NOW()')) {
      return { rows: [{ now: new Date() }] };
    }

    // 2. Auth/Profile checking: SELECT ... FROM users WHERE id = $1
    if (queryNormalized.includes('FROM users WHERE id = $1')) {
      const user = memDB.users.find(u => u.id === params[0]);
      if (user) {
        const safeUser = { ...user };
        if (!queryNormalized.includes('password_hash') && !queryNormalized.includes('*')) {
          delete safeUser.password_hash;
        }
        return { rows: [safeUser] };
      }
      return { rows: [] };
    }

    // 3. Login checking: SELECT * FROM users WHERE email = $1
    if (queryNormalized.includes('SELECT * FROM users WHERE email = $1')) {
      const user = memDB.users.find(u => u.email === params[0]);
      return { rows: user ? [user] : [] };
    }

    // 4. Register checking: SELECT id FROM users WHERE email = $1
    if (queryNormalized.includes('SELECT id FROM users WHERE email = $1')) {
      const user = memDB.users.find(u => u.email === params[0]);
      return { rows: user ? [user] : [] };
    }

    // 4b. Query citizen user
    if (queryNormalized.includes("FROM users WHERE role = 'CITIZEN'")) {
      const user = memDB.users.find(u => u.role === 'CITIZEN');
      return { rows: user ? [{ id: user.id }] : [] };
    }

    // 5. Register insertion
    if (queryNormalized.startsWith('INSERT INTO users')) {
      const id = `user-id-${Date.now()}`;
      const isOfficer = queryNormalized.includes("'OFFICER'");
      const newUser = {
        id,
        name: params[0],
        email: params[1],
        phone: params[2],
        password_hash: params[3],
        role: isOfficer ? 'OFFICER' : (params[4] || 'CITIZEN'),
        status: (isOfficer && params[4]) ? params[4] : 'ACTIVE',
        created_at: new Date(),
        updated_at: new Date()
      };
      memDB.users.push(newUser);
      return { rows: [newUser] };
    }

    // 6. Audit logs insertion
    if (queryNormalized.startsWith('INSERT INTO audit_logs')) {
      const actor = memDB.users.find(u => u.id === params[0]);
      const newLog = {
        id: `audit-id-${Date.now()}`,
        actor_id: params[0],
        actor_name: actor ? actor.name : 'System Daemon',
        actor_email: actor ? actor.email : 'daemon',
        actor_role: actor ? actor.role : 'SYSTEM',
        action: params[1],
        entity_type: params[2],
        entity_id: params[3],
        metadata: params[4] ? JSON.parse(params[4]) : {},
        blockchain_tx_hash: params[5],
        created_at: new Date()
      };
      memDB.auditLogs.push(newLog);
      return { rows: [newLog] };
    }

    // 7. GetMe - Officer query
    if (queryNormalized.includes('SELECT o.id as officer_id, o.officer_code, o.department')) {
      const officer = memDB.officers.find(o => o.user_id === params[0]);
      if (officer) {
        const credential = memDB.credentials.find(c => c.officer_id === officer.id);
        const didRec = memDB.didIdentities.find(d => d.officer_id === officer.id);
        return {
          rows: [{
            ...officer,
            officer_id: officer.id,
            did: didRec ? didRec.did : officer.did,
            public_key: didRec ? didRec.public_key : officer.public_key,
            key_type: didRec ? didRec.key_type : 'Ed25519',
            did_status: didRec ? didRec.status : officer.status,
            credential_status: credential ? credential.status : 'ACTIVE',
            expires_at: credential ? credential.expires_at : new Date()
          }]
        };
      }
      return { rows: [] };
    }

    // 8. Admin Metrics Queries
    if (queryNormalized.startsWith('SELECT COUNT(*)::int as count FROM')) {
      if (queryNormalized.includes('FROM users')) {
        return { rows: [{ count: memDB.users.length }] };
      }
      if (queryNormalized.includes('FROM officers')) {
        return { rows: [{ count: memDB.officers.length }] };
      }
      if (queryNormalized.includes("FROM credentials WHERE status = 'ACTIVE'")) {
        return { rows: [{ count: memDB.credentials.filter(c => c.status === 'ACTIVE').length }] };
      }
      if (queryNormalized.includes("FROM credentials WHERE status = 'REVOKED'")) {
        return { rows: [{ count: memDB.credentials.filter(c => c.status === 'REVOKED').length }] };
      }
      if (queryNormalized.includes("FROM verification_sessions WHERE created_at >= CURRENT_DATE")) {
        return { rows: [{ count: memDB.verificationSessions.length }] };
      }
      if (queryNormalized.includes("FROM verification_sessions WHERE status = 'FAILED'")) {
        return { rows: [{ count: memDB.verificationSessions.filter(vs => vs.status === 'FAILED').length }] };
      }
      if (queryNormalized.includes('FROM scam_reports')) {
        if (queryNormalized.includes("risk_level IN ('HIGH', 'CRITICAL')")) {
          return { rows: [{ count: memDB.scamReports.filter(s => s.risk_level === 'HIGH' || s.risk_level === 'CRITICAL').length }] };
        }
        return { rows: [{ count: memDB.scamReports.length }] };
      }
    }

    // 9. Recent Officers
    if (queryNormalized.includes('FROM officers o JOIN users u')) {
      const rows = memDB.officers.map(o => {
        const u = memDB.users.find(u => u.id === o.user_id);
        return {
          id: o.id,
          name: u ? u.name : 'Unknown',
          email: u ? u.email : '',
          officer_code: o.officer_code,
          department: o.department,
          designation: o.designation,
          status: o.status,
          created_at: o.created_at
        };
      }).sort((a, b) => b.created_at.getTime() - a.created_at.getTime()).slice(0, 5);
      return { rows };
    }

    // 10. Recent Audit Logs
    if (queryNormalized.includes('FROM audit_logs a LEFT JOIN users u')) {
      const rows = memDB.auditLogs.slice().sort((a, b) => b.created_at.getTime() - a.created_at.getTime()).slice(0, 10);
      return { rows };
    }

    // 11. Recent Scam Reports (Overview dashboard)
    if (queryNormalized.includes('FROM scam_reports') && !queryNormalized.includes('WHERE')) {
      const rows = memDB.scamReports.slice().sort((a, b) => b.created_at.getTime() - a.created_at.getTime()).slice(0, 5);
      return { rows };
    }

    // 12. Recent Verification Sessions
    if (queryNormalized.includes('FROM verification_sessions vs')) {
      const rows = memDB.verificationSessions.map(vs => {
        const o = memDB.officers.find(o => o.id === vs.officer_id);
        const oUser = o ? memDB.users.find(u => u.id === o.user_id) : null;
        const cUser = vs.citizen_id ? memDB.users.find(u => u.id === vs.citizen_id) : null;
        return {
          id: vs.id,
          session_id: vs.session_id,
          officer_code: o ? o.officer_code : '',
          officer_name: oUser ? oUser.name : 'Unknown',
          citizen_name: cUser ? cUser.name : 'Anonymous Caller',
          status: vs.status,
          created_at: vs.created_at
        };
      }).sort((a, b) => b.created_at.getTime() - a.created_at.getTime()).slice(0, 5);
      return { rows };
    }

    // Phase 2: Officer Management Query Handlers
    // 13. Officer uniqueness check by code
    if (queryNormalized.includes('FROM officers WHERE officer_code = $1') || queryNormalized.includes('FROM officers WHERE LOWER(officer_code) = LOWER($1)')) {
      const match = memDB.officers.find(o => 
        o.officer_code?.toLowerCase() === params[0]?.toLowerCase() && 
        (!params[1] || o.id !== params[1])
      );
      return { rows: match ? [match] : [] };
    }

    // 14. Officer uniqueness check by official email
    if (queryNormalized.includes('FROM officers WHERE official_email = $1') || queryNormalized.includes('FROM officers WHERE LOWER(official_email) = LOWER($1)')) {
      const match = memDB.officers.find(o => 
        o.official_email?.toLowerCase() === params[0]?.toLowerCase() && 
        (!params[1] || o.id !== params[1])
      );
      return { rows: match ? [match] : [] };
    }

    // 15. Single officer by ID
    if (queryNormalized.includes('FROM officers WHERE id = $1') || queryNormalized.includes('FROM officers o WHERE o.id = $1')) {
      const off = memDB.officers.find(o => o.id === params[0]);
      return { rows: off ? [off] : [] };
    }

    // 15b. Single officer by User ID
    if (queryNormalized.includes('FROM officers WHERE user_id = $1') || queryNormalized.includes('FROM officers o WHERE o.user_id = $1')) {
      const off = memDB.officers.find(o => o.user_id === params[0]);
      return { rows: off ? [off] : [] };
    }

    // 16. Officers list
    if (queryNormalized.includes('FROM officers') && !queryNormalized.includes('JOIN users u')) {
      let filtered = [...memDB.officers];
      return { rows: filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) };
    }

    // 17. Insert into officers
    if (queryNormalized.startsWith('INSERT INTO officers')) {
      const id = `officer-id-${Date.now()}`;
      const newOfficer = {
        id,
        user_id: params[0],
        officer_code: params[1],
        full_name: params[2],
        department: params[3],
        designation: params[4],
        jurisdiction: params[5],
        official_email: params[6],
        official_phone: params[7],
        status: params[8] || 'ACTIVE',
        did: null,
        public_key: null,
        created_at: new Date(),
        updated_at: new Date()
      };
      memDB.officers.unshift(newOfficer);
      return { rows: [newOfficer] };
    }

    // 18. Update officer details
    if (queryNormalized.startsWith('UPDATE officers SET full_name = $1')) {
      const off = memDB.officers.find(o => o.id === params[5]);
      if (off) {
        off.full_name = params[0];
        off.department = params[1];
        off.designation = params[2];
        off.jurisdiction = params[3];
        off.official_phone = params[4];
        off.updated_at = new Date();
        const u = memDB.users.find(user => user.id === off.user_id);
        if (u) {
          u.name = params[0];
          u.phone = params[4];
          u.updated_at = new Date();
        }
        return { rows: [off] };
      }
      return { rows: [] };
    }

    // 19. Update officer status
    if (queryNormalized.includes('UPDATE officers SET status = $1')) {
      const off = memDB.officers.find(o => o.id === params[1]);
      if (off) {
        off.status = params[0];
        off.updated_at = new Date();
        const u = memDB.users.find(user => user.id === off.user_id);
        if (u) {
          u.status = (params[0] === 'ACTIVE') ? 'ACTIVE' : 'SUSPENDED';
          u.updated_at = new Date();
        }
        // Cascade to linked didIdentities as required by Phase 3
        const didRec = memDB.didIdentities.find(d => d.officer_id === off.id);
        if (didRec) {
          didRec.status = params[0];
          didRec.updated_at = new Date();
        }
        // Cascade to linked verifiable_credentials as required by Phase 4
        memDB.verifiableCredentials.forEach(vc => {
          if (vc.officer_id === off.id) {
            if (params[0] === 'SUSPENDED' && vc.status === 'ACTIVE') {
              vc.status = 'SUSPENDED';
              vc.suspended_at = new Date();
              vc.updated_at = new Date();
            } else if (params[0] === 'REVOKED' && vc.status !== 'REVOKED') {
              vc.status = 'REVOKED';
              vc.revoked_at = new Date();
              vc.updated_at = new Date();
            }
          }
        });
        return { rows: [off] };
      }
      return { rows: [] };
    }

    // 20. Update user status
    if (queryNormalized.includes('UPDATE users SET status = $1')) {
      const u = memDB.users.find(user => user.id === params[1]);
      if (u) {
        u.status = params[0];
        u.updated_at = new Date();
        return { rows: [u] };
      }
      return { rows: [] };
    }

    // 21. Update user details
    if (queryNormalized.includes('UPDATE users SET name = $1')) {
      const u = memDB.users.find(user => user.id === params[2]);
      if (u) {
        u.name = params[0];
        u.phone = params[1];
        u.updated_at = new Date();
        return { rows: [u] };
      }
      return { rows: [] };
    }

    // 22. DID Identity lookup by officer ID
    if (queryNormalized.includes('FROM did_identities WHERE officer_id = $1')) {
      const didRec = memDB.didIdentities.find(d => d.officer_id === params[0]);
      return { rows: didRec ? [didRec] : [] };
    }

    // 23. DID Identity lookup by DID string
    if (queryNormalized.includes('FROM did_identities WHERE did = $1') || queryNormalized.includes('FROM did_identities WHERE LOWER(did) = LOWER($1)')) {
      const didRec = memDB.didIdentities.find(d => d.did?.toLowerCase() === params[0]?.toLowerCase());
      return { rows: didRec ? [didRec] : [] };
    }

    // 24. Insert into did_identities
    if (queryNormalized.startsWith('INSERT INTO did_identities')) {
      const newDid = {
        id: `did-id-${Date.now()}`,
        officer_id: params[0],
        did: params[1],
        public_key: params[2],
        key_type: params[3] || 'Ed25519',
        status: params[4] || 'ACTIVE',
        created_at: new Date(),
        updated_at: new Date()
      };
      memDB.didIdentities.unshift(newDid);

      // Keep officer record in sync
      const off = memDB.officers.find(o => o.id === params[0]);
      if (off) {
        off.did = params[1];
        off.public_key = params[2];
        off.updated_at = new Date();
      }
      return { rows: [newDid] };
    }

    // 25. Update did_identities status directly
    if (queryNormalized.includes('UPDATE did_identities SET status = $1')) {
      const didRec = memDB.didIdentities.find(d => d.officer_id === params[1] || d.did === params[1]);
      if (didRec) {
        didRec.status = params[0];
        didRec.updated_at = new Date();
        return { rows: [didRec] };
      }
      return { rows: [] };
    }

    // 25b. Update did_identities public key directly
    if (queryNormalized.includes('UPDATE did_identities SET public_key = $1')) {
      const didRec = memDB.didIdentities.find(d => d.id === params[1] || d.officer_id === params[1] || d.did === params[1]);
      if (didRec) {
        didRec.public_key = params[0];
        didRec.updated_at = new Date();
        const off = memDB.officers.find(o => o.id === didRec.officer_id);
        if (off) {
          off.public_key = params[0];
          off.updated_at = new Date();
        }
        return { rows: [didRec] };
      }
      return { rows: [] };
    }

    // 26. Update officer legacy did and public key
    if (queryNormalized.startsWith('UPDATE officers SET did = $1')) {
      const off = memDB.officers.find(o => o.id === params[2]);
      if (off) {
        off.did = params[0];
        off.public_key = params[1];
        off.updated_at = new Date();
        return { rows: [off] };
      }
      return { rows: [] };
    }

    // 26b. Update officer public key directly
    if (queryNormalized.startsWith('UPDATE officers SET public_key = $1')) {
      const off = memDB.officers.find(o => o.id === params[1]);
      if (off) {
        off.public_key = params[0];
        off.updated_at = new Date();
        return { rows: [off] };
      }
      return { rows: [] };
    }


    // Phase 4: Verifiable Credentials Query Handlers
    // 27. Credential lookup with officer join by credential_id, officer_code, or officer_did
    if (queryNormalized.includes('FROM verifiable_credentials') && queryNormalized.includes('JOIN officers') && queryNormalized.includes('credential_id = $1')) {
      const searchTarget = params[0]?.toLowerCase();
      const vc = memDB.verifiableCredentials.find(c => {
        if (c.credential_id?.toLowerCase() === searchTarget) return true;
        if (c.officer_did?.toLowerCase() === searchTarget) return true;
        const off = memDB.officers.find(o => o.id === c.officer_id);
        if (off?.officer_code?.toLowerCase() === searchTarget) return true;
        return false;
      });
      if (vc) {
        const off = memDB.officers.find(o => o.id === vc.officer_id);
        return {
          rows: [{
            ...vc,
            full_name: off?.full_name || 'Unknown Officer',
            officer_code: off?.officer_code || '',
            officer_status: off?.status || 'UNKNOWN',
            department: off?.department || '',
            designation: off?.designation || '',
            official_email: off?.official_email || ''
          }]
        };
      }
      return { rows: [] };
    }

    // 28. Credential lookup by credential_id (simple)
    if (queryNormalized.includes('FROM verifiable_credentials') && (queryNormalized.includes('WHERE credential_id = $1') || queryNormalized.includes('WHERE LOWER(credential_id) = LOWER($1)'))) {
      const vc = memDB.verifiableCredentials.find(c => c.credential_id?.toLowerCase() === params[0]?.toLowerCase());
      return { rows: vc ? [vc] : [] };
    }

    // 29. Active credential check for officer
    if (queryNormalized.includes('FROM verifiable_credentials') && queryNormalized.includes('WHERE officer_id = $1') && queryNormalized.includes("status = 'ACTIVE'")) {
      const vc = memDB.verifiableCredentials.find(c => c.officer_id === params[0] && c.status === 'ACTIVE');
      return { rows: vc ? [vc] : [] };
    }

    // 30. Credentials list by officer_id
    if (queryNormalized.includes('FROM verifiable_credentials') && queryNormalized.includes('WHERE officer_id = $1')) {
      const list = memDB.verifiableCredentials
        .filter(c => c.officer_id === params[0])
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return { rows: list };
    }

    // 31. Single credential lookup by internal id
    if (queryNormalized.includes('FROM verifiable_credentials WHERE id = $1')) {
      const vc = memDB.verifiableCredentials.find(c => c.id === params[0]);
      return { rows: vc ? [vc] : [] };
    }

    // 32. Insert into verifiable_credentials
    if (queryNormalized.startsWith('INSERT INTO verifiable_credentials')) {
      const newVc = {
        id: `vc-db-id-${Date.now()}`,
        credential_id: params[0],
        officer_id: params[1],
        officer_did: params[2],
        issuer_did: params[3],
        credential_type: params[4] || 'GovernmentOfficerCredential',
        credential_subject: typeof params[5] === 'string' ? JSON.parse(params[5]) : params[5],
        credential_payload: typeof params[6] === 'string' ? JSON.parse(params[6]) : params[6],
        proof: typeof params[7] === 'string' ? JSON.parse(params[7]) : params[7],
        status: params[8] || 'ACTIVE',
        issued_at: params[9] ? new Date(params[9]) : new Date(),
        valid_from: params[10] ? new Date(params[10]) : new Date(),
        valid_until: params[11] ? new Date(params[11]) : new Date(),
        revoked_at: null,
        suspended_at: null,
        created_at: new Date(),
        updated_at: new Date()
      };
      memDB.verifiableCredentials.unshift(newVc);
      return { rows: [newVc] };
    }

    // 33. Update verifiable_credentials status directly
    if (queryNormalized.includes('UPDATE verifiable_credentials SET status = $1')) {
      const vc = memDB.verifiableCredentials.find(c => c.id === params[3] || c.credential_id === params[3]);
      if (vc) {
        vc.status = params[0];
        vc.suspended_at = params[1] ? new Date(params[1]) : (params[0] === 'SUSPENDED' ? new Date() : null);
        vc.revoked_at = params[2] ? new Date(params[2]) : (params[0] === 'REVOKED' ? new Date() : null);
        vc.updated_at = new Date();
        return { rows: [vc] };
      }
      return { rows: [] };
    }

    // 34. Cascade update verifiable_credentials by officer_id
    if (queryNormalized.startsWith('UPDATE verifiable_credentials SET status =')) {
      const isSuspended = queryNormalized.includes("'SUSPENDED'");
      const isRevoked = queryNormalized.includes("'REVOKED'");
      const newStatus = isSuspended ? 'SUSPENDED' : (isRevoked ? 'REVOKED' : params[0]);
      const officerId = (isSuspended || isRevoked) ? params[0] : params[3];
      const updated: any[] = [];
      memDB.verifiableCredentials.forEach(c => {
        if (c.officer_id === officerId) {
          c.status = newStatus;
          if (newStatus === 'SUSPENDED') c.suspended_at = new Date();
          if (newStatus === 'REVOKED') c.revoked_at = new Date();
          c.updated_at = new Date();
          updated.push(c);
        }
      });
      return { rows: updated };
    }

    // Phase 5: Blockchain Registry Query Handlers
    // 35. Insert into blockchain_registry
    if (queryNormalized.startsWith('INSERT INTO blockchain_registry')) {
      const newRecord = {
        id: `bcr-id-${Date.now()}`,
        credential_id: params[0],
        officer_id: params[1],
        officer_did: params[2],
        credential_hash: params[3],
        officer_did_hash: params[4],
        issuer_did_hash: params[5],
        blockchain_network: params[6] || 'hardhat',
        chain_id: params[7] || 31337,
        contract_address: params[8],
        transaction_hash: params[9],
        block_number: params[10] || 1,
        registry_status: params[11] || 'ACTIVE',
        anchored_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      };
      memDB.blockchainRegistry.unshift(newRecord);
      return { rows: [newRecord] };
    }

    // 36. Query blockchain_registry by credential_id, credential_hash, or officer_id
    if (queryNormalized.includes('FROM blockchain_registry')) {
      if (queryNormalized.includes('WHERE credential_id = $1') || queryNormalized.includes('WHERE credential_id = $1 OR credential_hash = $1')) {
        const found = memDB.blockchainRegistry.find(r => r.credential_id === params[0] || r.credential_hash === params[0]);
        return { rows: found ? [found] : [] };
      }
      if (queryNormalized.includes('WHERE credential_hash = $1')) {
        const found = memDB.blockchainRegistry.find(r => r.credential_hash === params[0]);
        return { rows: found ? [found] : [] };
      }
      if (queryNormalized.includes('WHERE officer_id = $1')) {
        const found = memDB.blockchainRegistry.filter(r => r.officer_id === params[0]);
        return { rows: found };
      }
      return { rows: [...memDB.blockchainRegistry] };
    }

    // 37. Update blockchain_registry status
    if (queryNormalized.includes('UPDATE blockchain_registry SET registry_status = $1')) {
      const targetId = params[params.length - 1];
      const found = memDB.blockchainRegistry.find(r => r.credential_id === targetId || r.credential_hash === targetId);
      if (found) {
        found.registry_status = params[0];
        if (params.length > 2 && typeof params[1] === 'string') {
          found.transaction_hash = params[1];
        }
        found.updated_at = new Date();
        return { rows: [found] };
      }
      return { rows: [] };
    }

    // 38. Insert into blockchain_did_registry
    if (queryNormalized.startsWith('INSERT INTO blockchain_did_registry')) {
      const newDidRecord = {
        did: params[0],
        did_hash: params[1],
        blockchain_network: params[2] || 'hardhat',
        chain_id: params[3] || 31337,
        contract_address: params[4],
        transaction_hash: params[5],
        block_number: params[6] || 1,
        registered_at: new Date()
      };
      memDB.blockchainDidRegistry.unshift(newDidRecord);
      return { rows: [newDidRecord] };
    }

    // 39. Query blockchain_did_registry
    if (queryNormalized.includes('FROM blockchain_did_registry')) {
      if (queryNormalized.includes('WHERE did = $1')) {
        const found = memDB.blockchainDidRegistry.find(r => r.did === params[0] || r.did_hash === params[0]);
        return { rows: found ? [found] : [] };
      }
      return { rows: [...memDB.blockchainDidRegistry] };
    }

    // Phase 6: Verification Challenges Query Handlers
    // 40. Insert into verification_challenges
    if (queryNormalized.startsWith('INSERT INTO verification_challenges')) {
      const newChallenge = {
        id: `vc-chg-uuid-${Date.now()}`,
        challenge_id: params[0],
        officer_id: params[1],
        officer_did: params[2],
        nonce: params[3],
        audience: params[4] || 'trustgov-citizen-verifier',
        issued_at: params[5] ? new Date(params[5]) : new Date(),
        expires_at: params[6] ? new Date(params[6]) : new Date(Date.now() + 5 * 60 * 1000),
        used_at: null,
        status: params[7] || 'PENDING',
        created_at: new Date(),
        updated_at: new Date()
      };
      memDB.verificationChallenges.unshift(newChallenge);
      return { rows: [newChallenge] };
    }

    // 41. Query verification_challenges by challenge_id or officer_id
    if (queryNormalized.includes('FROM verification_challenges')) {
      if (queryNormalized.includes('WHERE challenge_id = $1')) {
        const found = memDB.verificationChallenges.find(c => c.challenge_id === params[0]);
        return { rows: found ? [found] : [] };
      }
      if (queryNormalized.includes('WHERE officer_id = $1')) {
        let results = memDB.verificationChallenges.filter(c => c.officer_id === params[0]);
        if (queryNormalized.includes("status = 'PENDING'")) {
          results = results.filter(c => c.status === 'PENDING' && new Date(c.expires_at) > new Date());
        }
        return { rows: results };
      }
      return { rows: [...memDB.verificationChallenges] };
    }

    // 42. Update verification_challenges status
    if (queryNormalized.startsWith('UPDATE verification_challenges SET status =')) {
      const targetId = params[params.length - 1];
      const found = memDB.verificationChallenges.find(c => c.challenge_id === targetId || c.id === targetId);
      if (found) {
        if (queryNormalized.includes("status = 'USED'")) {
          found.status = 'USED';
          found.used_at = params[0] ? new Date(params[0]) : new Date();
        } else if (queryNormalized.includes("status = 'EXPIRED'")) {
          found.status = 'EXPIRED';
        } else {
          found.status = params[0];
          if (params.length > 2 && params[1]) {
            found.used_at = new Date(params[1]);
          }
        }
        found.updated_at = new Date();
        return { rows: [found] };
      }
      return { rows: [] };
    }

    // Phase 7: Citizen Verification History Handlers
    // 43. Insert into citizen_verification_history
    if (queryNormalized.startsWith('INSERT INTO citizen_verification_history')) {
      const newHistory = {
        id: `cvh-id-${Date.now()}`,
        verification_id: params[0],
        citizen_id: params[1],
        verification_method: params[2],
        officer_reference: params[3],
        officer_name: params[4],
        department: params[5],
        credential_reference: params[6],
        result: params[7],
        failure_reason: params[8] || null,
        checks_summary: typeof params[9] === 'string' ? JSON.parse(params[9]) : params[9] || null,
        verified_at: params[10] ? new Date(params[10]) : null,
        created_at: new Date()
      };
      memDB.citizenVerificationHistory.unshift(newHistory);
      return { rows: [newHistory] };
    }

    // 44. Query citizen_verification_history
    if (queryNormalized.includes('FROM citizen_verification_history')) {
      if (queryNormalized.includes('WHERE verification_id = $1') && !queryNormalized.includes('citizen_id')) {
        const found = memDB.citizenVerificationHistory.find(h => h.verification_id === params[0]);
        return { rows: found ? [found] : [] };
      }
      if (queryNormalized.includes('citizen_id = $2')) {
        const found = memDB.citizenVerificationHistory.find(h => (h.id === params[0] || h.verification_id === params[0]) && h.citizen_id === params[1]);
        return { rows: found ? [found] : [] };
      }
      if (queryNormalized.includes('WHERE citizen_id = $1')) {
        const list = memDB.citizenVerificationHistory
          .filter(h => h.citizen_id === params[0])
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return { rows: list };
      }
      return { rows: [...memDB.citizenVerificationHistory] };
    }

    // Phase 8: Authorization Policy Handlers
    // 45. Insert into authorization_policies
    if (queryNormalized.startsWith('INSERT INTO authorization_policies')) {
      const newPolicy = {
        id: `auth-pol-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        policy_code: params[0],
        version: Number(params[1]) || 1,
        department: params[2],
        role: params[3],
        action_code: params[4],
        decision: params[5],
        constraints: typeof params[6] === 'string' ? JSON.parse(params[6]) : params[6] || {},
        description: params[7],
        status: params[8] || 'ACTIVE',
        effective_from: params[9] ? new Date(params[9]) : new Date(),
        effective_to: params[10] ? new Date(params[10]) : null,
        created_by: params[11] || null,
        created_at: new Date(),
        updated_at: new Date()
      };
      memDB.authorizationPolicies.push(newPolicy);
      return { rows: [newPolicy] };
    }

    // 46. Update authorization_policies
    if (queryNormalized.startsWith('UPDATE authorization_policies')) {
      if (queryNormalized.includes('status = $1') && queryNormalized.includes('WHERE id = $2')) {
        const found = memDB.authorizationPolicies.find(p => p.id === params[1]);
        if (found) {
          found.status = params[0];
          found.updated_at = new Date();
          return { rows: [found] };
        }
      }
      if (queryNormalized.includes("status = 'INACTIVE'") && queryNormalized.includes('WHERE policy_code = $1')) {
        const matching = memDB.authorizationPolicies.filter(p => p.policy_code === params[0] && (params[1] ? p.version !== Number(params[1]) : true));
        matching.forEach(p => { p.status = 'INACTIVE'; p.updated_at = new Date(); });
        return { rows: matching };
      }
      if (queryNormalized.includes('WHERE id = $1') || queryNormalized.includes('WHERE id = $')) {
        const idParam = params[params.length - 1];
        const found = memDB.authorizationPolicies.find(p => p.id === idParam);
        if (found) {
          found.updated_at = new Date();
          return { rows: [found] };
        }
      }
      return { rows: [] };
    }

    // 47. Query authorization_policies
    if (queryNormalized.includes('FROM authorization_policies')) {
      if (queryNormalized.includes('WHERE id = $1')) {
        const found = memDB.authorizationPolicies.find(p => p.id === params[0]);
        return { rows: found ? [found] : [] };
      }
      if (queryNormalized.includes('WHERE policy_code = $1 AND version = $2')) {
        const found = memDB.authorizationPolicies.find(p => p.policy_code === params[0] && p.version === Number(params[1]));
        return { rows: found ? [found] : [] };
      }
      if (queryNormalized.includes('WHERE policy_code = $1') && queryNormalized.includes('ORDER BY version DESC')) {
        const list = memDB.authorizationPolicies
          .filter(p => p.policy_code === params[0])
          .sort((a, b) => b.version - a.version);
        return { rows: list };
      }
      // Policy matching for engine: (department = $1 OR department = 'ALL') AND (role = $2 OR role = 'ALL') AND action_code = $3 AND status = 'ACTIVE'
      if (queryNormalized.includes('action_code') && queryNormalized.includes('status')) {
        const dept = params[0];
        const role = params[1];
        const action = params[2];
        const match = memDB.authorizationPolicies.find(p =>
          p.status === 'ACTIVE' &&
          p.action_code === action &&
          (p.department === dept || p.department === 'ALL') &&
          (p.role === role || p.role === 'ALL')
        );
        return { rows: match ? [match] : [] };
      }
      // General list / filter
      let list = [...memDB.authorizationPolicies];
      if (params && params.length > 0) {
        if (queryNormalized.includes('status = $1')) {
          list = list.filter(p => p.status === params[0]);
        }
      }
      return { rows: list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) };
    }

    // Phase 8: Authorization Evaluation History Handlers
    // 48. Insert into authorization_evaluations
    if (queryNormalized.startsWith('INSERT INTO authorization_evaluations')) {
      const newEval = {
        id: `ae-id-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        evaluation_id: params[0],
        citizen_id: params[1] || null,
        officer_reference: params[2],
        officer_name: params[3] || null,
        department: params[4] || null,
        credential_reference: params[5] || null,
        action_code: params[6],
        policy_code: params[7] || null,
        policy_version: params[8] ? Number(params[8]) : null,
        decision: params[9],
        risk_level: params[10],
        reason_codes: typeof params[11] === 'string' ? JSON.parse(params[11]) : params[11] || [],
        reasons: typeof params[12] === 'string' ? JSON.parse(params[12]) : params[12] || [],
        checks_summary: typeof params[13] === 'string' ? JSON.parse(params[13]) : params[13] || {},
        is_historical: Boolean(params[14]),
        evaluated_at: params[15] ? new Date(params[15]) : new Date(),
        created_at: new Date()
      };
      memDB.authorizationEvaluations.unshift(newEval);
      return { rows: [newEval] };
    }

    // 49. Query authorization_evaluations
    if (queryNormalized.includes('FROM authorization_evaluations')) {
      if (queryNormalized.includes('WHERE evaluation_id = $1') && !queryNormalized.includes('citizen_id')) {
        const found = memDB.authorizationEvaluations.find(e => e.evaluation_id === params[0]);
        return { rows: found ? [found] : [] };
      }
      if (queryNormalized.includes('citizen_id = $2')) {
        const found = memDB.authorizationEvaluations.find(e =>
          (e.id === params[0] || e.evaluation_id === params[0]) && e.citizen_id === params[1]
        );
        return { rows: found ? [found] : [] };
      }
      if (queryNormalized.includes('WHERE citizen_id = $1')) {
        const list = memDB.authorizationEvaluations
          .filter(e => e.citizen_id === params[0])
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return { rows: list };
      }
      return { rows: [...memDB.authorizationEvaluations] };
    }

    // 50. INSERT INTO scam_reports
    if (queryNormalized.includes('INSERT INTO scam_reports')) {
      const newReport = {
        id: params[0] || `rep-id-${Date.now()}`,
        report_id: params[1],
        citizen_id: params[2],
        officer_reference: params[3] || null,
        officer_name: params[4] || null,
        department: params[5] || null,
        verification_reference: params[6] || null,
        authorization_evaluation_reference: params[7] || null,
        report_category: params[8],
        description: params[9],
        reported_action_code: params[10] || null,
        risk_level: params[11] || 'UNKNOWN',
        status: 'SUBMITTED',
        submitted_at: params[12] ? new Date(params[12]) : new Date(),
        updated_at: params[12] ? new Date(params[12]) : new Date(),
        resolved_at: null,
        created_at: params[12] ? new Date(params[12]) : new Date()
      };
      memDB.scamReports.unshift(newReport);
      return { rows: [newReport] };
    }

    // 51. Query scam_reports
    if (queryNormalized.includes('FROM scam_reports')) {
      if (queryNormalized.includes('WHERE id = $1 OR report_id = $1') || queryNormalized.includes('WHERE report_id = $1') || queryNormalized.includes('WHERE id = $1')) {
        const found = memDB.scamReports.find(r => r.id === params[0] || r.report_id === params[0]);
        return { rows: found ? [found] : [] };
      }
      if (queryNormalized.includes('WHERE citizen_id = $1')) {
        const list = memDB.scamReports
          .filter(r => r.citizen_id === params[0])
          .sort((a, b) => new Date(b.submitted_at || b.created_at).getTime() - new Date(a.submitted_at || a.created_at).getTime());
        return { rows: list };
      }
      // Admin filter query
      let filtered = [...memDB.scamReports];
      // Match params if supplied
      if (params && params.length > 0) {
        if (queryNormalized.includes('status = $')) {
          const statusVal = params.find(p => ['SUBMITTED', 'UNDER_REVIEW', 'ADDITIONAL_INFORMATION_REQUIRED', 'RESOLVED', 'CLOSED'].includes(p));
          if (statusVal) filtered = filtered.filter(r => r.status === statusVal);
        }
        if (queryNormalized.includes('report_category = $')) {
          const catVal = params.find(p => typeof p === 'string' && !['SUBMITTED', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(p) && !p.startsWith('%'));
          if (catVal) filtered = filtered.filter(r => r.report_category === catVal);
        }
        if (queryNormalized.includes('risk_level = $')) {
          const riskVal = params.find(p => ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'UNKNOWN'].includes(p));
          if (riskVal) filtered = filtered.filter(r => r.risk_level === riskVal);
        }
        const searchParam = params.find(p => typeof p === 'string' && p.startsWith('%') && p.endsWith('%'));
        if (searchParam) {
          const term = searchParam.replace(/%/g, '').toLowerCase();
          filtered = filtered.filter(r =>
            (r.report_id && r.report_id.toLowerCase().includes(term)) ||
            (r.officer_reference && r.officer_reference.toLowerCase().includes(term)) ||
            (r.description && r.description.toLowerCase().includes(term))
          );
        }
      }
      filtered.sort((a, b) => new Date(b.submitted_at || b.created_at).getTime() - new Date(a.submitted_at || a.created_at).getTime());
      return { rows: filtered };
    }

    // 52. UPDATE scam_reports
    if (queryNormalized.includes('UPDATE scam_reports')) {
      // SET status = $1, updated_at = $2, resolved_at = $3 WHERE id = $4
      const targetId = params[3];
      const targetReport = memDB.scamReports.find(r => r.id === targetId || r.report_id === targetId);
      if (targetReport) {
        targetReport.status = params[0];
        targetReport.updated_at = params[1] ? new Date(params[1]) : new Date();
        targetReport.resolved_at = params[2] ? new Date(params[2]) : targetReport.resolved_at;
        return { rows: [targetReport] };
      }
      return { rows: [] };
    }

    // 53. INSERT INTO report_evidence
    if (queryNormalized.includes('INSERT INTO report_evidence')) {
      const newEv = {
        id: params[0] || `ev-id-${Date.now()}`,
        evidence_id: params[1],
        report_id: params[2],
        evidence_type: params[3] || 'OTHER',
        original_filename: params[4],
        stored_filename: params[5],
        mime_type: params[6],
        file_size: Number(params[7]),
        sha256_hash: params[8],
        storage_reference: params[9],
        description: params[10] || null,
        uploaded_by: params[11],
        uploaded_at: params[12] ? new Date(params[12]) : new Date(),
        created_at: new Date()
      };
      memDB.reportEvidence.push(newEv);
      return { rows: [newEv] };
    }

    // 54. Query report_evidence
    if (queryNormalized.includes('FROM report_evidence')) {
      if (queryNormalized.includes('COUNT(*)')) {
        const count = memDB.reportEvidence.filter(e => e.report_id === params[0]).length;
        return { rows: [{ count }] };
      }
      if (queryNormalized.includes('WHERE (id = $1 OR evidence_id = $1) AND report_id = $2')) {
        const found = memDB.reportEvidence.find(e =>
          (e.id === params[0] || e.evidence_id === params[0]) && e.report_id === params[1]
        );
        return { rows: found ? [found] : [] };
      }
      if (queryNormalized.includes('WHERE report_id = $1')) {
        const list = memDB.reportEvidence.filter(e => e.report_id === params[0]);
        return { rows: list };
      }
      return { rows: [...memDB.reportEvidence] };
    }

    // 55. INSERT INTO report_review_notes
    if (queryNormalized.includes('INSERT INTO report_review_notes')) {
      const newNote = {
        id: params[0] || `note-id-${Date.now()}`,
        report_id: params[1],
        note_id: params[2],
        reviewer_id: params[3],
        reviewer_name: params[4] || 'Admin Reviewer',
        note: params[5],
        created_at: params[6] ? new Date(params[6]) : new Date()
      };
      memDB.reportReviewNotes.push(newNote);
      return { rows: [newNote] };
    }

    // 56. Query report_review_notes
    if (queryNormalized.includes('FROM report_review_notes')) {
      if (queryNormalized.includes('WHERE report_id = $1')) {
        const list = memDB.reportReviewNotes.filter(n => n.report_id === params[0]);
        return { rows: list };
      }
      return { rows: [...memDB.reportReviewNotes] };
    }

    // 57. INSERT INTO ivr_sessions
    if (queryNormalized.includes('INSERT INTO ivr_sessions')) {
      const newSession = {
        id: params[0] || `ivr-id-${Date.now()}`,
        session_id: params[1],
        state: params[2] || 'WELCOME',
        status: params[3] || 'ACTIVE',
        caller_reference: params[4] || null,
        officer_reference: params[5] || null,
        verification_reference: params[6] || null,
        authorization_reference: params[7] || null,
        report_reference: params[8] || null,
        attempt_count: params[9] !== undefined ? Number(params[9]) : 0,
        max_attempts: params[10] !== undefined ? Number(params[10]) : 5,
        created_at: params[11] ? new Date(params[11]) : new Date(),
        expires_at: params[12] ? new Date(params[12]) : new Date(Date.now() + 5 * 60 * 1000),
        last_activity_at: params[13] ? new Date(params[13]) : new Date(),
        completed_at: params[14] ? new Date(params[14]) : null
      };
      memDB.ivrSessions.push(newSession);
      return { rows: [{ ...newSession }] };
    }

    // 58. Query ivr_sessions
    if (queryNormalized.includes('FROM ivr_sessions')) {
      if (queryNormalized.includes('session_id = $1') || queryNormalized.includes('id = $1')) {
        const found = memDB.ivrSessions.find(s => s.session_id === params[0] || s.id === params[0]);
        return { rows: found ? [{ ...found }] : [] };
      }
      if (queryNormalized.includes('WHERE status = $1')) {
        const found = memDB.ivrSessions.filter(s => s.status === params[0]);
        return { rows: found.map(s => ({ ...s })) };
      }
      return { rows: memDB.ivrSessions.map(s => ({ ...s })) };
    }

    // 59. UPDATE ivr_sessions
    if (queryNormalized.includes('UPDATE ivr_sessions')) {
      // Find session by session_id (the last param in WHERE session_id = $N)
      const targetIdentifier = params[params.length - 1];
      const targetSession = memDB.ivrSessions.find(s => s.session_id === targetIdentifier || s.id === targetIdentifier);
      if (targetSession) {
        if (queryNormalized.includes('state = $1') && queryNormalized.includes('status = $2')) {
          targetSession.state = params[0];
          targetSession.status = params[1];
          targetSession.officer_reference = params[2];
          targetSession.verification_reference = params[3];
          targetSession.authorization_reference = params[4];
          targetSession.report_reference = params[5];
          targetSession.attempt_count = Number(params[6]);
          targetSession.last_activity_at = params[7] ? new Date(params[7]) : new Date();
          targetSession.completed_at = params[8] ? new Date(params[8]) : targetSession.completed_at;
        } else {
          // General field assignment if customized
          if (queryNormalized.includes('status = $1')) targetSession.status = params[0];
          if (queryNormalized.includes('state = $1')) targetSession.state = params[0];
          if (queryNormalized.includes('attempt_count = attempt_count + 1')) targetSession.attempt_count += 1;
          targetSession.last_activity_at = new Date();
        }
        return { rows: [{ ...targetSession }] };
      }
      return { rows: [] };
    }

    // 60. DELETE FROM ivr_sessions
    if (queryNormalized.includes('DELETE FROM ivr_sessions')) {
      memDB.ivrSessions = [];
      return { rows: [] };
    }

    console.warn(`MemoryPool unhandled query: ${queryNormalized}`);
    return { rows: [] };
  }
}

const memoryPoolInstance = new MemoryPool();

// Real Database Pool initialization
let activePool: any;
let isFallback = false;

if (connectionString) {
  activePool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
  });

  // Check connection
  activePool.query('SELECT NOW()').then((res: any) => {
    console.log('Database connected successfully (Real PostgreSQL) at:', res.rows[0].now);
  }).catch((err: any) => {
    console.error('Real Database connection failed. Falling back to memory database.');
    isFallback = true;
    activePool = memoryPoolInstance;
  });
} else {
  console.log('No DATABASE_URL provided. Operating in static Memory Database Mode.');
  isFallback = true;
  activePool = memoryPoolInstance;
}

export const pool = {
  query: (text: string, params?: any[]) => {
    if (isFallback) {
      return memoryPoolInstance.query(text, params);
    }
    return activePool.query(text, params).catch((err: any) => {
      console.warn('Real pool query failed. Intercepting and executing with in-memory DB fallback.');
      isFallback = true;
      activePool = memoryPoolInstance;
      return memoryPoolInstance.query(text, params);
    });
  },
  connect: async () => {
    if (isFallback) {
      return {
        query: (text: string, params?: any[]) => memoryPoolInstance.query(text, params),
        release: () => {}
      };
    }
    try {
      const client = await activePool.connect();
      return client;
    } catch (err) {
      console.warn('activePool.connect failed. Falling back to Memory client.');
      isFallback = true;
      activePool = memoryPoolInstance;
      return {
        query: (text: string, params?: any[]) => memoryPoolInstance.query(text, params),
        release: () => {}
      };
    }
  }
};

export { memDB };
