/**
 * TRUSTGOV - PHASE 9: SECURE REPORT EVIDENCE STORAGE & SHA-256 ENGINE
 * 
 * Provides:
 * - Strict file type, MIME type, and size validation
 * - Server-side SHA-256 integrity hash calculation
 * - Off-chain, protected storage abstraction
 * - Live cryptographic integrity verification and tamper detection
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Protected storage directory outside public web root
const STORAGE_DIR = path.resolve(__dirname, '../../../storage/evidence');

// Ensure storage directory exists
if (!fs.existsSync(STORAGE_DIR)) {
  try {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  } catch (err) {
    // Non-fatal if filesystem is restricted; in-memory map will act as fallback
  }
}

// In-memory buffer map fallback for development and test execution
const inMemoryEvidenceFiles = new Map<string, Buffer>();

// Strict limits
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_EVIDENCE_PER_REPORT = 10;

// Allowed MIME types
export const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'application/pdf',
  'text/plain',
  'image/webp'
]);

// Allowed extensions
export const ALLOWED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.pdf',
  '.txt',
  '.webp'
]);

// Explicitly prohibited executable and script extensions
export const PROHIBITED_EXTENSIONS = new Set([
  '.exe',
  '.bat',
  '.cmd',
  '.ps1',
  '.js',
  '.vbs',
  '.scr',
  '.sh',
  '.apk',
  '.zip',
  '.tar',
  '.gz',
  '.msi',
  '.dll',
  '.com',
  '.jar',
  '.py',
  '.bin'
]);

export interface FileValidationResult {
  valid: boolean;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Validates file size, extension, and MIME type before storage.
 */
export function validateEvidenceFile(
  filename: string,
  mimeType: string,
  fileSize: number
): FileValidationResult {
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      errorCode: 'FILE_TOO_LARGE',
      errorMessage: `File size exceeds maximum allowable limit of 10MB (${fileSize} bytes provided).`
    };
  }

  // Path traversal protection
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\') || /%2e/i.test(filename)) {
    return {
      valid: false,
      errorCode: 'INVALID_FILENAME',
      errorMessage: 'Filename cannot contain directory traversal characters or slashes.'
    };
  }

  const ext = path.extname(filename).toLowerCase();

  if (PROHIBITED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      errorCode: 'PROHIBITED_FILE_TYPE',
      errorMessage: `File extension '${ext}' is strictly prohibited. Executables, scripts, and archives cannot be submitted as evidence.`
    };
  }

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      errorCode: 'UNSUPPORTED_FILE_EXTENSION',
      errorMessage: `Extension '${ext}' is not supported. Supported extensions: .jpg, .png, .pdf, .txt, .webp.`
    };
  }

  if (!ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) {
    return {
      valid: false,
      errorCode: 'UNSUPPORTED_MIME_TYPE',
      errorMessage: `MIME type '${mimeType}' is not supported. Supported types: image/jpeg, image/png, application/pdf, text/plain, image/webp.`
    };
  }

  return { valid: true };
}

/**
 * Calculates SHA-256 cryptographic digest of a buffer.
 */
export function calculateSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Stores an evidence buffer and returns metadata with SHA-256 digest.
 */
export async function storeEvidenceBuffer(
  originalFilename: string,
  mimeType: string,
  buffer: Buffer
): Promise<{
  storedFilename: string;
  sha256Hash: string;
  fileSize: number;
  storageReference: string;
}> {
  // Validate
  const validation = validateEvidenceFile(originalFilename, mimeType, buffer.length);
  if (!validation.valid) {
    throw {
      statusCode: 400,
      code: validation.errorCode,
      message: validation.errorMessage
    };
  }

  // Calculate SHA-256 digest server-side
  const sha256Hash = calculateSha256(buffer);
  const ext = path.extname(originalFilename).toLowerCase();
  const storedFilename = `${crypto.randomBytes(16).toString('hex')}${ext}`;

  // Store in memory map
  inMemoryEvidenceFiles.set(storedFilename, buffer);

  // Attempt to write to protected storage directory
  try {
    const filePath = path.join(STORAGE_DIR, storedFilename);
    await fs.promises.writeFile(filePath, buffer);
  } catch (err) {
    // Non-fatal if filesystem access is restricted; memory map persists file
  }

  return {
    storedFilename,
    sha256Hash,
    fileSize: buffer.length,
    storageReference: `evidence://${storedFilename}`
  };
}

/**
 * Reads evidence file buffer from storage or in-memory fallback.
 */
export async function readEvidenceBuffer(storedFilename: string): Promise<Buffer | null> {
  // Path traversal containment check
  const resolvedBase = path.resolve(STORAGE_DIR);
  const resolvedPath = path.resolve(STORAGE_DIR, storedFilename);
  if (!resolvedPath.startsWith(resolvedBase + path.sep) && resolvedPath !== resolvedBase) {
    return null; // Deny path traversal attempt
  }

  // Check physical storage directory first (source of truth for persisted evidence)
  try {
    if (fs.existsSync(resolvedPath)) {
      return await fs.promises.readFile(resolvedPath);
    }
  } catch (err) {
    // File could not be read from disk
  }

  // Fallback to in-memory map for testing/restricted environments
  if (inMemoryEvidenceFiles.has(storedFilename)) {
    return inMemoryEvidenceFiles.get(storedFilename)!;
  }

  return null;
}

/**
 * Live SHA-256 Integrity Verification:
 * Recalculates hash of stored bytes and compares against stored hash.
 */
export async function verifyEvidenceIntegrity(
  storedFilename: string,
  expectedHash: string
): Promise<{
  valid: boolean;
  calculatedHash: string;
  storedHash: string;
}> {
  const buffer = await readEvidenceBuffer(storedFilename);
  if (!buffer) {
    return {
      valid: false,
      calculatedHash: 'FILE_NOT_FOUND',
      storedHash: expectedHash
    };
  }

  const calculatedHash = calculateSha256(buffer);
  const valid = calculatedHash.toLowerCase() === expectedHash.toLowerCase();

  return {
    valid,
    calculatedHash,
    storedHash: expectedHash
  };
}

/**
 * Test helper: Simulates byte tampering on stored evidence to verify tamper detection.
 */
export async function simulateEvidenceTampering(
  storedFilename: string,
  tamperedContent: string = 'TAMPERED_BYTES_12345'
): Promise<void> {
  const tamperedBuffer = Buffer.from(tamperedContent);
  inMemoryEvidenceFiles.set(storedFilename, tamperedBuffer);

  try {
    const filePath = path.join(STORAGE_DIR, storedFilename);
    if (fs.existsSync(filePath)) {
      await fs.promises.writeFile(filePath, tamperedBuffer);
    }
  } catch {
    // Memory map updated
  }
}
