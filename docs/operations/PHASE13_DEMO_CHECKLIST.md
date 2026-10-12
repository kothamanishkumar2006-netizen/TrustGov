# TRUSTGOV PHASE 13 — FINAL DEMONSTRATION CHECKLIST & RUNBOOK

**Target Audience:** Evaluators, Demonstration Leads, System Architects  
**Purpose:** Ensure a 100% reliable, reproducible, and fault-tolerant presentation of TrustGov  
**Execution Context:** Local Prototype Mode (Deterministic In-Memory Engine, Hardhat EVM, In-Browser IVR)  
**Version:** 1.0 (Phase 13 Productization)  

---

## 1. PRE-DEMO FLIGHT CHECKS (RUN 5 MINUTES BEFORE DEMO)

### Step 1: Verify Port Availability & Service Health
Execute the following in Windows PowerShell:
```powershell
# Check whether ports 5000 and 5173 are listening
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 5000, 5173 }
```

- **If ports are ALREADY running:**
  Verify that the existing instances are healthy:
  ```powershell
  node -e "Promise.all([fetch('http://localhost:5000/api/health').then(r => r.json()), fetch('http://localhost:5173/api/health').then(r => r.json())]).then(([b, f]) => console.log('Backend:', b.status, '| Frontend Proxy:', f.status))"
  ```
  *Expected Output:* `Backend: ok | Frontend Proxy: ok`

- **If starting from cold:**
  ```powershell
  # Terminal 1: Backend
  cd backend
  node dist/server.js

  # Terminal 2: Frontend
  cd frontend
  npm run dev
  ```

### Step 2: Open Clean Browser Session
- Open a fresh Chrome Incognito / Private browser window at:
  `http://localhost:5173/login`
- Confirm that the TrustGov shield header, description, and quick-access cards load immediately.

---

## 2. DEMO PERSONAS & CREDENTIALS QUICK REFERENCE

All accounts utilize safe local demonstration credentials pre-seeded into the system:

| Persona | Role | Email | Password | Primary Objective in Demo |
| :--- | :---: | :--- | :--- | :--- |
| **Administrator** | `ADMIN` | `admin@trustgov.demo` | `password123` | Inspect Officer Directory (`TG-OFF-001`), view submitted scam reports, add internal review notes. |
| **Demo Officer** | `OFFICER` | `officer@trustgov.demo` | `password123` | Official Code: `TG-OFF-001` (Superintendent Rajesh Kumar, Demo Central Investigation Bureau). |
| **Demo Citizen** | `CITIZEN` | `citizen@trustgov.demo` | `password123` | Citizen Ramesh. Verify officer identity, evaluate dangerous UPI demands, file scam reports. |

---

## 3. STEP-BY-STEP 5-MINUTE DEMO SCRIPT

### Phase A: The Threat Context (30 Seconds)
- **What to say:**
  > *"Across the country, citizens face digital arrest scams where fraudsters impersonate police or tax officers, demanding emergency UPI transfers or OTPs. TrustGov solves this problem through zero-trust cryptographic identity and an authoritative server-side safety engine."*

### Phase B: Officer Verification (1 Minute 30 Seconds)
- **What to do:**
  1. On `http://localhost:5173/login`, click the **Demo Citizen** quick access card (auto-fills `citizen@trustgov.demo` / `password123`) and click **Access Dashboard**.
  2. In the **Citizen Protection Dashboard** (`/citizen`), select the **Officer Code** tab.
  3. Enter officer code: `TG-OFF-001`.
  4. Click **Run Verification Checks**.
- **What to point out on screen:**
  - **Badge Result:** Green **OFFICER VERIFIED** status.
  - **Identity Details:** Demo Officer Rajesh Kumar, Superintendent of Police, Demo Central Investigation Bureau.
  - **Cryptographic Evidence:** Active W3C Verifiable Credential (`VC-TG-TG-OFF-001-...`), Ed25519 digital signature valid, anchored in the `TrustGovRegistry` smart contract.

