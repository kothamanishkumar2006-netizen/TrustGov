/**
 * TRUSTGOV - PHASE 6: Signing-Key Custody Abstraction (KeyProvider)
 * 
 * Provides a secure, modular custody abstraction for officer Ed25519 signing keys.
 * 
 * CRITICAL SECURITY ARCHITECTURE:
 * 1. Private keys are NEVER stored in PostgreSQL, Supabase, JWTs, localStorage,
 *    sessionStorage, API responses, QR codes, audit logs, or blockchain.
 * 2. The rest of TrustGov MUST NOT directly access private key material.
 *    The application requests sign(canonicalPayload, officerId) and receives ONLY a signature.
 * 3. In this development/prototype provider, private key material is kept strictly
 *    in an uncommitted, local-only vault directory (.keystore/) with restrictive file permissions.
 * 4. Production implementations replace this with a Hardware Security Module (HSM),
 *    Cloud KMS (AWS KMS / GCP Cloud KMS), or an officer-controlled secure hardware enclave.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { generateEd25519KeyPair, GeneratedKeyPair } from './crypto';

export interface KeyMetadata {
  keyId: string;
  officerId: string;
  did: string;
  keyType: 'Ed25519';
  publicKeyMultibase: string;
  createdAt: string;
  status: 'ACTIVE' | 'REVOKED';
}

export interface IKeyProvider {
  createKey(officerId: string, did: string): Promise<{ publicKeyMultibase: string }>;
  getPublicKey(officerId: string): Promise<string | null>;
  sign(canonicalPayload: string, officerId: string): Promise<string>;
  keyExists(officerId: string): Promise<boolean>;
  getKeyMetadata(officerId: string): Promise<KeyMetadata | null>;
  rebindKey(officerId: string, did: string): Promise<{ publicKeyMultibase: string }>;
}

/**
 * Development & Prototype Signing-Key Store
 * Maintains keys isolated from the database and frontend.
 */
class DevelopmentKeyStore implements IKeyProvider {
  private keyDir: string;
  // In-memory cache of private key PEMs (strictly internal, never exposed)
  private memoryVault: Map<string, { privateKeyPem: string; metadata: KeyMetadata }> = new Map();

  constructor() {
    // Isolated local directory outside version control
    this.keyDir = path.resolve(__dirname, '../../../.keystore');
    this.ensureDirectory();
    this.loadExistingKeys();
  }

  private ensureDirectory() {
    try {
      if (!fs.existsSync(this.keyDir)) {
        fs.mkdirSync(this.keyDir, { recursive: true, mode: 0o700 });
      }
    } catch (err) {
      console.warn('DevelopmentKeyStore could not create .keystore directory, running in memory-only vault mode');
    }
  }

  private sanitizeId(id: string): string {
    return id.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  private loadExistingKeys() {
    try {
      if (!fs.existsSync(this.keyDir)) return;
      const files = fs.readdirSync(this.keyDir);
      for (const file of files) {
        if (file.endsWith('.meta.json')) {
          const officerId = file.replace('.meta.json', '');
          const metaPath = path.join(this.keyDir, file);
          const keyPath = path.join(this.keyDir, `${officerId}.key`);
          if (fs.existsSync(keyPath)) {
            const metadata: KeyMetadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            const privateKeyPem = fs.readFileSync(keyPath, 'utf8');
            this.memoryVault.set(metadata.officerId, { privateKeyPem, metadata });
          }
        }
      }
    } catch (e) {
      // Fallback
    }
  }

  /**
   * Generates a new Ed25519 signing keypair for an officer, associates it with their DID,
   * persists the private key strictly in the development vault, and returns ONLY the public key.
   */
  public async createKey(officerId: string, did: string): Promise<{ publicKeyMultibase: string }> {
    const keyPair: GeneratedKeyPair = generateEd25519KeyPair();
    const metadata: KeyMetadata = {
      keyId: `key-${Date.now()}`,
      officerId,
      did,
      keyType: 'Ed25519',
      publicKeyMultibase: keyPair.publicKeyMultibase,
      createdAt: new Date().toISOString(),
      status: 'ACTIVE'
    };

    // Store in memory vault
    this.memoryVault.set(officerId, {
      privateKeyPem: keyPair.privateKeyPem,
      metadata
    });

    // Write to local development file store with restricted permissions
    try {
      this.ensureDirectory();
      const safeId = this.sanitizeId(officerId);
      const keyPath = path.join(this.keyDir, `${safeId}.key`);
      const metaPath = path.join(this.keyDir, `${safeId}.meta.json`);

      fs.writeFileSync(keyPath, keyPair.privateKeyPem, { mode: 0o600 });
      fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), { mode: 0o600 });
    } catch (err) {
      // Memory vault handles transient fallback if filesystem is read-only
    }

