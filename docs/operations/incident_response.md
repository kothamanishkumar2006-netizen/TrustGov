# TrustGov Security Incident Response Playbooks

## 1. Overview
This document specifies standard operating procedures for detecting, containing, investigating, eradicating, and recovering from security incidents involving the TrustGov platform.

The Incident Response Team (IRT) comprises the Security Lead, Lead Backend Engineer, Database Administrator, and Legal/Compliance Officer.

---

## 2. Standard Incident Lifecycle Phases
1. **Identification / Triage**: Detection via automated alerts, log monitoring, or citizen reports; determine severity (P1-Critical to P4-Low).
2. **Containment**: Short-term measures to prevent further damage or data exfiltration.
3. **Eradication**: Removal of malicious artifacts, closing of attack vectors, and credential revocation.
4. **Recovery**: Safe restoration of affected systems, integrity verification, and traffic resumption.
5. **Post-Incident Review (Lessons Learned)**: Root cause analysis, documentation, and prevention hardening.

---

## 3. Incident Playbooks (10 Scenarios)

### Playbook 1: Compromised Admin Account
- **Detection**: Anomaly in audit logs: Admin login from unrecognized IP; creation of unauthorized officers; policy status changes outside business hours.
- **Containment**:
  1. Immediately suspend admin user: `UPDATE users SET status = 'SUSPENDED' WHERE id = '<compromised_admin_id>';`
  2. Terminate all active sessions by invalidating JWT tokens (rotate `JWT_SECRET` or ban token IDs).
- **Eradication**:
  1. Audit all actions performed by the compromised account in `audit_logs`.
  2. Revert any unauthorized officer registrations, credential issuances, or policy changes.
- **Recovery**: Reset administrator credentials; mandate hardware MFA security keys for all admins.

### Playbook 2: Compromised Officer Ed25519 Signing Key
- **Detection**: Challenge signed when officer was not on duty; officer reports lost device/laptop containing `.keystore` vault.
- **Containment**:
  1. Admin immediately revokes officer's active Verifiable Credential:
     `PATCH /api/admin/credentials/:id/status` with `status: "REVOKED"`, `reason: "KEY_COMPROMISE"`.
  2. Admin updates officer status: `PATCH /api/admin/officers/:id/status` -> `SUSPENDED`.
  3. Anchor revocation transaction to the blockchain smart contract registry (`TrustGovRegistry.sol`).
- **Eradication**:
  1. Delete compromised key files from `.keystore/` vault or KMS.
  2. Invalidate any pending verification challenges issued for this officer.
- **Recovery**:
  1. Generate new keypair using `POST /api/admin/officers/:id/provision-key`.
  2. Issue new Verifiable Credential with new DID public key multibase.
  3. Re-anchor to blockchain.

### Playbook 3: Leaked JWT Signing Secret
- **Detection**: Discovery of `JWT_SECRET` in public repository, application logs, or external bug report.
- **Containment**:
  1. Rotate `JWT_SECRET` immediately in production environment variables.
  2. Restart all backend server instances. This immediately invalidates all existing issued JWT tokens across all users.
- **Eradication**:
  1. Remove secret from history or logs.
  2. Review audit logs for unauthorized logins during exposure window.
- **Recovery**:
  1. Notify legitimate users to log in again.
  2. Validate that startup validator enforces minimum 32-character high-entropy secret.

### Playbook 4: Database Credential Compromise / Direct DB Access
- **Detection**: High-volume unusual queries; external connections to port 5432; alerts from database monitoring.
- **Containment**:
  1. Rotate database master passwords immediately.
  2. Restrict PostgreSQL security groups / firewall to allow only backend API internal VPC IP addresses.
  3. Terminate all existing database connections:
     `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'trustgov_production';`
- **Eradication**:
  1. Inspect tables for unauthorized modifications, drops, or newly injected admin accounts.
  2. Verify evidence SHA-256 digests against off-chain files.
