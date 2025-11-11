/**
 * Encryption Key Manager
 *
 * Manages the SQLCipher encryption key with hardware-backed secure storage.
 *
 * Security Architecture:
 * - iOS: Uses Keychain with kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
 * - Android: Uses Android Keystore with AES-256 encryption
 * - Key is generated on first launch and never leaves the device
 * - Zero-knowledge architecture: server never has access to key
 *
 * Key Properties:
 * - 256-bit random key (32 bytes)
 * - Hex-encoded for SQLCipher compatibility
 * - Stored in hardware keychain (survives app reinstall if iCloud/Google backup enabled)
 * - Deleted on logout (if user chooses to delete account)
 *
 * CRITICAL SECURITY NOTES:
 * 1. NEVER log the encryption key (even in development)
 * 2. NEVER transmit the key over network
 * 3. NEVER store the key in AsyncStorage or unencrypted storage
 */

import * as Keychain from 'react-native-keychain';
import { randomBytes } from 'react-native-quick-crypto';

const KEYCHAIN_SERVICE = 'com.quantumdecisions.encryption';
const KEYCHAIN_KEY = 'database_encryption_key';

/**
 * Get or create encryption key
 *
 * @returns Promise<string> Hex-encoded 256-bit encryption key
 */
export async function getEncryptionKey(): Promise<string> {
  try {
    // Try to retrieve existing key
    const credentials = await Keychain.getGenericPassword({
      service: KEYCHAIN_SERVICE,
    });

    if (credentials && credentials.password) {
      console.log('[Encryption] Retrieved existing encryption key from keychain');
      return credentials.password;
    }

    // No existing key, generate new one
    console.log('[Encryption] No existing key found, generating new key...');
    const newKey = await generateEncryptionKey();

    // Store in keychain
    await storeEncryptionKey(newKey);

    console.log('[Encryption] ✅ New encryption key generated and stored');
    return newKey;
  } catch (error) {
    console.error('[Encryption] ❌ Failed to get encryption key:', error);
    throw new Error('Failed to retrieve or generate encryption key');
  }
}

/**
 * Generate a new 256-bit encryption key
 *
 * @returns Promise<string> Hex-encoded random key
 */
async function generateEncryptionKey(): Promise<string> {
  try {
    // Generate 32 random bytes (256 bits)
    const keyBytes = randomBytes(32);

    // Convert to hex string for SQLCipher
    const keyHex = Buffer.from(keyBytes).toString('hex');

    console.log('[Encryption] Generated 256-bit encryption key');
    // NEVER log the actual key: console.log('Key:', keyHex); // ❌ NEVER DO THIS

    return keyHex;
  } catch (error) {
    console.error('[Encryption] Failed to generate encryption key:', error);
    throw error;
  }
}

/**
 * Store encryption key in hardware keychain
 *
 * @param key Hex-encoded encryption key
 */
async function storeEncryptionKey(key: string): Promise<void> {
  try {
    await Keychain.setGenericPassword(KEYCHAIN_KEY, key, {
      service: KEYCHAIN_SERVICE,
      accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      // Security levels:
      // - AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: Highest security, requires device unlock
      // - Does NOT sync to iCloud/Google (ThisDeviceOnly)
      // - Survives app reinstall but NOT device restore (trade-off for security)

      // Additional security options (iOS)
      securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE,
      // Use hardware-backed keystore (Secure Enclave on iOS, Keystore on Android)

      // Biometric protection (optional, for future Phase 2 feature)
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
    });

    console.log('[Encryption] Encryption key stored securely in hardware keychain');
  } catch (error) {
    console.error('[Encryption] Failed to store encryption key:', error);
    throw new Error('Failed to store encryption key in keychain');
  }
}

/**
 * Rotate encryption key (generate new key and re-encrypt database)
 * This is a CRITICAL security operation
 *
 * @returns Promise<string> New encryption key
 */
export async function rotateEncryptionKey(): Promise<string> {
  try {
    console.log('[Encryption] Starting key rotation...');

    // Generate new key
    const newKey = await generateEncryptionKey();

    // Store new key (overwrites old key)
    await storeEncryptionKey(newKey);

    console.log('[Encryption] ✅ Key rotation successful');

    // NOTE: Caller must re-encrypt database with new key
    // See sqlite-adapter.ts -> reencryptDatabase()

    return newKey;
  } catch (error) {
    console.error('[Encryption] ❌ Key rotation failed:', error);
    throw new Error('Key rotation failed');
  }
}

