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
        department: departments[i],
        designation: designations[i],
        jurisdiction: jurisdictions[i],
        status: statuses[i],
        did: `did:trustgov:demo:${deptCode}:${codes[i].toLowerCase()}`,
        public_key: `04-${i}-mock-secp256k1-public-key-for-demo-purposes-${codes[i]}`,
        created_at: new Date(),
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
      const newUser = {
        id,
        name: params[0],
        email: params[1],
        phone: params[2],
        password_hash: params[3],
        role: 'CITIZEN',
        status: 'ACTIVE',
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
        return {
          rows: [{
            ...officer,
            officer_id: officer.id,
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