- **Recovery**: Restore from last known uncompromised snapshot if tampering is detected.

### Playbook 5: Evidence Storage Tampering or Breach
- **Detection**: Integrity check failures (`INTEGRITY_MISMATCH` alerts) on `GET /api/citizen/reports/:id/evidence/:id/integrity`.
- **Containment**:
  1. Set evidence storage directory permissions to read-only (`chmod -R 500 /var/trustgov/storage/evidence`).
  2. Isolate compromised storage volume.
- **Eradication**:
  1. Compare stored disk bytes against immutable SHA-256 hashes recorded at upload time in PostgreSQL.
  2. Restore tampered files from immutable WORM backup archives (AWS S3 Object Lock).
- **Recovery**: Verify 100% hash agreement across all evidence records before lifting read-only restriction.

### Playbook 6: Blockchain Deployer Key Compromise
- **Detection**: Unauthorized transactions sent to `TrustGovRegistry` smart contract; ownership transfer event emitted.
- **Containment**:
  1. If contract ownership is intact, transfer ownership immediately to a multisig cold wallet (`transferOwnership`).
  2. Drain remaining gas funds from the compromised deployer wallet.
- **Eradication**: Deploy new registry contract if contract ownership was stolen; migrate valid DID and Credential hashes to new contract.
- **Recovery**: Update `TRUSTGOV_REGISTRY_ADDRESS` in backend configuration and restart servers.

### Playbook 7: Telephony / IVR Provider Credential Compromise
- **Detection**: Spike in IVR sessions; unusual telephony provider API usage from foreign regions; high SMS/voice bill.
- **Containment**:
  1. Log in to telephony provider portal (Twilio/Exotel) and revoke active API Key/Auth Token.
  2. Regenerate API Secret.
  3. Switch IVR gateway to maintenance message or secondary carrier.
- **Eradication**: Audit call logs on the telephony provider dashboard for unauthorized outbound calls or spoofed caller IDs.
- **Recovery**: Update `IVR_PROVIDER_API_KEY` and `IVR_PROVIDER_SECRET` in environment variables and restart backend.

### Playbook 8: Large-Scale API Abuse / Distributed Denial of Service (DDoS)
- **Detection**: Error rate spikes (502 Bad Gateway / 429 Too Many Requests); CPU utilization reaching 100%.
- **Containment**:
  1. Enable Cloudflare / AWS WAF Under Attack Mode.
  2. Enforce aggressive rate limiting at CDN/reverse proxy edge.
  3. Block offending IP ranges and user agents.
- **Eradication**: Identify attacked endpoints; if targeting verification or challenge creation, tighten rate limit windows (`verificationLimiter`).
- **Recovery**: Scale backend container instances horizontally via Docker Swarm or Kubernetes.

### Playbook 9: Data Leakage / PII Exposure
- **Detection**: Public pastebin or web search indexing citizen phone numbers or scam report descriptions.
- **Containment**:
  1. Identify affected public reference or endpoint.
  2. Temporarily disable compromised public lookup endpoint while patch is deployed.
- **Eradication**:
  1. Inspect response serialization in controllers to ensure zero PII fields are included.
  2. Contact hosting providers for takedown of leaked data.
- **Recovery**: Deploy sanitized endpoints; publish transparency notice according to applicable data privacy laws.

### Playbook 10: Suspicious System Activity / Zero-Day Vulnerability
- **Detection**: Unhandled exceptions with shell commands; unexpected child processes spawned in container; core dump alerts.
- **Containment**:
  1. Isolate the affected container or VM from the internal network.
  2. Capture volatile memory dump and container state for forensics.
  3. Reroute traffic to redundant standby cluster.
- **Eradication**: Analyze exploit payload; develop and test hotfix patch in staging.
- **Recovery**: Deploy hotfix container; execute full regression test suite (311+ tests).
