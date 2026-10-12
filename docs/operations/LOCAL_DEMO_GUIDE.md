# TRUSTGOV LOCAL DEMONSTRATION & OPERATIONAL RUNBOOK

**Target Audience:** Evaluators, Engineers, Solutions Architects, and Demonstration Presenters  
**Purpose:** Reproducible 5-minute local walkthrough of the TrustGov verification, risk authorization, and anti-scam platform.  
**Version:** 1.0 (Phase 12 Productization)  

---

## 1. PREREQUISITES & ENVIRONMENT SETUP

### System Requirements
- **Operating System:** Windows 10/11, macOS, or Linux
- **Runtime:** Node.js v20.x or v22.x LTS
- **Package Manager:** npm v10.x or v11.x
- **Network Ports:**
  - `5000`: TrustGov Express Backend API
  - `5173`: TrustGov Vite Frontend Dev Server
  - `8545`: (Optional) Local Hardhat EVM Blockchain Node

### Quick Verification Check
Ensure required ports are available before launching:
```powershell
# Windows PowerShell port check
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 5000, 5173 }
```

---

## 2. RELIABLE LOCAL STARTUP PROCEDURE

### Option A: Standard Two-Terminal Startup (Recommended)

#### Terminal 1 — Backend API Service
```powershell
# Navigate to backend directory
cd backend

# Build and start server
npm run build
node dist/server.js
```
*Expected Output:*
```
TrustGov Backend running in development mode on port 5000
No DATABASE_URL provided. Operating in static Memory Database Mode.
```

#### Terminal 2 — Frontend Application
```powershell
# Navigate to frontend directory
cd frontend

# Launch Vite development server
npm run dev
```
*Expected Output:*
```
  VITE v5.4.21  ready in ~500 ms
  ➜  Local:   http://localhost:5173/
```

### Option B: Root Concurrent Startup
```powershell
# From project root
npm run dev
```

---

## 3. DEMONSTRATION ACCOUNTS & PRE-SEEDED TEST DATA

All pre-seeded accounts utilize safe demonstration passwords and isolated in-memory test profiles. **No real personal data or production credentials exist in this environment.**

| Role | Email | Password | Pre-seeded Context / Identifiers |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@trustgov.demo` | `password123` | Full access to Officer Directory, Policy Management, Scam Reports, and IVR Simulator. |
| **Verified Officer** | `officer@trustgov.demo` | `password123` | Code: `TG-OFF-001`<br>Name: Demo Officer Rajesh Kumar<br>Agency: Demo Central Investigation Bureau |
| **Citizen** | `citizen@trustgov.demo` | `password123` | Name: Demo Citizen Ramesh<br>Can perform verifications, evaluate requests, and file scam reports. |

### Key Fictional Officer Codes for Testing
- `TG-OFF-001`: **ACTIVE** — Demo Officer Rajesh Kumar (CIB Superintendent)
- `TG-OFF-002`: **ACTIVE** — Demo Officer Anita Desai (Enforcement Directorate Assistant Director)
- `TG-OFF-003`: **ACTIVE** — Demo Officer Vikram Singh (Income Tax Deputy Commissioner)
- `TG-OFF-005`: **SUSPENDED** — Demo Officer Priya Sharma (Demonstrates suspension lockouts)
- `TG-OFF-006`: **EXPIRED CREDENTIAL** — Demo Officer Amit Patel (Demonstrates expired credential rejection)

---

## 4. THE 5-MINUTE DEMONSTRATION SCRIPT & WALKTHROUGH

### Minute 1: The Impersonation Problem (Context)
- **Presenter Script:**
  > *"Every month, citizens lose billions to impersonation scams — callers claiming to be police or tax officers threatening 'digital arrest' and demanding immediate money transfers via UPI. TrustGov solves this with a zero-trust cryptographic verification system backed by blockchain immutability and server-side risk policies."*
- **Action:** Open `http://localhost:5173/login`. Point out the clean security branding and role-based login gateways.

### Minute 2: Officer Identity & Cryptographic Verification
- **Presenter Script:**
  > *"A citizen receives a suspicious call from someone claiming to be SP Rajesh Kumar of the Central Investigation Bureau. Let's verify their badge in real-time."*
- **Action:**
  1. Click the **Demo Citizen** quick-access button and enter the dashboard at `/citizen`.
  2. Select the **Officer Code** tab and input `TG-OFF-001`.
  3. Click **Run Verification Checks**.
  4. Show the multi-tier result:
     - Badge & Officer Record: **VERIFIED** (Green).
     - W3C Verifiable Credential: **ACTIVE** & Cryptographically Valid.
     - Blockchain Immutability: Anchored on-chain in `TrustGovRegistry`.

