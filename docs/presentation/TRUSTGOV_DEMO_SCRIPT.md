# TRUSTGOV — LIVE DEMONSTRATION SCRIPT & WALKTHROUGH RUNBOOK

**Target Audience:** Evaluators, Hackathon Judges, Academic Review Panels, Technical Evaluators  
**Demo Duration:** 5 to 7 Minutes  
**Operating Environment:** Local Development / Prototype Mode (Port 5000 Backend, Port 5173 Frontend)  
**Security Notice:** All accounts use pre-seeded local demonstration credentials. No production secrets or personal data are used.

---

## 1. PRE-DEMO PREPARATION & FLIGHT CHECKS

### Step 1: Confirm Local Services are Running
Open Windows PowerShell and verify that ports 5000 (Backend) and 5173 (Frontend) are active:

```powershell
# Check active listening ports
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object LocalPort -in 5000, 5173 | Select-Object LocalPort, OwningProcess
```

- **If services are already running:**
  Test API health via curl or browser:
  `http://localhost:5000/api/health` $\rightarrow$ Returns `{"status":"ok","service":"trustgov"}`
  `http://localhost:5173/` $\rightarrow$ TrustGov Web Portal loads instantly.

- **If starting fresh from cold:**
  In Terminal 1 (Backend):
  ```powershell
  cd backend
  node dist/server.js
  ```
  In Terminal 2 (Frontend):
  ```powershell
  cd frontend
  npm run dev
  ```

### Step 2: Open Clean Browser Window
1. Open Google Chrome or Microsoft Edge in an **Incognito / Private Window** to prevent stale cookie interference.
2. Navigate to: `http://localhost:5173/login`
3. Confirm the page displays the TrustGov security shield header, role description cards, and quick-login action buttons.

### Step 3: Demonstration Personas Reference
Use the designated local demo personas pre-seeded in the system:

| Persona | Role Identifier | Email Address | Password Reference | Core Demonstration Objective |
| :--- | :---: | :--- | :--- | :--- |
| **Demo Citizen** | `CITIZEN` | `citizen@trustgov.demo` | *[Pre-seeded Demo Password]* | Officer badge verification, UPI demand evaluation, scam report submission |
| **Demo Administrator** | `ADMIN` | `admin@trustgov.demo` | *[Pre-seeded Demo Password]* | Incident report triage, confidential investigator notes, IVR telephone simulator |
| **Demo Officer** | `OFFICER` | `officer@trustgov.demo` | *[Pre-seeded Demo Password]* | Primary badge code: `TG-OFF-001` (Superintendent Rajesh Kumar, Demo CIB) |

*(Note: On the login screen, quick-access cards automatically populate the pre-seeded credentials for 1-click access.)*

---

## 2. STEP-BY-STEP LIVE DEMONSTRATION WORKFLOW

---

### ACT 1: Authentication & The Citizen Experience (0:00 – 1:00)

#### 1.1. Login Screen
- **Action:**
  1. Show the browser window at `http://localhost:5173/login`.
  2. Click the **Demo Citizen** quick-access card.
  3. Notice that the email and password fields are filled instantly with demo credentials.
  4. Click the primary **Access Dashboard** button.
- **Expected Visual Result:**
  - The browser redirects smoothly to `/citizen`.
  - The top navigation bar displays: TrustGov Shield logo, "Citizen Protection Dashboard", role badge "Citizen", and "Demo Citizen Ramesh" user tag.

#### 1.2. The Scam Scenario Context
- **Spoken Narration:**
  > *"Let us place ourselves in the shoes of a citizen named Ramesh. Ramesh receives an urgent phone call. The caller claims to be Superintendent Rajesh Kumar from the Central Investigation Bureau, flashing a badge with ID `TG-OFF-001` and claiming Ramesh's bank account has been flagged in a money laundering probe. Let's see how TrustGov protects Ramesh in seconds."*

---

### ACT 2: Cryptographic Officer Verification (1:00 – 2:30)

#### 2.1. Officer Code Verification
- **Action:**
  1. In the **Citizen Protection Dashboard** (`/citizen`), verify that the **Officer Code** tab is selected.
  2. In the input box labeled **Enter Officer Official Code**, type: `TG-OFF-001`.
  3. Click the primary blue button: **Run Verification Checks**.