    // Return ONLY public key
    return {
      publicKeyMultibase: keyPair.publicKeyMultibase
    };
  }

  /**
   * Rebinds / re-provisions a signing key for an officer whose private key was transient (Phase 3).
   * Generates a new keypair, registers it in the vault, and returns the new public key.
   */
  public async rebindKey(officerId: string, did: string): Promise<{ publicKeyMultibase: string }> {
    return this.createKey(officerId, did);
  }

  /**
   * Check if a signing key exists for this officer
   */
  public async keyExists(officerId: string): Promise<boolean> {
    if (this.memoryVault.has(officerId)) return true;
    try {
      const safeId = this.sanitizeId(officerId);
      return fs.existsSync(path.join(this.keyDir, `${safeId}.key`));
    } catch {
      return false;
    }
  }

  /**
   * Retrieve the officer's public key
   */
  public async getPublicKey(officerId: string): Promise<string | null> {
    const item = this.memoryVault.get(officerId);
    if (item) return item.metadata.publicKeyMultibase;

    try {
      const safeId = this.sanitizeId(officerId);
      const metaPath = path.join(this.keyDir, `${safeId}.meta.json`);
      if (fs.existsSync(metaPath)) {
        const meta: KeyMetadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        return meta.publicKeyMultibase;
      }
    } catch {}

    return null;
  }

  /**
   * Retrieve non-sensitive key metadata
   */
  public async getKeyMetadata(officerId: string): Promise<KeyMetadata | null> {
    const item = this.memoryVault.get(officerId);
    if (item) return item.metadata;

    try {
      const safeId = this.sanitizeId(officerId);
      const metaPath = path.join(this.keyDir, `${safeId}.meta.json`);
      if (fs.existsSync(metaPath)) {
        return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      }
    } catch {}

    return null;
  }

  /**
   * Signs canonicalized data using the officer's private key.
   * CRITICAL: The private key is retrieved and used strictly inside this method.
   * Returns ONLY the hex-encoded Ed25519 digital signature.
   */
  public async sign(canonicalPayload: string, officerId: string): Promise<string> {
    let privateKeyPem: string | null = null;

    const item = this.memoryVault.get(officerId);
    if (item) {
      privateKeyPem = item.privateKeyPem;
    } else {
      try {
        const safeId = this.sanitizeId(officerId);
        const keyPath = path.join(this.keyDir, `${safeId}.key`);
        if (fs.existsSync(keyPath)) {
          privateKeyPem = fs.readFileSync(keyPath, 'utf8');
        }
      } catch (err) {}
    }

    if (!privateKeyPem) {
      const err: any = new Error(`No signing key provisioned for officer: ${officerId}`);
      err.code = 'SIGNING_KEY_NOT_FOUND';
      throw err;
    }

    try {
      const privateKey = crypto.createPrivateKey(privateKeyPem);
      const signatureBuffer = crypto.sign(null, Buffer.from(canonicalPayload, 'utf8'), privateKey);
      return signatureBuffer.toString('hex');
    } catch (signErr: any) {
      const err: any = new Error(`Failed to generate digital signature: ${signErr.message}`);
      err.code = 'SIGNATURE_GENERATION_FAILED';
      throw err;
    }
  }
}

// Export singleton instance of KeyProvider
export const keyProvider: IKeyProvider = new DevelopmentKeyStore();
