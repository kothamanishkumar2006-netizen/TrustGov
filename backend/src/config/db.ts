import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcrypt';

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
  ivrsessions: any[] = [];
  didIdentities: any[] = [];

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
    }

    // Scam reports
    this.scamReports.push({
      id: 'scam-id-1',
      citizen_id: citizenId,
      caller_number: '+91 98765 43210',
      claimed_department: 'Demo Central Investigation Bureau',
      claimed_officer_name: 'Fake Inspector Malhotra',
      claimed_officer_id: 'TG-OFF-999',
      payment_requested: true,
      payment_amount: 50000.00,
      upi_id: 'malhotra@upi',
      description: 'Threatened arrest due to illegal parcel. Demanded immediate transfer to clear identity.',
      risk_score: 95,
      risk_level: 'CRITICAL',
      status: 'SUBMITTED',
      created_at: new Date(),
      updated_at: new Date()
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
      return { rows: user ? [user] : [] };
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

    // 11. Recent Scam Reports
    if (queryNormalized.includes('FROM scam_reports')) {
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