- **Expected Visual Result:**
  - A subtle loading state displays briefly while the backend resolves the credential and blockchain anchor.
  - A prominent green status badge appears: **OFFICER VERIFIED (ACTIVE)**.
  - Officer Profile card displays:
    - **Name:** Demo Officer Rajesh Kumar
    - **Rank / Designation:** Superintendent of Police
    - **Department / Agency:** Demo Central Investigation Bureau
    - **Badge ID:** `TG-OFF-001`
  - Cryptographic Verification Details box displays:
    - **W3C Verifiable Credential Status:** `VALID & ACTIVE`
    - **Issuer DID:** `did:trustgov:demo:authority:issuance`
    - **Signature Standard:** Pure Ed25519 digital signature verified
    - **Blockchain Anchor:** Registered in `TrustGovRegistry` smart contract (`0x5FbDB2315678afecb367f032d93F642f64180aa3`)

#### 2.2. Explaining the Verification Multi-Tier Defense
- **Spoken Narration:**
  > *"Notice what just occurred. TrustGov didn't just look up a name in a database. It verified a W3C Verifiable Credential, validated the cryptographic Ed25519 digital signature, and checked that the credential hash is anchored immutably on the blockchain. We now know that Superintendent Rajesh Kumar is indeed a genuine officer."*

---

### ACT 3: Prohibited Demand Evaluation — The Core Anti-Scam Shield (2:30 – 3:45)

#### 3.1. Evaluating an Unlawful Demand
- **Action:**
  1. Scroll down to the second section on the dashboard: **Action Authorization & Safety Center**.
  2. Confirm the Officer Code field is pre-filled with `TG-OFF-001`.
  3. Click the **Requested Action** dropdown and select:
     **Demand Personal UPI / QR Code Transfer (`REQUEST_UPI_PAYMENT`)**.
  4. (Optional) In the Incident Context notes, type: *"Caller demands Rs 50,000 via Google Pay to avoid digital arrest."*
  5. Click the high-contrast button: **Evaluate Action Safety & Authorization**.

#### 3.2. Expected Visual Result & System Decision
- **Visual Outcome:**
  - An immediate, prominent **High-Contrast RED Alert Banner** appears on screen.
  - **Decision:** <span style="color:#ef4444;font-weight:bold;">DENY</span>
  - **Risk Rating:** <span style="color:#ef4444;font-weight:bold;">CRITICAL</span>
  - **Zero Green Indicators:** The UI strictly suppresses all green or positive indicators.
  - **Citizen Advisory Card:**
    > *"TrustGov Safety Warning: Real government officers never solicit payments to personal UPI accounts, digital wallets, or personal bank accounts. This demand is strictly prohibited under departmental policy and constitutes extortion."*
  - An actionable button appears immediately inside the warning: **Report Suspicious Request**.

#### 3.3. Key Presenter Highlight
- **Spoken Narration:**
  > *"This is the paradigm shift of TrustGov. Even though Superintendent Rajesh Kumar's identity is 100% authentic, the demand to transfer money to a personal UPI ID is strictly prohibited. Identity verification proves WHO someone is; our Authorization Engine determines WHAT they are allowed to ask. The system gives an unequivocal, bold red DENY."*

---

### ACT 4: Scam Reporting & Evidence Vault Integrity (3:45 – 5:00)

#### 4.1. Incident Report Submission
- **Action:**
  1. Click the **Report Suspicious Request** button directly within the red denial banner.
  2. A modal dialog opens titled **Submit Suspicious Incident Report**.
  3. Observe that the Category dropdown is pre-selected to **Payment Demand / Extortion (`PAYMENT_DEMAND`)** and Officer Code is pre-filled with `TG-OFF-001`.
  4. In the **Incident Description** textarea, enter:
     `"Caller impersonating SP Rajesh Kumar demanded Rs 50,000 UPI transfer for clearance of alleged money laundering charges."`
  5. Under **Optional Evidence Attachment**, click **Choose File** and select any sample image or text file (e.g., screenshot or notes).
  6. Click the blue submission button: **Submit Incident Report**.
