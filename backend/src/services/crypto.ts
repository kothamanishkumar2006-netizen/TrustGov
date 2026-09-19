/**
 * TRUSTGOV - PHASE 3: DID & Cryptographic Identity Service
 * 
 * Cryptographic Algorithm: Ed25519
 * Prototype DID Method: did:trustgov:<uuid>
 * 
 * DISCLAIMER:
 * 'did:trustgov' is a project-specific prototype DID method designed for the
 * TrustGov government officer anti-impersonation platform. It is NOT an officially
 * registered W3C DID method. It is architected modularly to be replaced or bridged
 * with standard W3C DID methods or public blockchain DIDs in later phases.
 * 
 * CRITICAL SECURITY ARCHITECTURE:
 * Private keys must NEVER be persisted in PostgreSQL, returned in REST APIs,
 * stored in browser client states, or printed to application logs.
 * Production deployments require hardware/KMS custody (Cloud KMS / HSM / Secure Enclave).
 */

import crypto from 'crypto';

// Base58btc character alphabet
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * Encodes a buffer to Base58btc string
 */
export function base58Encode(buffer: Buffer): string {
  const digits = [0];
  for (let i = 0; i < buffer.length; i++) {
    for (let j = 0; j < digits.length; j++) {
      digits[j] <<= 8;
    }
    digits[0] += buffer[i];
    let carry = 0;
    for (let j = 0; j < digits.length; j++) {
      digits[j] += carry;
      carry = (digits[j] / 58) | 0;
      digits[j] %= 58;
    }
    while (carry) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  for (let i = 0; buffer[i] === 0 && i < buffer.length - 1; i++) {
    digits.push(0);
  }
  return digits.reverse().map(d => BASE58_ALPHABET[d]).join('');
}

/**
 * Decodes a Base58btc string into a Buffer
 */
export function base58Decode(str: string): Buffer {
  if (str.length === 0) return Buffer.alloc(0);
  const bytes = [0];
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    const val = BASE58_ALPHABET.indexOf(c);
    if (val === -1) throw new Error(`Invalid Base58 character: ${c}`);
    for (let j = 0; j < bytes.length; j++) {
      bytes[j] *= 58;
    }
    bytes[0] += val;
    let carry = 0;
    for (let j = 0; j < bytes.length; j++) {
      bytes[j] += carry;
      carry = bytes[j] >> 8;
      bytes[j] &= 0xff;
    }
    while (carry) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (let i = 0; str[i] === BASE58_ALPHABET[0] && i < str.length - 1; i++) {
    bytes.push(0);
  }
  return Buffer.from(bytes.reverse());
}

export interface GeneratedKeyPair {
  publicKeyMultibase: string;
  publicKeyHex: string;
  publicKeyPem: string;
  privateKeyPem: string;
}

/**
 * Generates an Ed25519 keypair.
 * The private key returned is transient and must NEVER be persisted or sent to clients.
 */
export function generateEd25519KeyPair(): GeneratedKeyPair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');

  const derBuffer = publicKey.export({ type: 'spki', format: 'der' });
  // Ed25519 SPKI DER prefix is 12 bytes (302a300506032b6570032100), followed by 32-byte raw public key
  const rawPublicKey = derBuffer.subarray(12);

  // W3C Ed25519 multicodec prefix: 0xed, 0x01
  const multicodecHeader = Buffer.from([0xed, 0x01]);
  const multicodecBytes = Buffer.concat([multicodecHeader, rawPublicKey]);

  // Multibase prefix 'z' signifies base58btc encoding
  const publicKeyMultibase = 'z' + base58Encode(multicodecBytes);
  const publicKeyHex = rawPublicKey.toString('hex');
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;

  return {
    publicKeyMultibase,
    publicKeyHex,
    publicKeyPem,
    privateKeyPem
  };
}

/**
 * Reconstructs a Node crypto KeyObject public key from a Multibase or Hex Ed25519 key string
 */
export function importPublicKey(publicKeyStr: string): crypto.KeyObject {
  if (publicKeyStr.startsWith('-----BEGIN PUBLIC KEY-----')) {
    return crypto.createPublicKey(publicKeyStr);
  }

  let rawBytes: Buffer;
  if (publicKeyStr.startsWith('z')) {
    // Multibase base58btc
    const decoded = base58Decode(publicKeyStr.slice(1));
    // Check multicodec prefix 0xed01
    if (decoded[0] === 0xed && decoded[1] === 0x01) {
      rawBytes = decoded.subarray(2);
    } else {
      rawBytes = decoded;
    }
  } else {
    // Treat as hex
    rawBytes = Buffer.from(publicKeyStr, 'hex');
  }

  // Wrap in 12-byte standard SPKI header for Ed25519
  const spkiHeader = Buffer.from('302a300506032b6570032100', 'hex');
  const fullDer = Buffer.concat([spkiHeader, rawBytes]);

  return crypto.createPublicKey({
    key: fullDer,
    format: 'der',
    type: 'spki'
  });
}

/**
 * Signs a message using an Ed25519 private key (transient use only)
 */
export function signMessage(message: string, privateKeyPem: string): string {
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const signature = crypto.sign(null, Buffer.from(message, 'utf8'), privateKey);
  return signature.toString('hex');
}

/**
 * Verifies an Ed25519 signature against a public key
 */
export function verifySignature(message: string, signatureHex: string, publicKeyStr: string): boolean {
  try {
    const keyObject = importPublicKey(publicKeyStr);
    const signatureBuffer = Buffer.from(signatureHex, 'hex');
    return crypto.verify(null, Buffer.from(message, 'utf8'), keyObject, signatureBuffer);
  } catch (err) {
    return false;
  }
}

/**
 * Standard regex for TrustGov prototype DID
 * Format: did:trustgov:<UUID>
 */
const DID_REGEX = /^did:trustgov:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Validates whether a given string is a valid TrustGov prototype DID
 */
export function isValidDID(did: string): boolean {
  return typeof did === 'string' && DID_REGEX.test(did);
}

/**
 * Generates a cryptographically random TrustGov DID
 */
export function generateDID(customUuid?: string): string {
  const identifier = customUuid || crypto.randomUUID();
  return `did:trustgov:${identifier}`;
}

export interface DIDDocument {
  '@context': string[];
  id: string;
  verificationMethod: Array<{
    id: string;
    type: string;
    controller: string;
    publicKeyMultibase: string;
  }>;
  authentication: string[];
  assertionMethod: string[];
  status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  metadata: {
    method: 'did:trustgov';
    isPrototype: true;
    disclaimer: string;
    keyType: 'Ed25519';
    createdAt?: string;
    updatedAt?: string;
  };
}

/**
 * Builds a W3C-aligned DID Document representation
 */
export function buildDIDDocument(
  did: string,
  publicKeyMultibase: string,
  status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED',
  createdAt?: string,
  updatedAt?: string
): DIDDocument {
  const keyId = `${did}#key-1`;

  return {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/suites/ed25519-2020/v1'
    ],
    id: did,
    verificationMethod: [
      {
        id: keyId,
        type: 'Ed25519VerificationKey2020',
        controller: did,
        publicKeyMultibase: publicKeyMultibase
      }
    ],
    authentication: [keyId],
    assertionMethod: [keyId],
    status: status,
    metadata: {
      method: 'did:trustgov',
      isPrototype: true,
      disclaimer: 'Prototype DID method for TrustGov project. Not an officially registered W3C DID method.',
      keyType: 'Ed25519',
      createdAt,
      updatedAt
    }
  };
}
