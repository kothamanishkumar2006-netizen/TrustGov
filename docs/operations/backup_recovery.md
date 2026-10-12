# TrustGov Backup, Recovery & Disaster Planning Runbook

## 1. Overview
This runbook provides operational guidance for establishing, automating, testing, and verifying system backups and disaster recovery across the TrustGov architecture.

The objective is to achieve a Recovery Point Objective (RPO) of < 1 hour and a Recovery Time Objective (RTO) of < 2 hours for all core citizen verification, evidence preservation, and officer directory services.

---

## 2. Core Backup Components

### 2.1 PostgreSQL Database Backups
The database contains users, officers, credentials, audit logs, authorization policies, scam reports, and verification history.

- **Continuous Archiving**: Enable PostgreSQL Write-Ahead Logging (WAL) archiving to an offsite secure storage bucket.
- **Daily Full Logical Backup**:
  ```bash
  # Execute automated daily database dump
  pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME -Fc -f "/backups/db/trustgov_$(date +%Y%m%d_%H%M%S).dump"
  ```
- **Encryption**: Backup files must be encrypted with AES-256 (GPG or AWS KMS client-side encryption) before transmission over network boundaries:
  ```bash
  gpg --batch --yes --encrypt --recipient ops@trustgov.gov.in "/backups/db/trustgov_$(date +%Y%m%d_%H%M%S).dump"
  ```

### 2.2 Evidence Storage Backups
Physical evidence files (screenshots, audio recordings, PDFs) reside in `storage/evidence/`.

- **Backup Strategy**: Daily incremental synchronization using cryptographic hash comparison:
  ```bash
  # Synchronize evidence files to remote encrypted object store
  aws s3 sync /var/trustgov/storage/evidence s3://trustgov-evidence-backup/evidence/ \
    --sse aws:kms \
    --sse-kms-key-id <KMS_KEY_ARN>
  ```
- **Immutability (Object Lock)**: Enable WORM (Write-Once-Read-Many) retention policies to ensure uploaded evidence cannot be tampered with or overwritten in backup archives.

### 2.3 Blockchain Registry Metadata
The smart contract on Ethereum/Sepolia/Consortium L2 maintains immutable state on-chain.
- Maintain versioned backups of `backend/src/config/deployed-registry.json` containing:
  - Contract deployed address (`TRUSTGOV_REGISTRY_ADDRESS`)
  - Deployment transaction hash and block number
  - Contract ABI definition
- Re-sync script (`syncBlockchainState.ts`) to verify on-chain registry matches database records.

### 2.4 Configuration & Key Custody Backups
- Application environment configurations (`.env`) must NOT be backed up in plaintext.
- Secrets must be managed via HashiCorp Vault, AWS Secrets Manager, or Azure Key Vault.
- In production, cryptographic signing keys reside in Hardware Security Modules (HSMs) or Cloud KMS and must follow vendor quorum-based disaster recovery procedures (M-of-N key recovery).

---

## 3. Disaster Recovery & Restoration Procedures

### 3.1 Scenario 1: Database Corruption or Data Loss
1. **Isolate Environment**: Stop backend API instances to halt writes.
2. **Provision Clean Database**:
   ```bash
   createdb -h $DB_HOST -U $DB_USER trustgov_recovery
   ```
3. **Restore from Latest Verified Dump**:
   ```bash
   pg_restore -h $DB_HOST -U $DB_USER -d trustgov_recovery -v /backups/db/latest_verified.dump
   ```
4. **Replay WAL Archives**: Apply Write-Ahead Logs up to the target timestamp before failure.
5. **Run Database Integrity Verification**:
   ```bash
   npm run verify:db-integrity
   ```
6. **Switch Connection Pool**: Update `DATABASE_URL` in environment and restart backend service.

### 3.2 Scenario 2: Evidence Storage Volume Loss
1. **Provision New Storage Volume**: Mount clean volume at `/var/trustgov/storage/evidence`.
2. **Restore Files from S3/Cold Storage**:
   ```bash
   aws s3 sync s3://trustgov-evidence-backup/evidence/ /var/trustgov/storage/evidence/
   ```
3. **Verify Evidence SHA-256 Hashes**:
   Execute the automated integrity validation script to compare disk bytes against database hashes:
   ```bash
   node -e "
   const { verifyAllEvidenceIntegrity } = require('./dist/services/reportStorage');
   verifyAllEvidenceIntegrity();
   "
   ```
4. Confirm zero integrity mismatches before reopening evidence portal.

---

## 4. Backup Verification Schedule
- **Automated Daily Smoke Test**: Automated cron job creates a test database from the daily backup, executes a read-only query suite, and alerts on failure.
- **Monthly Disaster Drill**: Engineering team restores a full staging environment from production backup archives and verifies:
  1. Officer credential validation
  2. DID resolution
  3. Evidence integrity verification
  4. Public reference lookups