- **Expected Visual Result:**
  - A success confirmation screen appears displaying a unique generated incident tracking code:
    `TG-REPORT-XXXXXXXX` (e.g., `TG-REPORT-7F3NRVXK`).
  - An alert states: *"Evidence file received. Server-side SHA-256 cryptographic digest calculated."*
  - Click **Done & View in My Reports**.
  - Show the citizen's incident report table displaying the newly registered incident with status `SUBMITTED`.

---

### ACT 5: Administrative Triage & Telephone IVR Simulator (5:00 – 6:30)

#### 5.1. Administrator Report Triage
- **Action:**
  1. In the top navigation bar, click the user menu and select **Logout Securely**.
  2. On the login screen, click the **Demo Administrator** quick-access card.
  3. Click **Access Dashboard**.
  4. Navigate to **Scam Incident Reports** (`/admin/reports`) via the admin navigation link.
  5. Find the report just filed by Citizen Ramesh (matching the tracking reference code).
  6. Click **Inspect Incident & Evidence**.
  7. Point out the **Evidence Integrity Status**: `VALID` (SHA-256 digest verified dynamically against disk).
  8. In the status dropdown, change status from `SUBMITTED` to `UNDER_REVIEW`.
  9. In the **Internal Investigator Notes** box, type:
     `"Assigned to Cyber Crime Cell Squad 4. Contacting telecommunications carrier to trace caller ID."`
  10. Click **Save Triage Updates**.
  11. Highlight that these investigator notes are strictly partitioned and inaccessible to citizens.

#### 5.2. Inclusive Telephony Gateway (IVR Simulator)
- **Action:**
  1. In the administrator menu, click **IVR Voice Simulator** (`/admin/ivr-simulator`).
  2. Point out the realistic telephone handset interface, active DTMF keypad, and live audio synthesizer.
  3. Click **Start Call Simulation**.
  4. The telephone state machine initializes session (e.g. `TG-IVR-XXXXXXXX`). The simulated voice announces:
     *"Welcome to the TrustGov National Officer Verification Hotline. Press 1 to verify an officer. Press 2 to evaluate a request. Press 3 to report a scam."*
  5. Click keypad button **1**.
  6. When prompted for officer code, enter `TG-OFF-001` and click **Submit DTMF**.
  7. Observe the audio readout and text transcript:
     *"Officer verified. Superintendent Rajesh Kumar, Central Investigation Bureau. Reminder: Official officers never ask for personal UPI payments or OTPs."*
  8. Click **End Call**.
- **Spoken Narration:**
  > *"For the millions of citizens who do not own smartphones or have access to mobile apps, this telephony gateway provides the exact same zero-trust verification and anti-scam warnings over standard telephone lines."*

---

## 3. DEMONSTRATION CONTINGENCY & ERROR RECOVERY

| Potential Scenario | Cause | Immediate Recovery Action |
| :--- | :--- | :--- |
| **Port 5000 not responding** | Backend process terminated or sleeping | In PowerShell: `cd backend; node dist/server.js`. Confirm `TrustGov Backend running...` |
| **Port 5173 not responding** | Frontend Vite server closed | In PowerShell: `cd frontend; npm run dev`. Refresh browser at `http://localhost:5173`. |
| **Browser displays cached session** | Previous login cookie retained | Click **Logout Securely** at top-right or use Incognito Mode (`Ctrl + Shift + N`). |
| **Data state needs reset** | Submissions from earlier dry runs | Restart backend process (`Ctrl+C` then `node dist/server.js`). Deterministic `InMemoryDB` resets to pristine seed instantly. |

---

## 4. HONEST PRESENTATION BOUNDARY STATEMENTS
When wrapping up the live demonstration, state clearly:
1. *"The blockchain registry shown is running on our local Hardhat EVM environment (`0x5FbDB2315678afecb367f032d93F642f64180aa3`), maintaining the exact ABI and bytecode targeted for Ethereum Sepolia testnet."*
2. *"The database is operating in high-fidelity deterministic in-memory mode, ready to bind to managed PostgreSQL via a single `DATABASE_URL` environment variable."*
3. *"The telephony gateway is an in-browser DTMF and speech synthesizer simulator, fully structured to connect to Twilio or Exotel carrier voice webhooks."*