### Minute 3: The Suspicious Request & Authoritative Policy Denial
- **Presenter Script:**
  > *"Even if an officer is genuine, that does not give them the right to demand money or OTPs. TrustGov incorporates a server-side authorization engine to protect citizens against unlawful demands."*
- **Action:**
  1. Scroll down to the **Action Authorization & Safety Center** on the Citizen Dashboard.
  2. Keep Officer Code as `TG-OFF-001`.
  3. Select Requested Action: **Personal UPI Payment Demand (`REQUEST_UPI_PAYMENT`)**.
  4. Click **Evaluate Action Safety & Authorization**.
  5. Point out the outcome:
     - Decision: **DENY** (Bold Red indicator — zero green elements).
     - Risk Level: **CRITICAL**.
     - Clear Citizen Warning: *"Real government officers never solicit payments to personal UPI IDs or bank accounts. This demand is unlawful."*

### Minute 4: Incident Reporting & Evidence Vault
- **Presenter Script:**
  > *"TrustGov allows the citizen to immediately preserve digital evidence and file a tamper-resistant report."*
- **Action:**
  1. Click **Report Suspicious Request** from the warning card.
  2. The report modal opens pre-filled with Category: `PAYMENT_DEMAND` and Officer: `TG-OFF-001`.
  3. Enter a quick description: *"Caller demanded Rs 50,000 for digital arrest clearance."*
  4. Click **Submit Suspicious Incident Report**.
  5. Record the generated reference (e.g. `TG-REPORT-XXXXXXXX`).
  6. Explain that uploaded evidence has its SHA-256 hash calculated server-side for chain-of-custody preservation.

### Minute 5: Administrative Triage & Phone Accessibility (IVR)
- **Presenter Script:**
  > *"Administrators can immediately review incidents and add confidential notes. And for citizens without internet or smartphones, our voice telephony gateway provides equivalent protection."*
- **Action:**
  1. Log out, authenticate as **Demo Admin** (`admin@trustgov.demo`).
  2. Navigate to `/admin/reports`, locate the newly submitted report, and show how the status transitions to `Under Review`. Show internal confidential investigator notes.
  3. Navigate to `/admin/ivr-simulator`. Click **Start Call Simulation**.
  4. Press keypad `1` (Verify Officer) → Enter `TG-OFF-001` → Show that the voice gateway speaks the verification result and provides voice-friendly safety guidance.
  5. Click **End Call**.

---

## 5. SIMULATED VS. LIVE INTEGRATION DISCLOSURE

To maintain technical honesty during presentations, clearly explain the integration tiers:

| Subsystem | Local Demo Mode | Production Architecture Equivalent |
| :--- | :--- | :--- |
| **Blockchain Anchor** | Hardhat Local EVM / In-Memory Mock Registry | Ethereum Sepolia Testnet or Polygon PoS / Arbitrum L2 |
| **Database** | In-Memory Database Fallback (`InMemoryDB`) | Managed PostgreSQL with SSL (e.g. Supabase, AWS RDS) |
| **Key Custody** | Local Mock Keystore (`.keystore/`) | Hardware Security Module (HSM) / AWS CloudHSM / KMS |
| **IVR Gateway** | Interactive In-Browser DTMF Audio Simulator | Twilio Voice Webhooks / Exotel / Plivo Telephony Gateway |
| **Evidence Storage** | Local Disk Isolation (`storage/evidence/`) | S3-Compatible Encrypted Object Store with Immutable WORM policies |

---

## 6. DATA RESET & TROUBLESHOOTING

### How to Reset Demo State
Because the local environment defaults to the deterministic `InMemoryDB` state when no external PostgreSQL is connected:
1. Restart the backend process:
   ```powershell
   # Stop backend (Ctrl+C in terminal) and restart
   node dist/server.js
   ```
2. The in-memory database will immediately reset to its pristine seeded state (6 demo officers, 3 users, standard baseline reports, and clean verification logs).

### Common Startup Issues & Fixes
- **Port 5000 already in use:**
  - Run `Get-NetTCPConnection -LocalPort 5000` to find the process ID (`OwningProcess`).
  - Stop the process with `Stop-Process -Id <PID>`.
- **Frontend fails to reach backend:**
  - Ensure the backend is running on `http://localhost:5000`.
  - Vite is pre-configured to proxy `/api` requests to port 5000 in `vite.config.ts`.
- **Browser caching old session:**
  - Click "Logout Securely" in the top-right header, or use an Incognito/Private window.
