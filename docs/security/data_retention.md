# TrustGov Data Retention & Lifecycle Policy

## 1. Overview
This policy defines the retention schedules, access controls, archival strategies, and secure deletion mechanisms for all data assets managed across TrustGov. 

Proper retention schedules prevent unbounded database growth, limit compliance liability, protect citizen privacy, and ensure evidentiary integrity for legitimate investigation workflows.

---

## 2. Retention Schedule by Data Category

### 2.1 Citizen User Accounts
- **Data Elements**: Name, email, phone number, password hash, role, status.
- **Retention Period**: Active for the duration of the account + 90 days following user-requested account closure.
- **Access Controls**: Restricted to account owner and authorized system administrators.
- **Deletion Procedure**: Cryptographic wipe of user record; cascading removal or anonymization of verification session references (`citizen_id = NULL`).

### 2.2 Government Officer Records & DIDs
- **Data Elements**: Officer code, full name, department, designation, jurisdiction, official email, DID document, status.
- **Retention Period**: Retained indefinitely while officer is in service. Upon retirement, transfer, or dismissal, record transitions to `REVOKED` or `SUSPENDED` status and is archived for 7 years for historical verification audits.
- **Access Controls**: Read-only public directory metadata; write access restricted strictly to Admin role.
- **Deletion Procedure**: Officer records are never hard-deleted to preserve cryptographic verification trail; records are permanently marked `REVOKED`.

### 2.3 Verifiable Credentials & Blockchain Anchors
- **Data Elements**: W3C Credential JSON payload, issuer signature, validFrom, validUntil, lifecycle status, blockchain transaction hashes.
- **Retention Period**: Active for credential validity period (default: 365 days). Once expired or revoked, retained for 10 years in cold storage for audit defense.
- **Access Controls**: Cryptographically verifiable by public; management restricted to Admin.
- **Deletion Procedure**: Off-chain payloads archived to immutable cold storage; on-chain blockchain records are immutable by design and permanently reflect `REVOKED` state.

### 2.4 Verification Sessions & Challenges
- **Data Elements**: Nonces, audience, officer DID, challenge timestamps, signature payloads, verification outcome.
- **Retention Period**:
  - Ephemeral challenges (`verification_challenges`): 5-minute active TTL. Once used or expired, purged after 30 days.
  - Verification history logs (`citizen_verification_history`): 180 days for citizen dashboard view; aggregated non-PII metrics retained permanently.
- **Access Controls**: Citizen-isolated for logged-in users; public lookup restricted to reference code summaries.
- **Deletion Procedure**: Automated scheduled cleanup job removing expired challenge nonces older than 30 days.

### 2.5 Action Authorization Evaluations
- **Data Elements**: Action code, evaluation reference (`TG-AUTH-XXXXXXXX`), decision (`ALLOW`/`DENY`/`REVIEW`), triggered reason codes, risk level.
- **Retention Period**: 365 days from evaluation date. Evaluations flagged as `DENY` with `CRITICAL` risk associated with active scam reports are retained for 3 years.
- **Access Controls**: Citizen-scoped view; public reference lookup.
- **Deletion Procedure**: Automated partition pruning for records older than retention threshold.

### 2.6 Scam Reports & Preserved Evidence Files
- **Data Elements**: Report reference (`TG-REPORT-XXXXXXXX`), claimed caller info, category, description, evidence file binaries, SHA-256 digests.
- **Retention Period**:
  - Unresolved or under-review reports: Retained for the duration of the investigation.
  - Resolved reports: Retained for 5 years in compliance with criminal evidence preservation standards.
  - Dismissed or spurious reports: 90 days before permanent deletion.
- **Access Controls**: Citizen owner (read-only); assigned investigators and Admin (full read/write).
- **Deletion Procedure**: Secure overwrite of physical disk bytes (`shred` or multi-pass overwrite) in `storage/evidence/` followed by database metadata deletion.

### 2.7 IVR Sessions & Voice Transcripts
- **Data Elements**: Session ID (`TG-IVR-XXXXXXXX`), tokenized caller ID (`TEL-XXXX`), DTMF input history, state transitions, duration.
- **Retention Period**: 30 days from session completion.
- **Access Controls**: Telephony service integration and system administrators.
- **Deletion Procedure**: Automated table truncation or daily batch delete of expired sessions.

### 2.8 Security Audit Logs
- **Data Elements**: Actor ID, action type, entity type, entity ID, metadata JSON, IP address, timestamp.
- **Retention Period**: 3 years in searchable hot storage; 7 years in compressed, write-once cold archival storage.
- **Access Controls**: Read-only for Security Operations and Audit Officers; write-only for application logger; zero update/delete permissions.
- **Deletion Procedure**: Automated rotation into encrypted long-term storage buckets (AWS S3 Glacier with Object Lock).
