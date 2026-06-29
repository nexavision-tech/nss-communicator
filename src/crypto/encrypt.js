/**
 * NSS Communicator — Message Encryption Module
 * Hybrid encryption: AES-256-GCM (message) + RSA-OAEP (key wrapping) + RSASSA-PKCS1-v1_5 (signing).
 *
 * NSS String Format:
 *   NSS:v1:<channel>:<senderFingerprint>:<base64payload>
 *
 * Payload structure (JSON, then base64):
 *   {
 *     encryptedKey: base64,   // AES key encrypted with recipient RSA-OAEP (omitted for channel 0)
 *     iv: base64,             // AES-GCM IV (omitted for channel 0)
 *     ciphertext: base64,     // AES-GCM ciphertext (or base64 plaintext for channel 0)
 *     signature: base64,      // RSASSA-PKCS1-v1_5 signature over ciphertext
 *   }
 *
 * Channel 0 (Public): Sign-only mode — message is base64-encoded but NOT encrypted.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const NSSEncrypt = (() => {
  'use strict';

  const NSS_VERSION = 'v1';
  const NSS_PREFIX = 'NSS';

  /**
   * Encrypt a message for a specific recipient.
   *
   * @param {string} plaintext — Message to encrypt
   * @param {{encrypt: CryptoKey, sign: CryptoKey}} recipientPublicKey — Recipient's public keys
   * @param {{encrypt: CryptoKey, sign: CryptoKey}} senderPrivateKey — Sender's private keys (for signing)
   * @param {{encrypt: CryptoKey, sign: CryptoKey}} senderPublicKey — Sender's public keys (for fingerprint)
   * @param {number} channel — Channel number 0-15 (0 = public/sign-only)
   * @returns {Promise<string>} Formatted NSS string
   */
  async function encryptMessage(plaintext, recipientPublicKey, senderPrivateKey, senderPublicKey, channel = 1) {
    if (channel < 0 || channel > 15) {
      throw new Error('Channel must be between 0 and 15');
    }

    const fingerprint = await NSSKeys.getFingerprint(senderPublicKey);
    const encoder = new TextEncoder();
    const plaintextBytes = encoder.encode(plaintext);

    let payload;

    if (channel === 0) {
      // ── Channel 0: Public / Sign-Only ──────────────────────────
      const messageB64 = NSSKeys._arrayBufferToBase64(plaintextBytes.buffer);

      // Sign the plaintext bytes
      const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        senderPrivateKey.sign,
        plaintextBytes
      );

      payload = {
        mode: 'sign-only',
        ciphertext: messageB64,
        signature: NSSKeys._arrayBufferToBase64(signature),
      };
    } else {
      // ── Channels 1-15: Full Hybrid Encryption ─────────────────

      // 1. Generate random AES-256-GCM key
      const aesKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      // 2. Generate random 12-byte IV
      const iv = crypto.getRandomValues(new Uint8Array(12));

      // 3. Encrypt message with AES-256-GCM
      const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        aesKey,
        plaintextBytes
      );

      // 4. Export and encrypt AES key with recipient's RSA-OAEP public key
      const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);
      const encryptedKey = await crypto.subtle.encrypt(
        { name: 'RSA-OAEP' },
        recipientPublicKey.encrypt,
        rawAesKey
      );

      // 5. Sign the ciphertext with sender's signing key
      const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        senderPrivateKey.sign,
        ciphertext
      );

      payload = {
        mode: 'encrypted',
        encryptedKey: NSSKeys._arrayBufferToBase64(encryptedKey),
        iv: NSSKeys._arrayBufferToBase64(iv.buffer),
        ciphertext: NSSKeys._arrayBufferToBase64(ciphertext),
        signature: NSSKeys._arrayBufferToBase64(signature),
      };
    }

    // Encode payload as base64 JSON
    const payloadB64 = btoa(JSON.stringify(payload));

    // Format: >>--NSS:v1:<channel>:<fingerprint>:<payload>-->
    return `>>--${NSS_PREFIX}:${NSS_VERSION}:${channel}:${fingerprint}:${payloadB64}-->`;
  }

  /**
   * Decrypt an NSS-formatted message.
   *
   * @param {string} nssString — Full NSS string (NSS:v1:...)
   * @param {{encrypt: CryptoKey, sign: CryptoKey}} privateKey — Recipient's private keys
   * @param {{encrypt: CryptoKey, sign: CryptoKey}|null} senderPublicKey — Sender's public keys (for verification, optional)
   * @returns {Promise<{plaintext: string, channel: number, senderFingerprint: string, verified: boolean}>}
   */
  async function decryptMessage(nssString, privateKey, senderPublicKey = null) {
    // Strip archer arrows before parsing
    let cleanString = nssString.trim();
    if (cleanString.startsWith('>>--')) cleanString = cleanString.substring(4);
    if (cleanString.endsWith('-->')) cleanString = cleanString.substring(0, cleanString.length - 3);

    const parts = cleanString.split(':');

    if (parts.length < 5 || parts[0] !== NSS_PREFIX) {
      throw new Error('Invalid NSS string format');
    }

    const version = parts[1];
    if (version !== NSS_VERSION) {
      throw new Error(`Unsupported NSS version: ${version}`);
    }

    const channel = parseInt(parts[2], 10);
    const senderFingerprint = parts[3];
    // Rejoin remaining parts in case payload contained colons (shouldn't in base64, but be safe)
    const payloadB64 = parts.slice(4).join(':');

    const payload = JSON.parse(atob(payloadB64));
    const decoder = new TextDecoder();

    let plaintext;
    let verified = false;

    if (channel === 0 || payload.mode === 'sign-only') {
      // ── Channel 0: Sign-Only ───────────────────────────────────
      const messageBytes = NSSKeys._base64ToArrayBuffer(payload.ciphertext);
      plaintext = decoder.decode(messageBytes);

      // Verify signature if sender's public key is available
      if (senderPublicKey) {
        const signatureBytes = NSSKeys._base64ToArrayBuffer(payload.signature);
        verified = await crypto.subtle.verify(
          'RSASSA-PKCS1-v1_5',
          senderPublicKey.sign,
          signatureBytes,
          messageBytes
        );
      }
    } else {
      // ── Encrypted Mode ─────────────────────────────────────────

      // 1. Decrypt AES key with private RSA key
      const encryptedKeyBytes = NSSKeys._base64ToArrayBuffer(payload.encryptedKey);
      const rawAesKey = await crypto.subtle.decrypt(
        { name: 'RSA-OAEP' },
        privateKey.encrypt,
        encryptedKeyBytes
      );

      // 2. Import the decrypted AES key
      const aesKey = await crypto.subtle.importKey(
        'raw',
        rawAesKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      // 3. Decrypt message with AES-256-GCM
      const iv = NSSKeys._base64ToArrayBuffer(payload.iv);
      const ciphertext = NSSKeys._base64ToArrayBuffer(payload.ciphertext);

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        aesKey,
        ciphertext
      );

      plaintext = decoder.decode(decrypted);

      // 4. Verify signature if sender's public key is available
      if (senderPublicKey) {
        const signatureBytes = NSSKeys._base64ToArrayBuffer(payload.signature);
        verified = await crypto.subtle.verify(
          'RSASSA-PKCS1-v1_5',
          senderPublicKey.sign,
          signatureBytes,
          ciphertext
        );
      }
    }

    return {
      plaintext,
      channel,
      senderFingerprint,
      verified,
    };
  }

  /**
   * Check if a string looks like an NSS message (quick regex check, no decryption).
   * @param {string} str
   * @returns {boolean}
   */
  function isNSSString(str) {
    return /^>>--NSS:v1:\d{1,2}:[0-9a-f]{8}:/.test(str);
  }

  /**
   * Parse NSS header without decrypting (for display purposes).
   * @param {string} nssString
   * @returns {{version: string, channel: number, senderFingerprint: string}|null}
   */
  function parseHeader(nssString) {
    const match = nssString.match(/^>>--NSS:(v\d+):(\d{1,2}):([0-9a-f]{8}):/);
    if (!match) return null;

    return {
      version: match[1],
      channel: parseInt(match[2], 10),
      senderFingerprint: match[3],
    };
  }

  // ── Public API ─────────────────────────────────────────────────────

  return {
    encryptMessage,
    decryptMessage,
    isNSSString,
    parseHeader,
  };
})();

if (typeof globalThis !== 'undefined') {
  globalThis.NSSEncrypt = NSSEncrypt;
}