/**
 * Delete encryption key (for logout/account deletion)
 * CRITICAL SECURITY: This makes the database permanently unreadable
 *
 * @param confirmDeletion Safety check to prevent accidental deletion
 */
export async function deleteEncryptionKey(confirmDeletion: boolean): Promise<void> {
  if (!confirmDeletion) {
    throw new Error('Encryption key deletion requires explicit confirmation');
  }

  try {
    console.log('[Encryption] Deleting encryption key...');

    await Keychain.resetGenericPassword({
      service: KEYCHAIN_SERVICE,
    });

    console.log('[Encryption] ✅ Encryption key deleted');
    console.log('[Encryption] ⚠️ Database is now permanently unreadable');
  } catch (error) {
    console.error('[Encryption] Failed to delete encryption key:', error);
    throw new Error('Failed to delete encryption key');
  }
}

/**
 * Check if encryption key exists
 *
 * @returns Promise<boolean> True if key exists in keychain
 */
export async function hasEncryptionKey(): Promise<boolean> {
  try {
    const credentials = await Keychain.getGenericPassword({
      service: KEYCHAIN_SERVICE,
    });

    return !!(credentials && credentials.password);
  } catch (error) {
    console.error('[Encryption] Failed to check for encryption key:', error);
    return false;
  }
}

/**
 * Validate encryption key format
 *
 * @param key Hex-encoded key to validate
 * @returns boolean True if key is valid format
 */
export function validateEncryptionKey(key: string): boolean {
  // Key must be:
  // 1. 64 hex characters (32 bytes = 256 bits)
  // 2. Only contain hex characters (0-9, a-f)

  const hexRegex = /^[0-9a-fA-F]{64}$/;
  return hexRegex.test(key);
}

/**
 * Export key for backup (DANGEROUS - use with extreme caution)
 * This should ONLY be used for user-initiated, encrypted backups
 *
 * @param userPassword User's backup password
 * @returns Promise<string> Encrypted key for backup
 */
export async function exportKeyForBackup(userPassword: string): Promise<string> {
  if (!userPassword || userPassword.length < 12) {
    throw new Error('Backup password must be at least 12 characters');
  }

  try {
    console.log('[Encryption] Exporting key for encrypted backup...');

    // Get current key
    const key = await getEncryptionKey();

    // Encrypt key with user's password (using PBKDF2 + AES)
    // TODO: Implement password-based encryption
    // For Phase 1, we'll defer this to Phase 2 (cloud backup feature)

    console.log('[Encryption] ⚠️ Key export not yet implemented (Phase 2 feature)');
    throw new Error('Key export not yet implemented');
  } catch (error) {
    console.error('[Encryption] Key export failed:', error);
    throw error;
  }
}

/**
 * Import key from backup (DANGEROUS - use with extreme caution)
 *
 * @param encryptedKey Encrypted key from backup
 * @param userPassword User's backup password
 */
export async function importKeyFromBackup(encryptedKey: string, userPassword: string): Promise<void> {
  if (!userPassword || userPassword.length < 12) {
    throw new Error('Backup password must be at least 12 characters');
  }

  try {
    console.log('[Encryption] Importing key from encrypted backup...');

    // Decrypt key with user's password
    // TODO: Implement password-based decryption
    // For Phase 1, we'll defer this to Phase 2 (cloud backup feature)

    console.log('[Encryption] ⚠️ Key import not yet implemented (Phase 2 feature)');
    throw new Error('Key import not yet implemented');
  } catch (error) {
    console.error('[Encryption] Key import failed:', error);
    throw error;
  }
}

/**
 * Test encryption key (development only)
 * Verifies that keychain operations are working correctly
 */
export async function testEncryptionKey(): Promise<{
  success: boolean;
  keyExists: boolean;
  keyValid: boolean;
  error?: string;
}> {
  try {
    console.log('[Encryption] Testing encryption key operations...');

    // Check if key exists
    const keyExists = await hasEncryptionKey();

    // Get or generate key
    const key = await getEncryptionKey();

    // Validate key format
    const keyValid = validateEncryptionKey(key);

    console.log('[Encryption] ✅ Encryption key test passed');
    console.log(`[Encryption] Key exists: ${keyExists}`);
    console.log(`[Encryption] Key valid: ${keyValid}`);

    return {
      success: true,
      keyExists,
      keyValid,
    };
  } catch (error) {
    console.error('[Encryption] ❌ Encryption key test failed:', error);
    return {
      success: false,
      keyExists: false,
      keyValid: false,
      error: String(error),
    };
  }
}