### Phase C: Prohibited Demand Evaluation — The Core Anti-Scam Shield (1 Minute)
- **What to say:**
  > *"A genuine officer badge is not a license to demand money. Even if the identity is authentic, let's see what happens when this officer demands an immediate UPI payment."*
- **What to do:**
  1. Scroll down to the **Action Authorization & Safety Center**.
  2. Keep Officer Code as `TG-OFF-001`.
  3. Select Requested Action: **Demand Personal UPI / QR Code Transfer (`REQUEST_UPI_PAYMENT`)**.
  4. Click **Evaluate Action Safety & Authorization**.
- **What to point out on screen:**
  - **Decision:** Authoritative **DENY** (High-contrast Red alert — zero green indicators).
  - **Risk Rating:** **CRITICAL**.
  - **Citizen Advice:** *"TrustGov Demo Safety Policy: Strict prohibition on personal UPI payments. Real government officers never ask citizens to transfer money to personal UPI accounts or wallets."*

### Phase D: Incident Reporting & Evidence Vault (1 Minute)
- **What to say:**
  > *"When an unlawful demand occurs, TrustGov enables immediate digital evidence preservation."*
- **What to do:**
  1. Click **Report Suspicious Request** directly from the denial alert.
  2. The Citizen Report Modal opens with pre-filled category `Payment Demand / Extortion` and officer reference `TG-OFF-001`.
  3. In Description, type: *"Caller demanded Rs 50,000 UPI transfer to resolve alleged money laundering investigation."*
  4. Click **Submit Suspicious Incident Report**.
  5. Note the generated report reference code (e.g. `TG-REPORT-XXXXXXXX`).
  6. Click **Done & View in My Reports**.

### Phase E: Administrative Review & Telephone Accessibility (1 Minute)
- **What to say:**
  > *"Administrators receive real-time incident reports for triage. And for citizens without smartphones or internet, our IVR voice gateway provides identical protection."*
- **What to do:**
  1. Log out securely via the top-right header button.
  2. Log in as **Demo Admin** (`admin@trustgov.demo` / `password123`).
  3. Navigate to **Scam Incident Reports** (`/admin/reports`). Show the newly submitted report, update status to `Under Review`, and show internal confidential investigator notes (which remain strictly hidden from citizen view).
  4. Navigate to **IVR Simulator** (`/admin/ivr-simulator`).
  5. Click **Start Call Simulation**.
  6. Send DTMF Keypad digit `1` (Verify Officer).
  7. When prompted, enter `TG-OFF-001` and send.
  8. Point out that the voice gateway speaks the verified officer identity and issues safety reminders over the phone.
  9. Click **End Call**.

---

## 4. INSTANT DEMO RESET PROCEDURE

If you need to reset the demonstration data to its pristine seeded state between presentation sessions:
1. Stop the backend process:
   ```powershell
   # If running in terminal: Press Ctrl+C
   # Or stop process by PID: Stop-Process -Id <PID>
   ```
2. Restart the backend process:
   ```powershell
   node backend/dist/server.js
   ```
3. Because the local environment uses the deterministic `InMemoryDB` fallback, restarting instantly re-seeds the pristine 6 demo officers, 3 default users, standard historical reports, and clear audit queues.

---

## 5. HONEST PRESENTATION BOUNDARIES

To maintain complete professional integrity, always disclose:
1. **Blockchain:** Local Hardhat EVM smart contract anchor (prototype registry at `0x5FbDB2315678afecb367f032d93F642f64180aa3`), not a live mainnet transaction.
2. **Database:** Deterministic in-memory database fallback, ready for managed PostgreSQL migration.
3. **Telephony:** In-browser DTMF telephony gateway simulator, ready for Twilio/Exotel carrier webhook integration.
4. **Government Integrations:** Demonstration agencies (Demo Central Investigation Bureau, Demo Enforcement Directorate) are realistic simulations.
